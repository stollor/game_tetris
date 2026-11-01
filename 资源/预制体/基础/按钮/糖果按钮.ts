import type { 图形对象 } from "../../../../.gamemaker/依赖/框架/界面/绘制/协议";
import { 亮色, 暗色 } from "../../../../.gamemaker/依赖/框架/界面/颜色工具";
import { 糖果规范 } from "../../../主题/糖果/糖果规范";

/**
 * 糖果按钮：胶囊糖体 + 两端糖纸扭结 + 顶部糖衣高光；圆形键走马卡龙圆盘。
 *
 * 形状语言与面板同源（巧克力边、奶油裱花、软糖厚度），状态只有悬停提亮、
 * 按下下沉与选中描边三种，不改调用方的按钮语义。
 */

export interface 糖果按钮选项 {
  填色?: number;
  边框色?: number;
  强调色?: number;
  悬停?: boolean;
  按下?: boolean;
  选中?: boolean;
  透明度?: number;
  /** 圆角；缺省取胶囊（高的一半）。 */
  圆角?: number;
  /** 两端糖纸扭结；小图标键关掉更像软糖纽扣。 */
  糖纸?: boolean;
}

/** 画一颗糖果按钮（中心定位）。 */
export function 绘制糖果按钮(
  绘图: 图形对象,
  中心X: number,
  中心Y: number,
  宽: number,
  高: number,
  选项: 糖果按钮选项 = {},
): void {
  const 填色 = 选项.填色 ?? 糖果规范.色.粉;
  const 边框色 = 选项.边框色 ?? 糖果规范.色.草莓深;
  const 透明度 = 选项.透明度 ?? 1;
  const 按下 = 选项.按下 ?? false;
  const 悬停 = 选项.悬停 ?? false;
  const 下沉 = 按下 ? 糖果规范.按钮.按下下沉 : 0;
  const 顶 = 中心Y - 高 / 2 + 下沉;
  const 左 = 中心X - 宽 / 2;
  const 圆角 = Math.max(2, Math.min(选项.圆角 ?? 高 / 2, 宽 / 2, 高 / 2));
  // 底部投影：按下的键投影收短，读作「压进糖堆」。
  绘图
    .fillStyle(糖果规范.色.巧克力深, 糖果规范.阴影.透明度 * 透明度)
    .fillRoundedRect(左 + 1, 顶 + (按下 ? 1.5 : 4), 宽, 高, 圆角);
  // 巧克力外沿 + 受光边
  绘图.fillStyle(糖果规范.色.巧克力深, 透明度).fillRoundedRect(左, 顶, 宽, 高, 圆角);
  绘图
    .lineStyle(1, 亮色(糖果规范.色.巧克力深, 0.4), 0.5 * 透明度)
    .strokeRoundedRect(左 + 0.7, 顶 + 0.7, 宽 - 1.4, 高 - 1.4, 圆角);
  // 糖体：纯色打底 + 上白下黑渐变，按下时面收窄一圈更像压扁。
  const 内缩 = 2;
  const 面填 = 悬停 && !按下 ? 亮色(填色, 0.1) : 填色;
  const 面圆角 = Math.max(2, 圆角 - 内缩);
  绘图
    .fillStyle(面填, 透明度)
    .fillRoundedRect(左 + 内缩, 顶 + 内缩, 宽 - 内缩 * 2, 高 - 内缩 * 2, 面圆角);
  绘图
    .fillGradientStyle(
      0xffffff,
      0xffffff,
      0x000000,
      0x000000,
      0.22 * 透明度,
      0.16 * 透明度,
      0.12 * 透明度,
      0.04 * 透明度,
    )
    .fillRoundedRect(左 + 内缩, 顶 + 内缩, 宽 - 内缩 * 2, 高 - 内缩 * 2, 面圆角);
  // 糖纸扭结：两端各一片收口糖纸，奶油折线当扭结的棱。
  if (选项.糖纸 !== false && 宽 > 44) {
    const 糖宽 = Math.min(糖果规范.按钮.糖纸宽, 宽 * 0.14);
    const 半高 = (高 / 2) * 糖果规范.按钮.糖纸高占比;
    for (const 方向 of [-1, 1] as const) {
      const 根 = 方向 < 0 ? 左 + 1 : 左 + 宽 - 1;
      const 尖 = 根 + 方向 * 糖宽;
      绘图.fillStyle(暗色(填色, 0.22), 透明度).fillPoints(
        [
          { x: 根, y: 顶 + 高 / 2 - 半高 },
          { x: 尖, y: 顶 + 高 / 2 - 半高 * 1.06 },
          { x: 尖 - 方向 * 糖宽 * 0.2, y: 顶 + 高 / 2 },
          { x: 尖, y: 顶 + 高 / 2 + 半高 * 1.06 },
          { x: 根, y: 顶 + 高 / 2 + 半高 },
        ],
        true,
      );
      绘图
        .lineStyle(1.2, 糖果规范.色.奶油, 0.55 * 透明度)
        .lineBetween(根, 顶 + 高 / 2 - 半高 * 0.9, 尖, 顶 + 高 / 2 - 半高 * 0.95);
      绘图
        .fillStyle(亮色(填色, 0.3), 0.4 * 透明度)
        .fillEllipse(
          尖 - 方向 * 糖宽 * 0.35,
          顶 + 高 / 2 - 半高 * 0.25,
          糖宽 * 0.5,
          Math.max(1.2, 半高 * 0.3),
        );
    }
  }
  // 顶部糖衣高光
  if (高 > 16) {
    绘图
      .fillStyle(糖果规范.色.白, 糖果规范.按钮.高光透明 * 透明度)
      .fillRoundedRect(左 + 宽 * 0.14, 顶 + 3, 宽 * 0.4, Math.max(1.8, 高 * 0.16), 3);
    绘图
      .fillStyle(糖果规范.色.白, 0.22 * 透明度)
      .fillRoundedRect(左 + 宽 * 0.16, 顶 + 3 + Math.max(1.8, 高 * 0.16), 宽 * 0.3, 1.2, 1);
  }
  // 奶油内衬描边
  绘图
    .lineStyle(1.4, 糖果规范.色.糖纸, 0.5 * 透明度)
    .strokeRoundedRect(左 + 3.4, 顶 + 3.4, 宽 - 6.8, 高 - 6.8, Math.max(1, 圆角 - 3.4));
  // 状态描边
  const 边色 = 选项.强调色 ?? 边框色;
  const 边透明 = 选项.选中 ? 0.95 : 悬停 ? 0.85 : 0.65;
  绘图
    .lineStyle(选项.选中 ? 2.2 : 1.6, 边色, 边透明 * 透明度)
    .strokeRoundedRect(左, 顶, 宽, 高, 圆角);
}

