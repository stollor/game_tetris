# -*- coding: utf-8 -*-
"""
NEON PULSE · 04-audio-fx — 音乐合成脚本（BGM / 分层 stems / 状态层）
====================================================================
风格：现代霓虹街机 × 合成器浪潮（Synthwave / Arcade Pulse）——
深沉低音 + 16 分琶音 + 干净鼓组，情绪：爽快、上瘾、逐级燃。

技术口径（对应 01-framework/framework.md §7.6）：
- 主曲基准 BPM = 128（= BPM(1 级)），8 小节 = 15.000s 无缝循环；
  引擎按 BPM(等级)/128 变速播放（playbackRate / time-stretch），19 级 = 1.5625×。
- 分层 stems：引擎按等级段做增减（1–5 主歌层 / 6–10 加副歌层 / 11+ 加高速层），
  避免单纯变速带来的音色劣化。
- 所有循环用 loopify() 把尾巴折回开头，保证循环点零爆音。

运行：python gen_music.py   （输出 audio/music/*.wav + _music_meta.json）
"""

import json
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from synthlib import (SR, bandpass, delay_fx, env_adsr, env_ar, env_exp, highpass,
                      loopify, lowpass, midi_to_freq, norm, peak_of, place, reverb,
                      rms_of, saw, sine, softclip, square, white_noise, write_wav)

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "audio", "music")


# ================================================================ 立体声工具
def mix(a: np.ndarray, b: np.ndarray) -> np.ndarray:
    n = max(a.shape[0], b.shape[0])
    out = np.zeros(n)
    out[: a.shape[0]] += a
    out[: b.shape[0]] += b
    return out


def place_st(buf: np.ndarray, sound: np.ndarray, at: int, pan: float = 0.0, gain: float = 1.0) -> None:
    """把单声道 sound 以等功率声像 pan∈[-1,1] 叠加进立体声 buf (n,2)"""
    ang = (pan + 1.0) * np.pi / 4.0
    gl, gr = np.cos(ang), np.sin(ang)
    end = min(at + sound.shape[0], buf.shape[0])
    if end > at >= 0:
        buf[at:end, 0] += gain * gl * sound[: end - at]
        buf[at:end, 1] += gain * gr * sound[: end - at]


def loopify_st(x: np.ndarray, loop_n: int, tail_n: int) -> np.ndarray:
    """立体声版无缝循环收尾"""
    out = np.zeros((loop_n, 2))
    for c in range(2):
        out[:, c] = loopify(x[:, c], loop_n, tail_n)
    return out


# ================================================================ 音色
def kick(amp: float = 1.0) -> np.ndarray:
    """底鼓：滑落正弦 + 咔嗒瞬态"""
    dur = 0.5
    n = int(dur * SR)
    n0 = int(0.055 * SR)
    f = np.concatenate([np.geomspace(120.0, 45.0, n0), np.full(n - n0, 45.0)])
    x = sine(f, n) * env_exp(n, 0.26, 0.001)
    x = mix(x, 0.55 * highpass(white_noise(n, 1), 1500) * env_exp(n, 0.006, 0.0003))
    return amp * softclip(x * 1.25)


def snare(amp: float = 1.0) -> np.ndarray:
    """军鼓：噪声 + 190Hz 音体"""
    dur = 0.3
    n = int(dur * SR)
    body = bandpass(white_noise(n, 2), 900, 8500) * env_exp(n, 0.115, 0.001)
    tone = (sine(np.full(n, 190.0), n) + 0.6 * sine(np.full(n, 285.0), n)) * env_exp(n, 0.07, 0.001)
    return amp * (0.75 * body + 0.35 * tone)


def hat(open_: bool = False, amp: float = 1.0) -> np.ndarray:
    """闭镲 / 开镲"""
    dur = 0.22 if open_ else 0.06
    n = int(dur * SR)
    x = highpass(white_noise(n, 3 if not open_ else 4), 7200) * env_exp(n, 0.16 if open_ else 0.028, 0.0006)
    return amp * x


def clap(amp: float = 1.0) -> np.ndarray:
    """拍手：3 次短噪声错位 + 轻体"""
    out = np.zeros(int(0.24 * SR))
    for i, g in enumerate([0.6, 0.85, 1.0]):
        seg = bandpass(white_noise(int(0.09 * SR), 5 + i), 1100, 6200) * env_exp(int(0.09 * SR), 0.022, 0.0008)
        place(out, g * seg, int(i * 0.008 * SR))
    return amp * out


