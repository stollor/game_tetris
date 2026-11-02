import type { 图形对象, 点, 矩形 } from "../../../.gamemaker/依赖/框架/界面/绘制/协议";
import type { 画笔 } from "../../../.gamemaker/依赖/框架/界面/绘制/画笔";
import { 亮色, 暗色, 混色 } from "../../../.gamemaker/依赖/框架/界面/颜色工具";
import { 读取对局文字样式 } from "../../../代码/页面/布局/对局布局";
import { 像素规范 } from "../../主题/像素/像素规范";
import { 是像素风格 } from "../../主题/像素/像素风格";
import { 对局像素规格 } from "../../主题/像素/对局像素规格";
import { 是立体风格 } from "../../主题/立体/立体风格";
import { 扁平外观 } from "../../主题/糖果/扁平外观";
import { 糖果规范 } from "../../主题/糖果/糖果规范";
import { 是糖果风格 } from "../../主题/糖果/糖果风格";
import { 读取霓虹调色板 } from "../../主题/配色/调色板";
import { 同角, 圆角多边形, 裁进凸形 } from "../基础/装饰与蒙层/圆角裁剪";
import { 绘制扇贝边, 绘制斜纹 } from "../基础/装饰与蒙层/糖果花纹";
import { 绘制像素面板 } from "../基础/面板/像素面板";
import { 绘制金属板 } from "../基础/面板/金属板";
import { 绘制霓虹玻璃 } from "../基础/面板/霓虹玻璃";
import { 是糖果底板 } from "./糖果底板";
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
  // 底板已接管静态外观：纸杯由画布画在最底层，这里不再叠一层矢量杯。
  if (是糖果底板()) return;
  const 色 = 糖果规范.色;
  const { 左: x, 上: y, 宽: w, 高: h } = 区域;
  const 圆 = 12;
  // 玫瑰纸杯：杯壁莓亮→莓的竖向渐变，描边莓暗，内井仍是深巧克力。
  const 面填 = 色.莓亮;
  const 壁影 = 混色(暗色(面填, 0.3), 色.莓深, 0.3);
  const 褶暗 = 色.莓暗;
  // ①三层接触投影：纸杯压在糖墙上，近层实、远层淡。
  for (const [下移, 外扩, 透明] of [
    [2.6, 1, 0.36],
    [6, 3, 0.2],
    [10, 5.5, 0.1],
  ] as const)
    图.fillStyle(色.巧克力深, 透明).fillRoundedRect(x - 外扩, y + 下移, w + 外扩 * 2, h, 圆 + 外扩);
  绘制杯口扇贝(图, x + 3, y + h, w - 6, "下");
  // ②深色糖边 ⑥侧壁：莓暗外沿 + 下移一档的杯壁厚度。
  图.fillStyle(色.莓暗, 1).fillRoundedRect(x - 2, y - 2, w + 4, h + 4, 圆 + 2);
  图.fillStyle(壁影, 1).fillRoundedRect(x, y + 3.2, w, h, 圆);
  const 壁 = 圆角多边形({ 左: x, 上: y, 右: x + w, 下: y + h }, 同角(圆));
  // ③杯壁：左上受光、右下压暗的玫瑰木。
  图
    .fillGradientStyle(亮色(面填, 0.2), 面填, 色.莓, 暗色(色.莓, 0.34), 1, 1, 1, 1)
    .fillPoints(壁, true);
  const 左缘 = 裁进凸形(
    [
      { x, y },
      { x: x + 4, y },
      { x: x + 4, y: y + h },
      { x, y: y + h },
    ],
    壁,
  );
  if (左缘.length >= 3) 图.fillStyle(色.莓浅, 0.45).fillPoints(左缘, true);
  const 右缘 = 裁进凸形(
    [
      { x: x + w - 5, y },
      { x: x + w, y },
      { x: x + w, y: y + h },
      { x: x + w - 5, y: y + h },
    ],
    壁,
  );
  if (右缘.length >= 3) 图.fillStyle(色.莓暗, 0.5).fillPoints(右缘, true);
  // 竖棱（fluted）：约 7px 一条，亮棱夹暗沟，杯壁才像一圈折起来的纸。
  const 棱距 = Math.max(6, Math.min(8, w / 9));
  const 亮宽 = 棱距 * 0.34;
  const 暗宽 = 棱距 * 0.4;
  for (let 棱 = x + 2; 棱 < x + w - 2; 棱 += 棱距) {
    const 亮 = 裁进凸形(
      [
        { x: 棱, y },
        { x: 棱 + 亮宽, y },
        { x: 棱 + 亮宽, y: y + h },
        { x: 棱, y: y + h },
      ],
      壁,
    );
    if (亮.length >= 3) 图.fillStyle(色.莓浅, 0.55).fillPoints(亮, true);
    const 暗 = 裁进凸形(
      [
        { x: 棱 + 棱距 - 暗宽, y },
        { x: 棱 + 棱距, y },
        { x: 棱 + 棱距, y: y + h },
        { x: 棱 + 棱距 - 暗宽, y: y + h },
      ],
      壁,
    );
    if (暗.length >= 3) 图.fillStyle(褶暗, 0.7).fillPoints(暗, true);
  }
  // 棱条的顶棱高光：沿杯口一窄条，读作折纸的反光。
  图
    .fillGradientStyle(色.白, 色.白, 色.白, 色.白, 0.34, 0.2, 0, 0)
    .fillRoundedRect(x + 5, y + 2.2, w - 10, 3.4, 1.7);
  // ④杯口受光棱 ⑤杯底内阴影：纸杯上下各收一条边。
  图.lineStyle(1.3, 色.莓浅, 0.7).strokeRoundedRect(x + 1, y + 1, w - 2, h - 2, 圆 - 1);
  图
    .fillGradientStyle(壁影, 壁影, 壁影, 壁影, 0, 0, 0.4, 0.4)
    .fillRoundedRect(x + 4, y + h - 8, w - 8, 6, 3);
  // 杯口外翻的一圈唇：莓浅→莓亮，压在最上面，读作纸杯口。
  图
    .fillGradientStyle(色.莓浅, 色.莓浅, 色.莓亮, 色.莓亮, 1, 1, 1, 1)
    .fillRoundedRect(x + 1, y - 1, w - 2, 9, 4.5);
  图
    .fillGradientStyle(色.白, 色.白, 色.白, 色.白, 0.45, 0.28, 0, 0)
    .fillRoundedRect(x + 4, y - 0.4, w - 8, 3.4, 1.7);
  绘制杯口扇贝(图, x + 3, y + 2, w - 6, "上");
  // 内井：上沿几乎全黑，向下透出一点莓色；井壁一圈暗边 + 底缘反光。
  const 缩 = 8;
  const 井圆 = 圆 - 5;
  图
    .fillStyle(色.莓暗, 1)
    .fillRoundedRect(x + 缩 - 2, y + 缩 - 2, w - 缩 * 2 + 4, h - 缩 * 2 + 4, 井圆 + 2);
  const 井亮 = 混色(色.井, 色.莓深, 0.5);
  图
    .fillGradientStyle(井亮, 井亮, 色.井, 色.井, 1, 1, 1, 1)
    .fillRoundedRect(x + 缩, y + 缩, w - 缩 * 2, h - 缩 * 2, 井圆);
  图
    .fillGradientStyle(色.巧克力深, 色.巧克力深, 色.巧克力深, 色.巧克力深, 0.62, 0.62, 0, 0)
    .fillRoundedRect(x + 缩, y + 缩, w - 缩 * 2, Math.min(20, h * 0.24), 井圆);
  图
    .fillGradientStyle(色.莓浅, 色.莓浅, 色.莓浅, 色.莓浅, 0, 0, 0.28, 0.28)
    .fillRoundedRect(x + 缩 + 2, y + h - 缩 - 3.4, w - 缩 * 2 - 4, 1.6, 0.8);
  图
    .lineStyle(1, 色.莓浅, 0.42)
    .strokeRoundedRect(x + 缩 - 2.2, y + 缩 - 2.2, w - 缩 * 2 + 4.4, h - 缩 * 2 + 4.4, 井圆 + 2);
}

