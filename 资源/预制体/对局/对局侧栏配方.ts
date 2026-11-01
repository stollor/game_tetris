import type { 图形对象, 点, 矩形 } from "../../../.gamemaker/依赖/框架/界面/绘制/协议";
import type { 画笔 } from "../../../.gamemaker/依赖/框架/界面/绘制/画笔";
import { 混色 } from "../../../.gamemaker/依赖/框架/界面/颜色工具";
import { 读取对局文字样式 } from "../../../代码/页面/布局/对局布局";
import { 像素规范 } from "../../主题/像素/像素规范";
import { 是像素风格 } from "../../主题/像素/像素风格";
import { 对局像素规格 } from "../../主题/像素/对局像素规格";
import { 是立体风格 } from "../../主题/立体/立体风格";
import { 糖果规范 } from "../../主题/糖果/糖果规范";
import { 是糖果风格 } from "../../主题/糖果/糖果风格";
import { 读取霓虹调色板 } from "../../主题/配色/调色板";
import { 同角, 圆角多边形, 裁进凸形 } from "../基础/装饰与蒙层/圆角裁剪";
import { 绘制扇贝边, 绘制斜纹 } from "../基础/装饰与蒙层/糖果花纹";
import { 绘制像素面板 } from "../基础/面板/像素面板";
import { 绘制金属板 } from "../基础/面板/金属板";
import { 绘制霓虹玻璃 } from "../基础/面板/霓虹玻璃";
export interface 霓虹侧栏几何 {
  左: number;
  顶: number;
  宽: number;
  高: number;
  竖屏: boolean;
  紧凑: boolean;
}

/** 对局侧栏底板与分隔线。位置由场景的响应式布局算出，配色走霓虹配方。 */
export function 绘制霓虹侧栏(图形: 图形对象, 几何: 霓虹侧栏几何): void {
  const 调色板 = 读取霓虹调色板();
  const { 左, 顶, 宽, 高, 竖屏, 紧凑 } = 几何;
  if (是像素风格()) {
    if (!竖屏 && 紧凑) return;
    const 规 = 对局像素规格.侧栏;
    绘制像素面板(图形, 左, 顶, 宽, 高);
    图形
      .fillStyle(像素规范.色.墨)
      .fillRect(
        左 + 规.内边,
        顶 + 高 - (竖屏 ? 规.页脚竖屏 : 规.页脚横屏),
        宽 - 规.内边 * 2,
        像素规范.描边,
      );
    return;
  }
  if (是立体风格()) {
    if (!竖屏 && 紧凑) return;
    绘制金属板(图形, 左, 顶, 宽, 高, { 切: 8 });
    return;
  }
  // 糖果侧栏：草莓斜纹糖纸框，中间是巧克力托盘。
  if (是糖果风格()) {
    if (!竖屏 && 紧凑) return;
    const 色 = 糖果规范.色;
    const 圆角 = 糖果规范.圆角.面板;
    const 框 = Math.max(6, Math.min(9, 宽 * 0.07));
    图形.fillStyle(色.巧克力深, 0.35).fillRoundedRect(左 + 2, 顶 + 5, 宽, 高, 圆角);
    图形.fillStyle(色.草莓, 1).fillRoundedRect(左, 顶, 宽, 高, 圆角);
    const 带 = Math.max(5, 框 - 1);
    绘制斜纹(图形, 左 + 2, 顶 + 2, 宽 - 4, 带, 色.奶油, 0.95);
    绘制斜纹(图形, 左 + 2, 顶 + 高 - 带 - 2, 宽 - 4, 带, 色.奶油, 0.95);
    绘制斜纹(图形, 左 + 2, 顶 + 2, 带, 高 - 4, 色.奶油, 0.95);
    绘制斜纹(图形, 左 + 宽 - 带 - 2, 顶 + 2, 带, 高 - 4, 色.奶油, 0.95);
    图形
      .fillStyle(色.巧克力, 1)
      .fillRoundedRect(左 + 框, 顶 + 框, 宽 - 框 * 2, 高 - 框 * 2, Math.max(8, 圆角 - 4));
    图形
      .lineStyle(1.6, 色.奶油, 0.75)
      .strokeRoundedRect(左 + 框, 顶 + 框, 宽 - 框 * 2, 高 - 框 * 2, Math.max(8, 圆角 - 4));
    绘制扇贝边(图形, 左 + 8, 顶, 宽 - 16, 色.粉, 0.95, "上", 4.5, 11, 色.草莓深);
    return;
  }
  if (竖屏) {
    绘制霓虹玻璃(图形, 左, 顶, 宽, 高, {
      圆角: 14,
      透明度: 0.98,
      边色: 调色板.分组线,
      边透明度: 0.65,
    });
    图形.fillStyle(调色板.分组线, 0.6).fillRect(左 + 10, 顶 + 高 - 144, 宽 - 20, 1);
    return;
  }
  if (紧凑) return;
  绘制霓虹玻璃(图形, 左, 顶, 宽, 高, {
    圆角: 18,
    透明度: 0.98,
    边色: 调色板.分组线,
    边透明度: 0.6,
    强调色: 调色板.强调,
  });
  // 分隔线：三段渐变、两端渐隐，不形成横向接缝；位于记录页脚上方
  const 线X = 左 + 16;
  const 线宽 = 196;
  const 线Y = 顶 + 高 - 84;
  图形
    .fillGradientStyle(调色板.分组线, 调色板.分组线, 调色板.分组线, 调色板.分组线, 0, 0.32, 0, 0.32)
    .fillRect(线X, 线Y, 线宽 * 0.35, 1)
    .fillStyle(调色板.分组线, 0.32)
    .fillRect(线X + 线宽 * 0.35, 线Y, 线宽 * 0.3, 1)
    .fillGradientStyle(调色板.分组线, 调色板.分组线, 调色板.分组线, 调色板.分组线, 0.32, 0, 0.32, 0)
    .fillRect(线X + 线宽 * 0.65, 线Y, 线宽 * 0.35, 1);
}

