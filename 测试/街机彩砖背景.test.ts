import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { 绘制街机彩砖背景, 绘制街机彩砖背景动态 } from "../代码/视效/背景/街机彩砖背景";
import type { 图形对象 } from "../框架/界面/绘制/协议";

/**
 * 街机彩砖背景的规则测试：静态底与动态层都能完整绘制、同一时刻可复现、亮度只缩放透明度，
 * 并守住「纯配方不依赖 Phaser、不散落颜色字面量」的约定。用记录型 `图形对象` 代替真实后端。
 */

interface 调用 {
  方法: string;
  参数: unknown[];
}

/** 实现 `图形对象` 的记录器：按顺序记下方法名与参数，用于比对指令序列。 */
class 记录图形 implements 图形对象 {
  readonly 调用列表: 调用[] = [];

  private 记(方法: string, 参数: unknown[]): this {
    this.调用列表.push({ 方法, 参数 });
    return this;
  }

  fillStyle(颜色: number, 透明度?: number): this {
    return this.记("fillStyle", [颜色, 透明度]);
  }
  lineStyle(线宽: number, 颜色: number, 透明度?: number): this {
    return this.记("lineStyle", [线宽, 颜色, 透明度]);
  }
  fillGradientStyle(
    左上: number,
    右上: number,
    左下: number,
    右下: number,
    透明度左上?: number,
    透明度右上?: number,
    透明度左下?: number,
    透明度右下?: number,
  ): this {
    return this.记("fillGradientStyle", [
      左上,
      右上,
      左下,
      右下,
      透明度左上,
      透明度右上,
      透明度左下,
      透明度右下,
    ]);
  }
  fillRect(x: number, y: number, 宽: number, 高: number): this {
    return this.记("fillRect", [x, y, 宽, 高]);
  }
  fillRoundedRect(x: number, y: number, 宽: number, 高: number, 圆角: number): this {
    return this.记("fillRoundedRect", [x, y, 宽, 高, 圆角]);
  }
  strokeRect(x: number, y: number, 宽: number, 高: number): this {
    return this.记("strokeRect", [x, y, 宽, 高]);
  }
  strokeRoundedRect(x: number, y: number, 宽: number, 高: number, 圆角: number): this {
    return this.记("strokeRoundedRect", [x, y, 宽, 高, 圆角]);
  }
  fillCircle(x: number, y: number, 半径: number): this {
    return this.记("fillCircle", [x, y, 半径]);
  }
  strokeCircle(x: number, y: number, 半径: number): this {
    return this.记("strokeCircle", [x, y, 半径]);
  }
  fillEllipse(x: number, y: number, 宽: number, 高: number): this {
    return this.记("fillEllipse", [x, y, 宽, 高]);
  }
  strokeEllipse(x: number, y: number, 宽: number, 高: number): this {
    return this.记("strokeEllipse", [x, y, 宽, 高]);
  }
  fillTriangle(x1: number, y1: number, x2: number, y2: number, x3: number, y3: number): this {
    return this.记("fillTriangle", [x1, y1, x2, y2, x3, y3]);
  }
  strokeTriangle(x1: number, y1: number, x2: number, y2: number, x3: number, y3: number): this {
    return this.记("strokeTriangle", [x1, y1, x2, y2, x3, y3]);
  }
  lineBetween(x1: number, y1: number, x2: number, y2: number): this {
    return this.记("lineBetween", [x1, y1, x2, y2]);
  }
  fillPoints(点集: readonly { x: number; y: number }[], 闭合?: boolean): this {
    return this.记("fillPoints", [点集, 闭合]);
  }
  strokePoints(点集: readonly { x: number; y: number }[], 闭合?: boolean): this {
    return this.记("strokePoints", [点集, 闭合]);
  }
  beginPath(): this {
    return this.记("beginPath", []);
  }
  moveTo(x: number, y: number): this {
    return this.记("moveTo", [x, y]);
  }
  lineTo(x: number, y: number): this {
    return this.记("lineTo", [x, y]);
  }
  closePath(): this {
    return this.记("closePath", []);
  }
  arc(x: number, y: number, 半径: number, 起始角: number, 结束角: number, 逆时针?: boolean): this {
    return this.记("arc", [x, y, 半径, 起始角, 结束角, 逆时针]);
  }
  fillPath(): this {
    return this.记("fillPath", []);
  }
  strokePath(): this {
    return this.记("strokePath", []);
  }
  clear(): this {
    return this.记("clear", []);
  }
  setAlpha(透明度: number): this {
    return this.记("setAlpha", [透明度]);
  }
  setBlendMode(模式: number): this {
    return this.记("setBlendMode", [模式]);
  }
  save(): this {
    return this.记("save", []);
  }
  restore(): this {
    return this.记("restore", []);
  }
  translateCanvas(x: number, y: number): this {
    return this.记("translateCanvas", [x, y]);
  }
  rotateCanvas(弧度: number): this {
    return this.记("rotateCanvas", [弧度]);
  }
  scaleCanvas(x: number, y?: number): this {
    return this.记("scaleCanvas", [x, y]);
  }
}

const 画静态 = (宽 = 390, 高 = 844): 记录图形 => {
  const 图形 = new 记录图形();
  绘制街机彩砖背景(图形, 宽, 高);
  return 图形;
};
const 画动态 = (时间秒: number, 亮度 = 1, 宽 = 390, 高 = 844): 记录图形 => {
  const 图形 = new 记录图形();
  绘制街机彩砖背景动态(图形, 宽, 高, 时间秒, 亮度);
  return 图形;
};
const 序列 = (图形: 记录图形): unknown[] => 图形.调用列表.map((调) => [调.方法, ...调.参数]);

