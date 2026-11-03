import { describe, expect, test } from "bun:test";
import type { 图形对象 } from "../../../.gamemaker/依赖/框架/界面/绘制/协议";
import { type 游戏设置, 默认设置 } from "../../../代码/设置/游戏设置";
import { 主题列表, type 主题名 } from "../../../代码/项目配置/主题目录";
import { 解析游戏主题 } from "../../../资源/主题/主题组合";
import { 设置预览主题, 设置预览主题读取 } from "../../../资源/主题/配色/主题读取";
import { 入场参数 } from "../../../资源/视效/过渡/入场参数";
import {
  单帧图元预算,
  卡片占比,
  卡片显示度,
  卡片矩形,
  收束延迟,
  收束起点,
  收束铺幅,
  砖块可见度,
  砖块尺寸,
  砖块布局,
  砖块色号,
  砖块颜色,
  砖墙覆盖比,
  离卡距离,
  落砖偏移,
  落砖抬升,
} from "../../../资源/视效/过渡/转场主题/彩砖";
import {
  极光卡片占比,
  极光卡片矩形,
  极光画法,
  极光覆盖板,
  读取幕色,
} from "../../../资源/视效/过渡/转场主题/极光";
import { 卡片碎片, 液晶卡片占比, 点亮行, 量化覆盖度 } from "../../../资源/视效/过渡/转场主题/液晶";
import { 转场画法表 } from "../../../资源/视效/过渡/转场主题/画法表";
import {
  卡片四点,
  卡片塌陷,
  扩张进度,
  梯形四点,
  棱线集合,
  消失点,
  立体卡片占比,
  覆盖比 as 立体覆盖比,
} from "../../../资源/视效/过渡/转场主题/立体";
import type { 转场主题, 转场帧 } from "../../../资源/视效/过渡/转场主题/类型";
import {
  糖果卡片占比,
  糖果卡片矩形,
  糖果融化半径,
  糖果覆盖比,
  糖果软糖半径,
  裱花圆心,
  软糖回弹,
  软糖膨胀曲线,
} from "../../../资源/视效/过渡/转场主题/糖果";
import { 解析转场风格, 读取转场风格 } from "../../../资源/视效/过渡/转场主题/风格";

/** 五套主题的转场风格承诺：改主题或改判据必须同步这里。 */
const 期望风格: Record<主题名, 转场主题> = {
  极光原野: "极光",
  砖机液晶: "液晶",
  街机彩砖: "彩砖",
  立体晶格: "立体",
  糖果超甜: "糖果",
};

const 风格全集: readonly 转场主题[] = ["极光", "液晶", "彩砖", "立体", "糖果"];

/** 假图形对象：只记录调用与参数，用来验证主题画法不抛错、不出 NaN、真的画了东西。 */
function 记录画图() {
  const 调用: { 方法: string; 参数: unknown[] }[] = [];
  const 图 = new Proxy({} as 图形对象, {
    get(_目标, 键) {
      if (typeof 键 !== "string") return undefined;
      return (...参数: unknown[]) => {
        调用.push({ 方法: 键, 参数 });
        return 图;
      };
    },
  });
  return { 图, 调用 };
}

const 尺寸 = { 宽: 390, 高: 844 } as const;
const 原卡 = { 左: 24, 上: 596, 宽: 342, 高: 96 } as const;

function 帧(阶段: 转场帧["阶段"], 进度: number, 原卡值: 转场帧["原卡"] = null): 转场帧 {
  return { ...尺寸, 模式色: 0x00e5ff, 阶段, 进度, 原卡: 原卡值 };
}

/** 遮罩调用里面积明显的一笔（过滤描边/细线）；用于判断「真的盖住了东西」。 */
function 大面积调用(调用: { 方法: string; 参数: unknown[] }[]): typeof 调用 {
  return 调用.filter(({ 方法, 参数 }) => {
    if (!["fillRect", "fillRoundedRect", "fillGradientStyle", "fillCircle"].includes(方法))
      return false;
    const 宽 = 参数[2];
    const 高 = 参数[3];
    return typeof 宽 === "number" && typeof 高 === "number" && 宽 * 高 > 尺寸.宽 * 尺寸.高 * 0.05;
  });
}

