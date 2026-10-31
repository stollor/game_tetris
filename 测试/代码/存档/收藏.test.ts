import { describe, expect, test } from "bun:test";
import {
  执行收藏操作,
  收藏,
  收藏变化事件,
  收藏存档键,
  旧收藏存档键,
} from "../../../代码/存档/收藏";
import { 北京日期 } from "../../../代码/存档/日期";
import { 主题价格, 默认主题 } from "../../../代码/项目配置/主题目录";

/**
 * 金币与主题所有权同一份存档：买主题扣款、成就与对局只发金币、
 * 保存失败不扣款也不授予主题；旧旅行档迁移时买过外观的玩家补偿全部在售主题。
 */

interface 假存储 {
  getItem(键: string): string | null;
  setItem(键: string, 值: string): void;
}

function 建档(初始: Record<string, string> = {}) {
  const 内容 = new Map<string, string>(Object.entries(初始));
  const 存储: 假存储 = {
    getItem: (键) => 内容.get(键) ?? null,
    setItem: (键, 值) => {
      内容.set(键, 值);
    },
  };
  return { 内容, 存储, 收藏: new 收藏(存储) };
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

describe("金币与主题所有权", () => {
  test("新档只有初始金币与默认主题，其余主题未拥有", () => {
    const { 收藏 } = 建档();
    const 存档 = 收藏.读取();
    expect(存档.金币).toBe(120);
    expect(存档.已购主题).toEqual([]);
    expect(收藏.拥有(默认主题)).toBe(true);
    expect(收藏.拥有("砖机液晶")).toBe(false);
    expect(收藏.报价("砖机液晶")).toBe(主题价格.砖机液晶);
  });

  test("原因编号是 UI 取文案的机器可读契约，原因字段是它的简体中文渲染", () => {
    const { 收藏: 实例 } = 建档();
    const 不足 = 实例.购买主题("砖机液晶");
    expect(不足.原因编号).toBe("余额不足");
    expect(不足.原因参数).toEqual({ 数量: 主题价格.砖机液晶 - 120 });
    expect(不足.原因).toBe(`还差 ${主题价格.砖机液晶 - 120} 金币`);
    expect(实例.购买主题(默认主题).原因编号).toBe("商品不存在");
    expect(实例.购买主题("成都熊猫").原因编号).toBe("商品不存在");
    expect(实例.增加测试金币(0).原因编号).toBe("测试金币无效");

    const 购买 = (() => {
      实例.增加测试金币(1000);
      return 实例.购买主题("砖机液晶");
    })();
    expect(购买.原因编号).toBe("购买成功");
    expect(实例.购买主题("砖机液晶").原因编号).toBe("已拥有");

    expect(实例.结算对局({ ...对局, 用时: 44000 }).原因编号).toBe("对局未达标");
    expect(实例.结算对局({ ...对局, 分数: Number.NaN }).原因编号).toBe("对局无效");
    expect(实例.结算对局(对局).原因编号).toBe("对局奖励");
    expect(实例.结算对局(对局).原因编号).toBe("奖励已领取");

    const 存不进 = new 收藏({
      getItem: () => null,
      setItem: () => {
        throw new Error("quota");
      },
    });
    expect(存不进.增加测试金币(1000).原因编号).toBe("保存失败");
  });

  test("购买主题：余额不足不扣币，够了扣款并解锁整套主题", () => {
    const { 收藏 } = 建档();
    const 不足 = 收藏.购买主题("砖机液晶");
    expect(不足.成功).toBe(false);
    expect(不足.原因).toContain("还差");
    expect(收藏.读取().金币).toBe(120);
    expect(收藏.拥有("砖机液晶")).toBe(false);

    收藏.增加测试金币(200);
    const 成功 = 收藏.购买主题("砖机液晶");
    expect(成功.成功).toBe(true);
    expect(成功.新增).toBe(0);
    expect(成功.金币).toBe(320 - 主题价格.砖机液晶);
    expect(收藏.读取().金币).toBe(320 - 主题价格.砖机液晶);
    expect(收藏.拥有("砖机液晶")).toBe(true);
    expect(收藏.报价("砖机液晶")).toBe(0);
  });

  test("默认主题与未知商品不可购买，重复购买不扣款", () => {
    const { 收藏 } = 建档();
    收藏.增加测试金币(1000);
    expect(收藏.购买主题(默认主题).成功).toBe(false);
    expect(收藏.购买主题("成都熊猫").成功).toBe(false);
    expect(收藏.购买主题("砖机液晶").成功).toBe(true);
    const 余额 = 收藏.读取().金币;
    expect(收藏.购买主题("砖机液晶").成功).toBe(false);
    expect(收藏.读取().金币).toBe(余额);
  });

  test("成就只发金币且只领一次；对局奖励幂等、每日首局不重复", () => {
    const { 收藏 } = 建档();
    expect(收藏.领取成就(["first-lock", "first-lock", "伪造成就"]).新增).toBe(60);
    expect(收藏.领取成就(["first-lock"]).新增).toBe(0);
    expect(收藏.结算对局({ ...对局, 用时: 44000 }).新增).toBe(0);
    expect(收藏.结算对局({ ...对局, 分数: Number.NaN }).成功).toBe(false);
    expect(收藏.结算对局({ ...对局, 落块: 14 }).新增).toBe(0);
    expect(收藏.结算对局(对局).新增).toBe(10 + 6 + 8 + 40 + 30);
    expect(收藏.结算对局(对局).新增).toBe(0);
    expect(收藏.读取().已购主题).toEqual([]);
  });

  test("保存失败的收藏不扣款、不授予主题、不覆盖原文", () => {
    const { 收藏: 实例, 内容 } = 建档();
    const 键 = 收藏存档键;
    for (const 原文 of [
      "{坏档",
      JSON.stringify({ 版本: 99, 数据: {} }),
      JSON.stringify({ 版本: 1, 数据: { 金币: -1 } }),
    ]) {
      内容.set(键, 原文);
      expect(实例.购买主题("砖机液晶").成功).toBe(false);
      expect(内容.get(键)).toBe(原文);
    }
    const 失败 = new 收藏({
      getItem: () => null,
      setItem: () => {
        throw new Error("quota");
      },
    });
    失败.增加测试金币(1000);
    expect(失败.购买主题("砖机液晶").成功).toBe(false);
    expect(失败.拥有("砖机液晶")).toBe(false);
    expect(失败.领取成就(["first-lock"]).成功).toBe(false);
    expect(失败.读取().金币).toBe(120);
  });

  test("看板测试金币追加保留主题，非法或保存失败时不产生余额", () => {
    const { 收藏 } = 建档();
    收藏.增加测试金币(1000);
    收藏.购买主题("街机彩砖");
    expect(收藏.读取().金币).toBe(1120 - 主题价格.街机彩砖);
    expect(收藏.拥有("街机彩砖")).toBe(true);
    for (const 数量 of [0, -1, 1.5, Number.NaN, 1000001])
      expect(收藏.增加测试金币(数量).成功).toBe(false);
  });

  test("旧旅行档迁移：金币与成就继承，买过外观的玩家补偿全部在售主题", () => {
    const { 收藏 } = 建档({
      [旧收藏存档键]: JSON.stringify({
        版本: 1,
        数据: {
          金币: 320,
          累计获得: 500,
          已购: ["成都熊猫.方块外观"],
          已结算: [],
          已领成就: ["first-lock"],
          最近首局日期: "2026-10-18",
        },
      }),
    });
    const 存档 = 收藏.读取();
    expect(存档.金币).toBe(320);
    expect(存档.最近首局日期).toBe("2026-10-18");
    expect(存档.已购主题).toEqual(["砖机液晶", "街机彩砖", "立体晶格"]);
    expect(收藏.拥有("立体晶格")).toBe(true);
  });

  test("经济平衡：一局约 50 币，一套主题 2~3 局", () => {
    const { 收藏 } = 建档();
    const 局 = (编号: string, 分数: number, 消行: number) =>
      收藏.结算对局({
        编号,
        分数,
        消行,
        用时: 180000,
        落块: 80,
        破纪录: false,
        日期: "2026-10-16",
      }).新增;
    局("首局", 0, 0); // 吃掉今日首局奖励
    const 马拉松 = 局("马拉松", 20000, 30);
    const 冲刺 = 局("冲刺", 12000, 40);
    const 极限 = 局("极限", 15000, 25);
    expect([马拉松, 冲刺, 极限]).toEqual([50, 55, 42]);
    const 平均 = (马拉松 + 冲刺 + 极限) / 3;
    for (const 价格 of Object.values(主题价格).filter((项) => 项 > 0)) {
      const 局数 = 价格 / 平均;
      expect(局数).toBeGreaterThanOrEqual(2);
      expect(局数).toBeLessThanOrEqual(10);
    }
    // 速刷短局（刚过门槛）每分钟收益低于完整冲刺
    const 速刷 = 局("速刷", 1000, 2);
    expect(速刷 / 0.75).toBeLessThan(冲刺 / 2.5);
  });

  test("北京日期按东八区换算，跨深夜仍是当天", () => {
    expect(北京日期(new Date("2026-10-15T16:01:00Z"))).toBe("2026-10-16");
  });

  test("收藏变化事件名与存档键是契约值", () => {
    expect(收藏存档键).toBe("再消一行:收藏");
    expect(旧收藏存档键).toBe("旅行版:收藏");
    expect(收藏变化事件).toBe("再消一行:收藏变化");
    expect(typeof 执行收藏操作).toBe("function");
  });
});
