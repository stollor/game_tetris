import { 像素规范 } from "../../主题/像素/像素规范";
import { 是像素风格 } from "../../主题/像素/像素风格";
import { 是立体风格 } from "../../主题/立体/立体风格";
import type { 图形对象, 矩形 } from "../../框架/界面/绘制/协议";
import { 绘制像素面板 } from "./像素绘制";
import { 绘制金属板 } from "./立体绘制";

/**
 * 覆盖页面板/分隔线：复刻 Phaser `Rectangle`（`setStrokeStyle` / 高 1 的填充矩形）的落地像素。
 *
 * Phaser 用画布像素绘制，1px 描边/1px 高的矩形在画布像素比为 1 时会被抗锯齿摊到相邻两像素
 * （透明度各半）；画布像素比 ≥2 时 1 逻辑像素正好落在整数设备像素上，是实色两条。
 * Three 的 Graphics 只会画单像素实色，所以按画布像素比切换两种落法，才能和 Phaser 对齐。
 * 尺寸/颜色仍由调用方从共享主题与共享布局取，这里只管「1px 线怎么落地」。
 */

const 面板填充透明度 = 0.98;

/** 画布像素比：与 `框架/界面/画布像素比.计算画布像素比` 同口径（上限由画质统一为 4）。 */
function 读取画布像素比(): number {
  if (typeof window === "undefined") return 1;
  const 设备 = window.devicePixelRatio;
  return Number.isFinite(设备) && 设备 > 0 ? Math.max(1, Math.floor(设备)) : 1;
}

/** 覆盖页面板：实色填充 + 1px 描边。 */
export function 绘制覆盖页面板(
  绘图: 图形对象,
  矩形: 矩形,
  填充色: number,
  描边色: number,
  描边透明度 = 0.75,
): void {
  if (是像素风格()) {
    绘制像素面板(绘图, 矩形.左, 矩形.上, 矩形.宽, 矩形.高, 填充色, 描边色);
    return;
  }
  if (是立体风格()) {
    绘制金属板(绘图, 矩形.左, 矩形.上, 矩形.宽, 矩形.高);
    return;
  }
  const { 左, 上, 宽, 高 } = 矩形;
  绘图.fillStyle(填充色, 面板填充透明度).fillRect(左, 上, 宽, 高);
  if (读取画布像素比() >= 2) {
    绘图.lineStyle(1, 描边色, 描边透明度).strokeRect(左, 上, 宽, 高);
    return;
  }
  const 半 = 描边透明度 / 2;
  绘图.fillStyle(描边色, 半);
  // 边界外侧各 1px
  绘图.fillRect(左 - 1, 上 - 1, 宽 + 2, 1);
  绘图.fillRect(左 - 1, 上 + 高, 宽 + 2, 1);
  绘图.fillRect(左 - 1, 上, 1, 高);
  绘图.fillRect(左 + 宽, 上, 1, 高);
  // 边界内侧各 1px（叠在填充上，顺序与 Phaser 先填后描一致）
  绘图.fillRect(左, 上, 宽, 1);
  绘图.fillRect(左, 上 + 高 - 1, 宽, 1);
  绘图.fillRect(左, 上 + 1, 1, 高 - 2);
  绘图.fillRect(左 + 宽 - 1, 上 + 1, 1, 高 - 2);
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
