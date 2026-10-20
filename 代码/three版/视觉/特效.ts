import type { 方块类型 } from "../../玩法/再消一行";
import { 布局, 棋盘外框, 混合颜色 } from "./外观";
import { 添加矩形, type 绘制环境 } from "./绘制";

/**
 * 对局特效：消行闪光、四行庆祝、硬降拖尾、锁定闪光与震屏。
 * 全部用四边形合批的时间函数画出来，不建新纹理；省电模式可由调用方跳过绘制。
 */

export interface 消行特效 {
  行: number[];
  经过秒: number;
  时长秒: number;
  四行: boolean;
}

export interface 拖尾列 {
  列: number;
  底行: number;
}

export interface 拖尾特效 {
  列: 拖尾列[];
  类型: 方块类型;
  距离: number;
  经过秒: number;
  时长秒: number;
}

export interface 锁定特效 {
  格子: readonly [number, number][];
  经过秒: number;
  时长秒: number;
}

export interface 震动特效 {
  经过秒: number;
  时长秒: number;
  强度: number;
}

export interface 特效状态 {
  消行: 消行特效 | null;
  拖尾: 拖尾特效 | null;
  锁定: 锁定特效 | null;
  震动: 震动特效 | null;
  /** 四行庆祝的剩余比例（1→0）。 */
  庆祝: number;
}

export interface 特效开关 {
  /** 关闭时只保留消行闪光这种必要反馈。 */
  开: boolean;
}

const 消行时长秒 = 0.65;
const 四行时长秒 = 0.9;
const 拖尾时长秒 = 0.24;
const 锁定时长秒 = 0.15;
const 震动时长秒 = 0.16;

export function 创建特效状态(): 特效状态 {
  return { 消行: null, 拖尾: null, 锁定: null, 震动: null, 庆祝: 0 };
}

export function 触发消行(特效: 特效状态, 行: readonly number[]): void {
  const 可见行 = 行.filter((行号) => 行号 >= 0 && 行号 < 布局.棋盘.行).slice(0, 4);
  if (!可见行.length) return;
  特效.消行 = {
    行: [...可见行],
    经过秒: 0,
    时长秒: 可见行.length === 4 ? 四行时长秒 : 消行时长秒,
    四行: 可见行.length === 4,
  };
  if (可见行.length === 4) 特效.庆祝 = 1;
}

export function 触发锁定(特效: 特效状态, 格子: readonly [number, number][]): void {
  const 可见 = 格子.filter(([, 行]) => 行 >= 0);
  if (!可见.length) return;
  特效.锁定 = { 格子: 可见, 经过秒: 0, 时长秒: 锁定时长秒 };
}

export function 触发硬降(
  特效: 特效状态,
  原格子: readonly [number, number][],
  距离: number,
  类型: 方块类型,
): void {
  特效.拖尾 = null;
  if (距离 <= 0) return;
  const 列底 = new Map<number, number>();
  for (const [列, 行] of 原格子) {
    if (行 < 0) continue;
    const 底 = 行 + 1;
    const 旧 = 列底.get(列);
    if (旧 === undefined || 底 > 旧) 列底.set(列, 底);
  }
  const 列 = [...列底.entries()].slice(0, 4).map(([列号, 底]) => ({
    列: 列号,
    底行: Math.min(布局.棋盘.行, 底 + 距离),
  }));
  if (!列.length) return;
  特效.拖尾 = { 列, 类型, 距离, 经过秒: 0, 时长秒: 拖尾时长秒 };
}

export function 触发震动(特效: 特效状态, 强度 = 3): void {
  特效.震动 = { 经过秒: 0, 时长秒: 震动时长秒, 强度 };
}

/** 推进特效计时；返回是否还有动画在播（供按需渲染判断）。 */
export function 更新特效(特效: 特效状态, 秒: number): boolean {
  let 活跃 = false;
  if (特效.消行) {
    特效.消行.经过秒 += 秒;
    if (特效.消行.经过秒 >= 特效.消行.时长秒 + 0.12) 特效.消行 = null;
    else 活跃 = true;
  }
  if (特效.拖尾) {
    特效.拖尾.经过秒 += 秒;
    if (特效.拖尾.经过秒 >= 特效.拖尾.时长秒) 特效.拖尾 = null;
    else 活跃 = true;
  }
  if (特效.锁定) {
    特效.锁定.经过秒 += 秒;
    if (特效.锁定.经过秒 >= 特效.锁定.时长秒) 特效.锁定 = null;
    else 活跃 = true;
  }
  if (特效.震动) {
    特效.震动.经过秒 += 秒;
    if (特效.震动.经过秒 >= 特效.震动.时长秒) 特效.震动 = null;
    else 活跃 = true;
  }
  if (特效.庆祝 > 0) {
    特效.庆祝 = Math.max(0, 特效.庆祝 - 秒 / 四行时长秒);
    活跃 = true;
  }
  return 活跃;
}

export function 清空特效(特效: 特效状态): void {
  特效.消行 = null;
  特效.拖尾 = null;
  特效.锁定 = null;
  特效.震动 = null;
  特效.庆祝 = 0;
}

