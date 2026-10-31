import { 像素规范 } from "../../../主题/像素/像素规范";
import { 是像素风格 } from "../../../主题/像素/像素风格";
import { 像素图标, 像素图标规格 } from "../../../主题/像素/界面像素规格";
import type { 图形对象 } from "../../../框架/界面/绘制/协议";
import { 绘制像素图案 } from "../装饰与蒙层/像素图案";

export type 旅行图标名称 = "关闭" | "方块币" | "风景" | "设置" | "成就" | "商店" | "排行";

/**
 * 旅行图标的引擎无关绘制：在 32×32 逻辑方格里画图形指令。
 * Three 版用画笔.图形直接缩放绘制，形状只有这一份来源。
 */
export function 绘制旅行图标(绘图: 图形对象, 名称: 旅行图标名称): void {
  if (是像素风格()) {
    绘制像素图案(
      绘图,
      像素图标[名称],
      像素图标规格.左,
      像素图标规格.上,
      像素图标规格.格,
      名称 === "方块币" || 名称 === "成就" ? 像素规范.色.黄 : 像素规范.色.墨,
    );
    return;
  }
  if (名称 === "关闭")
    绘图.lineStyle(2.5, 0xffffff).lineBetween(7, 7, 25, 25).lineBetween(25, 7, 7, 25);
  if (名称 === "方块币") {
    for (const [列, 行] of [
      [0, 0],
      [1, 0],
      [0, 1],
      [1, 1],
    ]) {
      const x = 3 + 列 * 14,
        y = 3 + 行 * 14;
      绘图.fillStyle(0xf4c66c).fillRoundedRect(x, y, 12, 12, 2);
      绘图.lineStyle(1, 0x80531f).strokeRoundedRect(x, y, 12, 12, 2);
      绘图.fillStyle(0xfff3bf).fillRect(x + 2, y + 2, 8, 2);
    }
  }
  if (名称 === "风景")
    绘图
      .lineStyle(2, 0xffffff)
      .strokeRoundedRect(3, 5, 26, 22, 4)
      .strokeTriangle(5, 24, 13, 13, 20, 24)
      .strokeTriangle(15, 24, 22, 16, 28, 24)
      .strokeCircle(23, 11, 2);
  if (名称 === "设置") {
    绘图.lineStyle(2.2, 0xffffff).strokeCircle(16, 16, 6);
    for (let i = 0; i < 6; i++) {
      const 角 = (i * Math.PI) / 3;
      绘图.lineBetween(
        16 + Math.cos(角) * 8.5,
        16 + Math.sin(角) * 8.5,
        16 + Math.cos(角) * 13.5,
        16 + Math.sin(角) * 13.5,
      );
    }
  }
  if (名称 === "成就") {
    绘图.lineStyle(2.2, 0xffe7a8);
    const 星 = [
      16, 4, 19.4, 12.2, 28, 12.6, 21.4, 18.2, 23.6, 26.5, 16, 22, 8.4, 26.5, 10.6, 18.2, 4, 12.6,
      12.6, 12.2,
    ];
    绘图.beginPath();
    绘图.moveTo(星[0] ?? 16, 星[1] ?? 4);
    for (let i = 2; i < 星.length; i += 2) 绘图.lineTo(星[i] ?? 0, 星[i + 1] ?? 0);
    绘图.closePath();
    绘图.strokePath();
  }
  if (名称 === "商店") {
    绘图.lineStyle(2.2, 0xffffff).strokeRoundedRect(8, 13, 16, 14, 3);
    绘图.beginPath();
    绘图.moveTo(12, 13);
    绘图.lineTo(12, 10);
    绘图.arc(16, 10, 4, Math.PI, 0, false);
    绘图.lineTo(20, 13);
    绘图.strokePath();
  }
  if (名称 === "排行") {
    // 深描边 + 浅填充，亮/暗背景下都易辨认
    const 画柱 = (x: number, y: number, w: number, h: number) => {
      绘图.fillStyle(0xffe7a8, 0.95).fillRoundedRect(x, y, w, h, 1.5);
      绘图.lineStyle(2, 0x1a2430, 0.95).strokeRoundedRect(x, y, w, h, 1.5);
    };
    画柱(6, 14, 6, 12);
    画柱(13, 7, 6, 19);
    画柱(20, 11, 6, 15);
    绘图.lineStyle(2.4, 0x1a2430, 0.95).lineBetween(5, 27, 27, 27);
    绘图.lineStyle(1.6, 0xffe7a8, 0.9).lineBetween(5, 27, 27, 27);
  }
}
