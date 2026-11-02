import type { 点 } from "../../../../.gamemaker/依赖/框架/界面/绘制/协议";
import type { 方块类型 } from "../../../../代码/玩法/再消一行";
import { type 糖果块样式, 糖果块样式表 } from "../../../主题/糖果/糖果方块外观";
import { 同角, 圆角多边形, type 角半径, type 边界 } from "../../基础/装饰与蒙层/圆角裁剪";

/**
 * 糖果方块几何：一组相邻同型格（一颗糖）的包围盒、格集与并块外形。
 *
 * 绘制模块只拿这个对象，不自己数格子：糖的朝向、哪几格连着、外露的是哪几条边，
 * 全在这里算好，模块只管「这颗糖长什么样」。
 */

export interface 格位 {
  列: number;
  行: number;
}

export interface 邻接 {
  上: boolean;
  下: boolean;
  左: boolean;
  右: boolean;
}

/** 内凹角：两条边各有同块邻格、对角却空着，并块外形要在这里补圆角。 */
export interface 内凹角 {
  x: number;
  y: number;
  横: 1 | -1;
  纵: 1 | -1;
  底部: boolean;
}

/** 单格在并块外形里的几何（世界坐标）。 */
export interface 格外形 {
  列: number;
  行: number;
  单元左: number;
  单元上: number;
  邻: 邻接;
  外: 边界;
  角: 角半径;
  厚: number;
  内凹: 内凹角[];
}

export interface 糖果块几何 {
  /** 一个格的边长。 */
  格: number;
  /** 包围盒左上角（世界坐标）。 */
  左: number;
  上: number;
  /** 包围盒占几格。 */
  列数: number;
  行数: number;
  /** 包围盒内的格集：`有(列, 行)` 判断某个相对格是否属于这颗糖。 */
  有: (列: number, 行: number) => boolean;
  种类: 方块类型;
  样式: 糖果块样式;
  透明度: number;
  /** 只有一格：调用方应画「单格体」。 */
  单格: boolean;
  /** 每行 / 每列的格数，用来判断主行（横条）、主列（竖条）与附属格。 */
  行格数: number[];
  列格数: number[];
  /** 包围盒四边是否外露（没有邻格），用于圆角与投影。 */
  外露: 邻接;
  /** 每格的并块外形，顺序与格集一致。 */
  格外形: 格外形[];
  /** 包围盒中心（世界坐标）。 */
  中心X: number;
  中心Y: number;
}

/** 缝：并块内两格之间不留缝，只有外露边内缩一点，糖才不会糊成一块。 */
const 缝比 = 0.06;
const 厚比 = 0.12;
const 圆角比 = 0.3;

function 键(列: number, 行: number): string {
  return `${列},${行}`;
}

/**
 * 由一组相对格位建几何。`原点X/原点Y` 是包围盒左上角（世界坐标）。
 * 调用方保证 `格位` 至少一格且已在包围盒坐标系里。
 */
