import Phaser from "phaser";
import { 界面布局 } from "./布局";
import { 界面按钮 } from "./按钮";
import { 界面控件 } from "./控件";

export interface 下拉选项 {
  name: string;
  文案: string;
  值: string;
}

export interface 下拉菜单配置 {
  name: string;
  宽: number;
  高: number;
  文案: string;
  选项: 下拉选项[];
  面板色: string;
  强调色: string;
  文字色: string;
  选择: (值: string) => void;
  展开方向?: "上" | "下";
  选项高?: number;
}

/** 使用 Phaser 容器、按钮和垂直布局组成的下拉菜单。 */
export class 界面下拉菜单 extends 界面控件 {
  private readonly 面板: Phaser.GameObjects.Rectangle;
  private readonly 标签: Phaser.GameObjects.Text;
  private readonly 配置: 下拉菜单配置;
  private readonly 初始层级: number;
  private 选项布局?: 界面布局;
  private 展开中 = false;

  constructor(scene: Phaser.Scene, x: number, y: number, 配置: 下拉菜单配置) {
    super(scene, x, y, 配置.宽, 配置.高);
    this.name = 配置.name;
    this.初始层级 = this.depth;
    this.配置 = 配置;
    this.面板 = scene.add
      .rectangle(0, 0, 配置.宽, 配置.高, this.颜色值(配置.面板色), 0.92)
      .setStrokeStyle(1, this.颜色值(配置.强调色), 0.7);
    this.标签 = scene.add
      .text(-配置.宽 / 2 + 14, 0, 配置.文案, {
        fontFamily: "sans-serif",
        fontSize: "14px",
        color: 配置.文字色,
        padding: { left: 4, right: 8, top: 8, bottom: 8 },
        wordWrap: { width: 配置.宽 - 46 },
      })
      .setOrigin(0, 0.5);
    const 箭头 = scene.add
      .text(配置.宽 / 2 - 18, 0, "⌄", {
        fontFamily: "sans-serif",
        fontSize: "17px",
        color: 配置.强调色,
      })
      .setOrigin(0.5);
    this.add([this.面板, this.标签, 箭头]);
    this.setInteractive({
      useHandCursor: true,
      hitArea: new Phaser.Geom.Rectangle(0, 0, 配置.宽, 配置.高),
      hitAreaCallback: Phaser.Geom.Rectangle.Contains,
    });
    this.on("pointerdown", this.切换展开);
    scene.add.existing(this);
  }

  setValue(值: string): this {
    this.标签.setText(this.配置.选项.find((选项) => 选项.值 === 值)?.文案 ?? 值);
    return this;
  }

  protected 布局尺寸变化(宽: number, 高: number): void {
    this.面板.setSize(宽, 高);
    this.标签.setPosition(-宽 / 2 + 14, 0).setWordWrapWidth(Math.max(0, 宽 - 46));
    if (this.input) this.input.hitArea = new Phaser.Geom.Rectangle(0, 0, 宽, 高);
    if (this.展开中) this.更新选项位置();
  }

  private 切换展开 = (): void => {
    if (this.展开中) {
      this.收起();
      return;
    }
    this.展开();
  };

  private 展开(): void {
    this.展开中 = true;
    this.setDepth(1000);
    const 每项高 = this.配置.选项高 ?? 36;
    const 外观 = this.配置;
    this.选项布局 = new 界面布局(this.scene, 0, 0, {
      方向: "垂直",
      宽: this.width,
      高: 每项高 * this.配置.选项.length + Math.max(0, this.配置.选项.length - 1) * 2,
      间距: 2,
      主轴对齐: "起始",
    });
    for (const 选项 of this.配置.选项) {
      this.选项布局.添加(
        new 界面按钮(this.scene, 0, 0, {
          宽: this.width,
          高: 每项高,
          文案: 选项.文案,
          name: 选项.name,
          面板色: 外观.面板色,
          强调色: 外观.强调色,
          文字色: 外观.文字色,
          点击: () => {
            this.收起();
            this.配置.选择(选项.值);
          },
          字号: "14px",
        }),
        { 宽: this.width, 高: 每项高 },
      );
    }
    this.add(this.选项布局);
    this.更新选项位置();
  }

  private 收起(): void {
    this.展开中 = false;
    this.setDepth(this.初始层级);
    if (!this.选项布局) return;
    this.remove(this.选项布局, true);
    this.选项布局 = undefined;
  }

  private 更新选项位置(): void {
    if (!this.选项布局) return;
    const 方向 = this.配置.展开方向 === "下" ? 1 : -1;
    this.选项布局.setPosition(0, 方向 * (this.height / 2 + this.选项布局.height / 2 + 2));
  }

  private 颜色值(颜色: string): number {
    return Number.parseInt(颜色.replace("#", ""), 16);
  }
}
