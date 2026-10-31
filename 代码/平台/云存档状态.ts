import { 按英文取文案 } from "../语言/文案";
import { 填充文案 } from "../语言/类型";
import { 本地更新时间 } from "./云存档快照";
import { 格式化用户身份文案, 读取Tap用户身份 } from "./用户身份";

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
  const 文案 = 按英文取文案(英文);
  const 时 =
    状态.上次成功时间 && Number.isFinite(状态.上次成功时间)
      ? new Date(状态.上次成功时间).toLocaleString(英文 ? "en-US" : "zh-CN", { hour12: false })
      : "";
  const 用户 = 格式化用户身份文案(读取Tap用户身份(), 英文);
  const 附 = (主: string) => (用户 ? 填充文案(文案.云同步附带, { 主, 用户 }) : 主);
  if (状态.状态 === "同步中") return 附(文案.云同步中);
  if (状态.状态 === "已同步")
    return 附(时 ? 填充文案(文案.云同步已同步时间, { 时间: 时 }) : 文案.云同步已同步);
  if (状态.状态 === "失败")
    return 附(填充文案(文案.云同步失败, { 原因: 状态.原因 || 文案.未知错误 }));
  if (状态.状态 === "未登录") return 文案.云同步未登录;
  if (状态.状态 === "无能力") return 文案.云同步无能力;
  if (状态.状态 === "跳过") return 附(状态.原因 || 文案.云同步跳过);
  return 附(文案.云同步默认);
}