describe("转场主题风格", () => {
  test("五套主题各自解析到约定的转场风格", () => {
    expect(Object.keys(期望风格).sort()).toEqual([...主题列表].sort());
    for (const 名称 of 主题列表)
      expect(解析转场风格(解析游戏主题(默认设置, 名称))).toBe(期望风格[名称]);
  });

  test("画法表覆盖全部风格，且每种画法都有覆盖比与遮罩", () => {
    expect(Object.keys(转场画法表).sort()).toEqual([...风格全集].sort());
    for (const 风格 of 风格全集) {
      expect(typeof 转场画法表[风格].绘制遮罩).toBe("function");
      expect(typeof 转场画法表[风格].覆盖比).toBe("function");
    }
  });

  test("五套画法的覆盖比都从 0 盖到 1 再退回 0", () => {
    for (const 风格 of 风格全集) {
      const 画法 = 转场画法表[风格];
      expect(画法.覆盖比(帧("收束", 0, 原卡))).toBeCloseTo(0, 6);
      expect(画法.覆盖比(帧("收束", 1, 原卡))).toBeCloseTo(1, 6);
      expect(画法.覆盖比(帧("展开", 0))).toBeCloseTo(1, 6);
      expect(画法.覆盖比(帧("展开", 1))).toBeCloseTo(0, 6);
      let 前 = -1;
      for (let 步 = 0; 步 <= 20; 步 += 1) {
        const 值 = 画法.覆盖比(帧("收束", 步 / 20, 原卡));
        expect(值).toBeGreaterThanOrEqual(前 - 1e-9);
        expect(值).toBeGreaterThanOrEqual(0);
        expect(值).toBeLessThanOrEqual(1);
        前 = 值;
      }
    }
  });

  test("读取当前风格跟随玩家主题，也跟随商店整页试穿", () => {
    const 设置 = (名称: 主题名): 游戏设置 => ({ ...默认设置, 主题选择: 名称 });
    try {
      设置预览主题读取(() => 设置("砖机液晶"));
      expect(读取转场风格()).toBe("液晶");
      设置预览主题读取(() => 设置("糖果超甜"));
      expect(读取转场风格()).toBe("糖果");
      设置预览主题("立体晶格");
      expect(读取转场风格()).toBe("立体");
    } finally {
      设置预览主题(undefined);
      设置预览主题读取();
    }
  });
});

