import Phaser from "phaser";
import { 界面控件 } from "./控件";

export interface 滑块配置 {
  宽: number;
  命中高?: number;
  值: number;
  最小值?: number;
  最大值?: number;
  步进?: number;
  name: string;
  轨道色: string;
  强调色: string;
  变化: (值: number) => void;
}

/** Phaser 交互容器实现的水平数值滑块，拖动期间持续回报预览值。 */
export class 界面滑块 extends 界面控件 {
  private readonly 轨道: Phaser.GameObjects.Rectangle;
  private readonly 填充: Phaser.GameObjects.Rectangle;
  private readonly 滑块头: Phaser.GameObjects.Arc;
  private 轨道宽: number;
  private 命中高: number;
  private readonly 最小值: number;
  private readonly 最大值: number;
  private readonly 步进: number;
  private readonly 强调色值: number;
  private 当前值: number;
  private 正在拖动 = false;

  constructor(scene: Phaser.Scene, x: number, y: number, 配置: 滑块配置) {
    const 命中高 = 配置.命中高 ?? 32;
    super(scene, x, y, 配置.宽, 命中高);
    this.name = 配置.name;
    this.轨道宽 = 配置.宽;
    this.命中高 = 命中高;
    this.最小值 = 配置.最小值 ?? 0;
    this.最大值 = 配置.最大值 ?? 100;
    this.步进 = 配置.步进 ?? 1;
    this.强调色值 = this.颜色值(配置.强调色);
    this.当前值 = this.规范值(配置.值);

    this.轨道 = scene.add.rectangle(0, 0, this.轨道宽, 8, this.颜色值(配置.轨道色));
    this.填充 = scene.add
      .rectangle(-this.轨道宽 / 2, 0, this.轨道宽 * this.比例(this.当前值), 8, this.强调色值)
      .setOrigin(0, 0.5);
    this.滑块头 = scene.add.circle(
      -this.轨道宽 / 2 + this.轨道宽 * this.比例(this.当前值),
      0,
      this.命中高 < 30 ? 8 : 9,
      this.强调色值,
    );
    this.add([this.轨道, this.填充, this.滑块头]);
    this.setInteractive({
      useHandCursor: true,
      hitArea: new Phaser.Geom.Rectangle(0, 0, this.轨道宽, this.命中高),
      hitAreaCallback: Phaser.Geom.Rectangle.Contains,
    });
    this.on("pointerdown", (指针: Phaser.Input.Pointer) => {
      this.正在拖动 = true;
      this.scene.input.on("pointermove", this.拖动更新, this);
      this.scene.input.on("pointerup", this.结束拖动, this);
      this.预览(指针.worldX, 指针.worldY);
    });
    this.on("pointerup", this.结束拖动, this);
    this.on("pointerupoutside", this.结束拖动, this);
    this.on("commit", 配置.变化);
    this.once("destroy", () => {
      scene.input.off("pointermove", this.拖动更新, this);
      scene.input.off("pointerup", this.结束拖动, this);
    });
    scene.add.existing(this);
  }

  setValue(值: number, 通知 = false): this {
    this.当前值 = this.规范值(值);
    this.更新图形();
    if (通知) this.emit("change", this.当前值);
    return this;
  }

  getValue(): number {
    return this.当前值;
  }

  protected 布局尺寸变化(宽: number, 高: number): void {
    this.轨道宽 = 宽;
    this.轨道.setSize(宽, 8);
    this.命中高 = 高;
    if (this.input) this.input.hitArea = new Phaser.Geom.Rectangle(0, 0, 宽, 高);
    this.填充.setX(-宽 / 2);
    this.更新图形();
  }

  private 预览(指针世界X: number, 指针世界Y: number): void {
    const 局部指针 = this.getWorldTransformMatrix().applyInverse(
      指针世界X,
      指针世界Y,
      new Phaser.Math.Vector2(),
    );
    const 比例值 = Phaser.Math.Clamp((局部指针.x + this.轨道宽 / 2) / this.轨道宽, 0, 1);
    this.当前值 = this.规范值(this.最小值 + 比例值 * (this.最大值 - this.最小值));
    this.更新图形();
    this.emit("change", this.当前值);
  }

  private 结束拖动(): void {
    if (!this.正在拖动) return;
    this.正在拖动 = false;
    this.scene.input.off("pointermove", this.拖动更新, this);
    this.scene.input.off("pointerup", this.结束拖动, this);
    this.emit("commit", this.当前值);
  }

  private 拖动更新(指针: Phaser.Input.Pointer): void {
    if (this.正在拖动 && 指针.isDown) this.预览(指针.worldX, 指针.worldY);
  }

  private 更新图形(): void {
    const 比例值 = this.比例(this.当前值);
    this.填充.setSize(this.轨道宽 * 比例值, 8);
    this.滑块头.setX(-this.轨道宽 / 2 + this.轨道宽 * 比例值);
  }

  private 规范值(值: number): number {
    const 限制值 = Phaser.Math.Clamp(值, this.最小值, this.最大值);
    const 步进值 = Math.round((限制值 - this.最小值) / this.步进) * this.步进 + this.最小值;
    return Phaser.Math.Clamp(步进值, this.最小值, this.最大值);
  }

  private 比例(值: number): number {
    return this.最大值 === this.最小值 ? 0 : (值 - this.最小值) / (this.最大值 - this.最小值);
  }

  private 颜色值(颜色: string): number {
    return Number.parseInt(颜色.replace("#", ""), 16);
  }
}
