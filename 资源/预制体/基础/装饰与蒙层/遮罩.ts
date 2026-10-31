import type { 图形对象 } from "../../../../.gamemaker/依赖/框架/界面/绘制/协议";

/** 全屏遮罩（弹层/覆盖页）。 */
export function 绘制遮罩(
  绘图: 图形对象,
  宽: number,
  高: number,
  颜色: number,
  透明度: number,
): void {
  绘图.fillStyle(颜色, 透明度).fillRect(0, 0, 宽, 高);
}
