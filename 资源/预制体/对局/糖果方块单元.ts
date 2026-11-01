import type { 图形对象 } from "../../../.gamemaker/依赖/框架/界面/绘制/协议";
import { 亮色, 暗色 } from "../../../.gamemaker/依赖/框架/界面/颜色工具";
import type { 方块类型 } from "../../../代码/玩法/再消一行";
import { 糖果规范 } from "../../主题/糖果/糖果规范";

/**
 * 果冻软糖方块：竖向渐变的糖体、整圈糖衣亮边、顶部椭圆镜面高光与底部内阴影，
 * 再按方块类型加糖纹（I 薄荷条纹、O 黄油饼干、L 奶油条、J 蓝莓糖粒、其余纯果冻）。
 *
 * 只依赖 `图形对象` 与 `糖果规范`；尺寸全部由调用方给的格宽推。
 */

function 圆角(格: number, 比例: number): number {
  return Math.max(2, Math.min(格 * 比例, 格 / 2));
}

/** 糖纹：把「糖果包装」的类型差异画在糖体内部，不用改方块形状。 */
function 绘制糖纹(
  绘图: 图形对象,
  x: number,
  y: number,
  格: number,
  类型: 方块类型 | undefined,
  透明度: number,
): void {
  const 内缩 = Math.max(1, 格 * 0.06);
  const 内左 = x + 内缩 + 1;
  const 内上 = y + 内缩 + 1;
  const 内宽 = 格 - 3 - 内缩 * 2;
  const 内高 = 格 - 3 - 内缩 * 2;
  const 白 = 糖果规范.色.白;
  if (类型 === "I") {
    // 薄荷糖条：两条斜白纹。
    绘图.fillStyle(白, 0.55 * 透明度);
    for (const 偏 of [0.18, 0.58]) {
      const 斜 = 格 * 0.34;
      绘图.fillPoints(
        [
          { x: 内左 + 内宽 * 偏, y: 内上 },
          { x: 内左 + 内宽 * 偏 + 格 * 0.1, y: 内上 },
          { x: 内左 + 内宽 * 偏 + 格 * 0.1 - 斜, y: 内上 + 内高 },
          { x: 内左 + 内宽 * 偏 - 斜, y: 内上 + 内高 },
        ],
        true,
      );
    }
    return;
  }
  if (类型 === "O") {
    // 黄油饼干：中心奶油夹心方块。
    const 边 = Math.max(2, 格 * 0.16);
    绘图
      .fillStyle(糖果规范.色.奶油, 0.95 * 透明度)
      .fillRoundedRect(
        内左 + 边,
        内上 + 边,
        内宽 - 边 * 2,
        内高 - 边 * 2,
        Math.max(1.5, 格 * 0.08),
      );
    绘图
      .fillStyle(亮色(糖果规范.色.奶油, 0.2), 0.8 * 透明度)
      .fillRoundedRect(
        内左 + 边 + 1,
        内上 + 边 + 1,
        内宽 - 边 * 2 - 2,
        Math.max(1, (内高 - 边 * 2) * 0.4),
        2,
      );
    return;
  }
  if (类型 === "L") {
    // 橙子糖：中间一条奶油夹心带。
    const 带高 = Math.max(2, 内高 * 0.2);
    绘图
      .fillStyle(糖果规范.色.奶油, 0.9 * 透明度)
      .fillRoundedRect(内左, 内上 + 内高 * 0.4, 内宽, 带高, 带高 / 2);
    return;
  }
  if (类型 === "J") {
    // 蓝莓果冻：三颗糖粒。
    绘图.fillStyle(白, 0.5 * 透明度);
    for (const [rx, ry] of [
      [0.32, 0.42],
      [0.62, 0.36],
      [0.5, 0.68],
    ] as const)
      绘图.fillCircle(内左 + 内宽 * rx, 内上 + 内高 * ry, Math.max(0.8, 格 * 0.045));
    return;
  }
  // 其余果冻：细糖粒。
  绘图.fillStyle(白, 0.32 * 透明度);
  for (const [rx, ry] of [
    [0.28, 0.62],
    [0.62, 0.5],
    [0.46, 0.78],
  ] as const)
    绘图.fillCircle(内左 + 内宽 * rx, 内上 + 内高 * ry, Math.max(0.6, 格 * 0.028));
}

