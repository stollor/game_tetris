import { 亮色 } from "../../../框架/界面/颜色工具";
import type { 图形对象 } from "../../../组件/绘制/图形对象";

/**
 * 背景配方的共用绘制原语：天幕、光晕、日轮、云朵、山脊、星野、暗角。
 * 只依赖 `图形对象` 契约，Phaser 与 Three 共用；数值与原 Phaser 版逐字一致。
 */

/** 确定性伪随机：同一索引永远同一值，保证烘焙、重绘与两版后端画面稳定。 */
export const 随机值 = (索引: number): number => {
  const 值 = Math.sin(索引 * 127.1 + 311.7) * 43758.5453123;
  return 值 - Math.floor(值);
};

/** 多段垂直渐变天幕：逐段双色渐变，无色带。 */
export function 绘制天幕(绘图: 图形对象, 宽: number, 顶: number, 底: number, 色标: number[]): void {
  const 高 = 底 - 顶;
  if (高 <= 0) return;
  const 段数 = Math.max(1, 色标.length - 1);
  for (let 段 = 0; 段 < 段数; 段 += 1) {
    const y0 = 顶 + (高 * 段) / 段数;
    const y1 = 顶 + (高 * (段 + 1)) / 段数;
    const 起色 = 色标[段] ?? 0;
    const 止色 = 色标[段 + 1] ?? 起色;
    绘图
      .fillGradientStyle(起色, 起色, 止色, 止色, 1, 1, 1, 1)
      .fillRect(0, y0 - 0.5, 宽, y1 - y0 + 1.5);
  }
}

/** 柔和径向光晕：多层同心圆模拟泛光。 */
export function 绘制光晕(
  绘图: 图形对象,
  x: number,
  y: number,
  半径: number,
  色: number,
  强度 = 1,
  层 = 6,
): void {
  // 外圈再扩大就几乎看不见，包围盒却会空出一大圈。收到大约两倍半径。
  const 外层 = Math.min(层, 4);
  for (let i = 外层; i >= 1; i -= 1) {
    绘图
      .fillStyle(色, 0.02 * 强度 * (1 - (i - 1) / (外层 + 1)))
      .fillCircle(x, y, 半径 * (1 + i * 0.28));
  }
}

/** 日轮：光晕 + 内核 + 受光顶面 + 放射光芒 + 水平光带。 */
export function 绘制日轮(
  绘图: 图形对象,
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
    绘图
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
  绘制光晕(绘图, x, y, 半径, 光色, 0.9 * 强度, 8);
  绘图.fillStyle(光色, 0.3 * 强度).fillCircle(x, y, 半径 * 1.22);
  绘图.fillStyle(核色, 1).fillCircle(x, y, 半径);
  绘图.fillStyle(亮色(核色, 0.55), 0.85).fillCircle(x, y - 半径 * 0.16, 半径 * 0.82);
  绘图.fillStyle(0xffffff, 0.22 * 强度).fillEllipse(x, y, 半径 * 2.2, 半径 * 0.09);
  绘图.fillStyle(光色, 0.12 * 强度).fillEllipse(x, y, 半径 * 3.8, 半径 * 0.16);
}

