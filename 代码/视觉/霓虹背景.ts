import type Phaser from "phaser";
import { 亮色, 混色 } from "../../框架/组件/Phaser界面/颜色工具";
import type { 背景主题 } from "../../框架/设置";
import { 背景主题选项, 背景主题配置 } from "../配置/背景主题";

export { 背景主题选项 };

const 随机值 = (索引: number): number => {
  const 值 = Math.sin(索引 * 127.1 + 311.7) * 43758.5453123;
  return 值 - Math.floor(值);
};

/** 绘制随画布尺寸重排的程序化场景底图。 */
export function 绘制霓虹背景(
  图形: Phaser.GameObjects.Graphics,
  宽: number,
  高: number,
  主题: 背景主题 = "晨光海岸",
): void {
  图形.clear();
  if (主题 === "晨光海岸") 绘制海岸底图(图形, 宽, 高);
  else if (主题 === "云海山岚") 绘制山岚底图(图形, 宽, 高);
  else if (主题 === "极光原野") 绘制原野底图(图形, 宽, 高);
  else 绘制天际底图(图形, 宽, 高);
  绘制暗角(图形, 宽, 高);
}

/** 只重绘独立动态层，底图保持静态以减少每帧绘图开销。 */
export function 绘制动态霓虹细节(
  图形: Phaser.GameObjects.Graphics,
  宽: number,
  高: number,
  时间: number,
  主题: 背景主题 = "晨光海岸",
): void {
  图形.clear();
  const 配置 = 背景主题配置[主题];
  const 动画时间 = 时间 * 配置.动画速度;
  if (主题 === "晨光海岸") 绘制海面动画(图形, 宽, 高, 动画时间);
  else if (主题 === "云海山岚") 绘制云层动画(图形, 宽, 高, 动画时间);
  else if (主题 === "极光原野") 绘制极光动画(图形, 宽, 高, 动画时间);
  else 绘制城市动画(图形, 宽, 高, 动画时间);
  图形.setAlpha(配置.动画亮度);
}

/* ------------------------------------------------------------------ */
/* 通用绘制工具                                                         */
/* ------------------------------------------------------------------ */

/** 多段垂直渐变天幕：逐段双色渐变，无色带。 */
function 绘制天幕(
  图形: Phaser.GameObjects.Graphics,
  宽: number,
  顶: number,
  底: number,
  色标: number[],
): void {
  const 高 = 底 - 顶;
  if (高 <= 0) return;
  const 段数 = Math.max(1, 色标.length - 1);
  for (let 段 = 0; 段 < 段数; 段 += 1) {
    const y0 = 顶 + (高 * 段) / 段数;
    const y1 = 顶 + (高 * (段 + 1)) / 段数;
    const 起色 = 色标[段] ?? 0;
    const 止色 = 色标[段 + 1] ?? 起色;
    图形
      .fillGradientStyle(起色, 起色, 止色, 止色, 1, 1, 1, 1)
      .fillRect(0, y0 - 0.5, 宽, y1 - y0 + 1.5);
  }
}

/** 柔和径向光晕：多层同心圆模拟泛光。 */
function 绘制光晕(
  图形: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  半径: number,
  色: number,
  强度 = 1,
  层 = 6,
): void {
  for (let i = 层 * 2; i >= 1; i -= 1) {
    图形
      .fillStyle(色, 0.014 * 强度 * (1 - (i - 1) / (层 * 2 + 1)))
      .fillCircle(x, y, 半径 * (1 + i * 0.32));
  }
}

