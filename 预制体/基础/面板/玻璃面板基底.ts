import { 像素规范 } from "../../../主题/像素/像素规范";
import { 是像素风格 } from "../../../主题/像素/像素风格";
import { 是立体风格 } from "../../../主题/立体/立体风格";
import { 读取控件规格 } from "../../../框架/样式/控件规格";
import type { 图形对象 } from "../../../框架/界面/绘制/协议";
import { 亮色, 暗色 } from "../../../框架/界面/颜色工具";
import { 绘制柔影 } from "../../../视效/特效/柔影";
import { 绘制像素面板 } from "./像素面板";
import { 绘制金属板 } from "./金属板";

/**
 * 引擎无关的玻璃质感面板基底。
 *
 * 逐字复刻 GM `游戏模块库/Phaser框架/界面/玻璃绘制.ts` 的算法，只把 Phaser Graphics
 * 换成 `图形对象` 契约，供 Phaser 版、Three 版与预览共用同一份像素指令。
 * 只依赖 `图形对象` 与纯颜色运算：不 import Phaser 运行时，Three 包可直接引用。
 * 柔影在 `视效/特效/柔影.ts`，玻璃按钮底板在 `预制体/基础/按钮/玻璃按钮底板.ts`。
 */

export interface 玻璃面板选项 {
  圆角?: number;
  描边宽?: number;
  填色?: number;
  透明度?: number;
  边色?: number;
  边透明度?: number;
  投影?: boolean;
  高光?: boolean;
  强调色?: number;
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
  if (是像素风格()) {
    绘制像素面板(绘图, x, y, 宽, 高, 选项.填色 ?? 像素规范.色.纸, 选项.强调色 ?? 像素规范.色.暗纸);
    return;
  }
  if (是立体风格()) {
    const 规格 = 读取控件规格().面板;
    绘制金属板(绘图, x, y, 宽, 高, {
      切: 选项.圆角 ?? 规格.圆角,
      强调: 选项.强调色 !== undefined,
      透明度: 选项.透明度 ?? 规格.面板透明度,
      描边宽: 选项.描边宽 ?? 规格.描边宽,
      描边透明度: 选项.边透明度 ?? 规格.描边透明度,
    });
    return;
  }
  const 规格 = 读取控件规格().面板;
  const 圆角 = Math.max(0, Math.min(选项.圆角 ?? 规格.圆角, 宽 / 2, 高 / 2));
  const 填色 = 选项.填色 ?? 0x121a2c;
  const 透明度 = 选项.透明度 ?? 规格.面板透明度;
  const 边色 = 选项.边色 ?? 亮色(填色, 0.3);
  const 边透明度 = 选项.边透明度 ?? 规格.描边透明度;
  const 描边宽 = 选项.描边宽 ?? 规格.描边宽;
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
  if (描边宽 > 0) 绘图.lineStyle(描边宽, 边色, 边透明度).strokeRoundedRect(x, y, 宽, 高, 圆角);
  if (选项.强调色 !== undefined) {
    绘图.lineStyle(1, 选项.强调色, 0.32).strokeRoundedRect(x - 1, y - 1, 宽 + 2, 高 + 2, 圆角 + 2);
    绘图.lineStyle(2, 选项.强调色, 0.12).strokeRoundedRect(x - 3, y - 3, 宽 + 6, 高 + 6, 圆角 + 4);
  }
}
