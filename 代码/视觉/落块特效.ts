import Phaser from "phaser";
import type { 再消一行状态, 方块类型 } from "../玩法/再消一行";
import { 游戏外观 } from "../配置/游戏外观";
import { 创建图像池, type 图像池 } from "./图像池";

interface 拖尾列 {
  列: number;
  原底: number;
  底: number;
  初始高度: number;
}

interface 拖尾状态 {
  列: 拖尾列[];
  距离: number;
  色: number;
  时间: number;
}

interface 锁闪状态 {
  格子: [number, number][];
  时间: number;
}

const 拖尾图形数 = 4;
const 拖尾时长 = 240;
const 锁闪时长 = 150;
const 拖尾段数 = 40;

/**
 * 落块拖尾与锁闪。同色同格的拖尾烘焙成贴图后只改缩放和透明度；
 * 烘焙失败时退回 4 个常驻 Graphics。清空和销毁会归还贴图。
 */
export class 落块特效 extends Phaser.GameObjects.Container {
  private 格 = 24;
  private 拖尾?: 拖尾状态;
  private 锁闪?: 锁闪状态;
  private readonly 拖尾图形: Phaser.GameObjects.Graphics[] = [];
  private readonly 锁闪图形: Phaser.GameObjects.Graphics;
  private readonly 拖尾池: 图像池;
  private 贴图拖尾 = true;
  private 烘焙高度 = 1;

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0);
    this.setName("board.lock-drop-effects");
    this.锁闪图形 = scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD).setVisible(false);
    this.add(this.锁闪图形);
    this.拖尾池 = 创建图像池(scene, this, {
      混合: Phaser.BlendModes.ADD,
      低于: this.锁闪图形,
      空闲上限: 拖尾图形数,
    });
    this.once("destroy", () => this.拖尾池.销毁());
    scene.add.existing(this);
  }

  设置格子(格: number): void {
    if (格 === this.格) return;
    this.格 = 格;
    if (this.拖尾) {
      this.绘制拖尾();
      this.应用拖尾动画();
    }
    if (this.锁闪) {
      this.绘制锁闪();
      this.锁闪图形.setAlpha(1 - this.锁闪.时间 / 锁闪时长);
    }
  }

  硬降(格子: [number, number][], 距离: number, 类型: 方块类型): void {
    this.隐藏拖尾();
    if (距离 <= 0) return;

    // 方块最多跨4列，与复用的4个拖尾 Graphics 一一对应；分组只在硬降时执行。
    const 列底 = new Map<number, number>();
    for (const [列, 行] of 格子) {
      const 底 = 行 + 1;
      const 旧 = 列底.get(列);
      if (旧 === undefined || 底 > 旧) 列底.set(列, 底);
    }
    const 列: 拖尾列[] = [];
    for (const [列号, 原底] of 列底) {
      if (列.length >= 拖尾图形数) break;
      列.push({ 列: 列号, 原底, 底: 0, 初始高度: 0 });
    }
    if (!列.length) return;

    this.拖尾 = { 列, 距离, 色: 游戏外观.方块.颜色[类型], 时间: 0 };
    this.绘制拖尾();
    this.应用拖尾动画();
  }

  锁定(事件: NonNullable<再消一行状态["落块事件"]>): void {
    const 格子 = 事件.格子.filter(([, 行]) => 行 >= 0);
    if (!格子.length) {
      this.隐藏锁闪();
      return;
    }
    this.锁闪 = { 格子, 时间: 0 };
    this.绘制锁闪();
  }

  更新(dt: number): void {
    if (this.拖尾) {
      const e = this.拖尾;
      e.时间 += dt;
      if (e.时间 >= 拖尾时长) this.隐藏拖尾();
      else this.应用拖尾动画();
    }
    if (this.锁闪) {
      const e = this.锁闪;
      e.时间 += dt;
      if (e.时间 >= 锁闪时长) this.隐藏锁闪();
      else this.锁闪图形.setAlpha(1 - e.时间 / 锁闪时长);
    }
  }

  清空(): void {
    this.隐藏拖尾();
    this.隐藏锁闪();
  }

  快照() {
    return { 硬降拖尾: Boolean(this.拖尾), 锁定闪光: Boolean(this.锁闪) };
  }

  private 隐藏拖尾(): void {
    this.拖尾 = undefined;
    this.拖尾池.取消();
    for (const 图形 of this.拖尾图形) 图形.setVisible(false).setScale(1).setAlpha(1);
  }

  private 隐藏锁闪(): void {
    this.锁闪 = undefined;
    this.锁闪图形.setVisible(false).setAlpha(1);
  }

  /** 以落点底部为本地 y=0 向负 y 绘制，保留原40段彩色+白色配方。同色同格尺寸只烘焙一次。 */
  private 绘制拖尾(): void {
    const e = this.拖尾;
    if (!e) return;
    if (this.贴图拖尾 && this.绘制拖尾贴图()) return;
    this.贴图拖尾 = false;
    this.拖尾池.取消();
    this.绘制拖尾矢量();
  }

  private 绘制拖尾贴图(): boolean {
    const e = this.拖尾;
    if (!e) return false;
    const 格 = this.格;
    this.烘焙高度 = 10 * 格;
    this.拖尾池.开始();
    for (const 项 of e.列) {
      const 底 = Math.min(20, 项.原底 + e.距离) * 格;
      项.底 = 底;
      项.初始高度 = Math.min(底, Math.min(10, e.距离) * 格);
      const 色 = e.色;
      const 高度 = this.烘焙高度;
      const 成功 = this.拖尾池.放置(
        `拖尾.${色}.${格.toFixed(2)}`,
        (图) => this.画拖尾段(图, 格, 色, 高度),
        (项.列 + 0.5) * 格,
        底,
      );
      if (!成功) return false;
    }
    this.拖尾池.结束();
    return true;
  }

  private 绘制拖尾矢量(): void {
    const e = this.拖尾;
    if (!e) return;
    this.确保拖尾图形();
    const 格 = this.格;
    const 拖尾长 = Math.min(10, e.距离) * 格;
    for (let i = 0; i < this.拖尾图形.length; i++) {
      const 图形 = this.拖尾图形[i];
      const 项 = e.列[i];
      if (!项) {
        图形.setVisible(false);
        continue;
      }
      const 底 = Math.min(20, 项.原底 + e.距离) * 格;
      项.底 = 底;
      const 初始高度 = Math.min(底, 拖尾长);
      项.初始高度 = 初始高度;
      图形.clear();
      if (初始高度 <= 0) {
        图形.setVisible(false);
        continue;
      }
      图形.setPosition((项.列 + 0.5) * 格, 底);
      for (let 段 = 0; 段 < 拖尾段数; 段++) {
        // 段0在最靠近落点的一端；t 仍按原配方从顶部窄淡到底部宽亮。
        const t = 1 - (段 + 0.5) / 拖尾段数;
        const y = -(初始高度 * (段 + 1)) / 拖尾段数;
        const 高 = 初始高度 / 拖尾段数 + 0.5;
        const 宽 = 格 * (0.06 + 0.66 * t);
        const 淡 = t * t;
        图形.fillStyle(e.色, 淡 * 0.22).fillRect(-宽 / 2, y, 宽, 高);
        图形.fillStyle(0xffffff, 淡 * 0.2).fillRect(-宽 * 0.12, y, 宽 * 0.24, 高);
      }
      图形.setVisible(true).setScale(1, 1).setAlpha(1);
    }
  }

  private 画拖尾段(
    图形: Phaser.GameObjects.Graphics,
    格: number,
    色: number,
    初始高度: number,
  ): void {
    for (let 段 = 0; 段 < 拖尾段数; 段++) {
      const t = 1 - (段 + 0.5) / 拖尾段数;
      const y = -(初始高度 * (段 + 1)) / 拖尾段数;
      const 高 = 初始高度 / 拖尾段数 + 0.5;
      const 宽 = 格 * (0.06 + 0.66 * t);
      const 淡 = t * t;
      图形.fillStyle(色, 淡 * 0.22).fillRect(-宽 / 2, y, 宽, 高);
      图形.fillStyle(0xffffff, 淡 * 0.2).fillRect(-宽 * 0.12, y, 宽 * 0.24, 高);
    }
  }

  private 确保拖尾图形(): void {
    if (this.拖尾图形.length) return;
    for (let i = 0; i < 拖尾图形数; i++) {
      this.拖尾图形.push(
        this.scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD).setVisible(false),
      );
    }
    this.add(this.拖尾图形);
    this.bringToTop(this.锁闪图形);
  }

  private 应用拖尾动画(): void {
    const e = this.拖尾;
    if (!e) return;
    const 进度 = Math.min(1, e.时间 / 拖尾时长);
    const 高度比 = 1 - 进度 * 进度;
    const 透明 = (1 - 进度) ** 2;
    const 拖尾长 = Math.min(10, e.距离) * this.格;
    const 贴图 = this.拖尾池.图像();
    if (贴图.length >= e.列.length) {
      for (let i = 0; i < e.列.length; i++) {
        const 动画高度 = Math.min(e.列[i].底, 拖尾长 * 高度比);
        const 缩放 = this.烘焙高度 > 0 ? 动画高度 / this.烘焙高度 : 0;
        const 基准 = 贴图[i].scaleX;
        贴图[i].setScale(基准, 基准 * 缩放).setAlpha(透明);
      }
      return;
    }
    for (let i = 0; i < e.列.length; i++) {
      const 项 = e.列[i];
      const 动画高度 = Math.min(项.底, 拖尾长 * 高度比);
      const 缩放 = 项.初始高度 > 0 ? 动画高度 / 项.初始高度 : 0;
      this.拖尾图形[i]?.setScale(1, 缩放).setAlpha(透明);
    }
  }

  private 绘制锁闪(): void {
    const e = this.锁闪;
    if (!e) return;
    const 格 = this.格;
    const 图形 = this.锁闪图形;
    图形.clear().fillStyle(0xffffff, 0.65);
    for (const [列, 行] of e.格子) {
      图形.fillRoundedRect(列 * 格 + 2, 行 * 格 + 2, 格 - 4, 格 - 4, 格 * 0.12);
    }
    图形.setAlpha(1).setVisible(true);
  }
}
