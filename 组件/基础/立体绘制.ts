import { 立体规范 } from "../../代码/主题/立体/立体规范";
import type { 图形对象, 点, 矩形 } from "../../框架/界面/绘制/协议";
import { 亮色, 暗色 } from "../../框架/界面/颜色工具";

const 面 = 立体规范.界面;

export interface 金属板选项 {
  切?: number;
  厚?: number;
  六角?: boolean;
  凹?: boolean;
  按下?: boolean;
  强调?: boolean;
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
  const 沉 = 选项.按下 ? 厚 : 0;
  const 外 = 板点(左, 上 + 沉, 宽, 高, 选项);
  const 亮面 = 板点(左, 上 + 沉, 宽, 高 - 厚, 选项);
  图
    .fillStyle(0x000000, 选项.按下 ? 0.12 : 0.38)
    .fillPoints(板点(左 + 1.5, 上 + 厚 + 3, 宽, 高, 选项), true);
  图.fillStyle(面.板暗, 1).fillPoints(外, true);
  图.fillStyle(选项.强调 ? 亮色(面.板, 0.08) : 面.板, 1).fillPoints(亮面, true);
  if (!选项.六角) {
    const 内切 = Math.max(2, (选项.切 ?? 面.切) - 2);
    const 亮高 = Math.min(高 * 0.22, 10);
    图
      .fillStyle(面.板高光, 0.16)
      .fillPoints(生成斜切点(左 + 4, 上 + 沉 + 1.2, 宽 - 8, 亮高, 内切), true);
    图
      .lineStyle(1, 面.板高光, 0.5)
      .lineBetween(左 + 内切 + 4, 上 + 沉 + 1.6, 左 + 宽 - 内切 - 4, 上 + 沉 + 1.6);
  }
  图.lineStyle(面.灯宽, 面.灯, 选项.强调 ? 0.9 : 0.58).strokePoints(亮面, true);
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

function 平移点(点集: readonly 点[], x: number, y: number): 点[] {
  return 点集.map((点) => ({ x: 点.x + x, y: 点.y + y }));
}

/** 键面可传入已有轮廓，保留左右移和软降的异形。 */
export function 绘制金属键(
  图: 图形对象,
  点集: readonly 点[],
  选项: { 按下?: boolean; 强调?: boolean; 厚?: number } = {},
): void {
  const 厚 = 选项.厚 ?? 面.键厚;
  const 沉 = 选项.按下 ? 厚 - 1 : 0;
  const 面色 = 选项.强调 ? 亮色(面.键面, 0.12) : 面.键面;
  图.fillStyle(0x000000, 0.4).fillPoints(平移点(点集, 1.5, 沉 + 厚 + 3), true);
  图.fillStyle(面.板暗, 1).fillPoints(平移点(点集, 0, 沉 + 厚), true);
  图.fillStyle(暗色(面色, 0.18), 1).fillPoints(平移点(点集, 0, 沉 + 厚 * 0.45), true);
  图.fillStyle(面色, 1).fillPoints(平移点(点集, 0, 沉), true);
  图.lineStyle(1, 面.板高光, 0.42).strokePoints(平移点(点集, 0, 沉), true);
  图
    .lineStyle(面.灯宽, 面.灯, 选项.强调 || 选项.按下 ? 0.92 : 0.7)
    .strokePoints(平移点(点集, 0, 沉), true);
}

export function 绘制立体背景(图: 图形对象, 宽: number, 高: number): void {
  图.fillStyle(面.壳).fillRect(0, 0, 宽, 高);
  图.fillStyle(面.壳面, 0.55).fillRect(面.外沿, 面.外沿, 宽 - 面.外沿 * 2, 高 - 面.外沿 * 2);
  图
    .lineStyle(面.灯宽, 面.灯, 0.28)
    .strokeRect(面.外沿, 面.外沿, 宽 - 面.外沿 * 2, 高 - 面.外沿 * 2);
}

/** 井口以外铺不透明机壳，3D 房间只从开口露出来。 */
export function 绘制立体机壳(图: 图形对象, 宽: number, 高: number, 井: 矩形): void {
  const 框 = 面.框;
  图.fillStyle(面.壳, 1).fillRect(0, 0, 宽, 井.上);
  图.fillStyle(面.壳, 1).fillRect(0, 井.上, 井.左, 井.高);
  图.fillStyle(面.壳, 1).fillRect(井.左 + 井.宽, 井.上, 宽 - 井.左 - 井.宽, 井.高);
  图.fillStyle(面.壳, 1).fillRect(0, 井.上 + 井.高, 宽, 高 - 井.上 - 井.高);
  图.fillStyle(面.板暗, 1).fillRect(井.左 - 框, 井.上 - 框, 井.宽 + 框 * 2, 框);
  图.fillStyle(面.板暗, 1).fillRect(井.左 - 框, 井.上 + 井.高, 井.宽 + 框 * 2, 框);
  图.fillStyle(面.板暗, 1).fillRect(井.左 - 框, 井.上, 框, 井.高);
  图.fillStyle(面.板暗, 1).fillRect(井.左 + 井.宽, 井.上, 框, 井.高);
  图.fillStyle(面.板, 1).fillRect(井.左 - 框 + 1, 井.上 - 框 + 1, 井.宽 + 框 * 2 - 2, 框 - 2);
  图.fillStyle(面.板, 1).fillRect(井.左 - 框 + 1, 井.上 + 井.高 + 1, 井.宽 + 框 * 2 - 2, 框 - 2);
  图.fillStyle(面.板, 1).fillRect(井.左 - 框 + 1, 井.上, 框 - 2, 井.高);
  图.fillStyle(面.板, 1).fillRect(井.左 + 井.宽 + 1, 井.上, 框 - 2, 井.高);
  图.lineStyle(2, 面.灯, 0.82).strokeRect(井.左, 井.上, 井.宽, 井.高);
  图.lineStyle(5, 面.灯芯, 0.1).strokeRect(井.左 - 2, 井.上 - 2, 井.宽 + 4, 井.高 + 4);
  图
    .lineStyle(1, 面.板高光, 0.35)
    .strokeRect(井.左 - 框, 井.上 - 框, 井.宽 + 框 * 2, 井.高 + 框 * 2);
  图
    .lineStyle(面.灯宽, 面.灯, 0.22)
    .strokeRect(面.外沿, 面.外沿, 宽 - 面.外沿 * 2, 高 - 面.外沿 * 2);
}
