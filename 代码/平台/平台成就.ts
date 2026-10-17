import { 探测Tap能力, 读取Tap宿主 } from "./Tap环境";
import type { Tap成就管理器 } from "./Tap类型";
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

const 状态表 = new Map<string, { 状态: 成就同步状态码; 原因: string; 时间: number }>();
let 管理器: Tap成就管理器 | undefined;

function 取成就管理器(): Tap成就管理器 | undefined {
  if (!探测Tap能力().有成就) return undefined;
  if (!管理器) {
    try {
      管理器 = 读取Tap宿主()?.createAchievementManager?.({ toastEnable: true });
    } catch {
      管理器 = undefined;
    }
  }
  return 管理器;
}

export function 读取成就同步状态(本地编号: string): {
  状态: 成就同步状态码;
  原因: string;
  时间: number;
} {
  const 平台编号 = 平台成就映射[本地编号];
  if (!平台编号) return { 状态: "未映射", 原因: "未配置平台成就 ID", 时间: 0 };
  if (!探测Tap能力().有成就) return { 状态: "无能力", 原因: "当前环境无成就能力", 时间: 0 };
  return 状态表.get(本地编号) ?? { 状态: "待同步", 原因: "", 时间: 0 };
}

export function 成就同步文案(状态: ReturnType<typeof 读取成就同步状态>, 英文 = false): string {
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

export async function 解锁平台成就(本地编号: string): Promise<成就同步结果> {
  const 平台编号 = 平台成就映射[本地编号] ?? "";
  if (!平台编号) {
    return { 本地编号, 平台编号: "", 完成: false, 原因: "未配置平台成就 ID" };
  }
  if (!探测Tap能力().有成就) {
    状态表.set(本地编号, { 状态: "无能力", 原因: "当前环境无成就能力", 时间: Date.now() });
    return { 本地编号, 平台编号, 完成: false, 原因: "当前环境无成就能力" };
  }
  const m = 取成就管理器();
  if (!m?.unlockAchievement) {
    状态表.set(本地编号, { 状态: "无能力", 原因: "成就管理器不可用", 时间: Date.now() });
    return { 本地编号, 平台编号, 完成: false, 原因: "成就管理器不可用" };
  }
  状态表.set(本地编号, { 状态: "同步中", 原因: "", 时间: Date.now() });
  try {
    await new Promise<void>((resolve, reject) => {
      let 已结束 = false;
      const 成功 = () => {
        if (已结束) return;
        已结束 = true;
        resolve();
      };
      const 失败 = (错误: unknown) => {
        if (已结束) return;
        已结束 = true;
        reject(错误 ?? new Error("unlock failed"));
      };
      try {
        m.unlockAchievement!({
          achievementId: 平台编号,
          callback: {
            onAchievementSuccess: 成功,
            onAchievementFailure: 失败,
          },
        });
      } catch (同步错误) {
        失败(同步错误);
        return;
      }
      // 宿主若不回调，短延时后视为请求已发出（兼容旧实现）。
      setTimeout(成功, 120);
    });
    状态表.set(本地编号, { 状态: "已同步", 原因: "已同步到 TapTap", 时间: Date.now() });
    return { 本地编号, 平台编号, 完成: true, 原因: "已同步到 TapTap" };
  } catch (错误) {
    const 原因 =
      typeof 错误 === "object" && 错误 && "message" in 错误
        ? String((错误 as { message: unknown }).message)
        : String(错误);
    const 需登录 = 是未登录错误(undefined, 原因);
    状态表.set(本地编号, { 状态: "失败", 原因, 时间: Date.now() });
    return { 本地编号, 平台编号, 完成: false, 原因, 需登录 };
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
