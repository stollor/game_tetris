import { 探测Tap能力, 读取Tap宿主 } from "./Tap环境";
import type { Tap成就管理器 } from "./Tap类型";
import { 平台成就映射 } from "./配置";

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

export function 同步平台成就(本地编号列表: readonly string[]): void {
  const m = 取成就管理器();
  if (!m?.unlockAchievement) return;
  for (const 本地 of 本地编号列表) {
    const 平台编号 = 平台成就映射[本地];
    if (!平台编号) continue;
    try {
      m.unlockAchievement({ achievementId: 平台编号 });
    } catch {
      /* ignore */
    }
  }
}
