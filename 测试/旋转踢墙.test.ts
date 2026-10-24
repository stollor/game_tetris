import { expect, test } from "bun:test";
import {
  创建新局,
  可以放置,
  type 方块类型,
  旋转方块,
  移动方块,
  读取格子,
} from "../代码/玩法/再消一行";

const 类型列表: 方块类型[] = ["I", "O", "T", "S", "Z", "J", "L"];
function 中场(类型: 方块类型) {
  const 状态 = 创建新局(() => 0.5, [类型]);
  for (let i = 0; i < 9; i++) 移动方块(状态, 0, 1);
  return 状态;
}
const 排序 = (格子: [number, number][]) => 格子.map(([x, y]) => `${x},${y}`).sort();

test("左右旋转互为逆操作，形状与朝向不能各转各的", () => {
  for (const 类型 of 类型列表)
    for (const 方向 of [-1, 1] as const) {
      const 状态 = 中场(类型);
      const 原格子 = 排序(读取格子(状态.当前方块));
      expect(旋转方块(状态, 方向)).toBe(true);
      expect(旋转方块(状态, 方向 === 1 ? -1 : 1)).toBe(true);
      expect(状态.当前方块.旋转).toBe(0);
      expect(排序(读取格子(状态.当前方块))).toEqual(原格子);
    }
});

test("七种方块在两侧墙的四个朝向都可左右转，结果不越界", () => {
  for (const 类型 of 类型列表)
    for (const 方向 of [-1, 1] as const)
      for (const 墙 of [-1, 1] as const)
        for (let 朝向 = 0; 朝向 < 4; 朝向++) {
          const 状态 = 中场(类型);
          for (let i = 0; i < 朝向; i++) 旋转方块(状态, 1);
          while (移动方块(状态, 墙)) {}
          expect(旋转方块(状态, 方向)).toBe(true);
          expect(可以放置(状态, 状态.当前方块)).toBe(true);
        }
});

test("右墙旁邻块阻挡时，T/J/L 左转能使用正确的踢墙候选", () => {
  for (const 类型 of ["T", "J", "L"] as const) {
    const 状态 = 中场(类型);
    while (移动方块(状态, 1)) {}
    const 行 = 状态.棋盘[11];
    if (!行) throw new Error("缺少测试行");
    行[8] = "O";
    expect(旋转方块(状态, -1)).toBe(true);
    expect(状态.当前方块.旋转).toBe(3);
    expect(状态.最后踢墙编号).toBeGreaterThan(0);
    expect(可以放置(状态, 状态.当前方块)).toBe(true);
    expect(行[8]).toBe("O");
  }
});

test("所有踢墙候选都被阻挡时拒绝旋转且不改当前方块", () => {
  const 状态 = 中场("T");
  const 原 = structuredClone(状态.当前方块);
  const 占格 = new Set(读取格子(原).map(([x, y]) => `${x},${y}`));
  for (let y = 3; y <= 12; y++)
    for (let x = 0; x < 10; x++) {
      const 行 = 状态.棋盘[y + 2];
      if (行 && !占格.has(`${x},${y}`)) 行[x] = "O";
    }
  expect(旋转方块(状态, -1)).toBe(false);
  expect(状态.当前方块).toEqual(原);
});
