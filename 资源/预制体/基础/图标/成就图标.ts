import { 是像素风格 } from "../../../主题/像素/像素风格";
import { 像素图标, 像素图标规格, 成就像素图标 } from "../../../主题/像素/界面像素规格";
import type { 成就定义 } from "../../../../代码/成就/再消一行成就";
import type { 图形对象 } from "../../../../.gamemaker/依赖/框架/界面/绘制/协议";
import { 绘制像素图案 } from "../装饰与蒙层/像素图案";

export type 成就图标编号 = (typeof 成就定义)[number]["编号"];

export const 成就图标编号列表: readonly 成就图标编号[] = [
  "first-lock",
  "first-clear",
  "four-lines",
  "spin",
  "combo",
  "b2b",
  "perfect",
  "hold",
  "lines",
  "level",
  "sprint",
  "ultra",
];

/** 32×32矢量徽章，以形状对应成就含义；颜色由页面的解锁状态提供。 */
export function 绘制成就图标(绘图: 图形对象, 编号: 成就图标编号, 颜色: number): void {
  if (是像素风格()) {
    绘制像素图案(
      绘图,
      像素图标[成就像素图标[编号]],
      像素图标规格.左,
      像素图标规格.上,
      像素图标规格.格,
      颜色,
    );
    return;
  }
  绘图.save();
  绘图.fillStyle(颜色).lineStyle(2, 颜色);
  const 格 = (x: number, y: number) => 绘图.fillRoundedRect(x, y, 6, 6, 1);
  const T块 = () => {
    格(6, 11);
    格(13, 11);
    格(20, 11);
    格(13, 18);
  };
  switch (编号) {
    case "first-lock":
      T块();
      绘图.lineBetween(5, 28, 27, 28).lineBetween(16, 3, 16, 7);
      绘图.fillTriangle(13, 6, 19, 6, 16, 9);
      break;
    case "first-clear":
      for (let i = 0; i < 4; i++) 格(3 + i * 7, 18);
      绘图.lineBetween(16, 4, 16, 11).lineBetween(10, 7, 12, 11).lineBetween(22, 7, 20, 11);
      break;
    case "four-lines":
      for (let i = 0; i < 4; i++) 绘图.fillRoundedRect(4, 4 + i * 6, 24, 4, 1);
      break;
    case "spin":
      T块();
      绘图
        .beginPath()
        .arc(16, 16, 12, -Math.PI * 0.8, Math.PI * 0.4)
        .strokePath();
      绘图.fillTriangle(26, 22, 23, 28, 30, 26);
      break;
    case "combo":
      绘图.lineBetween(6, 16, 26, 16);
      for (let i = 0; i < 3; i++) 绘图.strokeCircle(6 + i * 10, 16, 4);
      绘图.lineBetween(16, 5, 16, 8).lineBetween(16, 24, 16, 27);
      break;
    case "b2b":
      绘图.lineBetween(4, 10, 23, 10).lineBetween(28, 22, 9, 22);
      绘图.fillTriangle(21, 5, 28, 10, 21, 15).fillTriangle(11, 17, 4, 22, 11, 27);
      break;
    case "perfect":
      绘图.fillPoints(
        [
          { x: 16, y: 3 },
          { x: 20, y: 12 },
          { x: 29, y: 16 },
          { x: 20, y: 20 },
          { x: 16, y: 29 },
          { x: 12, y: 20 },
          { x: 3, y: 16 },
          { x: 12, y: 12 },
        ],
        true,
      );
      break;
    case "hold":
      绘图.strokeRoundedRect(3, 4, 16, 20, 3);
      格(8, 10);
      绘图.lineBetween(16, 28, 27, 28).lineBetween(27, 28, 27, 18);
      绘图.fillTriangle(23, 20, 27, 14, 31, 20);
      break;
    case "lines":
      for (let i = 0; i < 3; i++) 绘图.fillRoundedRect(3, 14 + i * 6, 16 + i * 4, 4, 1);
      绘图.lineBetween(22, 3, 22, 17).fillTriangle(22, 3, 30, 7, 22, 11);
      break;
    case "level":
      绘图.fillRect(4, 22, 6, 7).fillRect(12, 16, 6, 13).fillRect(20, 10, 6, 19);
      绘图.lineBetween(6, 17, 6, 7).fillTriangle(2, 8, 6, 3, 10, 8);
      break;
    case "sprint":
      绘图.lineBetween(6, 3, 6, 29);
      for (let 行 = 0; 行 < 3; 行++)
        for (let 列 = 0; 列 < 4; 列++) {
          if ((行 + 列) % 2 === 0) 绘图.fillRect(7 + 列 * 5, 4 + 行 * 5, 5, 5);
        }
      绘图.lineBetween(7, 4, 27, 4).lineBetween(27, 4, 27, 19).lineBetween(27, 19, 7, 19);
      break;
    case "ultra":
      绘图.strokeCircle(16, 17, 11).lineBetween(16, 17, 16, 10).lineBetween(16, 17, 22, 20);
      绘图.lineBetween(12, 2, 20, 2).lineBetween(16, 2, 16, 5);
      break;
  }
  绘图.restore();
}
