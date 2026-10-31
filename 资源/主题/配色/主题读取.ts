import type { 游戏设置 } from "../../../代码/设置/游戏设置";
import { 获取游戏设置 as 获取项目设置 } from "../../../代码/设置/游戏设置";
import type { 主题解析结果 } from "../../../.gamemaker/依赖/框架/设置/主题组合";
import type { 样式选择 } from "../../../.gamemaker/依赖/框架/设置/设置";
import type { 游戏主题 } from "../../../.gamemaker/依赖/框架/样式/类型";
import { 读取有效游戏主题 } from "../主题组合";
import { 是像素主题名, 绑定像素规范读取 } from "../像素/像素规范";
import { 像素配色, 彩砖配色 } from "./像素配色";
import { 再消一行主题 } from "./基础配色";

/**
 * 语义配色入口：按样式名取整套界面配色。
 * 立体晶格沿用极光原野的界面配色（界面表现另走立体机架），配色样式里没有它；
 * 这里只维护「有哪些配色」，主题名单在 `代码/项目配置/主题目录.ts`。
 */

const 基础主题表: Record<string, 游戏主题> = 再消一行主题;

let 预览读取: (() => 游戏设置) | undefined;
let 预览解析: (() => 主题解析结果) | undefined;
/** 只在隔离预览窗口设置，正式游戏始终读取玩家设置。 */
export function 设置预览主题读取(读取?: () => 游戏设置, 解析?: () => 主题解析结果): void {
  预览读取 = 读取;
  预览解析 = 解析;
}
export function 读取当前主题解析() {
  return 预览解析?.() ?? 读取有效游戏主题(预览读取?.() ?? 获取项目设置());
}
function 像素界面配色(名称: unknown) {
  if (名称 === "街机彩砖") return 彩砖配色;
  if (名称 === "砖机液晶") return 像素配色;
}
/** 当前主题解析出的界面配色样式名。 */
function 当前配色样式(): unknown {
  return 读取当前主题解析().槽位.find((项) => 项.槽位.编号 === "界面配色")?.资源.值;
}

export function 界面主题(样式?: 样式选择): 游戏主题 {
  const 像素 = 像素界面配色(样式);
  if (像素) return 像素;
  if (!样式) {
    const 当前 = 当前配色样式();
    const 当前像素 = 像素界面配色(当前);
    if (当前像素) return 当前像素;
    return (typeof 当前 === "string" ? 基础主题表[当前] : undefined) ?? 再消一行主题.极光原野;
  }
  return 基础主题表[样式] ?? 再消一行主题.极光原野;
}

绑定像素规范读取(() => {
  const 配色 = 当前配色样式();
  return typeof 配色 === "string" && 是像素主题名(配色) ? 配色 : undefined;
});
export function 颜色值(颜色: string): number {
  return Number.parseInt(颜色.replace("#", ""), 16);
}
export function 暂停外观() {
  const t = 界面主题();
  return {
    遮罩色: t.面板.遮罩.背景,
    遮罩透明度: t.面板.遮罩.透明度,
    面板色: t.面板.主面板.背景,
    边框色: t.面板.主面板.描边,
    标题色: t.面板.主面板.标题文字,
    说明色: t.文字.次要,
    按钮面板色: t.按钮.次要.默认.背景,
    强调色: t.文字.强调,
    按钮文字色: t.按钮.次要.默认.文字,
  };
}
