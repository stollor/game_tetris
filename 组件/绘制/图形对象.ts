/**
 * 引擎无关的立即模式绘制接口（视觉配方的唯一绘制契约）。
 *
 * 目的：游戏已有的视觉配方（`组件/霓虹街机/`、`代码/视觉/`）只写一份，
 * Phaser 版用 Phaser Graphics 实现，Three 版用 Three 合批后端实现；配方代码不复制、不重画。
 *
 * 约束：
 * - 这里只收录两版真正需要的 Graphics 子集；新增原语时同步实现两个后端并补规则测试。
 * - 方法签名与 Phaser.GameObjects.Graphics 的结构子集对齐；Phaser 侧用
 *   `代码/界面/Phaser图形.ts` 薄适配（只转发，不做视觉语义），Three 侧用
 *   `代码/three版/画笔/Three图形.ts`。
 * - 颜色统一 0xRRGGBB；透明度 0..1；圆角、线宽单位是逻辑像素。
 * - 坐标是调用方传入的逻辑像素（y 向下），不在接口里做画布坐标变换之外的适配。
 */

export interface 点 {
  x: number;
  y: number;
}

/** 左上角定位的矩形，逻辑像素；与 Three 框架控件库的 `矩形` 同形。 */
export interface 矩形 {
  左: number;
  上: number;
  宽: number;
  高: number;
}

/**
 * 混合模式用 Phaser 的数值语义：0=普通，1=叠加。
 * 只收录实际用到的两种；配方里用 `混合模式.叠加` 表达，后端自行映射。
 */
export type 混合模式数值 = number;

export const 混合模式 = {
  普通: 0,
  叠加: 1,
} as const;

export interface 图形对象 {
  /** 后续填充色；透明度缺省 1。 */
  fillStyle(颜色: number, 透明度?: number): this;
  /** 后续描边样式；线宽为逻辑像素。 */
  lineStyle(线宽: number, 颜色: number, 透明度?: number): this;
  /** 四色渐变填充：四个角的颜色与透明度分别指定，渐变由后端插值（Three 后端用分段四边形近似）。 */
  fillGradientStyle(
    左上: number,
    右上: number,
    左下: number,
    右下: number,
    透明度左上?: number,
    透明度右上?: number,
    透明度左下?: number,
    透明度右下?: number,
  ): this;
  fillRect(x: number, y: number, 宽: number, 高: number): this;
  fillRoundedRect(x: number, y: number, 宽: number, 高: number, 圆角: number): this;
  strokeRect(x: number, y: number, 宽: number, 高: number): this;
  strokeRoundedRect(x: number, y: number, 宽: number, 高: number, 圆角: number): this;
  fillCircle(x: number, y: number, 半径: number): this;
  strokeCircle(x: number, y: number, 半径: number): this;
  fillEllipse(x: number, y: number, 宽: number, 高: number): this;
  strokeEllipse(x: number, y: number, 宽: number, 高: number): this;
  fillTriangle(x1: number, y1: number, x2: number, y2: number, x3: number, y3: number): this;
  strokeTriangle(x1: number, y1: number, x2: number, y2: number, x3: number, y3: number): this;
  lineBetween(x1: number, y1: number, x2: number, y2: number): this;
  fillPoints(点集: readonly 点[], 闭合?: boolean): this;
  strokePoints(点集: readonly 点[], 闭合?: boolean): this;
  beginPath(): this;
  moveTo(x: number, y: number): this;
  lineTo(x: number, y: number): this;
  closePath(): this;
  /** 向当前路径追加圆弧（作为折线）；与 beginPath/moveTo/strokePath 组合使用。 */
  arc(x: number, y: number, 半径: number, 起始角: number, 结束角: number, 逆时针?: boolean): this;
  fillPath(): this;
  strokePath(): this;
  /** 清空已记录的绘制（Three 后端等价于清空该图层的合批）。 */
  clear(): this;
  setAlpha(透明度: number): this;
  setBlendMode(模式: 混合模式数值): this;
  save(): this;
  restore(): this;
  translateCanvas(x: number, y: number): this;
  rotateCanvas(弧度: number): this;
  scaleCanvas(x: number, y?: number): this;
}

/**
 * 共享绘制函数约定：`绘制xxx(绘图, 参数)` 纯函数。
 * - 函数内不创建 Phaser 对象、不读场景/设置/存档，视觉数据全部来自参数；
 * - Phaser 版由 `组件/霓虹街机/`、`代码/界面的现类保留交互与生命周期后委托调用；
 * - Three 版由 `代码/three版/页面/` 用 `Three图形` 直接调用。
 */
export type 图形绘制函数<参数> = (绘图: 图形对象, 参数: 参数) => void;

/** 纹理帧引用：图集名 + 帧名，资源由 GM 图集/资源层解析；仅描述数据，不含任何引擎对象。 */
export interface 纹理帧引用 {
  图集: string;
  帧: string;
}

/** 文字水平位置参照：矩形内对齐时与 Three 控件库的 `对齐` 一致。 */
export type 文字对齐 = "左" | "中" | "右";

/**
 * 文字项的锚点：配方给出锚点与锚点坐标，Phaser 后端据此设 Text 原点，Three 后端据此换行/对齐。
 * 这是"同一配方、两种文字实现"的唯一交接形状，避免两个后端各自解释文字位置。
 */
export type 文字锚点 = "左上" | "左中" | "中上" | "中中" | "右上" | "右中";

/** 共享配方输出的文字项：画什么文字、用哪套 token、锚在哪里。 */
export interface 文字项 {
  文案: string;
  样式: 文字样式;
  锚点: 文字锚点;
  x: number;
  y: number;
  /** 折行最大宽度（逻辑像素）；缺省不折行。 */
  最大宽?: number;
}

/**
 * 文字样式 token：两版共用同一套字体/字号/字重/颜色/描边/阴影设定。
 * Phaser 版创建 Text 对象，Three 版用文字图集绘制；样式来源必须是 `组件/霓虹街机/文字.ts`。
 */
export interface 文字样式 {
  字体?: string;
  字号: number;
  字重?: "常规" | "粗体";
  /** 0xRRGGBB 或 CSS 颜色字符串。 */
  颜色: number | string;
  对齐?: 文字对齐;
  行高?: number;
  /** 字距，逻辑像素；缺省按字体自然字距。 */
  字距?: number;
  描边?: { 颜色: number | string; 粗细: number };
  阴影?: { 颜色: number | string; 模糊: number; 偏移X: number; 偏移Y: number };
}

/** 取数值型颜色的工具：样式里颜色允许 CSS 字符串，绘制后端统一换回 0xRRGGBB。 */
export function 解析颜色数值(颜色: number | string): number {
  if (typeof 颜色 === "number") return 颜色;
  const 文本 = 颜色.trim();
  const 匹配 = 文本.match(/^#([0-9a-fA-F]{6})$/);
  if (匹配?.[1]) return Number.parseInt(匹配[1], 16);
  const 短匹配 = 文本.match(/^#([0-9a-fA-F]{3})$/);
  if (短匹配?.[1]) {
    const [红, 绿, 蓝] = 短匹配[1];
    return Number.parseInt(`${红}${红}${绿}${绿}${蓝}${蓝}`, 16);
  }
  throw new Error(`无法解析颜色：${文本}`);
}
