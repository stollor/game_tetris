import type { 图形对象, 矩形 } from "../../../.gamemaker/依赖/框架/界面/绘制/协议";
import type { 画笔 } from "../../../.gamemaker/依赖/框架/界面/绘制/画笔";
import { 读取对局文字样式 } from "../../../代码/页面/布局/对局布局";
import { 像素规范 } from "../../主题/像素/像素规范";
import { 是像素风格 } from "../../主题/像素/像素风格";
import { 对局像素规格 } from "../../主题/像素/对局像素规格";
import { 是立体风格 } from "../../主题/立体/立体风格";
import { 糖果规范 } from "../../主题/糖果/糖果规范";
import { 是糖果风格 } from "../../主题/糖果/糖果风格";
import { 读取霓虹调色板 } from "../../主题/配色/调色板";
import { 绘制像素面板 } from "../基础/面板/像素面板";
import { 绘制糖果凹槽, 绘制糖果面板 } from "../基础/面板/糖果面板";
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
  // 糖果侧栏：巧克力糖纸面板 + 奶油分隔线，页脚留给纪录纸页。
  if (是糖果风格()) {
    if (!竖屏 && 紧凑) return;
    绘制糖果面板(图形, 左, 顶, 宽, 高, {
      圆角: 糖果规范.圆角.面板,
      填色: 糖果规范.色.巧克力浅,
      边色: 糖果规范.色.草莓,
      底边色: 糖果规范.色.巧克力深,
      铆钉: true,
    });
    图形
      .fillStyle(糖果规范.色.奶油深, 0.5)
      .fillRect(左 + 12, 顶 + 高 - (竖屏 ? 144 : 84), 宽 - 24, 2);
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
  // 糖果管道：巧克力凹槽 + 两侧草莓糖纸导轨 + 上下奶油收口。
  if (是糖果风格()) {
    绘制糖果凹槽(图, x, y, w, h, 糖果规范.圆角.卡片);
    for (const 边 of [x + 1, x + w - 5])
      图.fillStyle(糖果规范.色.草莓浅, 0.55).fillRoundedRect(边, y + 8, 4, h - 16, 2);
    for (const 端 of [y, y + h - 10]) {
      图.fillStyle(糖果规范.色.奶油, 0.95).fillRoundedRect(x, 端, w, 10, 4);
      图.lineStyle(1, 糖果规范.色.草莓, 0.55).strokeRoundedRect(x, 端, w, 10, 4);
    }
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

/** 糖果侧栏标签牌：奶油小牌 + 金色字，按标签中心定位，不改调用方布局。 */
export function 绘制糖果侧栏标签(笔: 画笔, 文案: string, 中心X: number, 中心Y: number): void {
  const 样式 = 读取对局文字样式("预览标题", {
    字号: 12,
    颜色: 糖果规范.色.金深,
    描边: { 颜色: 糖果规范.色.巧克力浅, 粗细: 1 },
  });
  const 测 = 笔.测量文字(文案, 样式);
  const 宽 = Math.max(48, 测.宽 + 22);
  const 高 = 20;
  绘制糖果面板(笔.图形, 中心X - 宽 / 2, 中心Y - 高 / 2, 宽, 高, {
    圆角: 高 / 2,
    填色: 糖果规范.色.奶油,
    边色: 糖果规范.色.草莓,
    花边: false,
    铆钉: false,
    高光: false,
    投影: false,
  });
  笔.绘制文字({ 文案, 样式, 锚点: "中中", x: 中心X, y: 中心Y });
}
