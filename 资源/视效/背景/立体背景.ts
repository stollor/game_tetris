import { 立体规范 } from "../../主题/立体/立体规范";
import type { 图形对象 } from "../../../.gamemaker/依赖/框架/界面/绘制/协议";

const 面 = 立体规范.界面;

export function 绘制立体背景(图: 图形对象, 宽: number, 高: number): void {
  图.fillStyle(面.壳).fillRect(0, 0, 宽, 高);
  图.fillStyle(面.壳面, 0.55).fillRect(面.外沿, 面.外沿, 宽 - 面.外沿 * 2, 高 - 面.外沿 * 2);
  图
    .lineStyle(面.灯宽, 面.灯, 0.28)
    .strokeRect(面.外沿, 面.外沿, 宽 - 面.外沿 * 2, 高 - 面.外沿 * 2);
}
