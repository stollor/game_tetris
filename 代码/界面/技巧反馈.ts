import type { 再消一行状态 } from "../玩法/再消一行";
import { 填充文案, type 游戏文案 } from "../语言/类型";

/**
 * 技巧反馈：文案完全来自规则判定，同一落块最多两行，适配小棋盘。
 * 可见文字都走 `代码/语言/` 的字典，这里只负责挑标签与排版。
 */
export function 获取技巧反馈(e: NonNullable<再消一行状态["落块事件"]>, 文案: 游戏文案): string {
  const 标签: string[] = [];
  if (e.全清) 标签.push(文案.技巧完美清场);
  if (e.T旋 !== "无") 标签.push(e.T旋 === "完整" ? 文案.技巧T旋 : 文案.技巧迷你T旋);
  if (e.行数 === 4) 标签.push(文案.技巧四连消);
  else if (e.行数 > 0 && e.T旋 === "无") 标签.push(填充文案(文案.技巧消行, { 行数: e.行数 }));
  const 连续: string[] = [];
  if (e.连击 >= 2) 连续.push(填充文案(文案.技巧连击, { 连击: e.连击 }));
  if (e.连续高难) 连续.push(文案.技巧背靠背);
  if (!标签.length && !连续.length) return "";
  return `${标签.join(" · ")}  +${e.得分}${连续.length ? `\n${连续.join(" · ")}` : ""}`;
}
