import type { 图形对象, 点 } from "../../../../.gamemaker/依赖/框架/界面/绘制/协议";
import { 同角, 圆角多边形, 裁进凸形, type 边界 } from "../../基础/装饰与蒙层/圆角裁剪";
import { 暗侧, type 格位, type 糖果块几何 } from "./几何";

/**
 * 奶茶（Z / S 型，互为镜像）：下面那条 2 格是杯子，上面那条 2 格是一根弯吸管。
 *
 * 形状全部从格集推：两条 2 格糖条里靠下的是杯，另一条是管；Z 的吸管从左上伸进来、
 * S 从右上，镜像由「杯心落在管身的哪一侧」自然得出，横竖两种朝向共用一套推导。
 * 换口味只换样式表里的颜色（Z 鲜橙水果茶 / S 蓝莓气泡），这里不认口味。
 *
 * 相邻同型奶茶格会被并成一大块（两块 Z 叠在一起就是 8 格），这时按同样的 Z/S 关系
 * 逐对拆开，一杯一根管地画，而不是把零头都算到一根巨型吸管上。
 *
 * 残缺格（消行之后）：
 * - 三格：杯 + 一小段管；
 * - 两格：只画杯——两格糖条在几何里已经丢掉「原来哪两格是杯、哪两格是管」，
 *   杯和管无从区分，按「只剩杯子」处理，画完整一只杯而不是半截吸管；
 * - 一格：迷你杯，只画杯口奶盖与液面。
 *
 * 只用纯色 + 透明度，不用渐变；所有花纹都按世界坐标算多边形，不依赖裁剪 API。
 */

/** 一格为 25px 时的比例，按格宽推，保证主战场读得出杯口与弯管。 */
const 缝比 = 0.06;
const 描比 = 0.06;
const 管宽比 = 0.33;
/** 吸管穿过杯口后往液面下沉多少格。 */
const 入杯比 = 0.42;
/** 沿管身一道条纹的宽度（格）。 */
const 管纹比 = 0.24;

/** 一格集在包围盒坐标系里的世界矩形。 */
interface 框 {
  左: number;
  上: number;
  右: number;
  下: number;
  宽: number;
  高: number;
  中心X: number;
  中心Y: number;
}

/** 一根弯吸管：从杯外伸进来，在拐点拐一次弯，插进杯口的液面下。 */
interface 弯管路径 {
  起: 点;
  拐: 点;
  止: 点;
}

export function 绘制奶茶(绘图: 图形对象, 几何: 糖果块几何): void {
  const 剩余 = new Map<string, 格位>();
  for (const 形 of 几何.格外形) {
    const 位 = { 列: 形.列, 行: 形.行 };
    剩余.set(键(位), 位);
  }

  // 一颗糖 = 一只杯 + 一根管。相邻同型奶茶格会被并成一大块，
  // 这时按 Z/S 关系逐对拆开，各画各的一杯，而不是一只小杯配一根巨型吸管。
  while (剩余.size > 0) {
    const 杯条 = 找最低糖条([...剩余.values()]);
    if (!杯条) {
      // 剩下的格凑不出糖条（孤格、十字块）：整块当一只杯收掉
      const 剩 = [...剩余.values()];
      画杯(绘图, 几何, 取框(几何, 剩), 几何.透明度);
      return;
    }
    const 成对 = 配管(杯条, 剩余);
    for (const 位 of 杯条.格) 剩余.delete(键(位));
    if (成对) {
      for (const 位 of 成对) 剩余.delete(键(位));
    }
    // 残块里杯和管分不出来时，剩下的零头当一小截管（≤2 格）
    const 管格 = 成对 ?? (剩余.size <= 2 ? [...剩余.values()] : []);
    for (const 位 of 管格) 剩余.delete(键(位));

    const 杯框 = 取框(几何, 杯条.格);
    画杯(绘图, 几何, 杯框, 几何.透明度);
    if (管格.length > 0) {
      画吸管(绘图, 几何, 取管路径(几何, 取框(几何, 管格), 杯框), 几何.透明度);
    }
  }
}

/* ------------------------------------------------------------------ */
/* 拆分：哪两格是杯、哪两格是管                                          */
/* ------------------------------------------------------------------ */

function 键(位: 格位): string {
  return `${位.列},${位.行}`;
}

/** 糖条：并块里连续的 2 格，横排或竖排。 */
interface 糖条 {
  格: 格位[];
  横: boolean;
}