def tom(freq: float, amp: float = 1.0) -> np.ndarray:
    """加花通鼓"""
    dur = 0.26
    n = int(dur * SR)
    f = np.concatenate([np.geomspace(freq * 1.6, freq, int(0.05 * SR)), np.full(n - int(0.05 * SR), freq)])
    return amp * sine(f, n) * env_exp(n, 0.1, 0.001)


def bass_note(freq: float, dur: float, amp: float = 1.0) -> np.ndarray:
    """贝斯：锯齿 + 低频正弦，低通 320Hz，拨弦包络"""
    n = int(dur * SR)
    x = 0.75 * saw(freq, n) + 0.6 * sine(np.full(n, freq / 2.0), n)
    x = lowpass(x, 320.0, order=2)
    e = env_adsr(n, 0.004, 0.09, 0.55, min(0.08, dur * 0.35))
    return amp * x * e


def pluck(freq: float, dur: float, amp: float = 1.0) -> np.ndarray:
    """琶音拨弦：方波（占空比 0.35）+ 快衰减"""
    n = int(dur * SR)
    x = square(freq, n, 0.35)
    x = lowpass(x, 2600.0)
    return amp * x * env_exp(n, max(0.05, dur * 0.75), 0.002)


def pad_note(freq: float, dur: float, amp: float = 1.0, detune_cents: float = 8.0) -> np.ndarray:
    """铺底：双失谐锯齿 + 低通 + 慢起音"""
    n = int(dur * SR)
    f_hi = freq * 2 ** (detune_cents / 1200.0)
    f_lo = freq * 2 ** (-detune_cents / 1200.0)
    x = 0.5 * saw(f_hi, n) + 0.5 * saw(f_lo, n) + 0.35 * sine(np.full(n, freq), n)
    x = lowpass(x, 950.0)
    e = env_adsr(n, min(0.45, dur * 0.35), 0.25, 0.75, min(0.7, dur * 0.4))
    return amp * x * e


def lead_note(freq: float, dur: float, amp: float = 1.0) -> np.ndarray:
    """主旋律：方波 + 150ms 后起颤音"""
    n = int(dur * SR)
    t = np.arange(n) / SR
    vib = 1.0 + 0.006 * np.sin(2 * np.pi * 5.4 * np.maximum(t - 0.12, 0.0))
    f = freq * np.where(t > 0.12, vib, 1.0)
    x = 0.6 * square(f, n, 0.42) + 0.4 * saw(f * 2.0, n) * 0.35
    x = lowpass(x, 3400.0)
    e = env_adsr(n, 0.012, 0.12, 0.7, min(0.12, dur * 0.35))
    return amp * x * e


# ================================================================ 和声进行
CHORDS = {
    "Am": dict(root=45, triad=[57, 60, 64], arp=[57, 60, 64, 69]),
    "F":  dict(root=41, triad=[53, 57, 60], arp=[53, 57, 60, 65]),
    "G":  dict(root=43, triad=[55, 59, 62], arp=[55, 59, 62, 67]),
    "C":  dict(root=48, triad=[60, 64, 67], arp=[60, 64, 67, 72]),
    "E":  dict(root=40, triad=[52, 56, 59], arp=[52, 56, 59, 64]),
    "Dm": dict(root=38, triad=[50, 53, 57], arp=[50, 53, 57, 62]),
    "Bb": dict(root=46, triad=[58, 62, 65], arp=[58, 62, 65, 70]),
    "A":  dict(root=45, triad=[57, 61, 64], arp=[57, 61, 64, 69]),
}

MAIN_PROG = ["Am", "Am", "F", "G", "C", "G", "F", "E"]          # 主曲（A 小调）
ALT_A_PROG = ["Dm", "Dm", "Bb", "F", "Dm", "Bb", "C", "A"]      # 解锁曲 A《NEON RAIN》
ALT_B_PROG = ["Am", "Bb", "Am", "G", "Am", "Bb", "C", "E"]      # 解锁曲 B《ECLIPSE》

