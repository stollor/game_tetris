import type { 图形对象 } from "../../../.gamemaker/依赖/框架/界面/绘制/协议";
import type { 主题名 } from "../../../代码/项目配置/主题目录";
import { 按名称取像素规范 } from "../../主题/像素/像素规范";
import { 解析方块外观 } from "../../主题/外观/方块外观";
import { 绘制内置背景静底 } from "../../视效/背景/内置主题";
import { 绘制立体晶格缩略 } from "../../视效/背景/立体晶格背景";
import { 绘制方块单元, 绘制方块辉光 } from "../对局/方块单元";

/**
 * 主题缩略图（商店目录卡、部位卡）：统一构图 = 该主题的缩略底 + 一个倒 T 方块。
 *
 * 缩略图要回答「穿这套主题玩起来长什么样」；只画背景只有极光原野成立——
 * 另外三套的背景本来就是给整页设计的低对比舞台，缩到百来像素只剩色块。
 * 四套统一成「底 + 方块」，并排看就是同一个游戏的四个皮肤；内容只留四格，
 * 格子才够大，像素主题的点阵纹样和立体主题的立方面都看得出来。
 * 尺寸全按宽高推：目录卡约 88×66、部位卡约 36×34 共用同一份构图。
 */

/** 倒 T：三格在下、一格在上。 */
const 倒T形: readonly (readonly [number, number])[] = [
  [0, 1],
  [1, 1],
  [2, 1],
  [1, 0],
];

/** 砖机液晶缩略底：全尺寸的 8px 胶壳在缩略图里会吃掉半个画面，这里按比例收薄。 */
function 绘制液晶缩略底(图: 图形对象, 宽: number, 高: number): void {
  const 色 = 按名称取像素规范("砖机液晶").色;
  const 壳厚 = Math.max(2, Math.round(Math.min(宽, 高) * 0.06));
  const 屏左 = 壳厚 * 2;
  const 屏上 = 壳厚 * 2;
  const 屏宽 = Math.max(1, 宽 - 壳厚 * 4);
  const 屏高 = Math.max(1, 高 - 壳厚 * 4);
  图.fillStyle(色.墨).fillRect(0, 0, 宽, 高);
  图.fillStyle(色.暗).fillRect(壳厚, 壳厚, 宽 - 壳厚 * 2, 高 - 壳厚 * 2);
  图.fillStyle(色.底).fillRect(屏左, 屏上, 屏宽, 屏高);
  // 一条停住的扫描线：缩略图是静态帧，选一个能立住的瞬间。
  图
    .fillStyle(色.亮, 0.55)
    .fillRect(屏左, 屏上 + Math.round(屏高 * 0.3), 屏宽, Math.max(1, Math.round(高 * 0.04)));
}

/** 街机彩砖缩略底：机台壳 + 檐灯一排 + 深色屏，全尺寸机台在缩略图里轨宽会吃掉整个画面。 */
function 绘制彩砖缩略底(图: 图形对象, 宽: number, 高: number): void {
  const 规范 = 按名称取像素规范("街机彩砖");
  const 色 = 规范.色;
  const 边 = Math.max(2, Math.round(Math.min(宽, 高) * 0.08));
  const 檐高 = Math.max(3, Math.round(高 * 0.14));
  图.fillStyle(色.壳).fillRect(0, 0, 宽, 高);
  图.fillStyle(色.夜).fillRect(边, 边, 宽 - 边 * 2, 高 - 边 * 2);
  // 顶部檐灯：七色跑马灯停在一格上。
  const 灯 = [色.红, 色.黄, 色.绿, 色.蓝, 色.紫, 色.青, 色.橙];
  const 灯格 = Math.max(2, Math.round(宽 * 0.045));
  const 灯距 = Math.max(灯格 + 1, Math.round(宽 * 0.075));
  const 灯数 = Math.max(3, Math.floor((宽 - 边 * 2) / 灯距));
  for (let 序 = 0; 序 < 灯数; 序 += 1) {
    图
      .fillStyle(灯[序 % 灯.length] ?? 色.黄, 序 % 2 === 0 ? 1 : 0.45)
      .fillRect(边 + 灯格 + 序 * 灯距, 边 + Math.round(檐高 * 0.35), 灯格, 灯格);
  }
  // 屏：檐灯下方到机台底边。
  图.fillStyle(色.底).fillRect(边, 边 + 檐高, 宽 - 边 * 2, Math.max(1, 高 - 边 * 2 - 檐高));
}

/**
 * 主题缩略底：只画该主题「一眼认出是谁」的场景骨架，不叠方块。
 * 商店的部位卡缩略用它——那里预览的是「背景部位」本身，不该出现方块。
 */
export function 绘制主题缩略底(图: 图形对象, 宽: number, 高: number, 主题: 主题名): void {
  if (!(宽 > 0) || !(高 > 0)) return;
  if (主题 === "砖机液晶") 绘制液晶缩略底(图, 宽, 高);
  else if (主题 === "街机彩砖") 绘制彩砖缩略底(图, 宽, 高);
  else if (主题 === "立体晶格") 绘制立体晶格缩略(图, 宽, 高);
  else 绘制内置背景静底(图, 宽, 高);
}

/** 主题缩略图：底 + 一个倒 T 方块，方块用该主题自己的方块质感。 */
export function 绘制主题缩略(图: 图形对象, 宽: number, 高: number, 主题: 主题名): void {
  if (!(宽 > 0) || !(高 > 0)) return;
  绘制主题缩略底(图, 宽, 高, 主题);
  const 外观 = 解析方块外观(主题);
  const 格 = Math.max(4, Math.floor(Math.min(宽 / 5.6, 高 / 3.6)));
  const 左 = Math.round((宽 - 格 * 3) / 2);
  const 上 = Math.round(高 - 格 * 2 - Math.max(1, 高 * 0.1));
  // 先铺辉光再叠实体，与商店陈列同一个次序。
  for (const [列, 行] of 倒T形)
    绘制方块辉光(图, 左 + 列 * 格, 上 + 行 * 格, { 方案: 外观, 格子: 格, 色值: 外观.颜色.T });
  for (const [列, 行] of 倒T形)
    绘制方块单元(图, 左 + 列 * 格, 上 + 行 * 格, { 方案: 外观, 格子: 格, 色值: 外观.颜色.T });
}
