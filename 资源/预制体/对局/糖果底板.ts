import type { 图形对象, 点 } from "../../../.gamemaker/依赖/框架/界面/绘制/协议";
import type { 对局布局数据 } from "../../../代码/页面/布局/对局布局";
import { 画糖果背景 } from "./底板/背景";
import { 画糖果操作盘 } from "./底板/操作盘";
import { 画糖果棋盘 } from "./底板/棋盘";
import { 画糖果侧栏 } from "./底板/侧栏";
import { 画糖果顶栏 } from "./底板/顶栏";
import { 是糖果风格 } from "../../主题/糖果/糖果风格";

/**
 * 糖果主题的「底板」：整屏静态外观（背景、棋盘框与井、顶栏、侧栏、底部操作盘）
 * 全部用 canvas 2D 在离屏画布上画好，再作为一张图贴进最底层图层。
 *
 * 为什么整屏一张：
 * 1. 图形协议的批次按 纹理序号 排序，后登记的位图会盖住同层的矢量文字；
 *    把底板放在最底层（背景静层）一次贴出，文字/方块/预览再往上画，层级天然正确。
 * 2. canvas 2D 有径向渐变、模糊阴影、叠加合成，能画出图形协议画不出的「糖感」。
 * 3. 一整张图只有 1 个绘制批次，比几十次图元调用更省。
 *
 * 约束：底板只画「静态」外观；数字、文案、当前块、幽灵、预览、按下态都留在上层用矢量画。
 */

export interface 底板参数 {
  /** 逻辑宽高。 */
  宽: number;
  高: number;
  /** 底板烘焙键：尺寸 + 主题，用于缓存失效。 */
  键: string;
}

type 画布 = HTMLCanvasElement;

const 缓存 = new Map<string, 画布>();

function 当前倍率(): number {
  const 比 = typeof devicePixelRatio === "number" && devicePixelRatio > 0 ? devicePixelRatio : 1;
  return Math.max(1, Math.min(2, Math.round(比)));
}

/**
 * 取整屏底板画布（按 尺寸+倍率 缓存）。`画` 只跑一次。
 */
export function 取底板画布(
  参数: 底板参数,
  画: (笔: CanvasRenderingContext2D, 倍率: number) => void,
): 画布 {
  const 倍率 = 当前倍率();
  const 全键 = `${参数.键}|${参数.宽}x${参数.高}|${倍率}`;
  const 已有 = 缓存.get(全键);
  if (已有) return 已有;
  const 布 = document.createElement("canvas");
  布.width = Math.max(1, Math.ceil(参数.宽 * 倍率));
  布.height = Math.max(1, Math.ceil(参数.高 * 倍率));
  const 笔 = 布.getContext("2d");
  if (!笔) throw new Error("糖果底板需要 2d 上下文");
  笔.scale(倍率, 倍率);
  画(笔, 倍率);
  缓存.set(全键, 布);
  return 布;
}

/** 底板是否接管了糖果主题的静态外观（形状走画布，文字/动态仍走矢量）。 */
export function 是糖果底板(): boolean {
  return 是糖果风格();
}

/** 清空底板缓存（主题/尺寸/配色变化时调用）。 */
export function 清空底板缓存(): void {
  缓存.clear();
}

/* ------------------------------------------------------------------ */
/* 通用画布工具：圆角矩形、扇贝边、柔和阴影                             */
/* ------------------------------------------------------------------ */

/** 圆角矩形路径。 */
export function 圆角路径(
  笔: CanvasRenderingContext2D,
  左: number,
  上: number,
  宽: number,
  高: number,
  圆角: number,
): void {
  const r = Math.max(0, Math.min(圆角, 宽 / 2, 高 / 2));
  笔.beginPath();
  笔.moveTo(左 + r, 上);
  笔.lineTo(左 + 宽 - r, 上);
  笔.arcTo(左 + 宽, 上, 左 + 宽, 上 + r, r);
  笔.lineTo(左 + 宽, 上 + 高 - r);
  笔.arcTo(左 + 宽, 上 + 高, 左 + 宽 - r, 上 + 高, r);
  笔.lineTo(左 + r, 上 + 高);
  笔.arcTo(左, 上 + 高, 左, 上 + 高 - r, r);
  笔.lineTo(左, 上 + r);
  笔.arcTo(左, 上, 左 + r, 上, r);
  笔.closePath();
}

