import Phaser from "phaser";
import { 绘制方块单元预制体, 绘制方块辉光 } from "../../core/组件/Phaser界面/方块单元预制体";
import { 绘制玻璃面板 } from "../../core/组件/Phaser界面/玻璃绘制";
import { 亮色 } from "../../core/组件/Phaser界面/颜色工具";
import type { 方块类型 } from "../玩法/俄罗斯方块";
import { 游戏外观 } from "../配置/游戏外观";

const 出生格: Record<方块类型, [number, number][]> = {
  I: [
    [0, 1],
    [1, 1],
    [2, 1],
    [3, 1],
  ],
  O: [
    [1, 0],
    [2, 0],
    [1, 1],
    [2, 1],
  ],
  T: [
    [1, 0],
    [0, 1],
    [1, 1],
    [2, 1],
  ],
  S: [
    [1, 0],
    [2, 0],
    [0, 1],
    [1, 1],
  ],
  Z: [
    [0, 0],
    [1, 0],
    [1, 1],
    [2, 1],
  ],
  J: [
    [0, 0],
    [0, 1],
    [1, 1],
    [2, 1],
  ],
  L: [
    [2, 0],
    [0, 1],
    [1, 1],
    [2, 1],
  ],
};

export interface 方块预览布局 {
  类型: "手机" | "紧凑" | "桌面";
  视口宽: number;
  左: number;
  顶: number;
  宽: number;
  高: number;
}

/** 包含三张预测卡片的方块预览栏预制体，管理标题、卡片和方块单元显示。 */
export class 下一个方块栏 extends Phaser.GameObjects.Container {
  private readonly 绘图: Phaser.GameObjects.Graphics;
  private readonly 辉光层: Phaser.GameObjects.Graphics;
  private readonly 标题: Phaser.GameObjects.Text;
  private 方块序列: 方块类型[] = [];
  private 当前布局?: 方块预览布局;

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0);
    this.绘图 = scene.add.graphics();
    this.辉光层 = scene.add.graphics();
    this.辉光层.setBlendMode(Phaser.BlendModes.ADD);
    this.标题 = scene.add.text(0, 0, "下一个", {
      fontFamily: 游戏外观.字体.家族,
      fontSize: `${游戏外观.字体.辅助}px`,
      fontStyle: "bold",
      color: "#A9BDD8",
      letterSpacing: 2,
    });
    this.标题.setShadow(0, 1, "#04070f", 3, true, true);
    this.add([this.绘图, this.辉光层, this.标题]);
    this.setDepth(2);
    scene.add.existing(this);
  }

  显示(方块序列: 方块类型[], 布局: 方块预览布局): this {
    this.方块序列 = 方块序列.slice(0, 3);
    this.当前布局 = 布局;
    this.重绘();
    return this;
  }

  private 重绘(): void {
    const 布局 = this.当前布局;
    if (!布局) return;
    const { 类型, 视口宽, 左, 顶, 宽, 高 } = 布局;
    const 手机 = 类型 === "手机";
    const 紧凑 = 类型 === "紧凑";
    const 卡片间距 = 游戏外观.方块.预览格间距;
    const 卡片顶 = 手机 ? 顶 + 28 : 紧凑 ? 顶 + 22 : 顶 + 46;
    const 卡片高 = 手机
      ? Math.max(40, (高 - 28 - 92 - 24) / 3)
      : 紧凑
        ? 0
        : Math.max(72, (高 - 46 - 92 - 24) / 3);
    const 格子 = 手机
      ? Math.max(12, Math.min(30, (宽 - 24) / 4, (卡片高 - 20) / 2))
      : 紧凑
        ? 11
        : Math.max(14, Math.min(22, (卡片高 - 20) / 2, (宽 - 40) / 4));
    const 预览宽 = 格子 * 4;
    this.标题
      .setPosition(
        手机 ? 左 + 8 : 紧凑 ? 视口宽 - 108 : 左 + 18,
        手机 ? 顶 + 8 : 紧凑 ? 顶 : 顶 + 16,
      )
      .setFontSize(`${手机 && 视口宽 < 640 ? 12 : 游戏外观.字体.辅助}px`);
    this.绘图.clear();
    this.辉光层.clear();

    this.方块序列.forEach((方块, 索引) => {
      const 当前Y = 卡片顶 + 索引 * (紧凑 ? 62 : 卡片高 + (手机 ? 卡片间距 : 12));
      const 点集 = 出生格[方块];
      const 最小列 = Math.min(...点集.map(([列]) => 列));
      const 最小行 = Math.min(...点集.map(([, 行]) => 行));
      const 最大列 = Math.max(...点集.map(([列]) => 列));
      const 最大行 = Math.max(...点集.map(([, 行]) => 行));
      const 方块宽 = (最大列 - 最小列 + 1) * 格子;
      const 方块高 = (最大行 - 最小行 + 1) * 格子;
      const 卡片X = 手机 ? 左 + 8 : 紧凑 ? 0 : 左 + 12;
      const 卡片宽 = 手机 ? 宽 - 16 : 紧凑 ? 0 : 宽 - 24;
      const 首位 = 索引 === 0;
      if (手机 || !紧凑) {
        绘制玻璃面板(this.绘图, 卡片X, 当前Y, 卡片宽, 卡片高, {
          圆角: 12,
          填色: 首位 ? 0x27406b : 0x1b2c4c,
          透明度: 首位 ? 0.9 : 0.66,
          边色: 首位 ? 亮色(游戏外观.方块.颜色[方块], 0.35) : 0x35496f,
          边透明度: 首位 ? 0.55 : 0.38,
          投影: false,
          高光: 手机,
          强调色: 首位 ? 游戏外观.方块.颜色[方块] : undefined,
        });
        if (首位 && !手机) {
          this.绘图
            .fillStyle(游戏外观.方块.颜色[方块], 0.85)
            .fillRoundedRect(卡片X + 3, 当前Y + 10, 3, 卡片高 - 20, 2);
        }
      }
      const 原点X = 手机
        ? 左 + (宽 - 方块宽) / 2
        : 紧凑
          ? 视口宽 - 108 - 预览宽 / 2
          : 卡片X + (卡片宽 - 方块宽) / 2;
      const 原点Y = 手机
        ? 当前Y + (卡片高 - 方块高) / 2
        : 紧凑
          ? 当前Y
          : 当前Y + (卡片高 - 方块高) / 2;
      for (const [列, 行] of 点集) {
        const 外观 = {
          色值: 游戏外观.方块.颜色[方块],
          格子,
          圆角比例: 手机 ? 0.16 : 0.14,
        };
        const x = 原点X + (列 - 最小列) * 格子;
        const y = 原点Y + (行 - 最小行) * 格子;
        绘制方块单元预制体(this.绘图, x, y, 外观);
        if (首位) 绘制方块辉光(this.辉光层, x, y, 外观);
      }
    });
  }
}
