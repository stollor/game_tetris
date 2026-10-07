import Phaser from "phaser";
import { 绘制玻璃面板 } from "./玻璃绘制";
import { 亮色 } from "./颜色工具";

export interface 数值面板项 {
  标题: string;
  数值: string;
  强调色: string;
}

export interface 数值面板样式 {
  面板色: string;
  边框色: string;
  标签色: string;
  字体?: string;
}

/** 多列标签/数值面板预制体；指标数量和视觉参数均由实例数据决定。 */
export class 界面数值面板 extends Phaser.GameObjects.Container {
  private readonly 背板: Phaser.GameObjects.Graphics;
  private readonly 项目: { 标签: Phaser.GameObjects.Text; 数值: Phaser.GameObjects.Text }[];
  private readonly 配置: 数值面板样式;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    宽: number,
    高: number,
    项目: 数值面板项[],
    配置: 数值面板样式,
  ) {
    super(scene, x, y);
    this.配置 = 配置;
    this.背板 = scene.add.graphics();
    this.项目 = 项目.map((项) => ({
      标签: scene.add.text(0, 0, 项.标题, {
        fontFamily: 配置.字体 ?? '"Segoe UI", "Microsoft YaHei", sans-serif',
        fontSize: "13px",
        color: 配置.标签色,
        letterSpacing: 1,
      }),
      数值: scene.add.text(0, 0, 项.数值, {
        fontFamily: 配置.字体 ?? '"Segoe UI", "Microsoft YaHei", sans-serif',
        fontSize: "23px",
        fontStyle: "bold",
        color: 项.强调色,
      }),
    }));
    for (const 项 of this.项目) {
      项.标签.setOrigin(0.5, 0);
      项.数值.setOrigin(0.5, 0);
    }
    this.add([this.背板, ...this.项目.flatMap((项) => [项.标签, 项.数值])]);
    this.布局(宽, 高);
    scene.add.existing(this);
  }

  更新(数值: string[]): this {
    this.项目.forEach((项, 索引) => {
      const 值 = 数值[索引] ?? "0";
      if (项.数值.text !== 值) 项.数值.setText(值);
    });
    return this;
  }

  布局(宽: number, 高: number): this {
    const 列宽 = 宽 / this.项目.length;
    this.setSize(宽, 高);
    this.背板.clear();
    绘制玻璃面板(this.背板, -宽 / 2, -高 / 2, 宽, 高, {
      圆角: 12,
      填色: this.颜色值(this.配置.面板色),
      透明度: 0.92,
      边色: this.颜色值(this.配置.边框色),
      边透明度: 0.55,
      高光: true,
    });
    for (let 索引 = 1; 索引 < this.项目.length; 索引 += 1) {
      const 分隔X = -宽 / 2 + 列宽 * 索引;
      this.背板
        .fillStyle(亮色(this.颜色值(this.配置.边框色), 0.35), 0.35)
        .fillRect(分隔X, -高 * 0.3, 1, 高 * 0.6)
        .fillStyle(0x04070f, 0.28)
        .fillRect(分隔X + 1, -高 * 0.3, 1, 高 * 0.6);
    }
    this.项目.forEach((项, 索引) => {
      const x = -宽 / 2 + 列宽 * (索引 + 0.5);
      项.标签.setPosition(x, -高 * 0.34).setFontSize(`${Math.max(11, Math.min(13, 高 * 0.21))}px`);
      项.数值.setPosition(x, -高 * 0.03).setFontSize(`${Math.max(16, Math.min(25, 高 * 0.39))}px`);
    });
    return this;
  }

  private 颜色值(颜色: string): number {
    return Number.parseInt(颜色.replace("#", ""), 16);
  }
}
