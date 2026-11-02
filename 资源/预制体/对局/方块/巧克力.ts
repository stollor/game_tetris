import type { 图形对象, 点 } from "../../../../.gamemaker/依赖/框架/界面/绘制/协议";
import { 斜带, 裁进凸形 } from "../../基础/装饰与蒙层/圆角裁剪";
import { 圆角块, 暗侧, type 糖果块几何 } from "./几何";

/**
 * 巧克力方块（O 型）：一块带圆角的可可糖片，左上三道奶白斜纹，正中一颗爱心压花。
 *
 * 整块糖按包围盒画成一片（不逐格），所以两块 O 叠在一起会长成一片厚巧克力，
 * 而不是两个方块；单格时收成一小块方糖，心形缩小后仍看得见。
 */

/** 心形：经典参数方程，屏幕 y 向下。 */
function 心点集(cx: number, cy: number, 宽: number): 点[] {
  const 半 = 宽 / 2;
  const 点集: 点[] = [];
  const 段 = 30;
  for (let i = 0; i <= 段; i += 1) {
    const t = (i / 段) * Math.PI * 2;
    const x = 16 * Math.sin(t) ** 3;
    const y = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
    点集.push({ x: cx + (x / 17) * 半, y: cy + (y / 17) * 半 });
  }
  return 点集;
}

export function 绘制巧克力(绘图: 图形对象, 几何: 糖果块几何): void {
  const { 格, 样式, 透明度 } = 几何;
  const 缩 = 格 * 0.05;
  const 圆角 = Math.max(2, 格 * 0.3);
  const 外形 = 圆角块(几何, 缩, 圆角);
  const 体暗 = 暗侧(样式);

  // ① 落影 + 深色包边
  绘图.fillStyle(0x1c0a08, 0.3 * 透明度);
  绘图.fillPoints(
    外形.map((p) => ({ x: p.x, y: p.y + 格 * 0.09 })),
    true,
  );
  绘图.fillStyle(样式.深色, 透明度);
  绘图.fillPoints(外形, true);

  // ② 糖面：暗侧边压在下沿，主色盖在上方，读作一片有厚度的巧克力
  const 面缩 = Math.max(0.8, 格 * 0.075);
  const 面形 = 圆角块(几何, 缩 + 面缩, Math.max(1.5, 圆角 - 面缩));
  绘图.fillStyle(体暗, 透明度);
  绘图.fillPoints(面形, true);
  const 底厚 = 格 * 0.1;
  绘图.fillStyle(样式.主色, 透明度);
  绘图.fillPoints(
    面形.map((p) => ({ x: p.x, y: 面形[0] ? p.y : p.y + 0 })),
    true,
  );
  // 下半截压暗，做出侧面厚度（纯色带，不用渐变）
  绘图.fillStyle(体暗, 0.55 * 透明度);
  绘图.fillPoints(
    [
      { x: 面形[0]?.x ?? 几何.左, y: 几何.上 + 几何.行数 * 格 - 面缩 - 底厚 },
      { x: 几何.左 + 几何.列数 * 格 - 面缩, y: 几何.上 + 几何.行数 * 格 - 面缩 - 底厚 },
      { x: 几何.左 + 几何.列数 * 格 - 面缩, y: 几何.上 + 几何.行数 * 格 - 面缩 },
      { x: 面形[0]?.x ?? 几何.左, y: 几何.上 + 几何.行数 * 格 - 面缩 },
    ],
    true,
  );

  // ③ 左上三道奶白斜纹
  绘图.fillStyle(样式.装饰, 0.9 * 透明度);
  for (const [偏, 宽比] of [
    [0.14, 0.14],
    [0.5, 0.11],
    [0.86, 0.08],
  ] as const) {
    const 带 = 裁进凸形(
      斜带(几何.左 + 格 * 偏, Math.max(1, 格 * 宽比), 几何.上, 几何.上 + 几何.行数 * 格),
      面形,
    );
    if (带.length >= 3) 绘图.fillPoints(带, true);
  }

  // ④ 爱心压花：外圈深色、内芯暗侧色，左上一点浅色读作压痕
  const 心宽 = Math.min(几何.列数 * 格, 几何.行数 * 格) * (几何.单格 ? 0.52 : 0.4);
  if (心宽 >= 5) {
    const 心 = 心点集(几何.中心X, 几何.中心Y + 心宽 * 0.06, 心宽);
    绘图.fillStyle(样式.深色, 0.7 * 透明度);
    绘图.fillPoints(
      心.map((p) => ({
        x: 几何.中心X + (p.x - 几何.中心X) * 1.16,
        y: 几何.中心Y + (p.y - 几何.中心Y) * 1.16,
      })),
      true,
    );
    绘图.fillStyle(体暗, 透明度);
    绘图.fillPoints(心, true);
    绘图.fillStyle(样式.浅色, 0.3 * 透明度);
    绘图.fillPoints(
      心.map((p) => ({
        x: 几何.中心X + (p.x - 几何.中心X) * 0.55,
        y: 几何.中心Y - 心宽 * 0.06 + (p.y - 几何.中心Y) * 0.55,
      })),
      true,
    );
  }
}
