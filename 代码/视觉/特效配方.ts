import type { 图形对象 } from "../../框架/界面/绘制/协议";

/**
 * 对局特效的引擎无关绘制配方（时间函数版）：
 * - 落块拖尾/锁定闪光来自 `代码/视觉/落块特效.ts` 的现行绘制（Phaser 侧保留贴图/图像池/缩放动画，
 *   视觉真相不变；Three 侧按同一组指令逐帧重画）；
 * - 消行光带/四行庆祝来自 `代码/视觉/消行特效.ts` 的现行绘制（Phaser 已改为委托本文件）。
 * 坐标默认以棋盘左上角为原点，可传 左/上 平移到页面坐标。
 */

/** 拖尾段数（与 Phaser 落块特效一致）。 */
export const 拖尾段数 = 40;

export interface 拖尾列绘制 {
  列: number;
  底: number;
  /** 初始高度：min(底, min(10, 距离) * 格)。 */
  初始高度: number;
}

export interface 落块拖尾参数 {
  列: readonly 拖尾列绘制[];
  色: number;
  格: number;
  /** 0→1 的播放进度。 */
  进度: number;
  /** 拖尾总长：min(10, 距离) * 格。 */
  拖尾长: number;
  左?: number;
  上?: number;
}

/** 落块拖尾：逐列 40 段彩色+白色竖条，高度随进度收缩、整体淡出。 */
export function 绘制落块拖尾(绘图: 图形对象, 参数: 落块拖尾参数): void {
  const { 列, 色, 格, 进度, 拖尾长 } = 参数;
  const 左 = 参数.左 ?? 0;
  const 上 = 参数.上 ?? 0;
  const 高度比 = 1 - 进度 * 进度;
  const 透明 = (1 - 进度) ** 2;
  for (const 项 of 列) {
    const 动画高度 = Math.min(项.底, 拖尾长 * 高度比);
    if (动画高度 <= 1) continue;
    绘图.save();
    绘图.translateCanvas(左 + (项.列 + 0.5) * 格, 上 + 项.底);
    for (let 段 = 0; 段 < 拖尾段数; 段++) {
      const t = 1 - (段 + 0.5) / 拖尾段数;
      const y = -(动画高度 * (段 + 1)) / 拖尾段数;
      const 高 = 动画高度 / 拖尾段数 + 0.5;
      const 宽 = 格 * (0.06 + 0.66 * t);
      const 淡 = t * t;
      绘图.fillStyle(色, 淡 * 0.22 * 透明).fillRect(-宽 / 2, y, 宽, 高);
      绘图.fillStyle(0xffffff, 淡 * 0.2 * 透明).fillRect(-宽 * 0.12, y, 宽 * 0.24, 高);
    }
    绘图.restore();
  }
}

export interface 锁定闪光参数 {
  格子: readonly (readonly [number, number])[];
  格: number;
  透明度: number;
  左?: number;
  上?: number;
}

/** 锁定闪光：每个落点格一块淡白圆角方块。 */
export function 绘制锁定闪光(绘图: 图形对象, 参数: 锁定闪光参数): void {
  const { 格子, 格, 透明度 } = 参数;
  const 左 = 参数.左 ?? 0;
  const 上 = 参数.上 ?? 0;
  if (透明度 <= 0) return;
  绘图.fillStyle(0xffffff, 0.65 * 透明度);
  for (const [列, 行] of 格子) {
    绘图.fillRoundedRect(左 + 列 * 格 + 2, 上 + 行 * 格 + 2, 格 - 4, 格 - 4, 格 * 0.12);
  }
}

export interface 消行光带参数 {
  行: readonly number[];
  时间毫秒: number;
  格: number;
  强调色: number;
  左?: number;
  上?: number;
}

