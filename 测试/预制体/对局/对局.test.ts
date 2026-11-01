import { expect, test } from "bun:test";
import type { 图形对象, 点 } from "../../../.gamemaker/依赖/框架/界面/绘制/协议";
import {
  混色,
  计算颜色对比度,
  选取对比文字色,
  颜色字符串,
  颜色数值,
} from "../../../.gamemaker/依赖/框架/界面/颜色工具";
import type { 样式选择 } from "../../../.gamemaker/依赖/框架/设置/设置";
import { 操作键虚拟键 } from "../../../代码/页面/对局/对局绘制";
import { type 对局布局操作键, 计算对局布局 } from "../../../代码/页面/布局/对局布局";
import { 主题列表 } from "../../../代码/项目配置/主题目录";
import { 解析方块外观 } from "../../../资源/主题/外观/方块外观";
import { 颜色值 } from "../../../资源/主题/配色/主题读取";
import { 设置预览界面样式, 读取霓虹调色板 } from "../../../资源/主题/配色/调色板";
import { 生成操作键轮廓, 绘制操作键, 读取操作键配色 } from "../../../资源/预制体/对局/操作键配方";
import { 绘制方块单元 } from "../../../资源/预制体/对局/方块单元";
import { 绘制立方单元, 计算立方几何, 读取立方面色 } from "../../../资源/预制体/对局/立方方块单元";

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

const 测试样式: readonly 样式选择[] = ["夜空鎏金", "暖纸古典", ...主题列表];

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

/** 记录调用序列的图形替身：立方画法要靠几何与配色断言，光记颜色不够。 */
function 创建调用记录() {
  const 调用: { 方法: string; 参数: unknown[] }[] = [];
  let 图形: 图形对象;
  图形 = new Proxy(
    {},
    {
      get(_目标, 属性) {
        if (属性 === "fillStyle" || 属性 === "lineStyle")
          return (...参数: unknown[]) => {
            调用.push({ 方法: String(属性), 参数 });
            return 图形;
          };
        return (...参数: unknown[]) => {
          调用.push({ 方法: String(属性), 参数 });
          return 图形;
        };
      },
    },
  ) as unknown as 图形对象;
  return { 图形, 调用 };
}

test("立方几何填满格子：正面与进深拼成整格，顶点不出框", () => {
  for (const 格子 of [6, 8, 12, 20, 36]) {
    const 几何 = 计算立方几何(10, 20, 格子);
    expect(几何.进深 + 几何.面).toBe(格子);
    expect(几何.顶面).toHaveLength(4);
    expect(几何.右侧面).toHaveLength(4);
    for (const 点 of [...几何.顶面, ...几何.右侧面]) {
      expect(点.x).toBeGreaterThanOrEqual(10);
      expect(点.x).toBeLessThanOrEqual(10 + 格子);
      expect(点.y).toBeGreaterThanOrEqual(20);
      expect(点.y).toBeLessThanOrEqual(20 + 格子);
    }
    // 正面右下角必须正好落在格子右下角：三面才能拼成完整立方。
    expect(几何.正面.左 + 几何.正面.宽).toBe(10 + 格子 - 几何.进深);
    expect(几何.正面.上 + 几何.正面.高).toBe(20 + 格子);
  }
});

test("立方三面明暗分明：顶亮、正本色、侧暗，轮廓更深", () => {
  const 色 = 读取立方面色(0x12cefa);
  expect(色.正).toBe(0x12cefa);
  const 亮度 = (值: number) => ((值 >> 16) & 0xff) + ((值 >> 8) & 0xff) + (值 & 0xff);
  expect(亮度(色.顶)).toBeGreaterThan(亮度(色.正));
  expect(亮度(色.侧)).toBeLessThan(亮度(色.正));
  expect(亮度(色.棱)).toBeLessThan(亮度(色.侧));
});

test("立体晶格的方块单元走立方画法，其它主题不走", () => {
  const 立体 = 解析方块外观("立体晶格");
  const 记录 = 创建调用记录();
  绘制方块单元(记录.图形, 0, 0, { 方案: 立体, 格子: 20, 色值: 立体.颜色.T });
  // 立方至少有 顶面/右侧面/正面 三次填充与一次描边路径。
  expect(记录.调用.filter((项) => 项.方法 === "fillStyle").length).toBeGreaterThanOrEqual(3);
  expect(记录.调用.some((项) => 项.方法 === "strokePath")).toBe(true);
  const 宝石 = 解析方块外观("极光原野");
  expect(宝石.质感).toBe("宝石");
  const 平涂 = 创建调用记录();
  绘制方块单元(平涂.图形, 0, 0, { 方案: 宝石, 格子: 20, 色值: 宝石.颜色.T });
  expect(平涂.调用.some((项) => 项.方法 === "strokePath")).toBe(false);
});

test("立方单元对非法参数与极小格子安全", () => {
  const 空 = 创建调用记录();
  绘制立方单元(空.图形, 0, 0, 0, 0xffffff);
  expect(空.调用).toHaveLength(0);
  const 透明 = 创建调用记录();
  绘制立方单元(透明.图形, 0, 0, 20, 0xffffff, 0);
  expect(透明.调用).toHaveLength(0);
  const 极小 = 创建调用记录();
  绘制立方单元(极小.图形, 0, 0, 3, 0xffffff);
  expect(极小.调用.length).toBeGreaterThan(0);
  for (const 调 of 极小.调用)
    for (const 参 of 调.参数) if (typeof 参 === "number") expect(Number.isFinite(参)).toBe(true);
});
