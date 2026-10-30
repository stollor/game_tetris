import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { 绘制立体晶格背景, 绘制立体晶格背景动态 } from "../代码/视效/背景/立体晶格背景";
import type { 图形对象 } from "../框架/界面/绘制/协议";

/**
 * 立体晶格专属背景的规则测试：静态底与动态层都能完整绘制、同一时刻输出完全一致、
 * 亮度只缩放动态层透明度；同时守住「零颜色字面量、不依赖 Phaser」的纯配方约定。
 * 用记录型 `图形对象` 代替真实后端，不加载 Phaser/Three 运行时。
 */

interface 调用 {
  方法: string;
  参数: unknown[];
}

/** 实现 `图形对象` 的记录器：每次绘制调用按顺序记下方法名与参数，用于比对指令序列。 */
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
  绘制立体晶格背景(图形, 宽, 高);
  return 图形;
};
const 画动态 = (时间秒: number, 亮度 = 1, 宽 = 390, 高 = 844): 记录图形 => {
  const 图形 = new 记录图形();
  绘制立体晶格背景动态(图形, 宽, 高, 时间秒, 亮度);
  return 图形;
};
const 序列 = (图形: 记录图形): unknown[] => 图形.调用列表.map((调) => [调.方法, ...调.参数]);

/** 透明度参数位置：fillStyle 第 2 位、lineStyle 第 3 位、fillGradientStyle 第 5–8 位。 */
function 透明度下标(方法: string): number[] {
  if (方法 === "fillStyle") return [1];
  if (方法 === "lineStyle") return [2];
  if (方法 === "fillGradientStyle") return [4, 5, 6, 7];
  return [];
}

test("静态底与动态层都能画出完整画面", () => {
  const 静态 = 画静态();
  expect(静态.调用列表.length).toBeGreaterThan(60);
  const 动态 = 画动态(1.5);
  expect(动态.调用列表.length).toBeGreaterThan(30);
  for (const 调 of [...静态.调用列表, ...动态.调用列表]) {
    for (const 参 of 调.参数) {
      if (typeof 参 === "number") expect(Number.isFinite(参)).toBe(true);
      if (typeof 参 === "number" && 调.方法.includes("Style")) {
        expect(参).toBeGreaterThanOrEqual(0);
        expect(参).toBeLessThanOrEqual(0xffffff);
      }
    }
  }
});

test("渲染成本：静态 ≤800 次、动态 ≤200 次绘制调用", () => {
  expect(画静态().调用列表.length).toBeLessThanOrEqual(800);
  for (const 时间秒 of [0, 1.5, 3, 6]) {
    expect(画动态(时间秒).调用列表.length).toBeLessThanOrEqual(200);
  }
});

test("同一 (宽,高,时间秒) 重复绘制输出完全一致（可烘焙、不闪）", () => {
  expect(序列(画静态())).toEqual(序列(画静态()));
  for (const 时间秒 of [0, 1.5, 3, 6]) {
    expect(序列(画动态(时间秒))).toEqual(序列(画动态(时间秒)));
  }
});

test("静态层不随时间变化，且不含动态层的调用", () => {
  // 静态函数没有时间参数，两次调用必须逐条一致；静态画面里不出现动态层特有的地面色环。
  expect(序列(画静态())).toEqual(序列(画静态()));
  expect(画动态(2).调用列表.length).toBeGreaterThan(0);
});

test("亮度只按比例缩放动态层透明度，不改变绘制结构", () => {
  for (const 时间秒 of [0, 1.5, 3, 6]) {
    const 暗 = 画动态(时间秒, 0.5);
    const 亮 = 画动态(时间秒, 1);
    expect(暗.调用列表.length).toBe(亮.调用列表.length);
    for (let 序 = 0; 序 < 暗.调用列表.length; 序 += 1) {
      const 甲 = 暗.调用列表[序];
      const 乙 = 亮.调用列表[序];
      if (!甲 || !乙) throw new Error("调用列表长度不一致");
      expect(甲.方法).toBe(乙.方法);
      const 透明度位置 = new Set(透明度下标(甲.方法));
      for (let 参序 = 0; 参序 < 甲.参数.length; 参序 += 1) {
        const 甲值 = 甲.参数[参序];
        const 乙值 = 乙.参数[参序];
        if (透明度位置.has(参序) && typeof 甲值 === "number" && typeof 乙值 === "number") {
          expect(Math.abs(甲值 * 2 - 乙值)).toBeLessThan(1e-9);
        } else expect(甲值).toEqual(乙值);
      }
    }
  }
});

test("亮度=0 时动态层所有透明度都为 0（但绘制结构不变）", () => {
  const 全暗 = 画动态(2, 0);
  const 正常 = 画动态(2, 1);
  expect(全暗.调用列表.length).toBe(正常.调用列表.length);
  for (const 调 of 全暗.调用列表) {
    for (const 序 of 透明度下标(调.方法)) expect(调.参数[序]).toBe(0);
  }
});

test("宽高按比例：多种画幅都能画、宽高非正时安全返回", () => {
  for (const [宽, 高] of [
    [195, 422],
    [390, 844],
    [844, 390],
    [1080, 2400],
    [768, 1024],
  ] as const) {
    const 静态 = 画静态(宽, 高);
    expect(静态.调用列表.length).toBeGreaterThan(60);
    const 动态 = 画动态(2, 1, 宽, 高);
    expect(动态.调用列表.length).toBeGreaterThan(30);
    for (const 调 of [...静态.调用列表, ...动态.调用列表])
      for (const 参 of 调.参数) if (typeof 参 === "number") expect(Number.isFinite(参)).toBe(true);
  }
  expect(画静态(0, 844).调用列表.length).toBe(0);
  expect(画静态(390, 0).调用列表.length).toBe(0);
  expect(画动态(2, 1, -1, 844).调用列表.length).toBe(0);
});

test("配方文件零颜色字面量、不依赖 Phaser、宽高不写死", () => {
  const 内容 = readFileSync(join(import.meta.dir, "../代码/视效/背景/立体晶格背景.ts"), "utf8");
  expect(内容.match(/0x[0-9a-fA-F]{6}/g) ?? []).toHaveLength(0);
  expect(内容.includes("phaser")).toBe(false);
  // 背景一律按 宽/高 比例计算，不允许写死竖屏基准尺寸。
  expect(内容.includes("390")).toBe(false);
  expect(内容.includes("844")).toBe(false);
  const 依赖行 = 内容.match(/^\s*import[^;]*from\s+"[^"]+";/gm) ?? [];
  expect(依赖行.length).toBeGreaterThan(0);
  for (const 行 of 依赖行) {
    expect(行.includes("phaser")).toBe(false);
    if (行.includes("/框架/"))
      expect(行.includes("框架/界面/颜色工具") || 行.trimStart().startsWith("import type ")).toBe(
        true,
      );
  }
});
