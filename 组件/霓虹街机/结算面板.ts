import type { 界面按钮 } from "Phaser框架/界面/按钮";
import Phaser from "phaser";
import { 游戏外观 } from "../../代码/配置/游戏外观";
import { 获取旅行图标 } from "./图标";
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
  /** 本局领取到的方块币；有值时显示图标、+N 计数动画与新余额。 */
  金币?: { 新增: number; 总额: number; 原因: string; 编号: string };
  /** 省电模式：只做简单淡入，不放飞币与闪光。 */
  省电?: boolean;
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
  readonly 金币图标: Phaser.GameObjects.Image;
  readonly 金币数字: Phaser.GameObjects.Text;
  readonly 金币闪光: Phaser.GameObjects.Graphics;
  private 已播金币 = "";
  private 金币行Y = 0;
  private 比例 = 1;

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
    this.金币图标 = 场景.add.image(0, 0, 获取旅行图标(场景, "方块币")).setVisible(false);
    this.金币图标.setName("game.reward.icon");
    this.金币数字 = 添加霓虹原生文字(场景, undefined, 0, 0, "", {
      字号: 20,
      颜色: "#ffe7a8",
      粗体: true,
    })
      .setOrigin(0, 0.5)
      .setVisible(false)
      .setName("game.reward.amount");
    this.金币闪光 = 场景.add.graphics().setVisible(false);
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
      this.金币闪光,
      this.金币图标,
      this.金币数字,
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
    this.比例 = 比例;
    this.金币行Y = 顶 + 247 * 比例;
    this.金币图标.setDisplaySize(22 * 比例, 22 * 比例);
    this.金币数字.setFontSize(`${20 * 比例}px`);
    this.排列金币行(中心X);
    this.奖励文字
      .setPosition(中心X, 顶 + (this.已播金币 ? 269 : 258) * 比例)
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
    const 金币 = 数据.金币;
    const 奖励文案 = 金币 ? `${金币.原因} · 余额 ${金币.总额.toLocaleString()}` : (数据.奖励 ?? "");
    if (this.奖励文字.text !== 奖励文案) this.奖励文字.setText(奖励文案);
    if (!金币) {
      if (this.已播金币) {
        this.已播金币 = "";
        this.金币图标.setVisible(false);
        this.金币数字.setVisible(false);
        this.金币闪光.setVisible(false);
        this.奖励文字.setY(顶 + 258 * 比例);
      }
    } else if (金币.编号 !== this.已播金币) {
      this.已播金币 = 金币.编号;
      this.奖励文字.setY(顶 + 269 * 比例);
      this.播放金币动画(金币.新增, 中心X, 顶 + 132 * 比例, 数据.省电 === true);
    }
    this.统计标签.forEach((文字, 索引) => {
      const 值 = 数据.统计[索引]?.[0] ?? "";
      if (文字.text !== 值) 文字.setText(值);
    });
    this.统计数值.forEach((文字, 索引) => {
      const 值 = 数据.统计[索引]?.[1] ?? "0";
      if (文字.text !== 值) 文字.setText(值);
    });
  }

  private 排列金币行(中心X: number, 文字 = this.金币数字.text): void {
    const 图宽 = 22 * this.比例;
    const 间距 = 6 * this.比例;
    // 用最终宽度估算居中，计数过程中位置不抖动。
    const 文宽 = Math.max(this.金币数字.width, 文字.length * 11 * this.比例);
    const 左 = 中心X - (图宽 + 间距 + 文宽) / 2;
    this.金币图标.setPosition(左 + 图宽 / 2, this.金币行Y);
    this.金币数字.setPosition(左 + 图宽 + 间距, this.金币行Y);
    this.金币闪光.setPosition(左 + 图宽 / 2, this.金币行Y);
  }

  private 播放金币动画(新增: number, 中心X: number, 起点Y: number, 省电: boolean): void {
    const 场景 = this.scene;
    const 终文 = `+${新增}`;
    this.金币数字.setText(终文);
    this.排列金币行(中心X, 终文);
    this.金币图标.setVisible(true);
    this.金币数字.setVisible(true);
    const 图标尺寸 = 22 * this.比例;
    if (省电) {
      this.金币图标.setAlpha(0);
      this.金币数字.setAlpha(0);
      场景.tweens.add({ targets: [this.金币图标, this.金币数字], alpha: 1, duration: 220 });
      return;
    }
    // 计数：0 → +N
    const 计数 = { 值: 0 };
    this.金币数字.setText("+0");
    场景.tweens.add({
      targets: 计数,
      值: 新增,
      duration: Math.min(1100, 450 + 新增 * 8),
      delay: 250,
      ease: "Cubic.easeOut",
      onUpdate: () => this.金币数字.setText(`+${Math.round(计数.值)}`),
      onComplete: () => {
        this.金币数字.setText(终文);
        场景.tweens.add({
          targets: this.金币数字,
          scale: { from: 1.25, to: 1 },
          duration: 260,
          ease: "Back.easeOut",
        });
      },
    });
    // 图标弹出
    this.金币图标.setDisplaySize(1, 1);
    场景.tweens.add({
      targets: this.金币图标,
      displayWidth: 图标尺寸,
      displayHeight: 图标尺寸,
      duration: 380,
      ease: "Back.easeOut",
    });
    // 闪光：一圈放射短线淡出
    const 闪 = this.金币闪光.clear().setVisible(true).setAlpha(1).setScale(0.6);
    闪.lineStyle(2, 0xfff3bf, 0.95);
    for (let i = 0; i < 8; i++) {
      const 角 = (i * Math.PI) / 4;
      闪.lineBetween(Math.cos(角) * 16, Math.sin(角) * 16, Math.cos(角) * 24, Math.sin(角) * 24);
    }
    场景.tweens.add({
      targets: 闪,
      scale: 1.3 * this.比例,
      alpha: 0,
      delay: 650,
      duration: 520,
      ease: "Cubic.easeOut",
      onStart: () => 闪.setAlpha(1),
    });
    闪.setAlpha(0);
    // 飞币：从分数处飞向图标
    const 目标X = this.金币图标.x,
      目标Y = this.金币图标.y;
    const 数量 = Math.min(6, Math.max(3, Math.ceil(新增 / 15)));
    for (let i = 0; i < 数量; i++) {
      const 币 = 场景.add
        .image(中心X + (i - (数量 - 1) / 2) * 18 * this.比例, 起点Y, 获取旅行图标(场景, "方块币"))
        .setDisplaySize(14 * this.比例, 14 * this.比例)
        .setAlpha(0);
      this.add(币);
      场景.tweens.add({
        targets: 币,
        x: 目标X,
        y: 目标Y,
        alpha: { from: 1, to: 0.6 },
        delay: 120 + i * 70,
        duration: 520,
        ease: "Quad.easeIn",
        onComplete: () => 币.destroy(),
      });
    }
  }
}
