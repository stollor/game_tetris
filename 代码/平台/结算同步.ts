import type { 游戏模式 } from "../玩法/俄罗斯方块";
import { 尝试上传云存档 } from "./云存档";
import { 记录分析事件 } from "./分析";
import { 同步平台成就 } from "./平台成就";
import { 尝试提交排行榜 } from "./排行榜";

/** 对局本地存档完成后的尽力同步：排行榜、平台成就、云存档、分析。 */
export function 结算后同步平台(参数: {
  模式: 游戏模式;
  分数: number;
  用时毫秒: number;
  完赛: boolean;
  新成就: readonly string[];
}): void {
  记录分析事件("mode_end", {
    模式: 参数.模式,
    分数: 参数.分数,
    用时: 参数.用时毫秒,
    完赛: 参数.完赛,
  });
  if (参数.新成就.length) {
    同步平台成就(参数.新成就);
    for (const id of 参数.新成就) 记录分析事件("achievement_unlock", { id });
  }
  尝试提交排行榜(参数.模式, 参数.分数, 参数.完赛 ? 参数.用时毫秒 : null, 参数.完赛);
  尝试上传云存档();
}
