import type { 图形对象, 点 } from "../../../.gamemaker/依赖/框架/界面/绘制/协议";
import { 亮色 } from "../../../.gamemaker/依赖/框架/界面/颜色工具";
import type { 方块类型 } from "../../../代码/玩法/再消一行";
import { 构建几何, type 糖果块几何 } from "./方块/几何";
import { 绘制奶茶 } from "./方块/奶茶";
import { 绘制巧克力 } from "./方块/巧克力";
import { 绘制拐棍糖 } from "./方块/拐棍糖";
import { 绘制棒棒糖 } from "./方块/棒棒糖";
import { 绘制蛋挞 } from "./方块/蛋挞";

/**
 * 糖果方块：一格一颗糖，逐格画，不做连携。
 *
 * 五款糖按类型分（O 巧克力、I 蛋挞、T 棒棒糖、L/J 拐棍糖、Z/S 奶茶），
 * 同型格挨在一起也只是两颗独立的糖：每格各自占满自己的格子，
 * 不会因为相邻同型同色被熔成一条拉长的怪糖——满盘时读作一颗颗方糖，
 * 而不是被包围盒拉扁的长条。当前块、预览块、已落格走的都是这一条路径。
 */

export interface 果冻格 {
  列: number;
  行: number;
  色值: number;
  类型?: 方块类型;
}

type 糖果绘制 = (绘图: 图形对象, 几何: 糖果块几何) => void;

const 绘制表: Record<方块类型, 糖果绘制> = {
  O: 绘制巧克力,
  I: 绘制蛋挞,
  T: 绘制棒棒糖,
  L: 绘制拐棍糖,
  J: 绘制拐棍糖,
  Z: 绘制奶茶,
  S: 绘制奶茶,
};

/**
 * 净化点集：去掉 NaN/Infinity 与相邻重复点，闭合路径再掉一次首尾重复。
 *
 * 绘制模块是几何算出来的多边形，退化形状（极短边、重复点）一旦进了合批的三角化，
 * 会在 GPU 缓冲里留下 NaN 顶点，Three 只报一句 computeBoundingSphere NaN，整块就不见了。
 * 这里统一兜住，模块不必各自防守。
 */
function 净点集(点集: readonly 点[], 闭合: boolean, 最小间距 = 0.05): 点[] {
  const 结果: 点[] = [];
  for (const 点 of 点集) {
    if (!Number.isFinite(点.x) || !Number.isFinite(点.y)) continue;
    const 上 = 结果[结果.length - 1];
    if (上 && Math.hypot(上.x - 点.x, 上.y - 点.y) < 最小间距) continue;
    结果.push(点);
  }
  if (闭合 && 结果.length > 2) {
    const 首 = 结果[0];
    const 尾 = 结果[结果.length - 1];
    if (首 && 尾 && Math.hypot(首.x - 尾.x, 首.y - 尾.y) < 最小间距) 结果.pop();
  }
  return 结果;
}

/** 面积是否可忽略：三角化会被零面积多边形喂出一堆 NaN 法线。 */
function 面积(点集: readonly 点[]): number {
  let 和 = 0;
  for (let i = 0; i < 点集.length; i += 1) {
    const a = 点集[i];
    const b = 点集[(i + 1) % 点集.length];
    if (!a || !b) continue;
    和 += a.x * b.y - b.x * a.y;
  }
  return Math.abs(和) / 2;
}

/** 给绘制模块套一层净化：链式调用仍然返回这层包装，退化形状直接丢掉。 */
function 净化图形(原: 图形对象, 格: number): 图形对象 {
  const 代理 = new Proxy(原, {
    get(目标, 键) {
      const 值 = Reflect.get(目标, 键) as unknown;
      if (typeof 值 !== "function") return 值;
      if (键 === "fillPoints") {
        return (点集: readonly 点[], 闭合 = true) => {
          const 净 = 净点集(点集, 闭合);
          // 细长残片（裁进凸形在擦边时会产生）会被三角化算出 NaN 法线，按面积挡掉。
          if (净.length >= 3 && 面积(净) > Math.max(0.6, 格 * 格 * 0.002))
            目标.fillPoints(净, 闭合);
          return 代理;
        };
      }
      if (键 === "strokePoints") {
        return (点集: readonly 点[], 闭合 = false) => {
          const 净 = 净点集(点集, 闭合);
          if (净.length >= 2) 目标.strokePoints(净, 闭合);
          return 代理;
        };
      }
      return (...参数: unknown[]) => {
        // 圆/椭圆/圆角矩形这类直接收数字的接口也要挡 NaN：画错的糖宁可少一笔，不能污染合批。
        for (const 项 of 参数) {
          if (typeof 项 === "number" && !Number.isFinite(项)) return 代理;
        }
        const 结果 = (值 as (...项: unknown[]) => unknown).apply(目标, 参数);
        return 结果 === 目标 ? 代理 : 结果;
      };
    },
  }) as 图形对象;
  return 代理;
}

