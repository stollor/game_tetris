import { 收藏存档键 } from "../存档/收藏";
import { Tap应用 } from "./配置";

export const 云快照版本 = 1 as const;

const 固定键 = [收藏存档键, "neon-pulse:achievements"] as const;

export interface 云存档快照 {
  version: typeof 云快照版本;
  updatedAt: number;
  clientId: string;
  /** localStorage 原文，保证往返不丢字段。 */
  keys: Record<string, string>;
}

export function 收集本地键(存储: Storage, 现在 = Date.now): 云存档快照 {
  const keys: Record<string, string> = {};
  for (const 键 of 固定键) {
    const 值 = 存储.getItem(键);
    if (值 !== null) keys[键] = 值;
  }
  for (let i = 0; i < 存储.length; i++) {
    const 键 = 存储.key(i);
    if (!键) continue;
    if (键.startsWith("neon-pulse:best:") || 键.startsWith("neon-pulse:daily:")) {
      const 值 = 存储.getItem(键);
      if (值 !== null) keys[键] = 值;
    }
  }
  return {
    version: 云快照版本,
    updatedAt: 现在(),
    clientId: Tap应用.ClientID,
    keys,
  };
}

export function 序列化快照(快照: 云存档快照): string {
  return JSON.stringify(快照);
}

export function 解析快照(原文: string): 云存档快照 | null {
  try {
    const 值: unknown = JSON.parse(原文);
    if (!值 || typeof 值 !== "object") return null;
    const o = 值 as Partial<云存档快照>;
    if (o.version !== 云快照版本) return null;
    if (!Number.isFinite(o.updatedAt) || typeof o.clientId !== "string") return null;
    if (!o.keys || typeof o.keys !== "object" || Array.isArray(o.keys)) return null;
    const keys: Record<string, string> = {};
    for (const [k, v] of Object.entries(o.keys)) {
      if (typeof v === "string") keys[k] = v;
    }
    return { version: 云快照版本, updatedAt: Number(o.updatedAt), clientId: o.clientId, keys };
  } catch {
    return null;
  }
}

/** 将云端键写回本地；返回写入条数。不清除本地未出现在快照中的键。 */
export function 应用快照到本地(存储: Storage, 快照: 云存档快照): number {
  let n = 0;
  for (const [键, 值] of Object.entries(快照.keys)) {
    存储.setItem(键, 值);
    n++;
  }
  return n;
}

export function 本地更新时间(存储: Storage): number {
  const 标记 = 存储.getItem("旅行版:云同步标记");
  if (标记) {
    try {
      const o = JSON.parse(标记) as { updatedAt?: number };
      if (Number.isFinite(o.updatedAt)) return Number(o.updatedAt);
    } catch {
      /* ignore */
    }
  }
  return 0;
}

export function 标记本地同步时间(存储: Storage, 时间 = Date.now()): void {
  存储.setItem("旅行版:云同步标记", JSON.stringify({ updatedAt: 时间 }));
}
