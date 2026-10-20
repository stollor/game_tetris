import { expect, test } from "bun:test";
import { 计算商店布局, 计算商店方块陈列, 计算商店界面示意 } from "../代码/视觉/商店布局";
import { 计算下拉展开区域 } from "../组件/霓虹街机/页面配方";

test("手机商店沿用Phaser坞、目录与陈列尺寸", () => {
  const 页面 = 计算商店布局(390, 844);
  expect(页面.坞高).toBe(332);
  expect(页面.坞顶).toBe(504);
  expect(页面.部位卡[0]).toEqual({ 左: 16, 上: 512, 宽: 346 / 3, 高: 48 });
  expect(页面.目录).toEqual({ 左: 16, 上: 676, 宽: 358, 高: 100 });
  expect(页面.目录卡宽).toBe(96);
  expect(计算商店方块陈列(390, 844, 页面.坞高).列).toBe(2);
});

test("三档商店的部位、购买、目录与退出按钮均在屏幕内", () => {
  for (const [宽, 高] of [
    [390, 844],
    [430, 860],
    [1280, 720],
    [844, 390],
  ]) {
    const 页 = 计算商店布局(宽, 高);
    for (const 区 of [...页.部位卡, 页.单件, 页.整套, 页.目录, 页.退出, 页.纯享]) {
      expect(区.左).toBeGreaterThanOrEqual(0);
      expect(区.上).toBeGreaterThanOrEqual(0);
      expect(区.左 + 区.宽).toBeLessThanOrEqual(宽);
      expect(区.上 + 区.高).toBeLessThanOrEqual(高);
    }
    expect(计算商店界面示意(宽, 高, 页.坞高).宽).toBeLessThanOrEqual(宽);
  }
});

test("语言菜单向上展开，选项命中框完全位于共享面板内", () => {
  const 当前 = { 左: 100, 上: 400, 宽: 180, 高: 36 };
  const 展开 = 计算下拉展开区域(当前, 2);
  expect(展开.选项.map((项) => 项.上)).toEqual([326, 362]);
  for (const 项 of 展开.选项) {
    expect(项.上).toBeGreaterThan(展开.面板.上);
    expect(项.上 + 项.高).toBeLessThan(当前.上 + 当前.高);
  }
});
