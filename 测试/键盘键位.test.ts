import { expect, test } from "bun:test";
import { 输入状态, 键盘映射 } from "../代码/页面/对局/输入";

test("键盘键位：Z 左转、X 右转、空格硬降，↑ 同右转", () => {
  expect(键盘映射.KeyZ).toBe("左转");
  expect(键盘映射.KeyX).toBe("右转");
  expect(键盘映射.ArrowUp).toBe("右转");
  expect(键盘映射.Space).toBe("硬降");
  expect(键盘映射.KeyA).toBe("半转");
});

test("左转和右转换算成相反的旋转方向", () => {
  const 输入 = new 输入状态();
  expect(输入.按下(键盘映射.KeyZ ?? "左转")).toEqual([{ 类型: "旋转", 方向: -1 }]);
  输入.松开("左转");
  expect(输入.按下(键盘映射.KeyX ?? "右转")).toEqual([{ 类型: "旋转", 方向: 1 }]);
  expect(输入.按下("硬降")).toEqual([{ 类型: "硬降" }]);
});

test("每个旋转动作都有键盘键位，不会有只能转一边的情况", () => {
  const 键位 = new Set(Object.values(键盘映射));
  for (const 键 of ["左转", "右转", "半转", "硬降", "暂存"] as const)
    expect(键位.has(键)).toBe(true);
});
