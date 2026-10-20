import Phaser from "phaser";
import { 设为动态层 } from "../性能/图形烘焙";
import type { 再消一行状态 } from "../玩法/再消一行";
import { 界面主题, 颜色值 } from "../配置/界面主题";
import { 绘制四行庆祝, 绘制消行光带 } from "./特效配方";

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
    绘制消行光带(this.背景, {
      行: this.行,
      时间毫秒: this.时间,
      格: this.格子,
      强调色: 颜色值(界面主题().文字.强调),
    });
    if (this.行.length === 4)
      绘制四行庆祝(this.前景, {
        时间毫秒: this.时间,
        时长毫秒: this.时长,
        格: this.格子,
        扫过起点: Math.max(0, Math.min(...this.行) * this.格子 * (1 - this.时间 / 600)),
      });
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
}
