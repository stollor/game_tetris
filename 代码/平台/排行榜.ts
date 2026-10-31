import { 探测Tap能力, 读取Tap宿主 } from "../../.gamemaker/依赖/框架/平台/TapTap/宿主探测";
import type {
  Tap当前玩家分数结果,
  Tap排行榜分数,
  Tap排行榜分数结果,
  Tap排行榜周期,
} from "../../.gamemaker/依赖/框架/平台/TapTap/宿主类型";
import type { 游戏模式 } from "../玩法/再消一行";
import { 按英文取文案 } from "../语言/文案";
import { 填充文案, type 游戏文案 } from "../语言/类型";
import { 记录Tap用户身份 } from "./用户身份";
import { 是未登录错误 } from "./登录";
import { type 排行榜周期, 排行榜周期顺序, 排行榜编号, 排行榜编号按周期 } from "./配置";

export type { 排行榜周期 };
export { 排行榜周期顺序 };

export function 排行榜分数(
  模式: 游戏模式,
  分数: number,
  用时毫秒: number | null,
  完赛: boolean,
): number | null {
  if (模式 === "冲刺") {
    // 冲刺榜为后台「时间型」升序：score 提交毫秒整数（非秒），UI 会格式化为时分秒。
    if (!完赛 || 用时毫秒 == null || !(用时毫秒 > 0)) return null;
    return Math.round(用时毫秒);
  }
  if (!Number.isFinite(分数) || 分数 < 0) return null;
  return Math.floor(分数);
}

export function 取排行榜编号(模式: 游戏模式, 周期: 排行榜周期 = "总"): string {
  const 表 = 排行榜编号按周期[模式];
  if (!表) return "";
  return 表[周期] ?? "";
}

/** 兼容旧调用：默认总榜。 */
export function 取默认排行榜编号(模式: 游戏模式): string {
  return 排行榜编号[模式] ?? 取排行榜编号(模式, "总");
}

export function 已配置的周期(模式: 游戏模式): 排行榜周期[] {
  return 排行榜周期顺序.filter((周期) => Boolean(取排行榜编号(模式, 周期)));
}

/** 周期页签与文案里的周期标签（日榜/周榜/月榜/总榜）统一从这里取。 */
export function 周期标签(周期: 排行榜周期, 文案: 游戏文案): string {
  if (周期 === "日") return 文案.排行榜周期日;
  if (周期 === "周") return 文案.排行榜周期周;
  if (周期 === "月") return 文案.排行榜周期月;
  return 文案.排行榜周期总;
}

export function 格式化榜分数(模式: 游戏模式, 分: number | null | undefined): string {
  if (分 == null || !Number.isFinite(分)) return "—";
  if (模式 === "冲刺") {
    const 秒 = 分 / 1000;
    return `${秒.toFixed(2)}s`;
  }
  return Math.floor(分).toLocaleString();
}

export function 格式化排行榜错误(代码: number | undefined, 原始: string, 英文 = false): string {
  const 文案 = 按英文取文案(英文);
  const 文 = 原始 || "";
  const 码 = Number.isFinite(代码) ? 代码 : Number((文.match(/^(\d{3,6})/) || [])[1]);
  if (码 === 500001 || /not exist|未找到|不存在/i.test(文)) return 文案.排行榜错误白名单;
  if (码 === 500002 || /不匹配|mismatch|参数错误/i.test(文)) return 文案.排行榜错误不匹配;
  if (码 === 500000 || /过期|expired/i.test(文)) return 文案.排行榜错误周期结束;
  if (码 === 500102 || /未登录|not.?login|login/i.test(文)) return 文案.排行榜错误未登录;
  if (码 === 500101) return 文案.排行榜错误无权限;
  // 去掉裸 code:message，保留可读摘要
  const 去码 = 文.replace(/^\d{3,6}:\s*/, "").trim();
  return 去码 ? 填充文案(文案.排行榜错误带原因, { 原因: 去码 }) : 文案.排行榜错误加载失败;
}

export interface 排行操作结果 {
  完成: boolean;
  原因: string;
  需登录?: boolean;
  代码?: number;
}

