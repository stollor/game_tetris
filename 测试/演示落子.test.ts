import { expect, test } from "bun:test";
import { 创建新局, 旋转方块, 硬降, 移动方块 } from "../代码/玩法/再消一行";
import { 选择演示落点 } from "../代码/玩法/演示落子";

function 随机源() {
  let 值 = 123456789;
  return () => {
    值 = (Math.imul(值, 1664525) + 1013904223) >>> 0;
    return 值 / 4294967296;
  };
}

function 落一子(
  状态: ReturnType<typeof 创建新局>,
  目标: "成功" | "失败",
  已落: number,
  随机: () => number,
) {
  const 选择 = 选择演示落点(状态, 目标, 已落);
  for (let i = 0; i < 选择.旋转次数; i++) 旋转方块(状态, 1, false, 随机);
  const 方向 = 选择.平移 < 0 ? -1 : 1;
  for (let i = 0; i < Math.abs(选择.平移); i++) 移动方块(状态, 方向, 0, 随机);
  硬降(状态, 随机);
}

test("演示落子能打完 40 行冲刺", () => {
  const 随机 = 随机源();
  const 状态 = 创建新局(随机, [], "冲刺");
  let 已落 = 0;
  while (状态.阶段 === "进行中" && 已落 < 180) {
    落一子(状态, "成功", 已落, 随机);
    已落 += 1;
  }
  expect(状态.完赛).toBe(true);
  expect(状态.消行数).toBeGreaterThanOrEqual(40);
});

test("演示落子按失败打会顶死而不是通关", () => {
  const 随机 = 随机源();
  const 状态 = 创建新局(随机, [], "冲刺");
  let 已落 = 0;
  while (状态.阶段 === "进行中" && 已落 < 80) {
    落一子(状态, "失败", 已落, 随机);
    已落 += 1;
  }
  expect(状态.阶段).toBe("结束");
  expect(状态.完赛).toBe(false);
  expect(已落).toBeGreaterThan(12);
});
