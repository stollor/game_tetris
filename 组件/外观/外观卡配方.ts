import { 像素规范 } from "../../代码/主题/像素/像素规范";
import { 是像素风格 } from "../../代码/主题/像素/像素风格";
import { 像素图标 } from "../../代码/主题/像素/界面像素规格";
import { type 方块外观名称, 解析方块外观 } from "../../代码/主题/外观/方块外观";
import { 派生霓虹文字样式 } from "../../代码/主题/文字/文字样式";
import type { 地点名称 } from "../../代码/框架配置/旅行地点";
import type { 背景主题 } from "../../代码/设置/游戏设置";
import type { 图形对象, 文字项, 矩形 } from "../../框架/界面/绘制/协议";
import type { 样式选择 } from "../../框架/设置/设置";
import { 绘制像素图案, 绘制像素面板 } from "../基础/像素绘制";

/**
 * 外观卡/外观标题牌的引擎无关配方：从 `组件/霓虹街机/外观卡.ts` 的 Phaser 现类抽出的
 * 尺寸、底板、缩略预览与文字样式。设置页与商店的样式卡共用；方块缩略图由调用方提供
 * 引擎侧的方块单元绘制回调，避免把方块质感复制成两份。
 */

export const 外观卡列表常量 = {
  卡宽: 96,
  卡高: 100,
  间距: 8,
  列表高: 122,
  标题上: 8,
  列表上: 32,
  卡中心Y: 82,
} as const;

export interface 外观卡布局 {
  中心X: number;
  中心Y: number;
  宽: number;
  高: number;
}

export interface 外观卡数据 {
  标签: string;
  面板色: number;
  背景色: number;
  强调色: number;
  类型: "样式" | "背景" | "方块";
  方块方案?: 方块外观名称;
  背景值?: 背景主题;
  样式值?: 样式选择 | 地点名称;
  已选: boolean;
}

export interface 外观卡状态 {
  悬停?: boolean;
}