# 主旋律（每条 = (小节内拍位, MIDI, 持续拍)），A 自然小调
MAIN_LEAD = {
    0: [(0, 76, 1), (1, 74, 0.5), (1.5, 72, 0.5), (2, 69, 2)],
    1: [(0, 72, 0.5), (0.5, 74, 0.5), (1, 76, 1), (2, 79, 2)],
    2: [(0, 77, 1), (1, 76, 1), (2, 72, 2)],
    3: [(0, 74, 0.5), (0.5, 76, 0.5), (1, 74, 1), (2, 71, 2)],
    4: [(0, 72, 1), (1, 76, 1), (2, 79, 2)],
    5: [(0, 78, 1), (1, 74, 1), (2, 71, 2)],
    6: [(0, 72, 0.5), (0.5, 74, 0.5), (1, 77, 1.5), (2.5, 76, 0.5), (3, 74, 1)],
    7: [(0, 71, 1), (1, 68, 1), (2, 64, 2)],
}
ALT_A_LEAD = {
    0: [(0, 74, 1), (1, 77, 1), (2, 81, 2)],
    1: [(0, 79, 0.5), (0.5, 77, 0.5), (1, 74, 1), (2, 72, 2)],
    2: [(0, 70, 1), (1, 74, 1), (2, 77, 2)],
    3: [(0, 76, 1), (1, 72, 1), (2, 69, 2)],
    4: [(0, 74, 0.5), (0.5, 76, 0.5), (1, 77, 1), (2, 81, 2)],
    5: [(0, 82, 1), (1, 77, 1), (2, 74, 2)],
    6: [(0, 76, 1), (1, 79, 1), (2, 76, 2)],
    7: [(0, 73, 1), (1, 69, 1), (2, 65, 2)],
}
ALT_B_LEAD = {
    0: [(0, 69, 1), (1, 70, 0.5), (1.5, 69, 0.5), (2, 65, 2)],
    1: [(0, 70, 1), (1, 74, 1), (2, 77, 2)],
    2: [(0, 72, 0.5), (0.5, 70, 0.5), (1, 69, 1), (2, 64, 2)],
    3: [(0, 67, 1), (1, 71, 1), (2, 74, 2)],
    4: [(0, 69, 1), (1, 72, 1), (2, 76, 2)],
    5: [(0, 77, 1), (1, 74, 0.5), (1.5, 70, 0.5), (2, 65, 2)],
    6: [(0, 76, 1), (1, 72, 1), (2, 76, 2)],
    7: [(0, 71, 1), (1, 68, 1), (2, 64, 2)],
}


