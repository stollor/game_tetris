import { 成就系统 } from "../../.gamemaker/依赖/框架/进度/成就";
import type { 再消一行状态 } from "../玩法/再消一行";

export const 成就定义 = [
  {
    编号: "first-lock",
    目标: 1,
  },
  {
    编号: "first-clear",
    目标: 1,
  },
  {
    编号: "four-lines",
    目标: 1,
  },
  {
    编号: "spin",
    目标: 1,
  },
  {
    编号: "combo",
    目标: 3,
  },
  {
    编号: "b2b",
    目标: 1,
  },
  {
    编号: "perfect",
    目标: 1,
  },
  {
    编号: "hold",
    目标: 1,
  },
  {
    编号: "lines",
    目标: 100,
  },
  {
    编号: "level",
    目标: 5,
  },
  {
    编号: "sprint",
    目标: 1,
  },
  {
    编号: "ultra",
    目标: 1,
  },
] as const;
let 当前成就: 成就系统 | undefined;
export const 创建再消一行成就 = () =>
  (当前成就 ??= new 成就系统(成就定义, localStorage, "neon-pulse:achievements"));
export function 记录落块成就(系统: 成就系统, 状态: 再消一行状态): string[] {
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
  if (e.行数 === 4) 记("four-lines", 1);
  if (e.T旋 !== "无") 记("spin", 1);
  if (e.连续高难) 记("b2b", 1);
  if (e.全清) 记("perfect", 1);
  记("combo", e.连击);
  记("level", 状态.等级);
  return 新;
}
