import { expect, test } from "bun:test";
import { 旅行收藏, 旅行日期 } from "../代码/存档/旅行收藏";
import { 旅行主题表 } from "../代码/框架配置/旅行主题";
import { 地点皮肤表 } from "../代码/框架配置/旅行地点";
import { 音乐库 } from "../代码/框架配置/音乐";
import { 音效库 } from "../代码/框架配置/音效";
import { 方块外观方案表 } from "../代码/配置/方块外观";
import { 背景主题配置 } from "../代码/配置/背景主题";
import { 外观原价, 外观部位列表 } from "../代码/项目配置/旅行皮肤";
import { 计算颜色对比度 } from "../框架Three/界面/颜色工具";

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
test("12个地点各自具备背景、主题、独立方块纹样、17种音效与原创曲谱", () => {
  expect(地点皮肤表.length).toBe(12);
  expect(new Set(地点皮肤表.map((项) => 项.纹样)).size).toBe(12);
  expect(new Set(地点皮肤表.map((项) => JSON.stringify(项.旋律))).size).toBe(12);
  for (const 地点 of 地点皮肤表) {
    expect(背景主题配置[地点.名称]).toBeDefined();
    expect(方块外观方案表.find((项) => 项.名称 === 地点.名称)?.纹样).toBe(地点.纹样);
    expect(音乐库.filter((项) => 项.id === `旅行.${地点.名称}`).length).toBe(1);
    expect(音效库.filter((项) => 项.id.startsWith(`旅行.${地点.名称}.`)).length).toBe(17);
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
  expect(收藏.结算对局({ ...对局, 用时: 50000.25, 编号: "round-b", 破纪录: false }).新增).toBe(24);
  expect(收藏.结算对局({ ...对局, 编号: "round-c", 日期: "2026-10-17", 破纪录: false }).新增).toBe(
    64,
  );
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
