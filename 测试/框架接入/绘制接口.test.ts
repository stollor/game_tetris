import { expect, test } from "bun:test";
import { type 图形对象, 混合模式, 解析颜色数值 } from "../../框架/界面/绘制/协议";
import type { Three图形 } from "../../框架/界面/绘制/图形";

type 检查Three可直接传入 = Three图形 extends 图形对象 ? true : false;
const 检查Three: 检查Three可直接传入 = true;

test("Three 图形满足框架绘制接口", () => {
  expect(检查Three).toBe(true);
});

test("混合模式保留普通与叠加语义", () => {
  expect(混合模式.普通).toBe(0);
  expect(混合模式.叠加).toBe(1);
});

test("颜色解析接受数字、六位与三位 CSS 颜色", () => {
  expect(解析颜色数值(0x1a2b3c)).toBe(0x1a2b3c);
  expect(解析颜色数值("#1a2b3c")).toBe(0x1a2b3c);
  expect(解析颜色数值("#abc")).toBe(0xaabbcc);
  expect(() => 解析颜色数值("rgb(1,2,3)")).toThrow();
});
