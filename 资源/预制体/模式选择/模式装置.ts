import {
  type 图形对象,
  type 文字项,
  混合模式,
  解析颜色数值,
} from "../../../.gamemaker/依赖/框架/界面/绘制/协议";
import { 亮色, 暗色 } from "../../../.gamemaker/依赖/框架/界面/颜色工具";
import type { 游戏模式 } from "../../../代码/玩法/再消一行";
import { 像素规范 } from "../../主题/像素/像素规范";
import { 是像素风格 } from "../../主题/像素/像素风格";
import { 方块外观方案表 } from "../../主题/外观/方块外观";
import { 游戏模式顺序 } from "../../主题/外观/游戏外观";
import { 派生霓虹文字样式 } from "../../主题/文字/文字样式";
import { 模式主题色 } from "../../主题/配色/模式配色";
import { 读取霓虹调色板 } from "../../主题/配色/调色板";
import { 绘制像素面板 } from "../基础/面板/像素面板";
import { 绘制方块单元, 绘制方块单元辉光 } from "../对局/方块单元";

/**
 * 模式选择上的程序化小装置：各模式卡左侧的关卡图形，和各页共用的返回厚按键。
 * 只画少量宝石方块和一块有厚度的底板。模式卡点击后下沉再点亮；返回键按下即沉，页面自己决定何时离开。
 * 不读存档或设置；方块固定用默认宝石质感，避免菜单跟着像素皮肤变成另一套界面。
 */

const 宝石方案 = 方块外观方案表[0];

export interface 装置区域 {
  中心X: number;
  中心Y: number;
  宽: number;
  高: number;
}

interface 格位 {
  列: number;
  行: number;
}

const 图案表: Record<游戏模式, { 列数: number; 行数: number; 格: readonly 格位[] }> = {
  马拉松: {
    列数: 4,
    行数: 4,
    格: [
      { 列: 0, 行: 3 },
      { 列: 1, 行: 2 },
      { 列: 2, 行: 1 },
      { 列: 3, 行: 0 },
    ],
  },
  冲刺: {
    列数: 4,
    行数: 2,
    格: [
      { 列: 0, 行: 1 },
      { 列: 1, 行: 1 },
      { 列: 2, 行: 1 },
      { 列: 3, 行: 0 },
    ],
  },
  极限: {
    列数: 3,
    行数: 3,
    格: [
      { 列: 0, 行: 0 },
      { 列: 2, 行: 0 },
      { 列: 0, 行: 2 },
      { 列: 2, 行: 2 },
    ],
  },
  每日挑战: {
    列数: 2,
    行数: 2,
    格: [
      { 列: 0, 行: 0 },
      { 列: 1, 行: 0 },
      { 列: 0, 行: 1 },
      { 列: 1, 行: 1 },
    ],
  },
};

/** 返回传送：先下沉，再从左到右点亮四颗方块，停一拍后才算完成。 */
export const 返回传送时长 = 0.66;

export interface 传送姿态 {
  /** 0 静止，1 完全沉下。 */
  下沉: number;
  点亮: readonly number[];
  完成: boolean;
}

export function 计算返回传送姿态(秒: number): 传送姿态 {
  const t = Math.max(0, 秒);
  const 下沉 = Math.min(1, t / 0.14);
  const 点亮 = [0, 1, 2, 3].map((序号) => {
    const 起 = 0.14 + 序号 * 0.1;
    return Math.min(1, Math.max(0, (t - 起) / 0.08));
  });
  return { 下沉, 点亮, 完成: t >= 返回传送时长 };
}

/** 模式卡启动比返回短：下沉后图案逐颗点亮，随即进入对局。 */
export const 模式启动时长 = 0.28;

export function 计算模式启动姿态(秒: number): 传送姿态 {
  const t = Math.max(0, 秒);
  const 下沉 = Math.min(1, t / 0.08);
  const 点亮 = [0, 1, 2, 3].map((序号) => {
    const 起 = 0.04 + 序号 * 0.045;
    return Math.min(1, Math.max(0, (t - 起) / 0.05));
  });
  return { 下沉, 点亮, 完成: t >= 模式启动时长 };
}

