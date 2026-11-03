import type { 图形对象, 点, 矩形 } from "../../../../.gamemaker/依赖/框架/界面/绘制/协议";
import { 混色 } from "../../../../.gamemaker/依赖/框架/界面/颜色工具";
import { 立体规范 } from "../../../主题/立体/立体规范";
import { 夹进度 } from "../入场参数";
import type { 节拍底纹参数, 转场帧, 转场画法 } from "./类型";

/**
 * 立体晶格的转场：纵深塌陷 + 放射扩张。
 *
 * 收束：选中的模式卡按透视压扁、塌进屏幕中心的消失点；随后金属幕从消失点放射铺开
 * （梯形扩张 + 棱线射出 + 环缝），盖满整屏。
 * 展开：反向，整块金属幕被吸回消失点，新画面从边缘先露出来。
 * 与极光的「上下幕布」不同，这里盖住画面的永远是同一块带透视的板：
 * 几何只由「扩张进度」决定，不区分阶段，所以收束 1 与展开 0 逐笔一致，跨页不露馅。
 */

const 面 = 立体规范.界面;
const 装置 = 立体规范.装置;

/**
 * 收束前 26% 是卡片透视塌陷，之后金属幕自消失点放射铺满整屏。
 * 动画层把收束压缩到 94% 就拿到进度 1（0.996s 前必须盖满），所以铺开要抢在中段。
 */
export const 立体卡片占比 = 0.26;

/** 幕面梯形的透视比：上边（远处）收得多、下边（近处）收得少，扩张途中始终是梯形。 */
const 上边指数 = 1.25;
const 下边指数 = 0.85;

/** 板面环带：从外缘向消失点逐层提亮，做出「板面被吸向深处」的层次（基色铺满整块板）。 */
const 环带 = [
  { 缩: 0.84, 提亮: 0.1 },
  { 缩: 0.62, 提亮: 0.24 },
  { 缩: 0.4, 提亮: 0.38 },
  { 缩: 0.2, 提亮: 0.52 },
] as const;

/** 四点梯形（左上 / 右上 / 右下 / 左下，页面坐标 y 向下）。 */
export interface 梯形四点 {
  左上: 点;
  右上: 点;
  右下: 点;
  左下: 点;
}

/** 一条从消失点射出的棱线。 */
export interface 棱线段 {
  从: 点;
  到: 点;
}

function 正数(值: number): number {
  return Number.isFinite(值) && 值 > 0 ? 值 : 0;
}

/** 卡片塌陷用的加速曲线 t²：卡片越接近消失点滑得越快。 */
function 加速(值: number): number {
  const t = 夹进度(值);
  return t * t;
}

/**
 * 铺开曲线 1-(1-q)^2：ease-out —— 板面在中段就推到画面大半，末段只做收口。
 * 收束必须在切页前（动画层 94% 处）就盖满，所以不能用 t² 那种末段才爆发的曲线；
 * 展开取它的时间反演 `铺开(1-t)`，一收一放仍是同一条动势。
 */
function 铺开(q: number): number {
  const t = 夹进度(q);
  return 1 - (1 - t) ** 2;
}

function 插值(甲: 点, 乙: 点, 比: number): 点 {
  return { x: 甲.x + (乙.x - 甲.x) * 比, y: 甲.y + (乙.y - 甲.y) * 比 };
}

function 四点集(四: 梯形四点): 点[] {
  return [四.左上, 四.右上, 四.右下, 四.左下];
}

/** 以某点为心缩放四点集：环带、灯芯内缩边都用它，形状仍是同一块梯形。 */
function 缩点集(点集: readonly 点[], 心: 点, 缩: number): 点[] {
  return 点集.map((项) => ({ x: 心.x + (项.x - 心.x) * 缩, y: 心.y + (项.y - 心.y) * 缩 }));
}

function 中心(四: 梯形四点): 点 {
  return {
    x: (四.左上.x + 四.右上.x + 四.右下.x + 四.左下.x) / 4,
    y: (四.左上.y + 四.右上.y + 四.右下.y + 四.左下.y) / 4,
  };
}