/** 纸杯口的一排扇贝：投影、莓暗糖边、莓亮面、鼓起的圆顶与顶上一点高光。 */
function 绘制杯口扇贝(图: 图形对象, 左: number, y: number, 宽: number, 朝向: "上" | "下"): void {
  const 色 = 糖果规范.色;
  const 面 = 朝向 === "上" ? 色.莓浅 : 色.莓亮;
  const 半径 = 5.4;
  const 数 = Math.max(3, Math.round(宽 / (半径 * 2)));
  const 步 = 宽 / 数;
  const 向 = 朝向 === "上" ? -1 : 1;
  // ①投影：朝杯内落影，杯口才不是贴纸。
  for (let 序 = 0; 序 < 数; 序 += 1)
    图.fillStyle(色.巧克力深, 0.32).fillCircle(左 + 步 * (序 + 0.5) + 0.4, y + 1.8, 步 / 2 + 1.6);
  // ②莓暗糖边
  for (let 序 = 0; 序 < 数; 序 += 1)
    图.fillStyle(色.莓暗, 1).fillCircle(左 + 步 * (序 + 0.5), y + 向 * 0.6, 步 / 2 + 1.4);
  // ③糖面
  for (let 序 = 0; 序 < 数; 序 += 1)
    图.fillStyle(面, 1).fillCircle(左 + 步 * (序 + 0.5), y + 向 * 0.6, 步 / 2);
  // ④圆顶受光：每颗扇贝朝外那半更亮。
  for (let 序 = 0; 序 < 数; 序 += 1) {
    const cx = 左 + 步 * (序 + 0.5);
    图.fillStyle(亮色(面, 0.22), 0.9).fillCircle(cx, y + 向 * 步 * 0.14, 步 * 0.36);
    图.fillStyle(色.白, 0.45).fillCircle(cx - 步 * 0.1, y + 向 * 步 * 0.26, 步 * 0.15);
  }
}

