import { expect, test } from "bun:test";
import { join, resolve } from "node:path";
import { 默认设置 } from "../代码/设置/游戏设置";
import { 暂停菜单页面 } from "../代码/页面/对局/暂停菜单页面";
import { 设置界面 } from "../代码/页面/设置界面";
import type { 控件接口 } from "../框架/界面/控件/类型";
import { 创建指针事件 } from "../框架/界面/控件/类型";
import { 创建页面上下文 } from "./three主界面交互.test";

const 项目根 = resolve(import.meta.dir, "..");

const 通用页面文件 = [
  "代码/页面/主界面.ts",
  "代码/页面/设置界面.ts",
  "代码/页面/成就界面.ts",
  "代码/页面/排行榜界面.ts",
  "代码/页面/商店界面.ts",
  "代码/页面/游戏页面基类.ts",
  "代码/页面/对局/暂停菜单页面.ts",
  "代码/页面/对局/设置面板.ts",
] as const;

function 读取控件层(页面: object): { 读取控件列表(): readonly 控件接口[] } {
  return (页面 as { 控件层: { 读取控件列表(): readonly 控件接口[] } }).控件层;
}

function 收集控件(根: 控件接口): 控件接口[] {
  return [根, ...(根.读取子控件?.() ?? []).flatMap(收集控件)];
}

function 收集类型(页面: object, 类型: string): 控件接口[] {
  return 读取控件层(页面)
    .读取控件列表()
    .flatMap(收集控件)
    .filter((项) => 项.类型 === 类型);
}

test("通用页面不自写处理按下", async () => {
  for (const 文件 of 通用页面文件) {
    const 源 = await Bun.file(join(项目根, 文件)).text();
    expect(源.includes("处理按下("), 文件).toBe(false);
  }
});

test("设置页布尔项走框架开关状态机，省电仍是三选一按钮", () => {
  const { 上下文, 命中 } = 创建页面上下文();
  const 页面 = new 设置界面(上下文);
  页面.进入();

  const 开关们 = 收集类型(页面, "开关");
  expect(开关们).toHaveLength(1);
  const 背景开关 = 开关们[0];
  if (!背景开关 || !("读取值" in 背景开关) || !("处理按下" in 背景开关))
    throw new Error("动态背景应是框架开关");
  const 开关控件 = 背景开关 as 控件接口 & {
    读取值(): boolean;
    处理按下(): unknown;
    处理抬起(事件: ReturnType<typeof 创建指针事件>): void;
  };
  expect(开关控件.读取值()).toBe(默认设置.背景动态);

  const 区 = 开关控件.读取矩形();
  开关控件.处理按下();
  开关控件.处理抬起(创建指针事件("抬起", { x: 区.左 + 区.宽 / 2, y: 区.上 + 区.高 / 2 }));
  expect(开关控件.读取值()).toBe(!默认设置.背景动态);
  expect(上下文.服务.设置.读取().背景动态).toBe(!默认设置.背景动态);

  const 名称 = 页面.读取界面().按钮.map((项) => 项.名称);
  expect(名称).toContain("设置:动态背景");
  expect(名称.filter((项) => 项.startsWith("设置:省电模式:")).sort()).toEqual([
    "设置:省电模式:关",
    "设置:省电模式:开",
    "设置:省电模式:自动",
  ]);
  expect(收集类型(页面, "开关")).toHaveLength(1);

  const 快照 = 页面.读取界面().按钮.find((项) => 项.名称 === "设置:动态背景");
  if (!快照) throw new Error("缺少动态背景快照");
  const 点 = { x: 快照.左 + 快照.宽 / 2, y: 快照.上 + 快照.高 / 2 };
  命中.派发("按下", 点);
  命中.派发("抬起", 点);
  expect(上下文.服务.设置.读取().背景动态).toBe(默认设置.背景动态);
  页面.销毁();
});

test("暂停设置壳体用框架面板，网格走开关而不是自写命中", () => {
  const { 上下文, 命中 } = 创建页面上下文();
  const 页面 = new 暂停菜单页面(上下文);
  页面.进入();
  const 入口 = 页面.读取界面().按钮.find((项) => 项.名称 === "对局设置");
  if (!入口) throw new Error("缺少对局设置");
  const 点 = { x: 入口.左 + 入口.宽 / 2, y: 入口.上 + 入口.高 / 2 };
  命中.派发("按下", 点);
  命中.派发("抬起", 点);

  expect(收集类型(页面, "面板")).toHaveLength(1);
  const 开关们 = 收集类型(页面, "开关");
  expect(开关们.length).toBeGreaterThanOrEqual(1);
  const 网格 = 开关们[0] as 控件接口 & {
    读取值(): boolean;
    处理按下(): unknown;
    处理抬起(事件: ReturnType<typeof 创建指针事件>): void;
  };
  expect(网格.读取值()).toBe(true);
  const 区 = 网格.读取矩形();
  网格.处理按下();
  网格.处理抬起(创建指针事件("抬起", { x: 区.左 + 区.宽 / 2, y: 区.上 + 区.高 / 2 }));
  expect(网格.读取值()).toBe(false);
  expect(上下文.服务.设置.读取().显示网格).toBe(false);

  const 名称 = 页面.读取界面().按钮.map((项) => 项.名称);
  expect(名称).toContain("网格:开");
  expect(名称).toContain("网格:关");
  expect(名称).not.toContain("处理按下");
  页面.销毁();
});