/** 找最靠下的那条 2 格糖条；Z/S 的杯永远是靠下的那条。 */
function 找最低糖条(格集: readonly 格位[]): 糖条 | undefined {
  const 行表 = new Map<number, 格位[]>();
  const 列表 = new Map<number, 格位[]>();
  for (const 位 of 格集) {
    行表.set(位.行, [...(行表.get(位.行) ?? []), 位]);
    列表.set(位.列, [...(列表.get(位.列) ?? []), 位]);
  }
  const 候选: 糖条[] = [];
  for (const 排 of 行表.values()) if (排.length === 2) 候选.push({ 格: 排, 横: true });
  for (const 列 of 列表.values()) {
    if (列.length !== 2) continue;
    const 行们 = 列.map((位) => 位.行).sort((甲, 乙) => 甲 - 乙);
    if ((行们[1] ?? 0) - (行们[0] ?? 0) !== 1) continue;
    候选.push({ 格: 列, 横: false });
  }
  if (候选.length === 0) return undefined;
  const 行平均 = (条: 糖条) => 条.格.reduce((和, 位) => 和 + 位.行, 0) / 条.格.length;
  // 靠下的优先；同样高时横条优先，横排 Z/S 的杯就是横条
  候选.sort((甲, 乙) => 行平均(乙) - 行平均(甲) || Number(乙.横) - Number(甲.横));
  return 候选[0];
}

/** 找与杯条成 Z/S 关系的那条 2 格管：错开一格、贴在杯条上沿。 */
function 配管(杯: 糖条, 剩余: ReadonlyMap<string, 格位>): 格位[] | undefined {
  const 列们 = 杯.格.map((位) => 位.列);
  const 行们 = 杯.格.map((位) => 位.行);
  const 在 = (位: 格位) => 剩余.has(键(位));
  if (杯.横) {
    const 行 = 行们[0] ?? 0;
    const 起列 = Math.min(...列们);
    for (const 偏 of [-1, 1]) {
      const 候选 = [
        { 列: 起列 + 偏, 行: 行 - 1 },
        { 列: 起列 + 偏 + 1, 行: 行 - 1 },
      ];
      if (候选.every(在)) return 候选;
    }
    return undefined;
  }
  const 列 = 列们[0] ?? 0;
  const 起行 = Math.min(...行们);
  for (const 偏 of [-1, 1]) {
    const 候选 = [
      { 列: 列 + 偏, 行: 起行 - 1 },
      { 列: 列 + 偏, 行: 起行 },
    ];
    if (候选.every(在)) return 候选;
  }
  return undefined;
}

function 取框(几何: 糖果块几何, 格集: readonly 格位[]): 框 {
  let 左 = Number.POSITIVE_INFINITY;
  let 上 = Number.POSITIVE_INFINITY;
  let 右 = Number.NEGATIVE_INFINITY;
  let 下 = Number.NEGATIVE_INFINITY;
  for (const 位 of 格集) {
    左 = Math.min(左, 几何.左 + 位.列 * 几何.格);
    上 = Math.min(上, 几何.上 + 位.行 * 几何.格);
    右 = Math.max(右, 几何.左 + (位.列 + 1) * 几何.格);
    下 = Math.max(下, 几何.上 + (位.行 + 1) * 几何.格);
  }
  return { 左, 上, 右, 下, 宽: 右 - 左, 高: 下 - 上, 中心X: (左 + 右) / 2, 中心Y: (上 + 下) / 2 };
}

/* ------------------------------------------------------------------ */
/* 吸管                                                                */
/* ------------------------------------------------------------------ */

/**
 * 管的走向：沿管身从杯外一端走到杯心正上方（或正侧方），再拐一次弯插进杯口。
 * 横管在杯上方 → 先横后竖；竖管在杯侧边 → 先竖后横。两段互相垂直，拐弯读得出来。
 */
function 取管路径(几何: 糖果块几何, 管框: 框, 杯框: 框): 弯管路径 {
  const 格 = 几何.格;
  const 半 = (格 * 管宽比) / 2;
  const 液面 = 杯框.上 + 格 * 入杯比;

  if (管框.宽 >= 管框.高) {
    const 向左 = 杯框.中心X >= 管框.中心X;
    const 拐 = { x: 夹(杯框.中心X, 管框.左, 管框.右), y: 管框.中心Y };
    const 起 = { x: 向左 ? 管框.左 + 半 : 管框.右 - 半, y: 管框.中心Y };
    // 拐点必须压到管身下方：残缺格里的杯口可能与管身齐平，仍要往下探一截
    return { 起, 拐, 止: { x: 拐.x, y: Math.max(液面, 拐.y + 格 * 0.22) } };
  }

  const 拐 = { x: 管框.中心X, y: 夹(液面, 管框.上, 管框.下) };
  const 起 = { x: 管框.中心X, y: 管框.上 + 半 };
  return { 起, 拐, 止: { x: 杯框.中心X, y: 拐.y } };
}