/** 画一颗果冻方块（左上角定位）。 */
export function 绘制果冻单元(
  绘图: 图形对象,
  x: number,
  y: number,
  格: number,
  色值: number,
  透明度 = 1,
  类型?: 方块类型,
): void {
  const r = 圆角(格, 糖果规范.方块.圆角比);
  const 内缩 = Math.max(1, 格 * 0.06);
  const 深 = 暗色(色值, 0.6);
  const 内宽 = 格 - 1 - 内缩 * 2;
  // 底部软影：果冻压在巧克力格面上。
  绘图
    .fillStyle(糖果规范.色.巧克力深, 0.42 * 透明度)
    .fillRoundedRect(x + 1, y + Math.max(2, 格 * 0.07), 格 - 2, 格 - 2, r);
  // 深色外沿
  绘图.fillStyle(深, 0.95 * 透明度).fillRoundedRect(x, y, 格 - 1, 格 - 1, r);
  // 糖体：纯色打底保证主题色可识别，再叠一层上白下黑的透明渐变做出果冻体积。
  绘图
    .fillStyle(色值, 0.97 * 透明度)
    .fillRoundedRect(x + 内缩, y + 内缩, 内宽, 内宽, Math.max(1.5, r * 0.88));
  绘图
    .fillGradientStyle(
      0xffffff,
      0xffffff,
      0x000000,
      0x000000,
      0.26 * 透明度,
      0.18 * 透明度,
      0.16 * 透明度,
      0.06 * 透明度,
    )
    .fillRoundedRect(x + 内缩, y + 内缩, 内宽, 内宽, Math.max(1.5, r * 0.88));
  // 糖纹（类型差异）
  绘制糖纹(绘图, x, y, 格, 类型, 透明度);
  // 顶部椭圆镜面高光 + 小亮点
  绘图
    .fillStyle(0xffffff, 糖果规范.方块.高光透明 * 透明度)
    .fillEllipse(x + 格 * 0.36, y + 格 * 0.24, 格 * 0.44, 格 * 0.2);
  绘图
    .fillStyle(0xffffff, 0.6 * 透明度)
    .fillCircle(x + 格 * 0.27, y + 格 * 0.19, Math.max(0.9, 格 * 0.055));
  // 底部内阴影：果冻的通透感
  绘图
    .fillStyle(暗色(色值, 0.5), 糖果规范.方块.内阴影透明 * 透明度)
    .fillRoundedRect(x + 内缩 + 2, y + 格 * 0.64, 内宽 - 4, 格 * 0.2, Math.max(1.5, r * 0.5));
  // 左上受光棱 + 整圈糖衣亮边 + 外沿描边
  绘图
    .lineStyle(Math.max(1.2, 格 * 0.045), 亮色(色值, 0.6), 0.8 * 透明度)
    .strokeRoundedRect(x + 内缩, y + 内缩, 内宽, 内宽, Math.max(1.5, r * 0.88));
  绘图.lineStyle(1, 亮色(色值, 0.34), 0.65 * 透明度).strokeRoundedRect(x, y, 格 - 1, 格 - 1, r);
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
    .fillStyle(色值, 0.12 * 透明度)
    .fillRoundedRect(x + 内缩, y + 内缩, 格 - 1 - 内缩 * 2, 格 - 1 - 内缩 * 2, r);
  绘图
    .lineStyle(Math.max(1.2, 格 * 0.055), 亮色(色值, 0.45), 0.7 * 透明度)
    .strokeRoundedRect(x + 内缩, y + 内缩, 格 - 1 - 内缩 * 2, 格 - 1 - 内缩 * 2, r);
  // 顶部两道奶油短弧，弱化提示
  const 角 = Math.max(2, 格 * 0.12);
  绘图.fillStyle(色值, 0.26 * 透明度);
  绘图.fillRect(x + 内缩, y + 内缩, 角, 1.5);
  绘图.fillRect(x + 内缩, y + 内缩, 1.5, 角);
  绘图.fillRect(x + 格 - 1 - 内缩 - 角, y + 格 - 1 - 内缩, 角, 1.5);
  绘图.fillRect(x + 格 - 1 - 内缩, y + 格 - 1 - 内缩 - 角, 1.5, 角);
}
