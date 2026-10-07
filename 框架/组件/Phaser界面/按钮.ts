import Phaser from "phaser";
import { 绑定按钮手势, 界面控件 } from "./控件";
import { 绘制玻璃按钮 } from "./玻璃绘制";
import { Phaser预制体配置 } from "./预制体配置";

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
  移入?: (指针: Phaser.Input.Pointer) => void;
  移出?: (指针: Phaser.Input.Pointer) => void;
  按下?: () => void;
  松开?: () => void;
  取消?: () => void;
  按住?: (指针: Phaser.Input.Pointer, 帧间隔: number) => void;
  字体?: string;
  面板透明度?: number;
  边框透明度?: number;
  边框色?: string;
  文字色跟随底色?: boolean;
}

/** 由 Phaser 容器、图形和文本组成的通用可交互按钮。 */
export class 界面按钮 extends 界面控件 {
  private readonly 底板: Phaser.GameObjects.Rectangle;
  private readonly 视觉: Phaser.GameObjects.Graphics;
  private readonly 标签: Phaser.GameObjects.Text;
  private 已选: boolean;
  private readonly 样式: "面板" | "文字";
  private readonly 面板色: string;
  private readonly 强调色: string;
  private readonly 自适应文案: boolean;
  private readonly 面板透明度: number;
  private readonly 边框透明度: number;
  private readonly 边框色?: string;
  private readonly 文字色跟随底色: boolean;
  private 悬停 = false;
  private 当前宽: number;
  private 当前高: number;

  constructor(scene: Phaser.Scene, x: number, y: number, 配置: 按钮配置) {
    super(scene, x, y, 配置.宽, 配置.高);
    this.name = 配置.name;
    this.已选 = 配置.已选 ?? false;
    this.样式 = 配置.样式 ?? "面板";
    this.面板色 = 配置.面板色;
    this.强调色 = 配置.强调色;
    this.面板透明度 = 配置.面板透明度 ?? Phaser预制体配置.按钮.面板透明度;
    this.边框透明度 = 配置.边框透明度 ?? Phaser预制体配置.按钮.边框透明度;
    this.边框色 = 配置.边框色;
    this.文字色跟随底色 = 配置.文字色跟随底色 ?? false;
    this.自适应文案 = this.样式 === "文字" && 配置.自适应文案 !== false;
    this.当前宽 = 配置.宽;
    this.当前高 = 配置.高;
    const 文字按钮 = this.样式 === "文字";
    // 底板只承担命中区域，视觉交给图形层绘制
    this.底板 = scene.add
      .rectangle(0, 0, 配置.宽, 配置.高, 0x000000, 0.001)
      .setInteractive({ useHandCursor: true })
      .setName(配置.name);
    this.视觉 = scene.add.graphics();
    // 按钮文字禁止使用文字阴影，避免字形边缘发虚。
    this.标签 = scene.add
      .text(0, 0, 配置.文案, {
        fontFamily: 配置.字体 ?? Phaser预制体配置.字体,
        fontSize: 配置.字号 ?? `${Phaser预制体配置.按钮.最小字号 + 3}px`,
        color: this.文字色跟随底色 ? this.获取适配文字色() : 配置.文字色,
        align: "center",
        padding: 文字按钮 ? { left: 18, right: 18, top: 10, bottom: 10 } : undefined,
        wordWrap: 文字按钮 ? undefined : { width: Math.max(0, 配置.宽 - 16) },
      })
      .setOrigin(0.5);
    this.add([this.视觉, this.底板, this.标签]);
    if (this.自适应文案) this.按文案调整尺寸();
    this.重绘视觉();
    绑定按钮手势(this.底板, {
      移入: (指针) => {
        this.悬停 = true;
        this.重绘视觉();
        if (文字按钮) this.setScale(1.06);
        配置.移入?.(指针);
      },
      移出: (指针) => {
        this.悬停 = false;
        this.重绘视觉();
        if (文字按钮) this.setScale(1);
        配置.移出?.(指针);
      },
      按下: () => 配置.按下?.(),
      取消: () => {
        配置.取消?.();
        配置.松开?.();
      },
      按住: 配置.按住,
      点击: () => {
        配置.点击();
        配置.松开?.();
      },
    });
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
    if (this.文字色跟随底色) this.标签.setColor(this.获取适配文字色());
    this.重绘视觉();
    return this;
  }

  protected 布局尺寸变化(宽: number, 高: number): void {
    this.当前宽 = 宽;
    this.当前高 = 高;
    this.底板.setSize(宽, 高);
    this.标签.setWordWrapWidth(this.样式 === "文字" ? 0 : Math.max(0, 宽 - 16));
    if (this.底板.input) this.底板.input.hitArea = new Phaser.Geom.Rectangle(0, 0, 宽, 高);
    this.重绘视觉();
  }

  private 重绘视觉(): void {
    this.视觉.clear();
    const 文字按钮 = this.样式 === "文字";
    if (文字按钮) {
      // 文字按钮：仅悬停时浮出玻璃底衬
      if (this.悬停) {
        绘制玻璃按钮(this.视觉, 0, 0, this.当前宽, this.当前高, {
          填色: 0x22314e,
          强调色: this.颜色值(this.强调色),
          透明度: 0.5,
          悬停: true,
        });
      }
      return;
    }
    绘制玻璃按钮(this.视觉, 0, 0, this.当前宽, this.当前高, {
      填色: this.颜色值(this.面板色),
      强调色: this.颜色值(this.强调色),
      选中: this.已选,
      悬停: this.悬停,
      透明度: this.已选 ? 0.98 : this.悬停 ? 0.97 : this.面板透明度,
      边透明度: this.边框透明度,
      边框色: this.边框色 ? this.颜色值(this.边框色) : undefined,
    });
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

  private 获取适配文字色(): string {
    const 背景色 = this.已选 ? this.强调色 : this.面板色;
    const 色值 = this.颜色值(背景色);
    const 通道 = [16, 8, 0].map((位移) => {
      const sRGB = ((色值 >> 位移) & 0xff) / 255;
      return sRGB <= 0.04045 ? sRGB / 12.92 : ((sRGB + 0.055) / 1.055) ** 2.4;
    });
    const 亮度 = 0.2126 * (通道[0] ?? 0) + 0.7152 * (通道[1] ?? 0) + 0.0722 * (通道[2] ?? 0);
    const 深色对比 = (亮度 + 0.05) / 0.05;
    const 浅色对比 = 1.05 / (亮度 + 0.05);
    return 浅色对比 >= 深色对比 ? "#fff8e7" : "#241d12";
  }
}
