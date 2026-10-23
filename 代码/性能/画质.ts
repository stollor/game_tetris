import { 正在实况观测 } from "../../框架Three/开发/实况观测";
import { 创建重绘节拍 } from "../../框架Three/性能/帧率";
import { 获取游戏设置 } from "../配置/再消一行设置";

/**
 * 省电/低特效：低端机自动降级，设置里可强制开关。
 * - 两档都保留最高 4 倍画布精度，覆盖3.25等手机像素比，省电不降低方块与文字清晰度。
 * - 标准限 60 帧，省电限 30 帧，避免高刷设备无上限更新。
 * - 缓慢背景标准 10 帧、省电 5 帧；菜单/商店闲置后 2 帧。
 */
const 实测低端键 = "再消一行:实测低端";
export const 画质参数 = {
  标准像素比上限: 4,
  省电像素比上限: 4,
  标准帧率: 60,
  省电帧率: 30,
  标准背景间隔毫秒: 100,
  省电背景间隔毫秒: 200,
  闲置背景间隔毫秒: 500,
  闲置判定毫秒: 20000,
  实测采样毫秒: 6000,
  实测低帧阈值: 40,
  /**
   * Three 空闲心跳（菜单/商店等静态页）的拍长（目标值）。
   * 静态页按此节奏重画动态背景，目标约 10 帧/秒；
   * 对局等满帧页面不受影响，仍按 标准背景间隔毫秒 的 10 帧节奏。
   */
  three空闲心跳毫秒: 100,
} as const;

export interface 设备信息 {
  核心数?: number;
  内存GB?: number;
  像素比?: number;
  实测低端?: boolean;
}

let 实测低端缓存: boolean | undefined;

export function 读取设备信息(): 设备信息 {
  const 导航 = typeof navigator === "undefined" ? undefined : navigator;
  if (实测低端缓存 === undefined) {
    实测低端缓存 = false;
    try {
      实测低端缓存 = localStorage.getItem(实测低端键) === "1";
    } catch {}
  }
  const 实测低端 = 实测低端缓存;
  return {
    核心数: 导航?.hardwareConcurrency,
    内存GB: (导航 as { deviceMemory?: number } | undefined)?.deviceMemory,
    像素比: typeof window === "undefined" ? 1 : window.devicePixelRatio,
    实测低端,
  };
}

/** 硬件判定：≤4 核或 ≤3GB 内存，或上次实测掉帧，视为低端机。 */
export function 判定低端设备(信息: 设备信息): boolean {
  if (信息.实测低端) return true;
  if (信息.核心数 !== undefined && 信息.核心数 > 0 && 信息.核心数 <= 4) return true;
  if (信息.内存GB !== undefined && 信息.内存GB > 0 && 信息.内存GB <= 3) return true;
  return false;
}

export function 是省电模式(选择 = 获取游戏设置().省电模式, 信息 = 读取设备信息()): boolean {
  if (选择 === "开") return true;
  if (选择 === "关") return false;
  return 判定低端设备(信息);
}

export function 计算像素比上限(省电: boolean): number {
  return 省电 ? 画质参数.省电像素比上限 : 画质参数.标准像素比上限;
}

let 最近操作 = typeof performance === "undefined" ? 0 : performance.now();
const 重绘节拍 = new WeakMap<object, ReturnType<typeof 创建重绘节拍>>();

/** 动态背景是否该在本帧重绘；不重绘时保留上一帧图形。 */
export function 应重绘动态背景(图形: object, 时间: number, 允许闲置降频 = true): boolean {
  // 看着性能页时不要掉进 20 秒闲置后的 2 帧，否则实况会把省电节拍画成掉帧。
  const 闲置 =
    允许闲置降频 &&
    !正在实况观测() &&
    (typeof performance === "undefined" ? 0 : performance.now()) - 最近操作 > 画质参数.闲置判定毫秒;
  const 间隔 = 闲置
    ? 画质参数.闲置背景间隔毫秒
    : 是省电模式()
      ? 画质参数.省电背景间隔毫秒
      : 画质参数.标准背景间隔毫秒;
  let 节拍 = 重绘节拍.get(图形);
  if (!节拍) {
    节拍 = 创建重绘节拍();
    重绘节拍.set(图形, 节拍);
  }
  return 节拍(时间, 间隔);
}

export function 清除实测低端(): void {
  实测低端缓存 = false;
  try {
    localStorage.removeItem(实测低端键);
  } catch {}
}

