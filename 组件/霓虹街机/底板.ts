import type { 玻璃按钮选项, 玻璃面板选项 } from "Phaser框架/界面/玻璃绘制";
import type Phaser from "phaser";
import { 查找地点 } from "../../代码/框架配置/旅行地点";
import type { 图形对象 } from "../绘制/图形对象";
import { 绘制地点纹样 } from "./旅行纹样";
import { 读取霓虹调色板 } from "./调色板";

/**
 * 引擎无关玻璃绘制配方：逐字复刻 GM `游戏模块库/Phaser框架/界面/玻璃绘制.ts`
 * 的玻璃面板/柔影/玻璃按钮算法，只把 Phaser Graphics 换成 `组件/绘制/图形对象` 契约。
 *
 * Phaser 版（Graphics 结构兼容）与 Three 版（Three图形）共用这一份像素指令；
 * GM 侧算法若更新，这里要同步复刻，不允许只改其中一边。
 */

function 通道(色值: number): [number, number, number] {
  return [(色值 >> 16) & 0xff, (色值 >> 8) & 0xff, 色值 & 0xff];
}

function 合成(红: number, 绿: number, 蓝: number): number {
  return (
    (Math.max(0, Math.min(255, 红)) << 16) |
    (Math.max(0, Math.min(255, 绿)) << 8) |
    Math.max(0, Math.min(255, 蓝))
  );
}

function 混色(甲: number, 乙: number, 比例: number): number {
  const [甲红, 甲绿, 甲蓝] = 通道(甲);
  const [乙红, 乙绿, 乙蓝] = 通道(乙);
  const t = Math.min(1, Math.max(0, 比例));
  return 合成(
    Math.round(甲红 + (乙红 - 甲红) * t),
    Math.round(甲绿 + (乙绿 - 甲绿) * t),
    Math.round(甲蓝 + (乙蓝 - 甲蓝) * t),
  );
}

function 亮色(色值: number, 比例 = 0.3): number {
  return 混色(色值, 0xffffff, 比例);
}

function 暗色(色值: number, 比例 = 0.3): number {
  return 混色(色值, 0x000000, 比例);
}

/** 面板下方的多层柔影（与 GM 框架同算法）。 */
export function 绘制柔影(
  绘图: 图形对象,
  x: number,
  y: number,
  宽: number,
  高: number,
  圆角: number,
  强度 = 1,
): void {
  for (let 层 = 0; 层 < 3; 层 += 1) {
    绘图
      .fillStyle(0x050912, (0.17 - 层 * 0.05) * 强度)
      .fillRoundedRect(x - 层 * 2.5, y + 3 + 层 * 5, 宽 + 层 * 5, 高 + 层 * 4, 圆角 + 层 * 3);
  }
}

/** 玻璃质感面板基底（左上角定位），与 GM 框架 `绘制玻璃面板` 同算法。 */
export function 绘制玻璃面板基底(
  绘图: 图形对象,
  x: number,
  y: number,
  宽: number,
  高: number,
  选项: 玻璃面板选项 = {},
): void {
  const 圆角 = Math.max(2, Math.min(选项.圆角 ?? 16, 宽 / 2, 高 / 2));
  const 填色 = 选项.填色 ?? 0x121a2c;
  const 透明度 = 选项.透明度 ?? 0.92;
  const 边色 = 选项.边色 ?? 亮色(填色, 0.3);
  const 边透明度 = 选项.边透明度 ?? 0.5;
  if (选项.投影 !== false) 绘制柔影(绘图, x, y, 宽, 高, 圆角, 透明度);
  // 基色
  绘图.fillStyle(填色, 透明度).fillRoundedRect(x, y, 宽, 高, 圆角);
  // 明暗层沿完整圆角轮廓渐淡，避免内缩矩形留下直角色块。
  if (选项.高光 !== false && 高 > 18) {
    const 内圆角 = Math.max(1, 圆角 - 1);
    const 层高 = Math.min(高 * 0.42, 高 / 2 - 1);
    // 逐行采样圆角边界；纯色绘制同时兼容 Canvas 与 WebGL。
    for (let 行 = 0; 行 < 层高; 行 += 1) {
      const 边距 = 行 < 内圆角 ? 内圆角 - Math.sqrt(内圆角 ** 2 - (内圆角 - 行 - 0.5) ** 2) : 0;
      const 衰减 = 1 - 行 / 层高;
      const 行宽 = Math.max(0, 宽 - 2 - 边距 * 2);
      绘图
        .fillStyle(亮色(填色, 0.22), 透明度 * 0.28 * 衰减)
        .fillRect(x + 1 + 边距, y + 1 + 行, 行宽, 1);
      绘图
        .fillStyle(暗色(填色, 0.38), 透明度 * 0.22 * 衰减)
        .fillRect(x + 1 + 边距, y + 高 - 2 - 行, 行宽, 1);
    }
    绘图
      .fillStyle(亮色(填色, 0.85), 透明度 * 0.2)
      .fillRect(x + 圆角, y + 1.5, Math.max(0, 宽 - 圆角 * 2), 1.5);
  }
  // 内侧亮边 + 外侧描边
  绘图
    .lineStyle(1, 亮色(填色, 0.55), 透明度 * 0.22)
    .strokeRoundedRect(x + 1.5, y + 1.5, 宽 - 3, 高 - 3, Math.max(1, 圆角 - 1.5));
  绘图.lineStyle(1, 边色, 边透明度).strokeRoundedRect(x, y, 宽, 高, 圆角);
  if (选项.强调色 !== undefined) {
    绘图.lineStyle(1, 选项.强调色, 0.32).strokeRoundedRect(x - 1, y - 1, 宽 + 2, 高 + 2, 圆角 + 2);
    绘图.lineStyle(2, 选项.强调色, 0.12).strokeRoundedRect(x - 3, y - 3, 宽 + 6, 高 + 6, 圆角 + 4);
  }
}

