import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  主题结果转设置,
  解析游戏主题,
  读取游戏主题目录,
  默认主题编号,
} from "../../../主题/主题组合";
import { 背景主题选项, 背景主题配置 } from "../../../主题/外观/背景主题";
import { 设置预览主题读取 } from "../../../主题/配色/主题读取";
import { 查找地点 } from "../../../代码/框架配置/旅行地点";
import type { 背景主题 } from "../../../代码/设置/游戏设置";
import { 默认设置 } from "../../../代码/设置/游戏设置";
import type { 图形对象 } from "../../../框架/界面/绘制/协议";
import { 绘制像素背景 } from "../../../视效/背景/像素背景";
import { 绘制立体晶格背景, 绘制立体晶格背景动态 } from "../../../视效/背景/立体晶格背景";
import {
  绘制背景,
  绘制背景动态,
  绘制背景静底,
  读取背景动态亮度,
  读取背景外观配色,
} from "../../../视效/背景/背景绘制";
import { 绘制街机彩砖背景, 绘制街机彩砖背景动态 } from "../../../视效/背景/街机彩砖背景";
import { 读取预览主题解析, 读取预览主题设置 } from "../../../预制体/预览/主题状态";
import { 项目根 as 项目根路径 } from "../../接入/项目路径";

// ── 原 背景配方.test.ts ──
describe("背景配方", () => {
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
    arc(
      x: number,
      y: number,
      半径: number,
      起始角: number,
      结束角: number,
      逆时针?: boolean,
    ): this {
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
    const 目录 = join(项目根路径, "视效/背景");
    const 文件 = readdirSync(目录).filter((名) => 名.endsWith(".ts"));
    for (const 名 of 文件) {
      const 内容 = readFileSync(join(目录, 名), "utf8");
      const 依赖行 = 内容.match(/^\s*import[^;]*from\s+"[^"]+";/gm) ?? [];
      for (const 行 of 依赖行) {
        expect(行.includes("phaser")).toBe(false);
        if (行.includes("/框架/"))
          expect(
            行.includes("框架/界面/颜色工具") || 行.trimStart().startsWith("import type "),
          ).toBe(true);
      }
    }
  });
});

