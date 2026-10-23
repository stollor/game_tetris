import type { 游戏模式 } from "../玩法/再消一行";
import { 上传云存档 } from "./云存档";
import { 记录分析事件 } from "./分析";
import { 同步平台成就 } from "./平台成就";
import { 尝试提交排行榜 } from "./排行榜";

/** 调用方已完成本地保存；平台失败保留本地结果，上传沿用限频和状态回执。 */
export function 结算后同步平台(
  结果: { 模式: 游戏模式; 分数: number; 用时毫秒: number | null; 完赛: boolean },
  新成就: readonly string[],
  本地保存成功: boolean,
): void {
  记录分析事件("mode_end", {
    模式: 结果.模式,
    分数: 结果.分数,
    用时: 结果.用时毫秒 ?? 0,
    完赛: 结果.完赛,
  });
  同步平台成就(新成就);
  for (const id of 新成就) 记录分析事件("achievement_unlock", { id });
  尝试提交排行榜(结果.模式, 结果.分数, 结果.完赛 ? 结果.用时毫秒 : null, 结果.完赛);
  if (本地保存成功)
    void 上传云存档()
      .then((同步) => {
        记录分析事件("cloud_sync", { 方向: 同步.方向 ?? "跳过", 完成: 同步.完成 });
      })
      .catch(() => {});
}
