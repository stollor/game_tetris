import type { 图形对象 } from "../../../../.gamemaker/依赖/框架/界面/绘制/协议";
import { 亮色, 暗色, 混色 } from "../../../../.gamemaker/依赖/框架/界面/颜色工具";
import { 按名称取像素规范 } from "../../../主题/像素/像素规范";
import type { 幕面参数, 接缝参数, 节拍底纹参数, 转场画法 } from "./类型";

/**
 * 街机彩砖的转场画法：上下两片幕布由七色砖墙砌成，中央接缝是一排彩砖横条。
 *
 * 规范色一律取 `按名称取像素规范("街机彩砖")`，不能用绘制期活规范 `像素规范`，
 * 否则五套主题同屏预览或试穿时会拿错主题的色盘。
 * 幕布先铺满深底再砌砖：砖缝与还没砌到的地方都靠深底兜住，整片始终不透明，
 * 展开途中必须盖住模式选择页的内容。
 */
const 规 = 按名称取像素规范("街机彩砖");
/** 七色砖料：红黄绿蓝紫青橙。 */
const 七色: readonly number[] = [
  规.色.红,
  规.色.黄,
  规.色.绿,
  规.色.蓝,
  规.色.紫,
  规.色.青,
  规.色.橙,
];

/** 砖缝宽度（逻辑像素）：砖与砖之间露出的深底宽度。 */
export const 砖缝 = 2;
/**
 * 单帧砖块预算（上下两片幕布合计）。砖块一多就整体放大砖形，
 * 绝不按像素格子砌：这段演出每帧都在画，图元数要压在两百以内。
 */
export const 单帧砖块预算 = 168;
/** 落砖时砖块在半空抬起的距离（逻辑像素）：只挪砖本身，接缝中心不动。 */
const 落砖抬升 = 1.5;
/** 砌入延迟的短坡宽度（覆盖度单位）：越过延迟后砖块用这么短的坡落定，避免硬切。 */
const 落位坡 = 0.1;

/** 砖块节距 = 一块砖 + 一条砖缝。 */
export interface 砖块节距 {
  砖宽: number;
  砖高: number;
}

/** 一块砖：位置尺寸都在幕布自身坐标系（外缘 y=0，接缝在 y=板高）。 */
export interface 砖块 {
  左: number;
  上: number;
  宽: number;
  高: number;
  /** 砖面颜色，已按规范七色低频取色并压暗。 */
  色: number;
  列: number;
}

/** 一行砖：行号从外缘起算，靠近接缝的行号更大。 */
export interface 砖块行 {
  行: number;
  上: number;
  高: number;
  砖: 砖块[];
}

/** 一行能排几块（错缝后左右各可能露出半块，所以按整砖数多算一块）。 */
function 每行砖数(宽: number, 节距: 砖块节距): number {
  return Math.ceil(Math.max(0, 宽) / 节距.砖宽) + 1;
}

/** 整屏砌满（上下两片合计）的砖块数，用来卡单帧预算。 */
function 整屏砖数(宽: number, 屏高: number, 节距: 砖块节距): number {
  return 每行砖数(宽, 节距) * Math.max(1, Math.ceil(屏高 / 节距.砖高));
}

/**
 * 按屏幕宽高求砖块节距：保持 2:1 的砖形，从最小可用砖开始放大，
 * 取第一款让整屏砌满也不超 `单帧砖块预算` 的尺寸。
 * 390×844 落在 72×36（砖面 70×34），全屏合计 168 块。
 */
export function 砖块尺寸(宽: number, 屏高: number): 砖块节距 {
  const 屏 = Number.isFinite(屏高) && 屏高 > 0 ? 屏高 : 1;
  const 屏宽 = Number.isFinite(宽) && 宽 > 0 ? 宽 : 1;
  for (let 砖高 = 10; 砖高 <= 96; 砖高 += 2) {
    const 节距 = { 砖宽: 砖高 * 2, 砖高 };
    if (整屏砖数(屏宽, 屏, 节距) <= 单帧砖块预算) return 节距;
  }
  return { 砖宽: 192, 砖高: 96 };
}

/** 0..1 夹取；非法进度（NaN/Infinity）按 0 处理，画法不接受非有限数。 */
function 夹01(值: number): number {
  return Number.isFinite(值) ? Math.min(1, Math.max(0, 值)) : 0;
}

