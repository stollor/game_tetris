import type Phaser from "phaser";
import { 创建重绘节拍 } from "../../框架/性能/帧率";
import { 获取游戏设置 } from "../配置/再消一行设置";

/**
 * 省电/低特效：低端机自动降级，设置里可强制开关。
 * - 两档都保留最高 3 倍画布精度，省电不降低方块与文字清晰度。
 * - 标准限 60 帧，省电限 30 帧，避免高刷设备无上限更新。
 * - 缓慢背景标准 10 帧、省电 5 帧；菜单/商店闲置后 2 帧；页面隐藏时 Phaser 自带暂停。
 */
const 实测低端键 = "再消一行:实测低端";
export const 画质参数 = {
  标准像素比上限: 3,
  省电像素比上限: 3,
  标准帧率: 60,
  省电帧率: 30,
  标准背景间隔毫秒: 100,
  省电背景间隔毫秒: 200,
  闲置背景间隔毫秒: 500,
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
const 重绘节拍 = new WeakMap<object, ReturnType<typeof 创建重绘节拍>>();

/** 动态背景是否该在本帧重绘；不重绘时保留上一帧图形。 */
export function 应重绘动态背景(图形: object, 时间: number, 允许闲置降频 = true): boolean {
  const 闲置 =
    允许闲置降频 &&
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

export function 应用帧率(游戏: Phaser.Game): void {
  const 限帧 = 是省电模式() ? 画质参数.省电帧率 : 画质参数.标准帧率;
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
  const 更新帧率 = () => 应用帧率(游戏);
  window.addEventListener("gamemaker:settings-change", 更新帧率);
  游戏.events.once("destroy", () => {
    window.removeEventListener("gamemaker:settings-change", 更新帧率);
    for (const 事件 of ["pointerdown", "keydown", "touchstart", "wheel"])
      window.removeEventListener(事件, 记操作);
  });
  if (获取游戏设置().省电模式 !== "自动" || 是省电模式()) return;
  let 帧数 = 0;
  let 起点 = 0;
  const 采样 = (时间: number) => {
    // 空闲调度主动降频不代表低端设备；只在正常循环期间评估。
    if (document.hidden || !游戏.loop.running) {
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
            实测低端缓存 = true;
            localStorage.setItem(实测低端键, "1");
          } catch {}
          应用帧率(游戏);
        }
        游戏.events.off("poststep", 采样);
      }
    }
  };
  // 等首屏加载稳定后再采样。
  const 定时 = setTimeout(() => 游戏.events.on("poststep", 采样), 3000);
  游戏.events.once("destroy", () => {
    clearTimeout(定时);
    游戏.events.off("poststep", 采样);
  });
}

export function 清除实测低端(): void {
  运行时降级 = false;
  实测低端缓存 = false;
  try {
    localStorage.removeItem(实测低端键);
  } catch {}
}
