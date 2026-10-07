import Phaser from "phaser";
import { 绘制玻璃面板 } from "./玻璃绘制";
import { 亮色, 颜色字符串 } from "./颜色工具";

export interface 模式卡片配置 {
  宽: number;
  高: number;
  标题: string;
  说明: string;
  附注: string;
  强调色: number;
  面板色: number;
  主文字色: string;
  次文字色: string;
  字体: string;
  标题字号: number;
  说明字号: number;
  点击: () => void;
}

/** 可重复实例化的模式选择卡片预制体；文字和尺寸随实例参数变化。 */
export class 界面模式卡片 extends Phaser.GameObjects.Container {
  private readonly 背板: Phaser.GameObjects.Rectangle;
  private readonly 视觉: Phaser.GameObjects.Graphics;
  private readonly 配置: 模式卡片配置;
  private 悬停 = false;

  constructor(scene: Phaser.Scene, x: number, y: number, 配置: 模式卡片配置) {
    super(scene, x, y);
    this.配置 = 配置;
    this.setSize(配置.宽, 配置.高).setName(`mode.${配置.标题}`);
    this.视觉 = scene.add.graphics();
    this.背板 = scene.add
      .rectangle(0, 0, 配置.宽, 配置.高, 0x000000, 0.001)
      .setInteractive({ useHandCursor: true })
      .on("pointerover", () => {
        this.悬停 = true;
        this.重绘视觉();
      })
      .on("pointerout", () => {
        this.悬停 = false;
        this.重绘视觉();
      })
      .on("pointerdown", 配置.点击);
    const 条 = scene.add
      .rectangle(-配置.宽 / 2 + 3, 0, 4, Math.max(1, 配置.高 - 30), 配置.强调色)
      .setAlpha(0.95);
    const 标题 = scene.add
      .text(-配置.宽 / 2 + 22, -配置.高 * 0.12, 配置.标题, {
        fontFamily: 配置.字体,
        fontSize: `${配置.标题字号}px`,
        fontStyle: "bold",
        color: 配置.主文字色,
        letterSpacing: 1,
      })
      .setOrigin(0, 0.5);
    标题.setShadow(0, 2, "#04070f", 5, true, true);
    const 说明 = scene.add
      .text(-配置.宽 / 2 + 22, 配置.高 * 0.2, 配置.说明, {
        fontFamily: 配置.字体,
        fontSize: `${配置.说明字号}px`,
        color: 配置.次文字色,
      })
      .setOrigin(0, 0.5);
    说明.setShadow(0, 1, "#04070f", 4, true, true);
    const 箭头 = scene.add
      .text(配置.宽 / 2 - 18, -配置.高 * 0.14, "↗", {
        fontSize: `${Math.max(18, 配置.高 * 0.2)}px`,
        color: 颜色字符串(配置.强调色),
      })
      .setOrigin(1, 0.5);
    箭头.setShadow(0, 0, 颜色字符串(配置.强调色), 10, true, true);
    const 附注 = scene.add
      .text(配置.宽 / 2 - 18, 配置.高 * 0.22, 配置.附注, {
        fontFamily: '"Segoe UI", "Microsoft YaHei", sans-serif',
        fontSize: `${Math.max(11, Math.min(配置.高 * 0.12, 14))}px`,
        color: 配置.次文字色,
      })
      .setOrigin(1, 0.5);
    this.add([this.视觉, this.背板, 条, 标题, 说明, 箭头, 附注]);
    this.重绘视觉();
    scene.add.existing(this);
  }

  private 重绘视觉(): void {
    const { 宽, 高, 面板色, 强调色 } = this.配置;
    this.视觉.clear();
    绘制玻璃面板(this.视觉, -宽 / 2, -高 / 2, 宽, 高, {
      圆角: Math.min(20, 高 * 0.16),
      填色: this.悬停 ? 亮色(面板色, 0.12) : 面板色,
      透明度: this.悬停 ? 0.97 : 0.92,
      边色: this.悬停 ? 亮色(强调色, 0.25) : 亮色(面板色, 0.32),
      边透明度: this.悬停 ? 0.8 : 0.5,
      强调色: this.悬停 ? 强调色 : undefined,
      高光: true,
    });
  }
}
