import Phaser from "phaser";

export interface 控件尺寸 {
  宽: number;
  高: number;
}

export interface 文字控件配置 extends 控件尺寸 {
  文案: string;
  字号: string;
  颜色: string;
  字体?: string;
  内边距?: number;
  对齐?: "左" | "中";
}

function 解析内边距(值: number | undefined): Phaser.Types.GameObjects.Text.TextPadding {
  const 内边距 = 值 ?? 8;
  return { left: 内边距, right: 内边距, top: 内边距, bottom: 内边距 };
}

/** 所有可参与自动布局的 Phaser UI 控件共享的尺寸约定。 */
export class 界面控件 extends Phaser.GameObjects.Container {
  private 首选尺寸: 控件尺寸;

  constructor(scene: Phaser.Scene, x: number, y: number, 宽: number, 高: number) {
    super(scene, x, y);
    this.首选尺寸 = { 宽, 高 };
    this.setSize(宽, 高);
  }

  获取首选尺寸(): 控件尺寸 {
    return { ...this.首选尺寸 };
  }

  设置布局尺寸(宽: number, 高: number): this {
    this.setSize(宽, 高);
    this.布局尺寸变化(宽, 高);
    return this;
  }

  protected 更新首选尺寸(宽: number, 高: number): void {
    this.首选尺寸 = { 宽, 高 };
    this.setSize(宽, 高);
  }

  protected 创建矩形命中区域(宽 = this.width, 高 = this.height): Phaser.Geom.Rectangle {
    return new Phaser.Geom.Rectangle(0, 0, 宽, 高);
  }

  protected 更新矩形命中区域(宽 = this.width, 高 = this.height): void {
    if (this.input) this.input.hitArea = this.创建矩形命中区域(宽, 高);
  }

  protected 布局尺寸变化(_宽: number, _高: number): void {}
}

/** 自动测量文本尺寸并为不同字体回退留出安全内边距。 */
export class 界面文字 extends 界面控件 {
  private readonly 文本对象: Phaser.GameObjects.Text;
  private 固定宽度?: number;
  private readonly 对齐: "左" | "中";

  constructor(scene: Phaser.Scene, x: number, y: number, 配置: 文字控件配置) {
    super(scene, x, y, 配置.宽, 配置.高);
    this.固定宽度 = 配置.宽 > 0 ? 配置.宽 : undefined;
    this.对齐 = 配置.对齐 ?? "中";
    this.文本对象 = scene.add
      .text(0, 0, 配置.文案, {
        fontFamily: 配置.字体 ?? "sans-serif",
        fontSize: 配置.字号,
        color: 配置.颜色,
        align: this.对齐 === "左" ? "left" : "center",
        padding: 解析内边距(配置.内边距),
        wordWrap: 配置.宽 > 0 ? { width: 配置.宽 } : undefined,
      })
      .setOrigin(0.5);
    this.add(this.文本对象);
    this.测量尺寸();
    scene.add.existing(this);
  }

  setLabel(文案: string): this {
    this.文本对象.setText(文案);
    this.测量尺寸();
    return this;
  }

  setLabelColor(颜色: string): this {
    this.文本对象.setColor(颜色);
    return this;
  }

  setFontSize(字号: string): this {
    this.文本对象.setFontSize(字号);
    this.测量尺寸();
    return this;
  }

  protected 布局尺寸变化(宽: number, 高: number): void {
    this.文本对象.setPosition(this.对齐 === "左" ? -宽 / 2 : 0, 0);
    this.文本对象.setOrigin(this.对齐 === "左" ? 0 : 0.5, 0.5);
    this.文本对象.setWordWrapWidth(Math.max(1, 宽));
    if (高 > this.文本对象.height) this.文本对象.setFixedSize(宽, 高);
  }

  private 测量尺寸(): void {
    const 宽 = this.固定宽度 ?? this.文本对象.width;
    this.更新首选尺寸(宽, Math.max(this.文本对象.height, 1));
  }
}