# ================================================================ 编曲器
def render_track(bpm: float, bars: int, prog: list, lead: dict = None,
                 stems: str = "all", seed_base: int = 0):
    """
    渲染一首曲子的分层 stems（立体声 float (n+tail, 2)）。
    stems: "all" 返回 dict{stem: buffer}；仅按 prog 编排。
    """
    beat = 60.0 / bpm
    bar_len = 4 * beat
    loop_n = int(round(bars * bar_len * SR))
    tail_n = int(2.0 * SR)
    total = loop_n + tail_n

    names = ["kick", "snare", "hat", "perc", "bass", "arp", "pad", "lead"]
    buf = {k: np.zeros((total, 2)) for k in names}

    # ---- 鼓组 ----
    for b in range(bars * 4):                      # 每拍
        at = int(round(b * beat * SR))
        accent = [1.0, 0.82, 0.95, 0.78][b % 4]
        place_st(buf["kick"], kick(0.9 * accent), at, 0.0)
    for bar in range(bars):
        for beat_idx in (1, 3):                    # 2/4 拍军鼓 + 拍手
            at = int(round((bar * 4 + beat_idx) * beat * SR))
            place_st(buf["snare"], snare(0.7), at, -0.05)
            place_st(buf["perc"], clap(0.55), at, 0.12)
        for e8 in range(8):                        # 8 分闭镲
            at = int(round((bar * 4 + e8 * 0.5) * beat * SR))
            amp = 0.34 if e8 % 2 == 0 else 0.2
            place_st(buf["hat"], hat(False, amp), at, 0.22)
        if bar % 4 == 3:                           # 每 4 小节末开镲
            at = int(round((bar * 4 + 3.5) * beat * SR))
            place_st(buf["hat"], hat(True, 0.3), at, 0.22)
        for s16 in range(16):                      # 16 分沙锤（高速层）
            at = int(round((bar * 4 + s16 * 0.25) * beat * SR))
            if s16 % 2 == 1:
                place_st(buf["perc"], hat(False, 0.12), at, -0.25)
    # 第 8 小节通鼓加花（鼓组推进感）
    at = int(round((bars - 1) * 4 * beat * SR))
    place_st(buf["perc"], tom(180, 0.5), at + int(2.6 * beat * SR), -0.3)
    place_st(buf["perc"], tom(140, 0.55), at + int(3.1 * beat * SR), 0.3)
    place_st(buf["perc"], tom(110, 0.6), at + int(3.6 * beat * SR), 0.0)

    # ---- 贝斯：8 分律动（根音 + 八度跳）----
    bass_pat = [0, 0, 12, 0, 0, 12, 0, 12]
    for bar in range(bars):
        root = CHORDS[prog[bar]]["root"]
        for i, off in enumerate(bass_pat):
            at = int(round((bar * 4 + i * 0.5) * beat * SR))
            dur = 0.5 * beat * 0.92
            f = midi_to_freq(root + off)
            place_st(buf["bass"], bass_note(f, dur, 0.55), at, 0.0)

    # ---- 琶音：16 分 ----
    arp_idx = [0, 1, 2, 3, 2, 1, 0, 1, 2, 3, 2, 1, 0, 1, 2, 3]
    for bar in range(bars):
        tones = CHORDS[prog[bar]]["arp"]
        for i, ti in enumerate(arp_idx):
            at = int(round((bar * 4 + i * 0.25) * beat * SR))
            f = midi_to_freq(tones[ti] + 12)       # 琶音上移一个八度，亮而干净
            place_st(buf["arp"], pluck(f, 0.25 * beat, 0.3), at, -0.3)

    # ---- 铺底：整小节和弦（左右各一路失谐）----
    for bar in range(bars):
        triad = CHORDS[prog[bar]]["triad"]
        at = int(round(bar * 4 * beat * SR))
        dur = 4 * beat * 1.12                      # 略超一小节，衔接无缝
        for m in triad:
            f = midi_to_freq(m)
            place_st(buf["pad"], pad_note(f, dur, 0.2, +8.0), at, -0.55)
            place_st(buf["pad"], pad_note(f, dur, 0.2, -8.0), at, 0.55)

    # ---- 主旋律 ----
    if lead:
        for bar, notes in lead.items():
            for (pos, m, dur_beats) in notes:
                at = int(round((bar * 4 + pos) * beat * SR))
                f = midi_to_freq(m)
                place_st(buf["lead"], lead_note(f, dur_beats * beat * 0.95, 0.32), at, 0.05)

    # ---- 各 stem 循环收尾 + 空间效果（效果放在 loopify 前，尾音一起折回）----
    fx = {
        "kick": (0.0, 0.0), "snare": (0.35, 0.22), "hat": (0.25, 0.12),
        "perc": (0.3, 0.16), "bass": (0.0, 0.0), "arp": (0.234, 0.24),
        "pad": (0.45, 0.3), "lead": (0.234, 0.26),
    }
    out = {}
    for k in names:
        x = buf[k]
        dly, rv = fx[k]
        y = np.zeros_like(x)
        for c in range(2):
            ch = x[:, c]
            if dly > 0:
                ch = delay_fx(ch, dly, fb=0.3, mix=0.22, taps=3)
            if rv > 0:
                ch = reverb(ch, size=1.0, mix=rv, decay=0.6)
            y[:, c] = ch
        out[k] = loopify_st(y, loop_n, tail_n)
    return out, loop_n


def mix_stems(stems: dict, gains: dict, loop_n: int):
    """
    按增益合并 stems 并归一化，返回 (全量混音, {stem: 预缩放后的 stem})。
    预缩放契约：**以增益 1.0 直接求和各 stem = 全量混音（逐样本相等，峰值 0.88）**；
    引擎按等级段做加减/交叉淡化时不需要再乘 stem 增益，
    整体音量只走 BGM 总线 —— 避免多 stem 求和削波。
    """
    raw = {}
    acc = np.zeros((loop_n, 2))
    for k, g in gains.items():
        if g > 0:
            raw[k] = g * stems[k][:loop_n]
            acc += raw[k]
    peak = np.max(np.abs(acc))
    scale = (0.88 / peak) if peak > 1e-9 else 1.0
    full = acc * scale
    return full, {k: v * scale for k, v in raw.items()}


