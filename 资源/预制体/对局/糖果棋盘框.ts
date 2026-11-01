import type { 图形对象 } from "../../../.gamemaker/依赖/框架/界面/绘制/协议";
import { 混色 } from "../../../.gamemaker/依赖/框架/界面/颜色工具";
import { 糖果规范 } from "../../主题/糖果/糖果规范";
import { 同角, 圆角多边形, 斜带, 裁进凸形 } from "../基础/装饰与蒙层/圆角裁剪";

/**
 * 糖果棋盘框：玫瑰木框带压细密糖棍斜纹，井口一圈深唇加浅色裱线，
 * 井底铺一排糖霜花边；井本身是上浅下深的巧克力，顶部压一道内阴影。
 * 坐标是棋盘内区（格子区）的左上角与宽高，框带向外长。
 */

const 色 = 糖果规范.色;

export function 读取糖果框厚(格子: number): number {
  return Math.max(9, 格子 * 0.42);
}

export function 绘制糖果棋盘框(
  绘图: 图形对象,
  左: number,
  上: number,
  宽: number,
  高: number,
  格子: number,
  透明度 = 1,
): void {
  const 框 = 读取糖果框厚(格子);
  const 外 = { 左: 左 - 框, 上: 上 - 框, 右: 左 + 宽 + 框, 下: 上 + 高 + 框 };
  const 外宽 = 外.右 - 外.左;
  const 外高 = 外.下 - 外.上;
  const 外圆 = Math.max(12, 格子 * 0.62);
  const 内圆 = Math.max(6, 外圆 - 框 * 0.55);
  for (let 层 = 3; 层 >= 1; 层 -= 1)
    绘图
      .fillStyle(0x12060a, (0.2 - 层 * 0.045) * 透明度)
      .fillRoundedRect(
        外.左 - 层 * 2,
        外.上 + 层 * 3 + 2,
        外宽 + 层 * 4,
        外高 + 层 * 2,
        外圆 + 层 * 2,
      );
  绘图
    .fillStyle(色.莓暗, 透明度)
    .fillRoundedRect(外.左 - 1.5, 外.上 - 1.5, 外宽 + 3, 外高 + 3, 外圆 + 1.5);
  const 框形 = 圆角多边形(外, 同角(外圆));
  绘图
    .fillGradientStyle(色.莓亮, 色.莓亮, 色.莓, 色.莓, 透明度, 透明度, 透明度, 透明度)
    .fillPoints(框形, true);
  const 周期 = 8;
  const 条宽 = 3;
  绘图.fillStyle(色.莓浅, 0.42 * 透明度);
  for (let s = Math.floor((外.左 - 外.下) / 周期) * 周期; s < 外.右 - 外.上; s += 周期) {
    const 带 = 裁进凸形(斜带(s, 条宽, 外.上, 外.下), 框形);
    if (带.length >= 3) 绘图.fillPoints(带, true);
  }
  绘图
    .lineStyle(1.3, 色.莓浅, 0.75 * 透明度)
    .strokeRoundedRect(外.左 + 1.6, 外.上 + 1.6, 外宽 - 3.2, 外高 - 3.2, 外圆 - 1.6);
  // 井口：深唇压住条纹，再一圈浅色裱线把井和框分开。
  绘图.fillStyle(色.莓暗, 透明度).fillRoundedRect(左 - 3.5, 上 - 3.5, 宽 + 7, 高 + 7, 内圆 + 3);
  绘图
    .lineStyle(1.4, 色.莓浅, 0.85 * 透明度)
    .strokeRoundedRect(左 - 2.4, 上 - 2.4, 宽 + 4.8, 高 + 4.8, 内圆 + 2);
  const 井亮 = 混色(色.井, 色.莓深, 0.45);
  绘图
    .fillGradientStyle(井亮, 井亮, 色.井, 色.井, 透明度, 透明度, 透明度, 透明度)
    .fillRoundedRect(左, 上, 宽, 高, 内圆);
  绘图
    .fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0.42 * 透明度, 0.42 * 透明度, 0, 0)
    .fillRoundedRect(左, 上, 宽, 格子 * 0.9, 内圆);
  for (const [x, 向] of [
    [左, 1],
    [左 + 宽 - 格子 * 0.35, -1],
  ] as const)
    绘图
      .fillGradientStyle(
        0x000000,
        0x000000,
        0x000000,
        0x000000,
        向 > 0 ? 0.24 * 透明度 : 0,
        向 > 0 ? 0 : 0.24 * 透明度,
        向 > 0 ? 0.24 * 透明度 : 0,
        向 > 0 ? 0 : 0.24 * 透明度,
      )
      .fillRect(x, 上 + 内圆, 格子 * 0.35, 高 - 内圆 * 2);
  绘制井底花边(绘图, 左, 上 + 高, 宽, 格子, 透明度);
  绘制框角糖钉(绘图, 外, 框, 透明度);
}

