import type { 图形对象 } from "../../../框架/界面/绘制/协议";
import { 像素规范 } from "../../主题/像素/像素规范";

/** 掌机胶壳套液晶井。没有风景、没有极光。 */
export function 绘制像素背景(图: 图形对象, 宽: number, 高: number): void {
  const { 壳, 暗, 底 } = 像素规范.色;
  const 外 = 像素规范.外壳.外框;
  const 内 = 像素规范.外壳.内框;
  图.fillStyle(壳).fillRect(0, 0, 宽, 高);
  图.fillStyle(暗).fillRect(外, 外, Math.max(0, 宽 - 外 * 2), Math.max(0, 高 - 外 * 2));
  图
    .fillStyle(底)
    .fillRect(外 + 内, 外 + 内, Math.max(0, 宽 - (外 + 内) * 2), Math.max(0, 高 - (外 + 内) * 2));
}

export function 绘制像素背景动态(图: 图形对象, 宽: number, 高: number, 时间秒: number): void {
  const 外 = 像素规范.外壳.外框 + 像素规范.外壳.内框;
  const 井高 = Math.max(像素规范.网格, 高 - 外 * 2);
  const 拍 = Math.floor(时间秒 * 像素规范.动画步频);
  const y = 外 + ((拍 * 像素规范.网格) % 井高);
  图.fillStyle(像素规范.色.亮).fillRect(外, y, Math.max(0, 宽 - 外 * 2), 像素规范.网格);
}
