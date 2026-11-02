import type { 图形对象, 点 } from "../../../.gamemaker/依赖/框架/界面/绘制/协议";
import { 亮色, 暗色 } from "../../../.gamemaker/依赖/框架/界面/颜色工具";
import type { 方块类型 } from "../../../代码/玩法/再消一行";
import { 糖果规范 } from "../../主题/糖果/糖果规范";
import { 圆角多边形, 斜带, 裁进凸形, type 角半径, type 边界 } from "../基础/装饰与蒙层/圆角裁剪";

/**
 * 整块糖果：同一块糖的相邻格熔成一整颗，只有外露的角倒圆，内凹处补一段圆角；
 * 受光、糖厚和高光按整块的外露边画，竖着叠的格子不会一格一道高光。
 *
 * I 薄荷糖棍、O 夹心威化、T 葡萄球串、S 酸糖砂软糖、Z 草莓果冻、J 蓝莓硬糖、L 橙皮糖条。
 * 只依赖 `图形对象` 与 `糖果规范`；尺寸全部由调用方给的格宽推。
 */

export interface 果冻格 {
  列: number;
  行: number;
  色值: number;
  类型?: 方块类型;
}

interface 邻接 {
  上: boolean;
  下: boolean;
  左: boolean;
  右: boolean;
}

/** 内凹角：两条边各有同块邻格、对角却空着，需要补圆角；方向指向空着的那一角。 */
interface 内凹角 {
  x: number;
  y: number;
  横: 1 | -1;
  纵: 1 | -1;
  底部: boolean;
}

interface 格几何 {
  格: 果冻格;
  单元左: number;
  单元上: number;
  邻: 邻接;
  外: 边界;
  角: 角半径;
  厚: number;
  内凹: 内凹角[];
}

const 规 = 糖果规范.方块;
/** 内凹补角：凹点外侧一块方角减去四分之一圆，外扩时整体沿空角方向平移。 */
function 内凹补角点(凹: 内凹角, 半径: number, 外扩: number): 点[] {
  const px = 凹.x + 凹.横 * 外扩;
  const py = 凹.y + 凹.纵 * 外扩;
  const cx = px + 凹.横 * 半径;
  const cy = py + 凹.纵 * 半径;
  const 起 = Math.atan2(-凹.纵, 0);
  let 差 = Math.atan2(0, -凹.横) - 起;
  if (差 > Math.PI) 差 -= Math.PI * 2;
  if (差 < -Math.PI) 差 += Math.PI * 2;
  const 点集: 点[] = [{ x: px, y: py }];
  for (let i = 0; i <= 6; i += 1) {
    const a = 起 + (差 * i) / 6;
    点集.push({ x: cx + Math.cos(a) * 半径, y: cy + Math.sin(a) * 半径 });
  }
  return 点集;
}

function 外扩边界(边: 边界, 邻: 邻接, 量: number): 边界 {
  return {
    左: 边.左 - (邻.左 ? 0 : 量),
    上: 边.上 - (邻.上 ? 0 : 量),
    右: 边.右 + (邻.右 ? 0 : 量),
    下: 边.下 + (邻.下 ? 0 : 量),
  };
}

function 加角(角: 角半径, 量: number): 角半径 {
  const 加 = (r: number) => (r > 0 ? r + 量 : 0);
  return { 左上: 加(角.左上), 右上: 加(角.右上), 右下: 加(角.右下), 左下: 加(角.左下) };
}

/** 稳定伪随机：同一格每帧撒同样的糖砂。 */
function 散列(列: number, 行: number, 序: number): number {
  const v = Math.sin(列 * 127.1 + 行 * 311.7 + 序 * 74.7) * 43758.5453;
  return v - Math.floor(v);
}

