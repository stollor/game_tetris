import { afterEach, expect, test } from "bun:test";
import { 获取画布像素比, 计算画布像素比, 设置画布像素比 } from "../框架/界面/画布像素比";

afterEach(() => 设置画布像素比(1));

test("画布像素比：未设上限保持 1，设上限后按 DPR 封顶", () => {
  expect(计算画布像素比(3, undefined)).toBe(1);
  expect(计算画布像素比(3.5, 3)).toBe(3);
  expect(计算画布像素比(2, 3)).toBe(2);
  expect(计算画布像素比(0.8, 3)).toBe(1);
  expect(计算画布像素比(undefined, 3)).toBe(1);
});

test("画布像素比状态读取最近设置值", () => {
  设置画布像素比(2);
  expect(获取画布像素比()).toBe(2);
  设置画布像素比(Number.NaN);
  expect(获取画布像素比()).toBe(1);
});
