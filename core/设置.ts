export type 语言选择 = "跟随系统" | "简体中文" | "English";
export type 屏幕适配选择 = "自动" | "手机竖屏" | "电脑横屏";
export type 主题选择 = "跟随系统" | "深色" | "浅色";
export type 样式选择 = "夜空鎏金" | "暖纸古典" | "青蓝未来";
export type 背景主题 = "晨光海岸" | "云海山岚" | "极光原野" | "霓虹天际";

export interface 游戏设置 {
  背景音乐: boolean;
  音乐音量: number;
  音效音量: number;
  主题: 主题选择;
  语言: 语言选择;
  屏幕适配: 屏幕适配选择;
  样式: 样式选择;
  背景主题: 背景主题;
}

export const 默认设置: 游戏设置 = {
  背景音乐: true,
  音乐音量: 60,
  音效音量: 80,
  主题: "跟随系统",
  语言: "跟随系统",
  屏幕适配: "自动",
  样式: "夜空鎏金",
  背景主题: "晨光海岸",
};

const 存储键 = "gamemaker:settings";
let 当前设置 = 读取设置();

function 有效音量(值: unknown): 值 is number {
  return typeof 值 === "number" && Number.isInteger(值) && 值 >= 0 && 值 <= 100;
}

function 是对象(值: unknown): 值 is Record<string, unknown> {
  return typeof 值 === "object" && 值 !== null;
}

export function 读取设置(): 游戏设置 {
  try {
    const 原文 = localStorage.getItem(存储键);
    if (!原文) return { ...默认设置 };
    const 内容: unknown = JSON.parse(原文);
    if (!是对象(内容)) return { ...默认设置 };
    return {
      背景音乐: typeof 内容.背景音乐 === "boolean" ? 内容.背景音乐 : 默认设置.背景音乐,
      音乐音量: 有效音量(内容.音乐音量) ? 内容.音乐音量 : 默认设置.音乐音量,
      音效音量: 有效音量(内容.音效音量) ? 内容.音效音量 : 默认设置.音效音量,
      主题: 内容.主题 === "深色" || 内容.主题 === "浅色" ? 内容.主题 : "跟随系统",
      语言: 内容.语言 === "简体中文" || 内容.语言 === "English" ? 内容.语言 : "跟随系统",
      屏幕适配:
        内容.屏幕适配 === "手机竖屏" || 内容.屏幕适配 === "电脑横屏" ? 内容.屏幕适配 : "自动",
      样式: 内容.样式 === "暖纸古典" || 内容.样式 === "青蓝未来" ? 内容.样式 : "夜空鎏金",
      背景主题:
        内容.背景主题 === "云海山岚" || 内容.背景主题 === "极光原野" || 内容.背景主题 === "霓虹天际"
          ? 内容.背景主题
          : "晨光海岸",
    };
  } catch {
    return { ...默认设置 };
  }
}

export function 获取游戏设置(): 游戏设置 {
  return { ...当前设置 };
}

export function 更新游戏设置(变化: Partial<游戏设置>): 游戏设置 {
  当前设置 = { ...当前设置, ...变化 };
  try {
    localStorage.setItem(存储键, JSON.stringify(当前设置));
  } catch (错误) {
    console.warn("保存游戏设置失败，本次会话仍会应用设置。", 错误);
  }
  window.dispatchEvent(
    new CustomEvent<游戏设置>("gamemaker:settings-change", { detail: 获取游戏设置() }),
  );
  return 获取游戏设置();
}
