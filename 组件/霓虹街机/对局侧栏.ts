import type Phaser from "phaser";
import { 游戏外观 } from "../../代码/配置/游戏外观";
import { 绘制霓虹玻璃 } from "./底板";
import { 添加霓虹原生文字 } from "./文字";
import { 读取霓虹调色板 } from "./调色板";

export interface 霓虹侧栏几何 {
  左: number;
  顶: number;
  宽: number;
  高: number;
  竖屏: boolean;
  紧凑: boolean;
}

/** 对局侧栏底板与分隔线。位置由场景的响应式布局算出，配色走霓虹配方。 */
export function 绘制霓虹侧栏(图形: Phaser.GameObjects.Graphics, 几何: 霓虹侧栏几何): void {
  const 调色板 = 读取霓虹调色板();
  const { 左, 顶, 宽, 高, 竖屏, 紧凑 } = 几何;
  if (竖屏) {
    绘制霓虹玻璃(图形, 左, 顶, 宽, 高, {
      圆角: 14,
      透明度: 0.98,
      边色: 调色板.分组线,
      边透明度: 0.65,
    });
    图形.fillStyle(调色板.分组线, 0.6).fillRect(左 + 10, 顶 + 高 - 144, 宽 - 20, 1);
    return;
  }
  if (紧凑) return;
  绘制霓虹玻璃(图形, 左, 顶, 宽, 高, {
    圆角: 18,
    透明度: 0.98,
    边色: 调色板.分组线,
    边透明度: 0.6,
    强调色: 调色板.强调,
  });
  // 分隔线：三段渐变、两端渐隐，不形成横向接缝；位于记录页脚上方
  const 线X = 左 + 16;
  const 线宽 = 196;
  const 线Y = 顶 + 高 - 84;
  图形
    .fillGradientStyle(调色板.分组线, 调色板.分组线, 调色板.分组线, 调色板.分组线, 0, 0.32, 0, 0.32)
    .fillRect(线X, 线Y, 线宽 * 0.35, 1)
    .fillStyle(调色板.分组线, 0.32)
    .fillRect(线X + 线宽 * 0.35, 线Y, 线宽 * 0.3, 1)
    .fillGradientStyle(调色板.分组线, 调色板.分组线, 调色板.分组线, 调色板.分组线, 0.32, 0, 0.32, 0)
    .fillRect(线X + 线宽 * 0.65, 线Y, 线宽 * 0.35, 1);
}

export interface 霓虹纪录页脚配置 {
  标签: string;
  值: string;
}

export interface 霓虹纪录页脚布局 {
  竖屏: boolean;
  紧凑: boolean;
  宽: number;
  侧栏X: number;
  侧栏宽: number;
  侧栏底: number;
  棋盘顶部: number;
  棋盘像素高: number;
}

/** 侧栏底部的最佳纪录页脚。文案由场景写入，组件只负责位置、字号与配色。 */
export class 霓虹纪录页脚 {
  readonly 标签: Phaser.GameObjects.Text;
  readonly 文字: Phaser.GameObjects.Text;

  constructor(场景: Phaser.Scene, 配置: 霓虹纪录页脚配置) {
    const 调色板 = 读取霓虹调色板();
    this.标签 = 添加霓虹原生文字(场景, undefined, 0, 0, 配置.标签, {
      字号: 游戏外观.字体.辅助,
      颜色: 调色板.正文,
      字距: 2,
    });
    this.文字 = 添加霓虹原生文字(场景, undefined, 0, 0, 配置.值, {
      字号: 16,
      颜色: 调色板.强调色,
      粗体: true,
    });
  }

  设置值(文案: string): void {
    if (this.文字.text !== 文案) this.文字.setText(文案);
  }

  布局(布局: 霓虹纪录页脚布局): void {
    const { 竖屏, 紧凑, 宽, 侧栏X, 侧栏宽, 侧栏底, 棋盘顶部, 棋盘像素高 } = 布局;
    const 指标X = 宽 * 0.75;
    this.标签
      .setPosition(
        竖屏 ? 侧栏X + 侧栏宽 / 2 : 紧凑 ? 指标X : 侧栏X + 16,
        竖屏 ? 侧栏底 - 124 : 紧凑 ? 棋盘顶部 + 棋盘像素高 + 20 : 侧栏底 - 66,
      )
      .setOrigin(紧凑 ? 0.5 : 0, 0)
      .setFontSize(`${竖屏 ? (宽 < 640 ? 13 : 14) : 12}px`);
    this.文字
      .setPosition(
        竖屏 ? 侧栏X + 侧栏宽 / 2 : 紧凑 ? 指标X : 侧栏X + 16,
        竖屏 ? 侧栏底 - 96 : 紧凑 ? 棋盘顶部 + 棋盘像素高 + 38 : 侧栏底 - 44,
      )
      .setOrigin(紧凑 ? 0.5 : 0, 0)
      .setFontSize(`${竖屏 ? 18 : 16}px`);
  }
}