/** 连续管壁、双侧导轨与端口套箍；槽位是管内定位，不再各有一块玻璃卡。 */
export function 绘制传输管道(图: 图形对象, 区域: 矩形): void {
  const 色 = 读取霓虹调色板();
  const { 左: x, 上: y, 宽: w, 高: h } = 区域;
  if (是像素风格()) {
    const p = 像素规范.描边;
    const 规 = 对局像素规格.侧栏;
    绘制像素面板(图, x, y, w, h, 像素规范.色.夜, 像素规范.色.紫);
    for (let 上 = y + 规.内边; 上 < y + h - 规.内边; 上 += 规.槽距) {
      图
        .fillStyle(像素规范.色.纸)
        .fillRect(x, 上, p, 规.槽长)
        .fillRect(x + w - p, 上, p, 规.槽长);
      图
        .fillStyle(像素规范.色.青)
        .fillRect(x + p, 上, p, p)
        .fillRect(x + w - p * 2, 上, p, p);
    }
    return;
  }
  if (是立体风格()) {
    绘制金属板(图, x, y, w, h, { 切: 8, 凹: true });
    return;
  }
  if (是糖果风格()) {
    绘制糖果纸杯(图, 区域);
    return;
  }
  图.fillStyle(色.棋盘底, 0.94).fillRoundedRect(x + 3, y, w - 6, h, 9);
  图.fillStyle(色.次级面板底, 0.65).fillRect(x + 8, y + 7, w - 16, h - 14);
  for (const 边 of [x + 3, x + w - 7]) {
    图.fillStyle(色.面板底, 1).fillRect(边 - 2, y + 7, 8, h - 14);
    图.fillStyle(色.强调, 0.45).fillRect(边, y + 10, 2, h - 20);
    图.fillStyle(色.强调, 0.12).fillRect(边 + 2, y + 10, 2, h - 20);
  }
  for (const 端 of [y, y + h - 10]) {
    图.fillStyle(色.面板底, 1).fillRoundedRect(x, 端, w, 10, 3);
    图.lineStyle(1.2, 色.强调, 0.65).strokeRoundedRect(x, 端, w, 10, 3);
    图
      .fillStyle(色.强调, 0.6)
      .fillRect(x + 8, 端 + 3, 7, 3)
      .fillRect(x + w - 15, 端 + 3, 7, 3);
  }
}

/**
 * 糖果纸杯托：玫瑰木竖褶杯壁、上下两排扇贝杯口、深酒红内井。
 * 暂存位与队列位共用，内容（方块）由调用方画在井里。
 */
