import { 模式配置, 节奏配置, 速度表 } from "../项目配置/模式";

export const 棋盘宽度 = 10;
export const 可见高度 = 20;
export const 隐藏高度 = 2;
export type 方块类型 = "I" | "O" | "T" | "S" | "Z" | "J" | "L";
export type 游戏模式 = "马拉松" | "冲刺" | "极限" | "每日挑战";
export type 游戏阶段 = "进行中" | "暂停" | "结束";
/** 每日挑战继承马拉松结算规则，包括结束后的显式重开等待。 */
export function 是否使用马拉松结算重开锁(模式: 游戏模式): boolean {
  return 模式 === "马拉松" || 模式 === "每日挑战";
}
export interface 方块格子 {
  列2: number;
  行2: number;
}
export interface 活动方块 {
  类型: 方块类型;
  格子: 方块格子[];
  中心列2: number;
  中心行2: number;
  旋转: number;
}
export interface 俄罗斯方块状态 {
  /** 最近一次真实消行的显示快照，不参与计分与规则。 */
  消行事件?: { 序号: number; 行: number[]; 格子: [number, number, 方块类型][] };
  棋盘: (方块类型 | null)[][];
  当前方块: 活动方块;
  暂存方块: 方块类型 | null;
  本块已暂存: boolean;
  落块事件?: {
    序号: number;
    格子: [number, number][];
    类型: 方块类型;
    行数: number;
    T旋: "无" | "迷你" | "完整";
    全清: boolean;
    连击: number;
    连续高难: boolean;
    得分: number;
  };
  下一个方块: 方块类型;
  后续方块: 方块类型[];
  袋子: 方块类型[];
  测试序列: 方块类型[];
  阶段: 游戏阶段;
  模式: 游戏模式;
  分数: number;
  消行数: number;
  等级: number;
  连击: number;
  最长连击: number;
  背靠背: boolean;
  起始时间: number;
  暂停时长: number;
  剩余时间: number;
  完赛: boolean;
  锁定毫秒: number;
  锁定重置: number;
  最后旋转: boolean;
  软降分: number;
  硬降分: number;
  目标达成: boolean;
  内部重力: number;
  有效用时: number;
  最后踢墙编号: number;
  最后踢墙候选数: number;
}

