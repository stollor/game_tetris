import type { 图形对象 } from "../../../.gamemaker/依赖/框架/界面/绘制/协议";
import { 亮色, 暗色 } from "../../../.gamemaker/依赖/框架/界面/颜色工具";
import { 糖果规范 } from "../../主题/糖果/糖果规范";

/**
 * 果冻软糖方块：比宝石更钝的圆角、整圈糖衣亮边、顶部椭圆高光与底部内阴影，
 * 再撒几颗糖粒。幽灵投影沿用同一轮廓但只留糖霜描边，读作落点提示。
 *
 * 只依赖 `图形对象` 与 `糖果规范`；尺寸全部由调用方给的格宽推。
 */

function 圆角(格: number, 比例: number): number {
  return Math.max(2, Math.min(格 * 比例, 格 / 2));
}

/** 画一颗果冻方块（左上角定位）。 */
export function 绘制果冻单元(
  绘图: 图形对象,
  x: number,
  y: number,
  格: number,
  色值: number,
  透明度 = 1,
): void {
  const r = 圆角(格, 糖果规范.方块.圆角比);
  const 内缩 = Math.max(1, 格 * 0.06);
  const 深 = 暗色(色值, 0.62);
  // 底部软影：果冻压在巧克力格面上。
  绘图
    .fillStyle(糖果规范.色.巧克力深, 0.4 * 透明度)
    .fillRoundedRect(x + 1, y + Math.max(2, 格 * 0.06), 格 - 2, 格 - 2, r);
  // 深色外沿
  绘图.fillStyle(深, 0.95 * 透明度).fillRoundedRect(x, y, 格 - 1, 格 - 1, r);
  // 糖体
  绘图
    .fillStyle(色值, 0.97 * 透明度)
    .fillRoundedRect(
      x + 内缩,
      y + 内缩,
      格 - 1 - 内缩 * 2,
      格 - 1 - 内缩 * 2,
      Math.max(1.5, r * 0.86),
    );
  // 上半受光
  绘图
    .fillStyle(亮色(色值, 0.42), 0.5 * 透明度)
    .fillRoundedRect(
      x + 内缩 + 1,
      y + 内缩 + 1,
      格 - 3 - 内缩 * 2,
      (格 - 1) * 0.36,
      Math.max(1.5, r * 0.7),
    );
  // 顶部椭圆镜面高光
  绘图
    .fillStyle(0xffffff, 糖果规范.方块.高光透明 * 透明度)
    .fillEllipse(x + 格 * 0.34, y + 格 * 0.24, 格 * 0.42, 格 * 0.2);
  绘图
    .fillStyle(0xffffff, 0.28 * 透明度)
    .fillCircle(x + 格 * 0.28, y + 格 * 0.2, Math.max(0.8, 格 * 0.05));
  // 底部内阴影：果冻的通透感
  绘图
    .fillStyle(暗色(色值, 0.45), 糖果规范.方块.内阴影透明 * 透明度)
    .fillRoundedRect(
      x + 内缩 + 2,
      y + 格 * 0.62,
      格 - 3 - 内缩 * 2,
      格 * 0.22,
      Math.max(1.5, r * 0.5),
    );
  // 糖粒：按格宽决定颗数，位置固定不抖动（静态配方，不同帧不闪）。
  const 糖粒数 = 格 >= 18 ? 糖果规范.方块.糖粒数 : 1;
  const 位置 = [
    [0.24, 0.62],
    [0.66, 0.5],
    [0.55, 0.76],
    [0.8, 0.68],
  ] as const;
  for (let 序 = 0; 序 < 糖粒数; 序 += 1) {
    const [rx, ry] = 位置[序] ?? [0.5, 0.6];
    绘图
      .fillStyle(0xffffff, 0.3 * 透明度)
      .fillCircle(x + 格 * rx, y + 格 * ry, Math.max(0.6, 格 * 0.028));
  }
  // 整圈糖衣亮边 + 外沿描边
  绘图
    .lineStyle(Math.max(1, 格 * 0.035), 亮色(色值, 0.55), 0.72 * 透明度)
    .strokeRoundedRect(
      x + 内缩,
      y + 内缩,
      格 - 1 - 内缩 * 2,
      格 - 1 - 内缩 * 2,
      Math.max(1.5, r * 0.86),
    );
  绘图.lineStyle(1, 亮色(色值, 0.3), 0.6 * 透明度).strokeRoundedRect(x, y, 格 - 1, 格 - 1, r);
}

/** 幽灵投影：只留糖霜轮廓与很淡的糖体，不抢实块。 */
export function 绘制果冻幽灵(
  绘图: 图形对象,
  x: number,
  y: number,
  格: number,
  色值: number,
  透明度 = 1,
): void {
  const r = 圆角(格, 糖果规范.方块.幽灵圆角比);
  const 内缩 = Math.max(1, 格 * 0.1);
  绘图
    .fillStyle(色值, 0.1 * 透明度)
    .fillRoundedRect(x + 内缩, y + 内缩, 格 - 1 - 内缩 * 2, 格 - 1 - 内缩 * 2, r);
  绘图
    .lineStyle(Math.max(1, 格 * 0.05), 亮色(色值, 0.4), 0.65 * 透明度)
    .strokeRoundedRect(x + 内缩, y + 内缩, 格 - 1 - 内缩 * 2, 格 - 1 - 内缩 * 2, r);
  // 顶部两道奶油短弧，弱化提示
  const 角 = Math.max(2, 格 * 0.12);
  绘图.fillStyle(色值, 0.22 * 透明度);
  绘图.fillRect(x + 内缩, y + 内缩, 角, 1.5);
  绘图.fillRect(x + 内缩, y + 内缩, 1.5, 角);
  绘图.fillRect(x + 格 - 1 - 内缩 - 角, y + 格 - 1 - 内缩, 角, 1.5);
  绘图.fillRect(x + 格 - 1 - 内缩, y + 格 - 1 - 内缩 - 角, 1.5, 角);
}
