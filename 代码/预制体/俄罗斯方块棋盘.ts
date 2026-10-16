import Phaser from "phaser";
import {
  type 俄罗斯方块状态,
  可以放置,
  可见高度,
  type 方块类型,
  棋盘宽度,
  type 活动方块,
  读取格子,
  隐藏高度,
} from "../玩法/俄罗斯方块";
import { 绘制方块单元预制体, 绘制方块辉光 } from "../界面/方块单元";
import { 消行特效 } from "../视觉/消行特效";
import { 落块特效 } from "../视觉/落块特效";
import { 游戏外观 } from "../配置/游戏外观";
import { 界面主题, 颜色值 } from "../配置/界面主题";

/** 游戏棋盘预制体：负责棋盘框体、已落方块、当前方块与投影。 */
export class 俄罗斯方块棋盘 extends Phaser.GameObjects.Container {
  private readonly 框体: Phaser.GameObjects.Graphics;
  private readonly 网格层: Phaser.GameObjects.Graphics;
  private readonly 辉光层: Phaser.GameObjects.Graphics;
  private readonly 格子图层: Phaser.GameObjects.Graphics;
  private 绘制签名 = "";
  private readonly 消除效果: 消行特效;
  private 上次消行事件 = 0;
  private 上次落块事件 = 0;
  private readonly 落块效果: 落块特效;
  private 原X = 0;
  private 原Y = 0;
  private 镜头原位 = { x: 0, y: 0 };
  private 震动剩余 = 0;
  private 震动强度 = 0;
  private 震动时长 = 0;
  private 格子大小 = 24;
  private 落点影透明度 = 100;

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0);
    this.框体 = scene.add.graphics();
    this.网格层 = scene.add.graphics();
    this.辉光层 = scene.add.graphics();
    this.辉光层.setBlendMode(Phaser.BlendModes.ADD);
    this.格子图层 = scene.add.graphics();
    this.add([this.框体, this.网格层, this.辉光层, this.格子图层]);
    this.消除效果 = new 消行特效(scene);
    this.落块效果 = new 落块特效(scene);
    this.add([this.落块效果, this.消除效果]);
    this.setDepth(1);
    scene.add.existing(this);
  }

  布局(左: number, 顶: number, 格子大小: number, 透明度: number, 显示网格 = true): this {
    this.镜头原位 = { x: this.scene.cameras.main.scrollX, y: this.scene.cameras.main.scrollY };
    this.原X = 左;
    this.原Y = 顶;
    this.setPosition(左, 顶);
    this.框体.clear();
    this.格子大小 = 格子大小;
    this.消除效果.设置格子(格子大小);
    this.落块效果.设置格子(格子大小);
    this.网格层.setVisible(显示网格);
    const 宽 = 棋盘宽度 * 格子大小;
    const 高 = 可见高度 * 格子大小;
    const 背景色 = 游戏外观.棋盘.背景色;
    const 边框色 = 游戏外观.棋盘.边框色;
    const 圆角 = Math.max(10, 格子大小 * 0.5);
    // 外侧柔影
    for (let 层 = 0; 层 < 3; 层 += 1) {
      this.框体
        .fillStyle(0x03060d, (0.2 - 层 * 0.055) * 透明度)
        .fillRoundedRect(
          -12 - 层 * 3,
          -8 + 层 * 6,
          宽 + 24 + 层 * 6,
          高 + 20 + 层 * 5,
          圆角 + 层 * 3,
        );
    }
    this.框体
      .fillStyle(背景色, 0.99)
      .fillRoundedRect(-10, -10, 宽 + 20, 高 + 20, 圆角)
      .lineStyle(1.2, 边框色, 0.95)
      .strokeRoundedRect(-10, -10, 宽 + 20, 高 + 20, 圆角);
    // 内部网格
    this.网格层.clear().lineStyle(1, 颜色值(界面主题().游戏区域.网格线), 0.5);
    for (let 列 = 1; 列 < 棋盘宽度; 列 += 1) {
      this.网格层.lineBetween(列 * 格子大小, 0, 列 * 格子大小, 高);
    }
    for (let 行 = 1; 行 < 可见高度; 行 += 1) {
      this.网格层.lineBetween(0, 行 * 格子大小, 宽, 行 * 格子大小);
    }
    // 中央竖向柔光，增加玻璃纵深
    this.网格层.fillStyle(0xffffff, 0.022).fillRect(宽 * 0.3, 0, 宽 * 0.4, 高);
    return this;
  }

  更新特效(毫秒: number): void {
    this.消除效果.更新(毫秒);
    this.落块效果.更新(毫秒);
    this.震动剩余 = Math.max(0, this.震动剩余 - 毫秒);
    const 进度 = this.震动时长 ? 1 - this.震动剩余 / this.震动时长 : 1;
    const 幅度 = (1 - 进度) ** 2 * this.震动强度;
    this.scene.cameras.main.setScroll(
      this.镜头原位.x + Math.cos(进度 * Math.PI * 12) * 幅度 * 0.55,
      this.镜头原位.y + Math.sin(进度 * Math.PI * 15 + Math.PI / 2) * 幅度,
    );
  }
  播放硬降(格子: [number, number][], 距离: number, 类型: 方块类型) {
    this.落块效果.硬降(格子, 距离, 类型);
    if (距离 > 0 && !this.震动剩余) this.播放震动(150, 2.5);
  }
  private 播放震动(时长: number, 强度: number): void {
    this.震动时长 = 时长;
    this.震动剩余 = 时长;
    this.震动强度 = 强度;
    this.更新特效(0);
  }
  获取震屏状态() {
    return {
      剩余: this.震动剩余,
      强度: this.震动强度,
      x: this.scene.cameras.main.scrollX - this.镜头原位.x,
      y: this.scene.cameras.main.scrollY - this.镜头原位.y,
    };
  }
  获取落块特效状态() {
    return this.落块效果.快照();
  }
  获取特效状态() {
    return this.消除效果.快照();
  }
  更新(状态: 俄罗斯方块状态): this {
    const 落块 = 状态.落块事件;
    if (落块 && 落块.序号 !== this.上次落块事件) {
      this.上次落块事件 = 落块.序号;
      this.落块效果.锁定(落块);
      if (落块.行数) {
        this.播放震动(落块.行数 === 4 ? 360 : 220, 落块.行数 === 4 ? 7 : 2 + 落块.行数);
      }
    }
    if (!落块 && this.上次落块事件) {
      this.上次落块事件 = 0;
      this.落块效果.清空();
      this.震动剩余 = 0;
      this.scene.cameras.main.setScroll(this.镜头原位.x, this.镜头原位.y);
      this.setPosition(this.原X, this.原Y);
    }
    const 事件 = 状态.消行事件;
    if (事件 && 事件.序号 !== this.上次消行事件) {
      this.上次消行事件 = 事件.序号;
      this.消除效果.播放(事件);
    }
    if (!事件 && this.上次消行事件) {
      this.上次消行事件 = 0;
      this.消除效果.清空();
    }
    // 状态会原地修改，按显示数据签名缓存，尺寸和落点影设置也参与失效。
    const 签名 = JSON.stringify([
      状态.棋盘,
      状态.当前方块,
      状态.阶段,
      this.格子大小,
      this.落点影透明度,
      游戏外观.方块.颜色,
    ]);
    if (签名 === this.绘制签名) return this;
    this.绘制签名 = 签名;
    this.格子图层.clear();
    this.辉光层.clear();
    for (let 行 = 0; 行 < 可见高度; 行 += 1) {
      for (let 列 = 0; 列 < 棋盘宽度; 列 += 1) {
        const 类型 = 状态.棋盘[行 + 隐藏高度]?.[列];
        if (类型) this.绘制格(列, 行, 类型, 0.86, false);
      }
    }
    if (状态.阶段 === "结束") return this;

    const 幽灵: 活动方块 = {
      ...状态.当前方块,
      格子: 状态.当前方块.格子.map((格子) => ({ ...格子 })),
    };
    while (
      可以放置(状态, {
        ...幽灵,
        格子: 幽灵.格子.map((格子) => ({ ...格子, 行2: 格子.行2 + 2 })),
      })
    ) {
      for (const 格子 of 幽灵.格子) 格子.行2 += 2;
    }
    for (const [列, 行] of 读取格子(幽灵)) {
      this.绘制格(列, 行, 幽灵.类型, this.落点影透明度 / 100, true);
    }
    for (const [列, 行] of 读取格子(状态.当前方块)) {
      this.绘制格(列, 行, 状态.当前方块.类型, 1, false);
    }
    return this;
  }

  设置落点影透明度(透明度: number): this {
    this.落点影透明度 = Phaser.Math.Clamp(透明度, 0, 100);
    return this;
  }

  设置网格显示(显示: boolean): this {
    this.网格层.setVisible(显示);
    return this;
  }

  private 绘制格(列: number, 行: number, 类型: 方块类型, 透明度: number, 幽灵: boolean): void {
    if (行 < 0) return;
    const 格子 = this.格子大小;
    const x = 列 * 格子 + 1.5;
    const y = 行 * 格子 + 1.5;
    const 外观 = {
      色值: 游戏外观.方块.颜色[类型],
      格子,
      透明度,
      圆角比例: 0.16,
      幽灵,
    };
    绘制方块单元预制体(this.格子图层, x, y, 外观);
    if (!幽灵 && 透明度 >= 0.8) 绘制方块辉光(this.辉光层, x, y, 外观);
  }
}
