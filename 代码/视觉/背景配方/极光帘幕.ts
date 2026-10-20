import type { 图形对象 } from "../../../组件/绘制/图形对象";

/** 极光帘幕配色（动态演出的三条帘幕），与原 Phaser 版一致。 */
export const 极光帘幕色 = [0x3ff0c0, 0x4de3d8, 0x7ad9ff] as const;

/**
 * 极光帘幕：双遍错位渐变矩形模拟飘动帘幕。
 * - 时间毫秒：与原 Phaser 版同一时间轴（正弦项系数按毫秒写死，保持逐字一致）。
 * - 亮度：单画布合成时的图层亮度乘子；Phaser 侧用图层对象 alpha，传默认 1。
 */
export function 绘制极光帘幕(
  绘图: 图形对象,
  宽: number,
  高: number,
  时间毫秒: number,
  条: number,
  亮度 = 1,
): void {
  const 色 = 极光帘幕色[条] ?? 0x4de3d8;
  const 基Y = 高 * (0.12 + 条 * 0.05);
  for (let 遍 = 0; 遍 < 2; 遍++) {
    const 步长 = Math.max(10, 宽 / (44 + 遍 * 28));
    const 偏移 = 遍 === 1 ? 步长 * 0.5 : 0;
    for (let x = -步长; x < 宽 + 步长; x += 步长) {
      const nx = x / 宽;
      const 顶 =
        基Y +
        Math.sin(nx * 5.2 + 条 * 1.9 + 时间毫秒 * 0.00022) * 高 * 0.05 +
        Math.sin(nx * 11 + 时间毫秒 * 0.00035) * 高 * 0.02;
      const 帘高 = 高 * (0.12 + 0.07 * Math.sin(nx * 6.5 + 条 * 2.2 + 时间毫秒 * 0.0003));
      const 淡 =
        (遍 === 0 ? 0.052 : 0.03) *
        (0.8 + 0.2 * Math.sin(nx * 4.2 + 时间毫秒 * 0.0005 + 条)) *
        亮度;
      绘图.fillGradientStyle(色, 色, 色, 色, 淡, 淡, 0, 0).fillRect(x + 偏移, 顶, 步长 + 1, 帘高);
    }
  }
}
