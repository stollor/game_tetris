import type { 界面按钮 } from "Phaser框架/界面/按钮";
import Phaser from "phaser";
import { 游戏外观 } from "../../代码/配置/游戏外观";
import { 绘制霓虹玻璃 } from "./底板";
import { 创建霓虹按钮 } from "./按钮";
import { 添加霓虹原生文字 } from "./文字";
import { 读取霓虹调色板 } from "./调色板";

export interface 霓虹结算文案 {
  徽标: string;
  分数: string;
  统计标签: string[];
  统计数值: string[];
  重开: string;
  菜单: string;
}

export interface 霓虹结算回调 {
  重开: () => void;
  菜单: () => void;
}

export interface 霓虹结算几何 {
  中心X: number;
  顶: number;
  宽: number;
  高: number;
  比例: number;
}

export interface 霓虹结算数据 {
  徽标: string;
  分数: string;
  统计: readonly (readonly [string, string])[];
  奖励?: string;
}

/** 结算面板负责遮罩、玻璃底板、徽标、分数、统计与两个操作按钮；重开/返回的行为由回调决定。 */
export class 霓虹结算面板 extends Phaser.GameObjects.Container {
  readonly 遮罩图形: Phaser.GameObjects.Graphics;
  readonly 面板图形: Phaser.GameObjects.Graphics;
  readonly 徽标文字: Phaser.GameObjects.Text;
  readonly 分数文字: Phaser.GameObjects.Text;
  readonly 统计标签: Phaser.GameObjects.Text[];
  readonly 统计数值: Phaser.GameObjects.Text[];
  readonly 重开按钮: 界面按钮;
  readonly 菜单按钮: 界面按钮;
  readonly 奖励文字: Phaser.GameObjects.Text;

  constructor(场景: Phaser.Scene, 配置: { 文案: 霓虹结算文案; 回调: 霓虹结算回调 }) {
    super(场景, 0, 0);
    const 调色板 = 读取霓虹调色板();
    this.遮罩图形 = 场景.add.graphics();
    this.面板图形 = 场景.add.graphics();
    this.徽标文字 = 添加霓虹原生文字(场景, undefined, 0, 0, 配置.文案.徽标, {
      字号: 12,
      颜色: 调色板.强调色,
      粗体: true,
    }).setOrigin(0.5);
    this.分数文字 = 添加霓虹原生文字(场景, undefined, 0, 0, 配置.文案.分数, {
      字号: 34,
      颜色: 调色板.强调色,
      粗体: true,
    }).setOrigin(0.5);
    this.奖励文字 = 添加霓虹原生文字(场景, undefined, 0, 0, "", { 字号: 12, 颜色: 调色板.强调色 })
      .setOrigin(0.5)
      .setAlign("center")
      .setName("game.reward");
    this.统计标签 = 配置.文案.统计标签.map((标签) =>
      添加霓虹原生文字(场景, undefined, 0, 0, 标签, {
        字号: 11,
        颜色: 调色板.次要文字,
      }).setOrigin(0.5),
    );
    this.统计数值 = 配置.文案.统计数值.map((值) =>
      添加霓虹原生文字(场景, undefined, 0, 0, 值, {
        字号: 18,
        颜色: 调色板.正文,
        粗体: true,
      }).setOrigin(0.5),
    );
    this.重开按钮 = 创建霓虹按钮(场景, {
      x: 0,
      y: 0,
      宽: 184,
      高: 48,
      文案: 配置.文案.重开,
      名称: "restart",
      点击: 配置.回调.重开,
      已选: true,
      字号: `${游戏外观.字体.按钮}px`,
      覆盖: { 强调色: 调色板.强调色, 文字色: 调色板.正文 },
    });
    this.菜单按钮 = 创建霓虹按钮(场景, {
      x: 0,
      y: 0,
      宽: 184,
      高: 42,
      文案: 配置.文案.菜单,
      名称: "main-menu",
      点击: 配置.回调.菜单,
      字号: `${游戏外观.字体.辅助 + 2}px`,
    });
    this.add([
      this.遮罩图形,
      this.面板图形,
      this.徽标文字,
      this.分数文字,
      this.奖励文字,
      ...this.统计标签,
      ...this.统计数值,
      this.重开按钮,
      this.菜单按钮,
    ]);
    this.setVisible(false);
    场景.add.existing(this);
  }