export function 构建几何(
  原点X: number,
  原点Y: number,
  格: number,
  格位: readonly 格位[],
  种类: 方块类型,
  透明度 = 1,
): 糖果块几何 {
  let 最小列 = Number.POSITIVE_INFINITY;
  let 最小行 = Number.POSITIVE_INFINITY;
  let 最大列 = Number.NEGATIVE_INFINITY;
  let 最大行 = Number.NEGATIVE_INFINITY;
  for (const 位 of 格位) {
    最小列 = Math.min(最小列, 位.列);
    最小行 = Math.min(最小行, 位.行);
    最大列 = Math.max(最大列, 位.列);
    最大行 = Math.max(最大行, 位.行);
  }
  // 注意：调用方给的是棋盘上的绝对格位，而 `有()/行格数/列格数/邻接` 一律按包围盒相对下标，
  // 所以格集必须在这里归一到相对下标，否则整颗糖的"有某格"会全判成 false（历史上真踩过）。
  const 格集 = new Set(格位.map((位) => 键(位.列 - 最小列, 位.行 - 最小行)));
  const 列数 = 最大列 - 最小列 + 1;
  const 行数 = 最大行 - 最小行 + 1;
  const 有 = (列: number, 行: number) => 格集.has(键(列, 行));
  const 左 = 原点X + 最小列 * 格;
  const 上 = 原点Y + 最小行 * 格;
  const 行格数: number[] = [];
  for (let 行 = 0; 行 < 行数; 行 += 1) {
    let 数 = 0;
    for (let 列 = 0; 列 < 列数; 列 += 1) if (有(列, 行)) 数 += 1;
    行格数.push(数);
  }
  const 列格数: number[] = [];
  for (let 列 = 0; 列 < 列数; 列 += 1) {
    let 数 = 0;
    for (let 行 = 0; 行 < 行数; 行 += 1) if (有(列, 行)) 数 += 1;
    列格数.push(数);
  }
  const 缝 = Math.max(0.6, 格 * 缝比);

  const 格外形: 格外形[] = [];
  for (const 位 of 格位) {
    const 列 = 位.列 - 最小列;
    const 行 = 位.行 - 最小行;
    const 单元左 = 左 + 列 * 格;
    const 单元上 = 上 + 行 * 格;
    const 邻: 邻接 = {
      上: 有(列, 行 - 1),
      下: 有(列, 行 + 1),
      左: 有(列 - 1, 行),
      右: 有(列 + 1, 行),
    };
    const 外: 边界 = {
      左: 邻.左 ? 单元左 : 单元左 + 缝,
      上: 邻.上 ? 单元上 : 单元上 + 缝,
      右: 邻.右 ? 单元左 + 格 : 单元左 + 格 - 缝,
      下: 邻.下 ? 单元上 + 格 : 单元上 + 格 - 缝,
    };
    const R = 格 * 圆角比;
    const 角: 角半径 = {
      左上: !邻.上 && !邻.左 ? R : 0,
      右上: !邻.上 && !邻.右 ? R : 0,
      右下: !邻.下 && !邻.右 ? R : 0,
      左下: !邻.下 && !邻.左 ? R : 0,
    };
    const 内凹: 内凹角[] = [];
    for (const [横, 纵] of [
      [1, -1],
      [-1, -1],
      [1, 1],
      [-1, 1],
    ] as const) {
      const 横邻 = 横 > 0 ? 邻.右 : 邻.左;
      const 纵邻 = 纵 > 0 ? 邻.下 : 邻.上;
      if (!横邻 || !纵邻 || 有(列 + 横, 行 + 纵)) continue;
      内凹.push({
        x: 横 > 0 ? 单元左 + 格 - 缝 : 单元左 + 缝,
        y: 纵 > 0 ? 单元上 + 格 - 缝 : 单元上 + 缝,
        横,
        纵,
        底部: 纵 > 0,
      });
    }
    格外形.push({
      列,
      行,
      单元左,
      单元上,
      邻,
      外,
      角,
      厚: 邻.下 ? 0 : Math.max(1.2, 格 * 厚比),
      内凹,
    });
  }

  return {
    格,
    左,
    上,
    列数,
    行数,
    有,
    种类,
    样式: 糖果块样式表[种类],
    透明度,
    单格: 格位.length === 1,
    行格数,
    列格数,
    外露: {
      上: 格形状外露(行格数, "上"),
      下: 格形状外露(行格数, "下"),
      左: 格形状外露(列格数, "左"),
      右: 格形状外露(列格数, "右"),
    },
    格外形,
    中心X: 左 + (列数 * 格) / 2,
    中心Y: 上 + (行数 * 格) / 2,
  };
}

function 格形状外露(每线格数: readonly number[], 向: "上" | "下" | "左" | "右"): boolean {
  return 向 === "上" || 向 === "左"
    ? (每线格数[0] ?? 0) < (每线格数.reduce((a, b) => Math.max(a, b), 0) || 1) ||
        (每线格数[0] ?? 0) > 0
    : (每线格数.at(-1) ?? 0) > 0;
}

/* ------------------------------------------------------------------ */
/* 并块外形                                                            */
/* ------------------------------------------------------------------ */

export function 外扩边界(边: 边界, 邻: 邻接, 量: number): 边界 {
  return {
    左: 边.左 - (邻.左 ? 0 : 量),
    上: 边.上 - (邻.上 ? 0 : 量),
    右: 边.右 + (邻.右 ? 0 : 量),
    下: 边.下 + (邻.下 ? 0 : 量),
  };
}

export function 加角(角: 角半径, 量: number): 角半径 {
  const 加 = (r: number) => (r > 0 ? r + 量 : 0);
  return { 左上: 加(角.左上), 右上: 加(角.右上), 右下: 加(角.右下), 左下: 加(角.左下) };
}

