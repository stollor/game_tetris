import { 像素规范 } from "../../../主题/像素/像素规范";
import { 是像素风格 } from "../../../主题/像素/像素风格";
import type { 图形对象 } from "../../../../.gamemaker/依赖/框架/界面/绘制/协议";

/**
 * 覆盖页分组分隔线：复刻 Phaser `Rectangle(0,0,宽,1)` 的落地像素。
 *
 * Phaser 用画布像素绘制，1px 高的矩形在画布像素比为 1 时会被抗锯齿摊到相邻两像素
 * （透明度各半）；画布像素比 ≥2 时 1 逻辑像素正好落在整数设备像素上，是实色一条。
 * Three 的 Graphics 只会画单像素实色，所以按画布像素比切换两种落法，才能和 Phaser 对齐。
 */

/** 画布像素比：与 `.gamemaker/依赖/框架/界面/画布像素比.计算画布像素比` 同口径（上限由画质统一为 4）。 */
function 读取画布像素比(): number {
  if (typeof window === "undefined") return 1;
  const 设备 = window.devicePixelRatio;
  return Number.isFinite(设备) && 设备 > 0 ? Math.max(1, Math.floor(设备)) : 1;
}

/** 覆盖页分组分隔线：`Rectangle(0,0,宽,1)` 的落地。 */
export function 绘制覆盖页分隔线(
  绘图: 图形对象,
  左: number,
  上: number,
  宽: number,
  颜色: number,
  透明度 = 0.32,
): void {
  if (是像素风格()) {
    绘图.fillStyle(颜色).fillRect(Math.round(左), Math.round(上), Math.round(宽), 像素规范.描边);
    return;
  }
  if (读取画布像素比() >= 2) {
    绘图.fillStyle(颜色, 透明度).fillRect(左, 上, 宽, 1);
    return;
  }
  绘图.fillStyle(颜色, 透明度 / 2);
  绘图.fillRect(左, 上 - 1, 宽, 1);
  绘图.fillRect(左, 上, 宽, 1);
}
