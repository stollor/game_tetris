# -*- coding: utf-8 -*-
"""
NEON PULSE · 04-audio-fx — 特效序列帧 / 粒子图集生成脚本
========================================================
生成 docs/02-animation-design.md 中定义的 2D 序列帧素材（sprite sheet，PNG 透明底）
与粒子图集。全部程序化绘制（numpy + Pillow），可复现、可调参。

设计口径：
- 风格 = Modern Neon Arcade：加性辉光（additive glow）、白→身份色渐变、短促踩拍。
- 所有序列帧按 **60fps 采样**；帧数即该特效时长（16 帧 ≈ 267ms）。
- 帧画布为发光体（alpha = 亮度），引擎按 Additive / Screen 混合叠加在深色背景上。

运行：python gen_fx_frames.py   （输出 fx/*.png + _preview_*.jpg）
"""

import json
import math
import os
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "fx")

# ---------------------------------------------------------------- 色板（与 03-art-design 对齐）
PAL = {
    "bg": (0x0B / 255, 0x0E / 255, 0x1A / 255),
    "white": (1.0, 1.0, 1.0),
    "cyan": (0x00 / 255, 0xE5 / 255, 0xFF / 255),
    "magenta": (0xFF / 255, 0x2D / 255, 0x9B / 255),
    "gold": (0xFF / 255, 0xD5 / 255, 0x4F / 255),
    "danger": (0xFF / 255, 0x17 / 255, 0x44 / 255),
    "green": (0x00 / 255, 0xE6 / 255, 0x76 / 255),
    "purple": (0x7C / 255, 0x4D / 255, 0xFF / 255),
}


def lerp_color(c0, c1, t):
    t = min(1.0, max(0.0, t))
    return tuple(a + (b - a) * t for a, b in zip(c0, c1))


# ---------------------------------------------------------------- 绘制基元（numpy 加性合成）
def new_canvas(h: int, w: int) -> np.ndarray:
    return np.zeros((h, w, 3), dtype=np.float64)


def _blur(mask: np.ndarray, radius: float) -> np.ndarray:
    if radius <= 0:
        return mask
    img = Image.fromarray((np.clip(mask, 0, 1) * 255).astype(np.uint8))
    img = img.filter(ImageFilter.GaussianBlur(radius))
    return np.asarray(img, dtype=np.float64) / 255.0


def add_glow(canvas: np.ndarray, mask: np.ndarray, color, intensity: float = 1.0,
             blur: float = 0.0) -> None:
    """把 mask（0..1 灰度）按颜色加性叠加到画布"""
    m = _blur(mask, blur) if blur > 0 else mask
    canvas += m[..., None] * np.asarray(color, dtype=np.float64) * intensity


def radial_mask(h: int, w: int, cx: float, cy: float, r: float, falloff: float = 2.0) -> np.ndarray:
    yy, xx = np.mgrid[0:h, 0:w]
    d = np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2) / max(r, 1e-3)
    m = np.clip(1.0 - d, 0.0, 1.0) ** falloff
    return m


def ring_mask(h: int, w: int, cx: float, cy: float, r: float, width: float) -> np.ndarray:
    yy, xx = np.mgrid[0:h, 0:w]
    d = np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2)
    m = np.clip(1.0 - np.abs(d - r) / max(width, 1e-3), 0.0, 1.0)
    return m ** 1.6


def rect_mask(h: int, w: int, x0: float, y0: float, x1: float, y1: float,
              feather: float = 0.0) -> np.ndarray:
    yy, xx = np.mgrid[0:h, 0:w]
    inside = ((xx >= x0) & (xx <= x1) & (yy >= y0) & (yy <= y1)).astype(np.float64)
    return _blur(inside, feather) if feather > 0 else inside


def polygon_mask(h: int, w: int, points) -> np.ndarray:
    img = Image.new("L", (w, h), 0)
    ImageDraw.Draw(img).polygon([(float(x), float(y)) for x, y in points], fill=255)
    return np.asarray(img, dtype=np.float64) / 255.0


def ray_mask(h: int, w: int, cx: float, cy: float, angle: float, length: float,
             half_width: float) -> np.ndarray:
    """从中心向外的锥形光线（根部宽、尖端细）"""
    yy, xx = np.mgrid[0:h, 0:w]
    dx, dy = xx - cx, yy - cy
    ca, sa = math.cos(angle), math.sin(angle)
    along = dx * ca + dy * sa
    perp = np.abs(-dx * sa + dy * ca)
    taper = np.clip(1.0 - along / max(length, 1e-3), 0.12, 1.0)
    m = ((along >= 0) & (along <= length) & (perp <= half_width * taper)).astype(np.float64)
    return _blur(m, 1.5)