/** 日轮：光晕 + 内核 + 受光顶面 + 放射光芒 + 水平光带。 */
function 绘制日轮(
  图形: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  半径: number,
  核色: number,
  光色: number,
  强度 = 1,
): void {
  // 放射光芒（柔和低调）
  for (let i = 0; i < 12; i += 1) {
    const 角度 = (Math.PI * 2 * i) / 12 + 0.26;
    const 长 = 半径 * (2.6 + (i % 3) * 0.5);
    图形
      .fillStyle(光色, 0.032 * 强度)
      .fillTriangle(
        x + Math.cos(角度 - 0.045) * 半径,
        y + Math.sin(角度 - 0.045) * 半径,
        x + Math.cos(角度 + 0.045) * 半径,
        y + Math.sin(角度 + 0.045) * 半径,
        x + Math.cos(角度) * 长,
        y + Math.sin(角度) * 长,
      );
  }
  绘制光晕(图形, x, y, 半径, 光色, 0.9 * 强度, 8);
  图形.fillStyle(光色, 0.3 * 强度).fillCircle(x, y, 半径 * 1.22);
  图形.fillStyle(核色, 1).fillCircle(x, y, 半径);
  图形.fillStyle(亮色(核色, 0.55), 0.85).fillCircle(x, y - 半径 * 0.16, 半径 * 0.82);
  图形.fillStyle(0xffffff, 0.22 * 强度).fillEllipse(x, y, 半径 * 2.2, 半径 * 0.09);
  图形.fillStyle(光色, 0.12 * 强度).fillEllipse(x, y, 半径 * 3.8, 半径 * 0.16);
}

/** 蓬松积云：多层低透明度椭圆递进，柔化边缘；底部仅留极淡阴影。 */
function 绘制云朵(
  图形: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  尺寸: number,
  亮部: number,
  暗部: number,
  透明度 = 0.8,
): void {
  const 团: [number, number, number][] = [
    [0, 0, 1],
    [-0.62, 0.1, 0.72],
    [0.62, 0.12, 0.78],
    [-0.3, -0.26, 0.66],
    [0.28, -0.3, 0.72],
    [0.95, 0.22, 0.5],
    [-0.95, 0.24, 0.52],
  ];
  // 底部阴影（大而淡）
  for (const [偏X, 偏Y, 半径] of 团) {
    图形
      .fillStyle(暗部, 透明度 * 0.14)
      .fillEllipse(
        x + 偏X * 尺寸,
        y + 偏Y * 尺寸 + 尺寸 * 0.17,
        尺寸 * 1.52 * 半径,
        尺寸 * 0.74 * 半径,
      );
  }
  // 三层递进：外软边 → 中层 → 亮核，消除硬边
  for (const [偏X, 偏Y, 半径] of 团) {
    图形
      .fillStyle(亮部, 透明度 * 0.2)
      .fillEllipse(x + 偏X * 尺寸, y + 偏Y * 尺寸, 尺寸 * 1.42 * 半径, 尺寸 * 0.66 * 半径);
  }
  for (const [偏X, 偏Y, 半径] of 团) {
    图形
      .fillStyle(亮部, 透明度 * 0.52)
      .fillEllipse(
        x + 偏X * 尺寸,
        y + 偏Y * 尺寸 - 尺寸 * 0.03,
        尺寸 * 1.16 * 半径,
        尺寸 * 0.52 * 半径,
      );
  }
  for (const [偏X, 偏Y, 半径] of 团) {
    图形
      .fillStyle(亮部, 透明度 * 0.82)
      .fillEllipse(
        x + 偏X * 尺寸 * 0.9,
        y + 偏Y * 尺寸 - 尺寸 * 0.08,
        尺寸 * 0.84 * 半径,
        尺寸 * 0.37 * 半径,
      );
  }
}

