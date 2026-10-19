import { expect, test } from "bun:test";
import { 创建新局, 硬降 } from "../代码/玩法/再消一行";

test("四行特效快照保留实际行与每格颜色，重开不继承事件", () => {
  const s = 创建新局(() => 0, ["I", "O"]);
  s.当前方块.格子 = [-1, 0, 1, 2].map((行) => ({ 列2: 8, 行2: 行 * 2 }));
  for (const row of s.棋盘.slice(-4)) row.fill("J")[4] = null;
  硬降(s, () => 0);
  expect(s.消行数).toBe(4);
  expect(s.消行事件?.行).toEqual([16, 17, 18, 19]);
  expect(s.消行事件?.格子).toHaveLength(40);
  expect(s.消行事件?.格子.filter(([, , t]) => t === "I")).toHaveLength(4);
  expect(s.棋盘.every((r) => r.every((v) => v === null))).toBe(true);
  expect(创建新局(() => 0).消行事件).toBeUndefined();
});
