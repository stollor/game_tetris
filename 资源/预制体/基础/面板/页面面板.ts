import { 是像素风格 } from "../../../主题/像素/像素风格";
import { 是立体风格 } from "../../../主题/立体/立体风格";
import type { 图形对象, 矩形 } from "../../../../.gamemaker/依赖/框架/界面/绘制/协议";
import { 绘制像素面板 } from "./像素面板";
import { 绘制金属板 } from "./金属板";

/** 页面面板：实色底 + 细描边（设置页中央面板的现行视觉）。 */
export function 绘制页面面板(
  绘图: 图形对象,
  矩形: 矩形,
  填充色: number,
  描边色: number,
  描边透明度 = 0.75,
  圆角 = 0,
): void {
  if (是像素风格()) {
    绘制像素面板(绘图, 矩形.左, 矩形.上, 矩形.宽, 矩形.高, 填充色, 描边色);
    return;
  }
  if (是立体风格()) {
    绘制金属板(绘图, 矩形.左, 矩形.上, 矩形.宽, 矩形.高, { 切: 圆角 > 0 ? 圆角 : undefined });
    return;
  }
  if (圆角 > 0) {
    绘图.fillStyle(填充色, 0.98).fillRoundedRect(矩形.左, 矩形.上, 矩形.宽, 矩形.高, 圆角);
    绘图
      .lineStyle(1, 描边色, 描边透明度)
      .strokeRoundedRect(矩形.左, 矩形.上, 矩形.宽, 矩形.高, 圆角);
    return;
  }
  绘图.fillStyle(填充色, 0.98).fillRect(矩形.左, 矩形.上, 矩形.宽, 矩形.高);
  绘图.lineStyle(1, 描边色, 描边透明度).strokeRect(矩形.左, 矩形.上, 矩形.宽, 矩形.高);
}
