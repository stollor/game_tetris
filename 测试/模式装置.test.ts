import { expect, test } from "bun:test";
import { 组装模式卡数据 } from "../代码/界面/模式卡数据";
import { 生成主界面文字项, 计算主界面布局 } from "../代码/页面/布局/主界面布局";
import { 计算模式卡排行区域 } from "../预制体/模式选择/模式卡配方";
import {
  模式启动时长,
  计算模式启动姿态,
  计算返回传送姿态,
  返回传送时长,
} from "../预制体/模式选择/模式装置";

test("模式卡使用各自的主题色，排行入口小于整卡", () => {
  const 冲刺 = 组装模式卡数据("冲刺", false, null);
  const 每日 = 组装模式卡数据("每日挑战", true, null);
  expect(冲刺.装置).toBe("冲刺");
  expect(冲刺.色值).toBe(0xffee58);
  expect(冲刺.强调色).toBe("#ffee58");
  expect(每日.标题).toBe("DAILY");
  expect(每日.色值).toBe(0x00e676);
  const 练习 = 组装模式卡数据("练习", true, null);
  expect(练习.标题).toBe("PRACTICE");
  expect(练习.细节).toBe("LEVEL 1");
  expect(练习.有排行).toBe(false);
  expect(练习.色值).toBe(0xb388ff);
  const 排行 = 计算模式卡排行区域({ 中心X: 200, 中心Y: 300, 宽: 340, 高: 96 });
  expect(排行.宽).toBe(30);
  expect(排行.高).toBe(30);
  expect(排行.中心Y).toBeLessThan(300);
});

test("模式选择里选择模式比游戏名大，游戏名比主菜单标题小", () => {
  const 手机 = 计算主界面布局(390, 844, "模式选择");
  const 文字 = 生成主界面文字项(手机, { 英文: false, 游戏名称: "再消一行" });
  const 游戏名 = 文字.find((项) => 项.文案 === "再消一行");
  const 选择 = 文字.find((项) => 项.文案 === "选择模式");
  expect(游戏名?.样式.字号).toBeLessThanOrEqual(16);
  expect(选择?.样式.字号).toBeGreaterThanOrEqual(32);
  expect(游戏名?.y ?? 0).toBeLessThan(选择?.y ?? 0);
  const 菜单 = 生成主界面文字项(计算主界面布局(390, 844, "菜单"), {
    英文: false,
    游戏名称: "再消一行",
  });
  expect(菜单[0]?.样式.字号).toBeGreaterThan(游戏名?.样式.字号 ?? 0);
  const 矮屏 = 计算主界面布局(390, 520, "模式选择");
  const 矮文字 = 生成主界面文字项(矮屏, { 英文: true, 游戏名称: "One More Line" });
  const 矮名 = 矮文字.find((项) => 项.文案 === "One More Line");
  const 矮选择 = 矮文字.find((项) => 项.文案 === "CHOOSE MODE");
  expect(矮名?.样式.字号).toBeLessThan(矮选择?.样式.字号 ?? 0);
});

test("手机模式选择放下五张卡，练习卡停在返回键上方", () => {
  const 布局 = 计算主界面布局(390, 844, "模式选择");
  const 选择 = 布局.模式选择;
  if (!选择) throw new Error("缺少模式选择");
  expect(选择.卡.map((项) => 项.模式)).toEqual(["马拉松", "冲刺", "极限", "每日挑战", "练习"]);
  const 返回顶 = 选择.返回钮.中心Y - 选择.返回钮.高 / 2;
  for (const 项 of 选择.卡) {
    expect(项.中心Y - 项.高 / 2).toBeGreaterThan(选择.标题.y);
    expect(项.中心Y + 项.高 / 2).toBeLessThanOrEqual(返回顶);
  }
});

test("返回传送先下沉再逐颗点亮，模式启动更短", () => {
  const 起 = 计算返回传送姿态(0);
  expect(起.下沉).toBe(0);
  expect(起.点亮).toEqual([0, 0, 0, 0]);
  expect(起.完成).toBe(false);
  const 点到第二颗 = 计算返回传送姿态(0.32);
  expect(点到第二颗.下沉).toBe(1);
  expect(点到第二颗.点亮[0]).toBeGreaterThan(0.99);
  expect(点到第二颗.点亮[1]).toBeGreaterThan(0.99);
  expect(点到第二颗.点亮[2]).toBe(0);
  const 完成 = 计算返回传送姿态(返回传送时长);
  expect(完成.完成).toBe(true);
  expect(完成.点亮).toEqual([1, 1, 1, 1]);
  expect(计算模式启动姿态(0).完成).toBe(false);
  expect(计算模式启动姿态(模式启动时长).完成).toBe(true);
  expect(模式启动时长).toBeLessThan(返回传送时长);
});