/** 糖果侧栏页签：玫瑰木胶囊压在罐口上，奶油字，按标签中心定位。 */
export function 绘制糖果侧栏标签(笔: 画笔, 文案: string, 中心X: number, 中心Y: number): void {
  const 色 = 扁平外观.色;
  const 样式 = 读取对局文字样式("预览标题", {
    字号: 12,
    颜色: 色.象牙,
  });
  const 测 = 笔.测量文字(文案, 样式);
  const 宽 = Math.max(50, 测.宽 + 24);
  const 高 = 19;
  const 图 = 笔.图形;
  const 左 = 中心X - 宽 / 2;
  const 上 = 中心Y - 高 / 2;
  // 底板生效时胶囊由画布画，这里只保留文字（位置与样式不变）；
  // 兜底分支同一套扁平语言：奶油浅外框 + 玫瑰木浅底，无渐变高光。
  if (!是糖果底板()) {
    图.fillStyle(色.奶油深, 0.9).fillRoundedRect(左 + 1, 上 + 2.2, 宽, 高, 高 / 2);
    图.fillStyle(色.奶油浅, 1).fillRoundedRect(左, 上, 宽, 高, 高 / 2);
    图
      .fillStyle(色.玫瑰木浅, 1)
      .fillRoundedRect(左 + 2.6, 上 + 2.6, 宽 - 5.2, 高 - 5.2, 高 / 2 - 2.6);
  }
  笔.绘制文字({ 文案, 样式, 锚点: "中中", x: 中心X, y: 中心Y });
}

/**
 * 纪录花章：花边盘、缎带与金杯（中心定位），纪录数值仍由文字层压在同一中心。
 * 底板生效时整块奖章都由画布画（画布才有平滑曲线与侧边），这里不再叠一层。
 */
