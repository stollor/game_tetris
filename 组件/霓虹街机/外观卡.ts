import { 界面控件, 绑定按钮手势 } from "Phaser框架/界面/控件";
import { 界面滚动区域 } from "Phaser框架/界面/滚动区域";
import { 选取对比文字色, 颜色字符串 } from "Phaser框架/界面/颜色工具";
import type Phaser from "phaser";
import type { 地点名称 } from "../../代码/框架配置/旅行地点";
import { 绘制霓虹背景 } from "../../代码/视觉/霓虹背景";
import type { 背景主题 } from "../../代码/配置/俄罗斯方块设置";
import { type 方块外观名称, 解析方块外观 } from "../../代码/配置/方块外观";
import { 游戏外观 } from "../../代码/配置/游戏外观";
import type { 样式选择 } from "../../框架/设置/设置";
import { 绘制方块单元预制体 } from "./方块单元";
import { 读取霓虹调色板 } from "./调色板";
import { 创建风景裁剪 } from "./风景裁剪";

/** 设置页竖排标题牌：中文逐字竖排，英文整句旋转。 */
export class 外观标题牌 extends 界面控件 {
  constructor(
    场景: Phaser.Scene,
    标题: string,
    配置: { 宽: number; 高: number; 面板色: number; 强调色: number; 文字色: string; 英文: boolean },
  ) {
    super(场景, 0, 0, 配置.宽, 配置.高);
    const 背板 = 场景.add.graphics();
    背板
      .fillStyle(配置.面板色, 0.32)
      .fillRoundedRect(-配置.宽 / 2 + 4, -配置.高 / 2 + 8, 配置.宽 - 8, 配置.高 - 16, 6)
      .lineStyle(1, 配置.强调色, 0.45)
      .strokeRoundedRect(-配置.宽 / 2 + 4, -配置.高 / 2 + 8, 配置.宽 - 8, 配置.高 - 16, 6);
    this.add(背板);

    const 字号 = 标题.length > 6 ? "11px" : "14px";
    if (配置.英文) {
      const 文本 = 场景.add
        .text(0, 0, 标题, {
          fontFamily: 游戏外观.字体.家族,
          fontSize: 字号,
          fontStyle: "bold",
          color: 配置.文字色,
          align: "center",
        })
        .setOrigin(0.5)
        .setAngle(-90);
      this.add(文本);
    } else {
      const 字符 = [...标题];
      const 行高 = 17;
      字符.forEach((字, 索引) => {
        const 文本 = 场景.add
          .text(0, (索引 - (字符.length - 1) / 2) * 行高, 字, {
            fontFamily: 游戏外观.字体.家族,
            fontSize: 字号,
            fontStyle: "bold",
            color: 配置.文字色,
            align: "center",
          })
          .setOrigin(0.5);
        this.add(文本);
      });
    }
    场景.add.existing(this);
  }
}

export interface 外观卡配置 {
  名称: string;
  标签: string;
  宽: number;
  高: number;
  面板色: number;
  背景色: number;
  强调色: number;
  类型: "样式" | "背景" | "方块";
  方块方案?: 方块外观名称;
  背景值?: 背景主题;
  样式值?: 样式选择 | 地点名称;
  已选: boolean;
  选择: () => void;
}

/** 设置页的样式/背景外观卡：缩略预览随样式与背景取值绘制。 */
export class 外观选择卡片 extends 界面控件 {
  private readonly 底板: Phaser.GameObjects.Rectangle;
  private readonly 预览: Phaser.GameObjects.Graphics;
  private readonly 标签: Phaser.GameObjects.Text;

