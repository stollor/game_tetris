import type { 图形对象 } from "../../../../.gamemaker/依赖/框架/界面/绘制/协议";
import { 亮色 } from "../../../../.gamemaker/依赖/框架/界面/颜色工具";
import { 糖果规范 } from "../../../主题/糖果/糖果规范";

/**
 * 糖果主题的装饰花纹原语：扇贝花边、奶油裱花线、糖纸条纹、糖粒与蝴蝶结。
 *
 * 只依赖 `图形对象` 与 `糖果规范`，不读设置/场景，供面板、按钮、背景与商店共用。
 * 位置一律按调用方给的矩形/边算，不在这里假设任何布局。
 */

/** 沿矩形一条边画双层扇贝花边：深色垫底一步、奶油色压上，读作鼓起来的糖纸口。 */
export function 绘制扇贝边(
  绘图: 图形对象,
  左: number,
  上: number,
  宽: number,
  色: number,
  透明度 = 1,
  朝向: "上" | "下" | "左" | "右" = "上",
  半径: number = 糖果规范.花边.半径,
  步长: number = 糖果规范.花边.步长,
  阴影色?: number,
): void {
  const 纵向 = 朝向 === "左" || 朝向 === "右";
  const 数量 = Math.max(1, Math.floor(宽 / 步长));
  const 间距 = 宽 / 数量;
  const 半径值 = Math.min(半径, 间距 / 2);
  const 外移 = 朝向 === "上" || 朝向 === "左" ? -1.6 : 1.6;
  const 圆心 = (序: number, 垫: number): [number, number] =>
    纵向 ? [左 + 垫, 上 + 间距 * (序 + 0.5)] : [左 + 间距 * (序 + 0.5), 上 + 垫];
  绘图.fillStyle(阴影色 ?? 糖果规范.色.草莓深, 阴影色 === undefined ? 0.35 * 透明度 : 透明度);
  for (let 序 = 0; 序 < 数量; 序 += 1) {
    const [x, y] = 圆心(序, 外移);
    绘图.fillCircle(x, y, 半径值);
  }
  绘图.fillStyle(色, 透明度);
  for (let 序 = 0; 序 < 数量; 序 += 1) {
    const [x, y] = 圆心(序, 0);
    绘图.fillCircle(x, y, 半径值);
  }
  // 每颗扇贝朝外的奶油高光：让花边有鼓起的厚度。
  绘图.fillStyle(0xffffff, 0.22 * 透明度);
  for (let 序 = 0; 序 < 数量; 序 += 1) {
    const [x, y] = 圆心(序, 0);
    const 高光移 = 半径值 * 0.28;
    绘图.fillCircle(
      纵向 ? x + (朝向 === "左" ? -高光移 : 高光移) : x,
      纵向 ? y : y + (朝向 === "上" ? -高光移 : 高光移),
      半径值 * 0.42,
    );
  }
}

/** 矩形四边内侧的奶油裱花线：外粗内细两条圆角描边，角上点四个带高光的糖钉。 */
export function 绘制奶油内衬(
  绘图: 图形对象,
  左: number,
  上: number,
  宽: number,
  高: number,
  圆角: number,
  描边色: number,
  透明度 = 0.55,
  铆钉 = true,
): void {
  const 缩 = 糖果规范.描边.内 + 1;
  const 内宽 = Math.max(0, 宽 - 缩 * 2);
  const 内高 = Math.max(0, 高 - 缩 * 2);
  const 圆 = Math.max(1, 圆角 - 缩);
  // 深色垫线让奶油线压在糖面上更立体。
  绘图.lineStyle(糖果规范.描边.奶油 + 1.2, 糖果规范.色.巧克力深, 0.3 * 透明度);
  绘图.strokeRoundedRect(左 + 缩, 上 + 缩, 内宽, 内高, 圆);
  绘图.lineStyle(糖果规范.描边.奶油, 描边色, 0.92 * 透明度);
  绘图.strokeRoundedRect(左 + 缩, 上 + 缩, 内宽, 内高, 圆);
  绘图.lineStyle(1, 0xffffff, 0.35 * 透明度);
  绘图.strokeRoundedRect(
    左 + 缩 + 1.2,
    上 + 缩 + 1.2,
    内宽 - 2.4,
    内高 - 2.4,
    Math.max(1, 圆 - 1.2),
  );
  if (!铆钉) return;
  const 半径 = 糖果规范.面板.铆钉半径;
  for (const [x, y] of [
    [左 + 缩 + 半径, 上 + 缩 + 半径],
    [左 + 宽 - 缩 - 半径, 上 + 缩 + 半径],
    [左 + 缩 + 半径, 上 + 高 - 缩 - 半径],
    [左 + 宽 - 缩 - 半径, 上 + 高 - 缩 - 半径],
  ]) {
    绘图.fillStyle(糖果规范.色.巧克力深, 0.35 * 透明度).fillCircle(x, y + 0.8, 半径);
    绘图.fillStyle(描边色, 透明度).fillCircle(x, y, 半径);
    绘图
      .fillStyle(0xffffff, 0.55 * 透明度)
      .fillCircle(x - 半径 * 0.28, y - 半径 * 0.3, 半径 * 0.34);
  }
}

