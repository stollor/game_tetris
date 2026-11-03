import type { 图形对象, 点 } from "../../../../.gamemaker/依赖/框架/界面/绘制/协议";
import { 暗色, 混色 } from "../../../../.gamemaker/依赖/框架/界面/颜色工具";
import { 立体规范 } from "../../../主题/立体/立体规范";
import { 入场参数 } from "../入场参数";
import type { 幕面参数, 接缝参数, 节拍底纹参数, 转场幕缝, 转场画法 } from "./类型";

/**
 * 立体晶格的转场画法：透视金属机架。
 *
 * 上下两片金属幕向中央接缝「收拢」：纵向棱线在外缘等距、到接缝端统一向屏幕中线收，
 * 横向肋条按 `界面.厚/切` 起凸；幕面由外缘的壳渐变到接缝侧的板高光，整块不透明。
 * 接缝是双线灯条（灯色 4px + 灯芯），两端压铆钉，强度越高灯芯越宽、辉光越外扩。
 * 颜色/切角/厚度只取 `立体规范`，不新增字面色值；不读业务状态，不改时间轴。
 */

const 面 = 立体规范.界面;
const 装置 = 立体规范.装置;

/** 收拢量：棱线接缝端相对外缘端向屏幕中线收的比例。完全打开也留一点透视。 */
const 基础收拢 = 0.06;
const 收拢幅度 = 0.2;

/** 棱线列距约 40px、肋条行距约 30px，按画布自适应，图元数量不随分辨率暴涨。 */
function 棱线列距(宽: number): number {
  return Math.max(24, 宽 / 9.6);
}

function 肋条行距(高: number): number {
  return Math.max(18, 高 / 28);
}

/** 上下两片幕布的纵向跨度：外缘贴屏幕上下边，接缝端贴幕缝。 */
export interface 幕片跨度 {
  /** 外缘端纵坐标：上片 0、下片 高。 */
  外缘Y: number;
  /** 接缝端纵坐标：上片 缝.顶、下片 缝.底。 */
  接缝Y: number;
  /** 可见高度；0 表示该片未露出。 */
  高: number;
}

/** 幕缝拆出的两片跨度与接缝中心，幕面与接缝画法共用同一判据。 */
export interface 幕缝跨度 {
  上: 幕片跨度;
  下: 幕片跨度;
  /** 接缝中心，恒为 高/2。 */
  中心Y: number;
}

/** 一条纵向棱线：外缘端贴幕片外缘，接缝端贴幕缝；横坐标向中线收，构成透视梯形。 */
export interface 棱线段 {
  外缘: 点;
  接缝: 点;
}

/** 一次算好的透视棱线：上下两片各一列棱线段，`收拢` 是接缝端的横向收拢比例。 */
export interface 透视棱线 {
  上: readonly 棱线段[];
  下: readonly 棱线段[];
  收拢: number;
}

/**
 * 覆盖度 → 收拢进度（0..1）。取 t²：前段棱线几乎竖直，越接近合拢推进越快，
 * 让最后 20% 的收拢有明显加速感；非法值按 0 处理，结果夹在 0..1。
 */
export function 收拢加速(覆盖度: number): number {
  const t = Number.isFinite(覆盖度) ? Math.min(1, Math.max(0, 覆盖度)) : 0;
  return t * t;
}

/**
 * 幕缝 → 两片幕布的纵向跨度。顶夹在 0..高/2、底夹在高/2..高，
 * 因此接缝中心恒为 高/2，越界参数也不会让接缝上下漂移。
 */
export function 棱线端点(高: number, 缝: 转场幕缝): 幕缝跨度 {
  const 总高 = Number.isFinite(高) && 高 > 0 ? 高 : 0;
  const 中Y = 总高 / 2;
  const 顶 = Number.isFinite(缝.顶) ? Math.min(中Y, Math.max(0, 缝.顶)) : 0;
  const 底 = Number.isFinite(缝.底) ? Math.max(中Y, Math.min(总高, 缝.底)) : 总高;
  return {
    上: { 外缘Y: 0, 接缝Y: 顶, 高: 顶 },
    下: { 外缘Y: 总高, 接缝Y: 底, 高: 总高 - 底 },
    中心Y: 中Y,
  };
}

/**
 * 按列距把两片幕面拆成纵向棱线：外缘处等距，接缝端统一向屏幕中线收 `收拢` 比例；
 * 收拢 = 基础透视 + 收拢幅度 × 收拢加速(覆盖度)，幕布越合拢越像朝消失点塌陷。
 * 宽高非法时返回空集，绘制端不必再判。
 */