describe("极光转场基线与接力契约", () => {
  test("幕色按模式染色但不发白", () => {
    const 幕色 = [0x00e5ff, 0xffee58, 0xff2d9b, 0x00e676].map(读取幕色);
    expect(new Set(幕色.map((色) => 色.内)).size).toBe(4);
    for (const 色 of 幕色)
      for (const 值 of [色.外, 色.内])
        expect(Math.max((值 >> 16) & 255, (值 >> 8) & 255, 值 & 255)).toBeLessThan(200);
  });

  test("卡片阶段从模式卡原位收到全宽中央线", () => {
    const 起 = 极光卡片矩形(帧("收束", 0, 原卡));
    expect(起).toEqual({ ...原卡 });
    const 线 = 极光卡片矩形(帧("收束", 极光卡片占比, 原卡));
    expect(线.左).toBeCloseTo(0, 6);
    expect(线.宽).toBeCloseTo(尺寸.宽, 6);
    expect(线.高).toBeCloseTo(入场参数.运动.线高, 6);
    expect(线.上 + 线.高 / 2).toBeCloseTo(尺寸.高 / 2, 6);
  });

  test("收束 1 与展开 0 的覆盖板完全相同，都是整屏", () => {
    const 收 = 极光覆盖板(帧("收束", 1, 原卡));
    const 开 = 极光覆盖板(帧("展开", 0));
    expect(收).toEqual(开);
    expect(收.上半).toEqual({ 起: 0, 止: 尺寸.高 / 2 });
    expect(收.下半).toEqual({ 起: 尺寸.高 / 2, 止: 尺寸.高 });
    // 收束 0 不覆盖任何面积，展开 1 退干净。
    const 零 = 极光覆盖板(帧("收束", 0, 原卡));
    expect(零.上半.止 - 零.上半.起).toBe(0);
    const 净 = 极光覆盖板(帧("展开", 1));
    expect(净.上半.止 - 净.上半.起).toBe(0);
    expect(净.下半.止 - 净.下半.起).toBe(0);
  });

  test("收束 1 与展开 0 的遮罩调用完全一致（跨页接缝不能露馅）", () => {
    for (const 风格 of 风格全集) {
      const 画法 = 转场画法表[风格];
      const 收 = 记录画图();
      画法.绘制遮罩(收.图, 帧("收束", 1, 原卡));
      const 开 = 记录画图();
      画法.绘制遮罩(开.图, 帧("展开", 0));
      expect(收.调用).toEqual(开.调用);
      expect(画法.覆盖比(帧("收束", 1, 原卡))).toBeCloseTo(1, 6);
      expect(画法.覆盖比(帧("展开", 0))).toBeCloseTo(1, 6);
    }
  });
});

describe("转场画法冒烟", () => {
  const 情形 = [
    { 名称: "收束 0（有卡）", 帧: 帧("收束", 0, 原卡) },
    { 名称: "收束 0（无卡）", 帧: 帧("收束", 0) },
    { 名称: "收束中段", 帧: 帧("收束", 0.5, 原卡) },
    { 名称: "收束末帧", 帧: 帧("收束", 1, 原卡) },
    { 名称: "展开首帧", 帧: 帧("展开", 0) },
    { 名称: "展开中段", 帧: 帧("展开", 0.5) },
    { 名称: "展开末帧", 帧: 帧("展开", 1) },
  ] as const;

  for (const 风格 of 风格全集) {
    test(`${风格}：各进度可绘制、参数有限、按进度真的在画`, () => {
      const 画法 = 转场画法表[风格];
      for (const 项 of 情形) {
        const { 图, 调用 } = 记录画图();
        画法.绘制遮罩(图, 项.帧);
        画法.绘制强调?.(图, 项.帧);
        for (const { 参数 } of 调用)
          for (const 值 of 参数) if (typeof 值 === "number") expect(Number.isFinite(值)).toBe(true);
        if (项.帧.阶段 === "收束" && 项.帧.进度 >= 0.5) expect(调用.length).toBeGreaterThan(0);
        if (项.帧.阶段 === "展开" && 项.帧.进度 === 1) expect(大面积调用(调用)).toEqual([]);
      }
      const 节拍 = 记录画图();
      画法.绘制节拍底纹?.(节拍.图, { ...尺寸, 模式色: 0x00e676, 显: 0.6 });
    });
  }

  test("极光画法在卡片阶段之后不再画卡片，避免跨页接缝多一笔", () => {
    const 有卡 = 记录画图();
    极光画法.绘制遮罩(有卡.图, 帧("收束", 0.2, 原卡));
    const 无线 = 记录画图();
    极光画法.绘制遮罩(无线.图, 帧("收束", 0.6, 原卡));
    expect(有卡.调用.some(({ 方法 }) => 方法 === "fillRoundedRect")).toBe(true);
    expect(无线.调用.some(({ 方法 }) => 方法 === "fillRoundedRect")).toBe(false);
  });
});

