import { 界面控件, 绑定按钮手势 } from "Phaser框架/界面/控件";
import { 界面滚动区域 } from "Phaser框架/界面/滚动区域";
import type Phaser from "phaser";
import type { 地点名称 } from "../../代码/框架配置/旅行地点";
import { 添加风景缩略 } from "../../代码/视觉/风景缩略";
import type { 背景主题 } from "../../代码/配置/再消一行设置";
import { type 方块外观名称, 解析方块外观 } from "../../代码/配置/方块外观";
import { 游戏外观 } from "../../代码/配置/游戏外观";
import type { 样式选择 } from "../../框架/设置/设置";
import {
  外观卡列表常量,
  type 外观卡数据,
  外观卡预览矩形,
  生成外观卡文字项,
  生成外观标题牌文字项,
  绘制外观卡预览,
  绘制外观标题牌底板,
} from "./外观卡配方";
import { 添加霓虹文字项 } from "./文字";
import { 绘制方块单元预制体 } from "./方块单元";
import { 读取霓虹调色板 } from "./调色板";

function 转外观卡数据(配置: 外观卡配置): 外观卡数据 {
  return {
    标签: 配置.标签,
    面板色: 配置.面板色,
    背景色: 配置.背景色,
    强调色: 配置.强调色,
    类型: 配置.类型,
    方块方案: 配置.方块方案,
    背景值: 配置.背景值,
    样式值: 配置.样式值,
    已选: 配置.已选,
  };
}

/** 设置页竖排标题牌：中文逐字竖排，英文整句旋转。 */
export class 外观标题牌 extends 界面控件 {
  constructor(
    场景: Phaser.Scene,
    标题: string,
    配置: { 宽: number; 高: number; 面板色: number; 强调色: number; 文字色: string; 英文: boolean },
  ) {
    super(场景, 0, 0, 配置.宽, 配置.高);
    const 背板 = 场景.add.graphics();
    绘制外观标题牌底板(背板, 0, 0, 配置.宽, 配置.高, 配置.面板色, 配置.强调色);
    this.add(背板);

    const 字号 = 标题.length > 6 ? "11px" : "14px";
    if (配置.英文) {
      // 英文整句旋转 -90°；文字项暂不支持旋转，保留 Phaser 原生文字。
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
      for (const 项 of 生成外观标题牌文字项(标题, false, 0, 0, 配置.文字色))
        添加霓虹文字项(场景, this, 项);
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

/** 设置页的样式/背景外观卡：缩略预览与标签由 `外观卡配方.ts` 绘制，命中仍用整卡矩形。 */
export class 外观选择卡片 extends 界面控件 {
  private readonly 底板: Phaser.GameObjects.Rectangle;
  private readonly 预览: Phaser.GameObjects.Graphics;
  private readonly 标签: Phaser.GameObjects.Text;

  constructor(场景: Phaser.Scene, 配置: 外观卡配置) {
    super(场景, 0, 0, 配置.宽, 配置.高);
    this.name = 配置.名称;
    const 边色 = 配置.已选 ? 配置.强调色 : 0x718092;
    const 数据 = 转外观卡数据(配置);
    this.底板 = 场景.add
      .rectangle(0, 0, 配置.宽, 配置.高, 配置.面板色, 1)
      .setName(配置.名称)
      .setStrokeStyle(配置.已选 ? 2 : 1, 边色, 配置.已选 ? 1 : 0.42);
    this.预览 = 场景.add.graphics();
    const 画了 = 绘制外观卡预览(
      this.预览,
      { 中心X: 0, 中心Y: 0, 宽: 配置.宽, 高: 配置.高 },
      数据,
      (绘图, 左, 上, 格, 方案, 类型) =>
        绘制方块单元预制体(绘图, 左, 上, {
          格子: 格,
          方案,
          色值: 解析方块外观(方案).颜色[类型],
        }),
    );
    if (!画了 && 配置.背景值) {
      const 矩形 = 外观卡预览矩形({ 中心X: 0, 中心Y: 0, 宽: 配置.宽, 高: 配置.高 }, 数据);
      // 缩略图烘焙成恰好卡片大小的纹理：无需裁剪区域，设置页滚动时也不再逐帧绘制风景
      添加风景缩略(场景, this, 矩形.左, 矩形.上, 矩形.宽, 矩形.高, 配置.背景值);
    }
    this.标签 = 添加霓虹文字项(
      场景,
      undefined,
      生成外观卡文字项({ 中心X: 0, 中心Y: 0, 宽: 配置.宽, 高: 配置.高 }, 数据),
    );
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
  const 卡宽 = 外观卡列表常量.卡宽,
    卡高 = 外观卡列表常量.卡高,
    间距 = 外观卡列表常量.间距,
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
      new 外观选择卡片(场景, { ...配置, 宽: 卡宽, 高: 卡高 }).setPosition(
        卡宽 / 2 + i * (卡宽 + 间距),
        82,
      ),
    );
  });
  // 重建（例如点选卡片后）保持用户滑到的位置；只有选中项不在视野内时才最小幅度滚入，
  // 不再每次把选中项顶到最右侧。
  const 选中 = 卡片.findIndex((项) => 项.已选);
  let 位置 = 列表滚动记忆.get(名称) ?? 0;
  if (选中 >= 0) {
    const 左 = 选中 * (卡宽 + 间距),
      右 = 左 + 卡宽;
    if (左 < 位置) 位置 = 左;
    else if (右 > 位置 + 可视宽) 位置 = 右 - 可视宽;
  }
  列表.设置滚动位置(位置);
  列表.once("destroy", () => 列表滚动记忆.set(名称, 列表.获取滚动位置()));
}

const 列表滚动记忆 = new Map<string, number>();