export function 棱线集合(宽: number, 高: number, 缝: 转场幕缝, 覆盖度: number): 透视棱线 {
  const 收拢 = 基础收拢 + 收拢幅度 * 收拢加速(覆盖度);
  if (!(宽 > 0) || !(高 > 0)) return { 上: [], 下: [], 收拢 };
  const 跨度 = 棱线端点(高, 缝);
  const 列数 = Math.max(1, Math.floor(宽 / 棱线列距(宽)));
  const 间距 = 宽 / (列数 + 1);
  const 中X = 宽 / 2;
  const 上: 棱线段[] = [];
  const 下: 棱线段[] = [];
  for (let 列 = 1; 列 <= 列数; 列 += 1) {
    const x = 间距 * 列;
    const 缝X = x + (中X - x) * 收拢;
    上.push({ 外缘: { x, y: 跨度.上.外缘Y }, 接缝: { x: 缝X, y: 跨度.上.接缝Y } });
    下.push({ 外缘: { x, y: 跨度.下.外缘Y }, 接缝: { x: 缝X, y: 跨度.下.接缝Y } });
  }
  return { 上, 下, 收拢 };
}

/**
 * 方向化渐变梯形：`外` 端贴幕片外缘、`内` 端贴幕缝，越靠接缝越亮。
 * 上下两片方向相反，靠比较两端纵坐标决定渐变朝向，绘制端不必分片写两套。
 */
function 绘制梯形(
  图: 图形对象,
  点集: readonly 点[],
  外缘Y: number,
  接缝Y: number,
  外色: number,
  内色: number,
  外透: number,
  内透: number,
): void {
  const 向下 = 接缝Y >= 外缘Y;
  图
    .fillGradientStyle(
      向下 ? 外色 : 内色,
      向下 ? 外色 : 内色,
      向下 ? 内色 : 外色,
      向下 ? 内色 : 外色,
      向下 ? 外透 : 内透,
      向下 ? 外透 : 内透,
      向下 ? 内透 : 外透,
      向下 ? 内透 : 外透,
    )
    .fillPoints(点集, true);
}

/** 幕底：壳 → 壳面 → 板 → 接缝侧板高光；三段渐变铺满，整块幕布不透明。 */
function 绘制幕底(图: 图形对象, 宽: number, 片: 幕片跨度, 加速: number): void {
  const 向 = 片.接缝Y >= 片.外缘Y ? 1 : -1;
  const 近缝 = 混色(面.板, 面.板高光, 0.4 + 加速 * 0.2);
  const 分段 = [0, 0.42, 0.74, 1] as const;
  const 色阶 = [面.壳, 面.壳面, 面.板, 近缝] as const;
  for (let 段 = 0; 段 < 3; 段 += 1) {
    const 甲Y = 片.外缘Y + 向 * 片.高 * 分段[段];
    const 乙Y = 片.外缘Y + 向 * 片.高 * 分段[段 + 1];
    const 顶色 = 向 > 0 ? 色阶[段] : 色阶[段 + 1];
    const 底色 = 向 > 0 ? 色阶[段 + 1] : 色阶[段];
    图
      .fillGradientStyle(顶色, 顶色, 底色, 底色)
      .fillRect(0, Math.min(甲Y, 乙Y), 宽, Math.abs(乙Y - 甲Y) + 0.5);
  }
}

/**
 * 横向肋条：沿幕片每 ~30px 起一条 5px 厚的斜切肋（两端按 `界面.切` 收角），
 * 外缘侧受光、接缝侧压暗，再补 1px 板高光顶缘。
 */
function 绘制肋条(图: 图形对象, 宽: number, 屏高: number, 片: 幕片跨度, 加速: number): void {
  const 向 = 片.接缝Y >= 片.外缘Y ? 1 : -1;
  const 间距 = 肋条行距(屏高);
  const 切 = Math.min(面.切, 宽 * 0.08);
  const 厚 = 面.厚;
  const 行数 = Math.floor(片.高 / 间距);
  const 亮 = 0.1 + 加速 * 0.14;
  for (let 行 = 1; 行 <= 行数; 行 += 1) {
    const y = 片.外缘Y + 向 * 间距 * 行;
    const 顶 = 向 > 0 ? y : y - 厚;
    绘制梯形(
      图,
      [
        { x: 切, y: 顶 },
        { x: 宽 - 切, y: 顶 },
        { x: 宽, y: 顶 + 厚 / 2 },
        { x: 宽 - 切, y: 顶 + 厚 },
        { x: 切, y: 顶 + 厚 },
        { x: 0, y: 顶 + 厚 / 2 },
      ],
      片.外缘Y,
      片.接缝Y,
      混色(面.板, 面.板高光, 0.3),
      面.板暗,
      0.36,
      0.5,
    );
    图.fillStyle(面.板高光, 亮).fillRect(切 * 0.6, 向 > 0 ? 顶 : 顶 + 厚 - 1, 宽 - 切 * 1.2, 1);
  }
}

