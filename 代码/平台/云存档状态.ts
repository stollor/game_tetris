import { 本地更新时间 } from "./云存档快照";

export type 云同步状态码 = "未知" | "无能力" | "未登录" | "同步中" | "已同步" | "失败" | "跳过";

export interface 云同步状态快照 {
  状态: 云同步状态码;
  原因: string;
  上次成功时间: number | null;
  方向?: "上传" | "下载" | "跳过";
}

const 监听 = new Set<() => void>();
let 快照: 云同步状态快照 = {
  状态: "未知",
  原因: "",
  上次成功时间: null,
};

export function 读取云同步状态(存储?: Storage): 云同步状态快照 {
  const 可用 = 存储 ?? (typeof localStorage !== "undefined" ? localStorage : undefined);
  const 时间 = 快照.上次成功时间 ?? (可用 ? 本地更新时间(可用) || null : 快照.上次成功时间);
  return { ...快照, 上次成功时间: 时间 || 快照.上次成功时间 };
}

export function 更新云同步状态(部分: Partial<云同步状态快照>): 云同步状态快照 {
  快照 = { ...快照, ...部分 };
  for (const fn of [...监听]) {
    try {
      fn();
    } catch {
      /* ignore */
    }
  }
  if (typeof window !== "undefined" && window.__GAME_PLATFORM__) {
    window.__GAME_PLATFORM__.云同步状态 = { ...快照 };
  }
  return { ...快照 };
}

export function 订阅云同步状态(回调: () => void): () => void {
  监听.add(回调);
  return () => 监听.delete(回调);
}

export function 格式化云同步文案(状态: 云同步状态快照, 英文 = false): string {
  const 时 =
    状态.上次成功时间 && Number.isFinite(状态.上次成功时间)
      ? new Date(状态.上次成功时间).toLocaleString("zh-CN", { hour12: false })
      : "";
  if (英文) {
    if (状态.状态 === "同步中") return "Syncing…";
    if (状态.状态 === "已同步") return 时 ? `Synced ${时}` : "Synced";
    if (状态.状态 === "失败") return `Sync failed · ${状态.原因 || "error"}`;
    if (状态.状态 === "未登录") return "Sign in to TapTap to sync";
    if (状态.状态 === "无能力") return "Cloud save unavailable here";
    if (状态.状态 === "跳过") return 状态.原因 || "Skipped";
    return "Cloud save";
  }
  if (状态.状态 === "同步中") return "云存档同步中…";
  if (状态.状态 === "已同步") return 时 ? `云存档已同步 · ${时}` : "云存档已同步";
  if (状态.状态 === "失败") return `云存档失败 · ${状态.原因 || "未知错误"}`;
  if (状态.状态 === "未登录") return "未登录 TapTap，无法同步云存档";
  if (状态.状态 === "无能力") return "当前环境不支持云存档";
  if (状态.状态 === "跳过") return 状态.原因 || "已跳过同步";
  return "云存档";
}