/** 消失点：屏幕中心。棱线从这里射出，板面也收回这里。 */
export function 消失点(帧: 转场帧): 点 {
  return { x: 正数(帧.宽) / 2, y: 正数(帧.高) / 2 };
}

/** 卡片塌陷进度：收束前 32% 从 0 加速到 1；其它阶段恒为 0（不画卡片）。 */
export function 卡片塌陷(帧: 转场帧): number {
  if (帧.阶段 !== "收束") return 0;
  return 加速(夹进度(帧.进度) / 立体卡片占比);
}

/** 金属幕扩张进度：收束后段 0→1（铺开曲线），展开 1→0（同一曲线的时间反演）。 */
export function 扩张进度(帧: 转场帧): number {
  const t = 夹进度(帧.进度);
  if (帧.阶段 === "收束") return 铺开((t - 立体卡片占比) / (1 - 立体卡片占比));
  return 铺开(1 - t);
}

/**
 * 卡片阶段的透视梯形：底边（近处）收得慢、上边（远处）收得快，
 * 卡片中心同时向消失点滑，塌陷到 1 时四点重合在消失点。
 */
export function 卡片四点(帧: 转场帧): 梯形四点 {
  const 点 = 消失点(帧);
  const 卡: 矩形 = 帧.原卡 ?? { 左: 点.x - 1, 上: 点.y - 1, 宽: 2, 高: 2 };
  const 塌 = 卡片塌陷(帧);
  const 底 = 卡.上 + 卡.高;
  const 卡心X = 卡.左 + 卡.宽 / 2;
  const 余 = 1 - 塌;
  const 上宽 = Math.max(0, 卡.宽 * 余 * (1 - 0.35 * 塌));
  const 下宽 = Math.max(0, 卡.宽 * 余 * (1 + 0.35 * 塌));
  const 上Y = 卡.上 + (点.y - 卡.上) * 塌 ** 1.15;
  const 下Y = 底 + (点.y - 底) * 塌 ** 0.85;
  const 滑向X = 卡心X + (点.x - 卡心X) * 塌;
  return {
    左上: { x: 滑向X - 上宽 / 2, y: 上Y },
    右上: { x: 滑向X + 上宽 / 2, y: 上Y },
    右下: { x: 滑向X + 下宽 / 2, y: 下Y },
    左下: { x: 滑向X - 下宽 / 2, y: 下Y },
  };
}

/**
 * 幕面梯形：从消失点向外扩张的金属板。
 * p=0 收缩成消失点，p=1 恰好是整屏矩形（宽高与屏幕逐值相等）。
 */
export function 梯形四点(帧: 转场帧): 梯形四点 {
  const 宽 = 正数(帧.宽);
  const 高 = 正数(帧.高);
  const 点 = 消失点(帧);
  const p = 扩张进度(帧);
  const 上宽 = 宽 * p ** 上边指数;
  const 下宽 = 宽 * p ** 下边指数;
  const 上Y = 点.y + (0 - 点.y) * p;
  const 下Y = 点.y + (高 - 点.y) * p;
  return {
    左上: { x: 点.x - 上宽 / 2, y: 上Y },
    右上: { x: 点.x + 上宽 / 2, y: 上Y },
    右下: { x: 点.x + 下宽 / 2, y: 下Y },
    左下: { x: 点.x - 下宽 / 2, y: 下Y },
  };
}

/** 从消失点射出的棱线：指向幕面梯形的四角与四边中点，共 8 条。 */
export function 棱线集合(帧: 转场帧): readonly 棱线段[] {
  const 从 = 消失点(帧);
  const 四 = 梯形四点(帧);
  const 端 = [
    四.左上,
    四.右上,
    四.右下,
    四.左下,
    插值(四.左上, 四.右上, 0.5),
    插值(四.右上, 四.右下, 0.5),
    插值(四.右下, 四.左下, 0.5),
    插值(四.左下, 四.左上, 0.5),
  ];
  return 端.map((到) => ({ 从, 到 }));
}

