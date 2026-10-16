import { expect, test } from "bun:test";
import { 成就定义, 记录落块成就 } from "../代码/成就/俄罗斯方块成就";
import { 创建新局, 硬降 } from "../代码/玩法/俄罗斯方块";
import { 成就系统 } from "../框架/进度/成就";

test("真实四行全清驱动成就和累计行数，普通落块不伪造消行成就", () => {
  const 系统 = new 成就系统(成就定义, { getItem: () => null, setItem: () => {} }, "test");
  const s = 创建新局(() => 0, ["I", "O"]);
  s.当前方块.格子 = [-1, 0, 1, 2].map((行) => ({ 列2: 8, 行2: 行 * 2 }));
  for (const row of s.棋盘.slice(-4)) row.fill("J")[4] = null;
  硬降(s, () => 0);
  expect(记录落块成就(系统, s)).toContain("tetris");
  expect(系统.读取("perfect").解锁时间).not.toBeNull();
  expect(系统.读取("lines").进度).toBe(4);
  expect(系统.读取("spin").进度).toBe(0);
  硬降(s, () => 0);
  expect(记录落块成就(系统, s)).toEqual([]);
  expect(系统.读取("lines").进度).toBe(4);
});
