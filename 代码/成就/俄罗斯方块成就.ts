import { 成就系统 } from "../../框架/进度/成就";
import type { 俄罗斯方块状态 } from "../玩法/俄罗斯方块";

export const 成就定义 = [
  {
    编号: "first-lock",
    目标: 1,
    名称: "第一块拼图",
    英文: "First Piece",
    说明: "完成一次落块",
    英文说明: "Lock your first piece",
  },
  {
    编号: "first-clear",
    目标: 1,
    名称: "找到节奏",
    英文: "Find Your Rhythm",
    说明: "第一次消除行",
    英文说明: "Clear your first line",
  },
  {
    编号: "tetris",
    目标: 1,
    名称: "一举四行",
    英文: "Tetris!",
    说明: "一次消除四行",
    英文说明: "Clear four lines at once",
  },
  {
    编号: "spin",
    目标: 1,
    名称: "旋转艺术",
    英文: "Spin Artist",
    说明: "完成一次 T-Spin",
    英文说明: "Perform a T-Spin",
  },
  {
    编号: "combo",
    目标: 3,
    名称: "连消三拍",
    英文: "Triple Rhythm",
    说明: "达到三连消",
    英文说明: "Reach a 3-clear combo",
  },
  {
    编号: "b2b",
    目标: 1,
    名称: "高手接力",
    英文: "Back to Back",
    说明: "完成连续高难消除",
    英文说明: "Chain difficult clears",
  },
  {
    编号: "perfect",
    目标: 1,
    名称: "干净利落",
    英文: "Perfectly Clean",
    说明: "一次消除后棋盘全清",
    英文说明: "Empty the entire board",
  },
  {
    编号: "hold",
    目标: 1,
    名称: "留一手",
    英文: "One in Reserve",
    说明: "使用暂存换块",
    英文说明: "Hold a piece",
  },
  {
    编号: "lines",
    目标: 100,
    名称: "百行旅程",
    英文: "Century Club",
    说明: "累计消除 100 行",
    英文说明: "Clear 100 lines across games",
  },
  {
    编号: "level",
    目标: 5,
    名称: "越战越勇",
    英文: "Level Up",
    说明: "达到等级 5",
    英文说明: "Reach level 5",
  },
  {
    编号: "sprint",
    目标: 1,
    名称: "冲线时刻",
    英文: "Finish Line",
    说明: "完成 40 行冲刺",
    英文说明: "Finish a 40-line Sprint",
  },
  {
    编号: "ultra",
    目标: 1,
    名称: "两分钟专注",
    英文: "Two Minutes",
    说明: "完成极限模式对局",
    英文说明: "Complete an Ultra game",
  },
] as const;
let 当前成就: 成就系统 | undefined;
export const 创建俄罗斯方块成就 = () =>
  (当前成就 ??= new 成就系统(成就定义, localStorage, "neon-pulse:achievements"));
export function 记录落块成就(系统: 成就系统, 状态: 俄罗斯方块状态): string[] {
  const e = 状态.落块事件;
  if (!e) return [];
  const 新: string[] = [];
  const 记 = (id: string, n: number, 累计 = false) => {
    if (累计 ? 系统.累加(id, n) : 系统.推进(id, n)) 新.push(id);
  };
  记("first-lock", 1);
  if (e.行数) {
    记("first-clear", 1);
    记("lines", e.行数, true);
  }
  if (e.行数 === 4) 记("tetris", 1);
  if (e.T旋 !== "无") 记("spin", 1);
  if (e.连续高难) 记("b2b", 1);
  if (e.全清) 记("perfect", 1);
  记("combo", e.连击);
  记("level", 状态.等级);
  return 新;
}
