import Phaser from "phaser";
import { 绘制方块单元预制体, 绘制方块辉光 } from "../../core/组件/Phaser界面/方块单元预制体";
import { 亮色, 暗色 } from "../../core/组件/Phaser界面/颜色工具";
import {
  type 俄罗斯方块状态,
  可以放置,
  可见高度,
  type 方块类型,
  方块颜色,
  棋盘宽度,
  type 活动方块,
  读取格子,
  隐藏高度,
} from "../玩法/俄罗斯方块";
import { 游戏外观 } from "../配置/游戏外观";

/** 游戏棋盘预制体：负责棋盘框体、已落方块、当前方块与投影。 */
export class 俄罗斯方块棋盘 extends Phaser.GameObjects.Container {
  private readonly 框体: Phaser.GameObjects.Graphics;
  private readonly 网格层: Phaser.GameObjects.Graphics;
  private readonly 辉光层: Phaser.GameObjects.Graphics;
  private readonly 格子图层: Phaser.GameObjects.Graphics;
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
    this.setDepth(1);
    scene.add.existing(this);
  }

  布局(左: number, 顶: number, 格子大小: number, 透明度: number, 显示网格 = true): this {
    this.setPosition(左, 顶);
    this.格子大小 = 格子大小;
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
    // 玻璃面板：上亮下暗（渐变过渡，无接缝）
    this.框体
      .fillStyle(背景色, 透明度)
      .fillRoundedRect(-10, -10, 宽 + 20, 高 + 20, 圆角)
      .fillGradientStyle(
        亮色(背景色, 0.24),
        亮色(背景色, 0.24),
        背景色,
        背景色,
        透明度 * 0.55,
        透明度 * 0.55,
        0,
        0,
      )
      .fillRect(-10 + 圆角, -9, 宽 + 20 - 圆角 * 2, (高 + 20) * 0.42)
      .fillGradientStyle(
        背景色,
        背景色,
        暗色(背景色, 0.5),
        暗色(背景色, 0.5),
        0,
        0,
        透明度 * 0.5,
        透明度 * 0.5,
      )
      .fillRect(-10 + 圆角, -10 + (高 + 20) * 0.56, 宽 + 20 - 圆角 * 2, (高 + 20) * 0.44 - 1)
      // 顶部青色微光
      .fillStyle(游戏外观.颜色.青, 0.12)
      .fillRect(-10 + 圆角, -9, 宽 + 20 - 圆角 * 2, 2.5)
      // 内侧亮边 + 外侧描边
      .lineStyle(1, 亮色(背景色, 0.4), 0.3)
      .strokeRoundedRect(-8.5, -8.5, 宽 + 17, 高 + 17, 圆角 - 1.5)
      .lineStyle(1.2, 边框色, 0.9)
      .strokeRoundedRect(-10, -10, 宽 + 20, 高 + 20, 圆角)
      .lineStyle(2, 游戏外观.颜色.青, 0.1)
      .strokeRoundedRect(-12, -12, 宽 + 24, 高 + 24, 圆角 + 2);
    // 内部网格
    this.网格层.clear().lineStyle(1, 亮色(背景色, 0.4), 0.24);
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

  更新(状态: 俄罗斯方块状态): this {
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
      色值: 方块颜色[类型],
      格子,
      透明度,
      圆角比例: 0.16,
      幽灵,
    };
    绘制方块单元预制体(this.格子图层, x, y, 外观);
    if (!幽灵 && 透明度 >= 0.8) 绘制方块辉光(this.辉光层, x, y, 外观);
  }
}
