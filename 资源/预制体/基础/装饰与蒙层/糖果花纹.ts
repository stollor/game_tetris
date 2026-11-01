import type { 图形对象 } from "../../../../.gamemaker/依赖/框架/界面/绘制/协议";
import { 亮色 } from "../../../../.gamemaker/依赖/框架/界面/颜色工具";
import { 糖果规范 } from "../../../主题/糖果/糖果规范";

/**
 * 糖果主题的装饰花纹原语：扇贝花边、奶油裱花线、糖粒与蝴蝶结。
 *
 * 只依赖 `图形对象` 与 `糖果规范`，不读设置/场景，供面板、按钮、背景与商店共用。
 * 位置一律按调用方给的矩形/边算，不在这里假设任何布局。
 */

/** 沿矩形一条边画扇贝花边（半圆凸出方向由 `朝外` 决定），花边中心落在边线上。 */
export function 绘制扇贝边(
  绘图: 图形对象,
  左: number,
  上: number,
  宽: number,
  色: number,
  透明度 = 1,
  朝向: "上" | "下" = "上",
  半径: number = 糖果规范.花边.半径,
  步长: number = 糖果规范.花边.步长,
): void {
  const 数量 = Math.max(1, Math.floor(宽 / 步长));
  const 间距 = 宽 / 数量;
  const 半径值 = Math.min(半径, 间距 / 2);
  const 圆Y = 朝向 === "上" ? 上 : 上;
  绘图.fillStyle(色, 透明度);
  for (let 序 = 0; 序 < 数量; 序 += 1) {
    绘图.fillCircle(左 + 间距 * (序 + 0.5), 圆Y, 半径值);
  }
}

/** 矩形四边内侧的奶油裱花线：一条内缩的圆角描边，角上点四个糖钉。 */
export function 绘制奶油内衬(
  绘图: 图形对象,
  左: number,
  上: number,
  宽: number,
  高: number,
  圆角: number,
  描边色: number,
  透明度 = 0.55,
  铆钉 = true,
): void {
  const 缩 = 糖果规范.花边.内缩 + 1.5;
  const 内宽 = Math.max(0, 宽 - 缩 * 2);
  const 内高 = Math.max(0, 高 - 缩 * 2);
  绘图
    .lineStyle(糖果规范.描边.高光, 描边色, 透明度)
    .strokeRoundedRect(左 + 缩, 上 + 缩, 内宽, 内高, Math.max(1, 圆角 - 缩));
  if (!铆钉) return;
  const 半径 = 糖果规范.面板.铆钉半径;
  绘图.fillStyle(描边色, 透明度 * 0.9);
  for (const [x, y] of [
    [左 + 缩 + 半径, 上 + 缩 + 半径],
    [左 + 宽 - 缩 - 半径, 上 + 缩 + 半径],
    [左 + 缩 + 半径, 上 + 高 - 缩 - 半径],
    [左 + 宽 - 缩 - 半径, 上 + 高 - 缩 - 半径],
  ])
    绘图.fillCircle(x, y, 半径);
}

/** 顶部奶油高光带：横向铺一条上亮下淡的圆角软带，制造「糖衣反光」。 */
export function 绘制糖衣高光(
  绘图: 图形对象,
  左: number,
  上: number,
  宽: number,
  高: number,
  圆角: number,
  透明度 = 糖果规范.面板.高光透明度,
): void {
  // 高光带最高不超过一条软带的高度：高面板（暂停/结算）否则会糊出一大块浅色矩形。
  const 带高 = Math.min(高 * 糖果规范.面板.高光占比, 24);
  if (带高 < 2 || 宽 < 12) return;
  绘图
    .fillStyle(糖果规范.色.白, 透明度)
    .fillRoundedRect(左 + 3, 上 + 2.5, 宽 - 6, 带高, Math.max(2, 圆角 * 0.7));
  绘图
    .fillStyle(糖果规范.色.白, 透明度 * 1.4)
    .fillRoundedRect(
      左 + 3 + 宽 * 0.12,
      上 + 2.5,
      Math.min(宽 * 0.3, 72),
      Math.max(1.4, 带高 * 0.3),
      2,
    );
}

/** 斜条纹遮阳篷带（背景顶部与卡片顶边用）：粉白相间的梯形条纹，下缘波浪。 */
export function 绘制条纹篷(
  绘图: 图形对象,
  左: number,
  上: number,
  宽: number,
  高: number,
  浅色: number,
  深色: number,
  扇贝色: number,
): void {
  绘图.fillStyle(深色, 1).fillRect(左, 上, 宽, 高);
  const 条纹宽 = 糖果规范.背景.条纹宽;
  const 斜 = 高 * 0.55;
  绘图.fillStyle(浅色, 0.92);
  for (let x = 左 - 斜; x < 左 + 宽 + 斜; x += 条纹宽 * 2) {
    绘图.fillPoints(
      [
        { x, y: 上 },
        { x: x + 条纹宽, y: 上 },
        { x: x + 条纹宽 - 斜, y: 上 + 高 },
        { x: x - 斜, y: 上 + 高 },
      ],
      true,
    );
  }
  // 下缘波浪：沿整条篷画一排半圆，遮住直边。
  const 半径 = 糖果规范.背景.扇贝半径;
  const 数量 = Math.max(1, Math.round(宽 / (半径 * 2)));
  const 间距 = 宽 / 数量;
  绘图.fillStyle(扇贝色, 1);
  for (let 序 = 0; 序 < 数量; 序 += 1)
    绘图.fillCircle(左 + 间距 * (序 + 0.5), 上 + 高, Math.min(半径, 间距 / 2));
}

