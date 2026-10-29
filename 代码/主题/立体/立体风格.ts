import { 读取当前主题解析 } from "../配色/主题读取";
import { 是立体主题名 } from "./立体规范";

/** 棋盘走透视前置渲染。 */
export function 是透视棋盘(): boolean {
  return 读取当前主题解析().槽位.some((项) => 项.槽位.编号 === "棋盘表现" && 项.资源.值 === "透视");
}

/** 2D HUD 走金属机架，不再复用极光玻璃。 */
export function 是立体风格(): boolean {
  return 读取当前主题解析().槽位.some((项) => 项.槽位.编号 === "界面表现" && 项.资源.值 === "立体");
}

export function 是立体主题(值: unknown): boolean {
  return 是立体主题名(值);
}