/** 蓬松积云：多层低透明度椭圆递进，柔化边缘；底部仅留极淡阴影。 */
export function 绘制云朵(
  绘图: 图形对象,
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
    绘图
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
    绘图
      .fillStyle(亮部, 透明度 * 0.2)
      .fillEllipse(x + 偏X * 尺寸, y + 偏Y * 尺寸, 尺寸 * 1.42 * 半径, 尺寸 * 0.66 * 半径);
  }
  for (const [偏X, 偏Y, 半径] of 团) {
    绘图
      .fillStyle(亮部, 透明度 * 0.52)
      .fillEllipse(
        x + 偏X * 尺寸,
        y + 偏Y * 尺寸 - 尺寸 * 0.03,
        尺寸 * 1.16 * 半径,
        尺寸 * 0.52 * 半径,
      );
  }
  for (const [偏X, 偏Y, 半径] of 团) {
    绘图
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
export function 绘制山脊(
  绘图: 图形对象,
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
  绘图.fillStyle(颜色, 1);
  绘图.beginPath();
  绘图.moveTo(-步长, 底部);
  for (let i = -1; i <= 6; i += 1) {
    const x = i * 步长;
    const 峰高 = 峰[i + 1] ?? 高度比例 * 0.6;
    绘图.lineTo(x + 步长 * 0.42, 底部 - 峰高);
    绘图.lineTo(x + 步长 * 1.35, 底部 - 峰高 * 0.42);
  }
  绘图.lineTo(宽 + 步长, 底部);
  绘图.closePath();
  绘图.fillPath();
  // 受光棱线（低调，避免硬折角过强）
  绘图.lineStyle(1, 亮色(颜色, 0.3), 0.3);
  绘图.beginPath();
  for (let i = -1; i <= 6; i += 1) {
    const x = i * 步长;
    const 峰高 = 峰[i + 1] ?? 高度比例 * 0.6;
    if (i === -1) 绘图.moveTo(x + 步长 * 0.42, 底部 - 峰高);
    else {
      绘图.lineTo(x + 步长 * 0.42, 底部 - 峰高);
      绘图.lineTo(x + 步长 * 1.35, 底部 - 峰高 * 0.42);
    }
  }
  绘图.strokePath();
  if (雾色 !== undefined) {
    // 山脚雾带：渐变上淡，避免生硬色块
    绘图
      .fillGradientStyle(雾色, 雾色, 雾色, 雾色, 0, 0, 0.22, 0.22)
      .fillRect(0, 底部 - 高度比例 * 0.3, 宽, 高度比例 * 0.38);
  }
}

/** 星野：大小与亮度错落的星点。 */
export function 绘制星野(绘图: 图形对象, 宽: number, 高: number, 数量: number, 偏移: number): void {
  for (let i = 0; i < 数量; i += 1) {
    const x = 随机值(i + 偏移) * 宽;
    const y = 随机值(i + 偏移 + 300) * 高 * 0.72;
    const 半径 = 0.5 + 随机值(i + 偏移 + 600) * 1.4;
    绘图.fillStyle(0xffffff, 0.18 + 随机值(i + 偏移 + 900) * 0.6).fillCircle(x, y, 半径);
    if (半径 > 1.4) {
      绘图
        .fillStyle(0xffffff, 0.16)
        .fillEllipse(x, y, 半径 * 5, 半径 * 0.7)
        .fillEllipse(x, y, 半径 * 0.7, 半径 * 5);
    }
  }
}

/** 画面暗角 + 顶部轻微压暗，统一视觉焦点。 */
export function 绘制暗角(绘图: 图形对象, 宽: number, 高: number): void {
  const 步数 = 14;
  for (let i = 0; i < 步数; i += 1) {
    const 比例 = i / 步数;
    const 透明度 = 0.028 * (1 - 比例);
    const 边 = 高 * 0.14 * (1 - 比例);
    绘图.fillStyle(0x04070f, 透明度 * 1.5).fillRect(0, 0, 宽, 边);
    绘图.fillStyle(0x04070f, 透明度 * 1.7).fillRect(0, 高 - 边, 宽, 边);
    const 侧 = 宽 * 0.09 * (1 - 比例);
    绘图.fillStyle(0x04070f, 透明度).fillRect(0, 0, 侧, 高);
    绘图.fillStyle(0x04070f, 透明度).fillRect(宽 - 侧, 0, 侧, 高);
  }
  // 四角加深
  const 角半径 = Math.min(宽, 高) * 0.55;
  for (const [角X, 角Y] of [
    [0, 0],
    [宽, 0],
    [0, 高],
    [宽, 高],
  ]) {
    绘图.fillStyle(0x04070f, 0.1).fillCircle(角X, 角Y, 角半径);
    绘图.fillStyle(0x04070f, 0.1).fillCircle(角X, 角Y, 角半径 * 0.72);
    绘图.fillStyle(0x04070f, 0.1).fillCircle(角X, 角Y, 角半径 * 0.48);
  }
}
