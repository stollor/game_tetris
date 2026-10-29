import { 读取当前主题解析 } from "../配色/主题读取";
import { 是立体主题名 } from "./立体规范";

/** 棋盘走透视前置渲染，HUD 仍 2D。 */
export function 是透视棋盘(): boolean {
  return 读取当前主题解析().槽位.some((项) => 项.槽位.编号 === "棋盘表现" && 项.资源.值 === "透视");
}

export function 是立体主题(值: unknown): boolean {
  return 是立体主题名(值);
}
