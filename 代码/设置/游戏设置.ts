import {
  更新游戏设置 as 更新通用设置,
  获取游戏设置 as 获取通用设置,
  type 游戏设置 as 通用游戏设置,
  配置游戏默认样式,
  默认设置 as 默认通用设置,
} from "../../.gamemaker/依赖/框架/设置/设置";
import { 主题结果转设置, 解析游戏主题 } from "../../资源/主题/主题组合";
import { 收藏 } from "../存档/收藏";
import { 迁移更名前存档 } from "../存档/更名迁移";
import { 项目默认主题 } from "../项目配置/主题";
import { type 主题名, 是主题名, 默认主题 } from "../项目配置/主题目录";
import { type 外观搭配, 外观部位列表 } from "../项目配置/外观部位";

export type 屏幕适配选择 = "自动" | "手机竖屏" | "电脑横屏";
export type 省电模式选择 = "自动" | "开" | "关";

export type 游戏设置 = 通用游戏设置 & {
  /** 当前整套主题；只有四套，默认主题出厂即拥有。 */
  主题选择: 主题名;
  外观搭配: 外观搭配;
  旋转180: boolean;
  落点影透明度: number;
  显示网格: boolean;
  显示按键说明: boolean;
  屏幕适配: 屏幕适配选择;
  背景动态: boolean;
  省电模式: 省电模式选择;
  显示触屏提示: boolean;
};

interface 再消一行专属设置 {
  主题选择: 主题名;
  外观搭配: 外观搭配;
  背景动态: boolean;
  省电模式: 省电模式选择;
  显示触屏提示: boolean;
  旋转180: boolean;
  落点影透明度: number;
  显示网格: boolean;
  显示按键说明: boolean;
  屏幕适配: 屏幕适配选择;
}

const 默认专属设置: 再消一行专属设置 = {
  主题选择: 默认主题,
  外观搭配: {},
  背景动态: true,
  省电模式: "自动",
  显示触屏提示: true,
  旋转180: true,
  落点影透明度: 100,
  显示网格: true,
  显示按键说明: true,
  屏幕适配: "自动",
};

配置游戏默认样式(默认主题);
export const 默认设置: 游戏设置 = { ...默认通用设置, ...默认专属设置 };

const 专属设置键 = "再消一行:设置";
if (typeof localStorage !== "undefined") 迁移更名前存档(localStorage);
let 当前专属设置: 再消一行专属设置 | undefined;

/** 主题目录依赖基准默认值，等模块装配完成后再解析项目选择。 */
export function 读取项目默认设置(): 游戏设置 {
  return 主题结果转设置(默认设置, 解析游戏主题(默认设置, 项目默认主题));
}

function 读取当前专属设置(): 再消一行专属设置 {
  if (!当前专属设置) {
    const 项目默认 = 读取项目默认设置();
    配置游戏默认样式(项目默认.样式);
    const {
      音效音量: _音效音量,
      音乐音量: _音乐音量,
      背景音乐: _背景音乐,
      主题: _主题,
      语言: _语言,
      样式: _样式,
      ...专属默认
    } = 项目默认;
    当前专属设置 = 读取专属设置(专属默认);
  }
  return 当前专属设置;
}

function 是对象(值: unknown): 值 is Record<string, unknown> {
  return typeof 值 === "object" && 值 !== null;
}

function 有效透明度(值: unknown): 值 is number {
  return typeof 值 === "number" && Number.isInteger(值) && 值 >= 0 && 值 <= 100;
}

/** 主题必须存在且已拥有：默认主题人人有，其余看收藏存档。 */
function 可用主题(值: unknown, 默认: 主题名): 主题名 {
  if (!是主题名(值)) return 默认;
  if (值 === 默认主题) return 值;
  return new 收藏(localStorage).拥有(值) ? 值 : 默认;
}

function 读取外观搭配(值: unknown): 外观搭配 {
  const 搭配: 外观搭配 = {};
  if (!是对象(值)) return 搭配;
  const 收藏实例 = new 收藏(localStorage);
  for (const 部位 of 外观部位列表) {
    const 主题 = 值[部位];
    if (是主题名(主题) && 收藏实例.拥有部位(主题, 部位)) 搭配[部位] = 主题;
  }
  return 搭配;
}