/** 山脊剪影：多峰折面 + 受光棱线。 */
function 绘制山脊(
  图形: Phaser.GameObjects.Graphics,
  宽: number,
  底部: number,
  颜色: number,
  高度比例: number,
  种子: number,
  雾色?: number,
): void {
  const 步长 = 宽 / 4;
  const 峰: number[] = [];
  for (let i = -1; i <= 6; i += 1) {
    峰.push(高度比例 * (0.55 + 随机值(i + 种子) * 0.62));
  }
  图形.fillStyle(颜色, 1);
  图形.beginPath();
  图形.moveTo(-步长, 底部);
  for (let i = -1; i <= 6; i += 1) {
    const x = i * 步长;
    const 峰高 = 峰[i + 1] ?? 高度比例 * 0.6;
    图形.lineTo(x + 步长 * 0.42, 底部 - 峰高);
    图形.lineTo(x + 步长 * 1.35, 底部 - 峰高 * 0.42);
  }
  图形.lineTo(宽 + 步长, 底部);
  图形.closePath();
  图形.fillPath();
  // 受光棱线（低调，避免硬折角过强）
  图形.lineStyle(1, 亮色(颜色, 0.3), 0.3);
  图形.beginPath();
  for (let i = -1; i <= 6; i += 1) {
    const x = i * 步长;
    const 峰高 = 峰[i + 1] ?? 高度比例 * 0.6;
    if (i === -1) 图形.moveTo(x + 步长 * 0.42, 底部 - 峰高);
    else {
      图形.lineTo(x + 步长 * 0.42, 底部 - 峰高);
      图形.lineTo(x + 步长 * 1.35, 底部 - 峰高 * 0.42);
    }
  }
  图形.strokePath();
  if (雾色 !== undefined) {
    // 山脚雾带：渐变上淡，避免生硬色块
    图形
      .fillGradientStyle(雾色, 雾色, 雾色, 雾色, 0, 0, 0.22, 0.22)
      .fillRect(0, 底部 - 高度比例 * 0.3, 宽, 高度比例 * 0.38);
  }
}

/** 星野：大小与亮度错落的星点。 */
function 绘制星野(
  图形: Phaser.GameObjects.Graphics,
  宽: number,
  高: number,
  数量: number,
  偏移: number,
): void {
  for (let i = 0; i < 数量; i += 1) {
    const x = 随机值(i + 偏移) * 宽;
    const y = 随机值(i + 偏移 + 300) * 高 * 0.72;
    const 半径 = 0.5 + 随机值(i + 偏移 + 600) * 1.4;
    图形.fillStyle(0xffffff, 0.18 + 随机值(i + 偏移 + 900) * 0.6).fillCircle(x, y, 半径);
    if (半径 > 1.4) {
      图形
        .fillStyle(0xffffff, 0.16)
        .fillEllipse(x, y, 半径 * 5, 半径 * 0.7)
        .fillEllipse(x, y, 半径 * 0.7, 半径 * 5);
    }
  }
}

/** 画面暗角 + 顶部轻微压暗，统一视觉焦点。 */
function 绘制暗角(图形: Phaser.GameObjects.Graphics, 宽: number, 高: number): void {
  const 步数 = 14;
  for (let i = 0; i < 步数; i += 1) {
    const 比例 = i / 步数;
    const 透明度 = 0.028 * (1 - 比例);
    const 边 = 高 * 0.14 * (1 - 比例);
    图形.fillStyle(0x04070f, 透明度 * 1.5).fillRect(0, 0, 宽, 边);
    图形.fillStyle(0x04070f, 透明度 * 1.7).fillRect(0, 高 - 边, 宽, 边);
    const 侧 = 宽 * 0.09 * (1 - 比例);
    图形.fillStyle(0x04070f, 透明度).fillRect(0, 0, 侧, 高);
    图形.fillStyle(0x04070f, 透明度).fillRect(宽 - 侧, 0, 侧, 高);
  }
  // 四角加深
  const 角半径 = Math.min(宽, 高) * 0.55;
  for (const [角X, 角Y] of [
    [0, 0],
    [宽, 0],
    [0, 高],
    [宽, 高],
  ]) {
    图形.fillStyle(0x04070f, 0.1).fillCircle(角X, 角Y, 角半径);
    图形.fillStyle(0x04070f, 0.1).fillCircle(角X, 角Y, 角半径 * 0.72);
    图形.fillStyle(0x04070f, 0.1).fillCircle(角X, 角Y, 角半径 * 0.48);
  }
}

/* ------------------------------------------------------------------ */
/* 晨光海岸                                                            */
/* ------------------------------------------------------------------ */