/** 画一根弯吸管：先描边再铺条纹，拐点由两段圆头胶囊叠成圆角。 */
function 画吸管(绘图: 图形对象, 几何: 糖果块几何, 路径: 弯管路径, 透明度: number): void {
  const 格 = 几何.格;
  const { 主色, 深色, 装饰 } = 几何.样式;
  const 描 = Math.max(0.8, 格 * 0.05);
  const 管宽 = 格 * 管宽比;
  const 段们 = [
    { 起: 路径.起, 止: 路径.拐 },
    { 起: 路径.拐, 止: 路径.止 },
  ];

  // ① 管影：整根管子往下错一点，压在糖面上不飘
  const 影移 = 格 * 0.08;
  绘图.fillStyle(0x1c0a08, 0.24 * 透明度);
  for (const 段 of 段们) {
    绘图.fillPoints(
      圆头带({ x: 段.起.x, y: 段.起.y + 影移 }, { x: 段.止.x, y: 段.止.y + 影移 }, 管宽),
      true,
    );
  }

  // ② 深色管边：两段各描一圈，合起来就是整根弯管的外轮廓
  绘图.fillStyle(深色, 透明度);
  for (const 段 of 段们) 绘图.fillPoints(圆头带(段.起, 段.止, 管宽 + 描 * 2), true);

  // ③ 管身：奶油白底
  const 管身 = 段们.map((段) => 圆头带(段.起, 段.止, 管宽));
  绘图.fillStyle(装饰, 透明度);
  for (const 形 of 管身) 绘图.fillPoints(形, true);

  // ④ 沿管身交替的主色条纹，两段各自按管轴铺，拐弯处自然接上
  const 斑宽 = 格 * 管纹比;
  for (let 序 = 0; 序 < 段们.length; 序 += 1) {
    const 形 = 管身[序];
    if (形) 画管纹(绘图, 段们[序], 形, 管宽, 斑宽, 主色, 透明度);
  }

  // ⑤ 管口一点浅色高光，读作圆管而不是扁带（纯色，不用渐变）
  绘图.fillStyle(装饰, 0.4 * 透明度);
  绘图.fillCircle(路径.止.x, 路径.止.y, Math.max(0.8, 管宽 * 0.13));
}

/** 沿一段管身铺条纹：垂直于管轴的窄带，裁进管身凸形后填主色。 */
function 画管纹(
  绘图: 图形对象,
  段: { 起: 点; 止: 点 },
  管身: readonly 点[],
  管宽: number,
  斑宽: number,
  主色: number,
  透明度: number,
): void {
  const dx = 段.止.x - 段.起.x;
  const dy = 段.止.y - 段.起.y;
  const 长 = Math.hypot(dx, dy);
  if (长 < 斑宽) return;
  const ux = dx / 长;
  const uy = dy / 长;
  const 半 = 管宽 / 2;
  const 道数 = Math.floor(长 / 斑宽);
  for (let 道 = 1; 道 < 道数; 道 += 2) {
    const 起T = 道 * 斑宽;
    const 止T = 起T + 斑宽;
    const 带: 点[] = [
      { x: 段.起.x + ux * 起T - uy * 半, y: 段.起.y + uy * 起T + ux * 半 },
      { x: 段.起.x + ux * 止T - uy * 半, y: 段.起.y + uy * 止T + ux * 半 },
      { x: 段.起.x + ux * 止T + uy * 半, y: 段.起.y + uy * 止T - ux * 半 },
      { x: 段.起.x + ux * 起T + uy * 半, y: 段.起.y + uy * 起T - ux * 半 },
    ];
    const 形 = 裁进凸形(带, 管身);
    if (形.length < 3) continue;
    绘图.fillStyle(主色, 透明度);
    绘图.fillPoints(形, true);
  }
}

