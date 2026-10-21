import { expect, test } from "bun:test";
import type Phaser from "phaser";
import { type 图形对象, 混合模式, 解析颜色数值 } from "../框架Three/界面/绘制/协议";
import type { Three图形 } from "../框架Three/界面/绘制/图形";

/**
 * 绘制契约的接线测试：Phaser Graphics 必须能直接当 `图形对象` 传给共享配方，
 * 否则 Phaser 版就要维护一套适配器并可能和 Three 后端语义漂移。
 * 这里是类型级断言；运行时只验证颜色解析与常量（不在 Bun 里加载 Phaser 运行时）。
 */

type 检查Phaser可直接传入 = Phaser.GameObjects.Graphics extends 图形对象 ? true : false;
const 检查: 检查Phaser可直接传入 = true;
type 检查Three可直接传入 = Three图形 extends 图形对象 ? true : false;
const 检查Three: 检查Three可直接传入 = true;

test("Phaser Graphics 结构上满足图形对象接口", () => {
  expect(检查).toBe(true);
});

test("Three 图形结构上满足同一框架绘制接口", () => {
  expect(检查Three).toBe(true);
});

test("混合模式数值按 Phaser.BlendModes 的序号约定", () => {
  // Phaser.BlendModes：SKIP_CHECK=-1、NORMAL=0、ADD=1；后端按这套数值映射。
  expect(混合模式.普通).toBe(0);
  expect(混合模式.叠加).toBe(1);
});

test("颜色解析接受数字、六位与三位 CSS 颜色", () => {
  expect(解析颜色数值(0x1a2b3c)).toBe(0x1a2b3c);
  expect(解析颜色数值("#1a2b3c")).toBe(0x1a2b3c);
  expect(解析颜色数值("#abc")).toBe(0xaabbcc);
  expect(() => 解析颜色数值("rgb(1,2,3)")).toThrow();
});
