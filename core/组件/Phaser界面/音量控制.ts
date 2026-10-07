import Phaser from "phaser";
import { 界面控件 } from "./控件";
import { 界面滑块 } from "./滑块";

export interface 音量控制配置 {
  宽: number;
  高: number;
  名称: string;
  标签: string;
  音量: number;
  开启: boolean;
  面板色: string;
  边框色: string;
  轨道色: string;
  强调色: string;
  文字色: string;
  次要文字色: string;
  音量变化: (音量: number, 提交: boolean) => void;
  开关切换: (开启: boolean) => void;
}

/** 设置页的音量控制行：类型标签、可静音扬声器和可拖动音量滑块。 */
export class 界面音量控制 extends 界面控件 {
  private readonly 图标按钮: Phaser.GameObjects.Container;
  private readonly 图标: Phaser.GameObjects.Graphics;
  private readonly 滑块: 界面滑块;
  private readonly 配置: 音量控制配置;
  private 音量: number;
  private 开启: boolean;
  private 恢复音量: number;

  constructor(scene: Phaser.Scene, x: number, y: number, 配置: 音量控制配置) {
    super(scene, x, y, 配置.宽, 配置.高);
    this.name = 配置.名称;
    this.配置 = 配置;
    this.音量 = Phaser.Math.Clamp(配置.音量, 0, 100);
    this.开启 = 配置.开启 && this.音量 > 0;
    this.恢复音量 = this.音量 > 0 ? this.音量 : 60;

    const 底板 = scene.add
      .rectangle(0, 0, 配置.宽, 配置.高, this.颜色值(配置.面板色), 0.96)
      .setStrokeStyle(1, this.颜色值(配置.边框色), 0.9);
    const 标题 = scene.add
      .text(-配置.宽 / 2 + 18, 0, 配置.标签, {
        fontFamily: '"Segoe UI", "Microsoft YaHei", sans-serif',
        fontSize: "14px",
        fontStyle: "bold",
        color: 配置.文字色,
      })
      .setOrigin(0, 0.5);
    const 轨道起点 = -配置.宽 / 2 + Math.min(126, 配置.宽 * 0.36);
    this.图标 = scene.add.graphics();
    this.图标按钮 = scene.add.container(轨道起点, 0, [this.图标]);
    this.图标按钮
      .setSize(36, 42)
      .setInteractive({
        useHandCursor: true,
        hitArea: this.创建矩形命中区域(36, 42),
        hitAreaCallback: Phaser.Geom.Rectangle.Contains,
      })
      .setName(`${配置.名称}.mute`)
      .on("pointerdown", this.切换静音);
    const 滑块宽 = Math.max(72, 配置.宽 - (轨道起点 + 配置.宽 / 2) - 66);
    this.滑块 = new 界面滑块(scene, 轨道起点 + 36 + 滑块宽 / 2, 0, {
      宽: 滑块宽,
      命中高: 42,
      值: this.音量,
      name: `${配置.名称}.volume`,
      轨道色: 配置.轨道色,
      强调色: 配置.强调色,
      变化: () => undefined,
    });
    this.滑块.on("change", (值: number) => this.预览音量(值));
    this.滑块.on("commit", (值: number) => this.提交音量(值));
    this.add([底板, 标题, this.图标按钮, this.滑块]);
    this.绘制图标();
    scene.add.existing(this);
  }

  protected 布局尺寸变化(宽: number, 高: number): void {
    this.更新矩形命中区域(宽, 高);
  }

  private 切换静音 = (): void => {
    if (this.音量 > 0 && this.开启) {
      this.恢复音量 = this.音量;
      this.音量 = 0;
      this.开启 = false;
    } else {
      this.音量 = this.恢复音量 || 60;
      this.开启 = true;
    }
    this.滑块.setValue(this.音量);
    this.绘制图标();
    this.配置.开关切换(this.开启);
    this.配置.音量变化(this.音量, true);
  };

  private 预览音量(值: number): void {
    this.音量 = 值;
    if (值 > 0) {
      this.恢复音量 = 值;
      this.开启 = true;
    } else {
      this.开启 = false;
    }
    this.绘制图标();
    this.配置.音量变化(值, false);
  }

  private 提交音量(值: number): void {
    if (值 === 0) this.开启 = false;
    else this.开启 = true;
    this.配置.音量变化(值, true);
  }

  private 绘制图标(): void {
    const 静音 = !this.开启 || this.音量 === 0;
    const 图形 = this.图标;
    图形.clear();
    const 色 = this.颜色值(静音 ? this.配置.次要文字色 : this.配置.强调色);
    图形
      .fillStyle(色, 1)
      .beginPath()
      .moveTo(-10, -4)
      .lineTo(-5, -4)
      .lineTo(2, -10)
      .lineTo(2, 10)
      .lineTo(-5, 4)
      .lineTo(-10, 4)
      .closePath()
      .fillPath();
    if (静音) {
      图形.lineStyle(2, 0xff7f9c, 1).lineBetween(-12, 12, 12, -12);
      return;
    }
    图形.lineStyle(2, 色, 0.95).beginPath().arc(0, 0, 8, -0.9, 0.9).strokePath();
    图形.lineStyle(2, 色, 0.72).beginPath().arc(0, 0, 13, -0.85, 0.85).strokePath();
  }

  private 颜色值(颜色: string): number {
    return Number.parseInt(颜色.replace("#", ""), 16);
  }
}