/** 纵向棱线：向接缝端收拢的梯形槽，槽底暗、一侧 1px 板高光，越靠接缝越亮。 */
function 绘制棱线(
  图: 图形对象,
  宽: number,
  片: 幕片跨度,
  棱线: readonly 棱线段[],
  加速: number,
): void {
  const 外色 = 暗色(面.壳面, 0.2);
  const 内色 = 混色(面.板, 面.板高光, 0.45);
  const 槽外宽 = Math.max(2, 宽 / 180);
  const 槽内宽 = 槽外宽 * 0.6;
  for (const 段 of 棱线) {
    const { 外缘, 接缝 } = 段;
    绘制梯形(
      图,
      [
        { x: 外缘.x - 槽外宽, y: 外缘.y },
        { x: 外缘.x + 槽外宽, y: 外缘.y },
        { x: 接缝.x + 槽内宽, y: 接缝.y },
        { x: 接缝.x - 槽内宽, y: 接缝.y },
      ],
      片.外缘Y,
      片.接缝Y,
      外色,
      内色,
      0.44,
      0.62 + 加速 * 0.18,
    );
    图
      .lineStyle(1, 面.板高光, 0.08 + 加速 * 0.14)
      .lineBetween(外缘.x - 槽外宽, 外缘.y, 接缝.x - 槽内宽, 接缝.y);
  }
}

/** 幕缘：外缘 1px 板暗压边、接缝侧 1px 板高光斜面，两侧竖边收口；`边线` 是模式色强调边。 */
function 绘制边缘(图: 图形对象, 宽: number, 片: 幕片跨度, 边线: number, 模式色: number): void {
  const 向 = 片.接缝Y >= 片.外缘Y ? 1 : -1;
  const 上Y = Math.min(片.外缘Y, 片.接缝Y);
  const 外缘线Y = 向 > 0 ? 片.外缘Y : 片.外缘Y - 1;
  const 斜面Y = 向 > 0 ? 片.接缝Y - 1 : 片.接缝Y;
  图
    .fillStyle(面.板暗, 0.9)
    .fillRect(0, 外缘线Y, 宽, 1)
    .fillRect(0, 上Y, 1, 片.高)
    .fillRect(宽 - 1, 上Y, 1, 片.高);
  图.fillStyle(面.板高光, 0.5).fillRect(0, 斜面Y, 宽, 1);
  if (边线 > 0)
    图
      .fillStyle(模式色, Math.min(1, 边线) * 0.35)
      .fillRect(0, 向 > 0 ? 片.接缝Y - 2 : 片.接缝Y + 1, 宽, 1);
}

function 绘制幕面(图: 图形对象, 参数: 幕面参数): void {
  const { 宽, 高, 缝, 覆盖度, 边线 } = 参数;
  if (!(宽 > 0) || !(高 > 0)) return;
  const 加速 = 收拢加速(覆盖度);
  const 跨度 = 棱线端点(高, 缝);
  const 棱线 = 棱线集合(宽, 高, 缝, 覆盖度);
  for (const { 片, 棱 } of [
    { 片: 跨度.上, 棱: 棱线.上 },
    { 片: 跨度.下, 棱: 棱线.下 },
  ]) {
    if (片.高 <= 0) continue;
    绘制幕底(图, 宽, 片, 加速);
    绘制肋条(图, 宽, 高, 片, 加速);
    绘制棱线(图, 宽, 片, 棱, 加速);
    绘制边缘(图, 宽, 片, 边线, 参数.模式色);
  }
}

