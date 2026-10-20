import type { 界面按钮 } from "Phaser框架/界面/按钮";
import Phaser from "phaser";
import { 获取旅行图标 } from "./图标";
import { 创建霓虹按钮 } from "./按钮";
import { 添加霓虹文字项 } from "./文字";
import { type 模式卡数据, 生成模式卡文字项, 计算模式卡排行区域 } from "./模式卡配方";
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

/**
 * 模式选择卡片：整卡是一个按钮，标题/细节/说明/纪录叠在卡内；右上角可选排行入口。
 * Phaser 侧底板继续用框架按钮的九宫格烘焙路径（视觉真相）；文字项与 Three 版共用 `模式卡配方.ts`。
 */
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
    const 布局 = { 中心X: 0, 中心Y: 0, 宽, 高 };
    const 数据: 模式卡数据 = {
      标题: 配置.标题,
      细节: 配置.细节,
      说明: 配置.说明,
      纪录: 配置.纪录,
      强调色: 配置.强调色,
      有排行: 配置.排行点击 !== undefined,
    };
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
      覆盖: {
        强调色: 配置.强调色,
        文字色: 调色板.正文,
      },
    });
    const [标题项, 细节项, 说明项, 纪录项] = 生成模式卡文字项(布局, 数据);
    this.标题文字 = 添加霓虹文字项(场景, this, 标题项);
    this.细节文字 = 添加霓虹文字项(场景, this, 细节项);
    this.说明文字 = 添加霓虹文字项(场景, this, 说明项);
    this.纪录文字 = 添加霓虹文字项(场景, this, 纪录项);
    if (配置.排行点击) {
      const 排行区域 = 计算模式卡排行区域(布局);
      this.排行钮 = 创建霓虹按钮(场景, {
        x: 排行区域.中心X,
        y: 排行区域.中心Y,
        宽: 排行区域.宽,
        高: 排行区域.高,
        文案: "",
        名称: `${配置.名称}.leaderboard`,
        点击: 配置.排行点击,
        图标: 获取旅行图标(场景, "排行"),
        图标尺寸: 20,
        容器: this,
        覆盖: {
          采用传入配色: true,
          面板色: "#1a2430",
          边框色: "#ffe7a8",
          强调色: "#ffe7a8",
          文字色: "#ffe7a8",
          面板透明度: 0.78,
          边框透明度: 1,
        },
      });
      this.排行钮.setDepth(2);
    }
    场景.add.existing(this);
  }
}
