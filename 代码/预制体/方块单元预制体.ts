import type Phaser from "phaser";
import { 亮色, 暗色 } from "../../框架/组件/Phaser界面/颜色工具";

export interface 方块单元外观 {
  色值: number;
  格子: number;
  透明度?: number;
  圆角比例?: number;
  /** 幽灵投影：只画轮廓与微弱填充。 */
  幽灵?: boolean;
}

/**
 * 统一绘制棋盘格、预览块和原型块使用的程序化方块单元。
 * 宝石质感：外圈暗色包边、受光主体、顶部高光与底部背光，形成斜面体积。
 */
export function 绘制方块单元预制体(
  绘图: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  外观: 方块单元外观,
): void {
  const 格子 = 外观.格子;
  const 透明度 = 外观.透明度 ?? 1;
  const 圆角 = Math.max(2, 格子 * (外观.圆角比例 ?? 0.15));
  if (外观.幽灵) {
    绘制幽灵单元(绘图, x, y, 格子, 圆角, 外观.色值, 透明度);
    return;
  }
  const 色值 = 外观.色值;
  const 深 = 暗色(色值, 0.52);
  const 内缩 = Math.max(1, 格子 * 0.07);
  // 底部柔影，让方块浮在格面上
  绘图.fillStyle(0x000000, 0.32 * 透明度).fillRoundedRect(x + 1, y + 2.5, 格子 - 1, 格子 - 1, 圆角);
  // 外圈包边（深色），形成斜面外沿
  绘图.fillStyle(深, 0.96 * 透明度).fillRoundedRect(x, y, 格子 - 1, 格子 - 1, 圆角);
  // 主体受光面
  绘图
    .fillStyle(色值, 0.98 * 透明度)
    .fillRoundedRect(x + 内缩, y + 内缩, 格子 - 1 - 内缩 * 2, 格子 - 1 - 内缩 * 2, 圆角 * 0.8);
  // 上半受光提亮
  const 内宽 = Math.max(0, 格子 - 1 - 内缩 * 2);
  绘图
    .fillStyle(亮色(色值, 0.34), 0.55 * 透明度)
    .fillRect(x + 内缩 + 圆角 * 0.6, y + 内缩 + 1, 内宽 - 圆角 * 1.2, (格子 - 1) * 0.34);
  // 顶部镜面高光
  绘图
    .fillStyle(0xffffff, 0.5 * 透明度)
    .fillRoundedRect(
      x + 格子 * 0.18,
      y + 格子 * 0.11,
      Math.max(1, 格子 * 0.42),
      Math.max(1, 格子 * 0.1),
      格子 * 0.05,
    );
  // 底部背光
  绘图
    .fillStyle(0x000000, 0.26 * 透明度)
    .fillRect(
      x + 内缩 + 圆角 * 0.6,
      y + 格子 - 2.5 - (格子 - 1) * 0.22,
      内宽 - 圆角 * 1.2,
      (格子 - 1) * 0.2,
    );
  // 内侧亮边
  绘图
    .lineStyle(1, 亮色(色值, 0.52), 0.5 * 透明度)
    .strokeRoundedRect(x + 内缩, y + 内缩, 格子 - 1 - 内缩 * 2, 格子 - 1 - 内缩 * 2, 圆角 * 0.8);
  // 外沿描边
  绘图
    .lineStyle(1, 亮色(色值, 0.24), 0.62 * 透明度)
    .strokeRoundedRect(x, y, 格子 - 1, 格子 - 1, 圆角);
}

/** 幽灵投影：极弱轮廓提示落点，不与实块抢眼。 */
function 绘制幽灵单元(
  绘图: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  格子: number,
  圆角: number,
  色值: number,
  透明度: number,
): void {
  const 内缩 = Math.max(1, 格子 * 0.11);
  绘图
    .fillStyle(色值, 0.04 * 透明度)
    .fillRoundedRect(x + 内缩, y + 内缩, 格子 - 1 - 内缩 * 2, 格子 - 1 - 内缩 * 2, 圆角);
  绘图
    .lineStyle(1, 色值, 0.2 * 透明度)
    .strokeRoundedRect(x + 内缩, y + 内缩, 格子 - 1 - 内缩 * 2, 格子 - 1 - 内缩 * 2, 圆角);
  // 只在左上/右下留两个短角标，弱化提示
  const 角 = Math.max(2, 格子 * 0.13);
  for (const [角X, 角Y, 水平, 垂直] of [
    [x + 内缩, y + 内缩, 1, 1],
    [x + 格子 - 1 - 内缩 - 角, y + 格子 - 1 - 内缩 - 角, -1, -1],
  ] as [number, number, number, number][]) {
    绘图
      .fillStyle(色值, 0.2 * 透明度)
      .fillRect(水平 > 0 ? 角X : 角X, 角Y, 角, 1.5)
      .fillRect(角X, 垂直 > 0 ? 角Y : 角Y, 1.5, 角);
  }
}

/**
 * 绘制方块外圈辉光（建议画在混合模式为 ADD 的图层上，得到霓虹泛光）。
 * 与 绘制方块单元预制体 配套使用，位置尺寸保持一致。
 */
export function 绘制方块辉光(
  绘图: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  外观: 方块单元外观,
): void {
  const 格子 = 外观.格子;
  const 透明度 = 外观.透明度 ?? 1;
  const 圆角 = Math.max(2, 格子 * (外观.圆角比例 ?? 0.15));
  for (let 层 = 0; 层 < 3; 层 += 1) {
    const 外扩 = 1 + 层 * 2.2;
    绘图
      .fillStyle(亮色(外观.色值, 0.18), (0.12 - 层 * 0.035) * 透明度)
      .fillRoundedRect(x - 外扩, y - 外扩, 格子 - 1 + 外扩 * 2, 格子 - 1 + 外扩 * 2, 圆角 + 外扩);
  }
}
