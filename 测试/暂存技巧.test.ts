import { expect, test } from "bun:test";
import { type 再消一行状态, 创建新局, 暂存换块, 硬降 } from "../代码/玩法/再消一行";
import { 获取技巧反馈 } from "../代码/界面/技巧反馈";

test("暂存首次消费一个预告，重复操作无效；落块后交换不消费预告", () => {
  const s = 创建新局(() => 0, ["T", "I", "O", "J", "L"]);
  expect(暂存换块(s, () => 0)).toBe(true);
  expect([s.暂存方块, s.当前方块.类型, s.下一个方块]).toEqual(["T", "I", "O"]);
  const 原 = structuredClone(s);
  expect(暂存换块(s)).toBe(false);
  expect(s).toEqual(原);
  硬降(s, () => 0);
  expect(s.本块已暂存).toBe(false);
  const 队列 = [s.下一个方块, ...s.后续方块, ...s.袋子];
  s.最后旋转 = true;
  s.锁定毫秒 = 300;
  expect(暂存换块(s)).toBe(true);
  expect([s.暂存方块, s.当前方块.类型, s.当前方块.旋转]).toEqual(["O", "T", 0]);
  expect([s.下一个方块, ...s.后续方块, ...s.袋子]).toEqual(队列);
  expect(s.最后旋转).toBe(false);
  expect(s.锁定毫秒).toBe(0);
});
test("暂停与结束不能暂存，换入出生碰撞会结束，新局清空暂存", () => {
  const s = 创建新局(() => 0, ["T", "I"]);
  s.阶段 = "暂停";
  expect(暂存换块(s)).toBe(false);
  s.阶段 = "结束";
  expect(暂存换块(s)).toBe(false);
  s.阶段 = "进行中";
  s.棋盘[1]?.fill("J");
  expect(暂存换块(s)).toBe(true);
  expect(String(s.阶段)).toBe("结束");
  expect(创建新局().暂存方块).toBeNull();
});
function 四行(s: 再消一行状态) {
  s.当前方块.类型 = "I";
  s.当前方块.格子 = [-1, 0, 1, 2].map((行) => ({ 列2: 8, 行2: 行 * 2 }));
  for (const row of s.棋盘.slice(-4)) row.fill("J")[4] = null;
  硬降(s, () => 0);
}
test("连续四行与完美清场来自真实结算，反馈只显示实际奖励", () => {
  const s = 创建新局(() => 0, ["I", "I", "I"]);
  四行(s);
  expect(s.落块事件?.全清).toBe(true);
  expect(s.落块事件?.连续高难).toBe(false);
  expect(s.落块事件?.行数).toBe(4);
  const 分数 = s.分数;
  四行(s);
  const e = s.落块事件;
  expect(e?.序号).toBe(2);
  expect(e?.连击).toBe(2);
  expect(e?.连续高难).toBe(true);
  expect(e?.得分).toBe(s.分数 - 分数);
  if (!e) throw new Error("缺少真实落块事件");
  const 文案 = 获取技巧反馈(e, false);
  expect(文案).toContain("完美清场");
  expect(文案).toContain("四连消");
  expect(文案).toContain("连击 ×2");
  expect(文案).toContain("背靠背");
});
test("零行 T-Spin 也有技巧反馈，普通零行不弹奖励", () => {
  const e = {
    序号: 1,
    格子: [],
    类型: "T" as const,
    行数: 0,
    T旋: "完整" as const,
    全清: false,
    连击: 0,
    连续高难: false,
    得分: 400,
  };
  expect(获取技巧反馈(e, true)).toContain("T-SPIN");
  expect(获取技巧反馈({ ...e, T旋: "无", 得分: 0 }, false)).toBe("");
});
