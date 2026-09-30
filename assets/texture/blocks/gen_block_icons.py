# -*- coding: utf-8 -*-
"""
NEON PULSE — 精确方块图标生成器（引擎可用素材）
形状严格按 01-framework/framework.md §5.4 出生朝向（spawn state 0）；
配色按 art-direction-brief.md §3 色板。
风格：数据光块 —— 内部垂直微渐变 + 上/左内高光 + 外发光 Bloom（与生图样张一致）。
"""
import os
from PIL import Image, ImageDraw, ImageFilter

BASE = os.path.join(os.path.dirname(__file__), "..", "assets", "blocks")
os.makedirs(BASE, exist_ok=True)

# ---- 色板（唯一口径） ----
PALETTE = {
    "I": "#00E5FF", "O": "#FFEE58", "T": "#7C4DFF",
    "S": "#00E676", "Z": "#FF2D9B", "J": "#2979FF", "L": "#FF8A00",
}
BG_DARK = (11, 14, 26, 255)  # #0B0E1A

# ---- 形状（spawn 朝向，(列,行) 相对归一化；行向下为正） ----
SHAPES = {
    "I": [(0, 0), (1, 0), (2, 0), (3, 0)],                 # 一字横排 4x1
    "O": [(0, 0), (1, 0), (0, 1), (1, 1)],                 # 2x2
    "T": [(1, 0), (0, 1), (1, 1), (2, 1)],                 # 凸向上
    "S": [(1, 0), (2, 0), (0, 1), (1, 1)],                 # 上层右偏
    "Z": [(0, 0), (1, 0), (1, 1), (2, 1)],                 # 上层左偏
    "J": [(0, 0), (0, 1), (1, 1), (2, 1)],                 # 凸向左上
    "L": [(2, 0), (0, 1), (1, 1), (2, 1)],                 # 凸向右上
}

CELL = 128          # 单格 128px（40px @1080p 的 3.2x，导出可缩）
GAP = 6             # 格间隙
GLOW = 18           # 外发光半径
PAD = GLOW + 8      # 画布留白（容纳 glow）


def hex2rgb(h: str):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def draw_cell(draw: ImageDraw.ImageDraw, x, y, size, rgb, ghost=False):
    """绘制单格：暗底 + 垂直微渐变 + 上/左内高光 + 描边发光"""
    r, g, b = rgb
    # 主体：上亮下暗的微渐变（15%）
    top = (min(r + 60, 255), min(g + 60, 255), min(b + 60, 255), 255)
    bottom = (max(r - 40, 0), max(g - 40, 0), max(b - 40, 0), 255)
    if ghost:
        top = (r, g, b, 70)
        bottom = (r, g, b, 35)
    for i in range(size):
        t = i / max(size - 1, 1)
        col = tuple(int(top[k] + (bottom[k] - top[k]) * t) for k in range(4))
        draw.line([(x, y + i), (x + size, y + i)], fill=col)
    # 内高光：上/左亮线
    hl = (min(r + 110, 255), min(g + 110, 255), min(b + 110, 255), 230 if not ghost else 90)
    draw.line([(x + 4, y + 3), (x + size - 4, y + 3)], fill=hl, width=3)      # 上
    draw.line([(x + 3, y + 4), (x + 3, y + size - 4)], fill=hl, width=3)      # 左
    # 内暗线：下/右
    sh = (max(r - 70, 0), max(g - 70, 0), max(b - 70, 0), 220 if not ghost else 70)
    draw.line([(x + 4, y + size - 3), (x + size - 4, y + size - 3)], fill=sh, width=3)
    draw.line([(x + size - 3, y + 4), (x + size - 3, y + size - 4)], fill=sh, width=3)
    # 描边
    edge = (min(r + 130, 255), min(g + 130, 255), min(b + 130, 255), 255 if not ghost else 110)
    draw.rectangle([x + 2, y + 2, x + size - 2, y + size - 2], outline=edge, width=2)


def make_piece(name: str, ghost=False, cell=CELL, gap=GAP):
    cells = SHAPES[name]
    rgb = hex2rgb(PALETTE[name])
    w_cells = max(c[0] for c in cells) + 1
    h_cells = max(c[1] for c in cells) + 1
    W = w_cells * (cell + gap) - gap + PAD * 2
    H = h_cells * (cell + gap) - gap + PAD * 2

    # 发光层（先画大色块再高斯模糊）
    glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    for cx, cy in cells:
        x = PAD + cx * (cell + gap)
        y = PAD + cy * (cell + gap)
        gc = (min(rgb[0] + 40, 255), min(rgb[1] + 40, 255), min(rgb[2] + 40, 255),
              160 if not ghost else 60)
        gd.rectangle([x, y, x + cell, y + cell], fill=gc)
    glow = glow.filter(ImageFilter.GaussianBlur(GLOW))

    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    img.alpha_composite(glow)
    d = ImageDraw.Draw(img)
    for cx, cy in cells:
        x = PAD + cx * (cell + gap)
        y = PAD + cy * (cell + gap)
        draw_cell(d, x, y, cell, rgb, ghost)
    return img


def main():
    sheet_cells = []
    for name in ["I", "O", "T", "S", "Z", "J", "L"]:
        img = make_piece(name)
        path = os.path.join(BASE, f"block-{name}.png")
        img.save(path)
        sheet_cells.append((name, img))
        g = make_piece(name, ghost=True)
        g.save(os.path.join(BASE, f"block-{name}-ghost.png"))
        print("saved", path, img.size)

    # 联系表：七种方块 + ghost 示例（深底便于查看）
    pad = 40
    cols = 4
    cw = max(i.width for _, i in sheet_cells) + pad
    ch = max(i.height for _, i in sheet_cells) + pad
    rows = (len(sheet_cells) + cols - 1) // cols
    sheet = Image.new("RGBA", (cw * cols + pad, ch * rows + pad), BG_DARK)
    for idx, (name, im) in enumerate(sheet_cells):
        x = pad + (idx % cols) * cw + (cw - pad - im.width) // 2
        y = pad + (idx // cols) * ch + (ch - pad - im.height) // 2
        sheet.alpha_composite(im, (x, y))
    sheet.save(os.path.join(BASE, "blocks-icons.png"))
    print("saved contact sheet", sheet.size)


if __name__ == "__main__":
    main()