function 读取专属设置(默认专属设置: 再消一行专属设置): 再消一行专属设置 {
  try {
    const 独立设置 = localStorage.getItem(专属设置键);
    const 旧设置 = localStorage.getItem("gamemaker:settings");
    const 原文 = 独立设置 ?? 旧设置;
    if (!原文) return { ...默认专属设置 };
    const 内容: unknown = JSON.parse(原文);
    if (!是对象(内容)) return { ...默认专属设置 };
    return {
      主题选择: 可用主题(内容.主题选择, 默认专属设置.主题选择),
      外观搭配: 读取外观搭配(内容.外观搭配),
      背景动态: 内容.背景动态 !== false,
      省电模式: 内容.省电模式 === "开" || 内容.省电模式 === "关" ? 内容.省电模式 : "自动",
      显示触屏提示: 内容.显示触屏提示 !== false,
      旋转180: typeof 内容.旋转180 === "boolean" ? 内容.旋转180 : 默认专属设置.旋转180,
      落点影透明度: 有效透明度(内容.落点影透明度) ? 内容.落点影透明度 : 默认专属设置.落点影透明度,
      显示网格: typeof 内容.显示网格 === "boolean" ? 内容.显示网格 : 默认专属设置.显示网格,
      显示按键说明:
        typeof 内容.显示按键说明 === "boolean" ? 内容.显示按键说明 : 默认专属设置.显示按键说明,
      屏幕适配:
        内容.屏幕适配 === "手机竖屏" || 内容.屏幕适配 === "电脑横屏"
          ? 内容.屏幕适配
          : 默认专属设置.屏幕适配,
    };
  } catch {
    return { ...默认专属设置 };
  }
}

export function 获取游戏设置(): 游戏设置 {
  const 专属 = 读取当前专属设置();
  return { ...获取通用设置(), ...专属 };
}

export function 更新游戏设置(变化: Partial<游戏设置>): 游戏设置 {
  const 当前 = 读取当前专属设置();
  if (变化.主题选择 !== undefined) {
    const 主题 = 变化.主题选择;
    if (!是主题名(主题)) throw new Error("无效主题选择");
    if (主题 !== 默认主题 && !new 收藏(localStorage).拥有(主题)) throw new Error("尚未拥有该主题");
    变化 = {
      ...主题结果转设置(获取游戏设置(), 解析游戏主题(获取游戏设置(), 主题)),
      ...变化,
      外观搭配: {},
    };
  }
  if (变化.外观搭配 !== undefined) {
    const 收藏实例 = new 收藏(localStorage);
    for (const 部位 of 外观部位列表) {
      const 主题 = 变化.外观搭配[部位];
      if (主题 !== undefined && (!是主题名(主题) || !收藏实例.拥有部位(主题, 部位)))
        throw new Error("尚未拥有该部位");
    }
  }
  const 通用变化: Partial<通用游戏设置> = {};
  if (变化.背景音乐 !== undefined) 通用变化.背景音乐 = 变化.背景音乐;
  if (变化.音乐音量 !== undefined) 通用变化.音乐音量 = 变化.音乐音量;
  if (变化.音效音量 !== undefined) 通用变化.音效音量 = 变化.音效音量;
  if (变化.主题 !== undefined) 通用变化.主题 = 变化.主题;
  if (变化.语言 !== undefined) 通用变化.语言 = 变化.语言;
  if (变化.样式 !== undefined) 通用变化.样式 = 变化.样式;

  // 音乐/音效音量与背景音乐开关由框架通用设置持久化，专属设置不重复存一份。
  if (变化.背景音乐 !== undefined && 变化.音乐音量 === undefined) 通用变化.背景音乐 = 变化.背景音乐;
  if (有效透明度(变化.音乐音量) && 变化.背景音乐 === undefined)
    通用变化.背景音乐 = 变化.音乐音量 > 0;

  const 专属变化: Partial<再消一行专属设置> = {};
  if (变化.主题选择 !== undefined) 专属变化.主题选择 = 变化.主题选择;
  if (变化.外观搭配 !== undefined) 专属变化.外观搭配 = { ...变化.外观搭配 };
  if (变化.背景动态 !== undefined) 专属变化.背景动态 = 变化.背景动态;
  if (变化.省电模式 !== undefined) 专属变化.省电模式 = 变化.省电模式;
  if (变化.显示触屏提示 !== undefined) {
    专属变化.显示触屏提示 = 变化.显示触屏提示;
    // 与局内「显示按键说明」共用同一显隐意图，避免两处开关各写各的。
    if (变化.显示按键说明 === undefined) 专属变化.显示按键说明 = 变化.显示触屏提示;
  }
  if (变化.旋转180 !== undefined) 专属变化.旋转180 = 变化.旋转180;
  if (变化.落点影透明度 !== undefined) 专属变化.落点影透明度 = 变化.落点影透明度;
  if (变化.显示网格 !== undefined) 专属变化.显示网格 = 变化.显示网格;
  if (变化.显示按键说明 !== undefined) {
    专属变化.显示按键说明 = 变化.显示按键说明;
    if (变化.显示触屏提示 === undefined) 专属变化.显示触屏提示 = 变化.显示按键说明;
  }
  if (变化.屏幕适配 !== undefined) 专属变化.屏幕适配 = 变化.屏幕适配;

  if (Object.keys(通用变化).length > 0) 更新通用设置(通用变化);
  if (Object.keys(专属变化).length > 0) {
    当前专属设置 = { ...当前, ...专属变化 };
    try {
      localStorage.setItem(专属设置键, JSON.stringify(当前专属设置));
    } catch (错误) {
      console.warn("保存再消一行设置失败，本次会话仍会应用设置。", 错误);
    }
  }

  const 设置 = 获取游戏设置();
  window.dispatchEvent(new CustomEvent<游戏设置>("gamemaker:settings-change", { detail: 设置 }));
  return 设置;
}