export function 绘制糖果纪录花章(图: 图形对象, 中心X: number, 中心Y: number, 半径: number): void {
  if (是糖果底板()) return;
  const 色 = 扁平外观.色;
  // 兜底：底板不可用时用矢量画一块同样的扁平奖章（粉瓣 + 玫瑰木心 + 缎带尾 + 金杯）。
  const 花 = (r: number) => {
    const 点集: 点[] = [];
    for (let i = 0; i < 96; i += 1) {
      const a = (i / 96) * Math.PI * 2;
      const 瓣 = r * (1 + 0.06 * Math.cos(a * 12));
      点集.push({ x: 中心X + Math.cos(a) * 瓣, y: 中心Y + Math.sin(a) * 瓣 });
    }
    return 点集;
  };
  for (const 向 of [-1, 1] as const) {
    const 尾 = [
      { x: 中心X + 向 * 半径 * 0.3, y: 中心Y + 半径 * 0.32 },
      { x: 中心X + 向 * 半径 * 1.06, y: 中心Y + 半径 * 0.7 },
      { x: 中心X + 向 * 半径 * 1.08, y: 中心Y + 半径 * 1.36 },
      { x: 中心X + 向 * 半径 * 0.84, y: 中心Y + 半径 * 1.12 },
      { x: 中心X + 向 * 半径 * 0.66, y: 中心Y + 半径 * 1.42 },
      { x: 中心X + 向 * 半径 * 0.22, y: 中心Y + 半径 * 0.58 },
    ];
    图.fillStyle(色.粉深, 1).fillPoints(
      尾.map((p) => ({ x: p.x, y: p.y + 2.2 })),
      true,
    );
    图.fillStyle(色.粉, 1).fillPoints(尾, true);
  }
  图.fillStyle(色.粉深, 1).fillPoints(
    花(半径).map((p) => ({ x: p.x, y: p.y + 2.4 })),
    true,
  );
  图.fillStyle(色.粉, 1).fillPoints(花(半径), true);
  图.fillStyle(色.奖章, 1).fillCircle(中心X, 中心Y, 半径 * 0.78);
  图.lineStyle(1.2, 色.玫瑰木深, 1).strokeCircle(中心X, 中心Y, 半径 * 0.78);
  // 金杯：金面 + 下移一档的金深侧边；杯口/杯身/杯柄/杯脚同一套粗笔画。
  const 杯Y = 中心Y - 半径 * 0.42;
  const 半宽 = 半径 * 0.33;
  const 画杯 = (下移: number, 面: number) => {
    图
      .fillStyle(面, 1)
      .fillRoundedRect(中心X - 半宽, 杯Y - 半径 * 0.26 + 下移, 半宽 * 2, 半径 * 0.1, 半径 * 0.05);
    图.fillStyle(面, 1).fillPoints(
      [
        { x: 中心X - 半宽 * 0.82, y: 杯Y - 半径 * 0.16 + 下移 },
        { x: 中心X + 半宽 * 0.82, y: 杯Y - 半径 * 0.16 + 下移 },
        { x: 中心X + 半宽 * 0.27, y: 杯Y + 半径 * 0.07 + 下移 },
        { x: 中心X, y: 杯Y + 半径 * 0.09 + 下移 },
        { x: 中心X - 半宽 * 0.27, y: 杯Y + 半径 * 0.07 + 下移 },
      ],
      true,
    );
    for (const 向 of [-1, 1] as const)
      图
        .lineStyle(半径 * 0.07, 面, 1)
        .strokeCircle(中心X + 向 * 半宽 * 0.9, 杯Y - 半径 * 0.1 + 下移, 半径 * 0.13);
    图
      .fillStyle(面, 1)
      .fillRect(中心X - 半径 * 0.045, 杯Y + 半径 * 0.06 + 下移, 半径 * 0.09, 半径 * 0.15);
    图
      .fillStyle(面, 1)
      .fillRoundedRect(
        中心X - 半径 * 0.17,
        杯Y + 半径 * 0.2 + 下移,
        半径 * 0.34,
        半径 * 0.09,
        半径 * 0.045,
      );
  };
  画杯(1.2, 色.金深);
  画杯(0, 色.金);
}