/** 顶部奶油高光带：上浓下淡的横向糖衣反光，两端收圆。 */
export function 绘制糖衣高光(
  绘图: 图形对象,
  左: number,
  上: number,
  宽: number,
  高: number,
  圆角: number,
  透明度 = 糖果规范.面板.高光透明度,
): void {
  // 高光带最高不超过一条软带的高度：高面板（暂停/结算）否则会糊出一大块浅色矩形。
  const 带高 = Math.min(高 * 糖果规范.面板.高光占比, 26);
  if (带高 < 2 || 宽 < 12) return;
  const 白 = 糖果规范.色.白;
  绘图
    .fillGradientStyle(白, 白, 白, 白, 透明度 * 1.5, 透明度 * 1.2, 0, 0)
    .fillRoundedRect(左 + 3, 上 + 2.5, 宽 - 6, 带高, Math.max(2, Math.min(圆角, 带高) * 0.7));
  绘图
    .fillStyle(白, 透明度 * 2.1)
    .fillRoundedRect(
      左 + 3 + 宽 * 0.1,
      上 + 2.5,
      Math.min(宽 * 0.34, 84),
      Math.max(1.6, 带高 * 0.34),
      2,
    );
}

/**
 * 斜条纹，不铺底色。条宽跟规范走，不跟矩形高度走：
 * 整块棋盘框若按高度取条宽，会糊成一条色带。
 */
export function 绘制斜纹(
  绘图: 图形对象,
  左: number,
  上: number,
  宽: number,
  高: number,
  条纹色: number,
  透明度 = 1,
): void {
  const 条纹宽 = 糖果规范.条纹.宽;
  const 斜 = 糖果规范.条纹.斜;
  绘图.fillStyle(条纹色, 透明度);
  for (let x = 左 - 斜; x < 左 + 宽 + 斜; x += 条纹宽 * 2)
    绘图.fillPoints(
      [
        { x, y: 上 },
        { x: x + 条纹宽, y: 上 },
        { x: x + 条纹宽 - 斜, y: 上 + 高 },
        { x: x - 斜, y: 上 + 高 },
      ],
      true,
    );
}

/** 斜条纹糖纸条：先铺底，再压斜纹。 */
export function 绘制斜纹糖纸(
  绘图: 图形对象,
  左: number,
  上: number,
  宽: number,
  高: number,
  底色: number,
  条纹色: number,
  透明度 = 1,
): void {
  绘图.fillStyle(底色, 透明度).fillRect(左, 上, 宽, 高);
  绘制斜纹(绘图, 左, 上, 宽, 高, 条纹色, 0.92 * 透明度);
}

/**
 * 与世界坐标对齐的斜纹，裁在矩形内。相邻格子用同一周期，条纹才能接成一根糖。
 * 带的方向是 x − y 为常数，视觉上从左上斜到右下。
 */
export function 绘制世界斜纹(
  绘图: 图形对象,
  左: number,
  上: number,
  宽: number,
  高: number,
  色: number,
  透明度: number,
  周期 = 糖果规范.方块.斜纹周期,
  条宽 = 糖果规范.方块.斜纹宽,
): void {
  if (宽 < 2 || 高 < 2 || 周期 <= 0 || 条宽 <= 0) return;
  const 右 = 左 + 宽;
  const 下 = 上 + 高;
  const 最小 = 左 - 下;
  const 最大 = 右 - 上;
  const 起点 = Math.floor(最小 / 周期) * 周期;
  绘图.fillStyle(色, 透明度);
  for (let s = 起点; s < 最大; s += 周期) {
    const 点集 = 斜带交矩形(左, 上, 右, 下, s, s + 条宽);
    if (点集.length >= 3) 绘图.fillPoints(点集, true);
  }
}

