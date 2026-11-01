import { 读取当前主题解析 } from "../配色/主题读取";
import { 是糖果主题名 } from "./糖果规范";

/** 界面走奶油裱花与软糖材质（面板/按钮/仪表换绘制语言）。 */
export function 是糖果风格(): boolean {
  return 读取当前主题解析().槽位.some((项) => 项.槽位.编号 === "界面表现" && 项.资源.值 === "糖果");
}

export function 是糖果主题(值: unknown): boolean {
  return 是糖果主题名(值);
}
