import { 创建俄罗斯方块成就, 成就定义 } from "../成就/俄罗斯方块成就";

export type 基础背景 = "晨光海岸" | "云海山岚" | "极光原野" | "霓虹天际";
export const 基础背景列表: readonly 基础背景[] = ["晨光海岸", "云海山岚", "极光原野", "霓虹天际"];
/** 新存档只默认开放这两张；其余基础背景靠成就解锁，旅行地点背景靠商店购买。 */
export const 默认解锁背景: readonly 基础背景[] = ["云海山岚", "极光原野"];
/** 解锁所需的已得成就数量。 */
export const 背景解锁成就数: Record<基础背景, number> = {
  云海山岚: 0,
  极光原野: 0,
  晨光海岸: 3,
  霓虹天际: 6,
};
const 保留键 = "旅行版:基础背景保留";
const 旧存档键 = [
  "俄罗斯方块:设置",
  "gamemaker:settings",
  "旅行版:收藏",
  "neon-pulse:achievements",
];

export function 是基础背景(值: unknown): 值 is 基础背景 {
  return typeof 值 === "string" && (基础背景列表 as readonly string[]).includes(值);
}

/** 本版之前已有存档的玩家保留全部基础背景，不收回已能使用的内容；新玩家不写入保留。只执行一次。 */
export function 迁移基础背景(存储: Storage): void {
  try {
    if (存储.getItem(保留键) !== null) return;
    const 老玩家 = 旧存档键.some((键) => 存储.getItem(键) !== null);
    存储.setItem(保留键, JSON.stringify(老玩家 ? 基础背景列表 : []));
  } catch {
    /* 存储不可用时按新玩家处理。 */
  }
}

function 读取保留(存储: Storage): string[] {
  try {
    const 值: unknown = JSON.parse(存储.getItem(保留键) ?? "[]");
    return Array.isArray(值) ? 值.filter((项): 项 is string => typeof 项 === "string") : [];
  } catch {
    return [];
  }
}

export function 已得成就数(): number {
  try {
    const 系统 = 创建俄罗斯方块成就();
    return 成就定义.filter((a) => 系统.读取(a.编号).解锁时间 !== null).length;
  } catch {
    return 0;
  }
}

export function 基础背景已解锁(
  背景: 基础背景,
  存储: Storage,
  成就数: number | (() => number) = 已得成就数,
): boolean {
  if (默认解锁背景.includes(背景)) return true;
  if (读取保留(存储).includes(背景)) return true;
  return (typeof 成就数 === "function" ? 成就数() : 成就数) >= 背景解锁成就数[背景];
}
