import Phaser from "phaser";
import { 读取霓虹调色板 } from "../../组件/霓虹街机/调色板";
import { type 俄罗斯方块状态, 创建新局, 旋转方块, 硬降, 移动方块 } from "../玩法/俄罗斯方块";
import { 绘制方块单元预制体 } from "../界面/方块单元";
import { 游戏外观 } from "../配置/游戏外观";
import { 出生格 } from "../预制体/下一个方块栏";

export interface 菜单演示选项 {
  显示预告?: boolean;
  落地?: (消行: number) => void;
}

/** 实际七袋和消行规则驱动自动对局，启发式挑选低堆叠落点，不播放固定录像。 */
export class 菜单演示 extends Phaser.GameObjects.Graphics {
  private 状态 = 创建新局();
  private 计划?: 俄罗斯方块状态;
  private 落点: [number, number][] = [];
  private 时间 = 0;
  private 时长 = 1000;
  private 落块次数 = 0;
  private 累计消行 = 0;
  private 停留 = 0;
  constructor(
    scene: Phaser.Scene,
    private readonly 选项: 菜单演示选项 = {},
  ) {
    super(scene);
    scene.add.existing(this);
    this.选落点();
    this.更新(0);
  }
  private 选落点(): void {
    let 最佳 = -Infinity;
    for (let 朝向 = 0; 朝向 < 4; 朝向++)
      for (let 位移 = -5; 位移 <= 5; 位移++) {
        const s = structuredClone(this.状态);
        for (let i = 0; i < 朝向; i++) 旋转方块(s, 1);
        let 可以 = true;
        for (let i = 0; i < Math.abs(位移); i++) if (!移动方块(s, Math.sign(位移), 0)) 可以 = false;
        if (!可以) continue;
        硬降(s);
        if (s.阶段 === "结束") continue;
        const 高度: number[] = [];
        let 空洞 = 0;
        for (let x = 0; x < 10; x++) {
          let 首 = -1;
          for (let y = 0; y < s.棋盘.length; y++) {
            if (s.棋盘[y]?.[x] && 首 < 0) 首 = y;
            if (!s.棋盘[y]?.[x] && 首 >= 0) 空洞++;
          }
          高度.push(首 < 0 ? 0 : s.棋盘.length - 首);
        }
        const 起伏 = 高度.slice(1).reduce((n, h, i) => n + Math.abs(h - (高度[i] ?? 0)), 0);
        const 分 =
          (s.消行数 - this.状态.消行数) * 50 -
          高度.reduce((a, b) => a + b, 0) * 1.5 -
          空洞 * 25 -
          起伏 * 2 -
          Math.max(...高度) * 4 +
          Math.random();
        if (分 > 最佳) {
          最佳 = 分;
          this.计划 = s;
          this.落点 = s.落块事件?.格子 ?? [];
        }
      }
    if (!this.计划) {
      this.状态 = 创建新局();
      this.选落点();
      return;
    }
    this.时间 = 0;
    this.时长 = 850 + Math.random() * 450;
  }
  更新(dt: number): void {
    this.时间 += Math.min(dt, 100);
    if (this.停留 > 0) {
      this.停留 -= Math.min(dt, 100);
      if (this.停留 <= 0) {
        this.计划 = undefined;
        this.选落点();
      }
    } else if (this.时间 >= this.时长 && this.计划) {
      const 消行 = this.计划.消行数 - this.状态.消行数;
      this.累计消行 += 消行;
      this.状态 = this.计划;
      this.落块次数++;
      this.停留 = this.状态.落块事件?.行数 ? 360 : 160;
      this.选项.落地?.(消行);
    }
    this.clear();
    const 格 = 14,
      左 = -70,
      顶 = -146;
    const t = 读取霓虹调色板();
    this.fillStyle(t.棋盘底, 0.22).fillRoundedRect(左 - 5, 顶 - 5, 150, 122, 8);
    this.lineStyle(1, t.棋盘描边, 0.35).strokeRoundedRect(左 - 5, 顶 - 5, 150, 122, 8);
    for (let y = 0; y < 8; y++)
      for (let x = 0; x < 10; x++) {
        const 类 = this.状态.棋盘[y + 14]?.[x];
        if (类)
          绘制方块单元预制体(this, 左 + x * 格, 顶 + y * 格, {
            色值: 游戏外观.方块.颜色[类],
            格子: 格,
            透明度: 0.85,
          });
      }
    if (this.停留 <= 0) {
      const 进度 = Math.min(1, this.时间 / this.时长);
      const 最低 = Math.max(...this.落点.map(([, y]) => y));
      const 降 = (最低 - 12) * (1 - 进度 ** 1.5);
      for (const [x, y] of this.落点) {
        const 行 = y - 12 - 降;
        if (行 < 0 || 行 >= 8) continue;
        绘制方块单元预制体(this, 左 + x * 格, 顶 + 行 * 格, {
          色值: 游戏外观.方块.颜色[this.状态.当前方块.类型],
          格子: 格,
        });
      }
    } else if (this.状态.落块事件?.行数) {
      this.fillStyle(t.强调, (this.停留 / 360) * 0.22).fillRoundedRect(左, 顶, 140, 112, 5);
      for (const 行 of this.状态.消行事件?.行 ?? [])
        if (行 >= 12)
          this.fillStyle(0xffffff, (this.停留 / 360) * 0.7).fillRect(
            左,
            顶 + (行 - 12) * 格,
            140,
            格,
          );
    }
    if (this.选项.显示预告)
      [this.状态.下一个方块, this.状态.后续方块[0]].forEach((类, i) => {
        if (!类) return;
        const 点 = 出生格[类];
        const 中X = (Math.min(...点.map(([x]) => x)) + Math.max(...点.map(([x]) => x)) + 1) / 2;
        for (const [x, y] of 点)
          绘制方块单元预制体(
            this,
            (i ? 140 : -140) + (x - 中X) * 20,
            -104 + y * 20 + Math.sin(this.时间 / 650 + i) * 4,
            { 色值: 游戏外观.方块.颜色[类], 格子: 20 },
          );
      });
  }
  快照() {
    return {
      落块次数: this.落块次数,
      累计消行: this.累计消行,
      方块: this.状态.当前方块.类型,
      预告: [this.状态.下一个方块, this.状态.后续方块[0]],
    };
  }
}
