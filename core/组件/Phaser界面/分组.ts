import type Phaser from "phaser";
import { 界面布局 } from "./布局";
import { 界面控件 } from "./控件";

export interface 分组配置 {
  标题: string;
  宽: number;
  强调色: string;
  字号?: string;
}

/** 带标题与分隔线的控件组；行项目由内部垂直布局自动排列。 */
export class 界面分组 extends 界面控件 {
  private readonly 标题: Phaser.GameObjects.Text;
  private readonly 分隔线: Phaser.GameObjects.Rectangle;
  private readonly 行布局: 界面布局;
  private 分组宽: number;
  private readonly 标题高 = 30;

  constructor(scene: Phaser.Scene, x: number, y: number, 配置: 分组配置) {
    super(scene, x, y, 配置.宽, 30);
    this.分组宽 = 配置.宽;
    this.标题 = scene.add
      .text(0, 0, 配置.标题, {
        fontFamily: "sans-serif",
        fontSize: 配置.字号 ?? "13px",
        color: 配置.强调色,
        padding: { left: 0, right: 6, top: 6, bottom: 6 },
      })
      .setOrigin(0, 0.5);
    this.分隔线 = scene.add.rectangle(0, 0, 配置.宽, 1, this.颜色值(配置.强调色), 0.32);
    this.行布局 = new 界面布局(scene, 0, 0, {
      方向: "垂直",
      宽: 配置.宽,
      高: 0,
      自动主轴尺寸: true,
    });
    this.add([this.标题, this.分隔线, this.行布局]);
    scene.add.existing(this);
    this.更新内部位置();
  }

  添加行(行: Phaser.GameObjects.GameObject, 高度: number, 间距 = 8): this {
    this.行布局.添加(行, { 宽: this.分组宽, 高: 高度, 间距后: 间距 });
    const 高 = this.标题高 + this.行布局.获取首选尺寸().高;
    this.更新首选尺寸(this.分组宽, 高);
    this.更新内部位置();
    return this;
  }

  getContentHeight(): number {
    return this.height;
  }

  设置布局尺寸(宽: number, 高: number): this {
    this.分组宽 = 宽;
    this.更新首选尺寸(宽, 高);
    this.分隔线.setSize(宽, 1);
    this.行布局.设置布局尺寸(宽, Math.max(0, 高 - this.标题高));
    this.更新内部位置();
    return this;
  }

  private 更新内部位置(): void {
    const 内容高 = this.行布局.获取首选尺寸().高;
    const 标题Y = -this.height / 2 + this.标题高 / 2;
    this.标题.setPosition(-this.width / 2, 标题Y);
    this.分隔线.setPosition(0, -this.height / 2 + this.标题高);
    this.行布局.setPosition(0, -this.height / 2 + this.标题高 + 内容高 / 2);
  }

  private 颜色值(颜色: string): number {
    return Number.parseInt(颜色.replace("#", ""), 16);
  }
}
