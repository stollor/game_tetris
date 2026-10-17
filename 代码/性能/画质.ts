import type Phaser from "phaser";
import { 获取游戏设置 } from "../配置/俄罗斯方块设置";

/**
 * 省电/低特效：低端机自动降级，设置里可强制开关。
 * - 画布像素比：标准 3，省电 2（启动时决定；实测卡顿会记住，下次启动生效）。
 * - 帧率：省电时限 30 帧。
 * - 动态背景：省电时约 15 帧重绘；菜单/商店闲置 20 秒后降到约 5 帧；页面隐藏时 Phaser 自带暂停。
 */
const 实测低端键 = "俄罗斯方块:实测低端";
export const 画质参数 = {
  标准像素比上限: 3,
  省电像素比上限: 2,
  省电帧率: 30,
  省电背景间隔毫秒: 66,
  闲置背景间隔毫秒: 200,
  闲置判定毫秒: 20000,
  实测采样毫秒: 6000,
  实测低帧阈值: 40,
} as const;

export interface 设备信息 {
  核心数?: number;
  内存GB?: number;
  像素比?: number;
  实测低端?: boolean;
}

export function 读取设备信息(): 设备信息 {
  const 导航 = typeof navigator === "undefined" ? undefined : navigator;
  let 实测低端 = false;
  try {
    实测低端 = localStorage.getItem(实测低端键) === "1";
  } catch {}
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

let 运行时降级 = false;
export function 是省电模式(选择 = 获取游戏设置().省电模式, 信息 = 读取设备信息()): boolean {
  if (选择 === "开") return true;
  if (选择 === "关") return false;
  return 运行时降级 || 判定低端设备(信息);
}

export function 计算像素比上限(省电: boolean): number {
  return 省电 ? 画质参数.省电像素比上限 : 画质参数.标准像素比上限;
}

let 最近操作 = typeof performance === "undefined" ? 0 : performance.now();
const 上次重绘 = new WeakMap<object, number>();

/** 动态背景是否该在本帧重绘；不重绘时保留上一帧图形。 */
export function 应重绘动态背景(图形: object, 时间: number, 允许闲置降频 = true): boolean {
  const 闲置 =
    允许闲置降频 &&
    (typeof performance === "undefined" ? 0 : performance.now()) - 最近操作 > 画质参数.闲置判定毫秒;
  const 间隔 = 闲置 ? 画质参数.闲置背景间隔毫秒 : 是省电模式() ? 画质参数.省电背景间隔毫秒 : 0;
  const 上次 = 上次重绘.get(图形);
  if (间隔 && 上次 !== undefined && 时间 - 上次 < 间隔 && 时间 >= 上次) return false;
  上次重绘.set(图形, 时间);
  return true;
}

export function 应用帧率(游戏: Phaser.Game): void {
  const 限帧 = 是省电模式() ? 画质参数.省电帧率 : 0;
  游戏.loop.setFPSLimit(限帧);
}

/** 启动后接入：记录操作、按设置切帧率、自动模式下实测掉帧则降级并记住。 */
export function 接入画质管理(游戏: Phaser.Game): void {
  const 记操作 = () => {
    最近操作 = performance.now();
  };
  for (const 事件 of ["pointerdown", "keydown", "touchstart", "wheel"])
    window.addEventListener(事件, 记操作, { passive: true });
  应用帧率(游戏);
  window.addEventListener("gamemaker:settings-change", () => 应用帧率(游戏));
  if (获取游戏设置().省电模式 !== "自动" || 是省电模式()) return;
  let 帧数 = 0;
  let 起点 = 0;
  const 采样 = (时间: number) => {
    if (document.hidden) {
      起点 = 0;
      帧数 = 0;
    } else if (!起点) 起点 = 时间;
    else {
      帧数 += 1;
      const 经过 = 时间 - 起点;
      if (经过 >= 画质参数.实测采样毫秒) {
        const 帧率 = (帧数 * 1000) / 经过;
        if (帧率 < 画质参数.实测低帧阈值) {
          运行时降级 = true;
          try {
            localStorage.setItem(实测低端键, "1");
          } catch {}
          应用帧率(游戏);
        }
        return;
      }
    }
    requestAnimationFrame(采样);
  };
  // 等首屏加载稳定后再采样。
  setTimeout(() => requestAnimationFrame(采样), 3000);
}

export function 清除实测低端(): void {
  运行时降级 = false;
  try {
    localStorage.removeItem(实测低端键);
  } catch {}
}