/** 两条平行线 x − y = s0 / s1 与轴对齐矩形的交，结果是凸多边形。 */
function 斜带交矩形(
  左: number,
  上: number,
  右: number,
  下: number,
  s0: number,
  s1: number,
): { x: number; y: number }[] {
  const 在带内 = (x: number, y: number) => {
    const s = x - y;
    return s >= s0 - 0.05 && s <= s1 + 0.05;
  };
  const 点集: { x: number; y: number }[] = [];
  for (const 点 of [
    { x: 左, y: 上 },
    { x: 右, y: 上 },
    { x: 右, y: 下 },
    { x: 左, y: 下 },
  ])
    if (在带内(点.x, 点.y)) 点集.push(点);
  const 边 = [
    [左, 上, 右, 上],
    [右, 上, 右, 下],
    [右, 下, 左, 下],
    [左, 下, 左, 上],
  ];
  for (const [x1, y1, x2, y2] of 边) {
    const dx = (x2 ?? 0) - (x1 ?? 0);
    const dy = (y2 ?? 0) - (y1 ?? 0);
    const 分母 = dx - dy;
    if (Math.abs(分母) < 1e-6 || x1 === undefined || y1 === undefined) continue;
    for (const s of [s0, s1]) {
      const t = (s - (x1 - y1)) / 分母;
      if (t < -0.001 || t > 1.001) continue;
      点集.push({ x: x1 + dx * t, y: y1 + dy * t });
    }
  }
  const 去重: { x: number; y: number }[] = [];
  for (const 点 of 点集) {
    if (去重.some((已有) => Math.abs(已有.x - 点.x) < 0.35 && Math.abs(已有.y - 点.y) < 0.35))
      continue;
    去重.push(点);
  }
  if (去重.length < 3) return [];
  const 中心X = 去重.reduce((和, 点) => 和 + 点.x, 0) / 去重.length;
  const 中心Y = 去重.reduce((和, 点) => 和 + 点.y, 0) / 去重.length;
  去重.sort(
    (甲, 乙) => Math.atan2(甲.y - 中心Y, 甲.x - 中心X) - Math.atan2(乙.y - 中心Y, 乙.x - 中心X),
  );
  return 去重;
}

/**
 * 糖纸扭结：从糖身一端收窄、再张开的扇形糖纸，末端两道锯齿，面上三道褶。
 * 根X 是糖身端点，向 1 朝右长、−1 朝左长；标题糖、硬降糖共用。
 */
export function 绘制糖纸扭结(
  绘图: 图形对象,
  根X: number,
  中心Y: number,
  身高: number,
  向: 1 | -1,
  浅色: number,
  深色: number,
): void {
  const 长 = 身高 * 0.62;
  const 端 = 根X + 向 * 长;
  const 根半 = 身高 * 0.2;
  const 端半 = 身高 * 0.56;
  const 外形 = [
    { x: 根X, y: 中心Y - 根半 },
    { x: 端, y: 中心Y - 端半 },
    { x: 端 - 向 * 长 * 0.18, y: 中心Y - 端半 * 0.5 },
    { x: 端, y: 中心Y - 端半 * 0.05 },
    { x: 端 - 向 * 长 * 0.18, y: 中心Y + 端半 * 0.42 },
    { x: 端, y: 中心Y + 端半 },
    { x: 根X, y: 中心Y + 根半 },
  ];
  绘图.fillStyle(0x12060a, 0.3).fillPoints(
    外形.map((p) => ({ x: p.x, y: p.y + 3 })),
    true,
  );
  绘图.fillStyle(糖果规范.色.莓暗, 1).fillPoints(
    外形.map((p) => ({ x: p.x + 向 * 1.2, y: p.y + (p.y < 中心Y ? -1.2 : 1.2) })),
    true,
  );
  绘图.fillGradientStyle(浅色, 浅色, 深色, 深色, 1, 1, 1, 1).fillPoints(外形, true);
  绘图.lineStyle(1.1, 深色, 0.75);
  for (const 比 of [-0.55, 0, 0.55])
    绘图.lineBetween(
      根X + 向 * 3,
      中心Y + 根半 * 比 * 0.8,
      端 - 向 * 长 * 0.22,
      中心Y + 端半 * 比 * 0.85,
    );
  绘图
    .fillStyle(0xffffff, 0.4)
    .fillEllipse(根X + 向 * 长 * 0.45, 中心Y - 端半 * 0.45, 长 * 0.4, Math.max(1.6, 身高 * 0.07));
}

