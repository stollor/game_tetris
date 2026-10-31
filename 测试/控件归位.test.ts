import { expect, test } from "bun:test";
import { join, resolve } from "node:path";
import { 默认设置 } from "../代码/设置/游戏设置";
import { 暂停菜单页面 } from "../代码/页面/对局/暂停菜单页面";
import { 设置界面 } from "../代码/页面/设置界面";
import { 创建页面上下文 } from "./three主界面交互.test";
import { 遍历节点 } from "../框架/节点/遍历";
import { 开关组件 } from "../框架/节点/组件/开关";
import { 按钮组件 } from "../框架/节点/组件/按钮";

const 项目根 = resolve(import.meta.dir, "..");

const 通用页面文件 = [
  "代码/页面/菜单页.ts",
  "代码/页面/模式选择页.ts",
  "代码/页面/纯享页.ts",
  "代码/页面/设置界面.ts",
  "代码/页面/成就界面.ts",
  "代码/页面/排行榜界面.ts",
  "代码/页面/商店界面.ts",
  "代码/页面/游戏页面基类.ts",
  "代码/页面/对局/暂停菜单页面.ts",
  "代码/页面/对局/设置面板.ts",
] as const;

test("通用页面不自写处理按下", async () => {
  for (const 文件 of 通用页面文件) {
    const 源 = await Bun.file(join(项目根, 文件)).text();
    expect(源.includes("处理按下("), 文件).toBe(false);
  }
});

test("设置页布尔项走框架开关组件，省电仍是三选一按钮", () => {
  const { 上下文, 命中 } = 创建页面上下文();
  const 页面 = new 设置界面(上下文);
  页面.进入();

  const 开关们: 开关组件[] = [];
  const 根 = 页面.读取节点根();
  if (!根) throw new Error("设置页缺少节点树");
  遍历节点(根, (节点) => {
    const 开关 = 节点.读取组件<开关组件>(开关组件);
    if (开关) 开关们.push(开关);
  });
  expect(开关们).toHaveLength(1);
  expect(开关们[0]?.读取值()).toBe(默认设置.背景动态);

  const 名称 = 页面.读取界面().按钮.map((项) => 项.名称);
  expect(名称).toContain("设置:动态背景");
  expect(名称.filter((项) => 项.startsWith("设置:省电模式:")).sort()).toEqual([
    "设置:省电模式:关",
    "设置:省电模式:开",
    "设置:省电模式:自动",
  ]);

  const 点开关 = () => {
    const 快照 = 页面.读取界面().按钮.find((项) => 项.名称 === "设置:动态背景");
    if (!快照) throw new Error("缺少动态背景快照");
    const 点 = { x: 快照.左 + 快照.宽 / 2, y: 快照.上 + 快照.高 / 2 };
    命中.派发("按下", 点);
    命中.派发("抬起", 点);
  };
  点开关();
  expect(上下文.服务.设置.读取().背景动态).toBe(!默认设置.背景动态);
  点开关();
  expect(上下文.服务.设置.读取().背景动态).toBe(默认设置.背景动态);
  页面.销毁();
});

test("设置页页签与子页签可切换，内容节点随之重建", () => {
  const { 上下文, 命中 } = 创建页面上下文();
  const 页面 = new 设置界面(上下文);
  页面.进入();
  const 点名称 = (名称: string) => {
    const 快照 = 页面.读取界面().按钮.find((项) => 项.名称 === 名称);
    if (!快照) throw new Error(`缺少 ${名称}`);
    const 点 = { x: 快照.左 + 快照.宽 / 2, y: 快照.上 + 快照.高 / 2 };
    命中.派发("按下", 点);
    命中.派发("抬起", 点);
  };
  点名称("设置:页签");
  expect(页面.读取界面().文字).toContain("页签:外观");
  点名称("设置:子页签");
  expect(页面.读取界面().文字).toContain("外观页:自定义");
  页面.销毁();
});

test("暂停设置壳体走节点：面板拦截 + 网格开关组件，不再自写命中", () => {
  const { 上下文, 命中 } = 创建页面上下文();
  const 页面 = new 暂停菜单页面(上下文);
  页面.进入();
  const 点名称 = (名称: string) => {
    const 快照 = 页面.读取界面().按钮.find((项) => 项.名称 === 名称);
    if (!快照) throw new Error(`缺少 ${名称}`);
    const 点 = { x: 快照.左 + 快照.宽 / 2, y: 快照.上 + 快照.高 / 2 };
    命中.派发("按下", 点);
    命中.派发("抬起", 点);
  };
  const 入口 = 页面.读取界面().按钮.find((项) => 项.名称 === "对局设置");
  if (!入口) throw new Error("缺少对局设置");
  const 点 = { x: 入口.左 + 入口.宽 / 2, y: 入口.上 + 入口.高 / 2 };
  命中.派发("按下", 点);
  命中.派发("抬起", 点);

  const 根 = 页面.读取节点根()!;
  const 面板拦截 = 根.子.find((节点) => 节点.名称 === "对局设置:面板");
  expect(面板拦截).toBeDefined();
  expect(面板拦截?.读取组件<按钮组件>(按钮组件)).toBeDefined();

  const 开关们: 开关组件[] = [];
  遍历节点(根, (节点) => {
    const 开关 = 节点.读取组件<开关组件>(开关组件);
    if (开关) 开关们.push(开关);
  });
  expect(开关们.length).toBeGreaterThanOrEqual(1);
  expect(开关们[0]?.读取值()).toBe(true);

  const 名称 = 页面.读取界面().按钮.map((项) => 项.名称);
  expect(名称).toContain("网格:开");
  expect(名称).toContain("网格:关");
  expect(名称).not.toContain("处理按下");

  点名称("网格:关");
  expect(上下文.服务.设置.读取().显示网格).toBe(false);
  页面.销毁();
});