/** 马卡龙圆键：外圈糖壳 + 内圈糖霜 + 中心图标位。用于旋转/暂存/方向等圆形操作键。 */
export function 绘制糖果圆键(
  绘图: 图形对象,
  中心X: number,
  中心Y: number,
  半径: number,
  填色: number,
  选项: { 悬停?: boolean; 按下?: boolean; 选中?: boolean } = {},
): void {
  const 下移 = 选项.按下 ? 1.5 : 0;
  const cy = 中心Y + 下移;
  绘图
    .fillStyle(糖果规范.色.巧克力深, 糖果规范.阴影.透明度)
    .fillCircle(中心X + 0.5, cy + 3.5, 半径);
  绘图.fillStyle(糖果规范.色.巧克力深, 1).fillCircle(中心X, cy, 半径);
  const 面 = 选项.悬停 && !选项.按下 ? 亮色(填色, 0.1) : 填色;
  绘图
    .fillGradientStyle(亮色(面, 0.22), 亮色(面, 0.22), 暗色(面, 0.18), 暗色(面, 0.18), 1, 1, 1, 1)
    .fillCircle(中心X, cy, 半径 - 2);
  绘图.fillStyle(糖果规范.色.奶油, 0.9).fillCircle(中心X, cy, 半径 * 0.72);
  绘图.fillStyle(亮色(面, 0.16), 0.72).fillCircle(中心X, cy, 半径 * 0.58);
  绘图
    .fillStyle(糖果规范.色.白, 选项.按下 ? 0.25 : 0.5)
    .fillEllipse(中心X - 半径 * 0.3, cy - 半径 * 0.42, 半径 * 0.5, 半径 * 0.28);
  绘图.lineStyle(1.4, 糖果规范.色.糖纸, 0.5).strokeCircle(中心X, cy, Math.max(1, 半径 - 4.5));
  if (选项.选中) 绘图.lineStyle(2.2, 糖果规范.色.金, 0.95).strokeCircle(中心X, cy, 半径);
}