/**
 * 覆盖比：遮罩实际盖住的面积占屏幕的比例（梯形面积 / 屏幕面积）。
 * 收束 0→1、展开 1→0，接力点两块梯形都是整屏矩形，所以恰好为 1。
 */
export function 覆盖比(帧: 转场帧): number {
  const 宽 = 正数(帧.宽);
  const 高 = 正数(帧.高);
  if (!(宽 > 0) || !(高 > 0)) return 0;
  const 四 = 梯形四点(帧);
  const 上宽 = 四.右上.x - 四.左上.x;
  const 下宽 = 四.右下.x - 四.左下.x;
  const 上Y = (四.左上.y + 四.右上.y) / 2;
  const 下Y = (四.左下.y + 四.右下.y) / 2;
  const 面积 = ((上宽 + 下宽) / 2) * Math.max(0, 下Y - 上Y);
  return Math.min(1, Math.max(0, 面积 / (宽 * 高)));
}

/** 卡片阶段：把模式卡画成一块正在塌进屏幕的金属板（面 + 透视肋 + 灯边 + 铆钉）。 */
function 绘制卡片(图: 图形对象, 帧: 转场帧): void {
  const 四 = 卡片四点(帧);
  const 点集 = 四点集(四);
  const 塌 = 卡片塌陷(帧);
  const 上宽 = 四.右上.x - 四.左上.x;
  const 下宽 = 四.右下.x - 四.左下.x;
  if (Math.max(上宽, 下宽) < 1.5) return;
  图.fillGradientStyle(面.壳面, 面.壳面, 面.板, 面.板).fillPoints(点集, true);
  // 板厚：上缘受光、下缘压暗，塌陷时仍看得出是一块有厚度的金属板。
  图
    .fillStyle(面.板高光, 0.22)
    .fillPoints(
      [四.左上, 四.右上, 插值(四.右上, 四.右下, 0.08), 插值(四.左上, 四.左下, 0.08)],
      true,
    );
  图
    .fillStyle(面.板暗, 0.5)
    .fillPoints(
      [插值(四.左下, 四.左上, 0.92), 插值(四.右下, 四.右上, 0.92), 四.右下, 四.左下],
      true,
    );
  for (const 比 of [0.34, 0.66] as const) {
    const 左 = 插值(四.左上, 四.左下, 比);
    const 右 = 插值(四.右上, 四.右下, 比);
    图.lineStyle(1, 面.板暗, 0.55).lineBetween(左.x, 左.y, 右.x, 右.y);
    图.lineStyle(1, 面.板高光, 0.16).lineBetween(左.x, 左.y - 1, 右.x, 右.y - 1);
  }
  图
    .lineStyle(1.5, 面.板暗, 0.9)
    .strokePoints(点集, true)
    .lineStyle(2, 面.灯, 0.5 + 0.4 * 塌)
    .strokePoints(点集, true)
    .lineStyle(1, 面.灯芯, 0.35 + 0.4 * 塌)
    .strokePoints(缩点集(点集, 中心(四), 0.955), true);
  const 心 = 中心(四);
  for (const 角 of 点集) {
    图.fillStyle(面.板暗, 0.95).fillCircle(角.x, 角.y, 3.2);
    图.fillStyle(面.板高光, 0.85).fillCircle(角.x, 角.y, 1.7);
  }
  图.fillStyle(面.灯芯, 0.5 * (1 - 塌)).fillCircle(心.x, 心.y, 2);
}

