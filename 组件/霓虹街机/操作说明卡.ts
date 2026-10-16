import type Phaser from "phaser";
import { 游戏外观 } from "../../代码/配置/游戏外观";
import { 绘制霓虹玻璃 } from "./底板";
import { 添加霓虹原生文字 } from "./文字";
import { 读取霓虹调色板 } from "./调色板";

export interface 霓虹操作说明配置 {
  标题: string;
  说明: string[];
  提示: string;
}

export interface 霓虹操作说明布局 {
  宽: number;
  键位区X: number;
  键位区顶: number;
  紧凑: boolean;
  可见: boolean;
}

/**
 * 对局操作说明卡：标题、六条键位说明和快速移动提示。
 * 文案由调用方提供，组件只负责字体、配色、位置与显隐。
 */
export class 霓虹操作说明卡 {
  readonly 标题: Phaser.GameObjects.Text;
  readonly 说明: Phaser.GameObjects.Text[];
  readonly 提示: Phaser.GameObjects.Text;

  constructor(场景: Phaser.Scene, 配置: 霓虹操作说明配置) {
    const 调色板 = 读取霓虹调色板();
    this.标题 = 添加霓虹原生文字(场景, undefined, 0, 0, 配置.标题, {
      字号: 游戏外观.字体.小标题,
      颜色: 调色板.强调色,
      粗体: true,
    });
    this.说明 = 配置.说明.map((文案) =>
      添加霓虹原生文字(场景, undefined, 0, 0, 文案, {
        字号: 游戏外观.字体.正文,
        颜色: 调色板.次要文字,
      }),
    );
    this.提示 = 添加霓虹原生文字(场景, undefined, 0, 0, 配置.提示, {
      字号: 游戏外观.字体.辅助,
      颜色: 调色板.弱化文字,
    });
  }

  /** 绘制卡片玻璃底板，位置由场景按棋盘布局给出。 */
  绘制底板(
    图形: Phaser.GameObjects.Graphics,
    左: number,
    顶: number,
    宽: number,
    高: number,
  ): void {
    绘制霓虹玻璃(图形, 左, 顶, 宽, 高, {
      填色: 读取霓虹调色板().面板底,
      透明度: 0.98,
      高光: false,
    });
  }

  设置说明(索引: number, 文案: string): void {
    const 对象 = this.说明[索引];
    if (对象 && 对象.text !== 文案) 对象.setText(文案);
  }

  布局(布局: 霓虹操作说明布局): void {
    const { 宽, 键位区X, 键位区顶, 紧凑, 可见 } = 布局;
    this.标题
      .setPosition(紧凑 ? 宽 / 2 : 键位区X, 键位区顶)
      .setOrigin(紧凑 ? 0.5 : 0, 0)
      .setFontSize(`${紧凑 ? 11 : 13}px`)
      .setVisible(可见);
    const 列位置 = 紧凑 ? [宽 * 0.25, 宽 * 0.75] : [键位区X, 键位区X];
    this.说明.forEach((说明, 索引) => {
      说明
        .setPosition(列位置[索引 % 2] ?? 键位区X, 键位区顶 + 26 + 索引 * 24)
        .setOrigin(紧凑 ? 0.5 : 0, 0)
        .setFontSize(`${紧凑 ? 10 : 12}px`)
        .setVisible(可见);
    });
    this.提示
      .setPosition(紧凑 ? 宽 / 2 : 键位区X, 键位区顶 + 190)
      .setOrigin(紧凑 ? 0.5 : 0, 0)
      .setFontSize(`${紧凑 ? 10 : 11}px`)
      .setVisible(可见);
  }
}