function 计算几何(格列表: readonly 果冻格[], 原点X: number, 原点Y: number, 格: number): 格几何[] {
  const 表 = new Map<string, 果冻格>();
  for (const 项 of 格列表) 表.set(`${项.列},${项.行}`, 项);
  const 同块 = (项: 果冻格, 横: number, 纵: number) => {
    if (项.类型 === "T") return false;
    const 邻格 = 表.get(`${项.列 + 横},${项.行 + 纵}`);
    return !!邻格 && 邻格.类型 === 项.类型 && 邻格.色值 === 项.色值;
  };
  const 缝 = Math.max(0.7, 格 * 规.缝比);
  return 格列表.map((项) => {
    const 单元左 = 原点X + 项.列 * 格;
    const 单元上 = 原点Y + 项.行 * 格;
    const 邻 = {
      上: 同块(项, 0, -1),
      下: 同块(项, 0, 1),
      左: 同块(项, -1, 0),
      右: 同块(项, 1, 0),
    };
    const 外 = {
      左: 邻.左 ? 单元左 : 单元左 + 缝,
      上: 邻.上 ? 单元上 : 单元上 + 缝,
      右: 邻.右 ? 单元左 + 格 : 单元左 + 格 - 缝,
      下: 邻.下 ? 单元上 + 格 : 单元上 + 格 - 缝,
    };
    const R = 格 * (项.类型 ? 规.类型圆角[项.类型] : 规.圆角比);
    const 角 = {
      左上: !邻.上 && !邻.左 ? R : 0,
      右上: !邻.上 && !邻.右 ? R : 0,
      右下: !邻.下 && !邻.右 ? R : 0,
      左下: !邻.下 && !邻.左 ? R : 0,
    };
    const 内凹: 内凹角[] = [];
    for (const [横, 纵] of [
      [1, -1],
      [-1, -1],
      [1, 1],
      [-1, 1],
    ] as const) {
      const 横邻 = 横 > 0 ? 邻.右 : 邻.左;
      const 纵邻 = 纵 > 0 ? 邻.下 : 邻.上;
      if (!横邻 || !纵邻 || 同块(项, 横, 纵)) continue;
      内凹.push({
        x: 横 > 0 ? 单元左 + 格 - 缝 : 单元左 + 缝,
        y: 纵 > 0 ? 单元上 + 格 - 缝 : 单元上 + 缝,
        横,
        纵,
        底部: 纵 > 0,
      });
    }
    return {
      格: 项,
      单元左,
      单元上,
      邻,
      外,
      角,
      厚: 邻.下 ? 0 : Math.max(1.2, 格 * 规.厚比),
      内凹,
    };
  });
}

function 糖面边界(几何: 格几何): 边界 {
  return { ...几何.外, 下: 几何.外.下 - 几何.厚 };
}

