import type { 游戏设置 } from "./设置";
import { 文案 as English } from "./语言/English";
import { 文案 as 简体中文 } from "./语言/简体中文";
import type { 游戏文案 } from "./语言/类型";

export type 支持语言 = "简体中文" | "English";

export function 解析语言(语言: 游戏设置["语言"]): 支持语言 {
  if (语言 !== "跟随系统") return 语言;
  return navigator.language.toLowerCase().startsWith("zh") ? "简体中文" : "English";
}

export function 获取文案(语言: 支持语言): 游戏文案 {
  return 语言 === "简体中文" ? 简体中文 : English;
}
