import { expect, test } from "bun:test";
import { 颜色值 } from "../../../主题/配色/主题读取";
import { 设置预览界面样式, 读取霓虹调色板 } from "../../../主题/配色/调色板";
import { type 地点名称, 地点皮肤表 } from "../../../代码/框架配置/旅行地点";
import { 操作键虚拟键 } from "../../../代码/页面/对局/对局绘制";
import { type 对局布局操作键, 计算对局布局 } from "../../../代码/页面/布局/对局布局";
import type { 图形对象, 点 } from "../../../框架/界面/绘制/协议";
import {
  混色,
  计算颜色对比度,
  选取对比文字色,
  颜色字符串,
  颜色数值,
} from "../../../框架/界面/颜色工具";
import type { 样式选择 } from "../../../框架/设置/设置";
import { 生成操作键轮廓, 绘制操作键, 读取操作键配色 } from "../../../预制体/对局/操作键配方";

const 布局 = 计算对局布局(390, 844, { 模式: "马拉松", 阶段: "进行中" });

function 取键(名称: string): 对局布局操作键 {
  const 键 = 布局.操作区.键.find((项) => 项.名称 === 名称);
  if (!键) throw new Error(`缺少操作键：${名称}`);
  return 键;
}

function 键矩形(键: 对局布局操作键) {
  return { 左: 键.中心X - 键.宽 / 2, 上: 键.中心Y - 键.高 / 2, 宽: 键.宽, 高: 键.高 };
}

function 取轮廓(键: 对局布局操作键, 矩形 = 键矩形(键)): 点[] {
  return 生成操作键轮廓(键, 矩形.左, 矩形.上, 矩形.宽, 矩形.高);
}

function 叉(甲: 点, 乙: 点, 丙: 点): number {
  return (乙.x - 甲.x) * (丙.y - 甲.y) - (乙.y - 甲.y) * (丙.x - 甲.x);
}

/** 非相邻边是否严格相交：键面轮廓不应有任何自交。 */
function 自交(点集: readonly 点[]): boolean {
  const 数量 = 点集.length;
  for (let 甲 = 0; 甲 < 数量; 甲++) {
    const 甲点 = 点集[甲];
    const 乙点 = 点集[(甲 + 1) % 数量];
    if (!甲点 || !乙点) continue;
    for (let 乙 = 甲 + 1; 乙 < 数量; 乙++) {
      if (乙 === (甲 + 1) % 数量 || (甲 === 0 && 乙 === 数量 - 1)) continue;
      const 丙点 = 点集[乙];
      const 丁点 = 点集[(乙 + 1) % 数量];
      if (!丙点 || !丁点) continue;
      const 一 = 叉(甲点, 乙点, 丙点);
      const 二 = 叉(甲点, 乙点, 丁点);
      const 三 = 叉(丙点, 丁点, 甲点);
      const 四 = 叉(丙点, 丁点, 乙点);
      if (一 * 二 < 0 && 三 * 四 < 0) return true;
    }
  }
  return false;
}

function 凸(点集: readonly 点[]): boolean {
  let 方向 = 0;
  for (let 序 = 0; 序 < 点集.length; 序++) {
    const 甲 = 点集[序];
    const 乙 = 点集[(序 + 1) % 点集.length];
    const 丙 = 点集[(序 + 2) % 点集.length];
    if (!甲 || !乙 || !丙) continue;
    const 积 = 叉(甲, 乙, 丙);
    if (Math.abs(积) < 1e-9) continue;
    const 当前 = Math.sign(积);
    if (方向 === 0) 方向 = 当前;
    else if (当前 !== 方向) return false;
  }
  return 方向 !== 0;
}

function 在多边形内(点: 点, 点集: readonly 点[]): boolean {
  let 环绕 = 0;
  for (let 序 = 0; 序 < 点集.length; 序++) {
    const 甲 = 点集[序];
    const 乙 = 点集[(序 + 1) % 点集.length];
    if (!甲 || !乙) continue;
    const 位置 = 叉(甲, 乙, 点);
    if (甲.y <= 点.y && 乙.y > 点.y && 位置 > 0) 环绕++;
    else if (甲.y > 点.y && 乙.y <= 点.y && 位置 < 0) 环绕--;
  }
  return 环绕 !== 0;
}

/** 只记录颜色调用的画笔替身：绘制函数链式调用任意方法都返回自身。 */
function 创建记录图形() {
  const 填充色: number[] = [];
  const 描边色: number[] = [];
  let 图形: 图形对象;
  图形 = new Proxy(
    {},
    {
      get(_目标, 属性) {
        if (属性 === "fillStyle")
          return (颜色: number) => {
            填充色.push(颜色);
            return 图形;
          };
        if (属性 === "lineStyle")
          return (_线宽: number, 颜色: number) => {
            描边色.push(颜色);
            return 图形;
          };
        return () => 图形;
      },
    },
  ) as unknown as 图形对象;
  return { 图形, 填充色, 描边色 };
}

const 测试样式: readonly (样式选择 | 地点名称)[] = [
  "夜空鎏金",
  "暖纸古典",
  "极光原野",
  ...(地点皮肤表[0] ? [地点皮肤表[0].名称] : []),
];

test("手机布局保留六键名称，暂存映射暂存且无旋转重复", () => {
  expect(布局.操作区.键.map((键) => 键.名称)).toEqual([
    "左转",
    "暂存操作",
    "右转",
    "左移",
    "软降",
    "右移",
  ]);
  expect(布局.操作区.键.some((键) => 键.名称 === "旋转")).toBe(false);
  expect(操作键虚拟键(取键("暂存操作"))).toBe("暂存");
});