/** 震屏偏移：以落块/四行为触发，指数衰减。 */
export function 读取震动偏移(特效: 特效状态): { x: number; y: number } {
  const 震动 = 特效.震动;
  if (!震动) return { x: 0, y: 0 };
  const 进度 = 震动.经过秒 / 震动.时长秒;
  const 幅度 = 震动.强度 * (1 - 进度) * (1 - 进度);
  return {
    x: Math.sin(震动.经过秒 * 140) * 幅度,
    y: Math.cos(震动.经过秒 * 110) * 幅度 * 0.7,
  };
}

export function 绘制特效(
  环境: 绘制环境,
  特效: 特效状态,
  开关: 特效开关,
  偏移X: number,
  偏移Y: number,
): void {
  const 色 = 环境.主题.颜色;
  const { 左, 上, 格, 列 } = 布局.棋盘;
  const 棋盘左 = 左 + 偏移X;
  const 棋盘上 = 上 + 偏移Y;
  if (特效.拖尾 && 开关.开) 绘制拖尾(环境, 特效.拖尾, 棋盘左, 棋盘上);
  if (特效.消行) {
    const 消行 = 特效.消行;
    for (const [序号, 行号] of 消行.行.entries()) {
      const t = 消行.经过秒 - 序号 * 0.04;
      if (t < 0 || t > 消行.时长秒) continue;
      const 进度 = t / 消行.时长秒;
      const 淡 = 1 - 进度;
      const 行上 = 棋盘上 + 行号 * 格;
      添加矩形(
        环境,
        { 左: 棋盘左, 上: 行上 - 格 * 0.15, 宽: 列 * 格, 高: 格 * 1.3 },
        色.强调,
        淡 * 0.32,
        true,
      );
      添加矩形(
        环境,
        { 左: 棋盘左, 上: 行上, 宽: 列 * 格, 高: 格 },
        0xffffff,
        Math.max(0, 1 - 进度 * 4) * 0.8,
        true,
      );
      const 光宽 = 列 * 格 * Math.min(1, 进度 * 3);
      添加矩形(
        环境,
        {
          左: 棋盘左 + (列 * 格 - 光宽) / 2,
          上: 行上 + 格 * 0.44,
          宽: 光宽,
          高: Math.max(2, 格 * 0.1),
        },
        0xfff0c0,
        淡 * 0.9,
        true,
      );
    }
  }
  if (特效.庆祝 > 0 && 开关.开) {
    const 淡 = 特效.庆祝;
    添加矩形(
      环境,
      { 左: 棋盘左, 上: 棋盘上, 宽: 列 * 格, 高: 布局.棋盘.行 * 格 },
      0xffe6a0,
      淡 * 0.16,
      true,
    );
    const 外框 = { ...棋盘外框, 左: 棋盘外框.左 + 偏移X, 上: 棋盘外框.上 + 偏移Y };
    添加矩形(
      环境,
      { 左: 外框.左 - 2, 上: 外框.上 - 2, 宽: 外框.宽 + 4, 高: 3 },
      0xffdb70,
      淡 * 0.9,
      true,
    );
    添加矩形(
      环境,
      { 左: 外框.左 - 2, 上: 外框.上 + 外框.高 - 1, 宽: 外框.宽 + 4, 高: 3 },
      0xffdb70,
      淡 * 0.9,
      true,
    );
  }
  if (特效.锁定) {
    const 锁定 = 特效.锁定;
    const 淡 = Math.max(0, 1 - 锁定.经过秒 / 锁定.时长秒);
    for (const [列号, 行号] of 锁定.格子) {
      if (行号 < 0 || 行号 >= 布局.棋盘.行) continue;
      添加矩形(
        环境,
        { 左: 棋盘左 + 列号 * 格 + 2, 上: 棋盘上 + 行号 * 格 + 2, 宽: 格 - 4, 高: 格 - 4 },
        0xffffff,
        淡 * 0.55,
        true,
      );
    }
  }
}

function 绘制拖尾(环境: 绘制环境, 拖尾: 拖尾特效, 棋盘左: number, 棋盘上: number): void {
  const 进度 = Math.min(1, 拖尾.经过秒 / 拖尾.时长秒);
  const 高度比 = 1 - 进度 * 进度;
  const 透明 = (1 - 进度) ** 2;
  const 拖尾长 = Math.min(10, 拖尾.距离) * 布局.棋盘.格;
  const 色 = 环境.主题.方块[拖尾.类型];
  for (const { 列, 底行 } of 拖尾.列) {
    const 底 = 棋盘上 + 底行 * 布局.棋盘.格;
    const 长度 = Math.min(底 - 棋盘上, 拖尾长 * 高度比);
    if (长度 <= 1) continue;
    const 段数 = 6;
    for (let 段 = 0; 段 < 段数; 段++) {
      const t = 1 - (段 + 0.5) / 段数;
      const 段高 = 长度 / 段数;
      const 宽 = 布局.棋盘.格 * (0.12 + 0.6 * t) * 透明;
      const y = 底 - 长度 + 段 * 段高;
      添加矩形(
        环境,
        { 左: 棋盘左 + (列 + 0.5) * 布局.棋盘.格 - 宽 / 2, 上: y, 宽, 高: 段高 + 0.5 },
        混合颜色(色, 0xffffff, 0.35 * t),
        t * t * 0.3 * 透明,
        true,
      );
    }
  }
}