/** 斜条纹遮阳篷带（背景顶部与卡片顶边用）：粉白相间的梯形条纹，下缘波浪。 */
export function 绘制条纹篷(
  绘图: 图形对象,
  左: number,
  上: number,
  宽: number,
  高: number,
  浅色: number,
  深色: number,
  扇贝色: number,
): void {
  绘图.fillStyle(深色, 1).fillRect(左, 上, 宽, 高);
  const 条纹宽 = 糖果规范.背景.条纹宽;
  const 斜 = 高 * 0.55;
  绘图.fillStyle(浅色, 0.92);
  for (let x = 左 - 斜; x < 左 + 宽 + 斜; x += 条纹宽 * 2) {
    绘图.fillPoints(
      [
        { x, y: 上 },
        { x: x + 条纹宽, y: 上 },
        { x: x + 条纹宽 - 斜, y: 上 + 高 },
        { x: x - 斜, y: 上 + 高 },
      ],
      true,
    );
  }
  // 下缘波浪：沿整条篷画一排半圆，遮住直边。
  const 半径 = 糖果规范.背景.扇贝半径;
  const 数量 = Math.max(1, Math.round(宽 / (半径 * 2)));
  const 间距 = 宽 / 数量;
  绘图.fillStyle(扇贝色, 1);
  for (let 序 = 0; 序 < 数量; 序 += 1)
    绘图.fillCircle(左 + 间距 * (序 + 0.5), 上 + 高, Math.min(半径, 间距 / 2));
}

/** 一条丝带（两端尖角 + 中间方结），用于标题、缎带与卡片角标。 */
export function 绘制丝带(
  绘图: 图形对象,
  中心X: number,
  中心Y: number,
  宽: number,
  高: number,
  主色: number,
  深色: number,
): void {
  const 半高 = 高 / 2;
  const 尾宽 = 宽 * 0.16;
  绘图.fillStyle(深色, 1).fillRect(中心X - 宽 / 2 + 1, 中心Y - 半高 + 2.5, 宽 - 1, 高);
  绘图.fillStyle(主色, 1).fillRect(中心X - 宽 / 2 + 尾宽, 中心Y - 半高, 宽 - 尾宽 * 2, 高);
  绘图.fillStyle(深色, 1).fillPoints(
    [
      { x: 中心X - 宽 / 2 + 尾宽, y: 中心Y - 半高 },
      { x: 中心X - 宽 / 2, y: 中心Y - 半高 },
      { x: 中心X - 宽 / 2 + 尾宽 * 0.55, y: 中心Y },
      { x: 中心X - 宽 / 2, y: 中心Y + 半高 },
      { x: 中心X - 宽 / 2 + 尾宽, y: 中心Y + 半高 },
    ],
    true,
  );
  绘图.fillStyle(深色, 1).fillPoints(
    [
      { x: 中心X + 宽 / 2 - 尾宽, y: 中心Y - 半高 },
      { x: 中心X + 宽 / 2, y: 中心Y - 半高 },
      { x: 中心X + 宽 / 2 - 尾宽 * 0.55, y: 中心Y },
      { x: 中心X + 宽 / 2, y: 中心Y + 半高 },
      { x: 中心X + 宽 / 2 - 尾宽, y: 中心Y + 半高 },
    ],
    true,
  );
  绘图
    .fillStyle(亮色(主色, 0.2), 0.6)
    .fillRect(中心X - 宽 / 2 + 尾宽, 中心Y - 半高 + 1, 宽 - 尾宽 * 2, 2);
}

