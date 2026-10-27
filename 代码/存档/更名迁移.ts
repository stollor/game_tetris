/**
 * 2026-10 更名：俄罗斯方块 → 再消一行。
 * 旧设置键和旧成就编号只在这里读取一次，迁移成功后写回新名并删除旧键。
 */

export interface 迁移存储 {
  getItem(键: string): string | null;
  setItem(键: string, 值: string): void;
  removeItem(键: string): void;
}

const 旧设置键 = "俄罗斯方块:设置";
const 新设置键 = "再消一行:设置";
const 成就存档键 = "neon-pulse:achievements";
const 收藏存档键 = "旅行版:收藏";
const 旧四行编号 = "tetris";
const 新四行编号 = "four-lines";

function 是记录(值: unknown): 值 is Record<string, unknown> {
  return typeof 值 === "object" && 值 !== null && !Array.isArray(值);
}

function 读取载荷(原文: string): Record<string, unknown> | null {
  try {
    const 值: unknown = JSON.parse(原文);
    return 是记录(值) ? 值 : null;
  } catch {
    return null;
  }
}

function 迁移设置键(存储: 迁移存储): void {
  if (存储.getItem(新设置键) !== null) return;
  const 原文 = 存储.getItem(旧设置键);
  if (原文 === null) return;
  存储.setItem(新设置键, 原文);
  存储.removeItem(旧设置键);
}

function 迁移主题名称(存储: 迁移存储): void {
  for (const 键 of ["gamemaker:settings", 新设置键]) {
    const 原文 = 存储.getItem(键);
    if (原文 === null) continue;
    const 设置 = 读取载荷(原文);
    if (!设置) continue;
    let 已更改 = false;
    if (设置.样式 === "青蓝未来") {
      设置.样式 = "极光原野";
      已更改 = true;
    }
    if (设置.方块外观 === "默认") {
      设置.方块外观 = "极光原野";
      已更改 = true;
    }
    if (已更改) 存储.setItem(键, JSON.stringify(设置));
  }
}

function 合并成就进度(旧: unknown, 新: unknown): Record<string, unknown> | null {
  if (!是记录(旧)) return null;
  const 进度 = typeof 旧.进度 === "number" ? 旧.进度 : 0;
  const 解锁时间 = typeof 旧.解锁时间 === "number" ? 旧.解锁时间 : null;
  if (!是记录(新)) return { 进度, 解锁时间 };
  const 新进度 = typeof 新.进度 === "number" ? 新.进度 : 0;
  const 新解锁时间 = typeof 新.解锁时间 === "number" ? 新.解锁时间 : null;
  return {
    进度: Math.max(进度, 新进度),
    解锁时间: 新解锁时间 ?? 解锁时间,
  };
}

function 迁移成就存档(存储: 迁移存储): void {
  const 原文 = 存储.getItem(成就存档键);
  if (原文 === null) return;
  const 载荷 = 读取载荷(原文);
  const 数据 = 载荷?.数据;
  if (!载荷 || !是记录(数据) || !(旧四行编号 in 数据)) return;
  const 合并 = 合并成就进度(数据[旧四行编号], 数据[新四行编号]);
  if (合并) 数据[新四行编号] = 合并;
  delete 数据[旧四行编号];
  存储.setItem(成就存档键, JSON.stringify(载荷));
}

function 迁移收藏存档(存储: 迁移存储): void {
  const 原文 = 存储.getItem(收藏存档键);
  if (原文 === null) return;
  const 载荷 = 读取载荷(原文);
  const 数据 = 载荷?.数据;
  if (!载荷 || !是记录(数据) || !Array.isArray(数据.已领成就)) return;
  const 已领成就 = 数据.已领成就;
  if (!已领成就.includes(旧四行编号)) return;
  数据.已领成就 = [...new Set(已领成就.map((项) => (项 === 旧四行编号 ? 新四行编号 : 项)))];
  存储.setItem(收藏存档键, JSON.stringify(载荷));
}

/** 幂等；新旧数据同时存在时取进度较大者并保留更早的解锁时间。 */
export function 迁移更名前存档(存储: 迁移存储): void {
  迁移设置键(存储);
  迁移主题名称(存储);
  迁移成就存档(存储);
  迁移收藏存档(存储);
}

if (typeof localStorage !== "undefined") 迁移更名前存档(localStorage);
