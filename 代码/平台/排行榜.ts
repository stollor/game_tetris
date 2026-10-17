import type { 游戏模式 } from "../玩法/俄罗斯方块";
import { 探测Tap能力, 读取Tap宿主 } from "./Tap环境";
import type {
  Tap当前玩家分数结果,
  Tap排行榜分数,
  Tap排行榜分数结果,
  Tap排行榜周期,
} from "./Tap类型";
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

export function 格式化榜分数(模式: 游戏模式, 分: number | null | undefined): string {
  if (分 == null || !Number.isFinite(分)) return "—";
  if (模式 === "冲刺") {
    const 秒 = 分 / 1000;
    return `${秒.toFixed(2)}s`;
  }
  return Math.floor(分).toLocaleString();
}

export interface 排行操作结果 {
  完成: boolean;
  原因: string;
  需登录?: boolean;
  代码?: number;
}

async function 提交到编号(编号: string, 分: number): Promise<排行操作结果> {
  if (!探测Tap能力().有排行榜) return { 完成: false, 原因: "当前环境无排行榜能力" };
  const 管理器 = 读取Tap宿主()?.getLeaderboardManager?.();
  if (!管理器) return { 完成: false, 原因: "排行榜管理器不可用" };
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
    return { 完成: true, 原因: "已提交" };
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
): Promise<排行操作结果> {
  const 分 = 排行榜分数(模式, 分数, 用时毫秒, 完赛);
  if (分 == null) return { 完成: false, 原因: "本局无有效上榜分数" };
  const 周期列表 = 已配置的周期(模式);
  if (!周期列表.length) return { 完成: false, 原因: "排行榜编号未配置" };
  // 同一成绩写入该模式已配置的全部周期榜（日/周/月/总各自独立 ID）。
  const 结果列表: 排行操作结果[] = [];
  for (const 周期 of 周期列表) {
    const 编号 = 取排行榜编号(模式, 周期);
    结果列表.push(await 提交到编号(编号, 分));
  }
  const 成功 = 结果列表.filter((r) => r.完成).length;
  if (成功 === 结果列表.length) return { 完成: true, 原因: `已提交 ${成功} 个周期榜` };
  if (成功 > 0) return { 完成: true, 原因: `部分提交成功 ${成功}/${结果列表.length}` };
  return 结果列表[0] ?? { 完成: false, 原因: "提交失败" };
}

export function 打开排行榜(
  模式: 游戏模式 = "马拉松",
  周期: 排行榜周期 = "总",
): Promise<排行操作结果> {
  const 编号 = 取排行榜编号(模式, 周期) || 取默认排行榜编号(模式);
  if (!编号) return Promise.resolve({ 完成: false, 原因: "排行榜编号未配置" });
  if (!探测Tap能力().有排行榜)
    return Promise.resolve({ 完成: false, 原因: "当前环境无排行榜能力" });
  const 管理器 = 读取Tap宿主()?.getLeaderboardManager?.();
  if (!管理器) return Promise.resolve({ 完成: false, 原因: "排行榜管理器不可用" });
  return new Promise((resolve) => {
    管理器.openLeaderboard({
      leaderboardId: 编号,
      callback: {
        onSuccess: () => resolve({ 完成: true, 原因: "已打开" }),
        onFailure: (代码, 消息) =>
          resolve({
            完成: false,
            原因: `${代码}:${消息}`,
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
}

export interface 加载排行榜结果 extends 排行操作结果 {
  分数列表: Tap排行榜分数[];
  我的?: Tap排行榜分数 | null;
  可用周期: Tap排行榜周期[];
  当前周期展示?: string;
  编号: string;
}

export async function 加载排行榜数据(选项: 加载排行榜选项): Promise<加载排行榜结果> {
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
      原因: `后台尚未配置「${选项.模式}·${周期}榜」。请在开发者中心为该模式单独创建对应重置周期的排行榜，并把 ID 填进配置。`,
    };
  }
  if (!探测Tap能力().有排行榜) {
    return { ...空, 原因: "当前环境无排行榜能力，请在 TapTap App 内打开" };
  }
  const 管理器 = 读取Tap宿主()?.getLeaderboardManager?.();
  if (!管理器?.loadLeaderboardScores) {
    return { ...空, 原因: "排行榜查询接口不可用" };
  }

  const periodToken = 选项.periodToken ?? "";
  const 条数 = Math.min(50, Math.max(1, 选项.条数 ?? 20));

  try {
    const 列表结果 = await new Promise<Tap排行榜分数结果>((resolve, reject) => {
      管理器.loadLeaderboardScores!({
        leaderboardId: 编号,
        continuationToken: "",
        maxSize: 条数,
        collection: "public",
        periodToken,
        callback: {
          onSuccess: (res) => resolve((res ?? {}) as Tap排行榜分数结果),
          onFailure: (代码, 消息) => {
            const err = new Error(`${代码}:${消息}`) as Error & { 代码?: number };
            err.代码 = 代码;
            reject(err);
          },
        },
      });
    });

    let 我的: Tap排行榜分数 | null | undefined;
    if (管理器.loadCurrentPlayerLeaderboardScore) {
      try {
        const 我 = await new Promise<Tap当前玩家分数结果>((resolve, reject) => {
          管理器.loadCurrentPlayerLeaderboardScore!({
            leaderboardId: 编号,
            collection: "public",
            periodToken,
            callback: {
              onSuccess: (res) => resolve((res ?? {}) as Tap当前玩家分数结果),
              onFailure: (代码, 消息) => {
                const err = new Error(`${代码}:${消息}`) as Error & { 代码?: number };
                err.代码 = 代码;
                reject(err);
              },
            },
          });
        });
        我的 = 我.currentUserScore ?? null;
      } catch {
        我的 = null;
      }
    }

    const 可用周期 = 列表结果.leaderboard?.availablePeriods ?? [];
    return {
      完成: true,
      原因: "已加载",
      分数列表: 列表结果.scores ?? [],
      我的,
      可用周期,
      当前周期展示: 列表结果.leaderboard?.period?.display || undefined,
      编号,
    };
  } catch (e) {
    const 消息 = e instanceof Error ? e.message : String(e);
    const 代码 = Number((e as { 代码?: number })?.代码);
    return {
      ...空,
      原因: 消息,
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
