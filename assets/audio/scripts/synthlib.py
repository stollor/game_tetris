# -*- coding: utf-8 -*-
"""
NEON PULSE · 04-audio-fx 音频合成基础库
=====================================
纯 numpy 实现的减法/加法合成器工具箱（不依赖 scipy）：
波形、包络、FFT 频域滤波、Schroeder 混响、延迟、饱和、循环收尾、WAV 写出。

约定：
- 采样率 SR = 44100 Hz，单声道 float64 缓冲（值域约 -1..1），写出时转 int16。
- 音乐循环素材用 loopify() 把尾巴折叠回开头，保证无缝循环（BGM 变速播放也不爆音）。
"""

import os
import wave

import numpy as np

SR = 44100


# ---------------------------------------------------------------- 基础工具
def _t(n: int) -> np.ndarray:
    """长度 n 的时间轴（秒）"""
    return np.arange(n, dtype=np.float64) / SR


def midi_to_freq(m: float) -> float:
    """MIDI 音高 → 频率（A4=69=440Hz）"""
    return 440.0 * (2.0 ** ((m - 69) / 12.0))


def db(x_db: float) -> float:
    """分贝 → 线性增益"""
    return 10.0 ** (x_db / 20.0)


# ---------------------------------------------------------------- 波形
def sine(freq, n: int, phase: float = 0.0) -> np.ndarray:
    """正弦波；freq 可为标量或长度 n 的频率数组（用于滑音）"""
    if np.isscalar(freq):
        ph = 2 * np.pi * freq * _t(n) + phase
    else:
        freq_arr = np.asarray(freq, dtype=np.float64)
        assert freq_arr.shape[0] == n
        ph = 2 * np.pi * np.cumsum(freq_arr) / SR + phase
    return np.sin(ph)


def saw(freq, n: int, phase: float = 0.0) -> np.ndarray:
    """锯齿波（朴素实现；后续统一过低通抑制混叠）"""
    if np.isscalar(freq):
        ph = (freq * _t(n) + phase / (2 * np.pi)) % 1.0
    else:
        freq_arr = np.asarray(freq, dtype=np.float64)
        ph = (np.cumsum(freq_arr) / SR + phase / (2 * np.pi)) % 1.0
    return 2.0 * ph - 1.0


def square(freq, n: int, duty: float = 0.5, phase: float = 0.0) -> np.ndarray:
    """方波（占空比可调）"""
    if np.isscalar(freq):
        ph = (freq * _t(n) + phase / (2 * np.pi)) % 1.0
    else:
        freq_arr = np.asarray(freq, dtype=np.float64)
        ph = (np.cumsum(freq_arr) / SR + phase / (2 * np.pi)) % 1.0
    return np.where(ph < duty, 1.0, -1.0)


def triangle(freq, n: int, phase: float = 0.0) -> np.ndarray:
    """三角波"""
    if np.isscalar(freq):
        ph = (freq * _t(n) + phase / (2 * np.pi)) % 1.0
    else:
        freq_arr = np.asarray(freq, dtype=np.float64)
        ph = (np.cumsum(freq_arr) / SR + phase / (2 * np.pi)) % 1.0
    return 4.0 * np.abs(ph - 0.5) - 1.0


def white_noise(n: int, seed: int = None) -> np.ndarray:
    """白噪声"""
    rng = np.random.default_rng(seed)
    return rng.standard_normal(n)


# ---------------------------------------------------------------- 包络
def env_exp(n: int, decay: float, attack: float = 0.002) -> np.ndarray:
    """指数衰减包络（打击类音色主力）"""
    e = np.exp(-_t(n) / max(decay, 1e-4))
    a = max(1, int(attack * SR))
    if a < n:
        e[:a] *= np.linspace(0.0, 1.0, a)
    return e


def env_ar(n: int, attack: float, release: float) -> np.ndarray:
    """线性起音 + 线性释音（起音后保持满值）"""
    a = max(1, int(attack * SR))
    r = max(1, int(release * SR))
    e = np.ones(n)
    a = min(a, n)
    e[:a] = np.linspace(0.0, 1.0, a)
    r = min(r, n - a) if n - a > 0 else 0
    if r > 0:
        e[n - r:] *= np.linspace(1.0, 0.0, r)
    return e


def env_adsr(n: int, a: float, d: float, s: float, r: float) -> np.ndarray:
    """标准 ADSR（总长 n 秒对应的采样数）"""
    total = n
    na = max(1, int(a * SR))
    nd = max(1, int(d * SR))
    nr = max(1, int(r * SR))
    ns = max(0, total - na - nd - nr)
    parts = [
        np.linspace(0.0, 1.0, na),
        np.linspace(1.0, s, nd),
        np.full(ns, s),
        np.linspace(s, 0.0, nr),
    ]
    e = np.concatenate(parts)
    if e.shape[0] < total:
        e = np.concatenate([e, np.zeros(total - e.shape[0])])
    return e[:total]


# ---------------------------------------------------------------- 滤波（FFT 频域，零相位）
def lowpass(x: np.ndarray, cutoff: float, order: int = 2) -> np.ndarray:
    """Butterworth 幅度近似低通（静态截止，零相位）"""
    n = x.shape[0]
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(n, 1.0 / SR)
    with np.errstate(divide="ignore"):
        H = 1.0 / np.sqrt(1.0 + (f / max(cutoff, 1.0)) ** (2 * order))
    return np.fft.irfft(X * H, n)


