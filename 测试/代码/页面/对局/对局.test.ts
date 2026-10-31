import { describe, expect, test } from "bun:test";
import {
  双击硬降毫秒,
  横移初始延迟毫秒,
  横移重复间隔毫秒,
  输入状态,
  键盘映射,
} from "../../../../代码/页面/对局/输入";

// ── 原 键盘键位.test.ts ──
describe("键盘键位", () => {
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
});

// ── 原 three版输入.test.ts ──
describe("three版输入", () => {
  describe("Three 版对局输入状态机", () => {
    test("首次横移立即触发，按住后走 DAS 延迟与 ARR 重复", () => {
      const 输入 = new 输入状态({ 现在: () => 0 });
      expect(输入.按下("左")).toEqual([{ 类型: "移动", 方向: -1 }]);
      expect(输入.按下("左")).toEqual([]);
      expect(输入.更新(横移初始延迟毫秒 - 1)).toEqual([]);
      expect(输入.更新(1)).toEqual([{ 类型: "移动", 方向: -1 }]);
      expect(输入.更新(横移重复间隔毫秒 * 2)).toEqual([
        { 类型: "移动", 方向: -1 },
        { 类型: "移动", 方向: -1 },
      ]);
      输入.松开("左");
      expect(输入.更新(1000)).toEqual([]);
    });

    test("左右同时按住各自重复，互不影响", () => {
      const 输入 = new 输入状态({ 现在: () => 0 });
      输入.按下("右");
      输入.按下("左");
      const 动作 = 输入.更新(横移初始延迟毫秒);
      expect(动作.filter((项) => 项.类型 === "移动")).toEqual([
        { 类型: "移动", 方向: -1 },
        { 类型: "移动", 方向: 1 },
      ] as never[]);
    });

    test("暂存点击立即触发一次，按住不重复，松开后可再次触发", () => {
      const 输入 = new 输入状态({ 现在: () => 0 });
      expect(输入.按下("暂存")).toEqual([{ 类型: "暂存" }]);
      expect(输入.按下("暂存")).toEqual([]);
      expect(输入.更新(1000)).toEqual([]);
      expect(输入.按下("暂存")).toEqual([]);
      输入.松开("暂存");
      expect(输入.按下("暂存")).toEqual([{ 类型: "暂存" }]);
    });

    test("触屏下键双击在 280ms 内变硬降，长按抬起后不触发", () => {
      let 现在 = 0;
      const 输入 = new 输入状态({ 现在: () => 现在 });
      expect(输入.按下("下")).toEqual([{ 类型: "软降" }]);
      现在 = 100;
      输入.松开("下");
      现在 = 100 + 双击硬降毫秒 - 1;
      expect(输入.按下("下")).toEqual([{ 类型: "硬降" }]);
      输入.松开("下");

      // 长按软降超过短按阈值后抬起，再按仍是软降。
      现在 = 5000;
      expect(输入.按下("下")).toEqual([{ 类型: "软降" }]);
      现在 = 5400;
      输入.松开("下");
      现在 = 5500;
      expect(输入.按下("下")).toEqual([{ 类型: "软降" }]);
    });

    test("清空后不再残留按住状态", () => {
      const 输入 = new 输入状态({ 现在: () => 0 });
      输入.按下("下");
      输入.按下("暂存");
      expect(输入.读取按住软降()).toBe(true);
      输入.清空();
      expect(输入.读取按住软降()).toBe(false);
      expect(输入.更新(1000)).toEqual([]);
    });
  });
});