/** 画一格糖（左上角定位）：糖体由该类型的模块自己收成一颗方糖。 */
function 画一颗(
  绘图: 图形对象,
  左: number,
  上: number,
  格: number,
  类型: 方块类型,
  透明度: number,
): void {
  const 几何 = 构建几何(左, 上, 格, 类型, 透明度);
  // 四周各收一道缝：相邻两格之间留出 3px 左右的缝，满盘才不会糊成一片色块。
  const 缝 = Math.min(2, 格 * 0.06);
  const 缩 = Math.min(1, Math.max(0.9, (格 - 缝 * 2) / 格));
  绘图.save();
  绘图.translateCanvas(几何.中心X, 几何.中心Y);
  绘图.scaleCanvas(缩, 缩);
  绘图.translateCanvas(-几何.中心X, -几何.中心Y);
  绘制表[类型](绘图, 几何);
  绘图.restore();
}

/**
 * 画一组糖果格（棋盘上全部已落格、当前块或预览块）：一格一颗，同型相邻也不合并。
 * 原点是第 0 列第 0 行格子的左上角；同一格重复传进来只画一次。
 */
export function 绘制果冻组(
  绘图: 图形对象,
  原点X: number,
  原点Y: number,
  格: number,
  格列表: readonly 果冻格[],
  透明度 = 1,
): void {
  if (!(格 > 0) || 透明度 <= 0 || 格列表.length === 0) return;
  const 笔 = 净化图形(绘图, 格);
  const 已画 = new Set<string>();
  for (const 项 of 格列表) {
    const 键 = `${项.列},${项.行}`;
    if (已画.has(键)) continue;
    已画.add(键);
    画一颗(笔, 原点X + 项.列 * 格, 原点Y + 项.行 * 格, 格, 项.类型 ?? "O", 透明度);
  }
}

/** 单格糖果（左上角定位）：飞块、消行碎片等逐格调用的入口。 */
export function 绘制果冻单元(
  绘图: 图形对象,
  x: number,
  y: number,
  格: number,
  色值: number,
  透明度 = 1,
  类型?: 方块类型,
): void {
  void 色值;
  画一颗(净化图形(绘图, 格), x, y, 格, 类型 ?? "O", 透明度);
}

/** 幽灵投影：一圈糖霜虚线框和很淡的糖体，不抢实块。 */
export function 绘制果冻幽灵(
  绘图: 图形对象,
  x: number,
  y: number,
  格: number,
  色值: number,
  透明度 = 1,
  填充 = true,
): void {
  const r = Math.max(1.5, 格 * 0.22);
  const 内缩 = Math.max(1.5, 格 * 0.12);
  const 宽 = 格 - 内缩 * 2;
  if (填充) 绘图.fillStyle(色值, 0.14 * 透明度).fillRoundedRect(x + 内缩, y + 内缩, 宽, 宽, r);
  const 点色 = 亮色(色值, 0.55);
  const 点距 = Math.max(3, 格 * 0.18);
  const 数 = Math.max(2, Math.round((宽 - r * 2) / 点距));
  绘图.fillStyle(点色, 0.75 * 透明度);
  for (let 序 = 0; 序 <= 数; 序 += 1) {
    const t = x + 内缩 + r + ((宽 - r * 2) * 序) / 数;
    const s = y + 内缩 + r + ((宽 - r * 2) * 序) / 数;
    const 点 = Math.max(0.7, 格 * 0.035);
    绘图.fillCircle(t, y + 内缩, 点).fillCircle(t, y + 内缩 + 宽, 点);
    绘图.fillCircle(x + 内缩, s, 点).fillCircle(x + 内缩 + 宽, s, 点);
  }
  绘图
    .lineStyle(Math.max(1, 格 * 0.04), 点色, 0.32 * 透明度)
    .strokeRoundedRect(x + 内缩, y + 内缩, 宽, 宽, r);
}