/** 单色相对亮度（sRGB 线性化，与框架 计算颜色对比度 同公式）。 */
function 相对亮度(色值: number): number {
  const 通道 = [16, 8, 0].map((位移) => {
    const sRGB = ((色值 >> 位移) & 0xff) / 255;
    return sRGB <= 0.04045 ? sRGB / 12.92 : ((sRGB + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * (通道[0] ?? 0) + 0.7152 * (通道[1] ?? 0) + 0.0722 * (通道[2] ?? 0);
}

function 对比度(甲: number, 乙: number): number {
  const 亮度甲 = 相对亮度(甲),
    亮度乙 = 相对亮度(乙);
  const 亮 = Math.max(亮度甲, 亮度乙),
    暗 = Math.min(亮度甲, 亮度乙);
  return (亮 + 0.05) / (暗 + 0.05);
}

/** 与框架 `选取对比文字色` 同算法：在 #161616/#ffffff 两个候选中取对比更高的一侧。 */
function 对比文字色(底色: number): string {
  const 候选 = [
    { 色值: 0x161616, 文本: "#161616" },
    { 色值: 0xffffff, 文本: "#ffffff" },
  ];
  let 最佳 = 候选[0]?.文本 ?? "#161616";
  let 最高 = -1;
  for (const 项 of 候选) {
    const 对比 = 对比度(项.色值, 底色);
    if (对比 > 最高) {
      最高 = 对比;
      最佳 = 项.文本;
    }
  }
  return 最佳;
}

/** 卡片预览区（绝对坐标，左上角）：背景卡与其它卡的底部留白不同。 */
export function 外观卡预览矩形(布局: 外观卡布局, 数据: 外观卡数据): 矩形 {
  const 预览宽 = 布局.宽 - 12;
  const 预览高 = 数据.类型 === "背景" ? 布局.高 - 30 : 布局.高 - 31;
  return {
    左: 布局.中心X - 预览宽 / 2,
    上: 布局.中心Y - 布局.高 / 2 + 5,
    宽: 预览宽,
    高: 预览高,
  };
}

/** 卡片外框：普通 1px 冷灰边；已选/悬停用强调色。Three 侧自绘用；Phaser 仍用 Rectangle 底板。 */
export function 绘制外观卡边框(
  绘图: 图形对象,
  布局: 外观卡布局,
  数据: 外观卡数据,
  状态: 外观卡状态 = {},
): void {
  if (是像素风格()) {
    绘制像素面板(
      绘图,
      布局.中心X - 布局.宽 / 2,
      布局.中心Y - 布局.高 / 2,
      布局.宽,
      布局.高,
      数据.面板色,
      数据.已选 || 状态.悬停 ? 数据.强调色 : 像素规范.色.暗纸,
    );
    return;
  }
  const x = 布局.中心X - 布局.宽 / 2;
  const y = 布局.中心Y - 布局.高 / 2;
  const 边色 = 数据.已选 || 状态.悬停 ? 数据.强调色 : 0x718092;
  绘图.fillStyle(数据.面板色, 1).fillRect(x, y, 布局.宽, 布局.高);
  绘图.lineStyle(数据.已选 ? 2 : 1, 边色, 数据.已选 ? 1 : 0.42).strokeRect(x, y, 布局.宽, 布局.高);
}

/** 方块缩略图回调：布局由配方算好，方块质感由引擎侧现成绘制器画（Phaser/Three 各一份）。 */
export type 方块缩略绘制 = (
  绘图: 图形对象,
  左: number,
  上: number,
  格: number,
  方案: 方块外观名称,
  类型: "I" | "T" | "L" | "O",
) => void;

/**
 * 卡内缩略预览。背景卡返回 false（调用方用真背景烘焙/纯配方背景填充，避免配方依赖图像管线）。
 * 样式/方块卡按 Phaser 现算法绘制；方块卡把四格位置交给调用方的方块单元绘制器。
 */
export function 绘制外观卡预览(
  绘图: 图形对象,
  布局: 外观卡布局,
  数据: 外观卡数据,
  绘制方块?: 方块缩略绘制,
): boolean {
  const 矩形 = 外观卡预览矩形(布局, 数据);
  const x = 矩形.左;
  const y = 矩形.上;
  const 预览宽 = 矩形.宽;
  const 预览高 = 矩形.高;
  if (数据.类型 === "背景" && 数据.背景值) return false;
  if (是像素风格() && 数据.类型 !== "方块") {
    绘图.fillStyle(数据.背景色).fillRect(x, y, 预览宽, 预览高);
    const 图案 = 数据.类型 === "背景" ? 像素图标.风景 : 像素图标.方块;
    const 格 = Math.max(1, Math.floor(Math.min(预览宽, 预览高) / (图案.length + 2)));
    绘制像素图案(
      绘图,
      图案,
      x + (预览宽 - 格 * 图案.length) / 2,
      y + (预览高 - 格 * 图案.length) / 2,
      格,
      数据.强调色,
    );
    return true;
  }
  if (数据.类型 === "背景") {
    // 没有具体风景值时的程序化占位缩略（与 Phaser 现类的同一条后备绘制）。
    绘图
      .fillGradientStyle(数据.背景色, 数据.背景色, 数据.强调色, 数据.强调色, 1, 1, 0.8, 0.8)
      .fillRoundedRect(x, y, 预览宽, 预览高, 5);
    绘图
      .fillStyle(0xffedbd, 0.92)
      .fillCircle(x + 预览宽 * 0.74, y + 9, Math.max(3, Math.min(6, 预览高 * 0.13)));
    绘图.fillStyle(数据.强调色, 0.9).fillTriangle(x, y + 30, x + 18, y + 13, x + 38, y + 30);
    绘图.fillStyle(数据.背景色, 0.72).fillTriangle(x + 21, y + 30, x + 43, y + 12, x + 66, y + 30);
    绘图.fillStyle(0xffffff, 0.25).fillRect(x + 3, y + 32, Math.max(1, 预览宽 - 6), 1);
    return true;
  }
  if (数据.类型 === "方块") {
    是像素风格()
      ? 绘图.fillStyle(数据.背景色).fillRect(x, y, 预览宽, 预览高)
      : 绘图.fillStyle(数据.背景色).fillRoundedRect(x, y, 预览宽, 预览高, 5);
    const 方案 = 解析方块外观(数据.方块方案);
    const 格 = Math.min(16, (预览宽 - 12) / 4, (预览高 - 6) / 2);
    const 类型列表 = ["I", "T", "L", "O"] as const;
    for (const [i, 类型] of 类型列表.entries()) {
      const 块左 = x + 预览宽 / 2 - 格 * 2 + i * 格;
      const 块上 = y + (预览高 - 格) / 2;
      if (绘制方块) 绘制方块(绘图, 块左, 块上, 格, 方案.名称, 类型);
      else {
        绘图.fillStyle(方案.颜色[类型]).fillRoundedRect(块左, 块上, 格, 格, Math.max(1, 格 * 0.18));
      }
    }
    return true;
  }
  // 样式卡：主题缩略（网格/边框 + 四格 + 底部强调线）
  是像素风格()
    ? 绘图.fillStyle(数据.背景色).fillRect(x, y, 预览宽, 预览高)
    : 绘图.fillStyle(数据.背景色).fillRoundedRect(x, y, 预览宽, 预览高, 5);
  const 古典 = 数据.样式值 === "暖纸古典";
  const 未来 = 数据.样式值 === "极光原野";
  绘图.lineStyle(1, 数据.强调色, 古典 ? 0.55 : 0.22);
  if (未来) {
    for (let gx = x + 6; gx < x + 预览宽; gx += 12) 绘图.lineBetween(gx, y + 3, gx, y + 预览高 - 3);
    for (let gy = y + 6; gy < y + 预览高; gy += 12) 绘图.lineBetween(x + 3, gy, x + 预览宽 - 3, gy);
  } else {
    绘图.strokeRect(x + 4, y + 4, 预览宽 - 8, 预览高 - 8);
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
    绘图.fillStyle(数据.强调色).fillRoundedRect(块x, 块y, 格 - 2, 格 - 2, 古典 ? 1 : 2);
    绘图.fillStyle(0xffffff, 0.55).fillRect(块x + 1, 块y + 1, 格 - 4, 1);
  }
  绘图.fillStyle(数据.强调色, 0.75).fillRect(x + 8, y + 预览高 - 10, 预览宽 - 16, 2);
  return true;
}

/** 卡片标签文字项：字号随卡宽收窄，颜色取卡片面板色上的对比色。 */
export function 生成外观卡文字项(布局: 外观卡布局, 数据: 外观卡数据): 文字项 {
  return {
    文案: 数据.标签,
    样式: 派生霓虹文字样式("次要", {
      字号: 布局.宽 < 88 ? 9 : 11,
      颜色: 对比文字色(数据.面板色),
      对齐: "中",
    }),
    锚点: "中中",
    x: 布局.中心X,
    y: 布局.中心Y + 布局.高 / 2 - 12,
    最大宽: 布局.宽 - 6,
  };
}

/** 外观标题牌背板（竖排标题左侧的小牌）。 */
export function 绘制外观标题牌底板(
  绘图: 图形对象,
  中心X: number,
  中心Y: number,
  宽: number,
  高: number,
  面板色: number,
  强调色: number,
): void {
  if (是像素风格()) {
    绘制像素面板(绘图, 中心X - 宽 / 2, 中心Y - 高 / 2, 宽, 高, 面板色, 强调色);
    return;
  }
  const x = 中心X - 宽 / 2;
  const y = 中心Y - 高 / 2;
  绘图
    .fillStyle(面板色, 0.32)
    .fillRoundedRect(x + 4, y + 8, 宽 - 8, 高 - 16, 6)
    .lineStyle(1, 强调色, 0.45)
    .strokeRoundedRect(x + 4, y + 8, 宽 - 8, 高 - 16, 6);
}

/**
 * 中文外观标题牌的文字项（逐字竖排）。英文标题牌在 Phaser 里是整句旋转 -90°，
 * 文字项暂不支持旋转，调用方对英文改用横向标题；返回空数组表示交给调用方处理。
 */
export function 生成外观标题牌文字项(
  标题: string,
  英文: boolean,
  中心X: number,
  中心Y: number,
  文字色: string,
): 文字项[] {
  if (英文) return [];
  const 字号 = 标题.length > 6 ? 11 : 14;
  const 行高 = 17;
  const 字符 = [...标题];
  return 字符.map((字, 索引) => ({
    文案: 字,
    样式: 派生霓虹文字样式("正文", {
      字号,
      字重: "粗体",
      颜色: 文字色,
      对齐: "中",
    }),
    锚点: "中中",
    x: 中心X,
    y: 中心Y + (索引 - (字符.length - 1) / 2) * 行高,
  }));
}
