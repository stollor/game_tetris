import { 探测Tap能力, 读取Tap宿主 } from "./Tap环境";
import type { Tap排行榜管理器 } from "./Tap类型";
import { 排行榜编号 } from "./配置";

const 存储键 = "旅行版:Tap用户";

export interface Tap用户身份 {
  openid: string;
  nickName: string;
  来源: string;
  更新时间: number;
}

const 监听 = new Set<() => void>();
let 缓存: Tap用户身份 = { openid: "", nickName: "", 来源: "", 更新时间: 0 };

function 读本地(): Tap用户身份 {
  try {
    const 原文 =
      typeof localStorage !== "undefined" ? localStorage.getItem(存储键) : null;
    if (!原文) return { openid: "", nickName: "", 来源: "", 更新时间: 0 };
    const o = JSON.parse(原文) as Partial<Tap用户身份>;
    return {
      openid: typeof o.openid === "string" ? o.openid : "",
      nickName: typeof o.nickName === "string" ? o.nickName : "",
      来源: typeof o.来源 === "string" ? o.来源 : "",
      更新时间: typeof o.更新时间 === "number" ? o.更新时间 : 0,
    };
  } catch {
    return { openid: "", nickName: "", 来源: "", 更新时间: 0 };
  }
}

function 写本地(身份: Tap用户身份): void {
  缓存 = 身份;
  try {
    if (typeof localStorage !== "undefined") localStorage.setItem(存储键, JSON.stringify(身份));
  } catch {
    /* ignore */
  }
  for (const fn of [...监听]) {
    try {
      fn();
    } catch {
      /* ignore */
    }
  }
  if (typeof window !== "undefined" && window.__GAME_PLATFORM__) {
    window.__GAME_PLATFORM__.用户身份 = { ...身份 };
  }
}

缓存 = 读本地();

export function 读取Tap用户身份(): Tap用户身份 {
  return { ...缓存 };
}

export function 订阅Tap用户身份(回调: () => void): () => void {
  监听.add(回调);
  return () => 监听.delete(回调);
}

/** 从排行榜/其它回调写入 openid 或昵称。 */
export function 记录Tap用户身份(部分: {
  openid?: string;
  nickName?: string;
  来源?: string;
}): Tap用户身份 {
  const 下一: Tap用户身份 = {
    openid: (部分.openid || 缓存.openid || "").trim(),
    nickName: (部分.nickName || 缓存.nickName || "").trim(),
    来源: 部分.来源 || 缓存.来源 || "",
    更新时间: Date.now(),
  };
  if (下一.openid === 缓存.openid && 下一.nickName === 缓存.nickName) {
    return { ...缓存 };
  }
  写本地(下一);
  return { ...下一 };
}

export function 格式化用户身份文案(身份 = 读取Tap用户身份(), 英文 = false): string {
  if (身份.openid) return 英文 ? `ID ${身份.openid}` : `用户ID ${身份.openid}`;
  if (身份.nickName) return 英文 ? `User ${身份.nickName}` : `用户 ${身份.nickName}`;
  return "";
}

function 取排行榜管理器(): Tap排行榜管理器 | undefined {
  if (!探测Tap能力().有排行榜) return undefined;
  try {
    return 读取Tap宿主()?.getLeaderboardManager?.();
  } catch {
    return undefined;
  }
}

/** 尽力拉取 openid（排行榜我的成绩）与昵称（getUserInfo）。无服务端时拿不到 code2Session 的 openid。 */
export async function 刷新Tap用户身份(): Promise<Tap用户身份> {
  const 能力 = 探测Tap能力();
  if (!能力.在Tap容器) return 读取Tap用户身份();

  const 宿主 = 读取Tap宿主();
  if (宿主?.getUserInfo) {
    await new Promise<void>((resolve) => {
      try {
        宿主.getUserInfo!({
          success: (res) => {
            const nick = res?.userInfo?.nickName || res?.userInfo?.nickname || "";
            if (nick) 记录Tap用户身份({ nickName: nick, 来源: "getUserInfo" });
            resolve();
          },
          fail: () => resolve(),
        });
      } catch {
        resolve();
      }
    });
  }

  const 管理器 = 取排行榜管理器();
  const 编号 = 排行榜编号.马拉松;
  if (管理器?.loadCurrentPlayerLeaderboardScore && 编号) {
    await new Promise<void>((resolve) => {
      try {
        管理器.loadCurrentPlayerLeaderboardScore!({
          leaderboardId: 编号,
          collection: "public",
          callback: {
            onSuccess: (res) => {
              const 我 = (res as { currentUserScore?: { user?: { openid?: string; name?: string } } })
                ?.currentUserScore?.user;
              if (我?.openid || 我?.name) {
                记录Tap用户身份({
                  openid: 我.openid,
                  nickName: 我.name,
                  来源: "leaderboard",
                });
              }
              resolve();
            },
            onFailure: () => resolve(),
          },
        });
      } catch {
        resolve();
      }
    });
  }

  return 读取Tap用户身份();
}