/** 标题下方的小方块，一色对应一个模式，标明这是方块游戏而不是功能列表。 */
export function 绘制模式标题饰(绘图: 图形对象, 中心X: number, y: number, 时间秒: number): void {
  if (!宝石方案) return;
  const 色 = 游戏模式顺序.map((模式) => 模式主题色(模式));
  const 格 = 9;
  const 间隙 = 6;
  const 总宽 = 色.length * 格 + (色.length - 1) * 间隙;
  if (是像素风格()) {
    游戏模式顺序.forEach((模式, i) => {
      绘图
        .fillStyle(像素规范.模式[模式])
        .fillRect(Math.round(中心X - 总宽 / 2 + i * (格 + 间隙)), Math.round(y), 格, 格);
    });
    return;
  }
  for (let i = 0; i < 色.length; i++) {
    const 浮 = Math.sin(时间秒 * 1.7 + i * 0.7) * 1.6;
    绘制方块单元(绘图, 中心X - 总宽 / 2 + i * (格 + 间隙), y + 浮, {
      方案: 宝石方案,
      色值: 色[i] ?? 0xffffff,
      格子: 格,
    });
  }
}

export interface 模式插座 {
  左: number;
  上: number;
  宽: number;
  高: number;
}

/** 卡左侧的装置槽。文字从槽的右边起排，避免叠到图案上。 */
export function 计算模式插座(布局: 装置区域): 模式插座 {
  const 高 = Math.min(布局.高 - 16, 78);
  const 宽 = Math.min(72, Math.max(48, 布局.高 * 0.74));
  return {
    左: 布局.中心X - 布局.宽 / 2 + 10,
    上: 布局.中心Y - 高 / 2,
    宽,
    高,
  };
}

function 绘制一格(
  绘图: 图形对象,
  x: number,
  y: number,
  格: number,
  色值: number,
  亮度: number,
): void {
  if (!宝石方案) return;
  if (是像素风格()) {
    绘图.fillStyle(像素规范.色.墨).fillRect(Math.round(x), Math.round(y), 格, 格);
    绘图
      .fillStyle(亮度 > 0.5 ? 像素规范.色.墨 : 像素规范.色.暗)
      .fillRect(Math.round(x + 2), Math.round(y + 2), Math.max(0, 格 - 4), Math.max(0, 格 - 4));
    return;
  }
  if (亮度 > 0.08) {
    绘图.save();
    绘图.setBlendMode(混合模式.叠加);
    绘制方块单元辉光(绘图, x, y, {
      方案: 宝石方案,
      色值,
      格子: 格,
      透明度: 0.35 + 亮度 * 0.65,
    });
    绘图.restore();
  }
  绘制方块单元(绘图, x, y, { 方案: 宝石方案, 色值, 格子: 格 });
}

/** 悬浮影留在原位，装置下沉时影子收窄，看起来是落到山前而不是贴在背景上。 */
export function 绘制悬浮影(
  绘图: 图形对象,
  中心X: number,
  底边: number,
  宽: number,
  下沉: number,
): void {
  if (是像素风格()) return;
  const 收 = Math.min(1, Math.max(0, 下沉) / 6);
  绘图
    .fillStyle(0x050912, 0.26 + 收 * 0.1)
    .fillEllipse(中心X, 底边 + 7 - 收 * 2, 宽 * (0.76 - 收 * 0.1), Math.max(4, 11 - 收 * 4));
}