export function 绘制糖果纸杯(图: 图形对象, 区域: 矩形): void {
  const 色 = 糖果规范.色;
  const { 左: x, 上: y, 宽: w, 高: h } = 区域;
  const 圆 = 12;
  图.fillStyle(0x12060a, 0.35).fillRoundedRect(x - 1, y + 4, w + 2, h, 圆 + 1);
  绘制杯口扇贝(图, x + 4, y, w - 8, "上");
  绘制杯口扇贝(图, x + 4, y + h, w - 8, "下");
  图.fillStyle(色.莓暗, 1).fillRoundedRect(x - 1.5, y - 1.5, w + 3, h + 3, 圆 + 1.5);
  const 壁 = 圆角多边形({ 左: x, 上: y, 右: x + w, 下: y + h }, 同角(圆));
  图.fillGradientStyle(色.莓亮, 色.莓亮, 色.莓, 色.莓, 1, 1, 1, 1).fillPoints(壁, true);
  // 竖褶：每道褶一条亮棱一条暗缝，裁进杯壁圆角。
  for (let 褶 = x + 1; 褶 < x + w - 1; 褶 += 5) {
    const 亮 = 裁进凸形(
      [
        { x: 褶, y },
        { x: 褶 + 2, y },
        { x: 褶 + 2, y: y + h },
        { x: 褶, y: y + h },
      ],
      壁,
    );
    if (亮.length >= 3) 图.fillStyle(色.莓浅, 0.55).fillPoints(亮, true);
    const 暗 = 裁进凸形(
      [
        { x: 褶 + 3.4, y },
        { x: 褶 + 4.6, y },
        { x: 褶 + 4.6, y: y + h },
        { x: 褶 + 3.4, y: y + h },
      ],
      壁,
    );
    if (暗.length >= 3) 图.fillStyle(色.莓暗, 0.6).fillPoints(暗, true);
  }
  图.lineStyle(1, 色.莓浅, 0.7).strokeRoundedRect(x + 1, y + 1, w - 2, h - 2, 圆 - 1);
  const 缩 = 9;
  const 井圆 = 圆 - 5;
  图
    .fillStyle(色.莓暗, 1)
    .fillRoundedRect(x + 缩 - 1.5, y + 缩 - 1.5, w - 缩 * 2 + 3, h - 缩 * 2 + 3, 井圆 + 1.5);
  const 井亮 = 混色(色.井, 色.莓深, 0.5);
  图
    .fillGradientStyle(井亮, 井亮, 色.井, 色.井, 1, 1, 1, 1)
    .fillRoundedRect(x + 缩, y + 缩, w - 缩 * 2, h - 缩 * 2, 井圆);
  图
    .fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0.35, 0.35, 0, 0)
    .fillRoundedRect(x + 缩, y + 缩, w - 缩 * 2, Math.min(18, h * 0.2), 井圆);
  图
    .lineStyle(1, 色.莓浅, 0.4)
    .strokeRoundedRect(x + 缩 - 2.2, y + 缩 - 2.2, w - 缩 * 2 + 4.4, h - 缩 * 2 + 4.4, 井圆 + 2);
}

/** 纸杯口的一排扇贝：深色垫底、玫瑰面、顶上一点高光。 */
function 绘制杯口扇贝(图: 图形对象, 左: number, y: number, 宽: number, 朝向: "上" | "下"): void {
  const 色 = 糖果规范.色;
  const 半径 = 4.6;
  const 数 = Math.max(3, Math.round(宽 / (半径 * 2)));
  const 步 = 宽 / 数;
  const 向 = 朝向 === "上" ? -1 : 1;
  for (let 序 = 0; 序 < 数; 序 += 1) {
    const cx = 左 + 步 * (序 + 0.5);
    图.fillStyle(色.莓暗, 1).fillCircle(cx, y + 向 * 0.6, 步 / 2 + 1.2);
  }
  for (let 序 = 0; 序 < 数; 序 += 1) {
    const cx = 左 + 步 * (序 + 0.5);
    图.fillStyle(朝向 === "上" ? 色.莓亮 : 色.莓, 1).fillCircle(cx, y + 向 * 0.6, 步 / 2);
    图.fillStyle(色.莓浅, 0.45).fillCircle(cx - 步 * 0.12, y + 向 * 步 * 0.22, 步 * 0.16);
  }
}

