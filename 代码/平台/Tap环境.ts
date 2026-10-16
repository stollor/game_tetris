import type { Tap宿主 } from "./Tap类型";

export interface Tap能力探测 {
  在Tap容器: boolean;
  有文件系统: boolean;
  有云存档: boolean;
  有排行榜: boolean;
  有成就: boolean;
  有登录: boolean;
  用户数据路径: string;
}

export function 读取Tap宿主(
  全局: { tap?: Tap宿主 } = typeof window !== "undefined" ? window : {},
): Tap宿主 | undefined {
  return 全局.tap;
}

/** 探测宿主开放能力；普通浏览器全为 false，不抛错。 */
export function 探测Tap能力(宿主 = 读取Tap宿主()): Tap能力探测 {
  const 在Tap容器 = Boolean(宿主);
  return {
    在Tap容器,
    有文件系统: typeof 宿主?.getFileSystemManager === "function",
    有云存档: typeof 宿主?.getCloudSaveManager === "function",
    有排行榜: typeof 宿主?.getLeaderboardManager === "function",
    有成就: typeof 宿主?.createAchievementManager === "function",
    有登录: typeof 宿主?.login === "function",
    用户数据路径: 宿主?.env?.USER_DATA_PATH ?? "",
  };
}

export function 发布Tap探针(探测: Tap能力探测 = 探测Tap能力()): Tap能力探测 {
  if (typeof window !== "undefined") {
    window.__TAP_PROBE__ = { ...探测, 时间: Date.now() };
  }
  return 探测;
}
