import { 读取当前主题解析 } from "../配色/主题读取";
import { 是像素主题名 } from "./像素规范";

export function 是像素风格(): boolean {
  return 读取当前主题解析().槽位.some((项) => 项.槽位.编号 === "界面表现" && 项.资源.值 === "像素");
}

export function 是像素主题(值: unknown): boolean {
  return 是像素主题名(值);
}