/** 行列归一到 0..周期-1：小数按整格取整，负数与超界按周期回绕，非法值按 0。 */
function 归一周期(值: number, 周期: number): number {
  if (!Number.isFinite(值)) return 0;
  return ((Math.floor(值) % 周期) + 周期) % 周期;
}

/** 每四块压一块暗砖（与主题背景的砖墙同一套砌法）；列号按 4 回绕，负列也成立。 */
function 是暗砖(列: number): boolean {
  return 归一周期(列, 4) === 3;
}

/**
 * 砖色色相：一整皮（行）共用一个色相，七色按 3 步进轮转，整墙按行成带、不逐砖乱跳。
 * 每四块换一档相邻色相做点缀，所以同一皮里也有变化，不会糊成一条纯色。
 */
export function 砖块色号(行: number, 列: number): number {
  const 点缀 = 是暗砖(列) ? 1 : 0;
  return 归一周期(归一周期(行, 七色.length) * 3 + 点缀, 七色.length);
}

/**
 * 砖面颜色：所在皮的色相向深底压暗，再按行列哈希做明暗抖动，每四块再压一档暗砖。
 * 抖动步进与相邻列互质，所以左右两块砖的颜色一定不同，砖墙不至于糊成色块。
 */
export function 砖块颜色(行: number, 列: number): number {
  const 行号 = Number.isFinite(行) ? Math.floor(行) : 0;
  const 列号 = Number.isFinite(列) ? Math.floor(列) : 0;
  const 抖 = ((((行号 * 7 + 列号 * 3) % 5) + 5) % 5) * 0.035;
  const 基 = 混色(七色[砖块色号(行号, 列号)] ?? 规.色.暗, 规.色.远, 0.26 + 抖);
  return 是暗砖(列号) ? 暗色(基, 0.2) : 基;
}

/**
 * 一片幕布的砖块布局：外缘在 y=0、接缝在 y=板高，行从外缘向接缝砌。
 * 行间错缝（奇数行平移半块），砖与砖之间留 `砖缝`；超出板高的最后一行裁到接缝边。
 * 节距缺省按整屏高度估，绘制时传同一个节距，上下两片砖格才对得齐。
 */
export function 砖块布局(
  宽: number,
  板高: number,
  节距: 砖块节距 = 砖块尺寸(宽, 板高 * 2),
): 砖块行[] {
  const 行列表: 砖块行[] = [];
  const 屏宽 = Number.isFinite(宽) && 宽 > 0 ? 宽 : 1;
  const 板 = Number.isFinite(板高) && 板高 > 0 ? 板高 : 0;
  const 列数 = 每行砖数(屏宽, 节距);
  const 行数 = Math.max(0, Math.ceil(板 / 节距.砖高));
  for (let 行 = 0; 行 < 行数; 行 += 1) {
    const 上 = 行 * 节距.砖高;
    const 余高 = 板 - 上;
    if (余高 <= 0) break;
    // 末行被接缝裁掉一段时不留底缝：切口的深底由幕布底板自己兜住。
    const 高 = 余高 >= 节距.砖高 ? 节距.砖高 - 砖缝 : 余高;
    if (高 <= 0) break;
    const 错缝 = (行 % 2) * (节距.砖宽 / 2);
    const 砖: 砖块[] = [];
    for (let 列 = 0; 列 < 列数; 列 += 1) {
      const 左 = 列 * 节距.砖宽 + 错缝 - 节距.砖宽;
      if (左 + 节距.砖宽 <= 0 || 左 >= 屏宽) continue;
      砖.push({ 左, 上, 宽: 节距.砖宽 - 砖缝, 高, 色: 砖块颜色(行, 列), 列 });
    }
    行列表.push({ 行, 上, 高, 砖 });
  }
  return 行列表;
}

/**
 * 第 n 行开始落砖的覆盖度阈值：外缘行先到，向接缝每行顺延约 0.05；
 * 封顶 0.85 保证闭合末帧所有行都能落定，不会永远留一条没砌完的缝。
 */
export function 行延迟(行: number): number {
  const 行号 = Number.isFinite(行) ? Math.max(0, Math.floor(行)) : 0;
  return Math.min(0.85, 行号 * 0.05);
}

/** 单行砌入进度：覆盖度越过该行延迟后，用 `落位坡` 的短坡落定（0..1）。 */
export function 砌入进度(覆盖度: number, 行: number): number {
  return 夹01((夹01(覆盖度) - 行延迟(行)) / 落位坡);
}