/** 糖果侧栏页签：深酒红胶囊压在纸杯口上，象牙字，按标签中心定位。 */
export function 绘制糖果侧栏标签(笔: 画笔, 文案: string, 中心X: number, 中心Y: number): void {
  const 色 = 糖果规范.色;
  const 样式 = 读取对局文字样式("预览标题", {
    字号: 12,
    颜色: 色.象牙,
    阴影: { 颜色: 色.井, 模糊: 0, 偏移X: 0, 偏移Y: 1 },
  });
  const 测 = 笔.测量文字(文案, 样式);
  const 宽 = Math.max(50, 测.宽 + 24);
  const 高 = 19;
  const 图 = 笔.图形;
  const 左 = 中心X - 宽 / 2;
  const 上 = 中心Y - 高 / 2;
  图.fillStyle(0x12060a, 0.35).fillRoundedRect(左, 上 + 2.5, 宽, 高, 高 / 2);
  图.fillStyle(色.莓浅, 1).fillRoundedRect(左 - 1.5, 上 - 1.5, 宽 + 3, 高 + 3, 高 / 2 + 1.5);
  图
    .fillGradientStyle(色.莓深, 色.莓深, 色.莓暗, 色.莓暗, 1, 1, 1, 1)
    .fillRoundedRect(左, 上, 宽, 高, 高 / 2);
  图.fillStyle(0xffffff, 0.12).fillRoundedRect(左 + 5, 上 + 1.5, 宽 - 10, 高 * 0.35, 高 * 0.17);
  笔.绘制文字({ 文案, 样式, 锚点: "中中", x: 中心X, y: 中心Y });
}

/** 纪录花章：十二瓣花形牌，背后两条缎带尾，象牙奖杯压在花心上方。中心定位。 */
export function 绘制糖果纪录花章(图: 图形对象, 中心X: number, 中心Y: number, 半径: number): void {
  const 色 = 糖果规范.色;
  for (const 向 of [-1, 1]) {
    const 尾 = [
      { x: 中心X + 向 * 半径 * 0.25, y: 中心Y + 半径 * 0.4 },
      { x: 中心X + 向 * 半径 * 0.85, y: 中心Y + 半径 * 0.65 },
      { x: 中心X + 向 * 半径 * 0.95, y: 中心Y + 半径 * 1.42 },
      { x: 中心X + 向 * 半径 * 0.68, y: 中心Y + 半径 * 1.2 },
      { x: 中心X + 向 * 半径 * 0.45, y: 中心Y + 半径 * 1.42 },
    ];
    图.fillStyle(色.莓暗, 1).fillPoints(
      尾.map((p) => ({ x: p.x + 向 * 1.2, y: p.y + 1.2 })),
      true,
    );
    图.fillStyle(向 < 0 ? 色.莓 : 色.莓深, 1).fillPoints(尾, true);
  }
  const 花 = (r: number) => {
    const 点集: 点[] = [];
    for (let i = 0; i < 96; i += 1) {
      const a = (i / 96) * Math.PI * 2;
      const 瓣 = r * (1 + 0.075 * Math.cos(a * 12));
      点集.push({ x: 中心X + Math.cos(a) * 瓣, y: 中心Y + Math.sin(a) * 瓣 });
    }
    return 点集;
  };
  图.fillStyle(0x12060a, 0.35).fillPoints(
    花(半径).map((p) => ({ x: p.x, y: p.y + 3 })),
    true,
  );
  图.fillStyle(色.莓暗, 1).fillPoints(花(半径 + 1.5), true);
  图.fillGradientStyle(色.莓亮, 色.莓亮, 色.莓, 色.莓, 1, 1, 1, 1).fillPoints(花(半径), true);
  图.fillStyle(色.莓暗, 0.55).fillCircle(中心X, 中心Y + 0.5, 半径 * 0.74);
  图.lineStyle(1.2, 色.象牙, 0.65).strokeCircle(中心X, 中心Y, 半径 * 0.8);
  图
    .fillGradientStyle(0xffffff, 0xffffff, 0xffffff, 0xffffff, 0.2, 0.2, 0, 0)
    .fillEllipse(中心X, 中心Y - 半径 * 0.55, 半径 * 1.1, 半径 * 0.42);
  const 杯Y = 中心Y - 半径 * 0.42;
  图.fillStyle(色.象牙, 0.95);
  图.fillPoints(
    [
      { x: 中心X - 6, y: 杯Y - 5 },
      { x: 中心X + 6, y: 杯Y - 5 },
      { x: 中心X + 4.5, y: 杯Y + 1.5 },
      { x: 中心X + 1.2, y: 杯Y + 3.5 },
      { x: 中心X - 1.2, y: 杯Y + 3.5 },
      { x: 中心X - 4.5, y: 杯Y + 1.5 },
    ],
    true,
  );
  图.fillRect(中心X - 1, 杯Y + 3, 2, 3).fillRoundedRect(中心X - 4, 杯Y + 5.5, 8, 2.2, 1);
  图
    .lineStyle(1.3, 色.象牙, 0.95)
    .strokeCircle(中心X - 6, 杯Y - 2, 2.2)
    .strokeCircle(中心X + 6, 杯Y - 2, 2.2);
}