/** 一条丝带（两端尖角 + 中间方结），用于标题、缎带与卡片角标。 */
export function 绘制丝带(
  绘图: 图形对象,
  中心X: number,
  中心Y: number,
  宽: number,
  高: number,
  主色: number,
  深色: number,
): void {
  const 半高 = 高 / 2;
  const 尾宽 = 宽 * 0.16;
  绘图.fillStyle(主色, 1).fillRect(中心X - 宽 / 2 + 尾宽, 中心Y - 半高, 宽 - 尾宽 * 2, 高);
  绘图.fillStyle(深色, 1).fillPoints(
    [
      { x: 中心X - 宽 / 2 + 尾宽, y: 中心Y - 半高 },
      { x: 中心X - 宽 / 2, y: 中心Y - 半高 },
      { x: 中心X - 宽 / 2 + 尾宽 * 0.55, y: 中心Y },
      { x: 中心X - 宽 / 2, y: 中心Y + 半高 },
      { x: 中心X - 宽 / 2 + 尾宽, y: 中心Y + 半高 },
    ],
    true,
  );
  绘图.fillStyle(深色, 1).fillPoints(
    [
      { x: 中心X + 宽 / 2 - 尾宽, y: 中心Y - 半高 },
      { x: 中心X + 宽 / 2, y: 中心Y - 半高 },
      { x: 中心X + 宽 / 2 - 尾宽 * 0.55, y: 中心Y },
      { x: 中心X + 宽 / 2, y: 中心Y + 半高 },
      { x: 中心X + 宽 / 2 - 尾宽, y: 中心Y + 半高 },
    ],
    true,
  );
  绘图
    .fillStyle(亮色(主色, 0.2), 0.5)
    .fillRect(中心X - 宽 / 2 + 尾宽, 中心Y - 半高 + 1, 宽 - 尾宽 * 2, 1.5);
}

/** 一颗糖粒：圆底 + 一点高光；背景与卡片角落的甜点碎屑共用。 */
export function 绘制糖粒(
  绘图: 图形对象,
  中心X: number,
  中心Y: number,
  半径: number,
  色: number,
  透明度 = 1,
  旋转 = 0,
): void {
  绘图.save().translateCanvas(中心X, 中心Y).rotateCanvas(旋转);
  绘图.fillStyle(色, 透明度).fillEllipse(0, 0, 半径 * 2.1, 半径 * 1.4);
  绘图
    .fillStyle(0xffffff, 0.45 * 透明度)
    .fillEllipse(-半径 * 0.35, -半径 * 0.35, 半径 * 0.7, 半径 * 0.45);
  绘图.restore();
}

/** 蝴蝶结：两个环 + 中心结 + 两条飘带，用于棋盘顶部/卡片顶部。 */
export function 绘制蝴蝶结(
  绘图: 图形对象,
  中心X: number,
  中心Y: number,
  尺寸: number,
  主色: number,
  深色: number,
): void {
  const 半 = 尺寸 / 2;
  for (const 方向 of [-1, 1]) {
    // 飘带
    绘图.fillStyle(深色, 0.95).fillPoints(
      [
        { x: 中心X, y: 中心Y + 半 * 0.15 },
        { x: 中心X + 方向 * 半 * 0.75, y: 中心Y + 半 * 0.95 },
        { x: 中心X + 方向 * 半 * 0.42, y: 中心Y + 半 * 0.72 },
        { x: 中心X + 方向 * 半 * 0.2, y: 中心Y + 半 * 1.05 },
      ],
      true,
    );
    // 环
    绘图
      .fillStyle(主色, 1)
      .fillEllipse(中心X + 方向 * 半 * 0.62, 中心Y - 半 * 0.05, 半 * 0.83, 半 * 0.72);
    绘图
      .fillStyle(亮色(主色, 0.3), 0.5)
      .fillEllipse(中心X + 方向 * 半 * 0.6, 中心Y - 半 * 0.22, 半 * 0.3, 半 * 0.2);
  }
  绘图
    .fillStyle(深色, 1)
    .fillRoundedRect(中心X - 半 * 0.2, 中心Y - 半 * 0.28, 半 * 0.4, 半 * 0.56, 半 * 0.12);
}
