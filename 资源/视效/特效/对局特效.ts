import type { 方块类型 } from "../../../代码/玩法/再消一行";
import type { 绘制环境 } from "../../../代码/页面/对局/对局图元";
import { 布局 } from "../../../代码/页面/对局/操作布局";
import type { 对局布局数据 } from "../../../代码/页面/布局/对局布局";
import {
  绘制四行庆祝,
  绘制消行光带,
  绘制落块拖尾,
  绘制锁定闪光,
  读取对局震屏偏移,
} from "./消行配方";

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

export const 消行时长秒 = 0.65;
export const 四行时长秒 = 0.9;
export const 拖尾时长秒 = 0.24;
export const 锁定时长秒 = 0.15;

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

export function 触发震动(特效: 特效状态, 强度 = 2.5, 时长秒 = 0.15): void {
  特效.震动 = { 经过秒: 0, 时长秒, 强度 };
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
  const 镜头 = 读取对局震屏偏移(震动.经过秒, 震动.时长秒, 震动.强度);
  return { x: -镜头.x, y: -镜头.y };
}

export function 绘制特效(
  环境: 绘制环境,
  特效: 特效状态,
  开关: 特效开关,
  偏移X: number,
  偏移Y: number,
  对局定位?: 对局布局数据,
): void {
  const 色 = 环境.主题.颜色;
  const { 左, 上 } = 对局定位?.棋盘 ?? 布局.棋盘;
  const 格 = 对局定位?.格子大小 ?? 布局.棋盘.格;
  const 棋盘左 = 左 + 偏移X;
  const 棋盘上 = 上 + 偏移Y;
  if (特效.拖尾 && 开关.开) {
    const 拖尾 = 特效.拖尾;
    const 进度 = Math.min(1, 拖尾.经过秒 / 拖尾.时长秒);
    const 拖尾长 = Math.min(10, 拖尾.距离) * 格;
    绘制落块拖尾(环境.图形, {
      列: 拖尾.列.map(({ 列, 底行 }) => {
        const 底 = 底行 * 格;
        return { 列, 底, 初始高度: Math.min(底, 拖尾长) };
      }),
      色: 环境.主题.方块[拖尾.类型],
      格,
      进度,
      拖尾长,
      左: 棋盘左,
      上: 棋盘上,
    });
  }
  if (特效.消行) {
    const 消行 = 特效.消行;
    绘制消行光带(环境.图形, {
      行: 消行.行,
      时间毫秒: 消行.经过秒 * 1000,
      格,
      强调色: 色.强调,
      左: 棋盘左,
      上: 棋盘上,
    });
  }
  if (特效.庆祝 > 0 && 开关.开) {
    const 时长毫秒 = 四行时长秒 * 1000;
    const 时间毫秒 = (1 - 特效.庆祝) * 时长毫秒;
    绘制四行庆祝(环境.图形, {
      时间毫秒,
      时长毫秒,
      格,
      扫过起点: Math.max(
        0,
        Math.min(...(特效.消行?.行 ?? [布局.棋盘.行 - 1])) * 格 * (1 - 时间毫秒 / 600),
      ),
      左: 棋盘左,
      上: 棋盘上,
    });
  }
  if (特效.锁定) {
    const 锁定 = 特效.锁定;
    绘制锁定闪光(环境.图形, {
      格子: 锁定.格子,
      格,
      透明度: Math.max(0, 1 - 锁定.经过秒 / 锁定.时长秒),
      左: 棋盘左,
      上: 棋盘上,
    });
  }
}
