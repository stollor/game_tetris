import { describe, expect, test } from "bun:test";
import { 方块外观方案表 } from "../../../主题/外观/方块外观";
import { 背景主题配置 } from "../../../主题/外观/背景主题";
import { 旅行主题表 } from "../../../主题/配色/旅行配色";
import { 基础背景已解锁, 迁移基础背景 } from "../../../代码/存档/基础背景解锁";
import { 创建纪录存档, 是否刷新纪录 } from "../../../代码/存档/对局纪录";
import { 旅行收藏, 旅行日期 } from "../../../代码/存档/旅行收藏";
import { 迁移更名前存档 } from "../../../代码/存档/更名迁移";
import { 地点皮肤表 } from "../../../代码/框架配置/旅行地点";
import { 音乐库 } from "../../../代码/框架配置/音乐";
import { 音效库 } from "../../../代码/框架配置/音效";
import { 计算目录滚动 } from "../../../代码/界面/目录滚动";
import { 外观原价, 外观部位列表 } from "../../../代码/项目配置/旅行皮肤";
import { 计算颜色对比度 } from "../../../框架/界面/颜色工具";

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

  test("旅行收藏里已领的旧成就编号迁移，余额和购买保留", () => {
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

// ── 原 旅行收藏.test.ts ──
describe("旅行收藏", () => {
  function 建档() {
    const 内容 = new Map<string, string>();
    const 存储 = {
      getItem: (键: string) => 内容.get(键) ?? null,
      setItem: (键: string, 值: string) => {
        内容.set(键, 值);
      },
    };
    return { 内容, 存储, 收藏: new 旅行收藏(存储) };
  }
  const 对局 = {
    编号: "round-a",
    分数: 12000,
    消行: 8,
    用时: 50000,
    落块: 20,
    破纪录: true,
    日期: "2026-10-16",
  };
  test("12个地点各自具备背景、主题、独立方块纹样、18种音效与原创曲谱", () => {
    expect(地点皮肤表.length).toBe(12);
    expect(new Set(地点皮肤表.map((项) => 项.纹样)).size).toBe(12);
    expect(new Set(地点皮肤表.map((项) => JSON.stringify(项.旋律))).size).toBe(12);
    for (const 地点 of 地点皮肤表) {
      expect(背景主题配置[地点.名称]).toBeDefined();
      expect(方块外观方案表.find((项) => 项.名称 === 地点.名称)?.纹样).toBe(地点.纹样);
      expect(音乐库.filter((项) => 项.id === `旅行.${地点.名称}`).length).toBe(1);
      expect(音效库.filter((项) => 项.id.startsWith(`旅行.${地点.名称}.`)).length).toBe(18);
      const 主题 = 旅行主题表[地点.名称];
      for (const 色 of [主题.文字.主要, 主题.文字.次要, 主题.文字.弱化])
        expect(计算颜色对比度(色, 主题.面板.主面板.背景)).toBeGreaterThanOrEqual(4.5);
      expect(
        计算颜色对比度(主题.按钮.主要.默认.文字, 主题.按钮.主要.默认.背景),
      ).toBeGreaterThanOrEqual(4.5);
      expect(外观原价(地点, "静态背景")).toBeLessThan(外观原价(地点, "动态背景"));
    }
  });
  test("购买静态、差价升级动态、重复购买及不足余额都使用最新余额", () => {
    const { 收藏, 存储 } = 建档(),
      地点 = 地点皮肤表[0];
    expect(收藏.读取().金币).toBe(120);
    expect(收藏.购买(地点.名称, "静态背景").成功).toBe(true);
    expect(收藏.读取().金币).toBe(40);
    expect(收藏.报价(地点, "动态背景")).toBe(100);
    expect(收藏.购买(地点.名称, "静态背景").成功).toBe(false);
    expect(收藏.购买(地点.名称, "动态背景").成功).toBe(false);
    new 旅行收藏(存储).领取成就(["first-lock"]);
    expect(收藏.购买(地点.名称, "动态背景").成功).toBe(true);
    expect(收藏.读取().金币).toBe(0);
    expect(收藏.拥有(地点.名称, "静态背景")).toBe(true);
    expect(收藏.拥有(地点.名称, "动态背景")).toBe(true);
  });
  test("套装按剩余内容折扣补齐，不重复扣除已购内容，动态包含静态", () => {
    const { 收藏 } = 建档(),
      地点 = 地点皮肤表[0];
    收藏.领取成就([
      "first-lock",
      "first-clear",
      "hold",
      "four-lines",
      "spin",
      "perfect",
      "combo",
      "b2b",
      "lines",
      "level",
      "sprint",
      "ultra",
    ]);
    const 套价 = 收藏.报价(地点, "整套");
    const 单价 = 外观部位列表
      .filter((项) => 项 !== "静态背景")
      .reduce((和, 项) => 和 + 外观原价(地点, 项), 0);
    expect(套价).toBeLessThan(单价);
    收藏.购买(地点.名称, "方块外观");
    expect(收藏.报价(地点, "整套")).toBeLessThan(套价);
    const 余额 = 收藏.读取().金币,
      补价 = 收藏.报价(地点, "整套");
    expect(收藏.购买(地点.名称, "整套").成功).toBe(true);
    expect(收藏.读取().金币).toBe(余额 - 补价);
    expect(外观部位列表.every((部位) => 收藏.拥有(地点.名称, 部位))).toBe(true);
    expect(收藏.报价(地点, "整套")).toBe(0);
    expect(收藏.购买(地点.名称, "整套").成功).toBe(false);
  });
  test("成就和对局只结算一次，每日首局不重复，早退与非法分数没有对局金币", () => {
    const { 收藏, 存储 } = 建档();
    expect(收藏.领取成就(["first-lock", "first-lock", "伪造成就"]).新增).toBe(60);
    expect(new 旅行收藏(存储).领取成就(["first-lock"]).新增).toBe(0);
    expect(收藏.结算对局({ ...对局, 用时: 44000 }).新增).toBe(0);
    expect(收藏.结算对局({ ...对局, 分数: NaN }).成功).toBe(false);
    expect(收藏.结算对局({ ...对局, 落块: 14 }).新增).toBe(0);
    expect(收藏.结算对局(对局).新增).toBe(10 + 6 + 8 + 40 + 30);
    expect(new 旅行收藏(存储).结算对局(对局).新增).toBe(0);
    expect(收藏.结算对局({ ...对局, 用时: 50000.25, 编号: "round-b", 破纪录: false }).新增).toBe(
      24,
    );
    expect(
      收藏.结算对局({ ...对局, 编号: "round-c", 日期: "2026-10-17", 破纪录: false }).新增,
    ).toBe(64);
    expect(旅行日期(new Date("2026-10-15T16:01:00Z"))).toBe("2026-10-16");
  });
  test("受保护或写入失败的收藏不扣款、不授予、不覆盖原文", () => {
    const { 收藏, 内容 } = 建档();
    const 键 = "旅行版:收藏";
    for (const 原文 of [
      "{坏档",
      JSON.stringify({ 版本: 99, 数据: {} }),
      JSON.stringify({ 版本: 1, 数据: { 金币: -1 } }),
    ]) {
      内容.set(键, 原文);
      expect(收藏.购买("成都熊猫", "静态背景").成功).toBe(false);
      expect(内容.get(键)).toBe(原文);
    }
    const 失败 = new 旅行收藏({
      getItem: () => null,
      setItem: () => {
        throw new Error("quota");
      },
    });
    expect(失败.购买("成都熊猫", "静态背景").成功).toBe(false);
    expect(失败.拥有("成都熊猫", "静态背景")).toBe(false);
    expect(失败.领取成就(["first-lock"]).成功).toBe(false);
    expect(失败.读取().金币).toBe(120);
  });

  test("看板测试金币追加保留收藏，非法或保存失败时不产生余额", () => {
    const { 收藏 } = 建档();
    收藏.购买("成都熊猫", "静态背景");
    expect(收藏.增加测试金币(1000).金币).toBe(1040);
    expect(收藏.拥有("成都熊猫", "静态背景")).toBe(true);
    for (const 数量 of [0, -1, 1.5, NaN, 1000001]) expect(收藏.增加测试金币(数量).成功).toBe(false);
    expect(收藏.读取().金币).toBe(1040);
  });

  test("经济平衡：常规对局约 50 币，地点套装约等于 10 局", () => {
    const { 收藏 } = 建档();
    const 局 = (编号: string, 分数: number, 消行: number) =>
      收藏.结算对局({ 编号, 分数, 消行, 用时: 180000, 落块: 80, 破纪录: false, 日期: "2026-10-16" })
        .新增;
    局("首局", 0, 0); // 吃掉今日首局奖励
    const 马拉松 = 局("马拉松", 20000, 30);
    const 冲刺 = 局("冲刺", 12000, 40);
    const 极限 = 局("极限", 15000, 25);
    expect([马拉松, 冲刺, 极限]).toEqual([50, 55, 42]);
    const 平均 = (马拉松 + 冲刺 + 极限) / 3;
    for (const 地点 of 地点皮肤表) {
      const 局数 = 收藏.报价(地点, "整套") / 平均;
      expect(局数).toBeGreaterThanOrEqual(9);
      expect(局数).toBeLessThanOrEqual(16);
    }
    // 速刷短局（刚过门槛）每分钟收益低于完整冲刺
    const 速刷 = 局("速刷", 1000, 2);
    expect(速刷 / 0.75).toBeLessThan(冲刺 / 2.5);
  });
});

// ── 原 默认解锁与目录滚动.test.ts ──
describe("默认解锁与目录滚动", () => {
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

  test("新存档只默认解锁云海山岚与极光原野", () => {
    const s = 假存储();
    迁移基础背景(s);
    expect(基础背景已解锁("云海山岚", s, 0)).toBe(true);
    expect(基础背景已解锁("极光原野", s, 0)).toBe(true);
    expect(基础背景已解锁("晨光海岸", s, 0)).toBe(false);
    expect(基础背景已解锁("霓虹天际", s, 0)).toBe(false);
    expect(基础背景已解锁("晨光海岸", s, 3)).toBe(true);
    expect(基础背景已解锁("霓虹天际", s, 5)).toBe(false);
    expect(基础背景已解锁("霓虹天际", s, 6)).toBe(true);
  });

  test("已有存档的玩家保留全部基础背景，迁移只执行一次", () => {
    const s = 假存储({ "再消一行:设置": "{}" });
    迁移基础背景(s);
    expect(基础背景已解锁("晨光海岸", s, 0)).toBe(true);
    expect(基础背景已解锁("霓虹天际", s, 0)).toBe(true);
    const 新 = 假存储();
    迁移基础背景(新);
    新.setItem("再消一行:设置", "{}");
    迁移基础背景(新);
    expect(基础背景已解锁("晨光海岸", 新, 0)).toBe(false);
  });

  test("商店目录选中项可见时不滚动，越界时只最小滚入", () => {
    expect(计算目录滚动(300, 400, 96, 360)).toBe(300);
    expect(计算目录滚动(300, 100, 96, 360)).toBe(92);
    expect(计算目录滚动(0, 600, 96, 360)).toBe(344);
    expect(计算目录滚动(50, 0, 96, 360)).toBe(0);
  });
});
