import { type 玻璃面板选项, 绘制玻璃面板 } from "Phaser框架/界面/玻璃绘制";
import type Phaser from "phaser";
import { 查找地点 } from "../../代码/框架配置/旅行地点";
import { 绘制地点纹样 } from "./旅行纹样";
import { 读取霓虹调色板 } from "./调色板";

/**
 * 霓虹玻璃底板：统一用当前主题的面板底色与描边，其余圆角、透明度、强调辉光由调用方指定。
 * 直接画在场景已有的 Graphics 上，避免为每块装饰单独建容器。
 */
export function 绘制霓虹玻璃(
  图形: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  宽: number,
  高: number,
  选项: 玻璃面板选项 = {},
): void {
  const 调色板 = 读取霓虹调色板();
  绘制玻璃面板(图形, x, y, 宽, 高, {
    填色: 调色板.面板底,
    边色: 调色板.面板描边,
    圆角: 调色板.样式 === "青蓝未来" ? 6 : 调色板.样式 === "暖纸古典" ? 8 : 12,
    边透明度: 0.8,
    ...选项,
  });
  const 地点 = 查找地点(调色板.样式);
  if (地点) {
    绘制地点纹样(图形, x + 8, y + 5, 18, 地点.纹样, 0.65);
    绘制地点纹样(图形, x + 宽 - 28, y + 高 - 25, 18, 地点.纹样, 0.65);
  }
  const 强调 = 选项.强调色 ?? 调色板.强调;
  const 角长 = Math.min(16, 宽 / 8, 高 / 8);
  // 角部装饰留在边缘，不侵入正文和交互区域。
  图形.lineStyle(2, 强调, 0.8);
  for (const [角x, 角y, 横, 纵] of [
    [x + 4, y + 4, 1, 1],
    [x + 宽 - 4, y + 高 - 4, -1, -1],
  ]) {
    图形.lineBetween(角x, 角y + 角长 * 纵, 角x, 角y);
    图形.lineBetween(角x, 角y, 角x + 角长 * 横, 角y);
  }
}

/** 新建一块玻璃底板并挂到容器；返回图形对象以便继续叠加装饰。 */
export function 添加霓虹面板(
  场景: Phaser.Scene,
  容器: Phaser.GameObjects.Container | undefined,
  x: number,
  y: number,
  宽: number,
  高: number,
  选项: 玻璃面板选项 = {},
): Phaser.GameObjects.Graphics {
  const 图形 = 场景.add.graphics();
  绘制霓虹玻璃(图形, x, y, 宽, 高, 选项);
  容器?.add(图形);
  return 图形;
}