# ================================================================ 各曲目
def gen_main():
    """主曲《NEON PULSE》：8 小节 @128BPM（= BPM(1 级)），分层 stems + 全量预览"""
    stems, loop_n = render_track(128.0, 8, MAIN_PROG, MAIN_LEAD)
    stem_gain = {
        "kick": 0.9, "snare": 0.8, "hat": 0.55, "perc": 0.5,
        "bass": 0.85, "arp": 0.62, "pad": 0.6, "lead": 0.72,
    }
    meta = []
    full, scaled = mix_stems(stems, stem_gain, loop_n)
    for k, x in scaled.items():
        write_wav(os.path.join(OUT, f"bgm_main_stem_{k}.wav"), x)
        meta.append((f"bgm_main_stem_{k}.wav", k))
        print(f"[MUSIC] stem-{k:<6s} {loop_n / SR:.3f}s  rms={rms_of(x):.4f}")
    write_wav(os.path.join(OUT, "bgm_main_full_preview.wav"), full)
    print(f"[MUSIC] full-preview  {loop_n / SR:.3f}s  rms={rms_of(full):.4f}")

    # ---- 等级分层预览混音（对应 §6.1 三段节奏：1–5 主歌 / 6–10 副歌 / 11+ 高速）----
    # 因 stems 已按“增益 1.0 求和 = 全量”预缩放，这里只做 stem 增减即可
    layers = {
        "bgm_main_layer_verse.wav":   {"kick": 0.55, "hat": 0.5, "bass": 0.9, "pad": 1.0},
        "bgm_main_layer_chorus.wav":  {"kick": 0.9, "snare": 0.85, "hat": 0.55, "bass": 0.85,
                                       "pad": 0.85, "arp": 0.62, "lead": 0.72},
        "bgm_main_layer_high.wav":    {"kick": 0.95, "snare": 0.9, "hat": 0.6, "bass": 0.85,
                                       "pad": 0.8, "arp": 0.7, "lead": 0.75, "perc": 0.55},
    }
    for fname, lg in layers.items():
        acc = np.zeros((loop_n, 2))
        for k, g in lg.items():
            acc += g * scaled[k]
        pk = np.max(np.abs(acc))          # 预览混音同样不超过 0.88 峰值
        if pk > 0.88:
            acc *= 0.88 / pk
        write_wav(os.path.join(OUT, fname), acc)
        print(f"[MUSIC] {fname[10:-4]:<18s} {loop_n / SR:.3f}s  rms={rms_of(acc):.4f}")
    return meta


def gen_heartbeat():
    """危险心跳层：2 小节 @128BPM，低频 lub-dub + 音地板（堆叠 ≥16 行时叠加）"""
    beat = 60.0 / 128.0
    loop_n = int(round(2 * 4 * beat * SR))
    tail_n = int(1.0 * SR)
    buf = np.zeros((loop_n + tail_n, 2))
    for b in range(8):
        at = int(round(b * beat * SR))
        n = int(0.42 * SR)
        f = np.concatenate([np.geomspace(75, 48, int(0.08 * SR)), np.full(n - int(0.08 * SR), 48.0)])
        lub = sine(f, n) * env_exp(n, 0.16, 0.004)
        dub = sine(f * 1.12, n) * env_exp(n, 0.12, 0.004)
        place_st(buf, 0.55 * lub, at, 0.0)
        place_st(buf, 0.38 * dub, at + int(0.13 * beat * SR * 2), 0.0)
    # 极低音地板
    n = buf.shape[0]
    drone = 0.12 * sine(np.full(n, 36.7), n) * env_ar(n, 0.6, 0.6)
    buf[:, 0] += drone
    buf[:, 1] += drone
    out = loopify_st(buf, loop_n, tail_n)
    out = norm(out, 0.5)
    write_wav(os.path.join(OUT, "bgm_layer_heartbeat.wav"), out)
    print(f"[MUSIC] heartbeat     {loop_n / SR:.3f}s")


