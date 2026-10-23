import { 探测Tap能力, 读取Tap宿主 } from "../../框架Three/平台/TapTap/宿主探测";
import type { Tap成就管理器 } from "../../框架Three/平台/TapTap/宿主类型";
import { 是未登录错误 } from "./登录";
import { 平台成就映射 } from "./配置";

export type 成就同步状态码 = "未映射" | "无能力" | "待同步" | "同步中" | "已同步" | "失败";

export interface 成就同步结果 {
  本地编号: string;
  平台编号: string;
  完成: boolean;
  原因: string;
  需登录?: boolean;
}

type 状态项 = { 状态: 成就同步状态码; 原因: string; 时间: number };

const 存储键 = "旅行版:成就同步";
const 状态表 = new Map<string, 状态项>();
const 监听 = new Set<() => void>();
const 等待中 = new Map<
  string,
  { resolve: (ok: true) => void; reject: (错误: unknown) => void; 本地编号: string }
>();

let 已挂监听的管理器: Tap成就管理器 | undefined;

function 通知(): void {
  for (const fn of [...监听]) {
    try {
      fn();
    } catch {
      /* ignore */
    }
  }
  if (typeof window !== "undefined" && window.__GAME_PLATFORM__) {
    window.__GAME_PLATFORM__.成就同步 = Object.fromEntries(状态表);
  }
}

function 读盘(): void {
  try {
    const 原文 = typeof localStorage !== "undefined" ? localStorage.getItem(存储键) : null;
    if (!原文) return;
    const o = JSON.parse(原文) as Record<string, Partial<状态项>>;
    for (const [键, 值] of Object.entries(o)) {
      if (!值 || typeof 值 !== "object") continue;
      const 状态 = 值.状态;
      if (
        状态 !== "未映射" &&
        状态 !== "无能力" &&
        状态 !== "待同步" &&
        状态 !== "同步中" &&
        状态 !== "已同步" &&
        状态 !== "失败"
      )
        continue;
      状态表.set(键, {
        状态,
        原因: typeof 值.原因 === "string" ? 值.原因 : "",
        时间: typeof 值.时间 === "number" ? 值.时间 : 0,
      });
    }
  } catch {
    /* ignore */
  }
}

function 写盘(): void {
  try {
    if (typeof localStorage === "undefined") return;
    const o: Record<string, 状态项> = {};
    for (const [键, 值] of 状态表) {
      // 同步中不落盘，重启后按待同步重试
      if (值.状态 === "同步中") continue;
      o[键] = 值;
    }
    localStorage.setItem(存储键, JSON.stringify(o));
  } catch {
    /* ignore */
  }
}

读盘();

function 置状态(本地编号: string, 项: 状态项): void {
  状态表.set(本地编号, 项);
  写盘();
  通知();
}

export function 订阅成就同步状态(回调: () => void): () => void {
  监听.add(回调);
  return () => 监听.delete(回调);
}

export function 解释成就失败(代码?: number, 消息?: string): string {
  const 文 = (消息 ?? "").trim();
  const 低 = 文.toLowerCase();
  if (是未登录错误(代码, 文)) return "未登录 TapTap，请在 App 内重新打开游戏";
  if (
    低.includes("pending") ||
    低.includes("publish") ||
    文.includes("待发布") ||
    文.includes("未发布") ||
    文.includes("审核")
  )
    return "成就仍为待发布：请在开发者中心发布，或把账号加为成就测试人员";
  if (
    低.includes("not exist") ||
    低.includes("not found") ||
    文.includes("不存在") ||
    代码 === 500001
  )
    return "平台成就 ID 无效或不存在，请核对配置映射";
  if (低.includes("already") || 文.includes("已解锁") || 文.includes("已经解锁"))
    return "平台侧已解锁";
  if (文) return 文;
  if (代码 != null && Number.isFinite(代码)) return `错误码 ${代码}`;
  return "未知错误";
}

export function 读取成就同步状态(本地编号: string): 状态项 {
  const 平台编号 = 平台成就映射[本地编号];
  if (!平台编号) return { 状态: "未映射", 原因: "未配置平台成就 ID", 时间: 0 };
  if (!探测Tap能力().有成就) return { 状态: "无能力", 原因: "当前环境无成就能力", 时间: 0 };
  return 状态表.get(本地编号) ?? { 状态: "待同步", 原因: "", 时间: 0 };
}