async function 提交到编号(编号: string, 分: number, 文案: 游戏文案): Promise<排行操作结果> {
  if (!探测Tap能力().有排行榜) return { 完成: false, 原因: 文案.排行榜无能力 };
  const 管理器 = 读取Tap宿主()?.getLeaderboardManager?.();
  if (!管理器) return { 完成: false, 原因: 文案.排行榜管理器不可用 };
  try {
    await new Promise<void>((resolve, reject) => {
      管理器.submitScores({
        scores: [{ leaderboardId: 编号, score: 分 }],
        callback: {
          onSuccess: () => resolve(),
          onFailure: (代码, 消息) => {
            const err = new Error(`${代码}:${消息}`) as Error & { 代码?: number };
            err.代码 = 代码;
            reject(err);
          },
        },
      });
    });
    return { 完成: true, 原因: 文案.排行榜已提交 };
  } catch (e) {
    const 消息 = e instanceof Error ? e.message : String(e);
    const 代码 = Number((e as { 代码?: number })?.代码);
    return {
      完成: false,
      原因: 消息,
      代码: Number.isFinite(代码) ? 代码 : undefined,
      需登录: 是未登录错误(代码, 消息),
    };
  }
}

export async function 提交模式分数(
  模式: 游戏模式,
  分数: number,
  用时毫秒: number | null,
  完赛: boolean,
  英文 = false,
): Promise<排行操作结果> {
  const 文案 = 按英文取文案(英文);
  const 分 = 排行榜分数(模式, 分数, 用时毫秒, 完赛);
  if (分 == null) return { 完成: false, 原因: 文案.排行榜无有效分数 };
  const 周期列表 = 已配置的周期(模式);
  if (!周期列表.length) return { 完成: false, 原因: 文案.排行榜编号未配置 };
  // 同一成绩写入该模式已配置的全部周期榜（日/周/月/总各自独立 ID）。
  const 结果列表: 排行操作结果[] = [];
  for (const 周期 of 周期列表) {
    const 编号 = 取排行榜编号(模式, 周期);
    结果列表.push(await 提交到编号(编号, 分, 文案));
  }
  const 成功 = 结果列表.filter((r) => r.完成).length;
  if (成功 === 结果列表.length)
    return { 完成: true, 原因: 填充文案(文案.排行榜已提交, { 数量: 成功 }) };
  if (成功 > 0)
    return {
      完成: true,
      原因: 填充文案(文案.排行榜部分提交, { 成功, 总数: 结果列表.length }),
    };
  return 结果列表[0] ?? { 完成: false, 原因: 文案.排行榜提交失败 };
}

export function 打开排行榜(
  模式: 游戏模式 = "马拉松",
  周期: 排行榜周期 = "总",
  英文 = false,
): Promise<排行操作结果> {
  const 文案 = 按英文取文案(英文);
  const 编号 = 取排行榜编号(模式, 周期) || 取默认排行榜编号(模式);
  if (!编号) return Promise.resolve({ 完成: false, 原因: 文案.排行榜编号未配置 });
  if (!探测Tap能力().有排行榜)
    return Promise.resolve({ 完成: false, 原因: 文案.排行榜无能力 });
  const 管理器 = 读取Tap宿主()?.getLeaderboardManager?.();
  if (!管理器) return Promise.resolve({ 完成: false, 原因: 文案.排行榜管理器不可用 });
  return new Promise((resolve) => {
    管理器.openLeaderboard({
      leaderboardId: 编号,
      callback: {
        onSuccess: () => resolve({ 完成: true, 原因: 文案.排行榜已打开 }),
        onFailure: (代码, 消息) =>
          resolve({
            完成: false,
            原因: 格式化排行榜错误(代码, `${代码}:${消息}`, 英文),
            代码,
            需登录: 是未登录错误(代码, 消息),
          }),
      },
    });
  });
}

export interface 加载排行榜选项 {
  模式: 游戏模式;
  周期?: 排行榜周期;
  /** 覆盖周期榜的历史实例；空表示当前周期。 */
  periodToken?: string;
  条数?: number;
  /** 头像/状态文案的语言：只影响返回文案，不影响查询。 */
  英文?: boolean;
}

export interface 加载排行榜结果 extends 排行操作结果 {
  分数列表: Tap排行榜分数[];
  我的?: Tap排行榜分数 | null;
  可用周期: Tap排行榜周期[];
  当前周期展示?: string;
  编号: string;
}