  constructor(场景: Phaser.Scene, 配置: 外观卡配置) {
    super(场景, 0, 0, 配置.宽, 配置.高);
    this.name = 配置.名称;
    const 边色 = 配置.已选 ? 配置.强调色 : 0x718092;
    this.底板 = 场景.add
      .rectangle(0, 0, 配置.宽, 配置.高, 配置.面板色, 1)
      .setName(配置.名称)
      .setStrokeStyle(配置.已选 ? 2 : 1, 边色, 配置.已选 ? 1 : 0.42);
    this.预览 = 场景.add.graphics();
    const 预览高 = 配置.类型 === "背景" ? 配置.高 - 30 : 配置.高 - 31;
    const 预览宽 = 配置.宽 - 12;
    const x = -预览宽 / 2;
    const y = -配置.高 / 2 + 5;
    if (配置.类型 === "方块") {
      this.预览.fillStyle(配置.背景色).fillRoundedRect(x, y, 预览宽, 预览高, 5);
      const 方案 = 解析方块外观(配置.方块方案);
      const 格 = Math.min(16, (预览宽 - 12) / 4, (预览高 - 6) / 2);
      for (const [i, 类型] of (["I", "T", "L", "O"] as const).entries())
        绘制方块单元预制体(this.预览, x + 预览宽 / 2 - 格 * 2 + i * 格, y + (预览高 - 格) / 2, {
          格子: 格,
          方案: 方案.名称,
          色值: 方案.颜色[类型],
        });
    } else if (配置.类型 === "背景" && 配置.背景值) {
      const 风景 = 创建风景裁剪(场景, this, x, y, 预览宽, 预览高);
      绘制霓虹背景(风景, 预览宽, 预览高, 配置.背景值);
    } else if (配置.类型 === "背景") {
      this.预览
        .fillGradientStyle(配置.背景色, 配置.背景色, 配置.强调色, 配置.强调色, 1, 1, 0.8, 0.8)
        .fillRoundedRect(x, y, 预览宽, 预览高, 5);
      this.预览
        .fillStyle(0xffedbd, 0.92)
        .fillCircle(x + 预览宽 * 0.74, y + 9, Math.max(3, Math.min(6, 预览高 * 0.13)));
      this.预览.fillStyle(配置.强调色, 0.9).fillTriangle(x, y + 30, x + 18, y + 13, x + 38, y + 30);
      this.预览
        .fillStyle(配置.背景色, 0.72)
        .fillTriangle(x + 21, y + 30, x + 43, y + 12, x + 66, y + 30);
      this.预览.fillStyle(0xffffff, 0.25).fillRect(x + 3, y + 32, Math.max(1, 预览宽 - 6), 1);
    } else {
      this.预览.fillStyle(配置.背景色).fillRoundedRect(x, y, 预览宽, 预览高, 5);
      const 古典 = 配置.样式值 === "暖纸古典";
      const 未来 = 配置.样式值 === "青蓝未来";
      this.预览.lineStyle(1, 配置.强调色, 古典 ? 0.55 : 0.22);
      if (未来) {
        for (let gx = x + 6; gx < x + 预览宽; gx += 12)
          this.预览.lineBetween(gx, y + 3, gx, y + 预览高 - 3);
        for (let gy = y + 6; gy < y + 预览高; gy += 12)
          this.预览.lineBetween(x + 3, gy, x + 预览宽 - 3, gy);
      } else {
        this.预览.strokeRect(x + 4, y + 4, 预览宽 - 8, 预览高 - 8);
      }
      const 格 = Math.min(12, (预览宽 - 20) / 5);
      const 左 = x + 预览宽 / 2 - 格 * 1.5;
      const 顶 = y + 预览高 / 2 - 格;
      for (const [列, 行] of [
        [0, 1],
        [1, 0],
        [1, 1],
        [2, 1],
      ]) {
        const 块x = 左 + 列 * 格,
          块y = 顶 + 行 * 格;
        this.预览.fillStyle(配置.强调色).fillRoundedRect(块x, 块y, 格 - 2, 格 - 2, 古典 ? 1 : 2);
        this.预览.fillStyle(0xffffff, 0.55).fillRect(块x + 1, 块y + 1, 格 - 4, 1);
      }
      this.预览.fillStyle(配置.强调色, 0.75).fillRect(x + 8, y + 预览高 - 10, 预览宽 - 16, 2);
    }
    this.标签 = 场景.add
      .text(0, 配置.高 / 2 - 12, 配置.标签, {
        fontFamily: 游戏外观.字体.家族,
        fontSize: 配置.宽 < 88 ? "9px" : "11px",
        color: 选取对比文字色(颜色字符串(配置.面板色)),
        align: "center",
        wordWrap: { width: 配置.宽 - 6 },
      })
      .setOrigin(0.5);
    this.add([this.底板, this.预览, this.标签]);
    this.sendToBack(this.底板);
    this.底板.setInteractive({ useHandCursor: true });
    绑定按钮手势(this.底板, {
      点击: 配置.选择,
      移入: () => this.底板.setStrokeStyle(2, 配置.强调色, 0.8),
      移出: () => this.底板.setStrokeStyle(配置.已选 ? 2 : 1, 边色, 配置.已选 ? 1 : 0.42),
    });
    场景.add.existing(this);
  }
}

/** 标题固定、卡片单排；超出可视宽度时复用框架滚动与裁剪。 */
export function 创建外观选择列表(
  场景: Phaser.Scene,
  舞台: Phaser.GameObjects.Container,
  宽: number,
  标题: string,
  卡片: 外观卡配置[],
  名称 = "preview.appearance",
): void {
  const 色 = 读取霓虹调色板();
  const 卡宽 = 96,
    间距 = 8,
    可视宽 = 宽;
  const 内容宽 = 卡片.length * (卡宽 + 间距) - 间距;
  舞台.add(
    场景.add.text(0, 8, 标题, {
      fontFamily: 游戏外观.字体.家族,
      fontSize: "14px",
      color: 色.正文,
    }),
  );
  const 列表 = new 界面滚动区域(场景, {
    左: 0,
    上: 32,
    宽: 可视宽,
    高: 122,
    内容高: 122,
    内容宽,
    方向: "水平",
    允许控件拖动: true,
  }).setName(`${名称}-list`);
  舞台.add(列表);
  卡片.forEach((配置, i) => {
    列表.内容容器.add(
      new 外观选择卡片(场景, { ...配置, 宽: 卡宽, 高: 100 }).setPosition(
        卡宽 / 2 + i * (卡宽 + 间距),
        82,
      ),
    );
  });
  const 选中 = 卡片.findIndex((项) => 项.已选);
  列表.设置滚动位置(Math.max(0, (选中 + 1) * (卡宽 + 间距) - 可视宽));
}
