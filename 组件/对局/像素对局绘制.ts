import { 像素规范 } from "../../主题/像素/像素规范";
import { 对局像素规格 } from "../../主题/像素/对局像素规格";
import type { 图形对象 } from "../../框架/界面/绘制/协议";
import { 绘制像素图案, 绘制像素面板 } from "../基础/像素绘制";

export function 绘制糖果方块(
  图: 图形对象,
  x: number,
  y: number,
  格: number,
  色: number,
  透明度 = 1,
  幽灵 = false,
): void {
  const 规 = 对局像素规格.方块;
  const p = Math.max(1, Math.round(格 * 规.边比例));
  const 宽 = Math.max(1, Math.round(格) - 规.间隔);
  x = Math.round(x);
  y = Math.round(y);
  图.save().setAlpha(透明度);
  if (幽灵) {
    图.fillStyle(像素规范.色.暗);
    for (const [左, 上] of [
      [x, y],
      [x + 宽 - p * 2, y],
      [x, y + 宽 - p * 2],
      [x + 宽 - p * 2, y + 宽 - p * 2],
    ])
      图.fillRect(左, 上, p * 2, p * 2);
    图.restore();
    return;
  }
  图.fillStyle(像素规范.色.壳).fillRect(x, y, 宽, 宽);
  图
    .fillStyle(像素规范.方块填井 ? 像素规范.色.底 : 色)
    .fillRect(x + p, y + p, Math.max(0, 宽 - p * 2), Math.max(0, 宽 - p * 2));
  const 序 = Object.values<number>(像素规范.方块).indexOf(色);
  const 图案 = 规.图案[Math.max(0, 序) % 规.图案.length];
  const 单位 = Math.max(1, Math.floor(格 * 规.图案比例));
  const 图宽 = 图案[0].length * 单位;
  绘制像素图案(
    图,
    图案,
    x + Math.floor((宽 - 图宽) / 2),
    y + Math.floor((宽 - 图案.length * 单位) / 2),
    单位,
    像素规范.方块填井 ? 色 : 像素规范.色.壳,
  );
  图.restore();
}

export function 绘制像素操作键(
  图: 图形对象,
  名称: string,
  x: number,
  y: number,
  宽: number,
  高: number,
  按下 = false,
  角键 = false,
): void {
  const 规 = 对局像素规格.操作;
  const 色 = 名称 === "软降" ? 像素规范.色.亮 : 像素规范.深色 ? 像素规范.色.纸 : 像素规范.色.底;
  const 沉 = 按下 ? 像素规范.描边 : 0;
  绘制像素面板(图, x, y + 沉, 宽, 高 - 沉, 按下 ? 像素规范.色.暗纸 : 色, 像素规范.色.暗, 按下);
  const 图案 = Object.entries(规.图案).find(([键]) => 键 === 名称)?.[1];
  if (!图案) return;
  const 格 = 角键 ? 规.角键图案格 : 规.图案格;
  绘制像素图案(
    图,
    图案,
    x + (宽 - 图案[0].length * 格) / 2,
    y + 沉 + (高 - 图案.length * 格) / 2,
    格,
    像素规范.深色
      ? 名称 === "软降" && !按下
        ? 像素规范.色.夜
        : 像素规范.色.墨
      : 按下
        ? 像素规范.色.底
        : 像素规范.色.墨,
  );
}
