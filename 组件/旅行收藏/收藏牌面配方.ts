import type { 图形对象, 文字项, 矩形 } from "../绘制/图形对象";
import { 派生霓虹文字样式 } from "../霓虹街机/文字样式";

/**
 * 旅行收藏牌面的引擎无关配方：纸页、金色/纸面/墨色按钮底板与文字样式。
 * Phaser `组件/旅行收藏/收藏牌面.ts` 委托这里的绘制指令；Three 收藏/商店页消费同一份。
 */

export const 收藏色 = {
  夜: 0x10232a,
  墨: 0x28433f,
  纸: 0xeee6d2,
  金: 0xe5b96d,
  线: 0xb8b79d,
  正文: "#f1ead7",
  次要: "#a3bab0",
  深字: "#28433f",
  淡字: "#64756b",
};

export interface 收藏按钮数据 {
  金色?: boolean;
  纸面?: boolean;
}

export interface 收藏按钮状态 {
  已选?: boolean;
  悬停?: boolean;
  按下?: boolean;
  可用?: boolean;
}

/** 收藏纸页：深色投影 + 纸面 + 内描边。 */
export function 绘制收藏纸页(绘图: 图形对象, x: number, y: number, 宽: number, 高: number): void {
  绘图.fillStyle(0x030d13, 0.26).fillRoundedRect(x + 3, y + 8, 宽, 高, 14);
  绘图.fillStyle(收藏色.纸).fillRoundedRect(x, y, 宽, 高, 12);
  绘图.lineStyle(1, 0xfff7de, 0.6).strokeRoundedRect(x + 5, y + 5, 宽 - 10, 高 - 10, 8);
}

/** 收藏按钮的文字色方案：金底/纸底用深字，墨底用正文色。 */
export function 读取收藏按钮配色(数据: 收藏按钮数据): {
  面板色: string;
  强调色: string;
  文字色: string;
  字重: "粗体" | "常规";
} {
  if (数据.金色) return { 面板色: "#e5b96d", 强调色: "#e5b96d", 文字色: 收藏色.深字, 字重: "粗体" };
  if (数据.纸面) return { 面板色: "#eee6d2", 强调色: "#eee6d2", 文字色: 收藏色.深字, 字重: "常规" };
  return { 面板色: "#28433f", 强调色: "#28433f", 文字色: 收藏色.正文, 字重: "常规" };
}

/** 收藏按钮底板（中心定位）：纸页/收藏馆共用的手作风。 */
export function 绘制收藏按钮底板(
  绘图: 图形对象,
  中心X: number,
  中心Y: number,
  宽: number,
  高: number,
  数据: 收藏按钮数据,
  状态: 收藏按钮状态 = {},
): void {
  const x = 中心X - 宽 / 2;
  const y = 中心Y - 高 / 2;
  绘图.fillStyle(0x041218, 0.3).fillRoundedRect(x, y + 3, 宽, 高, 7);
  const 背景 = 数据.金色 ? 收藏色.金 : 数据.纸面 ? 收藏色.纸 : 收藏色.墨;
  绘图.fillStyle(背景, 状态.可用 === false ? 0.5 : 1).fillRoundedRect(x, y, 宽, 高, 7);
  绘图
    .lineStyle(
      状态.已选 ? 2 : 1,
      状态.悬停 || 状态.已选 ? 0xffe6a2 : 数据.纸面 ? 0xb3b59c : 0x607e73,
      状态.可用 === false ? 0.35 : 0.9,
    )
    .strokeRoundedRect(x, y, 宽, 高, 7);
  绘图.lineStyle(1, 0xfff5cc, 状态.按下 ? 0.06 : 0.22).lineBetween(x + 8, y + 2, x + 宽 - 8, y + 2);
  if (状态.悬停) 绘图.fillStyle(0xfff8d6, 0.06).fillRoundedRect(x + 2, y + 2, 宽 - 4, 高 - 4, 6);
}

/** 收藏按钮文字项：颜色跟随底色，字号沿用霓虹按钮默认（16px）。 */
export function 生成收藏按钮文字项(
  中心X: number,
  中心Y: number,
  文案: string,
  数据: 收藏按钮数据,
  字号 = 16,
): 文字项 {
  const 配色 = 读取收藏按钮配色(数据);
  return {
    文案,
    样式: 派生霓虹文字样式("按钮", {
      字号,
      字重: 配色.字重,
      颜色: 配色.文字色,
    }),
    锚点: "中中",
    x: 中心X,
    y: 中心Y,
  };
}

/** 旅行商店部位卡：和 Phaser 版现行陈列保持相同底色与收藏描边。 */
export function 绘制商店部位底板(
  绘图: 图形对象,
  区: 矩形,
  预览中: boolean,
  已有: boolean,
  悬停 = false,
): void {
  绘图
    .fillStyle(0x0c2428, 悬停 || 预览中 ? 0.72 : 0.42)
    .fillRoundedRect(区.左, 区.上, 区.宽, 区.高, 8);
  绘图
    .lineStyle(1.5, 预览中 || 已有 ? 收藏色.金 : 0xffffff, 预览中 ? 0.95 : 已有 ? 0.7 : 0.16)
    .strokeRoundedRect(区.左, 区.上, 区.宽, 区.高, 8);
}

export function 绘制商店目录底板(绘图: 图形对象, 区: 矩形, 选中: boolean, 悬停 = false): void {
  绘图
    .fillStyle(0x071820, 选中 ? 0.55 : 悬停 ? 0.42 : 0.28)
    .fillRoundedRect(区.左, 区.上, 区.宽, 区.高, 8);
  绘图
    .lineStyle(1.5, 选中 ? 收藏色.金 : 0xffffff, 选中 ? 0.9 : 0.18)
    .strokeRoundedRect(区.左, 区.上, 区.宽, 区.高, 8);
}

export function 绘制商店部位预览底板(绘图: 图形对象, 区: 矩形): void {
  绘图.fillStyle(0x122824, 0.9).fillRoundedRect(区.左, 区.上, 区.宽, 区.高, 6);
}

export const 商店确认遮罩 = { 颜色: 0x030a13, 透明度: 0.82 } as const;
