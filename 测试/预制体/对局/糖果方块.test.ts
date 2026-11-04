import { describe, expect, test } from "bun:test";
import type { 点 } from "../../../.gamemaker/依赖/框架/界面/绘制/协议";
import type { 方块类型 } from "../../../代码/玩法/再消一行";
import { 绘制果冻单元, 绘制果冻组 } from "../../../资源/预制体/对局/糖果方块单元";

/**
 * 糖果方块：七型包成五款糖（巧克力/蛋挞/棒棒糖/拐棍糖/奶茶），一格一颗、逐格画。
 *
 * 这里只钉三件不依赖观感的事实：
 * 1. 任何输入（标准块、旋转、残缺、单格）画出来的点都必须是有限值——NaN 会污染合批几何，
 *    整屏不报错但渲染成空。
 * 2. 糖不能画出格子太远（棒棒糖糖针、拐棍糖描边这类允许探出 0.3 格以内），
 *    否则相邻两行会互相压到看不出格子边界。
 * 3. 同型相邻不连携：一组格的绘制指令与逐格单画完全一致，糖不会被拉成一条长条。
 */

type 记录 = { 点集: 点[]; 色: number[]; 数: number[] };

/** 记录型图形对象：只记录落笔的点与颜色，不做真实绘制。 */
function 建记录(): { 图形: never; 记录: 记录 } {
  const 记录: 记录 = { 点集: [], 色: [], 数: [] };
  let 当前色 = 0;
  /** 所有传进绘图接口的数值都要有限：圆角半径/线宽/椭圆半径出 NaN 同样会污染合批。 */
  const 记数 = (...值: number[]) => {
    for (const 项 of 值) 记录.数.push(项);
  };
  const 收 = (点集: readonly 点[]) => {
    for (const 项 of 点集) 记录.点集.push({ x: 项.x, y: 项.y });
    记录.色.push(当前色);
  };
  const 形 = {
    fillStyle(色: number) {
      当前色 = 色;
      return 形;
    },
    lineStyle(宽: number) {
      记数(宽);
      return 形;
    },
    fillRect(x: number, y: number, w: number, h: number) {
      记数(x, y, w, h);
      return 形;
    },
    fillRoundedRect(x: number, y: number, w: number, h: number, r: number) {
      记数(x, y, w, h, r);
      收([
        { x, y },
        { x: x + w, y: y + h },
      ]);
      return 形;
    },

    fillCircle(x: number, y: number, r: number) {
      记数(x, y, r);
      收([
        { x: x - r, y: y - r },
        { x: x + r, y: y + r },
      ]);
      return 形;
    },
    strokeCircle() {
      return 形;
    },
    fillEllipse(x: number, y: number, w: number, h: number) {
      记数(x, y, w, h);
      收([
        { x: x - w, y: y - h },
        { x: x + w, y: y + h },
      ]);
      return 形;
    },
    strokeEllipse() {
      return 形;
    },
    fillTriangle(x1: number, y1: number, x2: number, y2: number, x3: number, y3: number) {
      记数(x1, y1, x2, y2, x3, y3);
      收([
        { x: x1, y: y1 },
        { x: x2, y: y2 },
        { x: x3, y: y3 },
      ]);
      return 形;
    },
    strokeTriangle() {
      return 形;
    },
    lineBetween() {
      return 形;
    },
    fillPoints(点集: readonly 点[]) {
      收(点集);
      return 形;
    },
    strokeRoundedRect(x: number, y: number, w: number, h: number, r: number) {
      记数(x, y, w, h, r);
      return 形;
    },
    strokePoints(点集: readonly 点[]) {
      收(点集);
      return 形;
    },
    beginPath() {
      return 形;
    },
    moveTo() {
      return 形;
    },
    lineTo() {
      return 形;
    },
    closePath() {
      return 形;
    },
    arc() {
      return 形;
    },
    fillPath() {
      return 形;
    },
    strokePath() {
      return 形;
    },
    clear() {
      return 形;
    },
    setAlpha() {
      return 形;
    },
    setBlendMode() {
      return 形;
    },
    save() {
      return 形;
    },
    restore() {
      return 形;
    },
    translateCanvas() {
      return 形;
    },
    rotateCanvas() {
      return 形;
    },
    scaleCanvas() {
      return 形;
    },
    绘制画布() {
      return 形;
    },
  };
  return { 图形: 形 as never, 记录 };
}

