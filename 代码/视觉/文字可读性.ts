import type Phaser from "phaser";
import type { 背景主题 } from "../配置/俄罗斯方块设置";
import { 背景主题配置 } from "../配置/背景主题";

/** 背景上文字的可读性配色：浅底主题用深色墨水 + 浅色描边，深底主题反之。 */
export interface 背景文字配色 {
  主字: string;
  次字: string;
  强调: string;
  描边色: string;
}

/** 当前背景的明暗基调：浅底主题配深色墨水，深底主题配浅色字。 */
export function 背景基调(主题: 背景主题): "浅底" | "深底" {
  return 背景主题配置[主题].文字基调;
}

export function 背景文字配色(主题: 背景主题): 背景文字配色 {
  const 基调 = 背景基调(主题);
  return 基调 === "浅底"
    ? {
        主字: "#102236",
        次字: "#22394F",
        强调: "#05464F",
        描边色: "#FFFFFF",
      }
    : {
        主字: "#F3F6FC",
        次字: "#B7C7DE",
        强调: "#5FE6D8",
        描边色: "#04070F",
      };
}

/**
 * 给直接压在背景上的文字应用描边，保证任意背景主题下都有对比度。
 * 小字用细描边，避免描边吞掉字芯显得发灰；大字用厚描边压住花背景。
 */
export function 应用背景文字样式(
  文本: Phaser.GameObjects.Text,
  主题: 背景主题,
  字号: number,
): void {
  const 配色 = 背景文字配色(主题);
  const 描边宽 = 字号 <= 16 ? 1 : Math.max(1.5, Math.min(5, 字号 * 0.055));
  文本.setStroke(配色.描边色, 描边宽);
}