function 绘制海岸底图(图形: Phaser.GameObjects.Graphics, 宽: number, 高: number): void {
  const 海平线 = 高 * 0.585;
  绘制天幕(图形, 宽, 0, 海平线 + 4, [0x1c5a9c, 0x3f8cc2, 0x7fc3dc, 0xc9e7e6, 0xffe3b4]);
  const 日X = 宽 * 0.72;
  const 日Y = 高 * 0.27;
  绘制日轮(图形, 日X, 日Y, Math.min(宽, 高) * 0.072, 0xfff3cf, 0xffd9a0, 1);
  // 远处薄云与近云
  绘制云朵(图形, 宽 * 0.16, 高 * 0.2, 宽 * 0.075, 0xfff6e6, 0xd3e2ec, 0.85);
  绘制云朵(图形, 宽 * 0.45, 高 * 0.13, 宽 * 0.055, 0xfff6e6, 0xd0e0ec, 0.7);
  绘制云朵(图形, 宽 * 0.88, 高 * 0.36, 宽 * 0.085, 0xfff2dd, 0xcfe0ea, 0.62);
  绘制云朵(图形, 宽 * 0.3, 高 * 0.38, 宽 * 0.06, 0xfff2dd, 0xc9dce8, 0.42);
  // 海平线雾光
  图形.fillStyle(0xffe9c8, 0.5).fillRect(0, 海平线 - 高 * 0.045, 宽, 高 * 0.05);
  // 海面：由浅入深，与天空拉开层次
  绘制天幕(图形, 宽, 海平线, 高, [0x4ba3bd, 0x2e83a1, 0x1f6484, 0x154a68]);
  // 太阳反光光路
  for (let i = 0; i < 16; i += 1) {
    const 比例 = i / 15;
    const y = 海平线 + (高 - 海平线) * 比例;
    const 宽度 = 宽 * (0.035 + 比例 * 0.11);
    图形
      .fillStyle(0xffe7bd, 0.3 * (1 - 比例 * 0.72))
      .fillEllipse(日X + 宽 * 0.02 * 比例, y, 宽度, (高 - 海平线) * 0.045);
  }
  // 波纹光带：近大远小，亮度收敛
  for (let i = 0; i < 14; i += 1) {
    const 比例 = 0.08 + 随机值(i + 21) * 0.9;
    const y = 海平线 + (高 - 海平线) * 比例;
    const x = 随机值(i + 55) * 宽;
    const 长 = 宽 * (0.035 + 随机值(i + 87) * 0.1) * (0.6 + 比例 * 1.1);
    图形
      .fillStyle(i % 3 === 0 ? 0xfff0cd : 0xc9f3ee, 0.08 + 随机值(i + 131) * 0.12)
      .fillRoundedRect(x, y, 长, Math.max(1.2, 高 * 0.0032), 3);
  }
  // 前景深色潮水
  图形.fillStyle(0x1d4f6d, 0.55).fillRect(0, 高 * 0.92, 宽, 高 * 0.08);
  图形.fillStyle(0x9adcd8, 0.2).fillEllipse(宽 * 0.5, 高 * 0.93, 宽 * 0.9, 高 * 0.012);
}

function 绘制海面动画(
  图形: Phaser.GameObjects.Graphics,
  宽: number,
  高: number,
  时间: number,
): void {
  const 海平线 = 高 * 0.585;
  // 波光闪烁
  for (let i = 0; i < 30; i += 1) {
    const y = 海平线 + 随机值(i + 111) * (高 - 海平线) * 0.96;
    const 速度 = 14 + 随机值(i + 29) * 26;
    const 长 = 宽 * (0.02 + 随机值(i + 47) * 0.07);
    const x = ((随机值(i + 77) * 宽 + 时间 * 0.03 * 速度) % (宽 + 长)) - 长;
    const 闪 = 0.5 + Math.sin(时间 * 0.0016 + i * 1.7) * 0.5;
    图形
      .fillStyle(i % 4 === 0 ? 0xfff2cf : 0xdbfff6, 0.1 + 闪 * 0.22)
      .fillRoundedRect(x, y, 长, Math.max(1.5, 高 * 0.0032), 3);
  }
  // 漂浮光尘
  for (let i = 0; i < 12; i += 1) {
    const x = (随机值(i + 210) * 宽 + 时间 * (0.004 + 随机值(i + 250) * 0.01)) % 宽;
    const y = 高 * (0.2 + 随机值(i + 270) * 0.6) + Math.sin(时间 * 0.0004 + i) * 高 * 0.012;
    图形
      .fillStyle(0xfff4d8, 0.1 + 随机值(i + 290) * 0.12)
      .fillCircle(x, y, 1.6 + 随机值(i + 310) * 2.6);
  }
  绘制云层动画(图形, 宽, 高, 时间, 0xfffaf0, 0.3);
}

