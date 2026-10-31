import { 像素规范 } from "../../主题/像素/像素规范";
import type { 图形对象 } from "../../../.gamemaker/依赖/框架/界面/绘制/协议";
import { 绘制街机彩砖背景, 绘制街机彩砖背景动态 } from "./街机彩砖背景";

/** 掌机胶壳套液晶井。没有风景、没有极光。 */
function 绘制液晶背景(图: 图形对象, 宽: number, 高: number): void {
  const { 壳, 暗, 底 } = 像素规范.色;
  const 外 = 像素规范.外壳.外框;
  const 内 = 像素规范.外壳.内框;
  图.fillStyle(壳).fillRect(0, 0, 宽, 高);
  图.fillStyle(暗).fillRect(外, 外, Math.max(0, 宽 - 外 * 2), Math.max(0, 高 - 外 * 2));
  图
    .fillStyle(底)
    .fillRect(外 + 内, 外 + 内, Math.max(0, 宽 - (外 + 内) * 2), Math.max(0, 高 - (外 + 内) * 2));
}

/** 像素主题共用的背景入口：按当前像素规范分到液晶掌机或街机彩砖后景。 */
export function 绘制像素背景(图: 图形对象, 宽: number, 高: number): void {
  if (像素规范.名称 === "街机彩砖") {
    绘制街机彩砖背景(图, 宽, 高);
    return;
  }
  绘制液晶背景(图, 宽, 高);
}

/** 像素主题共用的动态层；亮度乘子交给具体后景，液晶扫描线保持原有速度。 */
export function 绘制像素背景动态(
  图: 图形对象,
  宽: number,
  高: number,
  时间秒: number,
  亮度 = 1,
): void {
  if (像素规范.名称 === "街机彩砖") {
    绘制街机彩砖背景动态(图, 宽, 高, 时间秒, 亮度);
    return;
  }
  const 外 = 像素规范.外壳.外框 + 像素规范.外壳.内框;
  const 井高 = Math.max(像素规范.网格, 高 - 外 * 2);
  const 拍 = Math.floor(时间秒 * 像素规范.动画步频);
  const y = 外 + ((拍 * 像素规范.网格) % 井高);
  图.fillStyle(像素规范.色.亮, 亮度).fillRect(外, y, Math.max(0, 宽 - 外 * 2), 像素规范.网格);
}
