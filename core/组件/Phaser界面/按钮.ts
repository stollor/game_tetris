import Phaser from "phaser";
import { 界面控件 } from "./控件";

export interface 按钮配置 {
  宽: number;
  高: number;
  文案: string;
  name: string;
  面板色: string;
  强调色: string;
  文字色: string;
  点击: () => void;
  已选?: boolean;
  字号?: string;
  样式?: "面板" | "文字";
  自适应文案?: boolean;
}

/** 由 Phaser 容器、图形和文本组成的通用可交互按钮。 */
export class 界面按钮 extends 界面控件 {
  private readonly 底板: Phaser.GameObjects.Rectangle;
  private readonly 标签: Phaser.GameObjects.Text;
  private 已选: boolean;
  private readonly 样式: "面板" | "文字";
  private readonly 面板色: string;
  private readonly 强调色: string;
  private readonly 自适应文案: boolean;

  constructor(scene: Phaser.Scene, x: number, y: number, 配置: 按钮配置) {
    super(scene, x, y, 配置.宽, 配置.高);
    this.name = 配置.name;
    this.已选 = 配置.已选 ?? false;
    this.样式 = 配置.样式 ?? "面板";
    this.面板色 = 配置.面板色;
    this.强调色 = 配置.强调色;
    this.自适应文案 = this.样式 === "文字" && 配置.自适应文案 !== false;
    const 文字按钮 = this.样式 === "文字";
    this.底板 = scene.add
      .rectangle(0, 0, 配置.宽, 配置.高, this.颜色值(this.已选 ? 配置.强调色 : 配置.面板色), 0.92)
      .setStrokeStyle(1, this.颜色值(配置.强调色), this.已选 ? 1 : 0.55);
    this.标签 = scene.add
      .text(0, 0, 配置.文案, {
        fontFamily: "sans-serif",
        fontSize: 配置.字号 ?? "15px",
        color: 配置.文字色,
        align: "center",
        padding: 文字按钮 ? { left: 18, right: 18, top: 10, bottom: 10 } : undefined,
        wordWrap: 文字按钮 ? undefined : { width: Math.max(0, 配置.宽 - 16) },
      })
      .setOrigin(0.5);
    this.add([this.底板, this.标签]);
    if (this.自适应文案) this.按文案调整尺寸();
    this.setInteractive({
      useHandCursor: true,
      hitArea: new Phaser.Geom.Rectangle(0, 0, this.width, this.height),
      hitAreaCallback: Phaser.Geom.Rectangle.Contains,
    });
    this.on("pointerup", 配置.点击);
    this.on("pointerover", () => {
      this.底板.setAlpha(文字按钮 ? 0.24 : 0.58);
      if (文字按钮) this.setScale(1.06);
    });
    this.on("pointerout", () => {
      this.底板.setAlpha(文字按钮 ? 0 : this.已选 ? 0.28 : 0.92);
      if (文字按钮) this.setScale(1);
    });
    this.底板.setAlpha(文字按钮 ? 0 : this.已选 ? 0.28 : 0.92);
    scene.add.existing(this);
  }

  setLabel(文案: string): this {
    this.标签.setText(文案);
    if (this.自适应文案) this.按文案调整尺寸();
    return this;
  }

  setLabelColor(颜色: string): this {
    this.标签.setColor(颜色);
    return this;
  }

  setSelected(已选: boolean): this {
    this.已选 = 已选;
    const 文字按钮 = this.样式 === "文字";
    this.底板.setFillStyle(this.颜色值(已选 ? this.强调色 : this.面板色));
    this.底板.setStrokeStyle(1, this.颜色值(this.强调色), 已选 ? 1 : 0.55);
    this.底板.setAlpha(文字按钮 ? 0 : 已选 ? 0.28 : 0.92);
    return this;
  }

  protected 布局尺寸变化(宽: number, 高: number): void {
    this.底板.setSize(宽, 高);
    this.标签.setWordWrapWidth(this.样式 === "文字" ? 0 : Math.max(0, 宽 - 16));
    if (this.input) this.input.hitArea = new Phaser.Geom.Rectangle(0, 0, 宽, 高);
  }

  private 按文案调整尺寸(): void {
    const 宽 = Math.max(48, this.标签.width);
    const 高 = Math.max(36, this.标签.height);
    this.更新首选尺寸(宽, 高);
    this.布局尺寸变化(宽, 高);
  }

  private 颜色值(颜色: string): number {
    return Number.parseInt(颜色.replace("#", ""), 16);
  }
}