describe("砖机液晶转场动势", () => {
  test("覆盖度量化成 8 档，端点精确且单调", () => {
    expect(液晶卡片占比).toBe(0.34);
    expect(量化覆盖度(0)).toBe(0);
    expect(量化覆盖度(1)).toBe(1);
    expect(量化覆盖度(0.9)).toBe(1);
    let 前 = -1;
    for (let 步 = 0; 步 <= 100; 步 += 1) {
      const 值 = 量化覆盖度(步 / 100);
      expect(值).toBeGreaterThanOrEqual(前);
      expect(Math.round(值 * 8)).toBeCloseTo(值 * 8, 10);
      前 = 值;
    }
  });

  test("展开逐行点亮：0 行起、1 时半屏排满，单调", () => {
    expect(点亮行(844, 0)).toBe(0);
    const 满 = 点亮行(844, 1);
    expect(满).toBeGreaterThan(50);
    let 前 = -1;
    for (let 步 = 0; 步 <= 50; 步 += 1) {
      const 值 = 点亮行(844, 步 / 50);
      expect(值).toBeGreaterThanOrEqual(前);
      expect(值).toBeLessThanOrEqual(满);
      前 = 值;
    }
  });

  test("卡片碎片 4px 对齐，压成扫描线后不再可见", () => {
    const 碎 = 卡片碎片(原卡, 390, 844, 0);
    expect(碎.可见).toBe(true);
    expect(碎.横条.length).toBeGreaterThan(0);
    for (const 条 of 碎.横条) {
      expect(条.左 % 4).toBe(0);
      expect(条.上 % 4).toBe(0);
      expect(条.宽 % 4).toBe(0);
      expect(条.高 % 4).toBe(0);
    }
    expect(卡片碎片(原卡, 390, 844, 液晶卡片占比)).toEqual({
      横条: [],
      点块: [],
      可见: false,
    });
    expect(卡片碎片(null, 390, 844, 0).横条.length).toBeGreaterThan(0);
  });
});

