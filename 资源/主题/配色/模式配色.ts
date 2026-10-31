import type { 游戏模式 } from "../../../代码/玩法/再消一行";

export const 模式配色: Record<游戏模式, number> = {
  马拉松: 0x00e5ff,
  冲刺: 0xffee58,
  极限: 0xff2d9b,
  每日挑战: 0x00e676,
  练习: 0xb388ff,
};

export function 模式主题色(模式: 游戏模式): number {
  return 模式配色[模式];
}

export function 模式主题色文本(模式: 游戏模式): string {
  return `#${模式主题色(模式).toString(16).padStart(6, "0")}`;
}
