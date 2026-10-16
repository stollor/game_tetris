import { 获取游戏主题, 配置游戏主题 } from "../../框架/样式/样式";
import { type 样式选择, 获取游戏设置 } from "../../框架/设置/设置";
import { 旅行主题表 } from "../框架配置/旅行主题";
import { type 地点名称, 查找地点 } from "../框架配置/旅行地点";
import { 俄罗斯方块主题 } from "../框架配置/界面主题";
import { 获取游戏设置 as 获取项目设置 } from "./俄罗斯方块设置";

/** 游戏配方注册到框架后，所有界面共用同一份语义主题。 */
export function 界面主题(样式?: 样式选择 | 地点名称) {
  const 地点 = 查找地点(样式);
  if (地点) return 旅行主题表[地点.名称];
  if (样式 === "夜空鎏金" || 样式 === "暖纸古典" || 样式 === "青蓝未来")
    return 俄罗斯方块主题[样式];
  return 获取游戏主题(获取游戏设置().样式);
}
function 同步旅行主题(): void {
  配置游戏主题(俄罗斯方块主题);
  const 设置 = 获取项目设置();
  if (设置.旅行样式) 配置游戏主题({ [设置.样式]: 旅行主题表[设置.旅行样式] });
}
if (typeof window !== "undefined") {
  同步旅行主题();
  window.addEventListener("gamemaker:settings-change", 同步旅行主题);
}
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
