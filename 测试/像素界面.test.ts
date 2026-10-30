import { expect, test } from "bun:test";
import { 主题结果转设置, 解析游戏主题 } from "../主题/主题组合";
import { 像素四色, 像素规范, 砖机液晶规范, 街机彩砖规范 } from "../主题/像素/像素规范";
import { 像素图标 } from "../主题/像素/界面像素规格";
import { 创建游戏主题 } from "../主题/游戏主题";
import { 设置预览主题读取 } from "../主题/配色/主题读取";
import { 像素配色, 彩砖配色 } from "../主题/配色/像素配色";
import { 默认设置 } from "../代码/设置/游戏设置";
import type { 图形对象 } from "../框架/界面/绘制/协议";
import { 计算颜色对比度 } from "../框架/界面/颜色工具";
import { 绘制旅行图标 } from "../组件/基础/图标";
import { 成就图标编号列表, 绘制成就图标 } from "../组件/基础/成就图标";
import { 绘制玻璃按钮底板, 绘制玻璃面板基底 } from "../组件/基础/玻璃绘制";
import { 绘制下拉框, 绘制列表行, 绘制开关, 绘制滑块 } from "../组件/基础/页面配方";
import { 绘制收藏按钮底板, 绘制收藏纸页 } from "../组件/收藏/收藏牌面配方";
import { 绘制结算面板, 计算霓虹结算布局 } from "../组件/结算/结算台配方";
import { 读取预览主题解析, 读取预览主题设置 } from "../组件/预览/主题状态";

test("像素主题的基础控件、图标与收藏结算只输出硬边矩形", () => {
  const 方法: string[] = [];
  let 图: 图形对象;
  图 = new Proxy({} as 图形对象, {
    get:
      (_, 键) =>
      (..._参数: unknown[]) => {
        方法.push(String(键));
        return 图;
      },
  });
  const 状态 = { 资源主题: 像素规范.名称 };
  const 设置 = 读取预览主题设置(状态, 默认设置);
  设置预览主题读取(
    () => 设置,
    () => 读取预览主题解析(状态, 设置),
  );
  try {
    const 区 = { 左: 0, 上: 0, 宽: 120, 高: 48 };
    绘制玻璃面板基底(图, 0, 0, 120, 48);
    绘制玻璃按钮底板(图, 60, 24, 120, 48);
    绘制开关(图, { 中心X: 30, 中心Y: 20, 宽: 48, 高: 24 }, true, 0, 0xffffff);
    绘制滑块(图, 100, 20, 100, 0.5, 0, 0xffffff);
    绘制下拉框(图, 区, 0, 0xffffff);
    绘制列表行(图, 区, 0, 0xffffff, 1, 3, { 比例: 0.5, 轨道色: 0, 强调色: 0xffffff });
    for (const 名 of ["关闭", "方块币", "风景", "设置", "成就", "商店", "排行"] as const)
      绘制旅行图标(图, 名);
    for (const 编号 of 成就图标编号列表) 绘制成就图标(图, 编号, 0xffffff);
    绘制收藏纸页(图, 0, 0, 120, 200);
    绘制收藏按钮底板(图, 60, 24, 120, 48, { 金色: true }, { 按下: true });
    绘制结算面板(图, 计算霓虹结算布局(390, 844));
    expect(方法.filter((项) => 项 === "fillRect").length).toBeGreaterThan(200);
    expect([...new Set(方法)]).toEqual(["fillStyle", "fillRect"]);
  } finally {
    设置预览主题读取();
  }
});

test("像素图符是完整九格点阵", () => {
  for (const 图案 of Object.values(像素图标)) {
    expect(图案.length).toBe(9);
    for (const 行 of 图案) expect(行.length).toBe(9);
  }
});

test("砖机液晶规范只使用四色，完整主题可解析", () => {
  expect(砖机液晶规范.名称).toBe("砖机液晶");
  const 四 = new Set(Object.values(像素四色));
  for (const 值 of Object.values(砖机液晶规范.色)) expect(四.has(值)).toBe(true);
  const 结果 = 解析游戏主题(默认设置, 砖机液晶规范.名称);
  const 槽 = (编号: string) => 结果.槽位.find((项) => 项.槽位.编号 === 编号)?.资源.值;
  expect(槽("界面表现")).toBe("像素");
  expect(槽("仪表表现")).toBe("像素");
  expect(槽("字体")).toBe("像素");
  expect(槽("界面配色")).toBe(砖机液晶规范.名称);
  expect(槽("方块外观")).toBe(砖机液晶规范.名称);
  expect(创建游戏主题(主题结果转设置(默认设置, 结果)).深色).toBe(false);
  const 底 = 像素配色.面板.主面板.背景;
  for (const 文字 of [像素配色.文字.主要, 像素配色.文字.次要, 像素配色.文字.强调])
    expect(计算颜色对比度(文字, 底)).toBeGreaterThanOrEqual(4.5);
  expect(计算颜色对比度(像素配色.文字.弱化, 底)).toBeGreaterThanOrEqual(2);
});

test("街机彩砖是深色七色像素主题，正文对比达标", () => {
  expect(街机彩砖规范.深色).toBe(true);
  expect(街机彩砖规范.方块填井).toBe(false);
  expect(new Set(Object.values(街机彩砖规范.方块)).size).toBe(7);
  for (const 色 of Object.values(砖机液晶规范.方块))
    expect(Object.values(街机彩砖规范.方块)).not.toContain(色);
  const 结果 = 解析游戏主题(默认设置, 街机彩砖规范.名称);
  const 槽 = (编号: string) => 结果.槽位.find((项) => 项.槽位.编号 === 编号)?.资源.值;
  expect(槽("界面表现")).toBe("像素");
  expect(槽("界面配色")).toBe(街机彩砖规范.名称);
  expect(槽("方块外观")).toBe(街机彩砖规范.名称);
  expect(创建游戏主题(主题结果转设置(默认设置, 结果)).深色).toBe(true);
  const 底 = 彩砖配色.面板.主面板.背景;
  for (const 文字 of [彩砖配色.文字.主要, 彩砖配色.文字.次要, 彩砖配色.文字.强调])
    expect(计算颜色对比度(文字, 底)).toBeGreaterThanOrEqual(4.5);
  expect(计算颜色对比度(彩砖配色.文字.弱化, 底)).toBeGreaterThanOrEqual(2);
});