/** 把动态层里的透明度字段整体乘系数，用于验证亮度只缩放透明度、不改结构。 */
const 缩放透明度 = (列表: 调用[], 倍数: number): unknown[] =>
  列表.map((调) => {
    const 参数 = [...调.参数];
    if (调.方法 === "fillStyle") 参数[1] = ((参数[1] as number | undefined) ?? 1) * 倍数;
    if (调.方法 === "lineStyle") 参数[2] = ((参数[2] as number | undefined) ?? 1) * 倍数;
    if (调.方法 === "fillGradientStyle")
      for (let i = 4; i < 8; i += 1) 参数[i] = ((参数[i] as number | undefined) ?? 1) * 倍数;
    return [调.方法, ...参数];
  });

test("静态底与动态层都能画出，且满足渲染成本上限", () => {
  const 静态 = 画静态();
  const 动态 = 画动态(2);
  expect(静态.调用列表.length).toBeGreaterThan(60);
  expect(静态.调用列表.length).toBeLessThanOrEqual(800);
  expect(动态.调用列表.length).toBeGreaterThan(10);
  expect(动态.调用列表.length).toBeLessThanOrEqual(200);
});

test("所有坐标与颜色数值有限，颜色落在 0x000000–0xffffff", () => {
  for (const 图形 of [画静态(), 画动态(1.5), 画动态(3), 画动态(6)]) {
    for (const 调 of 图形.调用列表) {
      for (const 参 of 调.参数) {
        if (typeof 参 === "number") expect(Number.isFinite(参)).toBe(true);
      }
      if (调.方法 === "fillStyle" || 调.方法 === "lineStyle" || 调.方法 === "fillGradientStyle") {
        const 色组 = 调.方法 === "lineStyle" ? [调.参数[1]] : 调.参数.slice(0, 4);
        for (const 色 of 色组) {
          if (typeof 色 !== "number") continue;
          expect(色).toBeGreaterThanOrEqual(0);
          expect(色).toBeLessThanOrEqual(0xffffff);
        }
      }
      if (调.方法 === "fillStyle" || 调.方法 === "lineStyle") {
        const 透明 = 调.方法 === "fillStyle" ? 调.参数[1] : 调.参数[2];
        if (typeof 透明 === "number") {
          expect(透明).toBeGreaterThanOrEqual(0);
          expect(透明).toBeLessThanOrEqual(1);
        }
      }
    }
  }
});

test("同一 (宽,高,时间秒) 的指令序列完全一致（可烘焙、不闪）", () => {
  expect(序列(画静态())).toEqual(序列(画静态()));
  for (const 时间 of [0, 1.5, 3, 6]) {
    expect(序列(画动态(时间))).toEqual(序列(画动态(时间)));
  }
});

test("不同时间点动态层确实在变，静态底不随时间变", () => {
  expect(序列(画动态(0))).not.toEqual(序列(画动态(1.5)));
  expect(序列(画静态())).toEqual(序列(画静态()));
});

test("亮度只缩放动态层透明度，不改绘制结构；亮度=0 时全部透明", () => {
  const 半亮 = 画动态(2, 0.5);
  const 全亮 = 画动态(2, 1);
  expect(半亮.调用列表.length).toBe(全亮.调用列表.length);
  expect(缩放透明度(半亮.调用列表, 2)).toEqual(序列(全亮));
  const 全暗 = 画动态(2, 0);
  expect(全暗.调用列表.length).toBe(全亮.调用列表.length);
  for (const 调 of 全暗.调用列表) {
    if (调.方法 === "fillStyle") expect(调.参数[1]).toBe(0);
    if (调.方法 === "fillGradientStyle") {
      for (let i = 4; i < 8; i += 1) expect(调.参数[i]).toBe(0);
    }
  }
});

test("宽高按比例推导，尺寸非法时安全返回", () => {
  for (const [宽, 高] of [
    [320, 568],
    [200, 400],
    [390, 844],
  ] as const) {
    expect(画静态(宽, 高).调用列表.length).toBeGreaterThan(60);
    expect(画动态(1, 1, 宽, 高).调用列表.length).toBeGreaterThan(10);
  }
  for (const [宽, 高] of [
    [0, 844],
    [390, 0],
    [-10, 844],
    [390, -10],
  ] as const) {
    expect(画静态(宽, 高).调用列表.length).toBe(0);
    expect(画动态(1, 1, 宽, 高).调用列表.length).toBe(0);
  }
});

test("纯配方不依赖 Phaser、不出现颜色字面量，只 import 允许的模块", () => {
  const 文件 = join(import.meta.dir, "../代码/视效/背景/街机彩砖背景.ts");
  const 内容 = readFileSync(文件, "utf8");
  expect(内容.includes("phaser")).toBe(false);
  expect(内容.match(/0x[0-9a-fA-F]{6}/g) ?? []).toHaveLength(0);
  const 依赖行 = 内容.match(/^\s*import[^;]*from\s+"[^"]+";/gm) ?? [];
  for (const 行 of 依赖行) {
    const 放行 =
      行.includes('"./通用"') ||
      行.includes("像素/像素规范") ||
      行.includes("框架/界面/颜色工具") ||
      行.trimStart().startsWith("import type ");
    expect(放行).toBe(true);
  }
});
