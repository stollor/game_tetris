import type { 图形对象, 点 } from "../../../../.gamemaker/依赖/框架/界面/绘制/协议";
import { 同角, 圆角多边形, 裁进凸形, type 边界 } from "../../基础/装饰与蒙层/圆角裁剪";
import { 暗侧, type 糖果块几何 } from "./几何";

/**
 * 棒棒糖（T 型）：一格一块棒棒糖方糖。
 *
 * 糖体是圆角方身（不是正圆，满盘才和别的方块读成同一套），糖面绕一颗连续的奶油螺旋，
 * 再撒几粒高饱和糖针。所有花纹都是纯色多边形，用 `裁进凸形` 收进糖面。
 */
type 头轴 = "横" | "竖";

/** 糖体局部坐标系：长轴沿「沿」、短轴沿「垂」，坐标以糖心为原点，单位是逻辑像素。 */
interface 糖头基 {
  心X: number;
  心Y: number;
  沿X: number;
  沿Y: number;
  垂X: number;
  垂Y: number;
  /** 长轴半长、短轴半宽。 */
  长半: number;
  短半: number;
}

function 建基(心X: number, 心Y: number, 长半: number, 短半: number, 轴: 头轴): 糖头基 {
  return 轴 === "横"
    ? { 心X, 心Y, 沿X: 1, 沿Y: 0, 垂X: 0, 垂Y: 1, 长半, 短半 }
    : { 心X, 心Y, 沿X: 0, 沿Y: 1, 垂X: -1, 垂Y: 0, 长半, 短半 };
}

/** 局部坐标（沿轴、横向）换算到世界坐标。 */
function 定位(基: 糖头基, 沿: number, 垂: number): 点 {
  return {
    x: 基.心X + 基.沿X * 沿 + 基.垂X * 垂,
    y: 基.心Y + 基.沿Y * 沿 + 基.垂Y * 垂,
  };
}

/** 四边各向内收 `量`；保证收完仍是正着的矩形（极小格时退化也画得出）。 */
function 内缩边(边: 边界, 量: number): 边界 {
  const 横量 = Math.min(量, (边.右 - 边.左) * 0.34);
  const 纵量 = Math.min(量, (边.下 - 边.上) * 0.34);
  return { 左: 边.左 + 横量, 上: 边.上 + 纵量, 右: 边.右 - 横量, 下: 边.下 - 纵量 };
}

/**
 * 粗圆弧带：沿椭圆弧铺一条带子，半径从 `起比` 长到 `止比`（相对糖面半长/半宽），
 * 厚度从 `厚起` 收到 `厚止`；整条弧就是螺旋。
 */
function 弧带(
  基: 糖头基,
  起比: number,
  止比: number,
  厚起: number,
  厚止: number,
  起角: number,
  止角: number,
): 点[] {
  const 段 = Math.max(5, Math.ceil(Math.abs(止角 - 起角) / 0.16));
  const 外: 点[] = [];
  const 内: 点[] = [];
  for (let i = 0; i <= 段; i += 1) {
    const t = i / 段;
    const 角 = 起角 + (止角 - 起角) * t;
    const 比 = 起比 + (止比 - 起比) * t;
    const 余 = Math.cos(角);
    const 正 = Math.sin(角);
    const 偏 = (厚起 + (厚止 - 厚起) * t) / 2;
    外.push(定位(基, 余 * 比 * 基.长半 + 余 * 偏, 正 * 比 * 基.短半 + 正 * 偏));
    内.push(定位(基, 余 * 比 * 基.长半 - 余 * 偏, 正 * 比 * 基.短半 - 正 * 偏));
  }
  return [...外, ...内.reverse()];
}

/** 糖针：绕糖心定位的一根圆角斜条。 */
function 糖针(基: 糖头基, 沿: number, 垂: number, 长: number, 宽: number, 倾斜: number): 点[] {
  const 角 = Math.atan2(基.沿Y, 基.沿X) + 倾斜;
  const 余弦 = Math.cos(角);
  const 正弦 = Math.sin(角);
  const 原形 = 圆角多边形({ 左: -长 / 2, 上: -宽 / 2, 右: 长 / 2, 下: 宽 / 2 }, 同角(宽 / 2));
  return 原形.map((p) => 定位(基, 沿 + p.x * 余弦 - p.y * 正弦, 垂 + p.x * 正弦 + p.y * 余弦));
}

/**
 * 糖体三层：深色描边 → 主色糖面 → 底部一档暗带（纯色，不用渐变）。
 * 返回糖面（描边内侧）多边形，花纹裁进它才不会压到描边。
 */