export function 绘制模式图案(
  绘图: 图形对象,
  座: 模式插座,
  模式: 游戏模式,
  色值: number,
  时间秒: number,
  点亮: readonly number[],
): void {
  if (是像素风格()) {
    const 规格 = 图案表[模式];
    const 格 = Math.floor(Math.min((座.宽 - 12) / 规格.列数, (座.高 - 12) / 规格.行数));
    const x = 座.左 + (座.宽 - 规格.列数 * 格) / 2,
      y = 座.上 + (座.高 - 规格.行数 * 格) / 2;
    for (const [i, 位] of 规格.格.entries())
      绘制一格(绘图, x + 位.列 * 格, y + 位.行 * 格, 格 - 1, 色值, 点亮[i] ?? 0);
    return;
  }
  if (模式 === "冲刺") {
    绘制冲刺图案(绘图, 座, 色值, 时间秒, 点亮);
    return;
  }
  const 规格 = 图案表[模式];
  const 内边 = 7;
  const 间隙 = 2;
  const 可用宽 = 座.宽 - 内边 * 2;
  const 可用高 = 座.高 - 内边 * 2;
  const 格 = Math.max(
    7,
    Math.floor(
      Math.min(
        (可用宽 - 间隙 * (规格.列数 - 1)) / 规格.列数,
        (可用高 - 间隙 * (规格.行数 - 1)) / 规格.行数,
      ),
    ),
  );
  const 总宽 = 规格.列数 * 格 + (规格.列数 - 1) * 间隙;
  const 总高 = 规格.行数 * 格 + (规格.行数 - 1) * 间隙;
  const 原点X = 座.左 + (座.宽 - 总宽) / 2;
  const 原点Y = 座.上 + (座.高 - 总高) / 2;
  const 中心X = 座.左 + 座.宽 / 2;
  const 中心Y = 座.上 + 座.高 / 2;
  if (模式 === "极限") {
    const 转 = (时间秒 * 1.6) % (Math.PI * 2);
    绘图.lineStyle(1.4, 色值, 0.72);
    绘图.beginPath();
    绘图.arc(中心X, 中心Y, 格 * 0.48, 转, 转 + Math.PI * 1.35, false);
    绘图.strokePath();
    绘图.beginPath();
  }
  if (模式 === "每日挑战") {
    绘图.lineStyle(1.2, 色值, 0.4).strokeCircle(中心X, 中心Y, 总宽 * 0.46);
  }
  const 锁定 = 点亮.reduce((最大, 值) => Math.max(最大, 值), 0);
  规格.格.forEach((格位, 序号) => {
    const 浮 = Math.sin(时间秒 * 2.15 + 序号 * 0.85 + 座.上 * 0.01) * 1.7 * (1 - 锁定 * 0.8);
    const x = 原点X + 格位.列 * (格 + 间隙);
    const y = 原点Y + 格位.行 * (格 + 间隙) + 浮;
    绘制一格(绘图, x, y, 格, 色值, 点亮[序号] ?? 0);
  });
}

/** 冲刺是一排横过去的方块，最前面的一颗抬起，上方有两道会跑的速度线。 */
function 绘制冲刺图案(
  绘图: 图形对象,
  座: 模式插座,
  色值: number,
  时间秒: number,
  点亮: readonly number[],
): void {
  const 间隙 = 2;
  const 格 = Math.max(8, Math.floor((座.宽 - 12 - 间隙 * 3) / 4));
  const 总宽 = 4 * 格 + 间隙 * 3;
  const x0 = 座.左 + (座.宽 - 总宽) / 2;
  const y0 = 座.上 + (座.高 - 格) / 2 + 2;
  const 锁定 = 点亮.reduce((最大, 值) => Math.max(最大, 值), 0);
  const 脉 = 0.35 + 0.3 * (0.5 + 0.5 * Math.sin(时间秒 * 7));
  const 漂 = (时间秒 * 18) % (格 + 4);
  const 线Y = y0 - 6;
  绘图.lineStyle(1.6, 色值, 脉).lineBetween(x0 + 漂, 线Y, x0 + 漂 + 格 * 0.7, 线Y);
  绘图
    .lineStyle(1.6, 色值, 脉 * 0.55)
    .lineBetween(x0 + 4 + 漂, 线Y - 4, x0 + 4 + 漂 + 格 * 0.55, 线Y - 4);
  for (let i = 0; i < 4; i++) {
    const 浮 = Math.sin(时间秒 * 2.15 + i * 0.85) * 1.7 * (1 - 锁定 * 0.8);
    const 抬 = i === 3 ? -格 * 0.42 : 0;
    绘制一格(绘图, x0 + i * (格 + 间隙), y0 + 抬 + 浮, 格, 色值, 点亮[i] ?? 0);
  }
}