/** 糖面上的花纹：I/L 斜纹、O 夹心、J 糖钉、S 糖砂、Z 果冻芯。 */
function 绘制糖纹(绘图: 图形对象, 几何: 格几何, 糖面: 点[], 格: number, 透明度: number): void {
  const { 格: 项, 单元左, 单元上 } = 几何;
  const 面 = 糖面边界(几何);
  const 色值 = 项.色值;
  const 奶油 = 糖果规范.色.奶油;
  if (项.类型 === "I" || 项.类型 === "L") {
    const 周期 = 格 * 0.5;
    const 条宽 = 格 * (项.类型 === "I" ? 0.2 : 0.17);
    const 起 = Math.floor((面.左 - 面.下) / 周期) * 周期;
    绘图.fillStyle(项.类型 === "I" ? 0xffffff : 奶油, (项.类型 === "I" ? 0.86 : 0.8) * 透明度);
    for (let s = 起; s < 面.右 - 面.上; s += 周期) {
      const 带 = 裁进凸形(斜带(s, 条宽, 面.上, 面.下), 糖面);
      if (带.length >= 3) 绘图.fillPoints(带, true);
    }
    return;
  }
  if (项.类型 === "O") {
    const 带高 = 格 * 0.13;
    for (const 比 of [0.3, 0.68]) {
      const y = 单元上 + 格 * 比;
      const 带 = 裁进凸形(
        [
          { x: 面.左, y },
          { x: 面.右, y },
          { x: 面.右, y: y + 带高 },
          { x: 面.左, y: y + 带高 },
        ],
        糖面,
      );
      if (带.length < 3) continue;
      绘图.fillStyle(暗色(色值, 0.22), 0.55 * 透明度).fillPoints(
        带.map((p) => ({ x: p.x, y: p.y + 带高 * 0.45 })),
        true,
      );
      绘图.fillStyle(糖果规范.色.象牙, 0.95 * 透明度).fillPoints(带, true);
    }
    return;
  }
  if (项.类型 === "J") {
    const cx = 单元左 + 格 / 2;
    const cy = 单元上 + 格 / 2 - 几何.厚 / 2;
    const r = 格 * 0.13;
    绘图.fillStyle(暗色(色值, 0.3), 0.55 * 透明度).fillCircle(cx, cy + r * 0.25, r * 1.12);
    绘图.fillStyle(亮色(色值, 0.32), 透明度).fillCircle(cx, cy, r);
    绘图.fillStyle(0xffffff, 0.75 * 透明度).fillCircle(cx - r * 0.3, cy - r * 0.32, r * 0.36);
    return;
  }
  if (项.类型 === "S") {
    for (let 序 = 0; 序 < 9; 序 += 1) {
      const x = 单元左 + 格 * (0.14 + 散列(项.列, 项.行, 序) * 0.72);
      const y = 单元上 + 格 * (0.14 + 散列(项.列, 项.行, 序 + 17) * 0.66);
      if (x < 面.左 + 1 || x > 面.右 - 1 || y < 面.上 + 1 || y > 面.下 - 1) continue;
      const 大小 = 格 * (0.035 + 散列(项.列, 项.行, 序 + 31) * 0.03);
      const 亮 = 序 % 3 !== 0;
      绘图
        .fillStyle(亮 ? 0xffffff : 暗色(色值, 0.25), (亮 ? 0.75 : 0.45) * 透明度)
        .fillRect(x - 大小 / 2, y - 大小 / 2, 大小, 大小);
    }
    return;
  }
  if (项.类型 === "Z") {
    const 缩 = 格 * 0.17;
    const 芯边 = {
      左: 面.左 + (几何.邻.左 ? 0 : 缩),
      上: 面.上 + (几何.邻.上 ? 0 : 缩),
      右: 面.右 - (几何.邻.右 ? 0 : 缩),
      下: 面.下 - (几何.邻.下 ? 0 : 缩),
    };
    if (芯边.右 - 芯边.左 < 2 || 芯边.下 - 芯边.上 < 2) return;
    const 芯角 = {
      左上: 几何.角.左上 > 0 ? Math.max(1, 几何.角.左上 - 缩) : 0,
      右上: 几何.角.右上 > 0 ? Math.max(1, 几何.角.右上 - 缩) : 0,
      右下: 几何.角.右下 > 0 ? Math.max(1, 几何.角.右下 - 缩) : 0,
      左下: 几何.角.左下 > 0 ? Math.max(1, 几何.角.左下 - 缩) : 0,
    };
    绘图.fillStyle(亮色(色值, 0.2), 0.5 * 透明度).fillPoints(圆角多边形(芯边, 芯角), true);
  }
}