/** 扇贝（花边）矩形路径：四边一圈半圆瓣，顺时针一条连续路径。 */
export function 扇贝路径(
  笔: CanvasRenderingContext2D,
  左: number,
  上: number,
  宽: number,
  高: number,
  瓣半径: number,
): void {
  const r = Math.max(1, 瓣半径);
  const 右 = 左 + 宽;
  const 下 = 上 + 高;
  笔.beginPath();
  const 边 = (x1: number, y1: number, x2: number, y2: number, nx: number, ny: number) => {
    const 长 = Math.hypot(x2 - x1, y2 - y1);
    const 数 = Math.max(1, Math.round(长 / (r * 2)));
    const 步 = 长 / 数;
    const dx = (x2 - x1) / 长;
    const dy = (y2 - y1) / 长;
    for (let i = 0; i < 数; i += 1) {
      const sx = x1 + dx * 步 * i;
      const sy = y1 + dy * 步 * i;
      if (i === 0 && x1 === 左 && y1 === 上) 笔.moveTo(sx, sy);
      const mx = sx + dx * 步 * 0.5;
      const my = sy + dy * 步 * 0.5;
      笔.quadraticCurveTo(mx + nx * r, my + ny * r, sx + dx * 步, sy + dy * 步);
    }
  };
  边(左, 上, 右, 上, 0, -1);
  边(右, 上, 右, 下, 1, 0);
  边(右, 下, 左, 下, 0, 1);
  边(左, 下, 左, 上, -1, 0);
  笔.closePath();
}

/** 给一条路径画柔和落影（用 canvas 的 shadowBlur，比叠矩形自然）。 */
export function 落影(
  笔: CanvasRenderingContext2D,
  路径: Path2D,
  颜色: string,
  模糊 = 6,
  下移 = 3,
  透明 = 1,
): void {
  笔.save();
  笔.globalAlpha = 透明;
  笔.shadowColor = 颜色;
  笔.shadowBlur = 模糊;
  笔.shadowOffsetY = 下移;
  笔.fill(路径);
  笔.restore();
}

/** 由屏幕坐标点集建 Path2D（y 向下，直接对应 canvas 坐标）。 */
export function 建路径(点集: readonly 点[], 闭合 = true): Path2D {
  const 路径 = new Path2D();
  点集.forEach((点, 序) => {
    if (序 === 0) 路径.moveTo(点.x, 点.y);
    else 路径.lineTo(点.x, 点.y);
  });
  if (闭合) 路径.closePath();
  return 路径;
}


/**
 * 画整块糖果底板：按「背景 → 棋盘 → 顶栏 → 侧栏 → 操作盘」的顺序在同一张画布上作画，
 * 保证层级由作画顺序决定（不受合批纹理排序影响），再作为一张图贴在当前图层最底部。
 */
export function 绘制糖果底板(绘图: 图形对象, 布局: 对局布局数据): void {
  const 宽 = 布局.视口宽;
  const 高 = 布局.视口高;
  const 画布 = 取底板画布({ 宽, 高, 键: `糖果|${布局.竖屏 ? "竖" : "横"}` }, (笔) => {
    console.log(
      "[底板调试] " +
        JSON.stringify({ 宽, 高, 棋盘: 布局.棋盘, 格: 布局.格子大小, 信息栏: 布局.信息栏 }),
    );
    画糖果背景(笔, 宽, 高);
    画糖果棋盘(笔, 布局);
    画糖果顶栏(笔, 布局);
    画糖果侧栏(笔, 布局);
    画糖果操作盘(笔, 布局);
  });
  绘图.绘制画布(画布, { 左: 0, 上: 0, 宽, 高 });
}