export function 成就同步文案(状态: 状态项, 英文 = false): string {
  if (英文) {
    if (状态.状态 === "已同步") return "Synced to TapTap";
    if (状态.状态 === "失败") return `Tap sync failed · ${状态.原因 || "error"}`;
    if (状态.状态 === "同步中") return "Syncing to TapTap…";
    if (状态.状态 === "无能力") return "Tap achievements unavailable";
    if (状态.状态 === "未映射") return "Not linked";
    return "Pending Tap sync";
  }
  if (状态.状态 === "已同步") return "已同步到 TapTap";
  if (状态.状态 === "失败") return `Tap 同步失败 · ${状态.原因 || "未知错误"}`;
  if (状态.状态 === "同步中") return "正在同步到 TapTap…";
  if (状态.状态 === "无能力") return "当前环境无法同步成就";
  if (状态.状态 === "未映射") return "未对接平台成就";
  return "待同步到 TapTap";
}

function 平台转本地(平台编号: string): string | undefined {
  for (const [本地, 平台] of Object.entries(平台成就映射)) {
    if (平台 === 平台编号) return 本地;
  }
  return undefined;
}

function 确保监听(m: Tap成就管理器): void {
  if (已挂监听的管理器 === m) return;
  已挂监听的管理器 = m;
  const 成功 = (代码或成就?: unknown, 成就?: { achievementId?: string }) => {
    let 平台编号 = "";
    if (成就 && typeof 成就 === "object" && 成就.achievementId)
      平台编号 = String(成就.achievementId);
    else if (代码或成就 && typeof 代码或成就 === "object" && 代码或成就 !== null) {
      const a = 代码或成就 as { achievementId?: string };
      if (a.achievementId) 平台编号 = String(a.achievementId);
    }
    const 待 = (平台编号 ? 等待中.get(平台编号) : undefined) ?? 等待中.values().next().value;
    const 本地 = 待?.本地编号 ?? (平台编号 ? 平台转本地(平台编号) : undefined);
    if (平台编号) 等待中.get(平台编号)?.resolve(true);
    if (平台编号) 等待中.delete(平台编号);
    else {
      // 无 id 时结束最早的等待
      const 首 = 等待中.keys().next().value;
      if (首) {
        等待中.get(首)?.resolve(true);
        等待中.delete(首);
      }
    }
    if (本地) 置状态(本地, { 状态: "已同步", 原因: "已同步到 TapTap", 时间: Date.now() });
  };
  const 失败 = (id或错误?: unknown, 代码?: unknown, 消息?: unknown) => {
    let 平台编号 = "";
    let code: number | undefined;
    let msg = "";
    if (typeof id或错误 === "string") 平台编号 = id或错误;
    else if (id或错误 && typeof id或错误 === "object") {
      const e = id或错误 as {
        id?: string;
        achievementId?: string;
        code?: number;
        message?: string;
        msg?: string;
      };
      平台编号 = String(e.achievementId || e.id || "");
      code = typeof e.code === "number" ? e.code : undefined;
      msg = String(e.message || e.msg || "");
    }
    if (typeof 代码 === "number") code = 代码;
    if (typeof 消息 === "string") msg = 消息;
    else if (typeof 代码 === "string" && !msg) msg = 代码;

    const 解释 = 解释成就失败(code, msg);
    const 已解锁 = 解释 === "平台侧已解锁";
    const 待 = 平台编号 ? 等待中.get(平台编号) : undefined;
    const 本地 = 待?.本地编号 ?? (平台编号 ? 平台转本地(平台编号) : undefined);
    if (平台编号 && 待) {
      if (已解锁) 待.resolve(true);
      else 待.reject(Object.assign(new Error(解释), { 代码: code }));
      等待中.delete(平台编号);
    }
    if (本地) {
      置状态(本地, {
        状态: 已解锁 ? "已同步" : "失败",
        原因: 已解锁 ? "已同步到 TapTap（平台侧已解锁）" : 解释,
        时间: Date.now(),
      });
    }
  };

  try {
    m.registerListener?.({
      onAchievementSuccess: 成功,
      onAchievementFailure: 失败,
    });
  } catch {
    /* 旧宿主可能无 registerListener */
  }
}

function 取成就管理器(): Tap成就管理器 | undefined {
  if (!探测Tap能力().有成就) return undefined;
  let 管理器: Tap成就管理器 | undefined;
  try {
    // 每次向宿主取；真机 createAchievementManager 全局单例，测试里可换 mock。
    管理器 = 读取Tap宿主()?.createAchievementManager?.({ toastEnable: true });
  } catch {
    管理器 = undefined;
  }
  if (管理器) 确保监听(管理器);
  return 管理器;
}

