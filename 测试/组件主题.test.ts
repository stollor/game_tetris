import { expect, test } from "bun:test";
import { 解析游戏主题, 读取游戏主题目录 } from "../代码/主题/主题组合";
import { 设置预览主题读取 } from "../代码/主题/配色/主题读取";
import { 组装模式卡数据 } from "../代码/界面/模式卡数据";
import { 默认设置 } from "../代码/设置/游戏设置";
import { 读取组件主题槽位 } from "../框架/设置/主题组合";
import { 生成模式卡文字项 } from "../组件/模式选择/模式卡配方";

test("模式卡未注册主题，切换配色不改变牌面文字色", () => {
  const 目录 = 读取游戏主题目录();
  const 极光 = 解析游戏主题(默认设置, "极光原野");
  const 暖纸 = 解析游戏主题(默认设置, "待分类@配色=暖纸古典");
  expect(读取组件主题槽位(极光, "模式卡", 目录)).toEqual([]);
  expect(读取组件主题槽位(暖纸, "模式卡", 目录)).toEqual([]);
  expect(读取组件主题槽位(极光, "对局仪表", 目录).map((项) => 项.槽位.编号)).toEqual([
    "界面配色",
    "仪表纹样",
    "仪表表现",
  ]);
  const 数据 = 组装模式卡数据("冲刺", false, null);
  const 布局 = { 中心X: 195, 中心Y: 110, 宽: 350, 高: 110 };
  const 色 = (样式: string) => {
    设置预览主题读取(() => ({
      ...默认设置,
      样式: 样式 as typeof 默认设置.样式,
      旅行样式: null,
    }));
    try {
      return 生成模式卡文字项(布局, 数据).map((项) => 项.样式.颜色);
    } finally {
      设置预览主题读取();
    }
  };
  expect(色("极光原野")).toEqual(色("暖纸古典"));
});

test("注册主题组件引用真实组件绘制入口", async () => {
  const 目录 = 读取游戏主题目录();
  for (const 组件 of 目录.组件 ?? []) {
    expect(组件.源码?.length).toBeGreaterThan(0);
    for (const 源 of 组件.源码 ?? []) {
      const 模块 = await import(new URL(`../${源.路径}`, import.meta.url).href);
      expect(typeof 模块[源.导出 ?? ""]).toBe("function");
    }
  }
});