const 方块出生格: Record<方块类型, [number, number][]> = {
  I: [
    [3, -1],
    [4, -1],
    [5, -1],
    [6, -1],
  ],
  O: [
    [4, -2],
    [5, -2],
    [4, -1],
    [5, -1],
  ],
  T: [
    [4, -2],
    [3, -1],
    [4, -1],
    [5, -1],
  ],
  S: [
    [4, -2],
    [5, -2],
    [3, -1],
    [4, -1],
  ],
  Z: [
    [3, -2],
    [4, -2],
    [4, -1],
    [5, -1],
  ],
  J: [
    [3, -2],
    [3, -1],
    [4, -1],
    [5, -1],
  ],
  L: [
    [5, -2],
    [3, -1],
    [4, -1],
    [5, -1],
  ],
};
const 中心: Record<方块类型, [number, number]> = {
  I: [9, -1],
  O: [9, -3],
  T: [8, -2],
  S: [8, -2],
  Z: [8, -2],
  J: [8, -2],
  L: [8, -2],
};
export const JL: Record<string, [number, number][]> = {
  "0>1": [
    [0, 0],
    [-1, 0],
    [-1, -1],
    [0, 2],
    [-1, 2],
  ],
  "1>0": [
    [0, 0],
    [1, 0],
    [1, 1],
    [0, -2],
    [1, -2],
  ],
  "1>2": [
    [0, 0],
    [1, 0],
    [1, 1],
    [0, -2],
    [1, -2],
  ],
  "2>1": [
    [0, 0],
    [-1, 0],
    [-1, -1],
    [0, 2],
    [-1, 2],
  ],
  "2>3": [
    [0, 0],
    [1, 0],
    [1, -1],
    [0, 2],
    [1, 2],
  ],
  "3>2": [
    [0, 0],
    [-1, 0],
    [-1, 1],
    [0, -2],
    [-1, -2],
  ],
  "3>0": [
    [0, 0],
    [-1, 0],
    [-1, 1],
    [0, -2],
    [-1, -2],
  ],
  "0>3": [
    [0, 0],
    [1, 0],
    [1, -1],
    [0, 2],
    [1, 2],
  ],
};
export const IK: Record<string, [number, number][]> = {
  "0>1": [
    [0, 0],
    [-2, 0],
    [1, 0],
    [-2, 1],
    [1, -2],
  ],
  "1>0": [
    [0, 0],
    [2, 0],
    [-1, 0],
    [2, -1],
    [-1, 2],
  ],
  "1>2": [
    [0, 0],
    [-1, 0],
    [2, 0],
    [-1, -2],
    [2, 1],
  ],
  "2>1": [
    [0, 0],
    [1, 0],
    [-2, 0],
    [1, 2],
    [-2, -1],
  ],
  "2>3": [
    [0, 0],
    [2, 0],
    [-1, 0],
    [2, -1],
    [-1, 2],
  ],
  "3>2": [
    [0, 0],
    [-2, 0],
    [1, 0],
    [-2, 1],
    [1, -2],
  ],
  "3>0": [
    [0, 0],
    [1, 0],
    [-2, 0],
    [1, 2],
    [-2, -1],
  ],
  "0>3": [
    [0, 0],
    [-1, 0],
    [2, 0],
    [-1, -2],
    [2, 1],
  ],
};
function 空棋盘(): (方块类型 | null)[][] {
  return Array.from({ length: 22 }, () => Array(10).fill(null));
}
function 洗牌(rand: () => number): 方块类型[] {
  const bag: 方块类型[] = ["I", "O", "T", "S", "Z", "J", "L"];
  for (let i = 6; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const left = bag[i];
    const right = bag[j];
    if (left && right) [bag[i], bag[j]] = [right, left];
  }
  return bag;
}
export function 每日种子(date: string): number {
  let h = 0x811c9dc5;
  for (const byte of new TextEncoder().encode(`daily-${date}`))
    h = Math.imul(h ^ byte, 0x01000193) >>> 0;
  return h;
}
export function 创建每日随机源(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let r = Math.imul(state ^ (state >>> 15), state | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}
export function 每日方块序列(date: string, count = 14): 方块类型[] {
  const rand = 创建每日随机源(每日种子(date)),
    out: 方块类型[] = [];
  while (out.length < count) out.push(...洗牌(rand));
  return out.slice(0, count);
}
/**
 * 每局开始时按模式取用的随机源。
 * 每日挑战每次调用都回到当日种子，保证同日重开方块序列完全一致；
 * 其他模式使用游戏随机源。
 */
export function 创建模式随机源(模式: 游戏模式, 日期: string): () => number {
  return 模式 === "每日挑战" ? 创建每日随机源(每日种子(日期)) : Math.random;
}
export function 创建新局(
  rand: () => number = Math.random,
  固定序列: 方块类型[] = [],
  模式: 游戏模式 = "马拉松",
  now = Date.now(),
): 俄罗斯方块状态 {
  const s: 俄罗斯方块状态 = {
    棋盘: 空棋盘(),
    当前方块: 创建活动("I"),
    暂存方块: null,
    本块已暂存: false,
    下一个方块: "I",
    后续方块: [],
    袋子: [],
    测试序列: [...固定序列],
    阶段: "进行中",
    模式,
    分数: 0,
    消行数: 0,
    等级: 1,
    连击: 0,
    最长连击: 0,
    背靠背: false,
    起始时间: now,
    暂停时长: 0,
    剩余时间: 模式配置.极限毫秒,
    完赛: false,
    锁定毫秒: 0,
    锁定重置: 0,
    最后旋转: false,
    软降分: 0,
    硬降分: 0,
    目标达成: false,
    内部重力: 0,
    有效用时: 0,
    最后踢墙编号: 0,
    最后踢墙候选数: 1,
  };
  s.当前方块 = 创建活动(抽块(s, rand));
  s.下一个方块 = 抽块(s, rand);
  s.后续方块 = [抽块(s, rand), 抽块(s, rand)];
  return s;
}
function 创建活动(type: 方块类型): 活动方块 {
  return {
    类型: type,
    格子: 方块出生格[type].map(([x, y]) => ({ 列2: x * 2, 行2: y * 2 })),
    中心列2: 中心[type][0],
    中心行2: 中心[type][1],
    旋转: 0,
  };
}
function 抽块(s: 俄罗斯方块状态, rand: () => number): 方块类型 {
  const fixed = s.测试序列.shift();
  if (fixed) return fixed;
  if (!s.袋子.length) s.袋子 = 洗牌(rand);
  return s.袋子.shift() ?? "I";
}
/** 每次落块前最多换一次；交换已有暂存不消耗后续序列。 */
export function 暂存换块(s: 俄罗斯方块状态, rand: () => number = Math.random): boolean {
  if (s.阶段 !== "进行中" || s.本块已暂存) return false;
  const 换入 = s.暂存方块;
  s.暂存方块 = s.当前方块.类型;
  s.当前方块 = 创建活动(换入 ?? s.下一个方块);
  if (!换入) {
    s.下一个方块 = s.后续方块.shift() ?? 抽块(s, rand);
    s.后续方块.push(抽块(s, rand));
  }
  s.本块已暂存 = true;
  s.锁定毫秒 = 0;
  s.锁定重置 = 0;
  s.内部重力 = 0;
  s.最后旋转 = false;
  s.最后踢墙编号 = 0;
  s.最后踢墙候选数 = 1;
  if (!可以放置(s, s.当前方块)) 结束(s);
  return true;
}
export function 读取格子(p: 活动方块): [number, number][] {
  return p.格子.map((c) => [c.列2 / 2, c.行2 / 2]);
}
export function 可以放置(s: 俄罗斯方块状态, p: 活动方块): boolean {
  return 读取格子(p).every(
    ([x, y]) =>
      Number.isInteger(x) &&
      Number.isInteger(y) &&
      x >= 0 &&
      x < 10 &&
      y >= -2 &&
      y < 20 &&
      s.棋盘[y + 2]?.[x] === null,
  );
}
function 落地(s: 俄罗斯方块状态): boolean {
  return !可以放置(s, {
    ...s.当前方块,
    格子: s.当前方块.格子.map((c) => ({ ...c, 行2: c.行2 + 2 })),
  });
}
function 地面操作(s: 俄罗斯方块状态, rand: () => number, 可重置: boolean): void {
  if (落地(s)) {
    if (可重置 && s.锁定重置 < 节奏配置.锁定重置上限) {
      s.锁定毫秒 = 0;
      s.锁定重置++;
    } else if (可重置) 锁定方块(s, rand);
  } else s.锁定毫秒 = 0;
}
export function 移动方块(
  s: 俄罗斯方块状态,
  dx: number,
  dy = 0,
  rand: () => number = Math.random,
): boolean {
  if (s.阶段 !== "进行中") return false;
  const p = s.当前方块,
    next = {
      ...p,
      中心列2: p.中心列2 + dx * 2,
      中心行2: p.中心行2 + dy * 2,
      格子: p.格子.map((c) => ({ 列2: c.列2 + dx * 2, 行2: c.行2 + dy * 2 })),
    };
  if (!可以放置(s, next)) return false;
  s.当前方块 = next;
  if (dx) s.最后旋转 = false;
  地面操作(s, rand, dx !== 0);
  return true;
}
export function 旋转方块(
  s: 俄罗斯方块状态,
  方向: 1 | -1 = 1,
  半转 = false,
  rand: () => number = Math.random,
): boolean {
  if (s.阶段 !== "进行中") return false;
  const p = s.当前方块,
    from = p.旋转,
    to = (from + (半转 ? 2 : 方向) + 4) % 4;
  if (p.类型 === "O") {
    p.旋转 = to;
    s.最后旋转 = true;
    return true;
  }
  const rotated = p.格子.map(({ 列2, 行2 }) => {
    const x = 列2 - p.中心列2,
      y = 行2 - p.中心行2;
    return 半转
      ? { 列2: p.中心列2 - x, 行2: p.中心行2 - y }
      : { 列2: p.中心列2 - y, 行2: p.中心行2 + x };
  });
  const kicks = 半转
    ? [
        [0, 0],
        [0, -1],
      ]
    : ((p.类型 === "I" ? IK[`${from}>${to}`] : JL[`${from}>${to}`]) ?? [[0, 0]]);
  for (const [kickIndex, [dx, dy]] of kicks.entries()) {
    const next = {
      ...p,
      旋转: to,
      格子: rotated.map((c) => ({ 列2: c.列2 + (dx ?? 0) * 2, 行2: c.行2 + (dy ?? 0) * 2 })),
    };
    if (可以放置(s, next)) {
      s.当前方块 = next;
      s.最后旋转 = true;
      s.最后踢墙编号 = kickIndex;
      s.最后踢墙候选数 = kicks.length;
      地面操作(s, rand, true);
      return true;
    }
  }
  return false;
}
export function 锁定方块(s: 俄罗斯方块状态, rand: () => number = Math.random): void {
  if (s.阶段 !== "进行中") return;
  const cells = 读取格子(s.当前方块);
  const 原分数 = s.分数;
  if (cells.every(([, y]) => y < 0)) {
    // Lock Out：本次不消行，但已累积的软降/硬降分仍计入最终成绩。
    s.分数 += s.软降分 + s.硬降分;
    s.软降分 = 0;
    s.硬降分 = 0;
    结束(s);
    return;
  }
  for (const [x, y] of cells) {
    if (y < -2 || y >= 20 || x < 0 || x >= 10) {
      结束(s);
      return;
    }
    const row = s.棋盘[y + 2];
    if (row) row[x] = s.当前方块.类型;
  }
  const 消除行 = s.棋盘.flatMap((row, i) => (row.every(Boolean) ? [i - 隐藏高度] : []));
  if (消除行.length) {
    s.消行事件 = {
      序号: (s.消行事件?.序号 ?? 0) + 1,
      行: 消除行,
      格子: 消除行.flatMap((行) =>
        (s.棋盘[行 + 隐藏高度] ?? []).flatMap((类型, 列) =>
          类型 ? [[列, 行, 类型] as [number, number, 方块类型]] : [],
        ),
      ),
    };
  }
  const filled = 消除行.length;
  const corners = [
    [s.当前方块.中心列2 / 2 - 1, s.当前方块.中心行2 / 2 - 1],
    [s.当前方块.中心列2 / 2 + 1, s.当前方块.中心行2 / 2 - 1],
    [s.当前方块.中心列2 / 2 - 1, s.当前方块.中心行2 / 2 + 1],
    [s.当前方块.中心列2 / 2 + 1, s.当前方块.中心行2 / 2 + 1],
  ].map(
    ([x, y]) =>
      x === undefined ||
      y === undefined ||
      x < 0 ||
      x >= 10 ||
      y < -2 ||
      y >= 20 ||
      s.棋盘[y + 2]?.[x] !== null,
  );
  const tSpin = s.当前方块.类型 === "T" && s.最后旋转 && corners.filter(Boolean).length >= 3;
  const frontCorners = [
    [0, 1],
    [1, 3],
    [2, 3],
    [0, 2],
  ][s.当前方块.旋转] ?? [0, 1];
  const fullSpin =
    tSpin &&
    (s.最后踢墙编号 === s.最后踢墙候选数 - 1 ||
      filled >= 2 ||
      frontCorners.every((corner) => corners[corner] === true));
  const oldLevel = s.等级,
    kept = s.棋盘.filter((row) => !row.every(Boolean));
  if (filled) s.棋盘 = [...Array.from({ length: filled }, () => Array(10).fill(null)), ...kept];
  const pc = filled > 0 && s.棋盘.every((row) => row.every((v) => v === null));
  const base = filled === 1 ? 100 : filled === 2 ? 300 : filled === 3 ? 500 : filled >= 4 ? 800 : 0;
  const spin =
    filled === 0
      ? tSpin
        ? fullSpin
          ? 400
          : 100
        : 0
      : tSpin
        ? fullSpin
          ? filled === 1
            ? 800
            : filled === 2
              ? 1200
              : 1600
          : 200
        : base;
  if (filled) {
    s.连击++;
    s.最长连击 = Math.max(s.连击, s.最长连击);
  } else s.连击 = 0;
  const combo =
    [1, 1.2, 1.4, 1.6, 1.8, 2.1, 2.3, 2.5, 2.7, 3][Math.max(0, Math.min(9, s.连击 - 1))] ?? 1;
  const eligible = (filled >= 4 && !tSpin) || (filled > 0 && tSpin);
  const b2bMult = eligible && s.背靠背 ? 1.5 : 1;
  s.分数 +=
    Math.floor(spin * oldLevel * combo * b2bMult) +
    s.软降分 +
    s.硬降分 +
    (pc ? 1000 * oldLevel : 0);
  s.落块事件 = {
    序号: (s.落块事件?.序号 ?? 0) + 1,
    格子: cells,
    类型: s.当前方块.类型,
    行数: filled,
    T旋: tSpin ? (fullSpin ? "完整" : "迷你") : "无",
    全清: pc,
    连击: s.连击,
    连续高难: b2bMult > 1,
    得分: s.分数 - 原分数,
  };
  s.软降分 = 0;
  s.硬降分 = 0;
  if (eligible) s.背靠背 = true;
  else if (filled > 0) s.背靠背 = false;
  s.消行数 += filled;
  s.等级 = 1 + Math.floor(s.消行数 / 10);
  if (s.模式 === "冲刺" && s.等级 > 模式配置.冲刺等级上限) s.等级 = 模式配置.冲刺等级上限;
  if (s.消行数 >= 模式配置.马拉松目标行数) s.目标达成 = true;
  if (s.模式 === "冲刺" && s.消行数 >= 模式配置.冲刺目标行数) {
    s.完赛 = true;
    结束(s);
    return;
  }
  s.最后旋转 = false;
  s.锁定毫秒 = 0;
  s.锁定重置 = 0;
  s.本块已暂存 = false;
  s.当前方块 = 创建活动(s.下一个方块);
  s.下一个方块 = s.后续方块.shift() ?? 抽块(s, rand);
  s.后续方块.push(抽块(s, rand));
  if (!可以放置(s, s.当前方块)) 结束(s);
}
function 结束(s: 俄罗斯方块状态) {
  s.阶段 = "结束";
}
export function 下落一步(s: 俄罗斯方块状态, rand: () => number = Math.random): boolean {
  if (移动方块(s, 0, 1, rand)) return true;
  固定方块(s, rand);
  return false;
}
export function 固定方块(s: 俄罗斯方块状态, rand: () => number = Math.random): void {
  锁定方块(s, rand);
}
export function 软降一步(s: 俄罗斯方块状态, rand: () => number = Math.random): boolean {
  const moved = 移动方块(s, 0, 1, rand);
  if (moved) {
    s.软降分++;
    s.最后旋转 = false;
  }
  return moved;
}
export function 硬降(s: 俄罗斯方块状态, rand: () => number = Math.random): number {
  if (s.阶段 !== "进行中") return 0;
  let n = 0;
  while (移动方块(s, 0, 1, rand)) n++;
  s.硬降分 += 2 * n;
  锁定方块(s, rand);
  return n;
}
export function 更新时钟(
  s: 俄罗斯方块状态,
  delta: number,
  rand: () => number = Math.random,
  软降 = false,
): void {
  if (s.阶段 !== "进行中") return;
  const dt = Math.max(0, Math.min(delta, 1000));
  s.有效用时 += dt;
  if (s.模式 === "极限") {
    s.剩余时间 = Math.max(0, s.剩余时间 - dt);
    if (s.剩余时间 === 0) {
      结束(s);
      return;
    }
  }
  const gravity = 速度表[Math.min(s.等级, 速度表.length - 1)] ?? 0.5;
  const rowsPerSec = 软降 ? Math.min(Math.max(40, 20 * gravity), 1200) : gravity;
  s.内部重力 += (dt * rowsPerSec) / 1000;
  while (s.内部重力 >= 1 && s.阶段 === "进行中") {
    s.内部重力 -= 1;
    if (软降) {
      const moved = 移动方块(s, 0, 1, rand);
      if (moved) {
        s.软降分++;
        s.最后旋转 = false;
      }
    } else if (!移动方块(s, 0, 1, rand)) break;
  }
  if (落地(s)) {
    s.锁定毫秒 += dt;
    if (s.锁定毫秒 >= 节奏配置.锁定延迟毫秒) 锁定方块(s, rand);
  }
}
export function 切换暂停(s: 俄罗斯方块状态): void {
  if (s.阶段 === "进行中") s.阶段 = "暂停";
  else if (s.阶段 === "暂停") s.阶段 = "进行中";
}
