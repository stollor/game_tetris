import {
  type 支持语言,
  获取文案 as 获取通用文案,
  解析语言,
} from "../../.gamemaker/依赖/框架/设置/多语言";
import { 文案 as English } from "./English";
import { 文案 as 简体中文 } from "./简体中文";
import type { 游戏文案 } from "./类型";

export { type 支持语言, 解析语言 };

export function 获取文案(语言: 支持语言): 游戏文案 {
  return { ...获取通用文案(语言), ...(语言 === "简体中文" ? 简体中文 : English) };
}
