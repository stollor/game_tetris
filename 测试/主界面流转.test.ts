import { expect, test } from "bun:test";
import { 规划界面流转, type 可绘制流转块 } from "../框架/界面/流转";
import { 菜单页 } from "../代码/页面/菜单页";
import { 模式选择页 } from "../代码/页面/模式选择页";
import { 纯享页 } from "../代码/页面/纯享页";
import { 创建页面上下文 } from "./three主界面交互.test";

/**
 * 跨页流转：三页各自声明自己的 UI 元素为流转块，框架按身份算出这一帧的画面。
 * 背景不在流转里——它由背景层常驻，三页共用同一张，所以菜单 / 模式选择 / 纯享 的背景完全不变。
 * 两边都有的身份（游戏标题）连续位移变形，只有一侧的按贴边规则滑出或原地淡出。
 */

function 准备存储(): void {
  const 数据 = new Map<string, string>();
  (globalThis as { localStorage?: Storage }).localStorage = {
    get length() {
      return 数据.size;
    },
    clear: () => 数据.clear(),
    getItem: (键: string) => 数据.get(键) ?? null,
    key: (索引: number) => [...数据.keys()][索引] ?? null,
    removeItem: (键: string) => void 数据.delete(键),
    setItem: (键: string, 值: string) => void 数据.set(键, 值),
  };
}

function 建页<T extends { 进入(): void; 销毁(): void }>(页: T): T {
  页.进入();
  return 页;
}

const 身份表 = (块: readonly 可绘制流转块[]) => 块.map((项) => 项.身份);

test("三个页面只声明自己的 UI 元素，背景不参与流转", () => {
  准备存储();
  const 菜单 = 建页(new 菜单页(创建页面上下文().上下文));
  const 模式 = 建页(new 模式选择页(创建页面上下文().上下文));
  const 纯享 = 建页(new 纯享页(创建页面上下文({ 参数: { 来源: "菜单" } }).上下文));

  expect(身份表(菜单.读取流转块())).toEqual([
    "游戏标题",
    "角钮:设置",
    "角钮:成就",
    "角钮:商店",
    "开始游戏",
  ]);
  const 模式块 = 身份表(模式.读取流转块());
  expect(模式块.slice(0, 2)).toEqual(["游戏标题", "选择模式"]);
  expect(模式块.slice(2, 7)).toEqual([
    "模式:马拉松",
    "模式:冲刺",
    "模式:极限",
    "模式:每日挑战",
    "模式:练习",
  ]);
  expect(模式块.at(-1)).toBe("返回");
  expect(身份表(纯享.读取流转块())).toEqual(["纯享"]);
  // 三页都不声明风景块。
  for (const 块 of [...菜单.读取流转块(), ...模式.读取流转块(), ...纯享.读取流转块()])
    expect(块.身份).not.toContain("风景");

  菜单.销毁();
  模式.销毁();
  纯享.销毁();
});

test("菜单 → 模式选择：游戏标题连续变形，两侧独有元素淡出/淡入", () => {
  准备存储();
  const 菜单 = 建页(new 菜单页(创建页面上下文().上下文));
  const 模式 = 建页(new 模式选择页(创建页面上下文().上下文));
  const 菜单块 = 菜单.读取流转块();
  const 模式块 = 模式.读取流转块();
  const 菜单标题 = 菜单块.find((块) => 块.身份 === "游戏标题");
  const 模式标题 = 模式块.find((块) => 块.身份 === "游戏标题");
  // 模式选择页的游戏名比菜单大标题小、也更靠上。
  expect(模式标题?.矩形.高 ?? 0).toBeLessThan(菜单标题?.矩形.高 ?? 0);
  expect(模式标题?.矩形.上 ?? 0).toBeLessThan(菜单标题?.矩形.上 ?? 0);

  const 画面 = 规划界面流转(菜单块, 模式块, 0.5, { 宽: 390, 高: 844 });
  const 取 = (身份: string) => 画面.find((项) => 项.身份 === 身份);

  // 标题连续变形：一半进度在两者之间，不淡出。
  expect(画面.filter((项) => 项.身份 === "游戏标题")).toHaveLength(1);
  expect(取("游戏标题")).toMatchObject({ 来源: "出发", 透明度: 1 });
  expect(取("游戏标题")?.当前.高).toBeCloseTo(
    ((菜单标题?.矩形.高 ?? 0) + (模式标题?.矩形.高 ?? 0)) / 2,
  );
  expect(取("游戏标题")?.当前.上).toBeGreaterThan(模式标题?.矩形.上 ?? 0);
  expect(取("游戏标题")?.当前.上).toBeLessThan(菜单标题?.矩形.上 ?? 0);

  // 菜单独有的元素淡出，模式选择独有的元素淡入。
  expect(取("开始游戏")?.透明度).toBe(0.5);
  expect(取("角钮:设置")?.透明度).toBe(0.5);
  expect(取("选择模式")).toMatchObject({ 来源: "到达", 透明度: 0.5 });
  expect(取("模式:马拉松")).toMatchObject({ 来源: "到达", 透明度: 0.5 });
  expect(取("返回")).toMatchObject({ 来源: "到达", 透明度: 0.5 });

  菜单.销毁();
  模式.销毁();
});

test("模式选择 → 纯享：整屏浮层从下方 160px 滑入", () => {
  准备存储();
  const 模式 = 建页(new 模式选择页(创建页面上下文().上下文));
  const 纯享 = 建页(new 纯享页(创建页面上下文({ 参数: { 来源: "菜单" } }).上下文));
  const 画面 = 规划界面流转(模式.读取流转块(), 纯享.读取流转块(), 0.5, {
    宽: 390,
    高: 844,
  });
  const 取 = (身份: string) => 画面.find((项) => 项.身份 === 身份);

  const 纯享画面 = 取("纯享");
  expect(纯享画面).toMatchObject({ 来源: "到达", 透明度: 0.5 });
  expect((纯享画面?.当前.上 ?? 0) - (纯享画面?.静止.上 ?? 0)).toBeGreaterThan(0);
  expect(纯享画面?.当前.上).toBeLessThan(160);
  // 模式选择自己的元素淡出。
  expect(取("选择模式")?.透明度).toBe(0.5);
  expect(取("模式:马拉松")?.透明度).toBe(0.5);

  模式.销毁();
  纯享.销毁();
});
