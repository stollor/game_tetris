import { 像素规范 } from "../../../主题/像素/像素规范";
import type { 图形对象 } from "../../../框架/界面/绘制/协议";

export function 绘制像素图案(
  图: 图形对象,
  行列: readonly string[],
  x: number,
  y: number,
  格: number,
  色: number = 像素规范.色.墨,
): void {
  图.fillStyle(色);
  for (const [行, 文] of 行列.entries())
    for (let 列 = 0; 列 < 文.length; 列++) {
      if (文[列] !== " " && 文[列] !== ".")
        图.fillRect(Math.round(x + 列 * 格), Math.round(y + 行 * 格), Math.ceil(格), Math.ceil(格));
    }
}