export function 绘制模式插座(
  绘图: 图形对象,
  布局: 装置区域,
  模式: 游戏模式,
  色值: number,
  时间秒: number,
  点亮: readonly number[],
): 模式插座 {
  const 座 = 计算模式插座(布局);
  if (是像素风格()) {
    绘图.fillStyle(像素规范.色.墨).fillRect(座.左, 座.上, 座.宽, 座.高);
    绘制模式图案(绘图, 座, 模式, 色值, 时间秒, 点亮);
    return 座;
  }
  绘图.fillStyle(0x07101c, 0.55).fillRoundedRect(座.左, 座.上, 座.宽, 座.高, 8);
  绘图.lineStyle(1.5, 色值, 0.8).strokeRoundedRect(座.左, 座.上, 座.宽, 座.高, 8);
  绘制模式图案(绘图, 座, 模式, 色值, 时间秒, 点亮);
  return 座;
}

/** 卡片厚度：比面板略低、略偏右，面板盖住之后只露出底边和右侧。 */
export function 绘制卡片厚度(绘图: 图形对象, 布局: 装置区域): void {
  if (是像素风格()) return;
  const 面 = 解析颜色数值(读取霓虹调色板().次要按钮.面板);
  const x = 布局.中心X - 布局.宽 / 2;
  const y = 布局.中心Y - 布局.高 / 2;
  const 圆角 = Math.min(12, 布局.高 * 0.28, 布局.宽 / 2);
  绘图.fillStyle(暗色(面, 0.28), 1).fillRoundedRect(x + 4, y + 8, 布局.宽 - 1, 布局.高, 圆角);
}

export interface 返回装置姿态 {
  时间秒: number;
  /** 0..1，按下时走到 1，整块下沉。 */
  下沉: number;
  点亮: readonly number[];
  文案?: string;
}

const 传送下沉像素 = 5;
const 返回方块色 = 0x8fdff0;

interface 返回装置几何 {
  左: number;
  台宽: number;
  面顶: number;
  面高: number;
  格: number;
  左块: number;
  右块: number;
  块顶: number;
  文字X: number;
  文字Y: number;
}

function 估算文案宽(文案: string, 字号: number): number {
  let 宽 = 0;
  for (const 字 of 文案) 宽 += 字.charCodeAt(0) > 255 ? 字号 : 字号 * 0.62;
  return 宽;
}

/** 字在按键正中。短文案左右各一颗方块；长文案只留厚按键，避免字和方块叠在一起。 */
function 计算返回装置几何(区域: 装置区域, 文案 = ""): 返回装置几何 {
  const 字号 = 区域.高 >= 40 ? 16 : 14;
  const 文宽 = 文案 ? 估算文案宽(文案, 字号) : 32;
  const 台宽 = Math.min(Math.max(132, 文宽 + 56), 区域.宽, 200);
  const 面高 = 区域.高 >= 48 ? 42 : Math.max(30, 区域.高 - 6);
  const 面顶 = 区域.中心Y - (面高 + 6) / 2;
  const 左 = 区域.中心X - 台宽 / 2;
  const 能放块 = 台宽 - 文宽 >= 52 && 面高 >= 32;
  const 格 = 能放块 ? Math.min(13, 面高 - 16) : 0;
  const 半距 = 文宽 / 2 + 8;
  return {
    左,
    台宽,
    面顶,
    面高,
    格,
    左块: 区域.中心X - 半距 - 格,
    右块: 区域.中心X + 半距,
    块顶: 面顶 + (面高 - 格) / 2,
    文字X: 区域.中心X,
    文字Y: 面顶 + 面高 / 2,
  };
}