/** 玻璃质感按钮底板（中心定位），与 GM 框架 `绘制玻璃按钮` 同算法。 */
export function 绘制玻璃按钮底板(
  绘图: 图形对象,
  中心X: number,
  中心Y: number,
  宽: number,
  高: number,
  选项: 玻璃按钮选项 = {},
): void {
  const 圆角 = Math.max(2, Math.min(选项.圆角 ?? Math.min(12, 高 * 0.28), 宽 / 2, 高 / 2));
  const 强调色 = 选项.强调色 ?? 0x65e6dc;
  const 填色 = 选项.选中 ? 强调色 : (选项.填色 ?? 0x16213a);
  const 透明度 = 选项.透明度 ?? 0.94;
  const x = 中心X - 宽 / 2;
  const y = 中心Y - 高 / 2;
  const 悬停 = 选项.悬停 ?? false;
  绘图.fillStyle(填色, 透明度).fillRoundedRect(x, y, 宽, 高, 圆角);
  if (悬停 && !选项.选中) {
    绘图.fillStyle(亮色(填色, 0.12), 0.5).fillRoundedRect(x + 1, y + 1, 宽 - 2, 高 - 2, 圆角 - 1);
  }
  绘图
    .lineStyle(
      1,
      选项.选中 ? 强调色 : (选项.边框色 ?? 亮色(填色, 0.5)),
      选项.边透明度 ?? (选项.选中 ? 0.9 : 悬停 ? 0.8 : 0.5),
    )
    .strokeRoundedRect(x, y, 宽, 高, 圆角);
}

/**
 * 霓虹玻璃底板：统一用当前主题的面板底色与描边，其余圆角、透明度、强调辉光由调用方指定。
 * 直接画在场景已有的 Graphics 上，避免为每块装饰单独建容器。
 */
export function 绘制霓虹玻璃(
  图形: 图形对象,
  x: number,
  y: number,
  宽: number,
  高: number,
  选项: 玻璃面板选项 = {},
): void {
  const 调色板 = 读取霓虹调色板();
  绘制玻璃面板基底(图形, x, y, 宽, 高, {
    填色: 调色板.面板底,
    边色: 调色板.面板描边,
    圆角: 调色板.样式 === "青蓝未来" ? 6 : 调色板.样式 === "暖纸古典" ? 8 : 12,
    边透明度: 0.8,
    ...选项,
  });
  const 地点 = 查找地点(调色板.样式);
  if (地点) {
    绘制地点纹样(图形, x + 8, y + 5, 18, 地点.纹样, 0.65);
    绘制地点纹样(图形, x + 宽 - 28, y + 高 - 25, 18, 地点.纹样, 0.65);
  }
  const 强调 = 选项.强调色 ?? 调色板.强调;
  const 角长 = Math.min(16, 宽 / 8, 高 / 8);
  // 角部装饰留在边缘，不侵入正文和交互区域。
  图形.lineStyle(2, 强调, 0.8);
  for (const [角x, 角y, 横, 纵] of [
    [x + 4, y + 4, 1, 1],
    [x + 宽 - 4, y + 高 - 4, -1, -1],
  ]) {
    图形.lineBetween(角x, 角y + 角长 * 纵, 角x, 角y);
    图形.lineBetween(角x, 角y, 角x + 角长 * 横, 角y);
  }
}

/** 新建一块玻璃底板并挂到容器；返回图形对象以便继续叠加装饰。 */
export function 添加霓虹面板(
  场景: Phaser.Scene,
  容器: Phaser.GameObjects.Container | undefined,
  x: number,
  y: number,
  宽: number,
  高: number,
  选项: 玻璃面板选项 = {},
): Phaser.GameObjects.Graphics {
  const 图形 = 场景.add.graphics();
  绘制霓虹玻璃(图形, x, y, 宽, 高, 选项);
  容器?.add(图形);
  return 图形;
}
