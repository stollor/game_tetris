import { 像素规范 } from "../../主题/像素/像素规范";
import { 是像素风格 } from "../../主题/像素/像素风格";
import { 读取霓虹文字样式 } from "../../主题/文字/文字样式";
import { type 纯享布局, 计算主界面布局 } from "../../代码/页面/布局/主界面布局";
import type { 图形对象, 文字项 } from "../../框架/界面/绘制/协议";
import { 绘制像素面板 } from "../基础/面板/像素面板";

/**
 * 纯享风景态的引擎无关配方：全屏风景上的半透明胶囊按钮、标题/副题文字项与底部圆点。
 * Phaser `代码/界面/纯享风景.ts` 与 Three 主界面纯享态共用；数据来自 `代码/界面/风景浏览.ts`。
 */

export interface 纯享按钮状态 {
  已选?: boolean;
  悬停?: boolean;
  按下?: boolean;
  可用?: boolean;
}

/** 纯享态布局（复用主界面布局的纯享几何）。 */
export function 计算纯享布局(宽: number, 高: number): 纯享布局 | undefined {
  return 计算主界面布局(宽, 高, "纯享").纯享;
}

/**
 * 半透明胶囊底板：暗底 + 浅描边，亮暗风景上都够清楚，又不抢戏。
 * 中心定位；与 Phaser 重构前的 绘制纯享胶囊 逐条指令一致。
 */
export function 绘制纯享胶囊(
  绘图: 图形对象,
  中心X: number,
  中心Y: number,
  宽: number,
  高: number,
  状态: 纯享按钮状态 = {},
): void {
  if (是像素风格()) {
    绘制像素面板(
      绘图,
      中心X - 宽 / 2,
      中心Y - 高 / 2,
      宽,
      高,
      像素规范.色.夜,
      状态.悬停 ? 像素规范.色.黄 : 像素规范.色.远,
      状态.按下,
    );
    return;
  }
  const r = 高 / 2;
  const 加压 = 状态.按下 ? 0.06 : 状态.悬停 ? 0.03 : 0;
  const x = 中心X - 宽 / 2;
  const y = 中心Y - 高 / 2;
  // 轻阴影（偏下）提高亮景对比
  绘图.fillStyle(0x000000, 0.22 + 加压);
  绘图.fillRoundedRect(x + 1, y + 2, 宽, 高, r);
  // 半透明深色胶囊
  绘图.fillStyle(0x101820, 0.7 + 加压);
  绘图.fillRoundedRect(x, y, 宽, 高, r);
  // 浅描边：暗景可见轮廓，亮景也不糊
  绘图.lineStyle(1.5, 0xfff6e8, 0.55 + 加压);
  绘图.strokeRoundedRect(x + 0.5, y + 0.5, 宽 - 1, 高 - 1, r);
  // 内侧细线增加层次
  绘图.lineStyle(1, 0xffffff, 0.12);
  绘图.strokeRoundedRect(x + 2.5, y + 2.5, 宽 - 5, 高 - 5, Math.max(4, r - 2));
}

/** 纯享返回按钮文字样式（15px，颜色由胶囊底色决定，取浅色）。 */
export function 纯享返回文字项(中心X: number, 中心Y: number, 文案: string): 文字项 {
  return {
    文案,
    样式: { ...读取霓虹文字样式("选择模式标题"), 字号: 15, 颜色: "#fff8e7", 描边: undefined },
    锚点: "中中",
    x: 中心X,
    y: 中心Y,
  };
}

/** 纯享态风景标题与副题文字项（左上锚点，带描边）。 */
export function 生成纯享文字项(布局: 纯享布局, 说明: { 标题: string; 副题: string }): 文字项[] {
  return [
    {
      文案: 说明.标题,
      样式: 读取霓虹文字样式("风景标题"),
      锚点: "左上",
      x: 布局.标题.x,
      y: 布局.标题.y,
    },
    {
      文案: 说明.副题,
      样式: 读取霓虹文字样式("风景说明"),
      锚点: "左上",
      x: 布局.说明.x,
      y: 布局.说明.y,
    },
  ];
}

/** 纯享态底部风景圆点：总数与当前索引来自已解锁风景列表。 */
export function 计算纯享圆点(
  宽: number,
  高: number,
  总数: number,
  当前索引: number,
): { x: number; y: number; 半径: number }[] {
  const 布局 = 计算主界面布局(宽, 高, "纯享");
  const 圆点 = 布局.纯享?.圆点;
  if (!圆点) return [];
  const 数量 = Math.max(1, 总数);
  const 点宽 = Math.min(14, 360 / Math.max(1, 宽));
  const 起点X = 宽 / 2 - ((数量 - 1) * 点宽) / 2;
  const 当前 = Math.max(0, Math.min(数量 - 1, 当前索引));
  return Array.from({ length: 数量 }, (_, i) => ({
    x: 起点X + i * 点宽,
    y: 圆点.y,
    半径: i === 当前 ? 圆点.选中半径 : 圆点.未选半径,
  }));
}

/** 纯享态底部圆点（自绘）：当前项更亮更大。 */
export function 绘制纯享圆点(
  绘图: 图形对象,
  宽: number,
  高: number,
  总数: number,
  当前索引: number,
): void {
  for (const [i, 圆点] of 计算纯享圆点(宽, 高, 总数, 当前索引).entries()) {
    if (是像素风格()) {
      const 格 = 像素规范.网格;
      绘图
        .fillStyle(i === 当前索引 ? 像素规范.色.黄 : 像素规范.色.远)
        .fillRect(圆点.x - 格, 圆点.y - 格, 格 * 2, 格 * 2);
      continue;
    }
    绘图
      .fillStyle(0xfff6d8, i === Math.max(0, Math.min(总数 - 1, 当前索引)) ? 0.95 : 0.28)
      .fillCircle(圆点.x, 圆点.y, 圆点.半径);
  }
}