/* ------------------------------------------------------------------ */
/* 云海山岚                                                            */
/* ------------------------------------------------------------------ */

function 绘制山岚底图(图形: Phaser.GameObjects.Graphics, 宽: number, 高: number): void {
  const 地平线 = 高 * 0.72;
  绘制天幕(图形, 宽, 0, 地平线 + 4, [0x2f6fae, 0x69a6cf, 0xb9d7e2, 0xeee6d2]);
  绘制日轮(图形, 宽 * 0.79, 高 * 0.2, Math.min(宽, 高) * 0.055, 0xfff6dd, 0xffe9c0, 0.85);
  绘制云朵(图形, 宽 * 0.2, 高 * 0.16, 宽 * 0.085, 0xffffff, 0xc4d8e6, 0.82);
  绘制云朵(图形, 宽 * 0.52, 高 * 0.26, 宽 * 0.065, 0xffffff, 0xc0d4e2, 0.6);
  绘制云朵(图形, 宽 * 0.85, 高 * 0.42, 宽 * 0.075, 0xfff8ea, 0xbdd2e0, 0.5);
  // 多层远山：空气透视由浅入深，层间拉大明度差
  绘制山脊(图形, 宽, 高 * 0.62, 0xb2cddd, 高 * 0.2, 17, 0xeff2ea);
  绘制山脊(图形, 宽, 高 * 0.72, 0x7c9db8, 高 * 0.26, 41, 0xe2ebe7);
  绘制山脊(图形, 宽, 高 * 0.84, 0x4a6880, 高 * 0.3, 73, 0xcddfdb);
  绘制山脊(图形, 宽, 高 * 0.98, 0x2a4a5c, 高 * 0.34, 109);
  // 山间云海
  for (let i = 0; i < 7; i += 1) {
    const y = 高 * (0.56 + 随机值(i + 7) * 0.3);
    图形
      .fillStyle(0xf2f7f5, 0.16 + 随机值(i + 19) * 0.16)
      .fillEllipse(
        宽 * (随机值(i + 31) * 1.1 - 0.05),
        y,
        宽 * (0.2 + 随机值(i + 43) * 0.3),
        高 * 0.035,
      );
  }
  图形.fillStyle(0x24414f, 0.5).fillRect(0, 高 * 0.95, 宽, 高 * 0.05);
}

function 绘制云层动画(
  图形: Phaser.GameObjects.Graphics,
  宽: number,
  高: number,
  时间: number,
  颜色 = 0xffffff,
  透明度 = 0.5,
): void {
  for (let i = 0; i < 5; i += 1) {
    const 尺寸 = 宽 * (0.05 + 随机值(i + 81) * 0.06);
    const x =
      ((随机值(i + 17) * (宽 + 尺寸 * 3) + 时间 * (0.004 + i * 0.0016)) % (宽 + 尺寸 * 3)) -
      尺寸 * 1.5;
    const y = 高 * (0.12 + 随机值(i + 41) * 0.3);
    绘制云朵(图形, x, y, 尺寸, 颜色, 混色(颜色, 0x6d87a8, 0.45), 透明度);
  }
}

/* ------------------------------------------------------------------ */
/* 极光原野                                                            */
/* ------------------------------------------------------------------ */

