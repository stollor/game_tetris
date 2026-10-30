import type { 按钮区域 } from "./菜单布局";

/**
 * 纯享页布局：全屏风景上的胶囊返回、风景标题/副题与底部圆点。
 * 几何数值逐字来自重构前的主界面布局；纯享只有一份实现，菜单与商店共用本页。
 */

export interface 纯享布局 {
  返回钮: 按钮区域;
  标题: { x: number; y: number };
  说明: { x: number; y: number };
  圆点: { y: number; 选中半径: number; 未选半径: number };
}

export function 计算纯享布局(视口宽: number, 视口高: number): 纯享布局 {
  const 返宽 = Math.min(132, Math.max(100, 视口宽 * 0.24));
  return {
    返回钮: { 中心X: 视口宽 - 返宽 / 2 - 16, 中心Y: 视口高 - 40, 宽: 返宽, 高: 40 },
    标题: { x: 24, y: 视口高 - 78 },
    说明: { x: 25, y: 视口高 - 42 },
    圆点: {
      y: 视口高 - 16,
      选中半径: 3.5,
      未选半径: 2.2,
    },
  };
}

/** 底部风景圆点：x 按总数居中排开，当前项半径更大。 */
export function 计算风景圆点(
  视口宽: number,
  视口高: number,
  总数: number,
  当前索引: number,
): { x: number; y: number; 半径: number }[] {
  const 圆点 = 计算纯享布局(视口宽, 视口高).圆点;
  const 数量 = Math.max(1, 总数);
  const 点宽 = Math.min(14, 360 / Math.max(1, 视口宽));
  const 起点X = 视口宽 / 2 - ((数量 - 1) * 点宽) / 2;
  const 当前 = Math.max(0, Math.min(数量 - 1, 当前索引));
  return Array.from({ length: 数量 }, (_, i) => ({
    x: 起点X + i * 点宽,
    y: 圆点.y,
    半径: i === 当前 ? 圆点.选中半径 : 圆点.未选半径,
  }));
}