/** 受光：外露的顶边一叠渐亮糖衣反光，加左缘亮线、左上镜面与底部内阴影。 */
function 绘制受光(绘图: 图形对象, 几何: 格几何, 格: number, 透明度: number): void {
  const 面 = 糖面边界(几何);
  const 邻 = 几何.邻;
  const 缩 = 格 * 0.06;
  if (!邻.上) {
    // 顶边糖衣：用几层实心带叠出渐变，比四角色渐变更稳、更像画出来的光。
    const 带 = {
      左: 面.左 + (邻.左 ? 0 : 缩),
      上: 面.上 + 缩 * 0.5,
      右: 面.右 - (邻.右 ? 0 : 缩),
      下: 面.上 + 格 * 0.46,
    };
    const 角 = {
      左上: 几何.角.左上 > 0 ? Math.max(1, 几何.角.左上 - 缩) : 0,
      右上: 几何.角.右上 > 0 ? Math.max(1, 几何.角.右上 - 缩) : 0,
      右下: 0,
      左下: 0,
    };
    const 层 = 6;
    for (let i = 0; i < 层; i += 1) {
      const t = i / (层 - 1);
      const 段 = {
        左: 带.左,
        上: 带.上 + (带.下 - 带.上) * t * 0.9,
        右: 带.右,
        下: 带.下 - (带.下 - 带.上) * (1 - t) * 0.22,
      };
      if (段.下 - 段.上 < 0.8) continue;
      绘图.fillStyle(0xffffff, (0.5 - t * 0.42) * 透明度);
      绘图.fillPoints(圆角多边形(段, 角), true);
    }
    // 顶棱一条实亮线，糖体边缘立起来。
    if (带.右 - 带.左 > 1)
      绘图
        .lineStyle(Math.max(1, 格 * 0.05), 0xffffff, 0.7 * 透明度)
        .lineBetween(带.左 + 2, 带.上 + 0.6, 带.右 - 2, 带.上 + 0.6);
  }
  if (!邻.下) {
    const 高 = 格 * 0.3;
    const 带 = { 左: 面.左, 上: 面.下 - 高, 右: 面.右, 下: 面.下 };
    const 角 = { 左上: 0, 右上: 0, 右下: 几何.角.右下, 左下: 几何.角.左下 };
    for (let i = 0; i < 3; i += 1) {
      绘图.fillStyle(0x000000, (0.08 + i * 0.06) * 透明度);
      绘图.fillPoints(圆角多边形(带, 角), true);
    }
  }
  if (!邻.左) {
    const 宽 = Math.max(1, 格 * 0.07);
    const 上 = 面.上 + (几何.角.左上 > 0 ? 几何.角.左上 * 0.9 : 0);
    const 下 = 面.下 - (几何.角.左下 > 0 ? 几何.角.左下 * 0.9 : 0);
    if (下 - 上 > 1)
      绘图.fillStyle(0xffffff, 0.32 * 透明度).fillRect(面.左 + 格 * 0.04, 上, 宽, 下 - 上);
  }
  if (!邻.上 && !邻.左) {
    绘图
      .fillStyle(0xffffff, 0.9 * 透明度)
      .fillEllipse(面.左 + 格 * 0.3, 面.上 + 格 * 0.17, 格 * 0.3, 格 * 0.11);
    绘图.fillStyle(0xffffff, 0.75 * 透明度).fillCircle(面.左 + 格 * 0.14, 面.上 + 格 * 0.3, 格 * 0.05);
  }
}

/** 葡萄球：深色外圈、球身、左上偏移的亮面和一点镜面高光。 */
function 绘制葡萄球(
  绘图: 图形对象,
  几何: 格几何,
  格: number,
  透明度: number,
  层: "投影" | "描边" | "球",
): void {
  const 色值 = 几何.格.色值;
  const cx = 几何.单元左 + 格 / 2;
  const cy = 几何.单元上 + 格 / 2;
  const r = 格 * 规.葡萄半径比 - Math.max(0.7, 格 * 规.缝比);
  if (层 === "投影") {
    绘图.fillStyle(0x12060a, 0.34 * 透明度).fillCircle(cx, cy + 格 * 规.投影比, r);
    return;
  }
  if (层 === "描边") {
    绘图.fillStyle(暗色(色值, 0.58), 透明度).fillCircle(cx, cy, r + Math.max(0.8, 格 * 规.描边比));
    return;
  }
  绘图.fillStyle(暗色(色值, 0.22), 透明度).fillCircle(cx, cy, r);
  绘图.fillStyle(色值, 透明度).fillCircle(cx - r * 0.08, cy - r * 0.1, r * 0.86);
  绘图.fillStyle(亮色(色值, 0.22), 0.75 * 透明度).fillCircle(cx - r * 0.2, cy - r * 0.24, r * 0.52);
  绘图
    .fillStyle(0xffffff, 0.85 * 透明度)
    .fillEllipse(cx - r * 0.34, cy - r * 0.46, r * 0.5, r * 0.26);
  绘图.fillStyle(0xffffff, 0.5 * 透明度).fillCircle(cx + r * 0.42, cy + r * 0.3, r * 0.08);
}

/**
 * 画一组糖果格（例如棋盘上全部已落格、当前块或预览块）。
 * 同色同类型且相邻的格熔成一块；原点是第 0 列第 0 行格子的左上角。
 */
