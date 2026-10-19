import { expect, test } from "bun:test";
import { 旅行主题表 } from "../代码/框架配置/旅行主题";
import { 再消一行主题 } from "../代码/框架配置/界面主题";
import { 夜空鎏金, 暖纸古典, 青蓝未来 } from "../框架/样式/主题";
import { 获取游戏主题 } from "../框架/样式/样式";
import { 计算颜色对比度 } from "../框架/界面/颜色工具";

test("三套项目主题同步框架控件，保留通用主题，并保持正文与按钮可读", () => {
  for (const 原主题 of [夜空鎏金, 暖纸古典, 青蓝未来]) {
    const 名称 = 原主题.元信息.名称 as keyof typeof 再消一行主题;
    const 主题 = 再消一行主题[名称];
    expect(获取游戏主题(名称)).toBe(主题);
    expect(主题).not.toBe(原主题);
    expect(主题.页面.背景).not.toBe(原主题.页面.背景);
    for (const 文字 of [主题.文字.主要, 主题.文字.次要, 主题.文字.弱化, 主题.文字.强调]) {
      expect(计算颜色对比度(文字, 主题.面板.主面板.背景)).toBeGreaterThanOrEqual(4.5);
    }
    for (const 类别 of [主题.按钮.主要, 主题.按钮.次要])
      for (const 状态 of [类别.默认, 类别.移入, 类别.点击, 类别.聚焦])
        expect(计算颜色对比度(状态.文字, 状态.背景)).toBeGreaterThanOrEqual(4.5);
  }
});

test("十二套旅行主题的面板文字与按钮在全部交互状态保持可读", () => {
  expect(Object.keys(旅行主题表)).toHaveLength(12);
  for (const 主题 of Object.values(旅行主题表)) {
    for (const 文字 of [主题.文字.主要, 主题.文字.次要, 主题.文字.弱化, 主题.文字.强调])
      expect(计算颜色对比度(文字, 主题.面板.主面板.背景)).toBeGreaterThanOrEqual(4.5);
    for (const 类别 of [主题.按钮.主要, 主题.按钮.次要])
      for (const 状态 of [类别.默认, 类别.移入, 类别.点击, 类别.聚焦, 类别.禁用])
        expect(计算颜色对比度(状态.文字, 状态.背景)).toBeGreaterThanOrEqual(4.5);
  }
});