test("暂停按钮位于左上，布局不再返回离开按钮", () => {
  expect(布局.暂停按钮.中心X).toBe(43);
  expect(布局.暂停按钮.中心Y).toBe(38);
  expect("离开按钮" in 布局).toBe(false);
});

test("旋转与暂存共用小切角轮廓，移动和软降保留原形", () => {
  const 左键 = 取键("左转");
  const 右键 = 取键("右转");
  const 暂存键 = 取键("暂存操作");
  const 矩形 = 键矩形(左键);
  const 左轮廓 = 取轮廓(左键, 矩形);
  const 右轮廓 = 取轮廓(右键, 矩形);
  const 暂存轮廓 = 取轮廓(暂存键, 矩形);

  expect(左轮廓).toEqual(右轮廓);
  expect(左轮廓).toEqual(暂存轮廓);
  expect(左轮廓.length).toBe(8);

  // 三键共用同一份小切角凸多边形：有限、落在键内、无自交。
  for (const 轮廓 of [左轮廓, 右轮廓, 暂存轮廓]) {
    for (const 坐标 of 轮廓) {
      expect(Number.isFinite(坐标.x) && Number.isFinite(坐标.y)).toBe(true);
      expect(坐标.x).toBeGreaterThanOrEqual(矩形.左);
      expect(坐标.x).toBeLessThanOrEqual(矩形.左 + 矩形.宽);
      expect(坐标.y).toBeGreaterThanOrEqual(矩形.上);
      expect(坐标.y).toBeLessThanOrEqual(矩形.上 + 矩形.高);
    }
    expect(凸(轮廓)).toBe(true);
    expect(自交(轮廓)).toBe(false);
  }

  const 中心X = 矩形.左 + 矩形.宽 / 2;
  const 中心Y = 矩形.上 + 矩形.高 / 2;
  expect(在多边形内({ x: 中心X, y: 中心Y }, 左轮廓)).toBe(true);

  // 移动与软降仍保留各自的 7 点轮廓，没有被小切角取代。
  for (const 名称 of ["左移", "右移", "软降"]) {
    const 键 = 取键(名称);
    const 自身矩形 = 键矩形(键);
    const 轮廓 = 取轮廓(键);
    expect(轮廓.length).toBe(7);
    expect(轮廓).not.toEqual(左轮廓);
    for (const 坐标 of 轮廓) {
      expect(Number.isFinite(坐标.x) && Number.isFinite(坐标.y)).toBe(true);
      expect(坐标.x).toBeGreaterThanOrEqual(自身矩形.左);
      expect(坐标.x).toBeLessThanOrEqual(自身矩形.左 + 自身矩形.宽);
      expect(坐标.y).toBeGreaterThanOrEqual(自身矩形.上);
      expect(坐标.y).toBeLessThanOrEqual(自身矩形.上 + 自身矩形.高);
    }
    expect(自交(轮廓)).toBe(false);
  }
});

test("操作键配色来自当前霓虹调色板，普通/按下/软降图标对比达标", () => {
  for (const 样式 of 测试样式) {
    const 调色板 = 读取霓虹调色板(样式);
    const 配色 = 读取操作键配色(样式);
    expect(配色.托盘).toBe(调色板.面板底);
    expect(配色.唇).toBe(混色(调色板.背景, 调色板.面板底, 0.5));
    expect(配色.普通面).toBe(颜色值(调色板.次要按钮.面板));
    expect(配色.按下).toBe(混色(颜色值(调色板.次要按钮.面板), 调色板.强调, 0.28));
    expect(配色.软降).toBe(混色(颜色值(调色板.次要按钮.面板), 调色板.强调, 0.18));
    expect(配色.描边).toBe(颜色值(调色板.次要按钮.边框));
    expect(配色.强调).toBe(调色板.强调);

    const 候选 = [调色板.次要按钮.文字, 调色板.主要按钮.文字, "#161616", "#ffffff"];
    for (const [面, 图标] of [
      [配色.普通面, 配色.普通图标],
      [配色.按下, 配色.按下图标],
      [配色.软降, 配色.软降图标],
    ] as const) {
      expect(图标).toBe(颜色数值(选取对比文字色(颜色字符串(面), 候选)));
      const 对比 = 计算颜色对比度(颜色字符串(图标), 颜色字符串(面));
      expect(对比).not.toBeNull();
      expect(对比 ?? 0).toBeGreaterThanOrEqual(4.5);
    }
  }
});

test("按钮绘制与配色函数同源，并随主题切换更新", () => {
  设置预览界面样式("暖纸古典");
  try {
    const 配色 = 读取操作键配色();
    const 左移 = 取键("左移");

    const 普通 = 创建记录图形();
    绘制操作键(普通.图形, 左移, false);
    expect(普通.填充色[3]).toBe(配色.普通面);
    expect(普通.填充色[5]).toBe(配色.普通图标);

    const 按下 = 创建记录图形();
    绘制操作键(按下.图形, 左移, true);
    expect(按下.填充色[3]).toBe(配色.按下);
    expect(按下.填充色[5]).toBe(配色.按下图标);

    const 软降 = 创建记录图形();
    绘制操作键(软降.图形, 取键("软降"), false);
    expect(软降.填充色[3]).toBe(配色.软降);
    expect(软降.描边色).toContain(配色.软降图标);
  } finally {
    设置预览界面样式(undefined);
  }
});
