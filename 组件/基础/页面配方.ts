import { 派生霓虹文字样式 } from "../../代码/主题/文字/文字样式";
import { 界面主题, 颜色值 } from "../../代码/主题/配色/主题读取";
import type { 图形对象, 文字项, 矩形 } from "../../框架/界面/绘制/协议";
import type { 样式选择 } from "../../框架/设置/设置";

/**
 * 设置/列表类页面的引擎无关视觉配方：遮罩、面板、分组标题、滑块、下拉框、列表行等。
 * 从 Phaser 版设置/成就/排行榜页面与框架控件的现行视觉逐条复刻，Three 页面 + 预览共用；
 * Phaser 侧对应控件（框架 界面滑块/界面分组/下拉菜单）仍按原实现绘制，二者视觉同源。
 */

/** 页面级语义色：一次性从 `代码/主题/配色/主题读取.ts` 换算，页面不写颜色字面量。 */
export interface 页面语义色 {
  背景: number;
  面板: number;
  面板描边: number;
  正文: number;
  次要: number;
  弱化: number;
  强调: number;
  分组线: number;
  按钮底: number;
  轨道: number;
  遮罩: number;
  遮罩透明度: number;
}

export function 读取页面语义色(样式?: 样式选择): 页面语义色 {
  const 主题 = 界面主题(样式);
  return {
    背景: 颜色值(主题.页面.背景),
    面板: 颜色值(主题.面板.主面板.背景),
    面板描边: 颜色值(主题.面板.主面板.描边),
    正文: 颜色值(主题.面板.主面板.正文文字),
    次要: 颜色值(主题.文字.次要),
    弱化: 颜色值(主题.文字.弱化),
    强调: 颜色值(主题.文字.强调),
    分组线: 颜色值(主题.面板.分组线),
    按钮底: 颜色值(主题.按钮.次要.默认.背景),
    轨道: 颜色值(主题.输入框.轨道),
    遮罩: 颜色值(主题.面板.遮罩.背景),
    遮罩透明度: 主题.面板.遮罩.透明度,
  };
}

/** 全屏遮罩（弹层/覆盖页）。 */
export function 绘制遮罩(
  绘图: 图形对象,
  宽: number,
  高: number,
  颜色: number,
  透明度: number,
): void {
  绘图.fillStyle(颜色, 透明度).fillRect(0, 0, 宽, 高);
}