/** 井底糖霜花边：一排半圆从框带探进井底，落下的糖会压在花边上。 */
function 绘制井底花边(
  绘图: 图形对象,
  左: number,
  底: number,
  宽: number,
  格子: number,
  透明度: number,
): void {
  const 半径 = Math.max(3, 格子 * 0.17);
  const 数 = Math.max(4, Math.round(宽 / (半径 * 2.2)));
  const 步 = 宽 / 数;
  绘图.fillStyle(色.莓暗, 透明度);
  for (let 序 = 0; 序 <= 数; 序 += 1) 绘图.fillCircle(左 + 序 * 步, 底 + 0.5, 半径 + 1.2);
  绘图.fillStyle(色.莓, 透明度);
  for (let 序 = 0; 序 <= 数; 序 += 1) 绘图.fillCircle(左 + 序 * 步, 底 + 0.5, 半径);
  绘图.fillStyle(色.莓浅, 0.55 * 透明度);
  for (let 序 = 0; 序 <= 数; 序 += 1)
    绘图.fillCircle(左 + 序 * 步 - 半径 * 0.25, 底 - 半径 * 0.35, 半径 * 0.32);
}

/** 框角四颗糖钉：圆糖压在框带转角，给长框一个收口。 */
function 绘制框角糖钉(
  绘图: 图形对象,
  外: { 左: number; 上: number; 右: number; 下: number },
  框: number,
  透明度: number,
): void {
  const r = 框 * 0.36;
  for (const [x, y] of [
    [外.左 + 框 * 0.62, 外.上 + 框 * 0.62],
    [外.右 - 框 * 0.62, 外.上 + 框 * 0.62],
    [外.左 + 框 * 0.62, 外.下 - 框 * 0.62],
    [外.右 - 框 * 0.62, 外.下 - 框 * 0.62],
  ] as const) {
    绘图.fillStyle(色.莓暗, 0.9 * 透明度).fillCircle(x, y + 0.8, r + 0.8);
    绘图.fillStyle(色.象牙, 透明度).fillCircle(x, y, r);
    绘图.fillStyle(色.草莓深, 0.45 * 透明度).fillCircle(x + r * 0.15, y + r * 0.2, r * 0.6);
    绘图.fillStyle(0xffffff, 0.8 * 透明度).fillCircle(x - r * 0.32, y - r * 0.35, r * 0.3);
  }
}

/** 井内点阵：只在格点放一颗很淡的糖粒，不画网格线。 */
export function 绘制糖果井点阵(绘图: 图形对象, 格子: number, 列数: number, 行数: number): void {
  绘图.fillStyle(色.莓亮, 0.32);
  for (let 列 = 1; 列 < 列数; 列 += 1)
    for (let 行 = 1; 行 < 行数; 行 += 1) 绘图.fillCircle(列 * 格子, 行 * 格子, 1.15);
}