/** 扩张阶段：一块带环缝与放射棱线的金属幕，整块铺板色、向消失点逐层提亮。 */
function 绘制幕面(图: 图形对象, 帧: 转场帧): void {
  const p = 扩张进度(帧);
  if (!(p > 0)) return;
  const 点 = 消失点(帧);
  const 四 = 梯形四点(帧);
  const 点集 = 四点集(四);
  图.fillStyle(面.板, 1).fillPoints(点集, true);
  for (const { 缩, 提亮 } of 环带)
    图.fillStyle(混色(面.板, 面.板高光, 提亮), 1).fillPoints(缩点集(点集, 点, 缩), true);
  for (const { 缩 } of 环带) {
    图.lineStyle(1, 面.板暗, 0.62).strokePoints(缩点集(点集, 点, 缩), true);
    图.lineStyle(1, 面.板高光, 0.16).strokePoints(缩点集(点集, 点, 缩 * 0.985), true);
  }
  for (const 段 of 棱线集合(帧))
    图.lineStyle(1, 面.板高光, 0.14).lineBetween(段.从.x, 段.从.y, 段.到.x, 段.到.y);
  图
    .lineStyle(1.5, 面.板暗, 0.9)
    .strokePoints(点集, true)
    .lineStyle(2, 面.灯, 0.55 + 0.35 * p)
    .strokePoints(点集, true)
    .lineStyle(1, 面.灯芯, 0.35 + 0.35 * p)
    .strokePoints(缩点集(点集, 点, 0.988), true);
  for (const 位 of 装置.灯段位置) {
    const 比 = (位 + 1) / 2;
    const 底 = 插值(四.左下, 四.右下, 比);
    图.fillStyle(面.灯芯, 0.75).fillRect(底.x - 3 * p, 底.y - 1, Math.max(1, 6 * p), 2);
  }
  for (const 角 of 点集) {
    图.fillStyle(面.板暗, 0.95).fillCircle(角.x, 角.y, 3.4);
    图.fillStyle(面.板高光, 0.9).fillCircle(角.x, 角.y, 1.8);
  }
}

function 绘制遮罩(图: 图形对象, 帧: 转场帧): void {
  if (!(正数(帧.宽) > 0) || !(正数(帧.高) > 0)) return;
  if (帧.阶段 === "收束" && 帧.进度 < 立体卡片占比) {
    绘制卡片(图, 帧);
    return;
  }
  绘制幕面(图, 帧);
}

/** 强调：消失点晶核（灯色光晕 + 灯芯 + 十字灯条）；卡片阶段是包住卡片的灯色边光。 */
function 绘制强调(图: 图形对象, 帧: 转场帧): void {
  const 宽 = 正数(帧.宽);
  const 高 = 正数(帧.高);
  if (!(宽 > 0) || !(高 > 0)) return;
  if (帧.阶段 === "收束" && 帧.进度 < 立体卡片占比) {
    const 四 = 卡片四点(帧);
    const 点集 = 四点集(四);
    const 塌 = 卡片塌陷(帧);
    if (四.右上.x - 四.左上.x < 1.5) return;
    图.lineStyle(4, 面.灯, 0.2 + 0.22 * 塌).strokePoints(缩点集(点集, 中心(四), 1.03), true);
    return;
  }
  const p = 扩张进度(帧);
  if (!(p > 0)) return;
  const 点 = 消失点(帧);
  图
    .fillStyle(面.灯, 0.1 * p)
    .fillEllipse(点.x, 点.y, 宽 * 0.62 * p, 高 * 0.3 * p)
    .fillStyle(面.灯, 0.16 * p)
    .fillEllipse(点.x, 点.y, 宽 * 0.3 * p, 高 * 0.12 * p)
    .fillStyle(面.灯芯, 0.7 * p)
    .fillCircle(点.x, 点.y, 2 + 4 * p);
  图
    .fillStyle(面.灯, 0.45 * p)
    .fillRect(点.x - 宽 * 0.16 * p, 点.y - 1, 宽 * 0.32 * p, 2)
    .fillRect(点.x - 1, 点.y - 高 * 0.05 * p, 2, 高 * 0.1 * p)
    .fillStyle(面.灯芯, 0.6 * p)
    .fillRect(点.x - 宽 * 0.08 * p, 点.y - 0.5, 宽 * 0.16 * p, 1);
}

/** 节拍底纹：地平线灯带 + 透视网格 + 灯色底光 + 模式色节拍条，画在 Ready/Go 文字之下。 */
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

export const 立体画法: 转场画法 = {
  覆盖比,
  绘制遮罩,
  绘制强调,
  绘制节拍底纹,
};
