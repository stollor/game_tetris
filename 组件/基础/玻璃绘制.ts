import type { 图形对象 } from "../../框架/界面/绘制/协议";

/**
 * 引擎无关的玻璃质感绘制原语（柔影 / 玻璃面板 / 玻璃按钮）。
 *
 * 逐字复刻 GM `游戏模块库/Phaser框架/界面/玻璃绘制.ts` 的算法，只把 Phaser Graphics
 * 换成 `图形对象` 契约，供 Phaser 版、Three 版与预览共用同一份像素指令。
 * 本文件只依赖 `图形对象` 与纯颜色运算：不 import Phaser 运行时，Three 包可直接引用。
 * 主题/地点纹样/角饰等游戏视觉留在 `组件/基础/底板.ts`。
 */

export interface 玻璃面板选项 {
  圆角?: number;
  填色?: number;
  透明度?: number;
  边色?: number;
  边透明度?: number;
  投影?: boolean;
  高光?: boolean;
  强调色?: number;
}

export interface 玻璃按钮选项 {
  圆角?: number;
  填色?: number;
  边框色?: number;
  强调色?: number;
  选中?: boolean;
  悬停?: boolean;
  透明度?: number;
  边透明度?: number;
}

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

/**
 * 面板下方的多层柔影（与 GM 框架同算法）。
 * @共享效果 矩形底层
 */
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

/**
 * 玻璃质感面板基底（左上角定位），与 GM 框架 `绘制玻璃面板` 同算法。
 * @效果插槽 矩形底层
 */
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