/** 消行光带：每行一条横向光带 + 白闪 + 中央光宽展开（时间毫秒为播放进度）。 */
export function 绘制消行光带(绘图: 图形对象, 参数: 消行光带参数): void {
  const { 行, 时间毫秒, 格, 强调色 } = 参数;
  const 左 = 参数.左 ?? 0;
  const 上 = 参数.上 ?? 0;
  行.forEach((行号, 索引) => {
    const t = 时间毫秒 - 索引 * 40;
    if (t < 0 || t > 320) return;
    const 淡 = 1 - t / 320;
    绘图.fillStyle(强调色, 淡 * 0.3).fillRect(左, 上 + (行号 - 0.18) * 格, 10 * 格, 1.36 * 格);
    if (t < 90)
      绘图.fillStyle(0xffffff, (1 - t / 90) * 0.85).fillRect(左, 上 + 行号 * 格, 10 * 格, 格);
    const 光宽 = 10 * 格 * Math.min(1, t / 140);
    绘图
      .fillStyle(强调色, 淡 * 0.9)
      .fillRect(左 + 5 * 格 - 光宽 / 2, 上 + (行号 + 0.48) * 格, 光宽, Math.max(2, 格 * 0.09));
  });
}

export interface 四行庆祝参数 {
  时间毫秒: number;
  时长毫秒: number;
  格: number;
  /** 扫过光带起点（棋盘行位*格，由调用方按行列表算）。 */
  扫过起点?: number;
  左?: number;
  上?: number;
}

/** 四行庆祝：整屏暖光、扫过光带与双层描边（时间毫秒/时长毫秒为播放进度）。 */
export function 绘制四行庆祝(绘图: 图形对象, 参数: 四行庆祝参数): void {
  const { 时间毫秒, 时长毫秒, 格 } = 参数;
  const 左 = 参数.左 ?? 0;
  const 上 = 参数.上 ?? 0;
  const 淡 = 1 - 时间毫秒 / 时长毫秒;
  if (时间毫秒 < 200)
    绘图.fillStyle(0xffe6a0, (1 - 时间毫秒 / 200) * 0.18).fillRect(左, 上, 10 * 格, 20 * 格);
  // 扫过光带：以行位置从下往上收（对应 Phaser 的 min(行)*格*(1-时间/600)）。
  const 扫Y = Math.max(0, 参数.扫过起点 ?? 0);
  if (时间毫秒 < 600) {
    绘图
      .fillGradientStyle(0xffdb70, 0xffdb70, 0xffffff, 0xffffff, 0, 0, 淡 * 0.22, 淡 * 0.22)
      .fillRect(左, 上 + Math.max(0, 扫Y - 格 * 1.5), 10 * 格, Math.min(格 * 1.5, 扫Y));
    绘图
      .lineStyle(Math.max(2, 格 * 0.12), 0xffedb5, 淡 * 0.7)
      .lineBetween(左, 上 + 扫Y, 左 + 10 * 格, 上 + 扫Y);
  }
  绘图
    .lineStyle(Math.max(2, 格 * 0.12), 0xffdb70, 淡 * 0.85)
    .strokeRoundedRect(左 + 1, 上 + 1, 10 * 格 - 2, 20 * 格 - 2, 格 * 0.25);
  绘图
    .lineStyle(1, 0xffffff, 淡 * 0.6)
    .strokeRoundedRect(左 + 4, 上 + 4, 10 * 格 - 8, 20 * 格 - 8, 格 * 0.2);
}
/** Phaser 成就提示末尾350ms淡出，调用方以秒计时。 */
export function 读取成就提示透明度(剩余秒: number): number {
  return Math.max(0, Math.min(1, 剩余秒 / 0.35));
}

/** Phaser 棋盘更新特效采用的主镜头 scroll 偏移。 */
export function 读取对局震屏偏移(经过秒: number, 时长秒: number, 强度: number) {
  const 进度 = 时长秒 > 0 ? Math.min(1, Math.max(0, 经过秒 / 时长秒)) : 1;
  const 幅度 = (1 - 进度) ** 2 * 强度;
  return {
    x: Math.cos(进度 * Math.PI * 12) * 幅度 * 0.55,
    y: Math.sin(进度 * Math.PI * 15 + Math.PI / 2) * 幅度,
  };
}