/** 覆盖页面板：实色底 + 细描边（设置页中央面板的现行视觉）。 */
export function 绘制页面面板(
  绘图: 图形对象,
  矩形: 矩形,
  填充色: number,
  描边色: number,
  描边透明度 = 0.75,
  圆角 = 0,
): void {
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

export interface 分组标题布局 {
  左: number;
  上: number;
  宽: number;
  /** 分隔线相对标题左端的 y。 */
  分隔线Y: number;
}

/** 分组标题文字项（强调色、左中锚点）。 */
export function 生成分组标题文字项(布局: 分组标题布局, 标题: string, 强调色: number): 文字项 {
  return {
    文案: 标题,
    样式: 派生霓虹文字样式("正文", { 字号: 13, 颜色: 强调色, 对齐: "左" }),
    锚点: "左中",
    x: 布局.左,
    y: 布局.上 + 16,
  };
}

/** 分组标题下方的 1px 分隔线。 */
export function 绘制分组分隔线(
  绘图: 图形对象,
  布局: 分组标题布局,
  强调色: number,
  透明度 = 0.32,
): void {
  绘图.fillStyle(强调色, 透明度).fillRect(布局.左, 布局.分隔线Y, 布局.宽, 1);
}

/**
 * 水平滑块（中心定位）：玻璃质感轨道 + 强调色填充 + 辉光滑块头。
 * 与 Phaser 框架 `界面滑块` 的 重绘视觉 逐条指令一致。
 */
export function 绘制滑块(
  绘图: 图形对象,
  中心X: number,
  中心Y: number,
  宽: number,
  比例: number,
  轨道色: number,
  强调色: number,
  命中高 = 32,
): void {
  const 左 = 中心X - 宽 / 2;
  const 顶 = 中心Y;
  const 轨道高 = 7;
  绘图
    .fillStyle(轨道色, 0.95)
    .fillRoundedRect(左, 顶 - 轨道高 / 2, 宽, 轨道高, 轨道高 / 2)
    .fillStyle(轨道色, 0.5)
    .fillRoundedRect(左, 顶 - 轨道高 / 2, 宽, 轨道高 * 0.55, 轨道高 / 2);
  const 比例值 = Math.max(0, Math.min(1, 比例));
  if (比例值 > 0) {
    绘图
      .fillStyle(强调色, 0.95)
      .fillRoundedRect(左, 顶 - 轨道高 / 2, Math.max(轨道高, 宽 * 比例值), 轨道高, 轨道高 / 2);
  }
  const 头X = 左 + 宽 * 比例值;
  const 头半径 = 命中高 < 30 ? 8 : 9;
  for (let 层 = 2; 层 >= 1; 层 -= 1) {
    绘图.fillStyle(强调色, 0.16 / 层).fillCircle(头X, 顶, 头半径 * (1 + 层 * 0.5));
  }
  绘图
    .fillStyle(强调色, 1)
    .fillCircle(头X, 顶, 头半径)
    .fillStyle(0xffffff, 0.55)
    .fillCircle(头X - 头半径 * 0.25, 顶 - 头半径 * 0.28, 头半径 * 0.34)
    .lineStyle(1, 0xffffff, 0.35)
    .strokeCircle(头X, 顶, 头半径);
}

/** 下拉框外框（左对齐文字 + 右侧三角箭头），与框架下拉菜单收起态一致。 */
export function 绘制下拉框(
  绘图: 图形对象,
  矩形: 矩形,
  面板色: number,
  强调色: number,
  圆角 = 8,
): void {
  绘图.fillStyle(面板色, 0.9).fillRoundedRect(矩形.左, 矩形.上, 矩形.宽, 矩形.高, 圆角);
  绘图.lineStyle(1, 强调色, 0.6).strokeRoundedRect(矩形.左, 矩形.上, 矩形.宽, 矩形.高, 圆角);
  const 箭头X = 矩形.左 + 矩形.宽 - 16;
  const 箭头Y = 矩形.上 + 矩形.高 / 2;
  绘图.lineStyle(1.8, 强调色, 0.95);
  绘图.lineBetween(箭头X - 4, 箭头Y - 2, 箭头X, 箭头Y + 2);
  绘图.lineBetween(箭头X, 箭头Y + 2, 箭头X + 4, 箭头Y - 2);
}

/** 下拉框当前值文字项（左中锚点，留出箭头空间）。 */
export function 生成下拉框文字项(矩形: 矩形, 文案: string, 颜色: number | string): 文字项 {
  return {
    文案,
    样式: 派生霓虹文字样式("正文", { 字号: 14, 颜色, 对齐: "左" }),
    锚点: "左中",
    x: 矩形.左 + 12,
    y: 矩形.上 + 矩形.高 / 2,
    最大宽: 矩形.宽 - 32,
  };
}

export interface 开关布局 {
  中心X: number;
  中心Y: number;
  宽: number;
  高: number;
}

/** 开关（能力由 GM 控件负责，样式按主题画）：关=冷灰轨道，开=强调色轨道 + 白色圆点。 */
export function 绘制开关(
  绘图: 图形对象,
  布局: 开关布局,
  开: boolean,
  轨道色: number,
  强调色: number,
): void {
  const 半径 = 布局.高 / 2;
  const x = 布局.中心X - 布局.宽 / 2;
  const y = 布局.中心Y - 半径;
  绘图
    .fillStyle(开 ? 强调色 : 轨道色, 开 ? 0.9 : 0.6)
    .fillRoundedRect(x, y, 布局.宽, 布局.高, 半径);
  const 圆点X = 开 ? x + 布局.宽 - 半径 : x + 半径;
  绘图.fillStyle(0xffffff, 0.95).fillCircle(圆点X, 布局.中心Y, 半径 * 0.72);
}

/** 列表行底板：稀有面板底 + 可选强调描边 + 底部进度线（成就/排行榜/商店列表共用）。 */
export function 绘制列表行(
  绘图: 图形对象,
  矩形: 矩形,
  面板色: number,
  描边色: number,
  描边透明度 = 0.7,
  圆角 = 12,
  进度?: { 比例: number; 轨道色: number; 强调色: number },
): void {
  绘图.fillStyle(面板色, 0.7).fillRoundedRect(矩形.左, 矩形.上, 矩形.宽, 矩形.高, 圆角);
  绘图.lineStyle(1, 描边色, 描边透明度).strokeRoundedRect(矩形.左, 矩形.上, 矩形.宽, 矩形.高, 圆角);
  if (!进度) return;
  const 轨道: 矩形 = {
    左: 矩形.左 + 16,
    上: 矩形.上 + 矩形.高 - 17,
    宽: 矩形.宽 - 44,
    高: 3,
  };
  绘图.fillStyle(进度.轨道色, 0.5).fillRoundedRect(轨道.左, 轨道.上, 轨道.宽, 轨道.高, 1);
  const 比例 = Math.max(0, Math.min(1, 进度.比例));
  if (比例 > 0)
    绘图.fillStyle(进度.强调色, 0.9).fillRoundedRect(轨道.左, 轨道.上, 轨道.宽 * 比例, 轨道.高, 1);
}

/** 页签按钮底板（排行榜/商店分类）：选中=强调色描边 + 亮底，未选=面板底。 */
export function 绘制页签(
  绘图: 图形对象,
  矩形: 矩形,
  选中: boolean,
  面板色: number,
  强调色: number,
  圆角 = 10,
): void {
  绘图
    .fillStyle(面板色, 选中 ? 0.95 : 0.55)
    .fillRoundedRect(矩形.左, 矩形.上, 矩形.宽, 矩形.高, 圆角);
  绘图
    .lineStyle(选中 ? 2 : 1, 强调色, 选中 ? 0.95 : 0.35)
    .strokeRoundedRect(矩形.左, 矩形.上, 矩形.宽, 矩形.高, 圆角);
}

/** Phaser 下拉菜单默认向上展开：当前行下方不挤压设置页脚。 */
export function 计算下拉展开区域(当前行: 矩形, 选项数: number): { 面板: 矩形; 选项: 矩形[] } {
  return {
    面板: {
      左: 当前行.左 - 6,
      上: 当前行.上 - 选项数 * 当前行.高 - 9,
      宽: 当前行.宽 + 12,
      高: (选项数 + 1) * 当前行.高 + 14,
    },
    选项: Array.from({ length: 选项数 }, (_, i) => ({
      ...当前行,
      上: 当前行.上 - 2 - (选项数 - i) * 当前行.高,
    })),
  };
}