const 标准形状: Record<方块类型, [number, number][]> = {
  I: [
    [0, 0],
    [1, 0],
    [2, 0],
    [3, 0],
  ],
  O: [
    [0, 0],
    [1, 0],
    [0, 1],
    [1, 1],
  ],
  T: [
    [0, 0],
    [1, 0],
    [2, 0],
    [1, 1],
  ],
  L: [
    [0, 0],
    [0, 1],
    [0, 2],
    [1, 2],
  ],
  J: [
    [1, 0],
    [1, 1],
    [1, 2],
    [0, 2],
  ],
  Z: [
    [0, 0],
    [1, 0],
    [1, 1],
    [2, 1],
  ],
  S: [
    [1, 0],
    [2, 0],
    [0, 1],
    [1, 1],
  ],
};

/** 顺时针转 90°。 */
function 旋转(形状: readonly [number, number][]): [number, number][] {
  const 行数 = Math.max(...形状.map(([, 行]) => 行)) + 1;
  return 形状.map(([列, 行]) => [行数 - 1 - 行, 列]);
}

const 类型表 = Object.keys(标准形状) as 方块类型[];

for (const 格 of [16, 25, 40]) {
  describe(`糖果方块 格${格}`, () => {
    test("七型四个朝向都画出有限点，且不越出包围盒 0.35 格", () => {
      for (const 类型 of 类型表) {
        let 形状 = 标准形状[类型];
        for (let 转 = 0; 转 < 4; 转 += 1) {
          const { 图形, 记录 } = 建记录();
          绘制果冻组(
            图形,
            100,
            100,
            格,
            形状.map(([列, 行]) => ({ 列, 行, 色值: 0, 类型 })),
          );
          expect(记录.点集.length).toBeGreaterThan(8);
          for (const 点 of 记录.点集) {
            expect(Number.isFinite(点.x)).toBe(true);
            expect(Number.isFinite(点.y)).toBe(true);
          }
          const 列集 = 形状.map(([列]) => 列);
          const 行集 = 形状.map(([, 行]) => 行);
          const 边 = {
            左: 100 + Math.min(...列集) * 格,
            上: 100 + Math.min(...行集) * 格,
            右: 100 + (Math.max(...列集) + 1) * 格,
            下: 100 + (Math.max(...行集) + 1) * 格,
          };
          const 容 = 格 * 0.35;
          for (const 点 of 记录.点集) {
            expect(点.x).toBeGreaterThanOrEqual(边.左 - 容);
            expect(点.x).toBeLessThanOrEqual(边.右 + 容);
            expect(点.y).toBeGreaterThanOrEqual(边.上 - 容);
            expect(点.y).toBeLessThanOrEqual(边.下 + 容);
          }
          形状 = 旋转(形状);
        }
      }
    });

    test("单格体与残缺块都画得出来且点有限", () => {
      const 用例: { 类型: 方块类型; 形状: [number, number][] }[] = [];
      for (const 类型 of 类型表) 用例.push({ 类型, 形状: [[0, 0]] });
      for (const 类型 of 类型表) 用例.push({ 类型, 形状: 标准形状[类型].slice(0, 2) });
      for (const 类型 of 类型表) 用例.push({ 类型, 形状: 标准形状[类型].slice(0, 3) });
      for (const 项 of 用例) {
        const { 图形, 记录 } = 建记录();
        绘制果冻组(
          图形,
          0,
          0,
          格,
          项.形状.map(([列, 行]) => ({ 列, 行, 色值: 0, 类型: 项.类型 })),
        );
        expect(记录.点集.length).toBeGreaterThan(4);
        for (const 点 of 记录.点集) {
          expect(Number.isFinite(点.x)).toBe(true);
          expect(Number.isFinite(点.y)).toBe(true);
        }
      }
    });

    test("同型相邻格各画各的：整组绘制与逐格单画的指令完全一致", () => {
      for (const 类型 of 类型表) {
        const 整组 = 建记录();
        绘制果冻组(
          整组.图形,
          0,
          0,
          格,
          标准形状[类型].map(([列, 行]) => ({ 列, 行, 色值: 0, 类型 })),
        );
        const 逐格 = 建记录();
        for (const [列, 行] of 标准形状[类型])
          绘制果冻单元(逐格.图形, 列 * 格, 行 * 格, 格, 0, 1, 类型);
        expect(整组.记录.点集).toEqual(逐格.记录.点集);
        expect(整组.记录.色).toEqual(逐格.记录.色);
      }
    });
  });
}

test("单格入口（飞块/碎片）画得出来", () => {
  for (const 类型 of 类型表) {
    const { 图形, 记录 } = 建记录();
    绘制果冻单元(图形, 10, 20, 25, 0, 1, 类型);
    expect(记录.点集.length).toBeGreaterThan(4);
    for (const 点 of 记录.点集) {
      expect(Number.isFinite(点.x)).toBe(true);
      expect(Number.isFinite(点.y)).toBe(true);
    }
  }
});