/** 行内落位进度：幕布边缘刚揭到该行时砖块还在半空，揭满一行才落定（0..1）。 */
export function 落位进度(已揭高: number, 行: number, 砖高: number): number {
  const 行号 = Number.isFinite(行) ? Math.max(0, Math.floor(行)) : 0;
  const 砖高值 = Number.isFinite(砖高) && 砖高 > 0 ? 砖高 : 1;
  return 夹01((已揭高 - 行号 * 砖高值) / 砖高值);
}

/** 落砖偏移：未落定时抬起，过半后 1px 回弹，落定归零；只挪砖块自身，不动接缝。 */
export function 落砖偏移(进度: number): number {
  const t = 夹01(进度);
  if (t >= 1) return 0;
  return -落砖抬升 * (1 - t) ** 2 + Math.sin(t * Math.PI) * 0.5;
}

/** 一块砖的砌面：顶亮底暗的纵向渐变。上下两端同色，后端画成一张四边形，不额外花图元。 */
function 绘制砖面(
  图: 图形对象,
  左: number,
  上: number,
  宽: number,
  高: number,
  色: number,
  透明: number,
): void {
  const 上色 = 亮色(色, 0.16);
  const 下色 = 暗色(色, 0.26);
  图.fillGradientStyle(上色, 上色, 下色, 下色, 透明, 透明, 透明, 透明).fillRect(左, 上, 宽, 高);
}

/** 一片幕布的砖墙：深底已在上面铺好，这里只砌砖。`贴底` 决定砖从屏幕下缘往上砌。 */
function 绘制砖墙(
  图: 图形对象,
  宽: number,
  高: number,
  板高: number,
  节距: 砖块节距,
  覆盖度: number,
  贴底: boolean,
): void {
  if (板高 <= 0) return;
  for (const 行 of 砖块布局(宽, 板高, 节距)) {
    const 进度 = Math.min(砌入进度(覆盖度, 行.行), 落位进度(板高, 行.行, 节距.砖高));
    if (进度 <= 0) continue;
    const 偏移 = 落砖偏移(进度);
    const 透明 = 0.35 + 0.65 * 进度;
    for (const 砖 of 行.砖) {
      const 屏上 = 贴底 ? 高 - 砖.上 - 砖.高 : 砖.上;
      绘制砖面(图, 砖.左, 屏上 + 偏移, 砖.宽, 砖.高, 砖.色, 透明);
    }
  }
}

/** 幕布边线：砌到哪就亮到哪，用模式色提亮，收束末段随 `边线` 归零。 */
function 绘制幕边(
  图: 图形对象,
  宽: number,
  高: number,
  缝: { 顶: number; 底: number },
  边线: number,
  模式色: number,
): void {
  if (边线 <= 0) return;
  const 色 = 亮色(模式色, 0.35);
  if (缝.顶 > 0) 图.fillStyle(色, 边线).fillRect(0, 缝.顶 - 2, 宽, 2);
  if (缝.底 < 高) 图.fillStyle(色, 边线).fillRect(0, 缝.底, 宽, 2);
}

function 绘制幕面(图: 图形对象, 参数: 幕面参数): void {
  const { 宽, 高, 缝, 覆盖度, 边线, 模式色 } = 参数;
  const 节距 = 砖块尺寸(宽, 高);
  // 深底先铺满：砖缝、未砌到的行、被接缝裁掉的部分都由它兜住，整片必须不透明。
  图.fillStyle(规.色.远, 1);
  if (缝.顶 > 0) 图.fillRect(0, 0, 宽, 缝.顶);
  if (缝.底 < 高) 图.fillRect(0, 缝.底, 宽, 高 - 缝.底);
  绘制砖墙(图, 宽, 高, 缝.顶, 节距, 覆盖度, false);
  绘制砖墙(图, 宽, 高, 高 - 缝.底, 节距, 覆盖度, true);
  绘制幕边(图, 宽, 高, 缝, 边线, 模式色);
}

/**
 * 接缝横排砖：与幕面同一节距的一排砖，七色按块轮转、比幕墙亮一档，正中一块由绘制侧换成模式色。
 * 整排严格以 高/2 为中心，闭合时压在 2px 缝上，跨页的两段演出共用同一排砖。
 */
