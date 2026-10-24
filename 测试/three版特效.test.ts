import { expect, test } from "bun:test";
import { 创建特效状态, 更新特效, 触发消行, 触发硬降, 触发锁定 } from "../代码/应用/视觉/特效";
import { 创建新局, 更新时钟, 硬降, 读取格子 } from "../代码/玩法/再消一行";
import { 计算对局设置布局 } from "../代码/视觉/对局设置配方";
import { 读取成就提示透明度 } from "../代码/视觉/特效配方";
import { 读取结算金币动画 } from "../代码/视觉/结算金币配方";
import { 准备消行样本 } from "./接入/验收样本";

test("出生位置仍在棋盘上方时硬降有拖尾，末帧被清除", () => {
  const 状态 = 创建新局(() => 0.5, ["I", "O"], "马拉松");
  const 原格 = 读取格子(状态.当前方块);
  expect(原格.every(([, 行]) => 行 < 0)).toBe(true);
  const 距离 = 硬降(状态, () => 0.5);
  const 特效 = 创建特效状态();
  触发硬降(特效, 原格, 距离, "I");
  expect(特效.拖尾?.列.length).toBe(4);
  expect(特效.拖尾?.列.every((列) => 列.底行 === 20)).toBe(true);
  更新特效(特效, 0.24);
  expect(特效.拖尾).toBeNull();
});

test("真正四行样本产生四行消除事件及庆祝，单行样本仅消一行", () => {
  for (const 行数 of [1, 4] as const) {
    const 状态 = 创建新局(() => 0.5, ["I", "O"], "马拉松");
    准备消行样本(状态, 行数);
    expect(状态.消行数).toBe(0);
    硬降(状态, () => 0.5);
    expect(状态.消行事件?.行.length).toBe(行数);
    const 特效 = 创建特效状态();
    触发消行(特效, 状态.消行事件?.行 ?? []);
    触发锁定(特效, 状态.落块事件?.格子 ?? []);
    expect(特效.锁定).not.toBeNull();
    expect(特效.庆祝).toBe(行数 === 4 ? 1 : 0);
    更新时钟(状态, 1000, () => 0.5);
    expect(状态.消行数).toBe(行数);
  }
});

test("四行样本可保留堆叠并延续真实连击与背靠背", () => {
  const 状态 = 创建新局(() => 0.5, ["I", "O"], "马拉松");
  准备消行样本(状态, 4, true);
  expect(读取格子(状态.当前方块).every(([列]) => 列 === 4)).toBe(true);
  硬降(状态, () => 0.5);
  更新时钟(状态, 1000, () => 0.5);
  expect(状态.棋盘.at(-1)?.[0]).toBe("L");
  准备消行样本(状态, 4, true);
  硬降(状态, () => 0.5);
  expect(状态.落块事件?.连续高难).toBe(true);
  expect(状态.落块事件?.连击).toBe(2);
});

test("成就提示秒单位保持可见，只在末尾350ms淡出", () => {
  expect(读取成就提示透明度(2.4)).toBe(1);
  expect(读取成就提示透明度(0.175)).toBeCloseTo(0.5);
  expect(读取成就提示透明度(0)).toBe(0);
});

test("金币计数等待250ms、飞币依序出现并结束，省电只有淡入", () => {
  expect(读取结算金币动画(0, 60, false).显示数量).toBe(0);
  expect(读取结算金币动画(249, 60, false).显示数量).toBe(0);
  expect(读取结算金币动画(500, 60, false).显示数量).toBeGreaterThan(0);
  expect(读取结算金币动画(200, 60, false).飞币.filter((币) => 币.透明度 > 0)).toHaveLength(2);
  const 最终 = 读取结算金币动画(2000, 60, false);
  expect(最终.显示数量).toBe(60);
  expect(最终.活跃).toBe(false);
  expect(最终.飞币.every((币) => 币.透明度 === 0)).toBe(true);
  expect(读取结算金币动画(800, 60, false).闪光透明度).toBeGreaterThan(0);
  const 省电 = 读取结算金币动画(110, 60, true);
  expect(省电.显示数量).toBe(60);
  expect(省电.透明度).toBe(0.5);
  expect(省电.飞币).toEqual([]);
  expect(省电.闪光透明度).toBe(0);
});

test("对局设置在目标三种模拟视口内，滑块与适用的设置按钮共用布局", () => {
  for (const [宽, 高] of [
    [390, 844],
    [430, 860],
    [1280, 720],
  ]) {
    if (宽 === undefined || 高 === undefined) continue;
    const 定位 = 计算对局设置布局(宽, 高);
    expect(定位.按钮).toHaveLength(宽 > 高 ? 6 : 4);
    expect(定位.按钮.some((项) => 项.名称.startsWith("上键:"))).toBe(false);
    for (const 矩 of [定位.面板, 定位.滑块, ...定位.按钮.map((项) => 项.矩形)]) {
      expect(矩.左).toBeGreaterThanOrEqual(0);
      expect(矩.上).toBeGreaterThanOrEqual(0);
      expect(矩.左 + 矩.宽).toBeLessThanOrEqual(宽);
      expect(矩.上 + 矩.高).toBeLessThanOrEqual(高);
    }
  }
});