describe("街机彩砖转场动势", () => {
  const 帧 = (阶段: 转场帧["阶段"], 进度: number, 卡: 转场帧["原卡"] = 原卡) =>
    ({ ...尺寸, 模式色: 0xffee58, 阶段, 进度, 原卡: 卡 }) as 转场帧;

  test("砖块 2:1、整屏砖数压在预算内、边缘铺满", () => {
    const 节距 = 砖块尺寸(390, 844);
    expect(节距.砖宽).toBe(节距.砖高 * 2);
    const 布局 = 砖块布局(390, 844);
    const 砖数 = 布局.reduce((合计, 行) => 合计 + 行.砖.length, 0);
    expect(砖数).toBeGreaterThan(20);
    expect(砖数).toBeLessThanOrEqual(单帧图元预算);
    const 左 = Math.min(...布局.flatMap((行) => 行.砖.map((砖) => 砖.左)));
    const 右 = Math.max(...布局.flatMap((行) => 行.砖.map((砖) => 砖.左 + 砖.宽)));
    expect(左).toBeLessThanOrEqual(0);
    expect(右).toBeGreaterThanOrEqual(390);
    // 错缝：奇数行出现半块偏移的砖（左边界落在半块位置）。
    const 半块 = 节距.砖宽 / 2;
    expect((布局[0]?.砖 ?? []).every((砖) => 砖.左 % 节距.砖宽 === 0)).toBe(true);
    expect((布局[1]?.砖 ?? []).some((砖) => 砖.左 % 节距.砖宽 === 半块)).toBe(true);
  });

  test("砖色按行成带、相邻列不撞色", () => {
    for (let 行 = 0; 行 < 6; 行 += 1) {
      expect(砖块色号(行)).toBeGreaterThanOrEqual(0);
      expect(砖块色号(行)).toBeLessThan(7);
      for (let 列 = 0; 列 < 8; 列 += 1) expect(砖块颜色(行, 列)).not.toBe(砖块颜色(行, 列 + 1));
    }
  });

  test("离卡距离与逐块延迟：卡内为 0、越远越晚，端点精确", () => {
    const 卡 = 卡片矩形(帧("收束", 0.5));
    const 卡心 = { x: 卡.左 + 卡.宽 / 2, y: 卡.上 + 卡.高 / 2 };
    expect(离卡距离(帧("收束", 0.5), 卡心.x, 卡心.y)).toBe(0);
    const 远角 = 离卡距离(帧("收束", 0.5), 0, 0);
    expect(远角).toBeGreaterThan(0.8);
    expect(远角).toBeLessThanOrEqual(1);
    expect(离卡距离(帧("收束", 0.5), 0, 0)).toBeGreaterThan(离卡距离(帧("收束", 0.5), 390, 300));
    expect(卡片显示度(0)).toBe(1);
    expect(卡片显示度(卡片占比)).toBeCloseTo(0, 6);
    for (const 砖 of 砖块布局(390, 844)
      .flatMap((行) => 行.砖)
      .slice(0, 40)) {
      const 延迟 = 收束延迟(帧("收束", 0.5), 砖);
      expect(延迟).toBeGreaterThanOrEqual(收束起点);
      expect(延迟).toBeLessThanOrEqual(收束起点 + 收束铺幅 + 1e-9);
    }
  });

  test("砖块可见度两端精确，落砖偏移落定归零", () => {
    const 砖 = 砖块布局(390, 844)[0]?.砖[0];
    expect(砖).toBeDefined();
    if (!砖) return;
    expect(砖块可见度(帧("收束", 1), 砖)).toBeCloseTo(1, 6);
    expect(砖块可见度(帧("展开", 0), 砖)).toBeCloseTo(1, 6);
    expect(砖块可见度(帧("收束", 0), 砖)).toBe(0);
    expect(砖块可见度(帧("展开", 1), 砖)).toBe(0);
    expect(落砖偏移(1)).toBe(0);
    expect(落砖偏移(0)).toBeCloseTo(-落砖抬升, 6);
    for (let 步 = 0; 步 <= 20; 步 += 1) expect(Math.abs(落砖偏移(步 / 20))).toBeLessThan(2);
    expect(砖墙覆盖比(帧("收束", 1))).toBeCloseTo(1, 6);
    expect(砖墙覆盖比(帧("展开", 0))).toBeCloseTo(1, 6);
    expect(砖墙覆盖比(帧("收束", 0))).toBe(0);
  });
});

describe("立体晶格转场动势", () => {
  const 帧 = (阶段: 转场帧["阶段"], 进度: number, 卡: 转场帧["原卡"] = 原卡) =>
    ({ ...尺寸, 模式色: 0x00e5ff, 阶段, 进度, 原卡: 卡 }) as 转场帧;

  test("卡片四点：起点就是原卡，塌陷到底四点重合在消失点", () => {
    const 起 = 卡片四点(帧("收束", 0));
    expect(起.左上).toEqual({ x: 原卡.左, y: 原卡.上 });
    expect(起.右下).toEqual({ x: 原卡.左 + 原卡.宽, y: 原卡.上 + 原卡.高 });
    const 点 = 消失点(帧("收束", 0));
    expect(点).toEqual({ x: 尺寸.宽 / 2, y: 尺寸.高 / 2 });
    const 终 = 卡片四点(帧("收束", 立体卡片占比));
    for (const 角 of [终.左上, 终.右上, 终.右下, 终.左下]) {
      expect(角.x).toBeCloseTo(点.x, 6);
      expect(角.y).toBeCloseTo(点.y, 6);
    }
    expect(卡片塌陷(帧("展开", 0.5))).toBe(0);
  });

  test("幕面梯形：接力点是整屏矩形，收束 1 与展开 0 逐值相同", () => {
    const 收 = 梯形四点(帧("收束", 1));
    const 开 = 梯形四点(帧("展开", 0));
    expect(收).toEqual(开);
    expect(收.左上).toEqual({ x: 0, y: 0 });
    expect(收.右上).toEqual({ x: 尺寸.宽, y: 0 });
    expect(收.右下).toEqual({ x: 尺寸.宽, y: 尺寸.高 });
    expect(收.左下).toEqual({ x: 0, y: 尺寸.高 });
    const 点 = 消失点(帧("收束", 0));
    expect(梯形四点(帧("收束", 0)).左上.x).toBeCloseTo(点.x, 6);
  });

  test("扩张进度一收一放严格反向，覆盖比端点精确", () => {
    expect(扩张进度(帧("收束", 0))).toBe(0);
    expect(扩张进度(帧("收束", 1))).toBe(1);
    expect(扩张进度(帧("展开", 0))).toBe(1);
    expect(扩张进度(帧("展开", 1))).toBe(0);
    expect(立体覆盖比(帧("收束", 1))).toBeCloseTo(1, 6);
    expect(立体覆盖比(帧("展开", 0))).toBeCloseTo(1, 6);
    expect(立体覆盖比(帧("展开", 1))).toBe(0);
    const 棱线 = 棱线集合(帧("收束", 0.5));
    expect(棱线).toHaveLength(8);
    for (const 段 of 棱线) {
      expect(段.从).toEqual(消失点(帧("收束", 0.5)));
      expect(Number.isFinite(段.到.x)).toBe(true);
      expect(Number.isFinite(段.到.y)).toBe(true);
    }
  });
});