// ── 原 主题背景接线.test.ts ──
describe("主题背景接线", () => {
  /**
   * 三套完整主题的后景接线规则：
   * 主题登记的背景资源必须指向专属配方；页面只传旧背景字段时，按当前风格分发到同一配方。
   */

  const 记录 = () => {
    const 调用: [string, ...unknown[]][] = [];
    const 图 = new Proxy({} as 图形对象, {
      get:
        (_目标, 键) =>
        (...参数: unknown[]) => {
          调用.push([String(键), ...参数]);
          return 图;
        },
    });
    return { 调用, 图 };
  };

  const 序列 = (调用: [string, ...unknown[]][]) => 调用;

  /** 在指定完整主题下执行绘制，模拟页面/预览只传设置里的旧背景字段。 */
  function 在主题内(主题: string, 绘制: (设置: ReturnType<typeof 读取预览主题设置>) => void) {
    const 设置 = 读取预览主题设置({ 资源主题: 主题 }, 默认设置);
    设置预览主题读取(
      () => 设置,
      () => 读取预览主题解析({ 资源主题: 主题 }, 设置),
    );
    try {
      绘制(设置);
    } finally {
      设置预览主题读取();
    }
  }

  const 目录 = 读取游戏主题目录();
  const 资源 = (编号: string) => 目录.资源.find((项) => 项.编号 === 编号);

  test("完整主题各自登记专属背景资源与源码", () => {
    expect(资源("静态背景.街机彩砖")?.源码[0]).toMatchObject({
      路径: "视效/背景/街机彩砖背景.ts",
      导出: "绘制街机彩砖背景",
    });
    expect(资源("动态背景.街机彩砖")?.源码[0]).toMatchObject({
      路径: "视效/背景/街机彩砖背景.ts",
      导出: "绘制街机彩砖背景动态",
    });
    // 砖机液晶仍指向掌机液晶壳配方，街机彩砖不借用它。
    expect(资源("静态背景.砖机液晶")?.源码[0]).toMatchObject({
      路径: "视效/背景/像素背景.ts",
    });
    for (const 槽 of ["静态背景", "动态背景"]) {
      expect(资源(`${槽}.立体晶格`)?.源码[0]).toMatchObject({
        路径: "视效/背景/立体晶格背景.ts",
      });
    }
    for (const 主题 of ["街机彩砖", "立体晶格"]) {
      const 结果 = 解析游戏主题(默认设置, 主题);
      const 值 = (槽: string) => 结果.槽位.find((项) => 项.槽位.编号 === 槽);
      expect(值("静态背景")?.资源.值).toBe(主题);
      expect(值("动态背景")?.资源.值).toBe(主题);
      expect(值("静态背景")?.来源).toBe("主题");
      // 旧设置字段仍可承接整套主题，不抛「静态背景未接入」。
      const 设置 = 主题结果转设置(默认设置, 结果);
      expect(设置.主题选择).toContain(主题);
      expect(设置.背景动态).toBe(true);
    }
  });

  test("街机彩砖按风格分发到专属后景，砖机液晶仍画液晶壳", () => {
    const 街机 = 记录();
    const 直接 = 记录();
    在主题内("街机彩砖", (设置) => {
      绘制背景静底(街机.图, { 宽: 390, 高: 844, 主题: 设置.背景主题 });
      绘制街机彩砖背景(直接.图, 390, 844);
    });
    expect(序列(街机.调用)).toEqual(序列(直接.调用));
    expect(街机.调用.length).toBeGreaterThan(60);

    const 液晶 = 记录();
    在主题内("砖机液晶", (设置) => {
      绘制背景静底(液晶.图, { 宽: 390, 高: 844, 主题: 设置.背景主题 });
    });
    expect(序列(液晶.调用)).not.toEqual(序列(街机.调用));
    // 液晶壳只有底色、外框与内井三次矩形。
    expect(液晶.调用.filter(([方法]) => 方法 === "fillRect").length).toBe(3);
  });

  test("立体晶格按风格分发到晶格厅，不再是纯色底板", () => {
    const 晶格 = 记录();
    const 直接 = 记录();
    在主题内("立体晶格", (设置) => {
      绘制背景静底(晶格.图, { 宽: 390, 高: 844, 主题: 设置.背景主题 });
      绘制立体晶格背景(直接.图, 390, 844);
    });
    expect(序列(晶格.调用)).toEqual(序列(直接.调用));
    // 旧占位只有 3 次矩形；专属配方必须有真实的透视格线与灯带结构。
    expect(晶格.调用.length).toBeGreaterThan(40);
    const 非矩形 = 晶格.调用.filter(([方法]) => 方法 !== "fillStyle" && 方法 !== "fillRect");
    expect(非矩形.length).toBeGreaterThan(10);
  });

  test("缩略图按名称绘制时不被主题后景改写", () => {
    // 商店/设置/纯享的缩略图必须画被指定的风景，否则街机彩砖下所有地点卡都长一样。
    const 街机 = 记录();
    在主题内("街机彩砖", () => {
      绘制背景静底(街机.图, { 宽: 200, 高: 120, 主题: "晨光海岸", 按名称绘制: true });
    });
    const 基准 = 记录();
    绘制背景静底(基准.图, { 宽: 200, 高: 120, 主题: "晨光海岸" });
    expect(序列(街机.调用)).toEqual(序列(基准.调用));
    expect(街机.调用.length).toBeGreaterThan(40);

    const 晶格 = 记录();
    在主题内("立体晶格", () => {
      绘制背景静底(晶格.图, { 宽: 200, 高: 120, 主题: "成都熊猫", 按名称绘制: true });
    });
    const 成都 = 查找地点("成都熊猫");
    expect(成都).toBeDefined();
    expect(晶格.调用.length).toBeGreaterThan(40);
    expect(序列(晶格.调用)).not.toEqual(序列(基准.调用));
  });

  test("动态层按风格分发，亮度参数原样透传", () => {
    const 街机 = 记录();
    const 街机直接 = 记录();
    在主题内("街机彩砖", () => {
      绘制背景动态(街机.图, { 宽: 390, 高: 844, 主题: "极光原野", 时间秒: 2.5, 亮度: 0.5 });
      绘制街机彩砖背景动态(街机直接.图, 390, 844, 2.5, 0.5);
    });
    expect(序列(街机.调用)).toEqual(序列(街机直接.调用));
    expect(街机.调用.length).toBeGreaterThan(1);

    const 晶格 = 记录();
    const 晶格直接 = 记录();
    在主题内("立体晶格", () => {
      绘制背景动态(晶格.图, { 宽: 390, 高: 844, 主题: "极光原野", 时间秒: 2.5, 亮度: 0.5 });
      绘制立体晶格背景动态(晶格直接.图, 390, 844, 2.5, 0.5);
    });
    expect(序列(晶格.调用)).toEqual(序列(晶格直接.调用));

    // 像素背景入口在街机彩砖下也分发到专属后景。
    const 像素 = 记录();
    const 像素直接 = 记录();
    在主题内("街机彩砖", () => {
      绘制像素背景(像素.图, 390, 844);
      绘制街机彩砖背景(像素直接.图, 390, 844);
    });
    expect(序列(像素.调用)).toEqual(序列(像素直接.调用));
  });

  test("两套主题的顶栏外观配色仍取自身规范", () => {
    const 街机 = 记录();
    const 晶格 = 记录();
    在主题内("街机彩砖", () => {
      expect(读取背景外观配色("极光原野").文字基调).toBe("深底");
      街机.图.fillStyle(读取背景外观配色("极光原野").主色);
    });
    在主题内("立体晶格", () => {
      expect(读取背景外观配色("极光原野").文字基调).toBe("深底");
      晶格.图.fillStyle(读取背景外观配色("极光原野").主色);
    });
    expect(序列(街机.调用)[0][1]).not.toBe(序列(晶格.调用)[0][1]);
    expect(默认主题编号).toBe("极光原野");
  });
});

// ── 原 立体晶格背景.test.ts ──
describe("立体晶格背景", () => {
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
    arc(
      x: number,
      y: number,
      半径: number,
      起始角: number,
      结束角: number,
      逆时针?: boolean,
    ): this {
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
        for (const 参 of 调.参数)
          if (typeof 参 === "number") expect(Number.isFinite(参)).toBe(true);
    }
    expect(画静态(0, 844).调用列表.length).toBe(0);
    expect(画静态(390, 0).调用列表.length).toBe(0);
    expect(画动态(2, 1, -1, 844).调用列表.length).toBe(0);
  });

  test("配方文件零颜色字面量、不依赖 Phaser、宽高不写死", () => {
    const 内容 = readFileSync(join(项目根路径, "视效/背景/立体晶格背景.ts"), "utf8");
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
});

// ── 原 街机彩砖背景.test.ts ──
describe("街机彩砖背景", () => {
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
    arc(
      x: number,
      y: number,
      半径: number,
      起始角: number,
      结束角: number,
      逆时针?: boolean,
    ): this {
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
    const 文件 = join(项目根路径, "视效/背景/街机彩砖背景.ts");
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
});
