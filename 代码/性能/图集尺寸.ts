/**
 * 运行时图形图集的尺寸配置与准入纯函数。
 * 图形烘焙.ts 只消费这里的结论：能进哪一档页、页满后退化、纯色/极简是否直接原生绘制。
 */

/** 共享图集页档：页边长与这一档最多开几页。 */
export interface 图集页档 {
  边: number;
  最多页: number;
}

/**
 * 页档按边长升序排列，总页数为各档页数之和（当前 2+2+1=5）。
 * 页尺寸与单帧上限分开：页可以大，但单帧超过 单帧最大边 的块仍然不入集。
 */
export const 图集页档表: readonly 图集页档[] = [
  { 边: 256, 最多页: 2 },
  { 边: 512, 最多页: 2 },
  { 边: 1024, 最多页: 1 },
];

/** 单帧准入上限，与页尺寸分开。超过它的块不进共享页，退化为独立纹理。 */
export const 单帧最大边 = 1024;
export const 图集间隙 = 2;
/** 图章图集按内容从 256 起放大，最大 1024。 */
export const 图章最大边 = 1024;
export const 图章最小边 = 256;

/** 图章页按内容尺寸取 2 的幂边长，夹在 [最小, 最大] 之间。 */
export function 合适页边(宽: number, 高: number, 最大: number, 最小: number): number {
  const 需要 = Math.max(宽, 高, 最小);
  let 边 = 最小;
  while (边 < 需要 && 边 < 最大) 边 *= 2;
  return 边;
}

/** 一页的货架与空闲表；纯数据，便于单测直接构造。 */
export interface 页空间 {
  边: number;
  货架: { y: number; 高: number; x: number }[];
  已用高: number;
  空闲: { x: number; y: number; 宽: number; 高: number }[];
}

export interface 页位置 {
  x: number;
  y: number;
}

export function 新建页空间(边: number): 页空间 {
  return { 边, 货架: [], 已用高: 0, 空闲: [] };
}

/**
 * 在页空间里按"空闲块 → 现有货架 → 新货架"找位置；不改入参，返回更新后的空间。
 * 与图形烘焙.ts 原来的货架分配保持一致，只是把状态与算法拆开便于测试。
 */
export function 放入页空间(
  空间: 页空间,
  宽: number,
  高: number,
  间隙 = 图集间隙,
): { 位: 页位置; 空间: 页空间 } | null {
  const W = 宽 + 间隙;
  const H = 高 + 间隙;
  if (W > 空间.边 || H > 空间.边) return null;
  for (let i = 0; i < 空间.空闲.length; i++) {
    const 区 = 空间.空闲[i];
    if (区 && 区.宽 >= W && 区.高 >= H && 区.宽 * 区.高 <= W * H * 2.5) {
      const 空闲 = 空间.空闲.filter((_, 序) => 序 !== i);
      return { 位: { x: 区.x, y: 区.y }, 空间: { ...空间, 空闲 } };
    }
  }
  for (let i = 0; i < 空间.货架.length; i++) {
    const 架 = 空间.货架[i];
    if (架 && 架.高 >= H && 架.高 <= H * 1.6 + 8 && 架.x + W <= 空间.边) {
      const 货架 = 空间.货架.map((项, 序) => (序 === i ? { ...项, x: 项.x + W } : 项));
      return { 位: { x: 架.x, y: 架.y }, 空间: { ...空间, 货架 } };
    }
  }
  if (空间.已用高 + H <= 空间.边) {
    const 货架 = [...空间.货架, { y: 空间.已用高, 高: H, x: W }];
    return { 位: { x: 0, y: 空间.已用高 }, 空间: { ...空间, 货架, 已用高: 空间.已用高 + H } };
  }
  return null;
}

/** 按块尺寸选最小可放页档；超过单帧准入上限或没有装得下的档返回 null（超页）。 */
export function 选择页档(
  宽: number,
  高: number,
  档表: readonly 图集页档[] = 图集页档表,
): 图集页档 | null {
  if (宽 < 1 || 高 < 1) return null;
  if (Math.max(宽, 高) > 单帧最大边) return null;
  const 需要 = Math.max(宽, 高) + 图集间隙;
  return 档表.find((档) => 档.边 >= 需要) ?? null;
}

export interface 页池项 {
  边: number;
  空间: 页空间;
}

export type 选页结论 =
  | { 类型: "现有页"; 页序: number; 位: 页位置; 空间: 页空间 }
  | { 类型: "新页"; 页序: number; 位: 页位置; 空间: 页空间 }
  | { 类型: "不入集"; 原因: "超页" | "页满" };

/**
 * 页分配选择：先在小档里用现有页，档内页数没满就开新页，都满了才升档；
 * 所有档都没有位置时返回"页满"，由调用方退化为独立纹理并计数。
 * 页池顺序即页的创建顺序，页序用页池下标（新页总是追加在末尾）。
 */
