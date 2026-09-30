# -*- coding: utf-8 -*-
"""
NEON PULSE · 04-audio-fx — 音效合成脚本（SFX）
=============================================
依据 docs/01-audio-design.md 的逐条设定合成全部游戏音效，输出到 audio/sfx/。
风格基准：现代霓虹街机（Modern Neon Arcade）——干净、短促、数字合成感、
带轻微混响尾音；禁止采样/拟真录音质感。

事件覆盖（对照 01-framework/framework.md §8.2 / 02-design-ppt 反馈页）：
UI 导航 / 方块操作 / 消行 1–4 / Combo 升调 / T-Spin / B2B / Perfect Clear /
升级 / 危险预警 / 暂停与倒计时 / 破纪录 / 结算 / 解锁。

运行：python gen_sfx.py   （输出 audio/sfx/*.wav + _sfx_meta.json）
"""

import json
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from synthlib import (SR, bandpass, delay_fx, env_adsr, env_ar, env_exp, highpass,
                      lowpass, midi_to_freq, norm, peak_of, place, reverb, saw,
                      sine, softclip, square, triangle, white_noise, write_wav)

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "audio", "sfx")


def mix(a: np.ndarray, b: np.ndarray) -> np.ndarray:
    """把两个不等长缓冲按起点对齐叠加（短者补零）"""
    n = max(a.shape[0], b.shape[0])
    out = np.zeros(n, dtype=np.float64)
    out[: a.shape[0]] += a
    out[: b.shape[0]] += b
    return out


# ================================================================ 合成积木
def blip(f0, f1, dur, wave="sine", amp=0.5, attack=0.003, decay=None):
    """短滑音哔声（UI / 旋转 / 提示主力音色）"""
    n = int(dur * SR)
    freqs = np.geomspace(f0, f1, n) if f0 != f1 else np.full(n, float(f0))
    osc = {"sine": sine, "saw": saw, "square": square, "triangle": triangle}[wave]
    x = osc(freqs, n)
    e = env_exp(n, decay if decay is not None else dur * 0.45, attack)
    return amp * x * e


def noise_hit(dur, lo, hi, amp=0.5, decay=None, seed=None, attack=0.001):
    """带通噪声打击（瞬态 / 沙锤 / 气流）"""
    n = int(dur * SR)
    x = white_noise(n, seed)
    x = bandpass(x, lo, hi)
    e = env_exp(n, decay if decay is not None else dur * 0.4, attack)
    return amp * x * e


def impact(dur=0.28, f0=130.0, f1=55.0, amp=0.8, click=True):
    """低频冲击（硬降 / 大消行 / 落底）：滑落正弦 + 咔嗒瞬态"""
    n = int(dur * SR)
    freqs = np.geomspace(f0, f1, max(8, int(0.06 * SR)))
    freqs = np.concatenate([freqs, np.full(n - freqs.shape[0], f1)])
    x = sine(freqs, n) * env_exp(n, dur * 0.5, 0.001)
    if click:
        x = mix(x, 0.5 * highpass(white_noise(n, 7), 1800) * env_exp(n, 0.012, 0.0005))
    return amp * x


def chord(dur, midis, wave="saw", amp=0.4, attack=0.004, release=0.15, detune=0.0):
    """和弦（叠加波形，可加失谐）"""
    n = int(dur * SR)
    x = np.zeros(n)
    for i, m in enumerate(midis):
        f = midi_to_freq(m) * (2.0 ** (detune * ((i % 3) - 1) / 1200.0))
        osc = {"sine": sine, "saw": saw, "square": square, "triangle": triangle}[wave]
        x = mix(x, osc(f, n))
    x /= max(1, len(midis))
    return amp * x * env_ar(n, attack, release)


def bell(dur, midis, amp=0.5, decay=0.6, partials=(1.0, 2.01, 2.98, 4.2)):
    """钟/闪光音色（非谐分音，破纪录 / 全清 / 解锁）"""
    n = int(dur * SR)
    x = np.zeros(n)
    for m in midis:
        base = midi_to_freq(m)
        for k, p in enumerate(partials):
            x = mix(x, (0.75 ** k) * sine(base * p, n) * env_exp(n, decay / (1.0 + 0.35 * k), 0.002))
    x /= max(1, len(midis))
    return amp * x


