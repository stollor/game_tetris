import { expect, test } from "bun:test";
import { 操作键虚拟键 } from "../代码/应用/视觉/对局绘制";
import { type 对局布局操作键, 计算对局布局 } from "../代码/视觉/对局布局";
import type { 点 } from "../框架/界面/绘制/协议";
import { 生成操作键轮廓 } from "../组件/霓虹街机/操作键配方";

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

/** 非相邻边是否严格相交；旋转轮廓不应有任何自交。 */
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

test("旋转键轮廓为镜像弯转，左右逐点镜像且所有点在键内", () => {
  const 左键 = 取键("左转");
  const 右键 = 取键("右转");
  const 矩形 = 键矩形(左键);
  const 左轮廓 = 取轮廓(左键, 矩形);
  const 右轮廓 = 取轮廓(右键, 矩形);
  const 暂存轮廓 = 取轮廓(取键("暂存操作"), 矩形);

  expect(左轮廓).not.toEqual(暂存轮廓);
  expect(右轮廓).not.toEqual(暂存轮廓);
  expect(左轮廓.length).toBe(右轮廓.length);

  for (const [序, 左点] of 左轮廓.entries()) {
    const 右点 = 右轮廓[序];
    expect(右点).toBeDefined();
    if (!右点) continue;
    expect(Number.isFinite(左点.x) && Number.isFinite(左点.y)).toBe(true);
    expect(Number.isFinite(右点.x) && Number.isFinite(右点.y)).toBe(true);
    expect(左点.x).toBeGreaterThanOrEqual(矩形.左);
    expect(左点.x).toBeLessThanOrEqual(矩形.左 + 矩形.宽);
    expect(左点.y).toBeGreaterThanOrEqual(矩形.上);
    expect(左点.y).toBeLessThanOrEqual(矩形.上 + 矩形.高);
    expect(右点.x).toBeCloseTo(2 * 矩形.左 + 矩形.宽 - 左点.x, 9);
    expect(右点.y).toBeCloseTo(左点.y, 9);
  }

  for (const 键 of [左键, 右键]) {
    const 自身矩形 = 键矩形(键);
    for (const 坐标 of 取轮廓(键)) {
      expect(坐标.x).toBeGreaterThanOrEqual(自身矩形.左);
      expect(坐标.x).toBeLessThanOrEqual(自身矩形.左 + 自身矩形.宽);
      expect(坐标.y).toBeGreaterThanOrEqual(自身矩形.上);
      expect(坐标.y).toBeLessThanOrEqual(自身矩形.上 + 自身矩形.高);
    }
  }

  // 实心键面承托中央大箭头，左右逐点镜像。
  const 中心X = 矩形.左 + 矩形.宽 / 2;
  const 中心Y = 矩形.上 + 矩形.高 / 2;
  expect(在多边形内({ x: 中心X, y: 中心Y }, 左轮廓)).toBe(true);
  expect(自交(左轮廓)).toBe(false);
  expect(自交(右轮廓)).toBe(false);
});