export function 绘制果冻组(
  绘图: 图形对象,
  原点X: number,
  原点Y: number,
  格: number,
  格列表: readonly 果冻格[],
  透明度 = 1,
): void {
  if (格 <= 0 || 透明度 <= 0 || 格列表.length === 0) return;
  const 全部 = 计算几何(格列表, 原点X, 原点Y, 格);
  const 熔块 = 全部.filter((项) => 项.格.类型 !== "T");
  const 葡萄 = 全部.filter((项) => 项.格.类型 === "T");
  const 描边 = Math.max(0.8, 格 * 规.描边比);
  const 补角 = 格 * 0.2;
  const 投影 = 格 * 规.投影比;

  for (const 项 of 熔块) {
    const 边 = 外扩边界(项.外, 项.邻, 描边);
    const 形 = 圆角多边形({ ...边, 上: 边.上 + 投影, 下: 边.下 + 投影 }, 加角(项.角, 描边));
    绘图.fillStyle(0x12060a, 0.34 * 透明度).fillPoints(形, true);
  }
  for (const 项 of 葡萄) 绘制葡萄球(绘图, 项, 格, 透明度, "投影");

  for (const 项 of 熔块) {
    const 深 = 暗色(项.格.色值, 0.58);
    绘图.fillStyle(深, 透明度);
    绘图.fillPoints(圆角多边形(外扩边界(项.外, 项.邻, 描边), 加角(项.角, 描边)), true);
    for (const 凹 of 项.内凹) 绘图.fillPoints(内凹补角点(凹, 补角, 描边), true);
  }
  for (const 项 of 葡萄) 绘制葡萄球(绘图, 项, 格, 透明度, "描边");

  for (const 项 of 熔块) {
    绘图.fillStyle(暗色(项.格.色值, 0.3), 透明度).fillPoints(圆角多边形(项.外, 项.角), true);
    for (const 凹 of 项.内凹) if (凹.底部) 绘图.fillPoints(内凹补角点(凹, 补角, 0), true);
  }

  const 糖面表 = new Map<格几何, 点[]>();
  for (const 项 of 熔块) {
    const 面 = 圆角多边形(糖面边界(项), 项.角);
    糖面表.set(项, 面);
    绘图.fillStyle(项.格.色值, 透明度).fillPoints(面, true);
    for (const 凹 of 项.内凹) if (!凹.底部) 绘图.fillPoints(内凹补角点(凹, 补角, 0), true);
  }
  for (const 项 of 熔块) 绘制糖纹(绘图, 项, 糖面表.get(项) ?? [], 格, 透明度);
  for (const 项 of 熔块) 绘制受光(绘图, 项, 格, 透明度);
  for (const 项 of 葡萄) 绘制葡萄球(绘图, 项, 格, 透明度, "球");
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
  绘制果冻组(绘图, x, y, 格, [{ 列: 0, 行: 0, 色值, 类型 }], 透明度);
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
  const r = Math.max(1.5, 格 * 规.幽灵圆角比);
  const 内缩 = Math.max(1.5, 格 * 0.12);
  const 宽 = 格 - 内缩 * 2;
  if (填充)
    绘图.fillStyle(色值, 0.12 * 透明度).fillRoundedRect(x + 内缩, y + 内缩, 宽, 宽, r);
  const 点色 = 亮色(色值, 0.55);
  const 点距 = Math.max(3, 格 * 0.16);
  const 数 = Math.max(2, Math.round((宽 - r * 2) / 点距));
  绘图.fillStyle(点色, 0.8 * 透明度);
  for (let 序 = 0; 序 <= 数; 序 += 1) {
    const t = x + 内缩 + r + ((宽 - r * 2) * 序) / 数;
    const s = y + 内缩 + r + ((宽 - r * 2) * 序) / 数;
    const 点 = Math.max(0.7, 格 * 0.035);
    绘图.fillCircle(t, y + 内缩, 点).fillCircle(t, y + 内缩 + 宽, 点);
    绘图.fillCircle(x + 内缩, s, 点).fillCircle(x + 内缩 + 宽, s, 点);
  }
  绘图
    .lineStyle(Math.max(1, 格 * 0.04), 点色, 0.35 * 透明度)
    .strokeRoundedRect(x + 内缩, y + 内缩, 宽, 宽, r);
}
