import type { 点 } from "../../../../.gamemaker/依赖/框架/界面/绘制/协议";

/** 左上右下四条边，逻辑像素。 */
export interface 边界 {
  左: number;
  上: number;
  右: number;
  下: number;
}

/** 四角各自的圆角半径；0 表示直角。 */
export interface 角半径 {
  左上: number;
  右上: number;
  右下: number;
  左下: number;
}

/** 四角同一半径的简写。 */
export function 同角(半径: number): 角半径 {
  return { 左上: 半径, 右上: 半径, 右下: 半径, 左下: 半径 };
}

/** 四角可分别取半径的圆角矩形折线；顺序为屏幕坐标下的顺时针，结果是凸多边形。 */
export function 圆角多边形(边: 边界, 角: 角半径): 点[] {
  const 宽 = 边.右 - 边.左;
  const 高 = 边.下 - 边.上;
  const 限 = Math.max(0, Math.min(宽, 高) / 2);
  const 点集: 点[] = [];
  const 弧 = (
    半径: number,
    cx: (r: number) => number,
    cy: (r: number) => number,
    起: number,
    角点: 点,
  ) => {
    const r = Math.min(Math.max(0, 半径), 限);
    if (r <= 0.05) {
      点集.push(角点);
      return;
    }
    const 段 = Math.max(3, Math.ceil(r / 1.6));
    for (let i = 0; i <= 段; i += 1) {
      const a = 起 + (Math.PI / 2) * (i / 段);
      点集.push({ x: cx(r) + Math.cos(a) * r, y: cy(r) + Math.sin(a) * r });
    }
  };
  弧(
    角.左上,
    (r) => 边.左 + r,
    (r) => 边.上 + r,
    Math.PI,
    { x: 边.左, y: 边.上 },
  );
  弧(
    角.右上,
    (r) => 边.右 - r,
    (r) => 边.上 + r,
    Math.PI * 1.5,
    { x: 边.右, y: 边.上 },
  );
  弧(
    角.右下,
    (r) => 边.右 - r,
    (r) => 边.下 - r,
    0,
    { x: 边.右, y: 边.下 },
  );
  弧(
    角.左下,
    (r) => 边.左 + r,
    (r) => 边.下 - r,
    Math.PI / 2,
    { x: 边.左, y: 边.下 },
  );
  return 点集;
}

/** 四角向内挖四分之一圆的矩形（票据、名牌形），顺时针；是凹多边形，只能整块填充或描边。 */
export function 内凹角多边形(边: 边界, 凹半径: number): 点[] {
  const n = Math.max(0, Math.min(凹半径, (边.右 - 边.左) / 2, (边.下 - 边.上) / 2));
  const 段 = Math.max(3, Math.ceil(n / 1.6));
  const 点集: 点[] = [];
  const 凹弧 = (cx: number, cy: number, 起: number) => {
    for (let i = 0; i <= 段; i += 1) {
      const a = 起 - (Math.PI / 2) * (i / 段);
      点集.push({ x: cx + Math.cos(a) * n, y: cy + Math.sin(a) * n });
    }
  };
  凹弧(边.左, 边.上, Math.PI / 2);
  凹弧(边.右, 边.上, Math.PI);
  凹弧(边.右, 边.下, Math.PI * 1.5);
  凹弧(边.左, 边.下, 0);
  return 点集;
}

/**
 * Sutherland–Hodgman：把任意多边形裁进一个顺时针凸多边形。
 * 条纹、夹心这类花纹先按世界坐标铺开，再裁进糖面，才能贴着圆角收边。
 */
export function 裁进凸形(主体: readonly 点[], 凸形: readonly 点[]): 点[] {
  let 输出: 点[] = [...主体];
  let 前角 = 凸形[凸形.length - 1];
  for (const 角 of 凸形) {
    if (!前角 || 输出.length === 0) return [];
    const a = 前角;
    const 侧 = (p: 点) => (角.x - a.x) * (p.y - a.y) - (角.y - a.y) * (p.x - a.x);
    const 交点 = (p: 点, q: 点, 甲: number, 乙: number): 点 => {
      const t = 甲 / (甲 - 乙);
      return { x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t };
    };
    const 输入 = 输出;
    输出 = [];
    let 前 = 输入[输入.length - 1];
    for (const 当前 of 输入) {
      if (!前) break;
      const 前侧 = 侧(前);
      const 当前侧 = 侧(当前);
      if (当前侧 >= 0) {
        if (前侧 < 0) 输出.push(交点(前, 当前, 前侧, 当前侧));
        输出.push(当前);
      } else if (前侧 >= 0) 输出.push(交点(前, 当前, 前侧, 当前侧));
      前 = 当前;
    }
    前角 = 角;
  }
  return 输出;
}

/** 斜带：x − y 落在 [起, 起 + 宽] 的平行四边形，纵向覆盖 [上, 下]；从左上斜向右下。 */
export function 斜带(起: number, 宽: number, 上: number, 下: number): 点[] {
  return [
    { x: 起 + 上, y: 上 },
    { x: 起 + 宽 + 上, y: 上 },
    { x: 起 + 宽 + 下, y: 下 },
    { x: 起 + 下, y: 下 },
  ];
}