export function 接缝砖块(宽: number, 高: number): 砖块[] {
  const 节距 = 砖块尺寸(宽, 高);
  const 砖高 = Math.max(4, Math.min(节距.砖高 - 砖缝, 高 - 4));
  const 上 = 高 / 2 - 砖高 / 2;
  const 基准 = 宽 / 2 - 节距.砖宽 / 2;
  const 左右 = Math.ceil(宽 / 节距.砖宽 / 2) + 1;
  const 砖: 砖块[] = [];
  for (let 序 = -左右; 序 <= 左右; 序 += 1) {
    const 左 = 基准 + 序 * 节距.砖宽;
    if (左 + 节距.砖宽 <= 0 || 左 >= 宽) continue;
    // 接缝要一眼看出是「一排彩砖」：整排按块取七色，不像幕墙那样按皮压暗。
    const 色号 = ((序 % 七色.length) + 七色.length) % 七色.length;
    const 色 = 混色(七色[色号] ?? 规.色.亮, 规.色.远, 0.16);
    砖.push({ 左, 上, 宽: 节距.砖宽 - 砖缝, 高: 砖高, 色, 列: 序 });
  }
  return 砖;
}

function 绘制接缝(图: 图形对象, 参数: 接缝参数): void {
  const { 宽, 高, 模式色, 强度 } = 参数;
  const 砖列 = 接缝砖块(宽, 高);
  const 块数 = Math.max(1, 砖列.length);
  const 首砖 = 砖列[0];
  const 末砖 = 砖列.at(-1);
  if (!首砖 || !末砖) return;
  // 横排砖上下各留一条深底缝：接缝是插进两片幕布之间的一条彩砖带，不是墙里普通的一行。
  图.fillStyle(规.色.远, 1);
  图.fillRect(0, 首砖.上 - 砖缝, 宽, 砖缝);
  图.fillRect(0, 末砖.上 + 末砖.高, 宽, 砖缝);
  砖列.forEach((砖, 序) => {
    // 依次提亮的相位：强度最高时整排亮到最亮，余辉回落时按同一顺序暗下去。
    const 阈值 = (序 / 块数) * 0.55;
    const 提亮 = 夹01((夹01(强度) - 阈值) / Math.max(0.1, 1 - 阈值));
    const 基色 = 砖.列 === 0 ? 模式色 : 砖.色;
    绘制砖面(图, 砖.左, 砖.上, 砖.宽, 砖.高, 亮色(基色, 0.45 * 提亮), 1);
  });
  // 中央 2px 亮线压在砖面上：接缝中心始终是高/2，误差不超过 1px。
  图.fillStyle(亮色(模式色, 0.3), 0.55 + 0.45 * 夹01(强度)).fillRect(0, 高 / 2 - 1, 宽, 2);
}

function 绘制节拍底纹(图: 图形对象, 参数: 节拍底纹参数): void {
  const { 宽, 高 } = 参数;
  const 显 = 夹01(参数.显);
  if (显 <= 0) return;
  const 中 = 高 / 2;
  图.fillStyle(规.色.夜, 0.56 * 显).fillRect(0, 0, 宽, 高);
  // 七色灯条：Ready/Go 上方与下方各压一组，像街机台面的 marquee 灯带。
  const 条宽 = Math.round(宽 * 0.44);
  const 左 = Math.round(宽 / 2 - 条宽 / 2);
  七色.forEach((色, 序) => {
    图.fillStyle(色, 0.5 * 显).fillRect(左, 中 - 74 - 序 * 5, 条宽, 2);
    图.fillStyle(色, 0.5 * 显).fillRect(左, 中 + 66 + 序 * 5, 条宽, 2);
  });
  // 屏幕上下缘的七色点阵：把整屏框成一块街机灯板。
  const 点距 = 20;
  const 点数 = Math.max(1, Math.floor(宽 / 点距));
  const 起X = (宽 - (点数 - 1) * 点距) / 2;
  for (let 序 = 0; 序 < 点数; 序 += 1) {
    const 色 = 七色[序 % 七色.length] ?? 规.色.亮;
    const x = 起X + 序 * 点距 - 3;
    图.fillStyle(色, 0.32 * 显).fillRect(x, 8, 6, 6);
    图.fillStyle(色, 0.32 * 显).fillRect(x, 高 - 14, 6, 6);
  }
}

export const 彩砖画法: 转场画法 = { 绘制幕面, 绘制接缝, 绘制节拍底纹 };
