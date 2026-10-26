import { expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { 背景主题选项, 背景主题配置 } from "../代码/主题/外观/背景主题";
import { 查找地点 } from "../代码/框架配置/旅行地点";
import {
  绘制背景,
  绘制背景动态,
  绘制背景静底,
  读取背景动态亮度,
  读取背景外观配色,
} from "../代码/视效/背景/背景绘制";
import type { 背景主题 } from "../代码/设置/游戏设置";
import type { 图形对象 } from "../框架/界面/绘制/协议";

/**
 * 背景配方的规则测试：16 个主题（内置四套 + 旅行 12 地点）在静态/动态两态都能完整绘制，
 * 分步绘制与一次绘制一致，亮度参数只缩放透明度；同时守住「纯配方不依赖 Phaser」的单一来源约定。
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

const 全部主题 = 背景主题选项.map((项) => 项.值);
const 画 = (主题: 背景主题, 动态: boolean, 时间秒 = 1.25): 记录图形 => {
  const 图形 = new 记录图形();
  绘制背景(图形, { 宽: 390, 高: 844, 主题, 动态, 时间秒 });
  return 图形;
};
const 序列 = (图形: 记录图形): unknown[] => 图形.调用列表.map((调) => [调.方法, ...调.参数]);

test("16 个背景主题都能画出静态与动态完整画面", () => {
  expect(全部主题.length).toBe(16);
  for (const 主题 of 全部主题) {
    const 静态 = 画(主题, false);
    expect(静态.调用列表.length).toBeGreaterThan(100);
    const 动态 = 画(主题, true);
    expect(动态.调用列表.length - 静态.调用列表.length).toBeGreaterThan(10);
    for (const 调 of 动态.调用列表)
      for (const 参 of 调.参数) {
        if (typeof 参 === "number") expect(Number.isFinite(参)).toBe(true);
        if (typeof 参 === "number" && 调.方法.includes("Style")) {
          expect(参).toBeGreaterThanOrEqual(0);
          expect(参).toBeLessThanOrEqual(0xffffff);
        }
      }
  }
});

test("动态=false 的画面与静态底图（含旅行主体）完全一致", () => {
  for (const 主题 of 全部主题) {
    const 一次 = 画(主题, false);
    const 分步 = new 记录图形();
    绘制背景静底(分步, { 宽: 390, 高: 844, 主题, 静态主体: true });
    expect(序列(一次)).toEqual(序列(分步));
  }
});

test("动态画面的前缀等于不含主体的静态底图，其余为动态层", () => {
  for (const 主题 of 全部主题) {
    const 一次 = 画(主题, true);
    const 静态 = new 记录图形();
    绘制背景静底(静态, { 宽: 390, 高: 844, 主题, 静态主体: false });
    expect(一次.调用列表.length).toBeGreaterThan(静态.调用列表.length);
    expect(序列(一次).slice(0, 静态.调用列表.length)).toEqual(序列(静态));
  }
});

test("动态层亮度：内置主题取配置动画亮度，旅行地点固定 1", () => {
  for (const 主题 of 全部主题) {
    if (查找地点(主题)) expect(读取背景动态亮度(主题)).toBe(1);
    else expect(读取背景动态亮度(主题)).toBe(背景主题配置[主题].动画亮度);
  }
});

test("亮度参数只按比例缩放动态层透明度，不改变绘制结构", () => {
  const 缩放 = (列表: 调用[], 倍数: number): unknown[] =>
    列表.map((调) => {
      const 参数 = [...调.参数];
      if (调.方法 === "fillStyle") 参数[1] = (参数[1] as number) * 倍数;
      if (调.方法 === "lineStyle") 参数[2] = (参数[2] as number) * 倍数;
      if (调.方法 === "fillGradientStyle")
        for (let i = 4; i < 8; i++) 参数[i] = (参数[i] as number) * 倍数;
      return [调.方法, ...参数];
    });
  for (const 主题 of ["晨光海岸", "云海山岚", "极光原野", "霓虹天际"] as const) {
    const 暗 = new 记录图形();
    绘制背景动态(暗, { 宽: 390, 高: 844, 主题, 时间秒: 2, 亮度: 0.5 });
    const 亮 = new 记录图形();
    绘制背景动态(亮, { 宽: 390, 高: 844, 主题, 时间秒: 2, 亮度: 1 });
    expect(暗.调用列表.length).toBe(亮.调用列表.length);
    expect(缩放(暗.调用列表, 2)).toEqual(序列(亮));
  }
});

test("同一时刻重复绘制输出完全一致（可烘焙、不闪）", () => {
  for (const 主题 of 全部主题) {
    expect(序列(画(主题, true, 3.5))).toEqual(序列(画(主题, true, 3.5)));
    expect(序列(画(主题, false))).toEqual(序列(画(主题, false)));
  }
});

test("背景外观配色取自共享配置", () => {
  expect(读取背景外观配色("晨光海岸")).toEqual({
    主色: 0x1d4f6d,
    强调: 0xffd9a0,
    文字基调: "浅底",
  });
  expect(读取背景外观配色("云海山岚").文字基调).toBe("浅底");
  expect(读取背景外观配色("极光原野").文字基调).toBe("深底");
  expect(读取背景外观配色("霓虹天际").文字基调).toBe("深底");
  const 成都 = 查找地点("成都熊猫");
  if (!成都) throw new Error("缺少成都熊猫地点");
  const 成都外观 = 读取背景外观配色("成都熊猫");
  expect(成都外观.主色).toBe(成都.主色);
  expect(成都外观.强调).toBe(成都.强调);
  expect(成都外观.文字基调).toBe("深底");
});

test("纯配方模块只允许框架绘制协议类型，不依赖引擎运行时", () => {
  const 目录 = join(import.meta.dir, "../代码/视效/背景");
  const 文件 = readdirSync(目录).filter((名) => 名.endsWith(".ts"));
  for (const 名 of 文件) {
    const 内容 = readFileSync(join(目录, 名), "utf8");
    const 依赖行 = 内容.match(/^\s*import[^;]*from\s+"[^"]+";/gm) ?? [];
    for (const 行 of 依赖行) {
      expect(行.includes("phaser")).toBe(false);
      if (行.includes("/框架/"))
        expect(行.includes("框架/界面/颜色工具") || 行.trimStart().startsWith("import type ")).toBe(
          true,
        );
    }
  }
});
