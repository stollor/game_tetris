import { expect, test } from "bun:test";
import {
  判定低端设备,
  应重绘动态背景,
  是省电模式,
  画质参数,
  计算像素比上限,
} from "../代码/性能/画质";

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
