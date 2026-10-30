import { 是像素风格 } from "../../主题/像素/像素风格";
import { 是立体风格 } from "../../主题/立体/立体风格";
import type { 图形对象 } from "../../框架/界面/绘制/协议";

/**
 * 面板下方的多层柔影（与 GM 框架同算法）。
 * @共享效果 矩形底层
 */
export function 绘制柔影(
  绘图: 图形对象,
  x: number,
  y: number,
  宽: number,
  高: number,
  圆角: number,
  强度 = 1,
): void {
  if (是像素风格() || 是立体风格()) return;
  for (let 层 = 0; 层 < 3; 层 += 1) {
    绘图
      .fillStyle(0x050912, (0.17 - 层 * 0.05) * 强度)
      .fillRoundedRect(x - 层 * 2.5, y + 3 + 层 * 5, 宽 + 层 * 5, 高 + 层 * 4, 圆角 + 层 * 3);
  }
}
