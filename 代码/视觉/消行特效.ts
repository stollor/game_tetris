import Phaser from "phaser";
import type { 俄罗斯方块状态 } from "../玩法/俄罗斯方块";
import { 游戏外观 } from "../配置/游戏外观";

import { 界面主题, 颜色值 } from "../配置/界面主题";

/** 参考初版的逐行白闪、横向光条与彩色碎片；坐标以格为单位，随棋盘缩放。 */
export class 消行特效 extends Phaser.GameObjects.Graphics {
  private 格子 = 24;
  private 时间 = 1000;
  private 时长 = 650;
  private 行: number[] = [];
  private 碎片: { x: number; y: number; vx: number; vy: number; 角: number; 色: number }[] = [];
  constructor(scene: Phaser.Scene) {
    super(scene);
    this.setName("board.clear-effects");
    scene.add.existing(this);
  }
  设置格子(格子: number): void {
    this.格子 = 格子;
  }
  播放(事件: NonNullable<俄罗斯方块状态["消行事件"]>): void {
    this.时间 = 0;
    this.行 = 事件.行.filter((行) => 行 >= 0 && 行 < 20);
    this.时长 = this.行.length === 4 ? 900 : 650;
    this.碎片 = 事件.格子
      .filter(([, 行]) => 行 >= 0)
      .flatMap(([列, 行, 类型]) =>
        Array.from({ length: this.行.length === 4 ? 3 : 2 }, () => ({
          x: 列 + 0.5,
          y: 行 + 0.5,
          vx: (Math.random() - 0.5) * 5,
          vy: -1.5 - Math.random() * 3,
          角: Math.random() * Math.PI,
          色: 游戏外观.方块.颜色[类型],
        })),
      )
      .slice(0, 120);
    this.更新(0);
  }
  更新(毫秒: number): void {
    if (this.时间 > this.时长) return;
    this.时间 += 毫秒;
    this.clear();
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
      this.fillStyle(强调, 淡 * 0.3).fillRect(0, (行 - 0.18) * 格, 10 * 格, 1.36 * 格);
      if (t < 90) this.fillStyle(0xffffff, (1 - t / 90) * 0.85).fillRect(0, 行 * 格, 10 * 格, 格);
      const 光宽 = 10 * 格 * Math.min(1, t / 140);
      this.fillStyle(强调, 淡 * 0.9).fillRect(
        5 * 格 - 光宽 / 2,
        (行 + 0.48) * 格,
        光宽,
        Math.max(2, 格 * 0.09),
      );
    });
    const 秒 = this.时间 / 1000;
    for (const p of this.碎片) {
      const x = (p.x + p.vx * 秒) * 格;
      const y = (p.y + p.vy * 秒 + 4 * 秒 * 秒) * 格;
      // 只在棋盘范围显示，碎片不会覆盖侧栏、操作按钮或结算。
      if (x < 2 || x > 10 * 格 - 2 || y < 2 || y > 20 * 格 - 2) continue;
      const 半径 = Math.min(格 * 0.17, x, 10 * 格 - x, y, 20 * 格 - y);
      const 角 = p.角 + 秒 * 7;
      this.fillStyle(p.色, (1 - this.时间 / this.时长) * 0.95);
      this.fillTriangle(
        x + Math.cos(角) * 半径,
        y + Math.sin(角) * 半径,
        x + Math.cos(角 + 2.2) * 半径,
        y + Math.sin(角 + 2.2) * 半径,
        x + Math.cos(角 + 4.4) * 半径,
        y + Math.sin(角 + 4.4) * 半径,
      );
    }
    if (this.行.length === 4) {
      const 淡 = 1 - this.时间 / this.时长;
      // 四行独有的金色脉冲、向上扫光和双层边框，普通消行不使用。
      if (this.时间 < 200)
        this.fillStyle(0xffe6a0, (1 - this.时间 / 200) * 0.18).fillRect(0, 0, 10 * 格, 20 * 格);
      const 扫Y = Math.max(0, Math.min(...this.行) * 格 * (1 - this.时间 / 600));
      if (this.时间 < 600) {
        this.fillGradientStyle(
          0xffdb70,
          0xffdb70,
          0xffffff,
          0xffffff,
          0,
          0,
          淡 * 0.22,
          淡 * 0.22,
        ).fillRect(0, Math.max(0, 扫Y - 格 * 1.5), 10 * 格, Math.min(格 * 1.5, 扫Y));
        this.lineStyle(Math.max(2, 格 * 0.12), 0xffedb5, 淡 * 0.7).lineBetween(
          0,
          扫Y,
          10 * 格,
          扫Y,
        );
      }
      this.lineStyle(Math.max(2, 格 * 0.12), 0xffdb70, 淡 * 0.85).strokeRoundedRect(
        1,
        1,
        10 * 格 - 2,
        20 * 格 - 2,
        格 * 0.25,
      );
      this.lineStyle(1, 0xffffff, 淡 * 0.6).strokeRoundedRect(
        4,
        4,
        10 * 格 - 8,
        20 * 格 - 8,
        格 * 0.2,
      );
    }
  }
  清空(): void {
    this.时间 = 1000;
    this.行 = [];
    this.碎片 = [];
    this.clear();
  }
  快照() {
    return {
      活跃: this.时间 <= this.时长,
      四行庆祝: this.行.length === 4,
      行: [...this.行],
      碎片数: this.碎片.length,
      时间: this.时间,
    };
  }
}