describe("糖果超甜转场动势", () => {
  const 帧 = (阶段: 转场帧["阶段"], 进度: number, 卡: 转场帧["原卡"] = 原卡) =>
    ({ ...尺寸, 模式色: 0xff2d9b, 阶段, 进度, 原卡: 卡 }) as 转场帧;

  test("膨胀曲线单调、卡片阶段只鼓到 0.18、端点精确", () => {
    expect(软糖膨胀曲线(0)).toBe(0);
    expect(软糖膨胀曲线(1)).toBe(1);
    expect(软糖膨胀曲线(糖果卡片占比)).toBeCloseTo(0.18, 6);
    let 前 = -1;
    for (let 步 = 0; 步 <= 100; 步 += 1) {
      const 值 = 软糖膨胀曲线(步 / 100);
      expect(值).toBeGreaterThanOrEqual(前 - 1e-9);
      expect(值).toBeGreaterThanOrEqual(0);
      expect(值).toBeLessThanOrEqual(1);
      前 = 值;
    }
  });

  test("回弹只在末段发生且收尾归零，不参与覆盖比", () => {
    expect(软糖回弹(0)).toBe(0);
    expect(软糖回弹(0.62)).toBe(0);
    expect(软糖回弹(1)).toBe(0);
    expect(软糖回弹(0.8)).toBeGreaterThan(0);
    expect(糖果覆盖比(帧("收束", 1))).toBe(1);
    expect(糖果覆盖比(帧("展开", 0))).toBe(1);
  });

  test("软糖半径 0→满、融化孔半径 满→0，端点精确", () => {
    expect(糖果软糖半径(200, 0)).toBe(0);
    expect(糖果软糖半径(200, 1)).toBe(200);
    expect(糖果融化半径(200, 1)).toBe(0);
    expect(糖果融化半径(200, 0)).toBe(200);
    expect(糖果卡片矩形(帧("收束", 0))).toEqual(原卡);
    const 兜底 = 糖果卡片矩形(帧("收束", 0, null));
    expect(兜底.宽).toBeCloseTo(尺寸.宽 * 0.32, 6);
    expect(兜底.高).toBeGreaterThan(0);
  });

  test("裱花沿宽度均匀排布", () => {
    expect(裱花圆心(0)).toEqual([]);
    const 圆心 = 裱花圆心(390);
    expect(圆心).toHaveLength(26);
    expect(圆心[0]).toBeCloseTo(7.5, 6);
    expect(圆心.at(-1)).toBeCloseTo(382.5, 6);
  });
});