export async function 加载排行榜数据(选项: 加载排行榜选项): Promise<加载排行榜结果> {
  const 英文 = 选项.英文 ?? false;
  const 文案 = 按英文取文案(英文);
  const 周期 = 选项.周期 ?? "总";
  const 编号 = 取排行榜编号(选项.模式, 周期);
  const 空: 加载排行榜结果 = {
    完成: false,
    原因: "",
    分数列表: [],
    可用周期: [],
    编号,
  };
  if (!编号) {
    return {
      ...空,
      原因: 填充文案(文案.排行榜周期未配置, {
        模式: 选项.模式,
        周期: 周期标签(周期, 文案),
      }),
    };
  }
  if (!探测Tap能力().有排行榜) {
    return { ...空, 原因: 文案.排行榜无能力提示 };
  }
  const 管理器 = 读取Tap宿主()?.getLeaderboardManager?.();
  if (!管理器?.loadLeaderboardScores) {
    return { ...空, 原因: 文案.排行榜查询不可用 };
  }

  // 文档：无重置周期传空或不传；有重置周期时空表示当前周期。避免显式传 "" 触发部分宿主异常。
  const periodToken = (选项.periodToken ?? "").trim();
  const 条数 = Math.min(50, Math.max(1, 选项.条数 ?? 20));

  try {
    const 列表结果 = await new Promise<Tap排行榜分数结果>((resolve, reject) => {
      const 参数: {
        leaderboardId: string;
        continuationToken: string;
        maxSize: number;
        collection: "public";
        periodToken?: string;
        callback: {
          onSuccess: (res: unknown) => void;
          onFailure: (代码: number, 消息: string) => void;
        };
      } = {
        leaderboardId: 编号,
        continuationToken: "",
        maxSize: 条数,
        collection: "public",
        callback: {
          onSuccess: (res) => resolve((res ?? {}) as Tap排行榜分数结果),
          onFailure: (代码, 消息) => {
            const err = new Error(`${代码}:${消息}`) as Error & { 代码?: number };
            err.代码 = 代码;
            reject(err);
          },
        },
      };
      if (periodToken) 参数.periodToken = periodToken;
      管理器.loadLeaderboardScores!(参数);
    });

    let 我的: Tap排行榜分数 | null | undefined;
    if (管理器.loadCurrentPlayerLeaderboardScore) {
      try {
        const 我 = await new Promise<Tap当前玩家分数结果>((resolve, reject) => {
          const 参数: {
            leaderboardId: string;
            collection: "public";
            periodToken?: string;
            callback: {
              onSuccess: (res: unknown) => void;
              onFailure: (代码: number, 消息: string) => void;
            };
          } = {
            leaderboardId: 编号,
            collection: "public",
            callback: {
              onSuccess: (res) => resolve((res ?? {}) as Tap当前玩家分数结果),
              onFailure: (代码, 消息) => {
                const err = new Error(`${代码}:${消息}`) as Error & { 代码?: number };
                err.代码 = 代码;
                reject(err);
              },
            },
          };
          if (periodToken) 参数.periodToken = periodToken;
          管理器.loadCurrentPlayerLeaderboardScore!(参数);
        });
        我的 = 我.currentUserScore ?? null;
        if (我的?.user?.openid || 我的?.user?.name) {
          记录Tap用户身份({
            openid: 我的.user.openid,
            nickName: 我的.user.name,
            来源: "leaderboard",
          });
        }
      } catch {
        我的 = null;
      }
    }

    const 可用周期 = 列表结果.leaderboard?.availablePeriods ?? [];
    return {
      完成: true,
      原因: 文案.排行榜已加载,
      分数列表: 列表结果.scores ?? [],
      我的,
      可用周期,
      当前周期展示: 列表结果.leaderboard?.period?.display || undefined,
      编号,
    };
  } catch (e) {
    const 消息 = e instanceof Error ? e.message : String(e);
    const 代码 = Number((e as { 代码?: number })?.代码);
    const 友好 = 格式化排行榜错误(Number.isFinite(代码) ? 代码 : undefined, 消息, 英文);
    return {
      ...空,
      原因: 友好,
      代码: Number.isFinite(代码) ? 代码 : undefined,
      需登录: 是未登录错误(代码, 消息),
    };
  }
}

export function 尝试提交排行榜(
  模式: 游戏模式,
  分数: number,
  用时毫秒: number | null,
  完赛: boolean,
): void {
  void 提交模式分数(模式, 分数, 用时毫秒, 完赛).catch(() => {
    /* ignore */
  });
}