function 绘制原野底图(图形: Phaser.GameObjects.Graphics, 宽: number, 高: number): void {
  const 地平线 = 高 * 0.68;
  绘制天幕(图形, 宽, 0, 地平线 + 4, [0x050c1e, 0x0a1f3e, 0x14456b, 0x2c7f8c]);
  绘制星野(图形, 宽, 高, 110, 500);
  // 月亮
  const 月X = 宽 * 0.2;
  const 月Y = 高 * 0.18;
  绘制光晕(图形, 月X, 月Y, Math.min(宽, 高) * 0.05, 0xbfe6ff, 1.25, 8);
  图形.fillStyle(0xe9f4ff, 0.95).fillCircle(月X, 月Y, Math.min(宽, 高) * 0.034);
  图形.fillStyle(0xc7dcf2, 0.55).fillCircle(月X - 4, 月Y - 3, Math.min(宽, 高) * 0.02);
  图形.fillStyle(0xffffff, 0.34).fillCircle(月X - 2, 月Y - 2, Math.min(宽, 高) * 0.024);
  // 静态极光帘幕（双遍重叠消除条纹）
  const 极光色 = [0x3ff0c0, 0x4de3d8, 0x7ad9ff, 0xa98cff];
  for (let 条 = 0; 条 < 4; 条 += 1) {
    const 色 = 极光色[条] ?? 0x4de3d8;
    const 基Y = 高 * (0.16 + 条 * 0.055);
    for (let 两遍 = 0; 两遍 < 2; 两遍 += 1) {
      const 步长 = Math.max(10, 宽 / (40 + 两遍 * 28));
      const 偏移 = 两遍 === 1 ? 步长 * 0.5 : 0;
      for (let x = -步长; x < 宽 + 步长; x += 步长) {
        const nx = x / 宽;
        const 波 = Math.sin(nx * 5.2 + 条 * 1.9) * 高 * 0.05 + Math.sin(nx * 11 + 条) * 高 * 0.018;
        const 顶 = 基Y + 波;
        const 帘高 = 高 * (0.14 + 0.06 * Math.sin(nx * 6.5 + 条 * 2.2));
        const α = (两遍 === 0 ? 0.07 : 0.038) * (0.82 + 0.18 * Math.sin(nx * 4.2 + 条));
        图形.fillGradientStyle(色, 色, 色, 色, α, α, 0, 0).fillRect(x + 偏移, 顶, 步长 + 1, 帘高);
      }
    }
  }
  // 地面：丘陵与湖面
  绘制山脊(图形, 宽, 地平线 + 高 * 0.02, 0x123048, 高 * 0.09, 211);
  图形.fillStyle(0x0a1c30, 1).fillRect(0, 地平线, 宽, 高 - 地平线);
  // 湖面倒影
  const 湖顶 = 地平线 + 高 * 0.045;
  图形.fillStyle(0x102c44, 0.9).fillRect(0, 湖顶, 宽, 高 * 0.2);
  for (let 条 = 0; 条 < 3; 条 += 1) {
    const 色 = 极光色[条] ?? 0x4de3d8;
    图形.fillStyle(色, 0.07).fillRect(宽 * (0.1 + 条 * 0.22), 湖顶, 宽 * 0.16, 高 * 0.17);
  }
  for (let i = 0; i < 12; i += 1) {
    const y = 湖顶 + 随机值(i + 811) * 高 * 0.18;
    图形
      .fillStyle(i % 2 ? 0x9be8e0 : 0x86c7ff, 0.1 + 随机值(i + 833) * 0.12)
      .fillRoundedRect(随机值(i + 855) * 宽, y, 宽 * (0.04 + 随机值(i + 877) * 0.1), 1.6, 2);
  }
  // 前景草坡
  图形.fillStyle(0x081726, 1).fillEllipse(宽 * 0.5, 高 * 1.02, 宽 * 1.45, 高 * 0.3);
  图形.fillStyle(0x0d2236, 1).fillEllipse(宽 * 0.12, 高 * 1.0, 宽 * 0.9, 高 * 0.22);
}