def to_rgba(canvas: np.ndarray) -> Image.Image:
    """加性画布 → RGBA（alpha = 最大通道，发光体语义）"""
    rgb = np.clip(canvas, 0.0, 1.0)
    alpha = np.clip(np.max(rgb, axis=2) * 1.15, 0.0, 1.0)
    out = np.dstack([rgb, alpha])
    return Image.fromarray((out * 255).astype(np.uint8), "RGBA")


def sheet(frames, cols: int, cell: int, path: str) -> None:
    rows = (len(frames) + cols - 1) // cols
    sh = Image.new("RGBA", (cols * cell, rows * cell), (0, 0, 0, 0))
    for i, fr in enumerate(frames):
        sh.paste(fr, ((i % cols) * cell, (i // cols) * cell))
    sh.save(path)
    print(f"[FX] {os.path.basename(path):<26s} {len(frames):>2d} 帧  {sh.size[0]}x{sh.size[1]}")


# ================================================================ 序列帧：消行爆光
def build_line_burst(n_frames: int = 16, cell: int = 256):
    """
    行爆白闪 → 光条横向拉伸 → 碎片外飞 → 辉光衰减。
    引擎用法：按消行行数播放（1–4 行各自播放一次，多行错位 40ms 叠加）。
    """
    frames = []
    h = w = cell
    rng = np.random.default_rng(20240501)
    # (初始横向偏移, 速度x, 速度y, 缩放)：碎块沿整行分布，再向外飞散
    shards = [(rng.uniform(-0.46, 0.46), rng.uniform(-1.2, 1.2), rng.uniform(-0.7, 0.7),
               rng.uniform(0.7, 1.5)) for _ in range(14)]
    for i in range(n_frames):
        p = i / (n_frames - 1)
        c = new_canvas(h, w)
        # 白闪核心：前 25% 最亮，横条高度先撑后收
        bar_h = (0.30 + 0.22 * math.sin(math.pi * min(p * 1.6, 1.0))) * cell * 0.5
        core = rect_mask(h, w, 0, cell / 2 - bar_h / 2, cell, cell / 2 + bar_h / 2, feather=6)
        flash = np.clip(1.0 - p / 0.35, 0, 1)
        add_glow(c, core, PAL["white"], 1.25 * flash, blur=4)
        add_glow(c, core, PAL["cyan"], 0.85 * (1.0 - p) ** 1.4, blur=10)
        # 外飞碎块
        for (sx, vx, vy, sc) in shards:
            dist = p * cell * 0.85 * sc
            cx = cell / 2 + sx * cell * 0.92 + vx * dist
            cy = cell / 2 + vy * dist * 0.8
            size = (12 + 17 * sc) * (1.0 - 0.55 * p)
            if size <= 0.5:
                continue
            pts = [(cx - size, cy - size * 0.45), (cx + size, cy - size * 0.25),
                   (cx + size * 0.6, cy + size * 0.5), (cx - size * 0.8, cy + size * 0.35)]
            m = polygon_mask(h, w, pts)
            add_glow(c, m, PAL["cyan"], 0.9 * (1.0 - p) ** 1.2, blur=2.5)
        # 残留辉光
        add_glow(c, radial_mask(h, w, cell / 2, cell / 2, cell * (0.32 + 0.28 * p)),
                 PAL["cyan"], 0.5 * (1.0 - p) ** 1.6, blur=6)
        frames.append(to_rgba(c))
    return frames


# ================================================================ 序列帧：COMBO 色环脉冲
def build_combo_ring(n_frames: int = 16, cell: int = 256):
    """
    全屏色环脉冲（Combo ≥5 触发）：环从中心扩散，色由青 → 品红渐变。
    引擎用法：铺满全屏（Additive），环半径按帧外推，可多环错峰。
    """
    frames = []
    h = w = cell
    for i in range(n_frames):
        p = i / (n_frames - 1)
        c = new_canvas(h, w)
        color = lerp_color(PAL["cyan"], PAL["magenta"], p)
        r = cell * (0.06 + 0.52 * p)
        width = cell * (0.085 * (1.0 - 0.65 * p) + 0.012)
        ring = ring_mask(h, w, cell / 2, cell / 2, r, width)
        add_glow(c, ring, color, 1.15 * (1.0 - p) ** 1.25, blur=4)
        add_glow(c, ring, PAL["white"], 0.35 * (1.0 - p) ** 2.0, blur=2)
        # 环上星点
        rng = np.random.default_rng(77 + i)
        for _ in range(6):
            a = rng.uniform(0, 2 * math.pi)
            px = cell / 2 + math.cos(a) * r
            py = cell / 2 + math.sin(a) * r
            add_glow(c, radial_mask(h, w, px, py, cell * 0.035), color, 0.8 * (1 - p), blur=2)
        # 起始闪光
        if p < 0.22:
            add_glow(c, radial_mask(h, w, cell / 2, cell / 2, cell * 0.30),
                     PAL["white"], 1.0 * (1 - p / 0.22), blur=8)
        frames.append(to_rgba(c))
    return frames


# ================================================================ 序列帧：破纪录金色爆发
def build_record_burst(n_frames: int = 18, cell: int = 256):
    """
    破纪录 ≤300ms 全屏特效：金色射线爆开 + 金环 + 星点 + 中心白闪（18 帧 = 300ms @60fps）。
    引擎用法：全屏 Additive 叠加层，输入照常穿透（framework §2.3 非阻塞铁律）。
    """
    frames = []
    h = w = cell
    for i in range(n_frames):
        p = i / (n_frames - 1)
        c = new_canvas(h, w)
        spin = p * 0.22
        for k in range(12):
            a = k * (2 * math.pi / 12) + spin
            length = cell * (0.16 + 0.52 * p)
            add_glow(c, ray_mask(h, w, cell / 2, cell / 2, a, length, cell * 0.028 * (1 - 0.5 * p)),
                     PAL["gold"], 0.95 * (1.0 - p) ** 1.15, blur=3)
        r = cell * (0.08 + 0.5 * p)
        add_glow(c, ring_mask(h, w, cell / 2, cell / 2, r, cell * (0.06 * (1 - 0.6 * p) + 0.01)),
                 PAL["gold"], 1.0 * (1.0 - p) ** 1.3, blur=4)
        # 星点粒子
        rng = np.random.default_rng(1000 + i)
        for _ in range(10):
            a = rng.uniform(0, 2 * math.pi)
            d = rng.uniform(0.15, 0.62) * cell * (0.35 + p)
            px = cell / 2 + math.cos(a) * d
            py = cell / 2 + math.sin(a) * d
            add_glow(c, radial_mask(h, w, px, py, cell * 0.022),
                     lerp_color(PAL["gold"], PAL["white"], rng.random()), 0.9 * (1 - p), blur=1.5)
        if p < 0.3:
            add_glow(c, radial_mask(h, w, cell / 2, cell / 2, cell * 0.34),
                     PAL["white"], 1.2 * (1 - p / 0.3), blur=10)
        frames.append(to_rgba(c))
    return frames


# ================================================================ 序列帧：Perfect Clear 全清
def build_pc_burst(n_frames: int = 16, cell: int = 256):
    """全清星爆：十字耀斑 + 双环 + 星点（青白）"""
    frames = []
    h = w = cell
    for i in range(n_frames):
        p = i / (n_frames - 1)
        c = new_canvas(h, w)
        # 十字耀斑
        for ang in (0.0, math.pi / 2):
            add_glow(c, ray_mask(h, w, cell / 2, cell / 2, ang, cell * (0.3 + 0.22 * p), cell * 0.05 * (1 - 0.5 * p)),
                     PAL["white"], 0.85 * (1 - p) ** 1.3, blur=5)
            add_glow(c, ray_mask(h, w, cell / 2, cell / 2, ang + math.pi, cell * (0.3 + 0.22 * p), cell * 0.05 * (1 - 0.5 * p)),
                     PAL["white"], 0.85 * (1 - p) ** 1.3, blur=5)
        for k, (speed, w0) in enumerate([(0.55, 0.055), (0.36, 0.035)]):
            r = cell * (0.05 + speed * p)
            add_glow(c, ring_mask(h, w, cell / 2, cell / 2, r, cell * (w0 * (1 - 0.55 * p) + 0.008)),
                     PAL["cyan"] if k == 0 else PAL["white"], (1.0 - 0.75 * k) * (1 - p) ** 1.2, blur=3)
        add_glow(c, radial_mask(h, w, cell / 2, cell / 2, cell * (0.2 + 0.25 * p)),
                 PAL["cyan"], 0.75 * (1 - p) ** 1.5, blur=8)
        frames.append(to_rgba(c))
    return frames


# ================================================================ 序列帧：锁定闪
def build_lock_flash(n_frames: int = 8, cell: int = 128):
    """方块锁定单元闪（单格）：白 → 青，边缘内收，133ms"""
    frames = []
    h = w = cell
    for i in range(n_frames):
        p = i / (n_frames - 1)
        c = new_canvas(h, w)
        inset = cell * (0.06 + 0.18 * p)
        core = rect_mask(h, w, inset, inset, cell - inset, cell - inset, feather=2)
        add_glow(c, core, PAL["white"], 1.1 * (1 - p) ** 1.6, blur=3)
        add_glow(c, core, PAL["cyan"], 0.7 * (1 - p) ** 1.2, blur=6)
        frames.append(to_rgba(c))
    return frames


# ================================================================ 序列帧：硬降拖尾
def build_drop_trail(n_frames: int = 8, cell: int = 128):
    """硬降竖向拖尾：头部亮、尾迹上收（133ms）"""
    frames = []
    h = w = cell
    for i in range(n_frames):
        p = i / (n_frames - 1)
        c = new_canvas(h, w)
        head_y = cell * (0.25 + 0.75 * p)
        x0, x1 = cell * 0.34, cell * 0.66
        trail = rect_mask(h, w, x0, 0, x1, head_y, feather=3)
        grad = np.linspace(0.15, 1.0, h)[:, None]      # 尾部渐隐
        add_glow(c, trail * grad, PAL["cyan"], 0.85 * (1 - p) ** 1.1, blur=5)
        add_glow(c, rect_mask(h, w, x0, head_y - cell * 0.1, x1, head_y, feather=2),
                 PAL["white"], 1.0 * (1 - p) ** 1.3, blur=4)
        frames.append(to_rgba(c))
    return frames


# ================================================================ 序列帧：升级脉冲
def build_levelup_wave(n_frames: int = 18, cell: int = 256):
    """
    升级 300ms 全屏色彩脉冲（framework §6.1）：双环外推 + 上升光柱。
    引擎用法：全屏 Additive；与 sfx_level_up 同帧触发。
    """
    frames = []
    h = w = cell
    for i in range(n_frames):
        p = i / (n_frames - 1)
        c = new_canvas(h, w)
        for k, (speed, w0) in enumerate([(0.62, 0.05), (0.44, 0.032)]):
            r = cell * (0.08 + speed * p)
            col = PAL["cyan"] if k == 0 else PAL["purple"]
            add_glow(c, ring_mask(h, w, cell / 2, cell / 2, r, cell * (w0 * (1 - 0.5 * p) + 0.01)),
                     col, (1.0 - 0.55 * k) * (1 - p) ** 1.2, blur=4)
        # 上升光柱（等化器感）
        rng = np.random.default_rng(500)
        for k in range(7):
            bx = cell * (0.12 + 0.128 * k)
            bh = cell * (0.18 + 0.32 * rng.random()) * (1.0 - 0.4 * p)
            add_glow(c, rect_mask(h, w, bx - cell * 0.022, cell - bh, bx + cell * 0.022, cell, feather=2),
                     PAL["cyan"], 0.55 * (1 - p) ** 1.3, blur=4)
        frames.append(to_rgba(c))
    return frames


# ================================================================ 序列帧：危险红光呼吸（循环）
def build_danger_pulse(n_frames: int = 8, cell: int = 256):
    """
    危险预警（堆叠 ≥16 行）场地边缘红光呼吸：8 帧 = 1s 循环（12fps）。
    引擎用法：场地边缘叠加层循环播放（shader 版见 shaders/danger_vignette.frag）。
    """
    frames = []
    h = w = cell
    for i in range(n_frames):
        p = i / n_frames
        breathe = 0.55 + 0.45 * math.sin(2 * math.pi * p)
        c = new_canvas(h, w)
        edge = np.zeros((h, w))
        for t in (0, 1):
            edge += rect_mask(h, w, 0, t * (h - 6), w, t * (h - 6) + 6, feather=3)
            edge += rect_mask(h, w, t * (w - 6), 0, t * (w - 6) + 6, h, feather=3)
        add_glow(c, np.clip(edge, 0, 1), PAL["danger"], 0.9 * breathe, blur=10)
        add_glow(c, radial_mask(h, w, cell / 2, cell / 2, cell * 0.72, falloff=1.2),
                 PAL["danger"], 0.22 * breathe, blur=12)
        frames.append(to_rgba(c))
    return frames


# ================================================================ 粒子图集（单帧贴图）
def build_particles():
    files = []
    # 柔和辉光点（粒子主力，引擎按方块色 tint）
    c = new_canvas(64, 64)
    add_glow(c, radial_mask(64, 64, 32, 32, 26, falloff=2.2), PAL["white"], 1.0)
    img = to_rgba(c)
    img.save(os.path.join(OUT, "particle_glow.png"))
    files.append("particle_glow.png")

    # 高光火花（四芒星）
    c = new_canvas(32, 32)
    for ang in (0.0, math.pi / 2):
        for sgn in (1, -1):
            add_glow(c, ray_mask(32, 32, 16, 16, ang if sgn > 0 else ang + math.pi, 15, 2.2),
                     PAL["white"], 1.0, blur=1.2)
    add_glow(c, radial_mask(32, 32, 16, 16, 7), PAL["white"], 1.0)
    to_rgba(c).save(os.path.join(OUT, "particle_spark.png"))
    files.append("particle_spark.png")

    # 碎片（消行外飞碎块，引擎按方块色 tint）
    c = new_canvas(64, 64)
    m = polygon_mask(64, 64, [(12, 26), (52, 16), (46, 46), (18, 40)])
    add_glow(c, m, PAL["white"], 1.0, blur=1.0)
    add_glow(c, m, PAL["cyan"], 0.55, blur=5)
    to_rgba(c).save(os.path.join(OUT, "particle_shard.png"))
    files.append("particle_shard.png")
    print(f"[FX] particles ×{len(files)}")
    return files


# ================================================================ 预览联系表
def make_preview(name: str, frames, cols: int, cell: int, scale: float = 0.5):
    bg = Image.new("RGB", (cols * int(cell * scale), ((len(frames) + cols - 1) // cols) * int(cell * scale)),
                   tuple(int(v * 255) for v in PAL["bg"]))
    for i, fr in enumerate(frames):
        th = fr.resize((int(cell * scale), int(cell * scale)), Image.LANCZOS)
        bg.paste(th, ((i % cols) * int(cell * scale), (i // cols) * int(cell * scale)), th)
    path = os.path.join(OUT, f"_preview_{name}.jpg")
    bg.save(path, quality=88)
    print(f"[FX] preview {os.path.basename(path)}")


def main():
    os.makedirs(OUT, exist_ok=True)
    jobs = [
        ("fx_line_burst", build_line_burst(), 4),
        ("fx_combo_ring", build_combo_ring(), 4),
        ("fx_record_burst", build_record_burst(), 6),
        ("fx_pc_burst", build_pc_burst(), 4),
        ("fx_lock_flash", build_lock_flash(), 4),
        ("fx_drop_trail", build_drop_trail(), 4),
        ("fx_levelup_wave", build_levelup_wave(), 6),
        ("fx_danger_pulse", build_danger_pulse(), 4),
    ]
    meta = []
    for name, frames, cols in jobs:
        cell = frames[0].size[0]
        sheet(frames, cols, cell, os.path.join(OUT, f"{name}.png"))
        make_preview(name, frames, cols, cell)
        meta.append({
            "file": f"fx/{name}.png",
            "frames": len(frames),
            "cols": cols,
            "cell_px": cell,
            "fps": 60 if name != "fx_danger_pulse" else 12,
            "duration_ms": int(round(len(frames) / (60 if name != "fx_danger_pulse" else 12) * 1000)),
            "loop": name == "fx_danger_pulse",
            "blend": "additive",
            "status": "generated",
        })
    files = build_particles()
    for f in files:
        size = Image.open(os.path.join(OUT, f)).size[0]
        meta.append({
            "file": f"fx/{f}",
            "frames": 1,
            "cell_px": size,
            "fps": None,
            "duration_ms": None,
            "loop": False,
            "blend": "additive",
            "status": "generated",
        })
    with open(os.path.join(OUT, "_fx_meta.json"), "w", encoding="utf-8") as fh:
        json.dump(meta, fh, ensure_ascii=False, indent=2)
    print(f"\n共生成 {len(meta)} 个特效素材 → {os.path.abspath(OUT)}")


if __name__ == "__main__":
    main()
