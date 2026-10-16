import Phaser from "phaser";
import type { 俄罗斯方块状态, 方块类型 } from "../玩法/俄罗斯方块";
import { 游戏外观 } from "../配置/游戏外观";

export class 落块特效 extends Phaser.GameObjects.Graphics {
  private 格 = 24;
  private 拖尾?: { 格子: [number, number][]; 距离: number; 色: number; 时间: number };
  private 锁闪?: { 格子: [number, number][]; 时间: number };
  constructor(scene: Phaser.Scene) {
    super(scene);
    this.setName("board.lock-drop-effects");
    this.setBlendMode(Phaser.BlendModes.ADD);
    scene.add.existing(this);
  }
  设置格子(格: number) {
    this.格 = 格;
  }
  硬降(格子: [number, number][], 距离: number, 类型: 方块类型) {
    if (距离 > 0) this.拖尾 = { 格子, 距离, 色: 游戏外观.方块.颜色[类型], 时间: 0 };
    this.更新(0);
  }
  锁定(事件: NonNullable<俄罗斯方块状态["落块事件"]>) {
    this.锁闪 = { 格子: 事件.格子.filter(([, 行]) => 行 >= 0), 时间: 0 };
    this.更新(0);
  }
  更新(dt: number) {
    if (!this.拖尾 && !this.锁闪) return;
    this.clear();
    const 格 = this.格;
    if (this.拖尾) {
      const e = this.拖尾;
      e.时间 += dt;
      if (e.时间 >= 240) this.拖尾 = undefined;
      else {
        const 进度 = e.时间 / 240;
        // 同列合并，尾部渐细渐淡，并向落点收拢。
        for (const 列 of new Set(e.格子.map(([列]) => 列))) {
          const 原底 = Math.max(...e.格子.filter(([x]) => x === 列).map(([, y]) => y + 1));
          const 底 = Math.min(20, 原底 + e.距离) * 格;
          const 长 = Math.min(10, e.距离) * 格 * (1 - 进度 * 进度);
          const 顶 = Math.max(0, 底 - 长);
          for (let i = 0; i < 40; i++) {
            const t = (i + 0.5) / 40;
            const y = 顶 + ((底 - 顶) * i) / 40;
            const 高 = (底 - 顶) / 40 + 0.5;
            const 宽 = 格 * (0.06 + 0.66 * t);
            const 淡 = t * t * (1 - 进度) ** 2;
            this.fillStyle(e.色, 淡 * 0.22).fillRect((列 + 0.5) * 格 - 宽 / 2, y, 宽, 高);
            this.fillStyle(0xffffff, 淡 * 0.2).fillRect(
              (列 + 0.5) * 格 - 宽 * 0.12,
              y,
              宽 * 0.24,
              高,
            );
          }
        }
      }
    }
    if (this.锁闪) {
      const e = this.锁闪;
      e.时间 += dt;
      if (e.时间 >= 150) this.锁闪 = undefined;
      else
        for (const [列, 行] of e.格子)
          this.fillStyle(0xffffff, 0.65 * (1 - e.时间 / 150)).fillRoundedRect(
            列 * 格 + 2,
            行 * 格 + 2,
            格 - 4,
            格 - 4,
            格 * 0.12,
          );
    }
  }
  清空() {
    this.拖尾 = undefined;
    this.锁闪 = undefined;
    this.clear();
  }
  快照() {
    return { 硬降拖尾: Boolean(this.拖尾), 锁定闪光: Boolean(this.锁闪) };
  }
}