export function 选择入集页(
  页池: readonly 页池项[],
  宽: number,
  高: number,
  档表: readonly 图集页档[] = 图集页档表,
): 选页结论 {
  const 起始 = 选择页档(宽, 高, 档表);
  if (!起始) return { 类型: "不入集", 原因: "超页" };
  for (const 档 of 档表) {
    if (档.边 < 起始.边) continue;
    for (let i = 0; i < 页池.length; i++) {
      const 项 = 页池[i];
      if (!项 || 项.边 !== 档.边) continue;
      const 结果 = 放入页空间(项.空间, 宽, 高);
      if (结果) return { 类型: "现有页", 页序: i, 位: 结果.位, 空间: 结果.空间 };
    }
    const 已开 = 页池.filter((项) => 项.边 === 档.边).length;
    if (已开 < 档.最多页) {
      const 结果 = 放入页空间(新建页空间(档.边), 宽, 高);
      if (结果) return { 类型: "新页", 页序: 页池.length, 位: 结果.位, 空间: 结果.空间 };
    }
  }
  return { 类型: "不入集", 原因: "页满" };
}

const 填充样式 = 7;
const 填充矩形 = 3;
const 线段样式 = 6;
const 保存 = 14;
const 恢复 = 15;
const 平移 = 16;
const 缩放 = 17;

/**
 * 纯色/极简：只有填充色 + 至多两块填充矩形（可带 SAVE/RESTORE/TRANSLATE/SCALE），
 * 没有渐变、圆弧、三角或路径。这类块原生绘制的代价低于建纹理，直接不入集。
 * 判定纯看命令结构，因此"两块同色矩形"和"两块不同色矩形"都算；原生绘制与原命令逐字一致。
 * LINE_STYLE 允许：它只设置状态、不单独画线，且 Phaser 构造器固定写入一条 lineStyle(1,0,0) 前导；
 * 真正的描边会走 STROKE_PATH 等命令，仍会被拒绝。
 */
export function 判断纯色极简(命令表: readonly number[]): boolean {
  let 块数 = 0;
  let 有填充色 = false;
  for (let i = 0; i < 命令表.length; ) {
    switch (命令表[i]) {
      case 填充样式:
        有填充色 = true;
        i += 3;
        break;
      case 填充矩形:
        块数 += 1;
        if (块数 > 2) return false;
        i += 5;
        break;
      case 线段样式:
        i += 4;
        break;
      case 保存:
      case 恢复:
        i += 1;
        break;
      case 平移:
      case 缩放:
        i += 3;
        break;
      default:
        return false;
    }
  }
  return 有填充色 && 块数 > 0;
}

const 圆弧 = 0;
const 直线 = 4;
const 移动 = 5;
const 旋转 = 18;
const 三角填充 = 10;
const 三角描边 = 11;
const 渐变填充 = 21;
const 渐变描边 = 22;

export interface 九宫规格 {
  边: number;
  键: string;
}

/**
 * 一块底板只有圆角和描边是独特的、中间在重复时，返回九宫格边宽。
 * 渐变、三角、并排的两块、或中间塞了太多形状时返回空，避免把不同内容拉成一张。
 */
export function 判断九宫(命令表: readonly number[], 宽: number, 高: number): 九宫规格 | null {
  if (宽 < 24 || 高 < 24) return null;
  let 填充段 = 0;
  let 最大半径 = 0;
  const 色: number[] = [];
  const 矩形: { 宽: number; 高: number }[] = [];
  for (let i = 0; i < 命令表.length; ) {
    const 码 = 命令表[i];
    switch (码) {
      case 1:
      case 2:
      case 8:
      case 9:
      case 保存:
      case 恢复:
        i += 1;
        break;
      case 圆弧: {
        最大半径 = Math.max(最大半径, Math.abs(命令表[i + 3] ?? 0));
        填充段 += 1;
        i += 8;
        break;
      }
      case 填充矩形: {
        矩形.push({ 宽: Math.abs(命令表[i + 3] ?? 0), 高: Math.abs(命令表[i + 4] ?? 0) });
        填充段 += 1;
        i += 5;
        break;
      }
      case 直线:
      case 移动:
        i += 3;
        break;
      case 线段样式:
        色.push(
          Math.round((命令表[i + 1] ?? 0) * 10),
          命令表[i + 2] ?? 0,
          Math.round((命令表[i + 3] ?? 0) * 100),
        );
        i += 4;
        break;
      case 填充样式:
        色.push(命令表[i + 1] ?? 0, Math.round((命令表[i + 2] ?? 0) * 100));
        i += 3;
        break;
      case 平移:
      case 缩放:
        i += 3;
        break;
      case 旋转:
        i += 2;
        break;
      case 三角填充:
      case 三角描边:
      case 渐变填充:
      case 渐变描边:
        return null;
      default:
        return null;
    }
    if (填充段 > 16) return null;
  }
  if (填充段 === 0) return null;
  for (const 块 of 矩形) {
    const 细条 = 块.高 <= Math.max(8, 高 * 0.2) && 块.宽 >= 宽 * 0.7;
    const 整块 = 块.宽 >= 宽 * 0.75 && 块.高 >= 高 * 0.75;
    if (!细条 && !整块) return null;
  }
  const 边 = Math.min(48, Math.max(6, Math.ceil(最大半径) + 2));
  if (宽 <= 边 * 2 + 8 || 高 <= 边 * 2 + 8) return null;
  return { 边, 键: `九宫.${边}.${色.join(".")}` };
}