/** 圆头胶囊：一段粗线加两端半圆，顺时针凸多边形，可直接喂 `裁进凸形`。 */
function 圆头带(起: 点, 止: 点, 宽: number): 点[] {
  const 半 = 宽 / 2;
  const dx = 止.x - 起.x;
  const dy = 止.y - 起.y;
  const 角 = Math.atan2(dy, dx);
  const 段 = 5;
  const 点集: 点[] = [];
  if (Math.hypot(dx, dy) < 0.01) {
    for (let i = 0; i <= 12; i += 1) {
      const t = 角 - Math.PI / 2 + (Math.PI * 2 * i) / 12;
      点集.push({ x: 起.x + Math.cos(t) * 半, y: 起.y + Math.sin(t) * 半 });
    }
    return 点集;
  }
  const 横 = Math.cos(角);
  const 纵 = Math.sin(角);
  点集.push({ x: 起.x + 纵 * 半, y: 起.y - 横 * 半 });
  点集.push({ x: 止.x + 纵 * 半, y: 止.y - 横 * 半 });
  for (let i = 1; i < 段; i += 1) {
    const t = 角 - Math.PI / 2 + (Math.PI * i) / 段;
    点集.push({ x: 止.x + Math.cos(t) * 半, y: 止.y + Math.sin(t) * 半 });
  }
  点集.push({ x: 止.x - 纵 * 半, y: 止.y + 横 * 半 });
  点集.push({ x: 起.x - 纵 * 半, y: 起.y + 横 * 半 });
  for (let i = 1; i < 段; i += 1) {
    const t = 角 + Math.PI / 2 + (Math.PI * i) / 段;
    点集.push({ x: 起.x + Math.cos(t) * 半, y: 起.y + Math.sin(t) * 半 });
  }
  return 点集;
}

/* ------------------------------------------------------------------ */
/* 杯子                                                                */
/* ------------------------------------------------------------------ */

/**
 * 圆角杯身：深色杯边 → 暗色杯壁 → 主色饮料 → 液面浅色带 → 冰块 → 果片 → 奶盖 → 杯底暗边。
 * 横杯（2 格宽 1 格高）和竖杯（1 格宽 2 格高）共用一套比例，按「内胆哪边更长」换装饰位置。
 */
