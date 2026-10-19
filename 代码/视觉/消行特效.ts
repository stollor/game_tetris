import Phaser from "phaser";
import { 设为动态层 } from "../性能/图形烘焙";
import type { 再消一行状态 } from "../玩法/再消一行";
import { 界面主题, 颜色值 } from "../配置/界面主题";

/** 消行只画每行一条光带，最多四行。不再为每个格子生成碎片精灵。 */
export class 消行特效 extends Phaser.GameObjects.Container {
  private 格子 = 24;
  private 时间 = 1000;
  private 时长 = 650;
  private 行: number[] = [];
  private readonly 背景: Phaser.GameObjects.Graphics;
  private readonly 前景: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene) {
    super(scene);
    this.setName("board.clear-effects");
    this.背景 = scene.add.graphics();
    this.前景 = scene.add.graphics();
    设为动态层(this.背景);
    设为动态层(this.前景);
    this.add([this.背景, this.前景]);
    scene.add.existing(this);
  }

  设置格子(格子: number): void {
    this.格子 = 格子;
  }

  播放(事件: NonNullable<再消一行状态["消行事件"]>): void {
    this.时间 = 0;
    this.行 = 事件.行.filter((行) => 行 >= 0 && 行 < 20).slice(0, 4);
    this.时长 = this.行.length === 4 ? 900 : 650;
    this.更新(0);
  }

  更新(毫秒: number): void {
    if (this.时间 > this.时长) return;
    this.时间 += 毫秒;
    this.背景.clear();
    this.前景.clear();
    if (this.时间 > this.时长) {
      this.清空();
      return;
    }
    const 格 = this.格子;
    const 强调 = 颜色值(界面主题().文字.强调);
    this.行.forEach((行, i) => {
      const t = this.时间 - i * 40;
      if (t < 0 || t > 320) return;
      const 淡 = 1 - t / 320;
      this.背景.fillStyle(强调, 淡 * 0.3).fillRect(0, (行 - 0.18) * 格, 10 * 格, 1.36 * 格);
      if (t < 90)
        this.背景.fillStyle(0xffffff, (1 - t / 90) * 0.85).fillRect(0, 行 * 格, 10 * 格, 格);
      const 光宽 = 10 * 格 * Math.min(1, t / 140);
      this.背景
        .fillStyle(强调, 淡 * 0.9)
        .fillRect(5 * 格 - 光宽 / 2, (行 + 0.48) * 格, 光宽, Math.max(2, 格 * 0.09));
    });
    if (this.行.length === 4) this.绘制四行(格);
  }

  清空(): void {
    this.时间 = 1000;
    this.行 = [];
    this.背景.clear();
    this.前景.clear();
  }

  快照() {
    return {
      活跃: this.时间 <= this.时长,
      四行庆祝: this.行.length === 4,
      行: [...this.行],
      碎片数: 0,
      时间: this.时间,
    };
  }

  private 绘制四行(格: number): void {
    const 淡 = 1 - this.时间 / this.时长;
    if (this.时间 < 200)
      this.前景.fillStyle(0xffe6a0, (1 - this.时间 / 200) * 0.18).fillRect(0, 0, 10 * 格, 20 * 格);
    const 扫Y = Math.max(0, Math.min(...this.行) * 格 * (1 - this.时间 / 600));
    if (this.时间 < 600) {
      this.前景
        .fillGradientStyle(0xffdb70, 0xffdb70, 0xffffff, 0xffffff, 0, 0, 淡 * 0.22, 淡 * 0.22)
        .fillRect(0, Math.max(0, 扫Y - 格 * 1.5), 10 * 格, Math.min(格 * 1.5, 扫Y));
      this.前景
        .lineStyle(Math.max(2, 格 * 0.12), 0xffedb5, 淡 * 0.7)
        .lineBetween(0, 扫Y, 10 * 格, 扫Y);
    }
    this.前景
      .lineStyle(Math.max(2, 格 * 0.12), 0xffdb70, 淡 * 0.85)
      .strokeRoundedRect(1, 1, 10 * 格 - 2, 20 * 格 - 2, 格 * 0.25);
    this.前景
      .lineStyle(1, 0xffffff, 淡 * 0.6)
      .strokeRoundedRect(4, 4, 10 * 格 - 8, 20 * 格 - 8, 格 * 0.2);
  }
}
