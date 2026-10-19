import { expect, test } from "bun:test";
import { 获取冲刺显示用时 } from "../代码/性能/计时显示";

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
