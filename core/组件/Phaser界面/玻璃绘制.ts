import type Phaser from "phaser";
import { 亮色, 暗色 } from "./颜色工具";

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

/**
 * 绘制玻璃质感面板（左上角定位）：外柔影、上亮下暗层次、内侧高光与可选强调辉光。
 * 全部用分层圆角矩形模拟光照，避免依赖渐变在异形图形上的行为。
 */
export function 绘制玻璃面板(
  图形: Phaser.GameObjects.Graphics,
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
  if (选项.投影 !== false) 绘制柔影(图形, x, y, 宽, 高, 圆角, 透明度);
  // 基色
  图形.fillStyle(填色, 透明度).fillRoundedRect(x, y, 宽, 高, 圆角);
  // 上亮下暗的体积层次：渐变过渡，避免水平接缝
  if (选项.高光 !== false && 高 > 18) {
    图形
      .fillGradientStyle(亮色(填色, 0.22), 亮色(填色, 0.22), 填色, 填色, 0.55, 0.55, 0, 0)
      .fillRect(x + 圆角, y + 1, Math.max(0, 宽 - 圆角 * 2), 高 * 0.42);
    图形
      .fillGradientStyle(填色, 填色, 暗色(填色, 0.38), 暗色(填色, 0.38), 0, 0, 0.45, 0.45)
      .fillRect(x + 圆角, y + 高 * 0.56, Math.max(0, 宽 - 圆角 * 2), 高 * 0.44 - 1);
    图形
      .fillStyle(亮色(填色, 0.85), 透明度 * 0.2)
      .fillRect(x + 圆角, y + 1.5, Math.max(0, 宽 - 圆角 * 2), 1.5);
  }
  // 内侧亮边 + 外侧描边
  图形
    .lineStyle(1, 亮色(填色, 0.55), 透明度 * 0.22)
    .strokeRoundedRect(x + 1.5, y + 1.5, 宽 - 3, 高 - 3, Math.max(1, 圆角 - 1.5));
  图形.lineStyle(1, 边色, 边透明度).strokeRoundedRect(x, y, 宽, 高, 圆角);
  if (选项.强调色 !== undefined) {
    图形.lineStyle(1, 选项.强调色, 0.32).strokeRoundedRect(x - 1, y - 1, 宽 + 2, 高 + 2, 圆角 + 2);
    图形.lineStyle(2, 选项.强调色, 0.12).strokeRoundedRect(x - 3, y - 3, 宽 + 6, 高 + 6, 圆角 + 4);
  }
}

/** 绘制面板下方的多层柔影。 */
export function 绘制柔影(
  图形: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  宽: number,
  高: number,
  圆角: number,
  强度 = 1,
): void {
  for (let 层 = 0; 层 < 3; 层 += 1) {
    图形
      .fillStyle(0x050912, (0.17 - 层 * 0.05) * 强度)
      .fillRoundedRect(x - 层 * 2.5, y + 3 + 层 * 5, 宽 + 层 * 5, 高 + 层 * 4, 圆角 + 层 * 3);
  }
}

export interface 玻璃按钮选项 {
  圆角?: number;
  填色?: number;
  强调色?: number;
  选中?: boolean;
  悬停?: boolean;
  透明度?: number;
  边透明度?: number;
}

/** 绘制玻璃质感按钮底板（中心定位）。 */
export function 绘制玻璃按钮(
  图形: Phaser.GameObjects.Graphics,
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
  if (选项.选中) {
    // 选中态：强调色辉光
    for (let 层 = 1; 层 <= 2; 层 += 1) {
      图形
        .lineStyle(层 * 2, 强调色, (悬停 ? 0.22 : 0.14) / 层)
        .strokeRoundedRect(x - 层 * 2, y - 层 * 2, 宽 + 层 * 4, 高 + 层 * 4, 圆角 + 层 * 2);
    }
  }
  绘制柔影(图形, x, y, 宽, 高, 圆角, 选项.选中 ? 0.9 : 0.7);
  图形.fillStyle(填色, 透明度).fillRoundedRect(x, y, 宽, 高, 圆角);
  // 顶部受光 + 底部背光（渐变过渡）
  图形
    .fillGradientStyle(
      选项.选中 ? 0xffffff : 亮色(填色, 0.32),
      选项.选中 ? 0xffffff : 亮色(填色, 0.32),
      填色,
      填色,
      选项.选中 ? 0.24 : 0.42,
      选项.选中 ? 0.24 : 0.42,
      0,
      0,
    )
    .fillRect(x + 圆角, y + 1, Math.max(0, 宽 - 圆角 * 2), 高 * 0.46);
  图形
    .fillGradientStyle(
      填色,
      填色,
      选项.选中 ? 0x000000 : 暗色(填色, 0.5),
      选项.选中 ? 0x000000 : 暗色(填色, 0.5),
      0,
      0,
      选项.选中 ? 0.13 : 0.34,
      选项.选中 ? 0.13 : 0.34,
    )
    .fillRect(x + 圆角, y + 高 * 0.52, Math.max(0, 宽 - 圆角 * 2), 高 * 0.48 - 1);
  图形
    .fillStyle(0xffffff, 选项.选中 ? 0.4 : 悬停 ? 0.22 : 0.13)
    .fillRect(x + 圆角, y + 1, Math.max(0, 宽 - 圆角 * 2), 1.5);
  图形
    .lineStyle(
      1,
      选项.选中 ? 亮色(强调色, 0.55) : 亮色(填色, 0.5),
      选项.边透明度 ?? (悬停 ? 0.85 : 0.55),
    )
    .strokeRoundedRect(x, y, 宽, 高, 圆角);
  if (悬停 && !选项.选中) {
    图形.lineStyle(1, 强调色, 0.35).strokeRoundedRect(x - 1, y - 1, 宽 + 2, 高 + 2, 圆角 + 2);
  }
}