/** 一颗糖粒：圆底 + 一点高光；背景与卡片角落的甜点碎屑共用。 */
export function 绘制糖粒(
  绘图: 图形对象,
  中心X: number,
  中心Y: number,
  半径: number,
  色: number,
  透明度 = 1,
  旋转 = 0,
): void {
  绘图.save().translateCanvas(中心X, 中心Y).rotateCanvas(旋转);
  绘图.fillStyle(色, 透明度).fillEllipse(0, 0, 半径 * 2.1, 半径 * 1.4);
  绘图
    .fillStyle(0xffffff, 0.45 * 透明度)
    .fillEllipse(-半径 * 0.35, -半径 * 0.35, 半径 * 0.7, 半径 * 0.45);
  绘图.restore();
}

/** 蝴蝶结：两个环 + 中心结 + 两条飘带，用于棋盘顶部/卡片顶部。 */
export function 绘制蝴蝶结(
  绘图: 图形对象,
  中心X: number,
  中心Y: number,
  尺寸: number,
  主色: number,
  深色: number,
): void {
  const 半 = 尺寸 / 2;
  const 描 = 糖果规范.色.莓暗;
  const 环 = (方向: number, 外扩: number) => {
    const 点集: { x: number; y: number }[] = [];
    for (let i = 0; i <= 14; i += 1) {
      const t = (i / 14) * Math.PI * 2;
      // 水滴形：靠结一端收尖，外端鼓圆。
      const 鼓 = 0.55 + 0.45 * Math.cos(t / 2) ** 2;
      const rx = (半 * 0.5 + 外扩) * (1 - Math.cos(t)) * 0.95;
      const ry = (半 * 0.42 + 外扩) * Math.sin(t) * 鼓;
      点集.push({ x: 中心X + 方向 * rx, y: 中心Y - 半 * 0.06 + ry });
    }
    return 点集;
  };
  const 飘带 = (方向: number, 外扩: number) => [
    { x: 中心X + 方向 * 半 * 0.08, y: 中心Y + 半 * 0.1 - 外扩 },
    { x: 中心X + 方向 * (半 * 0.72 + 外扩), y: 中心Y + 半 * 1.02 + 外扩 },
    { x: 中心X + 方向 * 半 * 0.5, y: 中心Y + 半 * 0.84 },
    { x: 中心X + 方向 * (半 * 0.3 - 外扩), y: 中心Y + 半 * 1.1 + 外扩 },
  ];
  for (const 方向 of [-1, 1]) {
    绘图.fillStyle(描, 1).fillPoints(飘带(方向, 1.2), true);
    绘图.fillStyle(深色, 1).fillPoints(飘带(方向, 0), true);
  }
  for (const 方向 of [-1, 1]) {
    绘图.fillStyle(0x12060a, 0.3).fillPoints(
      环(方向, 1.2).map((p) => ({ x: p.x, y: p.y + 2 })),
      true,
    );
    绘图.fillStyle(描, 1).fillPoints(环(方向, 1.2), true);
    绘图
      .fillGradientStyle(亮色(主色, 0.18), 亮色(主色, 0.18), 主色, 主色, 1, 1, 1, 1)
      .fillPoints(环(方向, 0), true);
    // 环内折：靠结的一侧压一块深色，读作缎带折进去。
    绘图
      .fillStyle(深色, 0.75)
      .fillEllipse(中心X + 方向 * 半 * 0.32, 中心Y - 半 * 0.02, 半 * 0.34, 半 * 0.3);
    绘图
      .fillStyle(0xffffff, 0.45)
      .fillEllipse(中心X + 方向 * 半 * 0.62, 中心Y - 半 * 0.26, 半 * 0.32, 半 * 0.13);
  }
  绘图
    .fillStyle(描, 1)
    .fillRoundedRect(中心X - 半 * 0.24, 中心Y - 半 * 0.32, 半 * 0.48, 半 * 0.6, 半 * 0.16);
  绘图
    .fillGradientStyle(主色, 主色, 深色, 深色, 1, 1, 1, 1)
    .fillRoundedRect(中心X - 半 * 0.18, 中心Y - 半 * 0.26, 半 * 0.36, 半 * 0.48, 半 * 0.12);
  绘图.fillStyle(0xffffff, 0.5).fillRect(中心X - 半 * 0.1, 中心Y - 半 * 0.2, 半 * 0.08, 半 * 0.26);
}