/** 内凹补角：凹点外侧一块方角减去四分之一圆，外扩时整体沿空角方向平移。 */
export function 内凹补角点(凹: 内凹角, 半径: number, 外扩: number): 点[] {
  const px = 凹.x + 凹.横 * 外扩;
  const py = 凹.y + 凹.纵 * 外扩;
  const cx = px + 凹.横 * 半径;
  const cy = py + 凹.纵 * 半径;
  const 起 = Math.atan2(-凹.纵, 0);
  let 差 = Math.atan2(0, -凹.横) - 起;
  if (差 > Math.PI) 差 -= Math.PI * 2;
  if (差 < -Math.PI) 差 += Math.PI * 2;
  const 点集: 点[] = [{ x: px, y: py }];
  for (let i = 0; i <= 6; i += 1) {
    const a = 起 + (差 * i) / 6;
    点集.push({ x: cx + Math.cos(a) * 半径, y: cy + Math.sin(a) * 半径 });
  }
  return 点集;
}

/** 糖面边界：每格去掉底部糖厚。 */
export function 糖面边界(外形: 格外形): 边界 {
  return { ...外形.外, 下: 外形.外.下 - 外形.厚 };
}

/**
 * 画并块外形（投影 → 深色描边 → 暗侧边 → 主色糖面），返回糖面多边形供模块叠花纹。
 * 外扩量按格宽推，模块通常不用改。
 */
export function 画并块外形(
  绘图: {
    fillStyle(颜色: number, 透明度?: number): unknown;
    fillPoints(点集: readonly 点[], 闭合?: boolean): unknown;
  },
  几何: 糖果块几何,
  选项: { 投影?: boolean; 圆角比?: number } = {},
): 点[][] {
  const 描边 = Math.max(0.8, 几何.格 * 0.055);
  const 补角 = 几何.格 * 0.2;
  const 投影 = 选项.投影 === false ? 0 : 几何.格 * 0.1;
  const 透明度 = 几何.透明度;
  const 深 = 几何.样式.深色;
  const 主 = 几何.样式.主色;
  const 暗 = 暗侧(几何.样式);
  const 面列表: 点[][] = [];

  if (投影 > 0) {
    for (const 项 of 几何.格外形) {
      const 边 = 外扩边界(项.外, 项.邻, 描边);
      绘图.fillStyle(0x1c0a08, 0.32 * 透明度);
      绘图.fillPoints(
        圆角多边形({ ...边, 上: 边.上 + 投影, 下: 边.下 + 投影 }, 加角(项.角, 描边)),
        true,
      );
    }
  }
  for (const 项 of 几何.格外形) {
    绘图.fillStyle(深, 透明度);
    绘图.fillPoints(圆角多边形(外扩边界(项.外, 项.邻, 描边), 加角(项.角, 描边)), true);
    for (const 凹 of 项.内凹) 绘图.fillPoints(内凹补角点(凹, 补角, 描边), true);
  }
  for (const 项 of 几何.格外形) {
    绘图.fillStyle(暗, 透明度);
    绘图.fillPoints(圆角多边形(项.外, 项.角), true);
    for (const 凹 of 项.内凹) if (凹.底部) 绘图.fillPoints(内凹补角点(凹, 补角, 0), true);
  }
  for (const 项 of 几何.格外形) {
    const 面 = 圆角多边形(糖面边界(项), 项.角);
    面列表.push(面);
    绘图.fillStyle(主, 透明度);
    绘图.fillPoints(面, true);
    for (const 凹 of 项.内凹) if (!凹.底部) 绘图.fillPoints(内凹补角点(凹, 补角, 0), true);
  }
  return 面列表;
}

/** 暗侧边：主色压暗一档，糖底读作有厚度。 */
export function 暗侧(样式: 糖果块样式): number {
  const r = (样式.主色 >> 16) & 0xff;
  const g = (样式.主色 >> 8) & 0xff;
  const b = 样式.主色 & 0xff;
  const 混 = (值: number, 目标: number) => Math.round(值 * 0.62 + 目标 * 0.38);
  return (
    (混(r, (样式.深色 >> 16) & 0xff) << 16) |
    (混(g, (样式.深色 >> 8) & 0xff) << 8) |
    混(b, 样式.深色 & 0xff)
  );
}

/** 包围盒内的圆角矩形（巧克力、蛋挞这类整块糖自己定外形时用）。 */
export function 圆角块(几何: 糖果块几何, 内缩: number, 圆角: number): 点[] {
  const 边: 边界 = {
    左: 几何.左 + 内缩,
    上: 几何.上 + 内缩,
    右: 几何.左 + 几何.列数 * 几何.格 - 内缩,
    下: 几何.上 + 几何.行数 * 几何.格 - 内缩,
  };
  return 圆角多边形(边, 同角(圆角));
}

/** 相对格中心的格心坐标。 */
export function 格心(几何: 糖果块几何, 列: number, 行: number): 点 {
  return {
    x: 几何.左 + (列 + 0.5) * 几何.格,
    y: 几何.上 + (行 + 0.5) * 几何.格,
  };
}