def whoosh(dur=0.2, lo0=300, hi0=1200, lo1=1200, hi1=5000, amp=0.4, seed=3):
    """气流扫频（硬降下坠 / Hold 切换）"""
    n = int(dur * SR)
    x = white_noise(n, seed)
    # 分 8 段做带通扫频近似（避免逐采样 IIR）
    seg = max(1, n // 8)
    out = np.zeros(n)
    for i in range(8):
        a, b = i * seg, min((i + 1) * seg, n)
        if b <= a:
            break
        t0 = i / 7.0
        lo = lo0 * (lo1 / lo0) ** t0
        hi = hi0 * (hi1 / hi0) ** t0
        out[a:b] = bandpass(x[a:b], lo, hi)
    e = env_ar(n, dur * 0.25, dur * 0.4)
    return amp * out * e


# ================================================================ UI 音效
def sfx_ui_hover():
    """菜单悬停：极轻高频哔声"""
    x = blip(1800, 2100, 0.045, "sine", amp=0.16, decay=0.02)
    return x


def sfx_ui_move():
    """菜单光标移动：短促双分音数字滴"""
    x = blip(900, 1150, 0.07, "square", amp=0.22, decay=0.028)
    x = mix(x, blip(1800, 2100, 0.035, "sine", amp=0.10, decay=0.015))
    return lowpass(x, 6500)


def sfx_ui_confirm():
    """确认 / 开始：上行双音 + 轻混响"""
    x = blip(660, 660, 0.09, "triangle", amp=0.34)
    x = np.concatenate([x, blip(990, 1046, 0.16, "triangle", amp=0.36)])
    x = reverb(x, size=0.7, mix=0.22, decay=0.5)
    return x


def sfx_ui_cancel():
    """取消 / 返回：下行双音"""
    x = blip(660, 620, 0.08, "triangle", amp=0.30)
    x = np.concatenate([x, blip(440, 415, 0.14, "triangle", amp=0.30)])
    return reverb(x, size=0.6, mix=0.18)


def sfx_ui_error():
    """非法操作：低频蜂鸣 + 颤音"""
    n = int(0.2 * SR)
    f = 220.0 * (1.0 + 0.02 * np.sin(2 * np.pi * 9.0 * np.arange(n) / SR))
    x = square(f, n, 0.35) * env_exp(n, 0.075, 0.002)
    return 0.3 * lowpass(x, 2400)


def sfx_ui_count_beep():
    """暂停恢复倒计时 3/2/1 哨音"""
    x = blip(880, 880, 0.12, "sine", amp=0.42, decay=0.05)
    return x


def sfx_ui_count_go():
    """倒计时结束 GO 音（高八度 + 闪光尾）"""
    x = blip(1320, 1320, 0.18, "sine", amp=0.44, decay=0.07)
    x = mix(x, bell(0.35, [88], amp=0.16, decay=0.18))
    return reverb(x, size=0.6, mix=0.2)


def sfx_ui_pause_in():
    """暂停：下行二音 + 柔化（暗示时间静止）"""
    x = blip(520, 494, 0.1, "triangle", amp=0.3)
    x = np.concatenate([x, blip(330, 311, 0.22, "triangle", amp=0.3)])
    return lowpass(reverb(x, size=0.9, mix=0.3), 4200)


def sfx_ui_pause_out():
    """恢复：上行二音"""
    x = blip(330, 349, 0.09, "triangle", amp=0.3)
    x = np.concatenate([x, blip(523, 554, 0.2, "triangle", amp=0.32)])
    return reverb(x, size=0.8, mix=0.26)


# ================================================================ 方块操作
def sfx_piece_move():
    """左右移动：25ms 数字咔哒（低音量，容忍高频连打）"""
    x = blip(1500, 1250, 0.03, "square", amp=0.16, decay=0.012)
    x = mix(x, noise_hit(0.02, 1800, 6500, amp=0.10, decay=0.008, seed=11))
    return lowpass(x, 8000)


def sfx_piece_rotate():
    """旋转（顺/逆时针）：上滑哔 + 轻瞬态"""
    x = blip(1150, 1550, 0.055, "sine", amp=0.30, decay=0.022)
    x = mix(x, noise_hit(0.018, 2500, 8000, amp=0.10, decay=0.007, seed=21))
    return x


def sfx_piece_rotate_180():
    """180° 旋转：双哔（比普通旋转略厚，可区分）"""
    x = blip(1100, 1450, 0.045, "sine", amp=0.26, decay=0.018)
    x = np.concatenate([x, blip(1450, 1850, 0.055, "sine", amp=0.26, decay=0.02)])
    return x


def sfx_piece_rotate_fail():
    """旋转/移动被挡（踢墙失败）：极轻闷响，不刺耳"""
    x = blip(300, 240, 0.05, "triangle", amp=0.12, decay=0.02)
    return lowpass(x, 1200)


def sfx_piece_softdrop_tick():
    """软降逐格 tick：极轻（引擎限流 ≥30ms 一次，见文档 §3.2）"""
    x = noise_hit(0.014, 3000, 9000, amp=0.07, decay=0.005, seed=31)
    return x


def sfx_piece_hard_drop():
    """硬降：气流下坠 + 低频冲击 + 混响尾（消行/硬降为踩拍吸附对象）"""
    x = whoosh(0.12, lo0=2200, hi0=6000, lo1=250, hi1=1400, amp=0.34, seed=41)
    imp = impact(0.3, f0=150, f1=52, amp=0.95)
    n = max(x.shape[0], imp.shape[0])
    buf = np.zeros(n + int(0.05 * SR))
    place(buf, x, 0)
    place(buf, imp, int(0.085 * SR))
    buf = reverb(buf, size=0.8, mix=0.18, decay=0.5)
    return buf


def sfx_piece_lock():
    """软性锁定（未硬降）：短咔哒 + 轻低频"""
    x = noise_hit(0.03, 1200, 5200, amp=0.22, decay=0.012, seed=51)
    x = mix(x, impact(0.12, f0=110, f1=70, amp=0.30, click=False))
    return x


def sfx_hold_swap():
    """Hold 换入/换出：上行气流 + 哔"""
    x = whoosh(0.11, lo0=500, hi0=1600, lo1=1600, hi1=5200, amp=0.26, seed=61)
    x = mix(x, blip(880, 1320, 0.08, "sine", amp=0.22, decay=0.03))
    return reverb(x, size=0.55, mix=0.16)


def sfx_piece_spawn():
    """出块：几乎不可闻的高频闪烁（可选启用，默认静音级别）"""
    x = blip(2400, 2800, 0.04, "sine", amp=0.05, decay=0.016)
    return x


# ================================================================ 消行 / 连击
def _clear_base(dur, midis, sub_amp=0.5, bright=1.0, seed=71):
    """消行音色公共底：噪声白闪 + 和弦 + 低频"""
    n = int(dur * SR)
    flash = highpass(white_noise(n, seed), 2600) * env_exp(n, 0.05, 0.001)
    tone = chord(dur, midis, wave="saw", amp=0.32 * bright, attack=0.003, release=dur * 0.5)
    sub = sine(np.geomspace(90, 55, n), n) * env_exp(n, 0.12, 0.001) * sub_amp
    x = 0.32 * flash + tone + sub
    return x


def sfx_line_clear_1():
    """Single（1 行）：短促白闪 + 单音"""
    x = _clear_base(0.32, [69, 76], sub_amp=0.28, bright=0.9)
    x = reverb(x, size=0.6, mix=0.2)
    return x


def sfx_line_clear_2():
    """Double（2 行）：加厚五度 + 更深冲击"""
    x = _clear_base(0.42, [69, 73, 76], sub_amp=0.45, bright=1.0)
    x = mix(x, bell(0.4, [81], amp=0.14, decay=0.16))
    return reverb(x, size=0.75, mix=0.22)


def sfx_line_clear_3():
    """Triple（3 行）：三和弦 + 更长尾"""
    x = _clear_base(0.52, [64, 69, 73, 76], sub_amp=0.55, bright=1.1)
    x = mix(x, bell(0.55, [81, 85], amp=0.16, decay=0.2))
    return reverb(x, size=0.9, mix=0.25)


def sfx_line_clear_4():
    """Tetris（4 行）：大招——低频下坠 + 完整和弦 + 延迟尾（B2B 主力）"""
    n = int(0.75 * SR)
    x = _clear_base(0.75, [57, 64, 69, 73, 76], sub_amp=0.85, bright=1.25)
    sweep = whoosh(0.5, lo0=200, hi0=900, lo1=4000, hi1=12000, amp=0.22, seed=81)
    place(x, sweep, 0)
    x = mix(x, bell(0.75, [81, 88], amp=0.2, decay=0.3))
    x = delay_fx(x, 0.234, fb=0.3, mix=0.22, taps=3)
    x = reverb(x, size=1.15, mix=0.28, decay=0.66)
    return x[:n]


def sfx_combo_hit():
    """Combo 基准音（n=2–3）：亮色叮声，之后按升调表变速播放"""
    x = bell(0.3, [81, 88], amp=0.34, decay=0.12, partials=(1.0, 2.0, 3.0, 5.02))
    x = mix(x, noise_hit(0.06, 4000, 11000, amp=0.12, decay=0.02, seed=91))
    return reverb(x, size=0.5, mix=0.18)


def sfx_combo_rise(step: int):
    """Combo 逐级升调音（n≥4 起每级再 +2 半音，见文档 §3.4 升调表）"""
    base = 81 + 2 * step
    x = bell(0.34, [base, base + 7], amp=0.36, decay=0.13, partials=(1.0, 2.0, 3.01, 4.98))
    x = mix(x, noise_hit(0.07, 4200, 12000, amp=0.13, decay=0.022, seed=92 + step))
    return reverb(x, size=0.55, mix=0.2)


def sfx_combo_ring():
    """Combo ≥5 全屏色环脉冲伴随音（气浪 + 高频环鸣）"""
    n = int(0.6 * SR)
    ring = sine(np.full(n, 1760.0), n) * env_exp(n, 0.18, 0.004)
    ring += 0.5 * sine(np.full(n, 2637.0), n) * env_exp(n, 0.12, 0.004)
    air = whoosh(0.35, lo0=700, hi0=2600, lo1=2800, hi1=9000, amp=0.3, seed=101)
    buf = np.zeros(n)
    place(buf, 0.3 * ring, 0)
    place(buf, air, 0)
    return reverb(buf, size=0.9, mix=0.28)


def sfx_tspin():
    """T-Spin（Full）：FM 颤音 + 亮和弦（技巧动作专属音色）"""
    n = int(0.45 * SR)
    t = np.arange(n) / SR
    f = 660.0 * (1.0 + 0.012 * np.sin(2 * np.pi * 6.5 * t))
    x = sine(f, n) * env_exp(n, 0.16, 0.002)
    x = mix(x, 0.6 * sine(f * 1.5, n) * env_exp(n, 0.1, 0.002))
    x = mix(x, chord(0.45, [69, 73, 76, 81], wave="triangle", amp=0.3, attack=0.004, release=0.22))
    x = mix(x, noise_hit(0.08, 3000, 9000, amp=0.14, decay=0.03, seed=111))
    return reverb(delay_fx(x, 0.187, fb=0.28, mix=0.2), size=0.8, mix=0.24)


def sfx_tspin_mini():
    """T-Spin Mini：轻量版颤音"""
    n = int(0.25 * SR)
    t = np.arange(n) / SR
    f = 740.0 * (1.0 + 0.01 * np.sin(2 * np.pi * 7.0 * t))
    x = sine(f, n) * env_exp(n, 0.09, 0.002)
    x = mix(x, chord(0.25, [76, 81], wave="triangle", amp=0.22, attack=0.003, release=0.12))
    return reverb(x, size=0.55, mix=0.18)


def sfx_perfect_clear():
    """Perfect Clear 全清：上行琶音 + 钟群 + 宽混响（最高级别正反馈）"""
    seq = [69, 73, 76, 81, 85, 88]
    n_total = int(1.35 * SR)
    buf = np.zeros(n_total + int(0.4 * SR))
    for i, m in enumerate(seq):
        s = bell(0.6, [m], amp=0.30, decay=0.28)
        place(buf, s, int(i * 0.075 * SR))
    place(buf, chord(1.2, [57, 64, 69, 76], wave="saw", amp=0.26, attack=0.01, release=0.8),
          int(0.1 * SR))
    place(buf, noise_hit(0.5, 3500, 12000, amp=0.16, decay=0.18, seed=121), 0)
    buf = delay_fx(buf, 0.234, fb=0.32, mix=0.24, taps=3)
    buf = reverb(buf, size=1.3, mix=0.32, decay=0.7)
    return buf[:n_total]


def sfx_b2b_on():
    """B2B 开启（连续第 2 次有效动作起）：金属环鸣"""
    n = int(0.35 * SR)
    x = sine(np.full(n, 1046.0), n) * env_exp(n, 0.13, 0.002)
    x = mix(x, 0.5 * sine(np.full(n, 1568.0), n) * env_exp(n, 0.09, 0.002))
    x = mix(x, 0.35 * sine(np.full(n, 2093.0), n) * env_exp(n, 0.07, 0.002))
    return reverb(x, size=0.7, mix=0.24)


def sfx_b2b_continue():
    """B2B 延续：更短的环鸣"""
    n = int(0.22 * SR)
    x = sine(np.full(n, 1318.0), n) * env_exp(n, 0.08, 0.002)
    x = mix(x, 0.5 * sine(np.full(n, 1976.0), n) * env_exp(n, 0.055, 0.002))
    return reverb(x, size=0.55, mix=0.2)


# ================================================================ 状态 / 结算
def sfx_level_up():
    """升级：上行四音琶音 + 镲噪声（与 300ms 全屏色彩脉冲同帧触发）"""
    notes = [57, 64, 69, 76]
    n_total = int(0.62 * SR)
    buf = np.zeros(n_total + int(0.3 * SR))
    for i, m in enumerate(notes):
        s = chord(0.3, [m], wave="square", amp=0.22, attack=0.002, release=0.18)
        place(buf, s, int(i * 0.085 * SR))
    place(buf, noise_hit(0.4, 4000, 12000, amp=0.13, decay=0.12, seed=131), int(0.02 * SR))
    place(buf, chord(0.5, [64, 69, 76, 81], wave="saw", amp=0.2, attack=0.01, release=0.3),
          int(0.3 * SR))
    buf = reverb(buf, size=0.9, mix=0.26)
    return buf[:n_total]


def sfx_danger_warn():
    """危险预警进入（堆叠 ≥16 行）：低频压迫音 + 小二度张力音"""
    n = int(0.55 * SR)
    x = sine(np.full(n, 55.0), n) * env_exp(n, 0.22, 0.004)
    x = mix(x, 0.5 * sine(np.full(n, 110.0), n) * env_exp(n, 0.16, 0.004))
    t = np.arange(n) / SR
    x = mix(x, 0.18 * sine(220.0 * (1.0 + 0.004 * np.sin(2 * np.pi * 4.0 * t)), n) * env_exp(n, 0.3, 0.01))
    return reverb(x, size=1.1, mix=0.22)


def sfx_danger_clear():
    """危险解除（回到 12 行以下）：压力释放下行"""
    n = int(0.4 * SR)
    x = sine(np.geomspace(330, 165, n), n) * env_exp(n, 0.16, 0.004)
    x = mix(x, 0.4 * sine(np.geomspace(660, 330, n), n) * env_exp(n, 0.1, 0.004))
    return reverb(x, size=0.8, mix=0.2)


def sfx_new_record():
    """破纪录：金色号角感（大调琶音 + 钟 + 宽尾）。触发瞬间叠加 ≤300ms 全屏特效"""
    seq = [60, 64, 67, 72, 76, 79]
    n_total = int(1.45 * SR)
    buf = np.zeros(n_total + int(0.5 * SR))
    for i, m in enumerate(seq):
        place(buf, bell(0.7, [m], amp=0.3, decay=0.32), int(i * 0.09 * SR))
    place(buf, chord(1.2, [60, 67, 72, 76], wave="saw", amp=0.24, attack=0.012, release=0.75),
          int(0.12 * SR))
    place(buf, noise_hit(0.35, 3000, 11000, amp=0.15, decay=0.13, seed=141), 0)
    place(buf, impact(0.35, f0=120, f1=58, amp=0.5), 0)
    buf = delay_fx(buf, 0.25, fb=0.3, mix=0.22, taps=3)
    buf = reverb(buf, size=1.35, mix=0.34, decay=0.72)
    return buf[:n_total]


def sfx_game_over():
    """失败结算（Top Out / Lock Out）：下行小调 + 低频坠落（鼓励式 UI，不刺耳）"""
    seq = [69, 65, 62, 57]
    n_total = int(1.25 * SR)
    buf = np.zeros(n_total + int(0.5 * SR))
    for i, m in enumerate(seq):
        place(buf, chord(0.5, [m, m + 3] if i % 2 else [m], wave="triangle", amp=0.26,
                         attack=0.004, release=0.35), int(i * 0.16 * SR))
    n = int(0.9 * SR)
    place(buf, sine(np.geomspace(110, 42, n), n) * env_exp(n, 0.35, 0.004) * 0.5, int(0.1 * SR))
    buf = reverb(buf, size=1.15, mix=0.3, decay=0.68)
    return buf[:n_total]


def sfx_sprint_finish():
    """Sprint 完赛（40 行达成）：完赛钟 + 上行和弦"""
    n_total = int(0.9 * SR)
    buf = np.zeros(n_total + int(0.4 * SR))
    place(buf, bell(0.8, [69, 76], amp=0.32, decay=0.34), 0)
    place(buf, chord(0.7, [57, 64, 69, 73], wave="saw", amp=0.22, attack=0.01, release=0.5),
          int(0.12 * SR))
    buf = reverb(buf, size=1.1, mix=0.3)
    return buf[:n_total]


def sfx_ultra_end():
    """Ultra 时间归零：终止钟（与 game_over 区分：更中性、明亮）"""
    n_total = int(0.8 * SR)
    buf = np.zeros(n_total + int(0.3 * SR))
    place(buf, bell(0.7, [64, 71], amp=0.3, decay=0.3), 0)
    place(buf, noise_hit(0.25, 2500, 9000, amp=0.12, decay=0.1, seed=151), 0)
    buf = reverb(buf, size=1.0, mix=0.28)
    return buf[:n_total]


def sfx_unlock():
    """解锁（皮肤/音乐/称号）：闪烁钟声"""
    seq = [72, 76, 79, 84]
    n_total = int(0.8 * SR)
    buf = np.zeros(n_total + int(0.4 * SR))
    for i, m in enumerate(seq):
        place(buf, bell(0.55, [m], amp=0.26, decay=0.24), int(i * 0.1 * SR))
    buf = reverb(buf, size=1.0, mix=0.3)
    return buf[:n_total]


def sfx_ui_result_tick():
    """结算页数字滚动 tick（计分板逐位滚动时轻微哒哒声）"""
    x = noise_hit(0.018, 2200, 7500, amp=0.08, decay=0.007, seed=161)
    return x


# ================================================================ 清单（名称 → 合成函数）
SFX_TABLE = [
    # (输出名, 合成函数, 用途简述, 峰值目标)
    ("ui-hover",            sfx_ui_hover,            "菜单悬停", 0.25),
    ("ui-move",             sfx_ui_move,             "菜单光标移动", 0.35),
    ("ui-confirm",          sfx_ui_confirm,          "确认/开始/点按主按钮", 0.55),
    ("ui-cancel",           sfx_ui_cancel,           "取消/返回", 0.5),
    ("ui-error",            sfx_ui_error,            "非法操作/防误触锁定期按键", 0.45),
    ("ui-count-beep",       sfx_ui_count_beep,       "恢复倒计时 3/2/1", 0.55),
    ("ui-count-go",         sfx_ui_count_go,         "倒计时结束解冻", 0.6),
    ("ui-pause-in",         sfx_ui_pause_in,         "暂停（时间静止）", 0.5),
    ("ui-pause-out",        sfx_ui_pause_out,        "恢复游戏", 0.5),
    ("ui-result-tick",      sfx_ui_result_tick,      "结算数字滚动", 0.2),
    ("piece-move",          sfx_piece_move,          "左右移动", 0.3),
    ("piece-rotate",        sfx_piece_rotate,        "旋转 90°", 0.45),
    ("piece-rotate-180",    sfx_piece_rotate_180,    "旋转 180°", 0.45),
    ("piece-rotate-fail",   sfx_piece_rotate_fail,   "移动/旋转被挡", 0.25),
    ("piece-softdrop-tick", sfx_piece_softdrop_tick, "软降逐格", 0.15),
    ("piece-hard-drop",     sfx_piece_hard_drop,     "硬降（踩拍吸附对象）", 0.85),
    ("piece-lock",          sfx_piece_lock,          "锁定（非硬降）", 0.5),
    ("piece-spawn",         sfx_piece_spawn,         "出块闪烁（默认近静音）", 0.12),
    ("hold-swap",           sfx_hold_swap,           "Hold 换入/换出", 0.45),
    ("line-clear-1",        sfx_line_clear_1,        "消 1 行 Single", 0.62),
    ("line-clear-2",        sfx_line_clear_2,        "消 2 行 Double", 0.7),
    ("line-clear-3",        sfx_line_clear_3,        "消 3 行 Triple", 0.78),
    ("line-clear-4",        sfx_line_clear_4,        "消 4 行 Tetris", 0.88),
    ("combo-hit",           sfx_combo_hit,           "Combo 2–3 连击音", 0.55),
    ("combo-rise-1",        lambda: sfx_combo_rise(1), "Combo 4 升调 1", 0.58),
    ("combo-rise-2",        lambda: sfx_combo_rise(2), "Combo 5 升调 2", 0.6),
    ("combo-rise-3",        lambda: sfx_combo_rise(3), "Combo 6 升调 3", 0.62),
    ("combo-rise-4",        lambda: sfx_combo_rise(4), "Combo 7+ 升调 4（其后 playbackRate 续升）", 0.64),
    ("combo-ring",          sfx_combo_ring,          "Combo ≥5 全屏色环脉冲伴随音", 0.6),
    ("tspin",               sfx_tspin,               "T-Spin（Full）", 0.6),
    ("tspin-mini",          sfx_tspin_mini,          "T-Spin Mini", 0.5),
    ("perfect-clear",       sfx_perfect_clear,       "Perfect Clear 全清", 0.85),
    ("b2b-on",              sfx_b2b_on,              "B2B 开启", 0.5),
    ("b2b-continue",        sfx_b2b_continue,        "B2B 延续", 0.5),
    ("level-up",            sfx_level_up,            "升级（同步 300ms 色彩脉冲）", 0.65),
    ("danger-warn",         sfx_danger_warn,         "危险预警进入（≥16 行）", 0.55),
    ("danger-clear",        sfx_danger_clear,        "危险解除（<12 行）", 0.45),
    ("new-record",          sfx_new_record,          "破纪录", 0.85),
    ("game-over",           sfx_game_over,           "失败结算 Top Out / Lock Out", 0.7),
    ("sprint-finish",       sfx_sprint_finish,       "Sprint 完赛（40 行）", 0.7),
    ("ultra-end",           sfx_ultra_end,           "Ultra 时间归零", 0.65),
    ("unlock",              sfx_unlock,              "解锁皮肤/音乐/称号", 0.65),
]


def main():
    os.makedirs(OUT, exist_ok=True)
    meta = []
    for name, fn, use, peak in SFX_TABLE:
        x = fn()
        x = softclip(x, 1.05)          # 轻饱和防爆
        x = norm(x, peak)
        path = os.path.join(OUT, f"{name}.wav")
        write_wav(path, x)
        meta.append({
            "file": f"audio/sfx/{name}.wav",
            "use": use,
            "duration_ms": int(round(x.shape[0] / SR * 1000)),
            "channels": 1,
            "sample_rate": SR,
            "bit": 16,
            "peak": round(peak_of(x), 3),
            "loop": False,
            "status": "generated",
        })
        print(f"[SFX] {name:<20s} {meta[-1]['duration_ms']:>5d} ms  peak={meta[-1]['peak']}")
    with open(os.path.join(OUT, "_sfx_meta.json"), "w", encoding="utf-8") as f:
        json.dump(meta, f, ensure_ascii=False, indent=2)
    print(f"\n共生成 {len(meta)} 个音效 → {os.path.abspath(OUT)}")


if __name__ == "__main__":
    main()