/** 接缝：灯槽 + 双线灯条（灯色 4px + 灯芯）+ 分段刻度 + 两端铆钉，中心严格在高/2。 */
function 绘制接缝(图: 图形对象, 参数: 接缝参数): void {
  const { 宽, 高 } = 参数;
  if (!(宽 > 0) || !(高 > 0)) return;
  const 力 = Number.isFinite(参数.强度) ? Math.min(1, Math.max(0, 参数.强度)) : 0;
  const 中Y = 高 / 2;
  const 灯厚 = 入场参数.运动.线高 * 2;
  const 芯厚 = 1 + 力 * 1.5;
  const 辉高 = 3 + 力 * 4;
  const 辉透 = 0.22 * 力;
  图
    .fillStyle(面.屏, 0.9)
    .fillRect(0, 中Y - 灯厚 / 2 - 2, 宽, 灯厚 + 4)
    .fillStyle(面.凹, 0.9)
    .fillRect(0, 中Y - 灯厚 / 2 - 3, 宽, 1)
    .fillRect(0, 中Y + 灯厚 / 2 + 2, 宽, 1);
  if (辉透 > 0)
    图
      .fillGradientStyle(面.灯, 面.灯, 面.灯, 面.灯, 0, 0, 辉透, 辉透)
      .fillRect(0, 中Y - 灯厚 / 2 - 2 - 辉高, 宽, 辉高)
      .fillGradientStyle(面.灯, 面.灯, 面.灯, 面.灯, 辉透, 辉透, 0, 0)
      .fillRect(0, 中Y + 灯厚 / 2 + 2, 宽, 辉高);
  图.fillStyle(面.灯, 0.5 + 0.5 * 力).fillRect(0, 中Y - 灯厚 / 2, 宽, 灯厚);
  for (const 位 of 装置.灯段位置)
    if (Math.abs(位) < 0.95)
      图
        .fillStyle(面.板暗, 0.85)
        .fillRect(宽 / 2 + (位 * 宽) / 2 - 0.5, 中Y - 灯厚 / 2 - 1, 1, 灯厚 + 2);
  图.fillStyle(面.灯芯, 0.65 + 0.35 * 力).fillRect(0, 中Y - 芯厚 / 2, 宽, 芯厚);
  const 铆距 = Math.min(8, 宽 * 0.03);
  for (const x of [铆距, 宽 - 铆距])
    if (x > 4 && x < 宽 - 4) {
      图.fillStyle(混色(面.板, 面.板高光, 0.3), 0.95).fillCircle(x, 中Y, 4.4);
      图.fillStyle(面.板高光, 0.9).fillCircle(x, 中Y, 2.2);
    }
}

/** 节拍底纹：地平线光带 + 微弱网格 + 灯色底光 + 模式色节拍条，画在 Ready/Go 文字之下。 */
function 绘制节拍底纹(图: 图形对象, 参数: 节拍底纹参数): void {
  const { 宽, 高 } = 参数;
  if (!(宽 > 0) || !(高 > 0)) return;
  const 显度 = Number.isFinite(参数.显) ? Math.min(1, Math.max(0, 参数.显)) : 0;
  if (显度 <= 0) return;
  const 中Y = 高 / 2;
  const 地平高 = 高 * 0.09;
  图.fillStyle(面.壳, 0.18 * 显度).fillRect(0, 0, 宽, 高);
  图
    .fillStyle(面.灯, 0.05 * 显度)
    .fillEllipse(宽 / 2, 中Y, 宽 * 0.66, 高 * 0.2)
    .fillStyle(面.灯, 0.07 * 显度)
    .fillEllipse(宽 / 2, 中Y, 宽 * 0.36, 高 * 0.1);
  图
    .fillGradientStyle(面.灯, 面.灯, 面.灯, 面.灯, 0, 0, 0.22 * 显度, 0.22 * 显度)
    .fillRect(0, 中Y - 地平高, 宽, 地平高)
    .fillGradientStyle(面.灯, 面.灯, 面.灯, 面.灯, 0.22 * 显度, 0.22 * 显度, 0, 0)
    .fillRect(0, 中Y, 宽, 地平高);
  // 地平线：中央最亮、两端淡出的灯芯线，避免一条硬线横穿 Ready/Go 与 HUD。
  图
    .fillGradientStyle(面.灯芯, 面.灯芯, 面.灯芯, 面.灯芯, 0, 0.5 * 显度, 0, 0.5 * 显度)
    .fillRect(0, 中Y - 0.5, 宽 / 2, 1)
    .fillGradientStyle(面.灯芯, 面.灯芯, 面.灯芯, 面.灯芯, 0.5 * 显度, 0, 0.5 * 显度, 0)
    .fillRect(宽 / 2, 中Y - 0.5, 宽 / 2, 1);
  // 微弱网格：地平线下方一片透视线，往上只留一条远景横线，不压住顶栏与仪表。
  图.lineStyle(1, 面.板高光, 0.06 * 显度);
  for (const 位 of [-1, -0.5, 0, 0.5, 1] as const)
    图.lineBetween(宽 / 2 + 位 * 宽 * 0.06, 中Y, 宽 / 2 + 位 * 宽 * 0.62, 高);
  for (const 比 of [0.07, 0.16, 0.3] as const) {
    const y = 中Y + 高 * 比;
    图.lineStyle(1, 面.板高光, 0.06 * 显度).lineBetween(0, y, 宽, y);
  }
  图.lineStyle(1, 面.板高光, 0.04 * 显度).lineBetween(0, 中Y - 高 * 0.1, 宽, 中Y - 高 * 0.1);
  图
    .fillStyle(参数.模式色, 0.55 * 显度)
    .fillRect(宽 / 2 - 24 * 显度, 中Y + 高 * 0.045, 48 * 显度, 2);
}

export const 立体画法: 转场画法 = { 绘制幕面, 绘制接缝, 绘制节拍底纹 };
