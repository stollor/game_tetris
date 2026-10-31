import { describe, expect, test } from "bun:test";
import {
  执行收藏操作,
  收藏,
  收藏变化事件,
  收藏存档键,
  旧收藏存档键,
} from "../../../代码/存档/收藏";
import { 北京日期 } from "../../../代码/存档/日期";
import { type 主题名, 可购主题, 默认主题 } from "../../../代码/项目配置/主题目录";
import { 外观编号, type 外观部位, 外观部位列表 } from "../../../代码/项目配置/外观部位";

/**
 * 金币与外观所有权同一份存档：单件、整套补齐、动态含静态都只扣一次款、
 * 保存失败不扣款也不授予；旧 v1 整套主题展开成六个部位，旧旅行档按原补偿政策迁移。
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

const 全部位编号 = (主题: 主题名): string[] => 外观部位列表.map((部位) => 外观编号(主题, 部位));

const 对局 = {
  编号: "round-a",
  分数: 12000,
  消行: 8,
  用时: 50000,
  落块: 20,
  破纪录: true,
  日期: "2026-10-16",
};

const 基础整套 = 510;

describe("金币与外观所有权", () => {
  test("新档只有初始金币与默认主题，默认主题所有部位免费", () => {
    const { 收藏 } = 建档();
    const 存档 = 收藏.读取();
    expect(存档.金币).toBe(120);
    expect(存档.已购).toEqual([]);
    expect(存档.已购主题).toEqual([]);
    expect(收藏.拥有(默认主题)).toBe(true);
    for (const 部位 of 外观部位列表) expect(收藏.拥有部位(默认主题, 部位)).toBe(true);
    expect(收藏.拥有("砖机液晶")).toBe(false);
    expect(收藏.拥有部位("砖机液晶", "音乐")).toBe(false);
    expect(收藏.报价("砖机液晶")).toBe(基础整套);
  });

  test("原因编号是 UI 取文案的机器可读契约，原因字段是它的简体中文渲染", () => {
    const { 收藏: 实例 } = 建档();
    const 不足 = 实例.购买主题("砖机液晶");
    expect(不足.原因编号).toBe("余额不足");
    expect(不足.原因参数).toEqual({ 数量: 基础整套 - 120 });
    expect(不足.原因).toBe(`还差 ${基础整套 - 120} 金币`);
    expect(实例.购买主题(默认主题).原因编号).toBe("商品不存在");
    expect(实例.购买主题("成都熊猫").原因编号).toBe("商品不存在");
    expect(实例.购买("砖机液晶", "假部位" as 外观部位).原因编号).toBe("商品不存在");
    expect(实例.增加测试金币(0).原因编号).toBe("测试金币无效");

    const 购买 = (() => {
      实例.增加测试金币(1000);
      return 实例.购买("砖机液晶", "音效套装");
    })();
    expect(购买.原因编号).toBe("购买成功");
    expect(实例.购买("砖机液晶", "音效套装").原因编号).toBe("已拥有");
    expect(实例.购买主题("砖机液晶").原因编号).toBe("购买成功");
    expect(实例.购买主题("砖机液晶").原因编号).toBe("已拥有");

    expect(实例.结算对局({ ...对局, 用时: 44000 }).原因编号).toBe("对局未达标");
    expect(实例.结算对局({ ...对局, 分数: Number.NaN }).原因编号).toBe("对局无效");
    expect(实例.结算对局(对局).原因编号).toBe("对局奖励");
    expect(实例.结算对局(对局).原因编号).toBe("奖励已领取");
  });

  test("单件只解锁单件，整套报价按剩余部位重新折扣", () => {
    const { 收藏 } = 建档();
    收藏.增加测试金币(1000);
    const 买 = 收藏.购买("砖机液晶", "方块外观");
    expect(买.成功).toBe(true);
    expect(买.金币).toBe(1000);

    const 存档 = 收藏.读取();
    expect(存档.已购).toEqual(["砖机液晶.方块外观"]);
    expect(存档.已购主题).toEqual([]);
    expect(收藏.拥有部位("砖机液晶", "方块外观")).toBe(true);
    expect(收藏.拥有部位("砖机液晶", "音乐")).toBe(false);
    expect(收藏.拥有("砖机液晶")).toBe(false);
    // 剩余 180+140+100+160=580，580*.72=417.6，向上到 10 为 420。
    expect(收藏.报价("砖机液晶")).toBe(420);
  });

  test("动态背景自动授予静态背景，已购静态后动态只补差价", () => {
    const 甲 = 建档();
    甲.收藏.增加测试金币(1000);
    expect(甲.收藏.购买("砖机液晶", "静态背景").金币).toBe(1040);
    const 补差 = 甲.收藏.购买("砖机液晶", "动态背景");
    expect(补差.成功).toBe(true);
    expect(补差.金币).toBe(940);

    const 乙 = 建档();
    乙.收藏.增加测试金币(1000);
    const 直接 = 乙.收藏.购买("砖机液晶", "动态背景");
    expect(直接.金币).toBe(940);
    const 存档 = 乙.收藏.读取();
    expect(存档.已购).toEqual(["砖机液晶.静态背景", "砖机液晶.动态背景"]);
    expect(乙.收藏.拥有部位("砖机液晶", "静态背景")).toBe(true);
    expect(乙.收藏.拥有部位("砖机液晶", "动态背景")).toBe(true);
    expect(乙.收藏.拥有("砖机液晶")).toBe(false);
    // 已含静态与动态，整套只剩 520 原价，520*.72=374.4，向上到 10 为 380。
    expect(乙.收藏.报价("砖机液晶")).toBe(380);
  });

  test("整套补齐所有部位，重复购买不扣钱", () => {
    const { 收藏 } = 建档();
    收藏.增加测试金币(1000);
    收藏.购买("砖机液晶", "方块外观");
    expect(收藏.报价("砖机液晶")).toBe(420);

    const 补齐 = 收藏.购买主题("砖机液晶");
    expect(补齐.成功).toBe(true);
    expect(补齐.金币).toBe(580);
    const 存档 = 收藏.读取();
    expect(存档.已购).toHaveLength(6);
    expect([...存档.已购].sort()).toEqual([...全部位编号("砖机液晶")].sort());
    expect(存档.已购主题).toEqual(["砖机液晶"]);
    expect(收藏.拥有("砖机液晶")).toBe(true);
    for (const 部位 of 外观部位列表) expect(收藏.拥有部位("砖机液晶", 部位)).toBe(true);
    expect(收藏.报价("砖机液晶")).toBe(0);

    expect(收藏.购买主题("砖机液晶").原因编号).toBe("已拥有");
    expect(收藏.购买("砖机液晶", "音乐").原因编号).toBe("已拥有");
    expect(收藏.读取().金币).toBe(580);
  });

  test("余额不足不扣币不授予，单件与整套都提示差额", () => {
    const { 收藏 } = 建档();
    const 单件 = 收藏.购买("砖机液晶", "音乐");
    expect(单件.原因编号).toBe("余额不足");
    expect(单件.原因参数).toEqual({ 数量: 160 - 120 });
    expect(收藏.读取().已购).toEqual([]);
    expect(收藏.读取().金币).toBe(120);

    const 整套 = 收藏.购买主题("砖机液晶");
    expect(整套.原因编号).toBe("余额不足");
    expect(整套.原因参数).toEqual({ 数量: 基础整套 - 120 });

    收藏.增加测试金币(1000);
    expect(收藏.购买("砖机液晶", "音乐").成功).toBe(true);
    expect(收藏.读取().金币).toBe(960);
    expect(收藏.购买("砖机液晶", "音乐").原因编号).toBe("已拥有");
    expect(收藏.读取().金币).toBe(960);
  });

  test("保存失败不扣款、不授予，坏档与未来版本原文受保护", () => {
    const { 收藏: 实例, 内容 } = 建档();
    const 键 = 收藏存档键;
    for (const 原文 of [
      "{坏档",
      JSON.stringify({ 版本: 99, 数据: {} }),
      JSON.stringify({ 版本: 1, 数据: { 金币: -1 } }),
      JSON.stringify({
        版本: 1,
        数据: {
          金币: 500,
          累计获得: 100,
          已购主题: [],
          已结算: [],
          已领成就: [],
          最近首局日期: "",
        },
      }),
      JSON.stringify({
        版本: 1,
        数据: {
          金币: 100,
          累计获得: 120,
          已购主题: ["成都熊猫"],
          已结算: [],
          已领成就: [],
          最近首局日期: "",
        },
      }),
      JSON.stringify({
        版本: 1,
        数据: {
          金币: 100,
          累计获得: 120,
          已购主题: ["极光原野"],
          已结算: [],
          已领成就: [],
          最近首局日期: "",
        },
      }),
      JSON.stringify({
        版本: 1,
        数据: {
          金币: 100,
          累计获得: 120,
          已购主题: [],
          已结算: [],
          已领成就: ["伪造成就"],
          最近首局日期: "",
        },
      }),
    ]) {
      内容.set(键, 原文);
      expect(实例.购买("砖机液晶", "静态背景").成功).toBe(false);
      expect(内容.get(键)).toBe(原文);
    }

    const 失败 = new 收藏({
      getItem: () => null,
      setItem: () => {
        throw new Error("quota");
      },
    });
    expect(失败.增加测试金币(1000).原因编号).toBe("保存失败");
    expect(失败.购买("砖机液晶", "静态背景").原因编号).toBe("保存失败");
    expect(失败.拥有部位("砖机液晶", "静态背景")).toBe(false);
    expect(失败.领取成就(["first-lock"]).成功).toBe(false);
    expect(失败.读取().金币).toBe(120);
  });

  test("v1 整套存档展开为六个部位，保存升级 v2 且不再持久化已购主题", () => {
    const 旧档 = {
      版本: 1,
      数据: {
        金币: 320,
        累计获得: 500,
        已购主题: ["砖机液晶"],
        已结算: ["round-a"],
        已领成就: ["first-lock"],
        最近首局日期: "2026-10-18",
      },
    };
    const { 收藏: 实例, 内容, 存储 } = 建档({ [收藏存档键]: JSON.stringify(旧档) });

    const 存档 = 实例.读取();
    expect(存档.金币).toBe(320);
    expect(存档.累计获得).toBe(500);
    expect(存档.已结算).toEqual(["round-a"]);
    expect(存档.已领成就).toEqual(["first-lock"]);
    expect(存档.最近首局日期).toBe("2026-10-18");
    expect(存档.已购).toEqual(全部位编号("砖机液晶"));
    expect(存档.已购主题).toEqual(["砖机液晶"]);
    expect(实例.拥有("砖机液晶")).toBe(true);
    expect(实例.拥有("立体晶格")).toBe(false);
    for (const 部位 of 外观部位列表) expect(实例.拥有部位("砖机液晶", 部位)).toBe(true);

    expect(实例.购买("立体晶格", "音乐").成功).toBe(true);
    const 保存 = JSON.parse(内容.get(收藏存档键) ?? "{}") as {
      版本?: number;
      数据?: { 已购?: string[]; 已购主题?: unknown };
    };
    expect(保存.版本).toBe(2);
    expect(保存.数据?.已购主题).toBeUndefined();
    expect(保存.数据?.已购).toContain("砖机液晶.音乐");
    expect(保存.数据?.已购).toContain("立体晶格.音乐");
    expect(new 收藏(存储).读取().已购主题).toEqual(["砖机液晶"]);
  });

  test("旧旅行档迁移：金币与成就继承，买过外观补偿全部在售主题的全部部位", () => {
    const 原文 = JSON.stringify({
      版本: 1,
      数据: {
        金币: 320,
        累计获得: 500,
        已购: ["成都熊猫.方块外观"],
        已结算: [],
        已领成就: ["first-lock"],
        最近首局日期: "2026-10-18",
      },
    });
    const { 收藏, 内容 } = 建档({ [旧收藏存档键]: 原文 });
    const 存档 = 收藏.读取();
    expect(存档.金币).toBe(320);
    expect(存档.最近首局日期).toBe("2026-10-18");
    expect(存档.已购主题).toEqual(["砖机液晶", "街机彩砖", "立体晶格"]);
    expect(存档.已购).toHaveLength(18);
    expect(收藏.拥有("立体晶格")).toBe(true);
    expect(内容.get(旧收藏存档键)).toBe(原文);
  });

  test("旧旅行档没买过外观不补偿，且旧原文保持不动", () => {
    const 原文 = JSON.stringify({
      版本: 1,
      数据: {
        金币: 0,
        累计获得: 120,
        已购: [],
        已结算: [],
        已领成就: [],
        最近首局日期: "",
      },
    });
    const { 收藏, 内容 } = 建档({ [旧收藏存档键]: 原文 });
    expect(收藏.读取().已购主题).toEqual([]);
    expect(收藏.读取().已购).toEqual([]);
    expect(内容.get(旧收藏存档键)).toBe(原文);
  });

  test("多次新建收藏读取一致，交易后其他实例立即可见", () => {
    const { 存储 } = 建档();
    const 甲 = new 收藏(存储);
    甲.增加测试金币(1000);
    expect(甲.购买("砖机液晶", "音效套装").成功).toBe(true);

    for (let 次 = 0; 次 < 3; 次++) {
      const 新 = new 收藏(存储);
      const 存档 = 新.读取();
      expect(存档.金币).toBe(1020);
      expect(存档.已购).toEqual(["砖机液晶.音效套装"]);
      expect(新.拥有部位("砖机液晶", "音效套装")).toBe(true);
      expect(新.拥有("砖机液晶")).toBe(false);
      expect(新.报价("砖机液晶")).toBe(440);
    }
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
    expect(收藏.读取().已购).toEqual([]);
    expect(收藏.读取().已购主题).toEqual([]);
  });

  test("看板测试金币追加保留外观，非法或保存失败时不产生余额", () => {
    const { 收藏 } = 建档();
    收藏.增加测试金币(1000);
    收藏.购买主题("街机彩砖");
    expect(收藏.读取().金币).toBe(1120 - 基础整套);
    expect(收藏.拥有("街机彩砖")).toBe(true);
    for (const 数量 of [0, -1, 1.5, Number.NaN, 1000001])
      expect(收藏.增加测试金币(数量).成功).toBe(false);
  });

  test("经济平衡：一局约 50 币，整套 510 币在十局左右攒齐", () => {
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
    for (const 主题 of 可购主题) {
      const 价格 = 收藏.报价(主题);
      const 局数 = 价格 / 平均;
      expect(局数).toBeGreaterThanOrEqual(2);
      expect(局数).toBeLessThanOrEqual(11);
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
