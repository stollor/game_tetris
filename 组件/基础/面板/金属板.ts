import { 立体规范 } from "../../../主题/立体/立体规范";
import type { 图形对象, 点 } from "../../../框架/界面/绘制/协议";
import { 亮色 } from "../../../框架/界面/颜色工具";

const 面 = 立体规范.界面;

export interface 金属板选项 {
  切?: number;
  厚?: number;
  六角?: boolean;
  凹?: boolean;
  按下?: boolean;
  强调?: boolean;
  透明度?: number;
  描边宽?: number;
  描边透明度?: number;
}

/** 斜切上限到半宽/半高，才能画出效果图里的六角舱。 */
export function 生成斜切点(左: number, 上: number, 宽: number, 高: number, 切: number): 点[] {
  const 角 = Math.max(0, Math.min(切, 宽 / 2 - 0.5, 高 / 2 - 0.5));
  if (角 <= 0)
    return [
      { x: 左, y: 上 },
      { x: 左 + 宽, y: 上 },
      { x: 左 + 宽, y: 上 + 高 },
      { x: 左, y: 上 + 高 },
    ];
  return [
    { x: 左 + 角, y: 上 },
    { x: 左 + 宽 - 角, y: 上 },
    { x: 左 + 宽, y: 上 + 角 },
    { x: 左 + 宽, y: 上 + 高 - 角 },
    { x: 左 + 宽 - 角, y: 上 + 高 },
    { x: 左 + 角, y: 上 + 高 },
    { x: 左, y: 上 + 高 - 角 },
    { x: 左, y: 上 + 角 },
  ];
}

export function 生成六角点(左: number, 上: number, 宽: number, 高: number): 点[] {
  const 尖 = Math.min(高 / 2, 宽 / 2);
  return [
    { x: 左 + 尖, y: 上 },
    { x: 左 + 宽 - 尖, y: 上 },
    { x: 左 + 宽, y: 上 + 高 / 2 },
    { x: 左 + 宽 - 尖, y: 上 + 高 },
    { x: 左 + 尖, y: 上 + 高 },
    { x: 左, y: 上 + 高 / 2 },
  ];
}

function 板点(左: number, 上: number, 宽: number, 高: number, 选项: 金属板选项): 点[] {
  return 选项.六角 ? 生成六角点(左, 上, 宽, 高) : 生成斜切点(左, 上, 宽, 高, 选项.切 ?? 面.切);
}

/** 斜切金属板：底唇、受光面、顶缘高光和青色灯边。 */
export function 绘制金属板(
  图: 图形对象,
  左: number,
  上: number,
  宽: number,
  高: number,
  选项: 金属板选项 = {},
): void {
  const 厚 = 选项.厚 ?? 面.厚;
  const 透明 = 选项.透明度 ?? 1;
  const 灯宽 = 选项.描边宽 ?? 面.灯宽;
  const 边透明 = 选项.描边透明度 ?? (选项.强调 ? 0.9 : 0.58);
  const 沉 = 选项.按下 ? 厚 : 0;
  const 外 = 板点(左, 上 + 沉, 宽, 高, 选项);
  const 亮面 = 板点(左, 上 + 沉, 宽, 高 - 厚, 选项);
  图
    .fillStyle(0x000000, (选项.按下 ? 0.12 : 0.38) * 透明)
    .fillPoints(板点(左 + 1.5, 上 + 厚 + 3, 宽, 高, 选项), true);
  图.fillStyle(面.板暗, 透明).fillPoints(外, true);
  图.fillStyle(选项.强调 ? 亮色(面.板, 0.08) : 面.板, 透明).fillPoints(亮面, true);
  if (!选项.六角) {
    const 内切 = Math.max(2, (选项.切 ?? 面.切) - 2);
    const 亮高 = Math.min(高 * 0.22, 10);
    图
      .fillStyle(面.板高光, 0.16 * 透明)
      .fillPoints(生成斜切点(左 + 4, 上 + 沉 + 1.2, 宽 - 8, 亮高, 内切), true);
    图
      .lineStyle(1, 面.板高光, 0.5 * 透明)
      .lineBetween(左 + 内切 + 4, 上 + 沉 + 1.6, 左 + 宽 - 内切 - 4, 上 + 沉 + 1.6);
  }
  if (灯宽 > 0)
    图.lineStyle(灯宽, 面.灯, 选项.强调 ? Math.max(边透明, 0.9) : 边透明).strokePoints(亮面, true);
  if (选项.凹) {
    const 垫 = Math.min(面.凹垫, 宽 * 0.14, 高 * 0.18);
    const 井 = 板点(左 + 垫, 上 + 沉 + 垫, 宽 - 垫 * 2, 高 - 厚 - 垫 * 2, {
      ...选项,
      切: Math.max(2, (选项.切 ?? 面.窗切) - 2),
    });
    图.fillStyle(面.屏, 0.98).fillPoints(井, true);
    图.lineStyle(1, 面.灯, 0.22).strokePoints(井, true);
  }
}
