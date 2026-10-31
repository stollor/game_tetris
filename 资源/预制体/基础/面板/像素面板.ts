import { 像素规范 } from "../../../主题/像素/像素规范";
import type { 图形对象 } from "../../../../.gamemaker/依赖/框架/界面/绘制/协议";

/** 液晶窗：墨框 + 平涂井。没有阶梯高光，也没有投影。 */
export function 绘制像素面板(
  图: 图形对象,
  左: number,
  上: number,
  宽: number,
  高: number,
  填色: number = 像素规范.色.底,
  强调: number = 像素规范.色.暗,
  按下 = false,
): void {
  const p = 像素规范.描边;
  const x = Math.round(左);
  const y = Math.round(上);
  const w = Math.round(宽);
  const h = Math.round(高);
  图.fillStyle(像素规范.色.墨).fillRect(x, y, w, h);
  图
    .fillStyle(按下 ? 像素规范.色.暗 : 填色)
    .fillRect(x + p, y + p, Math.max(0, w - p * 2), Math.max(0, h - p * 2));
  if (!按下 && 强调 !== 填色) {
    图.fillStyle(强调).fillRect(x + p, y + h - p * 2, Math.max(0, w - p * 2), p);
  }
}
