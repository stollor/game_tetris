import { expect, test } from "bun:test";
import { 创建新局 } from "../../代码/玩法/再消一行";
import { 生成自动落子计划, 选择自动落子 } from "../接入/自动落子";

test("自动落子复用真实规则，从空棋盘完成固定七袋序列的40行冲刺", () => {
  const 计划 = 生成自动落子计划("冲刺");
  expect(计划.完赛).toBe(true);
  expect(计划.消行数).toBeGreaterThanOrEqual(40);
  expect(计划.步骤.length).toBeLessThan(400);
  expect(计划.步骤.at(-1)?.阶段).toBe("结束");
}, 15000);
test("规划不改原状态，相同输入得到相同操作与棋盘", () => {
  const 状态 = 创建新局(() => 0.5, ["T", "I", "O"]);
  const 原 = structuredClone(状态);
  expect(选择自动落子(状态)).toEqual(选择自动落子(状态));
  expect(状态).toEqual(原);
});