function 绘制极光动画(
  图形: Phaser.GameObjects.Graphics,
  宽: number,
  高: number,
  时间: number,
): void {
  const 极光色 = [0x3ff0c0, 0x4de3d8, 0x7ad9ff, 0xa98cff];
  for (let 条 = 0; 条 < 3; 条 += 1) {
    const 色 = 极光色[条] ?? 0x4de3d8;
    const 基Y = 高 * (0.12 + 条 * 0.05);
    // 双遍重叠窄条 + 垂直渐变，消除竖直条纹
    for (let 两遍 = 0; 两遍 < 2; 两遍 += 1) {
      const 步长 = Math.max(10, 宽 / (44 + 两遍 * 28));
      const 偏移 = 两遍 === 1 ? 步长 * 0.5 : 0;
      for (let x = -步长; x < 宽 + 步长; x += 步长) {
        const nx = x / 宽;
        const 波 =
          Math.sin(nx * 5.2 + 条 * 1.9 + 时间 * 0.00022) * 高 * 0.05 +
          Math.sin(nx * 11 + 时间 * 0.00035) * 高 * 0.02;
        const 顶 = 基Y + 波;
        const 帘高 = 高 * (0.12 + 0.07 * Math.sin(nx * 6.5 + 条 * 2.2 + 时间 * 0.0003));
        const α =
          (两遍 === 0 ? 0.052 : 0.03) * (0.8 + 0.2 * Math.sin(nx * 4.2 + 时间 * 0.0005 + 条));
        图形.fillGradientStyle(色, 色, 色, 色, α, α, 0, 0).fillRect(x + 偏移, 顶, 步长 + 1, 帘高);
      }
    }
  }
  // 星光闪烁
  for (let i = 0; i < 26; i += 1) {
    const 闪 = 0.5 + 0.5 * Math.sin(时间 * (0.0008 + 随机值(i + 61) * 0.0012) + i);
    图形
      .fillStyle(0xffffff, 0.12 + 闪 * 0.3)
      .fillCircle(随机值(i + 401) * 宽, 随机值(i + 431) * 高 * 0.55, 0.8 + 随机值(i + 461) * 1.2);
  }
  // 湖面萤火
  for (let i = 0; i < 14; i += 1) {
    const x = (随机值(i + 501) * 宽 + Math.sin(时间 * 0.0004 + i) * 宽 * 0.03) % 宽;
    const y = 高 * (0.72 + 随机值(i + 531) * 0.22) + Math.sin(时间 * 0.0006 + i * 2) * 高 * 0.015;
    图形
      .fillStyle(0xa8ffd9, 0.16 + 随机值(i + 561) * 0.22)
      .fillCircle(x, y, 1.4 + 随机值(i + 591) * 2);
  }
}

/* ------------------------------------------------------------------ */
/* 霓虹天际                                                            */
/* ------------------------------------------------------------------ */

function 绘制天际底图(图形: Phaser.GameObjects.Graphics, 宽: number, 高: number): void {
  const 地平线 = 高 * 0.62;
  绘制天幕(图形, 宽, 0, 地平线 + 4, [0x221045, 0x4c2072, 0x94387c, 0xe4698a, 0xffb070]);
  // 落日
  const 日X = 宽 * 0.58;
  const 日Y = 高 * 0.5;
  绘制日轮(图形, 日X, 日Y, Math.min(宽, 高) * 0.085, 0xffd9a0, 0xff9e64, 1.1);
  绘制云朵(图形, 宽 * 0.2, 高 * 0.24, 宽 * 0.08, 0xffc3b4, 0x8c4a80, 0.5);
  绘制云朵(图形, 宽 * 0.82, 高 * 0.18, 宽 * 0.065, 0xffb8a8, 0x7d447e, 0.42);
  // 远景剪影楼群
  for (let i = 0; i < 30; i += 1) {
    const 楼宽 = 宽 * (0.02 + 随机值(i + 7) * 0.036);
    const x = 随机值(i + 71) * 宽;
    const 楼高 = 高 * (0.1 + 随机值(i + 31) * 0.2);
    图形.fillStyle(0x4a2a63, 0.85).fillRect(x, 地平线 - 楼高, 楼宽, 楼高);
  }
  // 近景霓虹楼群
  for (let i = 0; i < 22; i += 1) {
    const 楼宽 = 宽 * (0.03 + 随机值(i + 17) * 0.05);
    const x = 随机值(i + 91) * 宽;
    const 楼高 = 高 * (0.14 + 随机值(i + 53) * 0.3);
    const y = 地平线 - 楼高 + 高 * 0.035;
    图形.fillStyle(i % 2 ? 0x241743 : 0x2c1c4e, 1).fillRect(x, y, 楼宽, 楼高 + 高 * 0.1);
    // 楼顶霓虹
    图形
      .lineStyle(1.6, i % 3 === 0 ? 0xff5fa2 : i % 3 === 1 ? 0x5fe9ff : 0xffd166, 0.75)
      .lineBetween(x, y, x + 楼宽, y);
    // 亮窗（数量收敛、色温统一为暖黄/青白）
    for (let 行 = 0; 行 < 9; 行 += 1) {
      for (let 列 = 0; 列 < 3; 列 += 1) {
        if (随机值(i * 37 + 行 * 11 + 列 * 5 + 3) > 0.66) {
          const 窗色 = (行 + 列) % 3 === 0 ? 0xffd48a : (行 + 列) % 3 === 1 ? 0x7ef0ff : 0xffe6bb;
          图形
            .fillStyle(窗色, 0.24 + 随机值(i * 53 + 行 * 7 + 列) * 0.32)
            .fillRect(
              x + 楼宽 * (0.18 + 列 * 0.28),
              y + 10 + 行 * (高 * 0.017),
              Math.max(2, 楼宽 * 0.16),
              Math.max(2, 高 * 0.008),
            );
        }
      }
    }
  }
  // 街面反光（渐变上淡，与建筑呼应）
  图形.fillStyle(0x1a1030, 1).fillRect(0, 地平线 + 高 * 0.035, 宽, 高);
  for (let i = 0; i < 12; i += 1) {
    const x = 随机值(i + 601) * 宽;
    const 色 = i % 3 === 0 ? 0xff5fa2 : i % 3 === 1 ? 0x5fe9ff : 0xffb070;
    图形
      .fillGradientStyle(色, 色, 色, 色, 0.16, 0.16, 0, 0)
      .fillRoundedRect(x, 地平线 + 高 * 0.06, 宽 * 0.014, 高 * (0.1 + 随机值(i + 661) * 0.18), 6);
  }
  图形.fillStyle(0x120a26, 0.85).fillRect(0, 高 * 0.94, 宽, 高 * 0.06);
}

