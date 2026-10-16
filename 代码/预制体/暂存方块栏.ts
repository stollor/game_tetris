import Phaser from "phaser";
import { 界面按钮 } from "../../框架/界面/按钮";
import type { 方块类型 } from "../玩法/俄罗斯方块";
import { 绘制方块单元预制体 } from "../界面/方块单元";
import { 游戏外观 } from "../配置/游戏外观";
import { 界面主题 } from "../配置/界面主题";
import { 出生格 } from "./下一个方块栏";

export class 暂存方块栏 extends Phaser.GameObjects.Container {
  private readonly 按钮: 界面按钮;
  private readonly 方块: Phaser.GameObjects.Graphics;
  private readonly 标签: Phaser.GameObjects.Text;
  private 签名 = "";
  constructor(scene: Phaser.Scene, 点击: () => void) {
    super(scene);
    const t = 界面主题();
    this.按钮 = new 界面按钮(scene, 0, 0, {
      宽: 140,
      高: 72,
      文案: "",
      name: "game.hold",
      点击,
      面板色: t.按钮.次要.默认.背景,
      强调色: t.文字.强调,
      文字色: t.文字.主要,
    });
    this.方块 = scene.add.graphics();
    this.标签 = scene.add.text(0, 0, "", { fontSize: "11px", color: t.文字.主要 }).setOrigin(0.5);
    this.add([this.按钮, this.方块, this.标签]);
    this.setDepth(4);
    scene.add.existing(this);
  }
  显示(
    类型: 方块类型 | null,
    可用: boolean,
    英文: boolean,
    x: number,
    y: number,
    宽: number,
    高: number,
  ): void {
    this.setPosition(x, y);
    this.按钮.设置可用(可用);
    const 签名 = JSON.stringify([
      类型,
      可用,
      英文,
      宽,
      高,
      界面主题().元信息.名称,
      游戏外观.方块.颜色,
    ]);
    if (签名 === this.签名) return;
    this.签名 = 签名;
    this.按钮.设置布局尺寸(宽, 高);
    this.标签
      .setFontSize(宽 < 110 ? 9 : 11)
      .setWordWrapWidth(宽 - 10, true)
      .setText(
        可用
          ? 英文
            ? "HOLD: C / ↑"
            : "暂存 C / 长按↑"
          : 英文
            ? "HOLD · LOCK TO SWAP"
            : "暂存 · 落块后可换",
      )
      .setPosition(0, 高 / 2 - 13)
      .setColor(可用 ? 界面主题().文字.主要 : 界面主题().文字.弱化);
    this.方块.clear();
    if (!类型) {
      this.方块
        .lineStyle(1, Number.parseInt(界面主题().面板.主面板.描边.slice(1), 16), 0.6)
        .strokeRoundedRect(-20, -高 / 2 + 10, 40, 高 - 36, 4);
      return;
    }
    const 点 = 出生格[类型];
    const 最小列 = Math.min(...点.map(([列]) => 列)),
      最大列 = Math.max(...点.map(([列]) => 列));
    const 最小行 = Math.min(...点.map(([, 行]) => 行)),
      最大行 = Math.max(...点.map(([, 行]) => 行));
    const 格 = Math.min(18, (高 - 34) / 2, (宽 - 20) / 4);
    for (const [列, 行] of 点)
      绘制方块单元预制体(
        this.方块,
        (列 - 最小列 - (最大列 - 最小列 + 1) / 2) * 格,
        -12 + (行 - 最小行 - (最大行 - 最小行 + 1) / 2) * 格,
        { 色值: 游戏外观.方块.颜色[类型], 格子: 格, 透明度: 可用 ? 1 : 0.55 },
      );
  }
}