def highpass(x: np.ndarray, cutoff: float, order: int = 2) -> np.ndarray:
    """Butterworth 幅度近似高通"""
    n = x.shape[0]
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(n, 1.0 / SR)
    with np.errstate(divide="ignore"):
        H = 1.0 / np.sqrt(1.0 + (max(cutoff, 1.0) / np.maximum(f, 1e-6)) ** (2 * order))
    return np.fft.irfft(X * H, n)


def bandpass(x: np.ndarray, lo: float, hi: float, order: int = 2) -> np.ndarray:
    """带通 = 高通 + 低通级联"""
    return lowpass(highpass(x, lo, order), hi, order)


# ---------------------------------------------------------------- 空间效果
def _comb(x: np.ndarray, delay_s: float, g: float) -> np.ndarray:
    """反馈梳状滤波器 y[n] = x[n] + g*y[n-D]（按块向量化，无逐采样循环）"""
    D = max(1, int(delay_s * SR))
    y = x.copy()
    for start in range(D, y.shape[0], D):
        end = min(start + D, y.shape[0])
        y[start:end] += g * y[start - D:start - D + (end - start)]
    return y


def _allpass(x: np.ndarray, delay_s: float, g: float) -> np.ndarray:
    """全通滤波器 y[n] = -g*x[n] + x[n-D] + g*y[n-D]"""
    D = max(1, int(delay_s * SR))
    y = np.zeros_like(x)
    head = min(D, x.shape[0])
    y[:head] = -g * x[:head]
    for start in range(D, y.shape[0], D):
        end = min(start + D, y.shape[0])
        prev = slice(start - D, start - D + (end - start))
        seg = slice(start, end)
        y[seg] = -g * x[seg] + x[prev] + g * y[prev]
    return y


def reverb(x: np.ndarray, size: float = 1.0, mix: float = 0.25, decay: float = 0.62) -> np.ndarray:
    """Schroeder 混响（4 梳状 + 2 全通）。size=房间尺度倍率，mix=湿声比例"""
    combs = [0.0297, 0.0371, 0.0411, 0.0437]
    wet = np.zeros_like(x)
    for d in combs:
        wet += _comb(x, d * size, decay)
    wet /= len(combs)
    wet = _allpass(wet, 0.005 * size, 0.7)
    wet = _allpass(wet, 0.0017 * size, 0.7)
    return (1.0 - mix) * x + mix * wet


def delay_fx(x: np.ndarray, time_s: float, fb: float = 0.34, mix: float = 0.28, taps: int = 4) -> np.ndarray:
    """多抽头延迟（回声），反馈衰减"""
    y = x.copy()
    D = max(1, int(time_s * SR))
    g = fb
    for k in range(1, taps + 1):
        shift = D * k
        if shift >= x.shape[0]:
            break
        y[shift:] += (mix * g) * x[:-shift]
        g *= fb
    return y


# ---------------------------------------------------------------- 后处理
def softclip(x: np.ndarray, drive: float = 1.0) -> np.ndarray:
    """tanh 软削波（防爆音，兼作饱和染色）"""
    return np.tanh(x * drive)


def norm(x: np.ndarray, peak: float = 0.9) -> np.ndarray:
    """按峰值归一化到目标峰值（静音时原样返回）"""
    m = np.max(np.abs(x))
    if m < 1e-9:
        return x
    return x * (peak / m)


def loopify(x: np.ndarray, loop_n: int, tail_n: int) -> np.ndarray:
    """
    无缝循环收尾：把 [loop_n, loop_n+tail_n) 的尾巴折叠叠加回 [0, tail_n)，
    输出恰好 loop_n 采样。用于所有 BGM 循环素材（BGM 变速循环播放要求首尾零爆音）。
    """
    buf = np.zeros(loop_n + tail_n, dtype=np.float64)
    buf[:x.shape[0]] += x[: buf.shape[0]]
    out = buf[:loop_n].copy()
    out[:tail_n] += buf[loop_n:loop_n + tail_n]
    return out


def place(buf: np.ndarray, sound: np.ndarray, at: int, gain: float = 1.0) -> None:
    """把 sound 以样本偏移 at 叠加进 buf（越界自动截断；循环素材之后统一 loopify）"""
    end = min(at + sound.shape[0], buf.shape[0])
    if end > at >= 0:
        buf[at:end] += gain * sound[: end - at]


# ---------------------------------------------------------------- WAV 写出
def write_wav(path: str, data, sr: int = SR) -> None:
    """
    写出 16-bit PCM WAV。
    data: 一维数组（单声道）或二维数组 (n, 2)（立体声）。
    """
    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    x = np.asarray(data, dtype=np.float64)
    if x.ndim == 1:
        x = x[:, None]
    assert x.ndim == 2 and x.shape[1] in (1, 2)
    x = np.clip(x, -1.0, 1.0)
    pcm = (x * 32767.0).astype("<i2")
    with wave.open(path, "wb") as w:
        w.setnchannels(x.shape[1])
        w.setsampwidth(2)
        w.setframerate(sr)
        w.writeframes(pcm.tobytes())


def peak_of(x: np.ndarray) -> float:
    return float(np.max(np.abs(x))) if x.shape[0] else 0.0


def rms_of(x: np.ndarray) -> float:
    return float(np.sqrt(np.mean(x ** 2))) if x.shape[0] else 0.0