  布局(屏宽: number, 屏高: number): 霓虹结算几何 {
    const 比例 = Math.min(1, (屏宽 - 28) / 380, (屏高 - 28) / 400);
    const 中心X = 屏宽 / 2;
    const 顶 = (屏高 - 400 * 比例) / 2;
    const 面板宽 = 380 * 比例;
    this.徽标文字
      .setPosition(中心X, 顶 + 34 * 比例)
      .setFontSize(`${12 * 比例}px`)
      .setWordWrapWidth(面板宽 - 32 * 比例);
    this.分数文字.setPosition(中心X, 顶 + 132 * 比例).setFontSize(`${38 * 比例}px`);
    const 左 = 中心X - 面板宽 / 2;
    const 列宽 = 面板宽 / 3;
    this.统计标签.forEach((文字, i) => {
      文字.setPosition(左 + 列宽 * (i + 0.5), 顶 + 180 * 比例).setFontSize(`${11 * 比例}px`);
    });
    this.统计数值.forEach((文字, i) => {
      文字.setPosition(左 + 列宽 * (i + 0.5), 顶 + 210 * 比例).setFontSize(`${18 * 比例}px`);
    });
    this.奖励文字
      .setPosition(中心X, 顶 + 258 * 比例)
      .setFontSize(`${12 * 比例}px`)
      .setWordWrapWidth(面板宽 - 36 * 比例, true);
    this.重开按钮.setPosition(中心X, 顶 + 307 * 比例).设置布局尺寸(面板宽 - 48 * 比例, 44 * 比例);
    this.菜单按钮.setPosition(中心X, 顶 + 356 * 比例).设置布局尺寸(面板宽 - 48 * 比例, 38 * 比例);
    return { 中心X, 顶, 宽: 面板宽, 高: 400 * 比例, 比例 };
  }

  设置重开文案(文案: string): void {
    this.重开按钮.setLabel(文案);
  }

  绘制(几何: 霓虹结算几何, 屏宽: number, 屏高: number, 数据: 霓虹结算数据): void {
    const 调色板 = 读取霓虹调色板();
    const { 中心X, 顶, 宽: 面板宽, 高: 面板高, 比例 } = 几何;
    const 左 = 中心X - 面板宽 / 2;
    this.遮罩图形.clear();
    this.面板图形.clear();
    this.遮罩图形.fillStyle(调色板.遮罩, 0.56).fillRect(0, 0, 屏宽, 屏高);
    绘制霓虹玻璃(this.面板图形, 左, 顶, 面板宽, 面板高, {
      圆角: 20,
      透明度: 0.98,
      边色: 调色板.面板描边,
      边透明度: 0.85,
      强调色: 调色板.强调,
      高光: true,
    });
    this.面板图形
      .fillStyle(调色板.强调, 0.9)
      .fillRoundedRect(左 + 面板宽 / 2 - 64, 顶 + 12, 128, 4, 2)
      .lineStyle(1, 调色板.分组线, 0.9)
      .lineBetween(左 + 18, 顶 + 158 * 比例, 左 + 面板宽 - 18, 顶 + 158 * 比例);
    const 列宽 = 面板宽 / 3;
    for (let 索引 = 1; 索引 < 3; 索引 += 1) {
      this.面板图形.lineBetween(
        左 + 列宽 * 索引,
        顶 + 170 * 比例,
        左 + 列宽 * 索引,
        顶 + 232 * 比例,
      );
    }
    if (this.徽标文字.text !== 数据.徽标) this.徽标文字.setText(数据.徽标);
    if (this.分数文字.text !== 数据.分数) this.分数文字.setText(数据.分数);
    if (this.奖励文字.text !== (数据.奖励 ?? "")) this.奖励文字.setText(数据.奖励 ?? "");
    this.统计标签.forEach((文字, 索引) => {
      const 值 = 数据.统计[索引]?.[0] ?? "";
      if (文字.text !== 值) 文字.setText(值);
    });
    this.统计数值.forEach((文字, 索引) => {
      const 值 = 数据.统计[索引]?.[1] ?? "0";
      if (文字.text !== 值) 文字.setText(值);
    });
  }
}
