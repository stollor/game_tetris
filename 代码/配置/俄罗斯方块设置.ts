import {
  更新游戏设置 as 更新通用设置,
  获取游戏设置 as 获取通用设置,
  type 游戏设置 as 通用游戏设置,
  默认设置 as 默认通用设置,
} from "../../框架/设置";

export type 屏幕适配选择 = "自动" | "手机竖屏" | "电脑横屏";
export type 背景主题 = "晨光海岸" | "云海山岚" | "极光原野" | "霓虹天际";

export type 游戏设置 = 通用游戏设置 & {
  旋转180: boolean;
  落点影透明度: number;
  显示网格: boolean;
  显示按键说明: boolean;
  屏幕适配: 屏幕适配选择;
  背景主题: 背景主题;
};

interface 俄罗斯方块专属设置 {
  旋转180: boolean;
  落点影透明度: number;
  显示网格: boolean;
  显示按键说明: boolean;
  屏幕适配: 屏幕适配选择;
  背景主题: 背景主题;
}

const 默认专属设置: 俄罗斯方块专属设置 = {
  旋转180: true,
  落点影透明度: 100,
  显示网格: true,
  显示按键说明: true,
  屏幕适配: "自动",
  背景主题: "晨光海岸",
};

export const 默认设置: 游戏设置 = { ...默认通用设置, ...默认专属设置 };

const 专属设置键 = "俄罗斯方块:设置";
let 当前专属设置: 俄罗斯方块专属设置 = 读取专属设置();

function 是对象(值: unknown): 值 is Record<string, unknown> {
  return typeof 值 === "object" && 值 !== null;
}

function 有效透明度(值: unknown): 值 is number {
  return typeof 值 === "number" && Number.isInteger(值) && 值 >= 0 && 值 <= 100;
}

function 读取专属设置(): 俄罗斯方块专属设置 {
  try {
    const 独立设置 = localStorage.getItem(专属设置键);
    const 旧设置 = localStorage.getItem("gamemaker:settings");
    const 原文 = 独立设置 ?? 旧设置;
    if (!原文) return { ...默认专属设置 };
    const 内容: unknown = JSON.parse(原文);
    if (!是对象(内容)) return { ...默认专属设置 };
    return {
      旋转180: typeof 内容.旋转180 === "boolean" ? 内容.旋转180 : 默认专属设置.旋转180,
      落点影透明度: 有效透明度(内容.落点影透明度) ? 内容.落点影透明度 : 默认专属设置.落点影透明度,
      显示网格: typeof 内容.显示网格 === "boolean" ? 内容.显示网格 : 默认专属设置.显示网格,
      显示按键说明:
        typeof 内容.显示按键说明 === "boolean" ? 内容.显示按键说明 : 默认专属设置.显示按键说明,
      屏幕适配:
        内容.屏幕适配 === "手机竖屏" || 内容.屏幕适配 === "电脑横屏"
          ? 内容.屏幕适配
          : 默认专属设置.屏幕适配,
      背景主题:
        内容.背景主题 === "云海山岚" || 内容.背景主题 === "极光原野" || 内容.背景主题 === "霓虹天际"
          ? 内容.背景主题
          : 内容.背景主题 === "晨光海岸"
            ? 内容.背景主题
            : 默认专属设置.背景主题,
    };
  } catch {
    return { ...默认专属设置 };
  }
}

export function 获取游戏设置(): 游戏设置 {
  return { ...获取通用设置(), ...当前专属设置 };
}

export function 更新游戏设置(变化: Partial<游戏设置>): 游戏设置 {
  const 通用变化: Partial<通用游戏设置> = {};
  if (变化.背景音乐 !== undefined) 通用变化.背景音乐 = 变化.背景音乐;
  if (变化.音乐音量 !== undefined) 通用变化.音乐音量 = 变化.音乐音量;
  if (变化.音效音量 !== undefined) 通用变化.音效音量 = 变化.音效音量;
  if (变化.主题 !== undefined) 通用变化.主题 = 变化.主题;
  if (变化.语言 !== undefined) 通用变化.语言 = 变化.语言;
  if (变化.样式 !== undefined) 通用变化.样式 = 变化.样式;

  const 专属变化: Partial<俄罗斯方块专属设置> = {};
  if (变化.旋转180 !== undefined) 专属变化.旋转180 = 变化.旋转180;
  if (变化.落点影透明度 !== undefined) 专属变化.落点影透明度 = 变化.落点影透明度;
  if (变化.显示网格 !== undefined) 专属变化.显示网格 = 变化.显示网格;
  if (变化.显示按键说明 !== undefined) 专属变化.显示按键说明 = 变化.显示按键说明;
  if (变化.屏幕适配 !== undefined) 专属变化.屏幕适配 = 变化.屏幕适配;
  if (变化.背景主题 !== undefined) 专属变化.背景主题 = 变化.背景主题;

  if (Object.keys(通用变化).length > 0) 更新通用设置(通用变化);
  if (Object.keys(专属变化).length > 0) {
    当前专属设置 = { ...当前专属设置, ...专属变化 };
    try {
      localStorage.setItem(专属设置键, JSON.stringify(当前专属设置));
    } catch (错误) {
      console.warn("保存俄罗斯方块设置失败，本次会话仍会应用设置。", 错误);
    }
  }

  const 设置 = 获取游戏设置();
  window.dispatchEvent(new CustomEvent<游戏设置>("gamemaker:settings-change", { detail: 设置 }));
  return 设置;
}