function 画杯(绘图: 图形对象, 几何: 糖果块几何, 框: 框, 透明度: number): void {
  const 格 = 几何.格;
  const { 主色, 深色, 浅色, 装饰, 装饰深 } = 几何.样式;
  const 体暗 = 暗侧(几何.样式);
  const 缝 = Math.max(0.6, 格 * 缝比);
  const 描 = Math.max(0.9, 格 * 描比);
  const 边: 边界 = { 左: 框.左 + 缝, 上: 框.上 + 缝, 右: 框.右 - 缝, 下: 框.下 - 缝 };
  const 宽 = 边.右 - 边.左;
  const 高 = 边.下 - 边.上;
  const 圆 = Math.min(宽, 高) * 0.32;

  // ① 落影
  绘图.fillStyle(0x1c0a08, 0.3 * 透明度);
  绘图.fillPoints(
    圆角多边形({ 左: 边.左, 上: 边.上 + 格 * 0.09, 右: 边.右, 下: 边.下 + 格 * 0.09 }, 同角(圆)),
    true,
  );

  // ② 深色杯边
  绘图.fillStyle(深色, 透明度);
  绘图.fillPoints(圆角多边形(边, 同角(圆)), true);

  // ③ 杯壁暗圈 + 饮料
  const 内: 边界 = { 左: 边.左 + 描, 上: 边.上 + 描, 右: 边.右 - 描, 下: 边.下 - 描 };
  const 内宽 = 内.右 - 内.左;
  const 内高 = 内.下 - 内.上;
  绘图.fillStyle(体暗, 透明度);
  绘图.fillPoints(圆角多边形(内, 同角(Math.max(1, 圆 - 描))), true);
  const 液: 边界 = {
    左: 内.左 + 内宽 * 0.05,
    上: 内.上,
    右: 内.右 - 内宽 * 0.05,
    下: 内.下 - 内高 * 0.03,
  };
  const 液形 = 圆角多边形(液, 同角(Math.max(1, 圆 - 描 * 1.6)));
  绘图.fillStyle(主色, 透明度);
  绘图.fillPoints(液形, true);

  // ④ 液面：贴着杯口的一条浅色带
  绘图.fillStyle(浅色, 0.42 * 透明度);
  绘图.fillPoints(
    裁进凸形(
      [
        { x: 液.左 - 1, y: 液.上 - 1 },
        { x: 液.右 + 1, y: 液.上 - 1 },
        { x: 液.右 + 1, y: 内.上 + 内高 * 0.34 },
        { x: 液.左 - 1, y: 内.上 + 内高 * 0.34 },
      ],
      液形,
    ),
    true,
  );

  // ⑤ 冰块（装饰色半透明块）与果片：一格迷你杯太挤，只留奶盖与液面
  const 迷你 = 宽 < 格 * 1.5 && 高 < 格 * 1.5;
  if (!迷你) {
    const 冰 = Math.min(内宽, 内高) * 0.34;
    const 冰位: readonly (readonly [number, number])[] =
      内宽 >= 内高
        ? [
            [0.26, 0.6],
            [0.44, 0.78],
          ]
        : [
            [0.5, 0.38],
            [0.42, 0.52],
          ];
    for (const [u, v] of 冰位) {
      绘图.fillStyle(装饰, 0.5 * 透明度);
      绘图.fillRoundedRect(内.左 + 内宽 * u - 冰 / 2, 内.上 + 内高 * v - 冰 / 2, 冰, 冰, 冰 * 0.3);
    }
    const 果R = Math.min(内宽, 内高) * 0.3;
    const 果位: readonly [number, number] = 内宽 >= 内高 ? [0.74, 0.62] : [0.42, 0.62];
    画果片(绘图, 内.左 + 内宽 * 果位[0], 内.上 + 内高 * 果位[1], 果R, 装饰, 装饰深, 透明度);
  }

  // ⑥ 奶盖：压在最上面，下沿带点起伏，读作一杯加奶盖的饮料
  const 盖底 = 内.上 + 内高 * 0.24;
  const 波: 点[] = [
    { x: 液.左 - 1, y: 内.上 - 1 },
    { x: 液.右 + 1, y: 内.上 - 1 },
  ];
  for (let i = 0; i <= 8; i += 1) {
    const t = 1 - i / 8;
    波.push({ x: 液.左 + (液.右 - 液.左) * t, y: 盖底 + Math.sin(t * Math.PI * 3) * 内高 * 0.035 });
  }
  const 盖形 = 裁进凸形(波, 液形);
  if (盖形.length >= 3) {
    绘图.fillStyle(装饰, 0.86 * 透明度);
    绘图.fillPoints(盖形, true);
  }

  // ⑦ 杯底一条暗边
  const 底形 = 裁进凸形(
    [
      { x: 液.左 - 1, y: 内.下 - 内高 * 0.16 },
      { x: 液.右 + 1, y: 内.下 - 内高 * 0.16 },
      { x: 液.右 + 1, y: 液.下 + 1 },
      { x: 液.左 - 1, y: 液.下 + 1 },
    ],
    液形,
  );
  if (底形.length >= 3) {
    绘图.fillStyle(深色, 0.5 * 透明度);
    绘图.fillPoints(底形, true);
  }

  // ⑧ 杯身左侧一道浅色反光
  绘图.fillStyle(浅色, 0.22 * 透明度);
  绘图.fillRoundedRect(
    内.左 + 内宽 * 0.1,
    内.上 + 内高 * 0.3,
    Math.max(1.2, 内宽 * 0.06),
    内高 * 0.36,
    Math.max(0.6, 内宽 * 0.03),
  );
}

/** 果片：一小片圆片，外圈装饰深、内芯装饰色，再压几道瓣。 */
function 画果片(
  绘图: 图形对象,
  cx: number,
  cy: number,
  半径: number,
  装饰: number,
  装饰深: number,
  透明度: number,
): void {
  if (半径 < 1.6) return;
  绘图.fillStyle(装饰深, 透明度);
  绘图.fillCircle(cx, cy, 半径);
  绘图.fillStyle(装饰, 透明度);
  绘图.fillCircle(cx, cy, 半径 * 0.86);
  绘图.fillStyle(装饰深, 0.8 * 透明度);
  for (let 瓣 = 0; 瓣 < 6; 瓣 += 1) {
    const 角 = (Math.PI / 3) * 瓣 + Math.PI / 6;
    const 点集: 点[] = [{ x: cx, y: cy }];
    for (let k = -1; k <= 1; k += 1) {
      const a = 角 + k * 0.05;
      点集.push({ x: cx + Math.cos(a) * 半径 * 0.8, y: cy + Math.sin(a) * 半径 * 0.8 });
    }
    绘图.fillPoints(点集, true);
  }
}

function 夹(值: number, 下限: number, 上限: number): number {
  return Math.min(Math.max(值, 下限), 上限);
}
