import { describe, expect, test } from "bun:test";
import {
  判定低端设备,
  应重绘动态背景,
  是省电模式,
  画质参数,
  计算像素比上限,
} from "../../../代码/性能/画质";
import { 获取冲刺显示用时 } from "../../../代码/性能/计时显示";

// ── 原 画质.test.ts ──
describe("画质", () => {
  test("低端判定：≤4 核或 ≤3GB 内存或上次实测掉帧", () => {
    expect(判定低端设备({ 核心数: 8, 内存GB: 8 })).toBe(false);
    expect(判定低端设备({ 核心数: 4, 内存GB: 8 })).toBe(true);
    expect(判定低端设备({ 核心数: 8, 内存GB: 2 })).toBe(true);
    expect(判定低端设备({ 核心数: 8, 实测低端: true })).toBe(true);
    expect(判定低端设备({})).toBe(false);
  });

  test("设置优先于自动判定；两档都保留 3 倍清晰度", () => {
    expect(是省电模式("开", { 核心数: 16 })).toBe(true);
    expect(是省电模式("关", { 核心数: 2 })).toBe(false);
    expect(是省电模式("自动", { 核心数: 2 })).toBe(true);
    expect(计算像素比上限(true)).toBe(4);
    expect(计算像素比上限(false)).toBe(4);
    expect(画质参数.标准帧率).toBe(60);
    expect(画质参数.省电帧率).toBe(30);
  });

  test("动态背景首帧必画，间隔内不重复绘制，时间回退后恢复", () => {
    const 图 = {};
    expect(应重绘动态背景(图, 0, false)).toBe(true);
    expect(应重绘动态背景(图, 16, false)).toBe(false);
    expect(应重绘动态背景(图, 100, false)).toBe(true);
    expect(应重绘动态背景(图, 110, false)).toBe(false);
    expect(应重绘动态背景(图, 0, false)).toBe(true);
  });
});

// ── 原 计时显示.test.ts ──
describe("计时显示", () => {
  test("冲刺进行中按50毫秒整桶向下取整", () => {
    expect(获取冲刺显示用时(0, true)).toBe(0);
    expect(获取冲刺显示用时(49.999, true)).toBe(0);
    expect(获取冲刺显示用时(50, true)).toBe(50);
    expect(获取冲刺显示用时(99.999, true)).toBe(50);
    expect(获取冲刺显示用时(100, true)).toBe(100);
  });

  test("暂停与结束保留原始有效用时", () => {
    expect(获取冲刺显示用时(49.999, false)).toBe(49.999);
    expect(获取冲刺显示用时(12345, false)).toBe(12345);
  });

  test("重开回到0后重新按整桶显示", () => {
    const 结束后 = 获取冲刺显示用时(12345, false);
    expect(结束后).toBe(12345);
    expect(获取冲刺显示用时(0, true)).toBe(0);
  });
});
