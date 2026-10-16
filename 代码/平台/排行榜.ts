import type { 游戏模式 } from "../玩法/俄罗斯方块";
import { 探测Tap能力, 读取Tap宿主 } from "./Tap环境";
import { 排行榜编号 } from "./配置";

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

export function 取排行榜编号(模式: 游戏模式): string {
  return 排行榜编号[模式] ?? "";
}

export async function 提交模式分数(
  模式: 游戏模式,
  分数: number,
  用时毫秒: number | null,
  完赛: boolean,
): Promise<{ 完成: boolean; 原因: string }> {
  const 编号 = 取排行榜编号(模式);
  if (!编号) return { 完成: false, 原因: "排行榜编号未配置" };
  const 分 = 排行榜分数(模式, 分数, 用时毫秒, 完赛);
  if (分 == null) return { 完成: false, 原因: "本局无有效上榜分数" };
  if (!探测Tap能力().有排行榜) return { 完成: false, 原因: "当前环境无排行榜能力" };
  const 管理器 = 读取Tap宿主()?.getLeaderboardManager?.();
  if (!管理器) return { 完成: false, 原因: "排行榜管理器不可用" };
  await new Promise<void>((resolve, reject) => {
    管理器.submitScores({
      scores: [{ leaderboardId: 编号, score: 分 }],
      callback: {
        onSuccess: () => resolve(),
        onFailure: (代码, 消息) => reject(new Error(`${代码}:${消息}`)),
      },
    });
  });
  return { 完成: true, 原因: "已提交" };
}

export function 打开排行榜(模式: 游戏模式 = "马拉松"): Promise<{ 完成: boolean; 原因: string }> {
  const 编号 = 取排行榜编号(模式);
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
        onFailure: (代码, 消息) => resolve({ 完成: false, 原因: `${代码}:${消息}` }),
      },
    });
  });
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