/** 左上宽高矩形换成装置用的中心区域。 */
export function 由矩形得到装置区域(矩形: {
  左: number;
  上: number;
  宽: number;
  高: number;
}): 装置区域 {
  return {
    中心X: 矩形.左 + 矩形.宽 / 2,
    中心Y: 矩形.上 + 矩形.高 / 2,
    宽: 矩形.宽,
    高: 矩形.高,
  };
}

/** 返回文字在面板正面，随整块按钮下沉。下沉是 0..1。 */
export function 计算返回装置文字位置(区域: 装置区域, 下沉: number): { x: number; y: number } {
  const 几何 = 计算返回装置几何(区域);
  return { x: 几何.文字X, y: 几何.文字Y + 下沉 * 传送下沉像素 };
}

/** 各页返回共用的奶油色粗体，字号随按键高度。 */
export function 生成返回按键文字项(区域: 装置区域, 文案: string, 下沉 = 0): 文字项 {
  const 位置 = 计算返回装置文字位置(区域, 下沉);
  return {
    文案,
    样式: 派生霓虹文字样式("按钮", {
      字号: 区域.高 >= 40 ? 16 : 14,
      字重: "粗体",
      颜色: "#fff8e7",
    }),
    锚点: "中中",
    x: 位置.x,
    y: 位置.y,
  };
}

/**
 * 返回是一块居中的厚按键：底边探出形成厚度，左右方块和文字在同一面上。
 * 影子留在落点，整块下沉后间隙变小。
 */
export function 绘制返回传送装置(绘图: 图形对象, 区域: 装置区域, 姿态: 返回装置姿态): void {
  const 几何 = 计算返回装置几何(区域, 姿态.文案);
  const 沉 = 姿态.下沉 * 传送下沉像素;
  if (是像素风格()) {
    绘制像素面板(绘图, 几何.左, 几何.面顶 + 沉, 几何.台宽, 几何.面高, 像素规范.色.纸);
    return;
  }
  const 面色 = 解析颜色数值(读取霓虹调色板().次要按钮.面板);
  const 圆角 = 11;
  const 点亮 = 姿态.点亮;
  绘制悬浮影(绘图, 区域.中心X, 几何.面顶 + 几何.面高 + 8, 几何.台宽 * 0.86, 沉);
  绘图.save();
  绘图.translateCanvas(0, 沉);
  绘图
    .fillStyle(暗色(面色, 0.55), 1)
    .fillRoundedRect(几何.左 + 3, 几何.面顶 + 7, 几何.台宽 - 3, 几何.面高, 圆角);
  绘图
    .fillStyle(亮色(面色, 0.08), 0.98)
    .fillRoundedRect(几何.左, 几何.面顶, 几何.台宽, 几何.面高, 圆角);
  绘图.fillStyle(0xffffff, 0.16).fillRect(几何.左 + 18, 几何.面顶 + 2, 几何.台宽 - 36, 2);
  const 边亮 = 0.4 + (点亮[1] ?? 0) * 0.25 + (点亮[3] ?? 0) * 0.35;
  绘图
    .lineStyle(1.5, 返回方块色, 边亮)
    .strokeRoundedRect(几何.左, 几何.面顶, 几何.台宽, 几何.面高, 圆角);
  if (几何.格 > 0) {
    const 位置 = [几何.左块, 几何.右块];
    for (let i = 0; i < 位置.length; i++) {
      const 序号 = i === 0 ? 0 : 2;
      const 浮 = Math.sin(姿态.时间秒 * 1.8 + i * 1.2) * 0.8 * (1 - 姿态.下沉);
      const x = 位置[i] ?? 0;
      const y = 几何.块顶 + 浮;
      绘图.save();
      绘图.translateCanvas(x + 几何.格 / 2, y + 几何.格 / 2);
      绘图.rotateCanvas(Math.PI / 4);
      绘制一格(绘图, -几何.格 / 2, -几何.格 / 2, 几何.格, 返回方块色, 点亮[序号] ?? 0);
      绘图.restore();
    }
  }
  绘图.restore();
}
