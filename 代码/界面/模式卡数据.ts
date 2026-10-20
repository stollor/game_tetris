import { type 模式卡数据, 生成模式纪录行 } from "../../组件/霓虹街机/模式卡配方";
import type { 对局纪录 } from "../存档/对局纪录";
import type { 游戏模式 } from "../玩法/再消一行";
import { 游戏外观, 游戏模式顺序 } from "../配置/游戏外观";

/**
 * 模式卡的文案装配（Phaser 与 Three 共用）：
 * 中文取 `代码/配置/游戏外观.ts` 的模式表，英文取本文件的对照表（与重构前开始菜单一致），
 * 纪录行格式由 `组件/霓虹街机/模式卡配方.ts` 统一。存档读取留在各版接口层，不进这里。
 */

const 英文标题 = ["MARATHON", "SPRINT", "ULTRA", "DAILY"];
const 英文细节 = ["ENDLESS", "40 LINES", "120 SEC", "TODAY"];
const 英文说明 = [
  "Keep climbing. Beat your best.",
  "Clear 40 lines as fast as you can.",
  "Score as much as possible in 120s.",
  "Same sequence for everyone today.",
];

/** 模式在 `游戏模式顺序` 中的位次，用于取英文对照文案。 */
function 模式位次(模式: 游戏模式): number {
  return 游戏模式顺序.indexOf(模式);
}

export function 组装模式卡数据(
  模式: 游戏模式,
  英文: boolean,
  纪录: 对局纪录 | null,
  强调色: string,
): 模式卡数据 {
  const 项 = 游戏外观.模式[模式];
  const 位次 = 模式位次(模式);
  return {
    标题: 英文 ? (英文标题[位次] ?? 项.标题) : 项.标题,
    细节: 英文 ? (英文细节[位次] ?? 项.细节) : 项.细节,
    说明: 英文 ? (英文说明[位次] ?? 项.说明) : 项.说明,
    纪录: 生成模式纪录行(模式, 纪录, 英文),
    强调色,
    有排行: true,
  };
}