function 画糖体(绘图: 图形对象, 边: 边界, 圆头: number, 描边: number, 几何: 糖果块几何): 点[] {
  const { 样式, 透明度 } = 几何;
  const 外形 = 圆角多边形(边, 同角(圆头));
  绘图.fillStyle(样式.深色, 透明度);
  绘图.fillPoints(外形, true);

  const 内边 = 内缩边(边, 描边);
  const 内形 = 圆角多边形(内边, 同角(Math.max(0.5, 圆头 - 描边)));
  绘图.fillStyle(样式.主色, 透明度);
  绘图.fillPoints(内形, true);

  const 高 = 内边.下 - 内边.上;
  const 带高 = 高 * 0.16;
  const 暗带 = 裁进凸形(
    [
      { x: 内边.左, y: 内边.下 - 带高 },
      { x: 内边.右, y: 内边.下 - 带高 },
      { x: 内边.右, y: 内边.下 },
      { x: 内边.左, y: 内边.下 },
    ],
    内形,
  );
  if (暗带.length >= 3) {
    绘图.fillStyle(暗侧(样式), 0.4 * 透明度);
    绘图.fillPoints(暗带, true);
  }
  return 内形;
}

/** 糖面上的奶油螺旋：一条半径从外缘收到糖心、同时绕一圈多的连续粗弧，纯色，裁进糖面。 */
function 画螺旋(
  绘图: 图形对象,
  基: 糖头基,
  糖面: readonly 点[],
  几何: 糖果块几何,
  尺度: number,
): void {
  const { 样式, 透明度 } = 几何;
  const 短径 = 基.短半 * 2;
  const 圈 = Math.PI * 2 * 1.15;
  const 起角 = -1.9;
  const 厚起 = 短径 * 0.26 * 尺度;
  const 厚止 = 短径 * 0.11 * 尺度;
  绘图.fillStyle(样式.装饰, 透明度);
  const 带 = 裁进凸形(弧带(基, 0.95 * 尺度, 0.1 * 尺度, 厚起, 厚止, 起角, 起角 + 圈), 糖面);
  if (带.length >= 3) 绘图.fillPoints(带, true);
  // 螺旋收在糖心，留一颗主色小圆点当螺旋眼
  const 心眼 = Math.max(1, 基.短半 * 0.13 * 尺度);
  绘图.fillStyle(样式.主色, 透明度);
  绘图.fillCircle(基.心X, 基.心Y, 心眼);
}

/** 糖针：25px 格下密度太高（满盘会乱），格 < 30 只撒两粒；优先用高饱和点缀色轮换。 */
function 画糖针(绘图: 图形对象, 基: 糖头基, 糖面: readonly 点[], 几何: 糖果块几何): void {
  const { 格, 样式, 透明度 } = 几何;
  const 小数 = 格 < 30;
  const 直径 = 基.短半 * 2;
  const 长 = 直径 * 0.36;
  const 宽 = Math.max(1.8, 直径 * 0.13);
  const 色表 = 样式.点缀?.length ? 样式.点缀 : [样式.装饰, 样式.浅色, 样式.装饰深];
  const 位表: readonly (readonly [number, number, number])[] = [
    [-0.44, -0.24, -0.7],
    [-0.28, 0.28, -0.5],
    [0.4, 0.02, -0.56],
  ];
  const 数 = 小数 ? 2 : 位表.length;
  for (let 序 = 0; 序 < 数; 序 += 1) {
    const 位 = 位表[序];
    if (!位) continue;
    const 条 = 裁进凸形(糖针(基, 位[0] * 基.长半, 位[1] * 直径, 长, 宽, 位[2]), 糖面);
    if (条.length < 3) continue;
    绘图.lineStyle(Math.max(0.45, 格 * 0.022), 样式.深色, 0.45 * 透明度);
    绘图.strokePoints(条, true);
    绘图.fillStyle(色表[序 % 色表.length] ?? 样式.装饰, 透明度);
    绘图.fillPoints(条, true);
  }
}

export function 绘制棒棒糖(绘图: 图形对象, 几何: 糖果块几何): void {
  const { 格, 透明度 } = 几何;
  const 描边 = Math.max(1.1, 格 * 0.075);
  const 内缩 = Math.max(0.7, 格 * 0.04);
  const 边: 边界 = {
    左: 几何.左 + 内缩,
    上: 几何.上 + 内缩,
    右: 几何.右 - 内缩,
    下: 几何.下 - 内缩,
  };
  const 半径 = Math.min(边.右 - 边.左, 边.下 - 边.上) / 2;
  // 圆角收掉三成半径：糖体是「方糖」而不是正圆，满盘才和别的方块读成同一套。
  const 圆角 = 半径 * 0.7;
  const 基 = 建基((边.左 + 边.右) / 2, (边.上 + 边.下) / 2, 半径, 半径, "横");

  绘图.fillStyle(0x1c0a08, 0.3 * 透明度);
  绘图.fillPoints(
    圆角多边形({ ...边, 上: 边.上 + 格 * 0.08, 下: 边.下 + 格 * 0.08 }, 同角(圆角)),
    true,
  );

  const 糖面 = 画糖体(绘图, 边, 圆角, 描边, 几何);
  画螺旋(绘图, 基, 糖面, 几何, 0.95);
  画糖针(绘图, 基, 糖面, 几何);
}
