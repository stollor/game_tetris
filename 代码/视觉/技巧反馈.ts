import type { 俄罗斯方块状态 } from "../玩法/俄罗斯方块";

/** 文案完全来自规则判定，同一落块最多两行，适配小棋盘。界面优先中文，避开 TETRIS 商标用语。 */
export function 获取技巧反馈(e: NonNullable<俄罗斯方块状态["落块事件"]>, 英文: boolean): string {
  const 标签: string[] = [];
  if (e.全清) 标签.push(英文 ? "PERFECT CLEAR" : "完美清场");
  if (e.T旋 !== "无")
    标签.push(e.T旋 === "完整" ? (英文 ? "T-SPIN" : "T 旋") : 英文 ? "T-SPIN MINI" : "迷你 T 旋");
  if (e.行数 === 4) 标签.push(英文 ? "QUAD!" : "四连消");
  else if (e.行数 > 0 && e.T旋 === "无")
    标签.push(英文 ? `${e.行数} LINE${e.行数 > 1 ? "S" : ""}` : `消除 ${e.行数} 行`);
  const 连续: string[] = [];
  if (e.连击 >= 2) 连续.push(英文 ? `COMBO ×${e.连击}` : `连击 ×${e.连击}`);
  if (e.连续高难) 连续.push(英文 ? "BACK-TO-BACK" : "背靠背");
  if (!标签.length && !连续.length) return "";
  return `${标签.join(" · ")}  +${e.得分}${连续.length ? `\n${连续.join(" · ")}` : ""}`;
}
