import { describe, expect, test } from "bun:test";
import { 创建纪录存档, 是否刷新纪录 } from "../../../代码/存档/对局纪录";
import { 迁移更名前存档 } from "../../../代码/存档/更名迁移";
import { 计算目录滚动 } from "../../../代码/界面/目录滚动";

// ── 原 更名迁移.test.ts ──
describe("更名迁移", () => {
  function 假存储(初始: Record<string, string> = {}): Storage {
    const m = new Map(Object.entries(初始));
    return {
      get length() {
        return m.size;
      },
      clear: () => m.clear(),
      getItem: (k: string) => m.get(k) ?? null,
      key: (i: number) => [...m.keys()][i] ?? null,
      removeItem: (k: string) => void m.delete(k),
      setItem: (k: string, v: string) => void m.set(k, v),
    };
  }

  test("旧设置键迁移到新键并删除旧键", () => {
    const s = 假存储({ "俄罗斯方块:设置": '{"显示网格":false}' });
    迁移更名前存档(s);
    expect(s.getItem("再消一行:设置")).toBe('{"显示网格":false}');
    expect(s.getItem("俄罗斯方块:设置")).toBeNull();
  });

  test("已有新设置键时保留新键，不覆盖", () => {
    const s = 假存储({
      "俄罗斯方块:设置": '{"显示网格":false}',
      "再消一行:设置": '{"显示网格":true}',
    });
    迁移更名前存档(s);
    expect(s.getItem("再消一行:设置")).toBe('{"显示网格":true}');
    expect(s.getItem("俄罗斯方块:设置")).toBe('{"显示网格":false}');
  });

  test("旧四行成就编号迁移到新编号，其他成就原样保留", () => {
    const s = 假存储({
      "neon-pulse:achievements": JSON.stringify({
        版本: 1,
        数据: {
          tetris: { 进度: 1, 解锁时间: 100 },
          spin: { 进度: 1, 解锁时间: 200 },
        },
      }),
    });
    迁移更名前存档(s);
    const 存档 = JSON.parse(s.getItem("neon-pulse:achievements") ?? "{}");
    expect(存档).toEqual({
      版本: 1,
      数据: {
        "four-lines": { 进度: 1, 解锁时间: 100 },
        spin: { 进度: 1, 解锁时间: 200 },
      },
    });
  });

  test("新旧四行成就同时存在时取进度较大者并保留先解锁时间", () => {
    const s = 假存储({
      "neon-pulse:achievements": JSON.stringify({
        版本: 1,
        数据: {
          tetris: { 进度: 1, 解锁时间: 100 },
          "four-lines": { 进度: 0, 解锁时间: null },
        },
      }),
    });
    迁移更名前存档(s);
    const 存档 = JSON.parse(s.getItem("neon-pulse:achievements") ?? "{}");
    expect(存档.数据["four-lines"]).toEqual({ 进度: 1, 解锁时间: 100 });
    expect(存档.数据.tetris).toBeUndefined();
  });

  test("收藏旧键里已领的旧成就编号迁移，余额与已购保留", () => {
    const s = 假存储({
      "旅行版:收藏": JSON.stringify({
        版本: 1,
        数据: {
          金币: 320,
          累计获得: 500,
          已购: [],
          已结算: [],
          已领成就: ["tetris", "first-lock"],
          最近首局日期: "2026-10-18",
        },
      }),
    });
    迁移更名前存档(s);
    const 存档 = JSON.parse(s.getItem("旅行版:收藏") ?? "{}");
    expect(存档.数据).toMatchObject({
      金币: 320,
      已领成就: ["four-lines", "first-lock"],
    });
  });

  test("重复执行不改变结果", () => {
    const s = 假存储({ "俄罗斯方块:设置": "{}" });
    迁移更名前存档(s);
    迁移更名前存档(s);
    expect(s.getItem("再消一行:设置")).toBe("{}");
    expect(s.getItem("俄罗斯方块:设置")).toBeNull();
  });

  test("损坏的成就存档原样保留，不覆盖", () => {
    const s = 假存储({ "neon-pulse:achievements": "{坏档" });
    迁移更名前存档(s);
    expect(s.getItem("neon-pulse:achievements")).toBe("{坏档");
  });

  test("旧主题名称迁移到源名称，保留其他设置且重复执行不变", () => {
    const s = 假存储({
      "gamemaker:settings": JSON.stringify({ 样式: "青蓝未来", 音效音量: 25 }),
      "再消一行:设置": JSON.stringify({ 方块外观: "默认", 显示网格: false }),
    });
    迁移更名前存档(s);
    expect(JSON.parse(s.getItem("gamemaker:settings") ?? "{}")).toEqual({
      样式: "极光原野",
      音效音量: 25,
    });
    expect(JSON.parse(s.getItem("再消一行:设置") ?? "{}")).toEqual({
      方块外观: "极光原野",
      显示网格: false,
    });
    const 原文 = s.getItem("再消一行:设置");
    迁移更名前存档(s);
    expect(s.getItem("再消一行:设置")).toBe(原文);
  });
});

// ── 原 纪录.test.ts ──
describe("纪录", () => {
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
});

// ── 原 商店目录滚动.test.ts ──
describe("商店目录滚动", () => {
  test("商店目录选中项可见时不滚动，越界时只最小滚入", () => {
    expect(计算目录滚动(300, 400, 96, 360)).toBe(300);
    expect(计算目录滚动(300, 100, 96, 360)).toBe(92);
    expect(计算目录滚动(0, 600, 96, 360)).toBe(344);
    expect(计算目录滚动(50, 0, 96, 360)).toBe(0);
  });
});
