import { 获取冲刺显示用时 } from "../../性能/计时显示";
import type { 再消一行状态, 游戏模式 } from "../../玩法/再消一行";
import type { 游戏文案 } from "../../语言/类型";
import { 模式配置 } from "../../项目配置/模式";

/**
 * 各模式的展示口径：模式名、目标、计时与每日挑战日期。
 * 规则状态机仍在 代码/玩法/再消一行.ts，这里只做「同一天、同一模式」的界面换算。
 */

export const 模式列表: readonly 游戏模式[] = ["马拉松", "冲刺", "极限", "每日挑战", "练习"];

export function 读取每日日期(时间 = new Date()): string {
  // 与 Phaser 版/每日种子保持一致：UTC 日期，跨时区同日同序列。
  return 时间.toISOString().slice(0, 10);
}

export function 模式名称(模式: 游戏模式, 文案: 游戏文案): string {
  switch (模式) {
    case "冲刺":
      return 文案.模式冲刺;
    case "极限":
      return 文案.模式极限;
    case "每日挑战":
      return 文案.模式每日挑战;
    case "练习":
      return 文案.模式练习;
    default:
      return 文案.模式马拉松;
  }
}

/** 对局页顶部的模式目标短句。 */
export function 模式目标文案(模式: 游戏模式, 文案: 游戏文案): string {
  switch (模式) {
    case "冲刺":
      return `${模式配置.冲刺目标行数}L · ${文案.挑战完成}`;
    case "极限":
      return `${Math.round(模式配置.极限毫秒 / 1000)}s`;
    case "每日挑战":
      return 文案.模式每日挑战;
    case "练习":
      return 文案.练习目标;
    default:
      return `目标 ${模式配置.马拉松目标行数}L`;
  }
}

/**
 * 顶栏实时计时：冲刺取 50ms 整数桶、极限显示剩余整秒、每日挑战显示日期、马拉松为空。
 * 进行中才走整桶口径；暂停/结束后显示精确有效用时（与 Phaser 版一致）。
 */
export function 读取对局计时文案(模式: 游戏模式, 状态: 再消一行状态, 每日日期: string): string {
  if (模式 === "冲刺") {
    const 显示 = 获取冲刺显示用时(状态.有效用时, 状态.阶段 === "进行中");
    return `${模式配置.冲刺目标行数}L · ${(显示 / 1000).toFixed(2)}s`;
  }
  if (模式 === "极限") return `${Math.ceil(状态.剩余时间 / 1000)}s`;
  if (模式 === "每日挑战") return 每日日期;
  return "";
}

/** 冲刺/极限有各自的历史纪录口径，其余按分数。 */
export function 是否按用时比较纪录(模式: 游戏模式): boolean {
  return 模式 === "冲刺";
}

export function 格式化用时(毫秒: number): string {
  return `${(毫秒 / 1000).toFixed(2)}s`;
}