function 绘制城市动画(
  图形: Phaser.GameObjects.Graphics,
  宽: number,
  高: number,
  时间: number,
): void {
  const 地平线 = 高 * 0.62;
  // 车流光轨
  for (let i = 0; i < 7; i += 1) {
    const y = 地平线 + 高 * (0.08 + i * 0.035);
    const 速度 = 0.06 + 随机值(i + 71) * 0.12;
    const x = ((随机值(i + 91) * 宽 + 时间 * 速度) % (宽 + 260)) - 260;
    const 色 = i % 2 ? 0xff5f8f : 0x7ee8ff;
    for (let 段 = 0; 段 < 4; 段 += 1) {
      图形.fillStyle(色, 0.22 - 段 * 0.045).fillRoundedRect(x - 段 * 72, y, 88, 2.6, 2);
    }
  }
  // 楼宇灯光闪烁
  for (let i = 0; i < 18; i += 1) {
    const 闪 = 0.5 + 0.5 * Math.sin(时间 * (0.0006 + 随机值(i + 13) * 0.0012) + i * 2.3);
    图形
      .fillStyle(i % 2 ? 0xffd48a : 0x7ef0ff, 0.1 + 闪 * 0.22)
      .fillCircle(
        随机值(i + 131) * 宽,
        地平线 - 随机值(i + 161) * 高 * 0.3,
        1.8 + 随机值(i + 191) * 2.4,
      );
  }
  // 探照光束
  const 束X = 宽 * (0.22 + 0.16 * Math.sin(时间 * 0.00018));
  图形
    .fillStyle(0x9fe8ff, 0.05)
    .fillTriangle(束X, 0, 束X - 宽 * 0.1, 地平线, 束X + 宽 * 0.1, 地平线);
  // 霓虹光尘
  for (let i = 0; i < 12; i += 1) {
    const x = (随机值(i + 231) * 宽 + 时间 * 0.006) % 宽;
    const y = 高 * (0.3 + 随机值(i + 261) * 0.5) + Math.sin(时间 * 0.0005 + i) * 高 * 0.014;
    图形
      .fillStyle(i % 2 ? 0xff9ed8 : 0x7ee8ff, 0.1 + 随机值(i + 291) * 0.14)
      .fillCircle(x, y, 1.6 + 随机值(i + 321) * 2.4);
  }
}
