import type { 文字项 } from "../../../.gamemaker/依赖/框架/界面/绘制/协议";
import { 读取霓虹文字样式 } from "../../../资源/主题/文字/文字样式";
import type { 界面图标名称 } from "../../../资源/预制体/基础/图标/图标";

/**
 * 菜单页布局：开始游戏按钮 + 三个入口角钮 + 页面标题。
 * 几何数值逐字来自重构前的主界面布局，纯几何函数，不读设置/存档/语言。
 *
 * 坐标约定：按钮/标题给中心点（与框架按钮、文字锚点一致）。
 */

export interface 界面视口 {
  宽: number;
  高: number;
  竖屏: boolean;
  矮屏: boolean;
}

export interface 按钮区域 {
  中心X: number;
  中心Y: number;
  宽: number;
  高: number;
}

export interface 文案对 {
  中文: string;
  英文: string;
}

export interface 角钮项 {
  图标: 界面图标名称;
  文案: 文案对;
}

export interface 菜单布局 {
  视口: 界面视口;
  /** 页面标题（游戏名）。 */
  标题: { x: number; y: number };
  开始钮: 按钮区域 & { 文案: 文案对 };
  /** 左侧竖排功能入口（设置/成就/商店）。 */
  角钮: {
    中心X: number;
    宽: number;
    高: number;
    项: readonly 角钮项[];
    中心Y: readonly number[];
  };
}

export interface 菜单文字数据 {
  英文: boolean;
  游戏名称: string;
}

/** 左侧功能入口的顺序与图标（文案由页面按语言取 中文/英文）。 */
export const 角钮项列表: readonly 角钮项[] = [
  { 图标: "设置", 文案: { 中文: "设置", 英文: "SET" } },
  { 图标: "成就", 文案: { 中文: "成就", 英文: "BEST" } },
  { 图标: "商店", 文案: { 中文: "商店", 英文: "SHOP" } },
];

export function 计算界面视口(视口宽: number, 视口高: number): 界面视口 {
  return { 宽: 视口宽, 高: 视口高, 竖屏: 视口高 > 视口宽, 矮屏: 视口高 < 560 };
}

function 计算角钮(视口: 界面视口) {
  const 宽 = 视口.宽 < 420 ? 52 : 64;
  const 高 = 52;
  const 中心X = 视口.宽 < 420 ? 36 : 46;
  const 间距 = 视口.高 < 560 ? 56 : 64;
  const 起 = Math.round(视口.高 * (视口.高 < 560 ? 0.28 : 0.26));
  return {
    中心X,
    宽,
    高,
    项: 角钮项列表,
    中心Y: 角钮项列表.map((_, i) => 起 + i * 间距),
  };
}

export function 计算菜单布局(视口宽: number, 视口高: number): 菜单布局 {
  const 视口 = 计算界面视口(视口宽, 视口高);
  return {
    视口,
    标题: { x: 视口宽 / 2, y: Math.round(视口高 * (视口.竖屏 ? 0.36 : 0.32)) },
    开始钮: {
      中心X: 视口宽 / 2,
      中心Y: Math.round(视口高 * (视口.竖屏 ? 0.72 : 0.76)),
      宽: Math.min(390, 视口宽 - 48),
      高: 44,
      文案: { 中文: "开始游戏", 英文: "PLAY" },
    },
    角钮: 计算角钮(视口),
  };
}

/** 菜单页静态文字项：只有游戏标题（按钮文字走按钮配方）。 */
export function 生成菜单文字项(布局: 菜单布局, 数据: 菜单文字数据): 文字项[] {
  const 大 = 布局.视口.竖屏 && !布局.视口.矮屏;
  const 角色 = 数据.英文 ? (大 ? "英文主标题" : "英文主标题紧凑") : 大 ? "主标题" : "主标题紧凑";
  return [
    {
      文案: 数据.游戏名称,
      样式: 读取霓虹文字样式(角色),
      锚点: "中中",
      x: 布局.标题.x,
      y: 布局.标题.y,
    },
  ];
}
