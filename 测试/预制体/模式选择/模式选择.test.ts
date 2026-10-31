import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { 读取预制体主题槽位 } from "../../../.gamemaker/依赖/框架/设置/主题组合";
import { 组装模式卡数据 } from "../../../代码/界面/模式卡数据";
import { 默认设置 } from "../../../代码/设置/游戏设置";
import { 生成主界面文字项, 计算主界面布局 } from "../../../代码/页面/布局/主界面布局";
import { 解析游戏主题, 读取游戏主题目录 } from "../../../资源/主题/主题组合";
import { 设置预览主题读取 } from "../../../资源/主题/配色/主题读取";
import { 生成模式卡文字项, 计算模式卡排行区域 } from "../../../资源/预制体/模式选择/模式卡配方";
import {
  模式启动时长,
  计算模式启动姿态,
  计算返回传送姿态,
  返回传送时长,
} from "../../../资源/预制体/模式选择/模式装置";
import { 项目根 as 项目根路径 } from "../../接入/项目路径";

// ── 原 组件主题.test.ts ──
describe("组件主题", () => {
  test("模式卡仅注册风格和字体，切换霓虹配色不改变牌面文字色", () => {
    const 目录 = 读取游戏主题目录();
    const 极光 = 解析游戏主题(默认设置, "极光原野");
    const 暖纸 = 解析游戏主题(默认设置, "待分类@配色=暖纸古典");
    expect(读取预制体主题槽位(极光, "模式卡", 目录).map((项) => 项.槽位.编号)).toEqual([
      "界面表现",
      "字体",
    ]);
    expect(读取预制体主题槽位(暖纸, "模式卡", 目录).map((项) => 项.槽位.编号)).toEqual([
      "界面表现",
      "字体",
    ]);
    expect(读取预制体主题槽位(极光, "对局仪表", 目录).map((项) => 项.槽位.编号)).toEqual([
      "界面配色",
      "仪表纹样",
      "仪表表现",
      "界面表现",
      "字体",
    ]);
    const 数据 = 组装模式卡数据("冲刺", false, null);
    const 布局 = { 中心X: 195, 中心Y: 110, 宽: 350, 高: 110 };
    const 色 = (样式: string) => {
      设置预览主题读取(() => ({
        ...默认设置,
        样式: 样式 as typeof 默认设置.样式,
        旅行样式: null,
      }));
      try {
        return 生成模式卡文字项(布局, 数据).map((项) => 项.样式.颜色);
      } finally {
        设置预览主题读取();
      }
    };
    expect(色("极光原野")).toEqual(色("暖纸古典"));
  });

  test("注册主题组件引用真实组件绘制入口", async () => {
    const 目录 = 读取游戏主题目录();
    for (const 组件 of 目录.预制体 ?? []) {
      expect(组件.源码?.length).toBeGreaterThan(0);
      for (const 源 of 组件.源码 ?? []) {
        const 模块 = await import(join(项目根路径, 源.路径));
        expect(typeof 模块[源.导出 ?? ""]).toBe("function");
      }
    }
  });

  test("主题HUD独立样品保留表现/纹样，代表状态与真实计分反馈可演示", async () => {
    const { 控件规格样品, 创建仪表预览输入 } = await import(
      "../../../资源/预制体/预览/控件规格样品"
    );
    const 样品 = 控件规格样品.find((项) => 项.编号 === "spec-meter");
    expect(样品?.源码[0]).toEqual({ 路径: "资源/预制体/对局/对局仪表.ts", 导出: "绘制对局仪表" });
    await 样品?.准备资源?.();
    const 状态 = {
      资源主题: "极光原野@仪表表现=条带;仪表纹样=平涂",
      模式: "极限",
      演示: "计分反馈",
    };
    const 初始 = 创建仪表预览输入(状态);
    const 命中 = 创建仪表预览输入(状态, 0.5);
    const 结束 = 创建仪表预览输入(状态, 1.2);
    expect([初始.表现, 初始.纹样, 初始.模式]).toEqual(["条带", "平涂", "极限"]);
    expect(命中.计分.击中).toBeGreaterThan(0);
    expect(结束.计分.显示分数).toBeGreaterThan(初始.计分.显示分数);
    expect(typeof 样品?.绘制帧).toBe("function");
  });

  test("完整预览主题读取保留无存档字段的覆盖，同时报告页面真正修改的设置", async () => {
    const { 设置预览主题读取, 读取当前主题解析 } = await import("../../../资源/主题/配色/主题读取");
    const { 读取预览主题设置, 读取预览主题解析 } = await import(
      "../../../资源/预制体/预览/主题状态"
    );
    const 状态 = { 资源主题: "成都熊猫@仪表表现=条带;仪表纹样=平涂" };
    const 设置 = 读取预览主题设置(状态);
    设置预览主题读取(
      () => 设置,
      () => 读取预览主题解析(状态, 设置),
    );
    try {
      const 值 = (编号: string) =>
        读取当前主题解析().槽位.find((项) => 项.槽位.编号 === 编号)?.资源.值;
      expect(值("仪表表现")).toBe("条带");
      expect(值("仪表纹样")).toBe("平涂");
      设置.旅行样式 = null;
      设置.样式 = "暖纸古典";
      expect(值("界面配色")).toBe("暖纸古典");
      expect(值("仪表表现")).toBe("条带");
    } finally {
      设置预览主题读取();
    }
  });
});

// ── 原 模式装置.test.ts ──
describe("模式装置", () => {
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
});