export async function 解锁平台成就(本地编号: string, 强制 = false): Promise<成就同步结果> {
  const 平台编号 = 平台成就映射[本地编号] ?? "";
  if (!平台编号) {
    return { 本地编号, 平台编号: "", 完成: false, 原因: "未配置平台成就 ID" };
  }
  if (!探测Tap能力().有成就) {
    置状态(本地编号, { 状态: "无能力", 原因: "当前环境无成就能力", 时间: Date.now() });
    return { 本地编号, 平台编号, 完成: false, 原因: "当前环境无成就能力" };
  }
  const 现 = 状态表.get(本地编号);
  if (!强制 && 现?.状态 === "已同步") {
    return { 本地编号, 平台编号, 完成: true, 原因: 现.原因 || "已同步到 TapTap" };
  }
  const m = 取成就管理器();
  if (!m?.unlockAchievement) {
    置状态(本地编号, { 状态: "无能力", 原因: "成就管理器不可用", 时间: Date.now() });
    return { 本地编号, 平台编号, 完成: false, 原因: "成就管理器不可用" };
  }
  置状态(本地编号, { 状态: "同步中", 原因: "", 时间: Date.now() });
  try {
    await new Promise<void>((resolve, reject) => {
      let 已结束 = false;
      const 成功 = () => {
        if (已结束) return;
        已结束 = true;
        等待中.delete(平台编号);
        resolve();
      };
      const 失败 = (错误: unknown) => {
        if (已结束) return;
        已结束 = true;
        等待中.delete(平台编号);
        reject(错误 ?? new Error("unlock failed"));
      };
      等待中.set(平台编号, {
        本地编号,
        resolve: () => 成功(),
        reject: 失败,
      });
      try {
        // 官方文档结果走 registerListener；部分宿主仍支持 option.callback，两者都接。
        m.unlockAchievement!({
          achievementId: 平台编号,
          callback: {
            onAchievementSuccess: 成功,
            onAchievementFailure: (错误) => {
              const 原始消息 =
                错误 instanceof Error
                  ? 错误.message
                  : typeof 错误 === "object" && 错误 && "message" in 错误
                    ? String((错误 as { message: unknown }).message)
                    : String(错误);
              const 解释 = 解释成就失败(undefined, 原始消息);
              if (解释 === "平台侧已解锁") 成功();
              else 失败(Object.assign(new Error(解释), { 原始: 错误 }));
            },
          },
        });
      } catch (同步错误) {
        失败(同步错误);
        return;
      }
      // 真机以监听/回调为准；超时标失败，避免假成功。
      setTimeout(() => {
        if (已结束) return;
        失败(new Error("平台无响应，请稍后在成就页重试或检查成就是否已发布"));
      }, 8000);
    });
    置状态(本地编号, { 状态: "已同步", 原因: "已同步到 TapTap", 时间: Date.now() });
    return { 本地编号, 平台编号, 完成: true, 原因: "已同步到 TapTap" };
  } catch (错误) {
    const 原因 =
      错误 instanceof Error
        ? 错误.message
        : typeof 错误 === "object" && 错误 && "message" in 错误
          ? String((错误 as { message: unknown }).message)
          : String(错误);
    const 解释 = 解释成就失败(
      typeof (错误 as { 代码?: number })?.代码 === "number"
        ? (错误 as { 代码: number }).代码
        : undefined,
      原因,
    );
    const 需登录 = 是未登录错误(undefined, 解释);
    const 已解锁 = 解释 === "平台侧已解锁";
    置状态(本地编号, {
      状态: 已解锁 ? "已同步" : "失败",
      原因: 已解锁 ? "已同步到 TapTap（平台侧已解锁）" : 解释,
      时间: Date.now(),
    });
    return {
      本地编号,
      平台编号,
      完成: 已解锁,
      原因: 已解锁 ? "已同步到 TapTap（平台侧已解锁）" : 解释,
      需登录,
    };
  }
}

/** 批量解锁；保留旧同步接口，内部走 Promise。 */
export function 同步平台成就(本地编号列表: readonly string[]): void {
  for (const 本地 of 本地编号列表) {
    void 解锁平台成就(本地);
  }
}

export async function 同步平台成就并回报(本地编号列表: readonly string[]): Promise<成就同步结果[]> {
  const 结果: 成就同步结果[] = [];
  for (const 本地 of 本地编号列表) 结果.push(await 解锁平台成就(本地));
  return 结果;
}

/** 成就页打开时：对本地已解锁但未标记已同步的项补同步。 */
export async function 补同步已解锁成就(本地已解锁编号: readonly string[]): Promise<成就同步结果[]> {
  const 待 = 本地已解锁编号.filter((编号) => {
    if (!平台成就映射[编号]) return false;
    const s = 读取成就同步状态(编号).状态;
    return s === "待同步" || s === "失败";
  });
  return 同步平台成就并回报(待);
}
