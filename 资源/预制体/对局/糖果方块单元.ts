import type { 图形对象, 点 } from "../../../.gamemaker/依赖/框架/界面/绘制/协议";
import { 亮色 } from "../../../.gamemaker/依赖/框架/界面/颜色工具";
import type { 方块类型 } from "../../../代码/玩法/再消一行";
import { 构建几何, type 格位, 画并块外形, type 糖果块几何 } from "./方块/几何";
import { 绘制奶茶 } from "./方块/奶茶";
import { 绘制巧克力 } from "./方块/巧克力";
import { 绘制拐棍糖 } from "./方块/拐棍糖";
import { 绘制棒棒糖 } from "./方块/棒棒糖";
import { 绘制蛋挞 } from "./方块/蛋挞";

/**
 * 糖果方块：同一颗糖的相邻格熔成一整颗，交给对应糖果模块去画。
 *
 * 七型包成五款糖：O 巧克力、I 蛋挞、T 棒棒糖、L/J 拐棍糖（镜像换口味）、
 * Z/S 奶茶（镜像换口味）。消除后剩下的零散格会自然拆成更小的糖，
 * 只剩一格时走「单格体」——每个模块自己把整块糖收成一小颗。
 *
 * 与旧版的区别：不再逐格画果冻再熔，而是把整组格交给模块按包围盒造型；
 * 相邻但不成整块糖的（例如两块同型糖贴在一起）也会被当成一颗更大的糖画出来。
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
 * 同型同色且四邻相接的格归成一颗糖。
 *
 * 每颗糖最多收 4 格：一颗方块本来就只有 4 格，两块同型糖贴在一起时按 4 格切开，
 * 棋盘上读到的是两颗并排的糖，而不是一颗被拉长的怪糖（也不会把绘制模块逼进退化形状）。
 */
const 每颗最多格 = 4;

function 分块(格列表: readonly 果冻格[]): 果冻格[][] {
  const 索引 = new Map<string, 果冻格>();
  for (const 项 of 格列表) 索引.set(`${项.列},${项.行}`, 项);
  const 已访 = new Set<string>();
  const 结果: 果冻格[][] = [];
  // 同一格重复传进来（理论上不该有）会让几何退化，这里先按格去重。
  for (const 起 of 索引.values()) {
    const 起键 = `${起.列},${起.行}`;
    if (已访.has(起键)) continue;
    const 块: 果冻格[] = [];
    const 队: 果冻格[] = [起];
    已访.add(起键);
    while (队.length > 0 && 块.length < 每颗最多格) {
      const 当前 = 队.pop() as 果冻格;
      块.push(当前);
      for (const [横, 纵] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ] as const) {
        const 键 = `${当前.列 + 横},${当前.行 + 纵}`;
        const 邻 = 索引.get(键);
        if (!邻 || 已访.has(键)) continue;
        if (邻.类型 !== 当前.类型 || 邻.色值 !== 当前.色值) continue;
        if (块.length + 队.length >= 每颗最多格) continue;
        已访.add(键);
        队.push(邻);
      }
    }
    结果.push(块);
  }
  return 结果;
}

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

function 画一颗(
  绘图: 图形对象,
  原点X: number,
  原点Y: number,
  格: number,
  格位: readonly 格位[],
  类型: 方块类型,
  透明度: number,
): void {
  const 几何 = 构建几何(原点X, 原点Y, 格, 格位, 类型, 透明度);
  绘制表[类型](净化图形(绘图, 格), 几何);
}

/**
 * 画一组糖果格（棋盘上全部已落格、当前块或预览块）。
 * 原点是第 0 列第 0 行格子的左上角。
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
  for (const 块 of 分块(格列表)) {
    const 类型 = 块[0]?.类型 ?? "O";
    画一颗(
      绘图,
      原点X,
      原点Y,
      格,
      块.map((项) => ({ 列: 项.列, 行: 项.行 })),
      类型,
      透明度,
    );
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
  画一颗(绘图, x, y, 格, [{ 列: 0, 行: 0 }], 类型 ?? "O", 透明度);
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

/** 纯配方兜底：某类型还没有专属画法时，用并块外形铺主色。 */
export function 绘制通用糖果(绘图: 图形对象, 几何: 糖果块几何): void {
  const 面: readonly 点[][] = 画并块外形(绘图, 几何);
  void 面;
}
