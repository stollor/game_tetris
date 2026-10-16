import { describe, expect, test } from "bun:test";
import { 创建纪录存档, 是否刷新纪录 } from "../代码/存档/对局纪录";

const 键 = "neon-pulse:best:马拉松";
function 创建存储(原文?: string) {
  const 数据 = new Map<string, string>(原文 === undefined ? [] : [[键, 原文]]);
  return {
    数据,
    getItem: (k: string) => 数据.get(k) ?? null,
    setItem: (k: string, v: string) => {
      数据.set(k, v);
    },
  };
}
const 新纪录 = { 分数: 1000, 用时: null, 消行数: 4, 等级: 1, 最长连击: 0 };
describe("框架纪录接入", () => {
  test("旧裸纪录和只含分数的早期纪录保持可读", () => {
    const 存储 = 创建存储('{"分数":900}');
    const 档 = 创建纪录存档("马拉松", "", 存储);
    expect(档.读取()).toEqual({ 分数: 900, 用时: null });
    expect(档.保存(新纪录)).toBe(true);
    expect(JSON.parse(存储.数据.get(键) ?? "null")).toEqual(新纪录);
  });
  test("损坏、非法数值和未知封装均保留原文", () => {
    for (const 原文 of [
      "{",
      '{"分数":-1}',
      '{"分数":1,"用时":"快"}',
      '{"版本":99,"数据":{"分数":9}}',
    ]) {
      const 存储 = 创建存储(原文),
        档 = 创建纪录存档("马拉松", "", 存储);
      expect(档.读取()).toBeNull();
      expect(档.保存(新纪录)).toBe(false);
      expect(存储.数据.get(键)).toBe(原文);
    }
  });
  test("没有旧档时正常保存，存储拒绝时不声称保存成功", () => {
    const 档 = 创建纪录存档("马拉松", "", 创建存储());
    expect(档.读取()).toBeNull();
    expect(档.保存(新纪录)).toBe(true);
    const 禁用 = 创建纪录存档("马拉松", "", {
      getItem: () => null,
      setItem: () => {
        throw new Error("禁用");
      },
    });
    禁用.读取();
    expect(禁用.保存(新纪录)).toBe(false);
  });
  test("冲刺无完赛纪录可被有效完赛替换，未完赛不刷新", () => {
    expect(是否刷新纪录("冲刺", { ...新纪录, 用时: 90000 }, 新纪录)).toBe(true);
    expect(是否刷新纪录("冲刺", 新纪录, { ...新纪录, 用时: 90000 })).toBe(false);
    expect(是否刷新纪录("冲刺", { ...新纪录, 用时: 100000 }, { ...新纪录, 用时: 90000 })).toBe(
      false,
    );
  });
  test("每日纪录按日期隔离，分数比较不覆盖更高纪录", () => {
    const 存储 = 创建存储();
    const 今天 = 创建纪录存档("每日挑战", "2026-10-11", 存储);
    今天.读取();
    expect(今天.保存(新纪录)).toBe(true);
    expect(创建纪录存档("每日挑战", "2026-10-12", 存储).读取()).toBeNull();
    expect(是否刷新纪录("马拉松", 新纪录, { ...新纪录, 分数: 1100 })).toBe(false);
  });
});
