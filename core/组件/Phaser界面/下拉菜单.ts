import Phaser from "phaser";
import { 界面布局 } from "./布局";
import { 界面按钮 } from "./按钮";
import { 绑定按钮手势, 界面控件 } from "./控件";
import { 绘制玻璃面板 } from "./玻璃绘制";

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
  private readonly 箭头: Phaser.GameObjects.Graphics;
  private readonly 视觉: Phaser.GameObjects.Graphics;
  private readonly 标签: Phaser.GameObjects.Text;
  private readonly 配置: 下拉菜单配置;
  private readonly 初始层级: number;
  private 当前值: string;
  private 选项布局?: 界面布局;
  private 展开底板?: Phaser.GameObjects.Graphics;
  private 展开中 = false;

  constructor(scene: Phaser.Scene, x: number, y: number, 配置: 下拉菜单配置) {
    super(scene, x, y, 配置.宽, 配置.高);
    this.name = 配置.name;
    this.初始层级 = this.depth;
    this.配置 = 配置;
    this.当前值 = 配置.选项.find((选项) => 选项.文案 === 配置.文案)?.值 ?? 配置.选项[0]?.值 ?? "";
    this.视觉 = scene.add.graphics();
    this.面板 = scene.add
      .rectangle(0, 0, 配置.宽, 配置.高, this.颜色值(配置.面板色), 0.001)
      .setStrokeStyle(1, this.颜色值(配置.强调色), 0.001);
    this.重绘视觉(配置.宽, 配置.高);
    this.标签 = scene.add
      .text(-配置.宽 / 2 + 14, 0, 配置.文案, {
        fontFamily: "sans-serif",
        fontSize: "14px",
        color: 配置.文字色,
        padding: { left: 4, right: 8, top: 8, bottom: 8 },
        wordWrap: { width: 配置.宽 - 46 },
      })
      .setOrigin(0, 0.5);
    this.箭头 = scene.add.graphics();
    this.更新箭头(配置.宽);
    this.add([this.视觉, this.面板, this.标签, this.箭头]);
    this.setInteractive({
      useHandCursor: true,
      hitArea: this.创建矩形命中区域(配置.宽, 配置.高),
      hitAreaCallback: Phaser.Geom.Rectangle.Contains,
    });
    绑定按钮手势(this, { 点击: this.切换展开 });
    scene.add.existing(this);
  }

  setValue(值: string): this {
    this.当前值 = 值;
    this.标签.setText(this.配置.选项.find((选项) => 选项.值 === 值)?.文案 ?? 值);
    return this;
  }

  protected 布局尺寸变化(宽: number, 高: number): void {
    this.面板.setSize(宽, 高);
    this.重绘视觉(宽, 高);
    this.标签.setPosition(-宽 / 2 + 14, 0).setWordWrapWidth(Math.max(0, 宽 - 46));
    this.更新箭头(宽);
    this.更新矩形命中区域(宽, 高);
    if (this.展开中) this.更新选项位置();
  }

  private 更新箭头(宽: number): void {
    this.箭头.clear().setPosition(宽 / 2 - 24, 0);
    this.箭头.lineStyle(1.8, this.颜色值(this.配置.强调色), 0.95);
    const 顶点Y = this.展开中 ? -2 : 2;
    const 外侧Y = -顶点Y;
    this.箭头.lineBetween(-4, 外侧Y, 0, 顶点Y);
    this.箭头.lineBetween(0, 顶点Y, 4, 外侧Y);
  }

  private 重绘视觉(宽: number, 高: number): void {
    this.视觉.clear();
    绘制玻璃面板(this.视觉, -宽 / 2, -高 / 2, 宽, 高, {
      圆角: 10,
      填色: this.颜色值(this.配置.面板色),
      透明度: 0.94,
      投影: false,
      高光: false,
      边色: this.颜色值(this.配置.强调色),
      边透明度: 0.6,
    });
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
    this.更新箭头(this.width);
    this.setDepth(1000);
    this.面板.setVisible(false);
    this.视觉.setVisible(false);
    const 每项高 = this.配置.选项高 ?? 36;
    const 外观 = this.配置;
    const 其他选项 = this.配置.选项.filter((选项) => 选项.值 !== this.当前值);
    this.选项布局 = new 界面布局(this.scene, 0, 0, {
      方向: "垂直",
      宽: this.width - 4,
      高: 每项高 * 其他选项.length,
      间距: 0,
      主轴对齐: "起始",
    });
    this.展开底板 = this.scene.add.graphics();
    const 菜单高 = this.选项布局.height + this.height + 14;
    绘制玻璃面板(
      this.展开底板,
      -(this.width + 12) / 2,
      -菜单高 / 2,
      this.width + 12,
      菜单高,
      {
        圆角: 10,
        填色: this.颜色值(外观.面板色),
        透明度: 1,
        投影: false,
        高光: false,
        边色: this.颜色值(外观.强调色),
        边透明度: 0.85,
      },
    );
    const 方向 = this.配置.展开方向 === "下" ? 1 : -1;
    const 菜单中心Y = (方向 * (this.选项布局.height + 2)) / 2;
    const 当前行分隔Y = (方向 * this.height) / 2 - 菜单中心Y;
    this.展开底板.lineStyle(1, this.颜色值(外观.强调色), 0.34);
    this.展开底板.lineBetween(
      -this.width / 2 + 10,
      当前行分隔Y,
      this.width / 2 - 10,
      当前行分隔Y,
    );
    const 选项首行Y =
      方向 < 0 ? -this.height / 2 - 2 - this.选项布局.height : this.height / 2 + 2;
    for (let 索引 = 1; 索引 < 其他选项.length; 索引 += 1) {
      const 世界Y = 选项首行Y + 索引 * 每项高;
      this.展开底板.lineBetween(
        -this.width / 2 + 10,
        世界Y - 菜单中心Y,
        this.width / 2 - 10,
        世界Y - 菜单中心Y,
      );
    }
    this.展开底板.setPosition(0, 菜单中心Y);
    this.addAt(this.展开底板, 0);
    for (const 选项 of 其他选项) {
      const 按钮宽 = this.width - 4;
      const 按钮 = new 界面按钮(this.scene, 0, 0, {
        宽: 按钮宽,
        高: 每项高,
        文案: 选项.文案,
        name: 选项.name,
        面板色: 外观.面板色,
        强调色: 外观.强调色,
        文字色: 外观.文字色,
        点击: () => {
          this.收起();
          this.setValue(选项.值);
          this.配置.选择(选项.值);
        },
        字号: "14px",
        样式: "文字",
        自适应文案: false,
      });
      this.选项布局.添加(
        按钮,
        { 宽: 按钮宽, 高: 每项高 },
      );
    }
    this.add(this.选项布局);
    this.更新选项位置();
  }

  private 收起(): void {
    this.展开中 = false;
    this.更新箭头(this.width);
    this.面板.setVisible(true);
    this.视觉.setVisible(true);
    this.setDepth(this.初始层级);
    if (this.选项布局) this.remove(this.选项布局, true);
    this.选项布局 = undefined;
    if (this.展开底板) this.remove(this.展开底板, true);
    this.展开底板 = undefined;
  }

  private 更新选项位置(): void {
    if (!this.选项布局) return;
    const 方向 = this.配置.展开方向 === "下" ? 1 : -1;
    const 选项中心Y = 方向 * (this.height / 2 + this.选项布局.height / 2 + 2);
    this.选项布局.setPosition(0, 选项中心Y);
    const 菜单中心Y = 方向 * (this.选项布局.height + 2) / 2;
    this.展开底板?.setPosition(0, 菜单中心Y);
  }

  private 颜色值(颜色: string): number {
    return Number.parseInt(颜色.replace("#", ""), 16);
  }
}
