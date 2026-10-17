import type { 界面按钮 } from "Phaser框架/界面/按钮";
import Phaser from "phaser";
import { 获取旅行图标 } from "./图标";
import { 创建霓虹按钮 } from "./按钮";
import { 添加霓虹原生文字 } from "./文字";
import { 读取霓虹调色板 } from "./调色板";

export interface 霓虹模式卡配置 {
  x: number;
  y: number;
  宽: number;
  高: number;
  名称: string;
  标题: string;
  细节: string;
  说明: string;
  纪录: string;
  强调色: string;
  点击: () => void;
  /** 点排行图标打开该模式榜；与整卡开始分离。 */
  排行点击?: () => void;
}

/** 模式选择卡片：整卡是一个按钮，标题/细节/说明/纪录叠在卡内；右上角可选排行入口。 */
export class 霓虹模式卡 extends Phaser.GameObjects.Container {
  readonly 卡片: 界面按钮;
  readonly 标题文字: Phaser.GameObjects.Text;
  readonly 细节文字: Phaser.GameObjects.Text;
  readonly 说明文字: Phaser.GameObjects.Text;
  readonly 纪录文字: Phaser.GameObjects.Text;
  readonly 排行钮?: 界面按钮;

  constructor(场景: Phaser.Scene, 配置: 霓虹模式卡配置) {
    super(场景, 配置.x, 配置.y);
    const 调色板 = 读取霓虹调色板();
    const { 宽, 高 } = 配置;
    this.卡片 = 创建霓虹按钮(场景, {
      x: 0,
      y: 0,
      宽,
      高,
      文案: "",
      名称: 配置.名称,
      点击: 配置.点击,
      字号: "17px",
      容器: this,
      覆盖: { 强调色: 配置.强调色, 文字色: 调色板.正文 },
    });
    this.标题文字 = 添加霓虹原生文字(场景, this, -宽 / 2 + 22, -高 / 2 + 25, 配置.标题, {
      字号: 23,
      颜色: 调色板.正文,
      对齐: "left",
    }).setOrigin(0, 0.5);
    const 细节右 = 配置.排行点击 ? 宽 / 2 - 52 : 宽 / 2 - 20;
    this.细节文字 = 添加霓虹原生文字(场景, this, 细节右, -高 / 2 + 25, 配置.细节, {
      字号: 11,
      颜色: 配置.强调色,
      对齐: "left",
    }).setOrigin(1, 0.5);
    this.说明文字 = 添加霓虹原生文字(场景, this, -宽 / 2 + 22, 2, 配置.说明, {
      字号: 12,
      颜色: 调色板.次要文字,
      对齐: "left",
    }).setOrigin(0, 0.5);
    this.纪录文字 = 添加霓虹原生文字(场景, this, -宽 / 2 + 22, 高 / 2 - 20, 配置.纪录, {
      字号: 11,
      颜色: 调色板.正文,
      对齐: "left",
    }).setOrigin(0, 0.5);
    if (配置.排行点击) {
      this.排行钮 = 创建霓虹按钮(场景, {
        x: 宽 / 2 - 22,
        y: -高 / 2 + 22,
        宽: 36,
        高: 36,
        文案: "",
        名称: `${配置.名称}.leaderboard`,
        点击: 配置.排行点击,
        图标: 获取旅行图标(场景, "排行"),
        图标尺寸: 18,
        容器: this,
        覆盖: {
          样式: "文字",
          强调色: 配置.强调色,
          文字色: 调色板.正文,
          描边宽度: 0,
          面板透明度: 0.35,
          边框透明度: 0.45,
        },
      });
      this.排行钮.setDepth(2);
    }
    场景.add.existing(this);
  }
}
