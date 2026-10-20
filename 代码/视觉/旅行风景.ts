import type Phaser from "phaser";
import type { 地点皮肤 } from "../框架配置/旅行地点";
import {
  绘制旅行动态 as 共享绘制旅行动态,
  绘制旅行风景 as 共享绘制旅行风景,
} from "./背景配方/旅行风景";

/**
 * 旅行地点风景的 Phaser 入口：导出名与签名保持不变，绘制委托给引擎无关的共享配方。
 * Phaser Graphics 结构上满足 `图形对象`（见 测试/绘制接口.test.ts），无需适配层。
 */

export function 绘制旅行风景(
  g: Phaser.GameObjects.Graphics,
  像素宽: number,
  像素高: number,
  地点: 地点皮肤,
  静态主体 = true,
): void {
  共享绘制旅行风景(g, 像素宽, 像素高, 地点, 静态主体);
}

export function 绘制旅行动态(
  g: Phaser.GameObjects.Graphics,
  像素宽: number,
  像素高: number,
  时间: number,
  地点: 地点皮肤,
): void {
  共享绘制旅行动态(g, 像素宽, 像素高, 时间, 地点);
}