def gen_menu():
    """主菜单 / 结算背景《SIGNAL CITY》：100BPM 8 小节舒缓循环（pad + arp + 轻鼓）"""
    stems, loop_n = render_track(100.0, 8, ["Am", "F", "C", "G", "Am", "F", "E", "Am"], None)
    # 菜单不需要主音与重鼓：只取 pad/arp/bass + 弱 kick/hat
    x, _ = mix_stems(stems, {"kick": 0.35, "snare": 0.0, "hat": 0.3, "perc": 0.0,
                             "bass": 0.55, "arp": 0.55, "pad": 0.85, "lead": 0.0}, loop_n)
    write_wav(os.path.join(OUT, "bgm_menu.wav"), x)
    print(f"[MUSIC] menu          {loop_n / SR:.3f}s")


def gen_result():
    """结算页《LAST LIGHT》：90BPM 4 小节，pad + 钟琴琶音，无鼓（情绪：回味/鼓励）"""
    beat = 60.0 / 90.0
    loop_n = int(round(4 * 4 * beat * SR))
    tail_n = int(1.6 * SR)
    buf = np.zeros((loop_n + tail_n, 2))
    prog = ["Am", "F", "C", "E"]
    for bar, name in enumerate(prog):
        at = int(round(bar * 4 * beat * SR))
        for m in CHORDS[name]["triad"]:
            f = midi_to_freq(m)
            place_st(buf, pad_note(f, 4 * beat * 1.15, 0.24, 8.0), at, -0.5)
            place_st(buf, pad_note(f, 4 * beat * 1.15, 0.24, -8.0), at, 0.5)
        for i, ti in enumerate([0, 2, 1, 3]):
            f = midi_to_freq(CHORDS[name]["arp"][ti] + 12)
            n = int(0.9 * SR)
            tone = sine(np.full(n, f), n) * env_exp(n, 0.3, 0.002)
            tone += 0.5 * sine(np.full(n, f * 2.01), n) * env_exp(n, 0.18, 0.002)
            place_st(buf, 0.16 * tone, at + int(i * beat * SR), -0.3 + 0.2 * i)
    y = np.zeros_like(buf)
    for c in range(2):
        y[:, c] = reverb(buf[:, c], size=1.35, mix=0.34, decay=0.7)
    out = loopify_st(y, loop_n, tail_n)
    out = norm(out, 0.72)
    write_wav(os.path.join(OUT, "bgm_result.wav"), out)
    print(f"[MUSIC] result        {loop_n / SR:.3f}s")


def gen_alt():
    """解锁曲 ×2（每日挑战 3 次 / 10 次解锁）：全编排循环"""
    specs = [
        ("bgm_alt_neon_rain.wav", ALT_A_PROG, ALT_A_LEAD, "NEON RAIN"),
        ("bgm_alt_eclipse.wav", ALT_B_PROG, ALT_B_LEAD, "ECLIPSE"),
    ]
    for fname, prog, lead, title in specs:
        stems, loop_n = render_track(128.0, 8, prog, lead, seed_base=1)
        x, _ = mix_stems(stems, {"kick": 0.9, "snare": 0.8, "hat": 0.55, "perc": 0.5,
                                 "bass": 0.85, "arp": 0.62, "pad": 0.62, "lead": 0.72}, loop_n)
        write_wav(os.path.join(OUT, fname), x)
        print(f"[MUSIC] {title:<12s} {loop_n / SR:.3f}s")

def main():
    os.makedirs(OUT, exist_ok=True)
    gen_main()
    gen_heartbeat()
    gen_menu()
    gen_result()
    gen_alt()

    meta = []
    import wave as _wave
    for f in sorted(os.listdir(OUT)):
        if not f.endswith(".wav"):
            continue
        with _wave.open(os.path.join(OUT, f)) as w:
            n, sr, ch = w.getnframes(), w.getframerate(), w.getnchannels()
        meta.append({
            "file": f"audio/music/{f}",
            "duration_s": round(n / sr, 3),
            "sample_rate": sr,
            "channels": ch,
            "bit": 16,
            "loop": True,
            "status": "generated",
        })
    with open(os.path.join(OUT, "_music_meta.json"), "w", encoding="utf-8") as fh:
        json.dump(meta, fh, ensure_ascii=False, indent=2)
    print(f"\n共生成 {len(meta)} 个音乐文件 → {os.path.abspath(OUT)}")


if __name__ == "__main__":
    main()
