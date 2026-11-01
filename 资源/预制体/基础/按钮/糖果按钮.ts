import type { 图形对象, 点 } from "../../../../.gamemaker/依赖/框架/界面/绘制/协议";
import { 亮色, 暗色 } from "../../../../.gamemaker/依赖/框架/界面/颜色工具";
import { 糖果规范 } from "../../../主题/糖果/糖果规范";
import { 同角, 圆角多边形, 斜带, 裁进凸形, type 边界 } from "../装饰与蒙层/圆角裁剪";
import { 绘制糖纸扭结 } from "../装饰与蒙层/糖果花纹";

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

/** 花边椭圆：外缘按瓣数起伏的饼干轮廓，起伏深度是半径的比例。 */
function 花边椭圆点(
  中心X: number,
  中心Y: number,
  横半径: number,
  纵半径: number,
  瓣数: number,
  起伏: number,
): 点[] {
  const 段 = 瓣数 * 6;
  return Array.from({ length: 段 }, (_, 序) => {
    const 角 = (序 / 段) * Math.PI * 2;
    const 缩 = 1 - 起伏 * (1 - Math.abs(Math.cos((角 * 瓣数) / 2)));
    return { x: 中心X + Math.cos(角) * 横半径 * 缩, y: 中心Y + Math.sin(角) * 纵半径 * 缩 };
  });
}

function 平移点(点集: readonly 点[], 横移: number, 纵移: number): 点[] {
  return 点集.map((p) => ({ x: p.x + 横移, y: p.y + 纵移 }));
}

function 椭圆点(中心X: number, 中心Y: number, 横半径: number, 纵半径: number, 段 = 40): 点[] {
  return Array.from({ length: 段 }, (_, 序) => {
    const 角 = (序 / 段) * Math.PI * 2;
    return { x: 中心X + Math.cos(角) * 横半径, y: 中心Y + Math.sin(角) * 纵半径 };
  });
}

/**
 * 花边黄油饼干：左转键与角键。饼干有侧面厚度、凸起内圈与一圈戳孔，按下时整块下沉、厚度变薄。
 * 中心定位，横纵半径分开以便压成扁饼干。
 */
export function 绘制花边饼干(
  绘图: 图形对象,
  中心X: number,
  中心Y: number,
  横半径: number,
  纵半径: number,
  按下 = false,
): void {
  const 色 = 糖果规范.色;
  const 厚 = Math.max(2.5, 纵半径 * (按下 ? 0.08 : 0.15));
  const cy = 中心Y - 厚 / 2 + (按下 ? 1.5 : 0);
  const 瓣数 = Math.max(10, Math.round((横半径 + 纵半径) / 4.2));
  const 外形 = 花边椭圆点(中心X, cy, 横半径, 纵半径, 瓣数, 0.07);
  绘图.fillStyle(0x12060a, 按下 ? 0.25 : 0.38).fillPoints(平移点(外形, 1, 厚 + 3), true);
  绘图
    .fillStyle(色.饼干焦, 1)
    .fillPoints(花边椭圆点(中心X, cy + 厚, 横半径 + 1.4, 纵半径 + 1.4, 瓣数, 0.07), true);
  绘图
    .fillStyle(色.饼干焦, 1)
    .fillPoints(花边椭圆点(中心X, cy, 横半径 + 1.4, 纵半径 + 1.4, 瓣数, 0.07), true);
  绘图.fillStyle(色.饼干深, 1).fillPoints(平移点(外形, 0, 厚), true);
  绘图
    .fillGradientStyle(色.饼干浅, 色.饼干浅, 色.饼干, 色.饼干深, 1, 1, 1, 1)
    .fillPoints(外形, true);
  // 花瓣棱：每道外缘凹谷向内拉一条压痕，读成菊花模压出的饼干。
  for (let 序 = 0; 序 < 瓣数; 序 += 1) {
    const 角 = (序 / 瓣数) * Math.PI * 2 + Math.PI / 瓣数;
    const 余 = Math.cos(角);
    const 正 = Math.sin(角);
    绘图
      .lineStyle(Math.max(1, 纵半径 * 0.05), 色.饼干深, 0.45)
      .lineBetween(
        中心X + 余 * 横半径 * 0.68,
        cy + 正 * 纵半径 * 0.66,
        中心X + 余 * 横半径 * 0.9,
        cy + 正 * 纵半径 * 0.88,
      );
  }
  // 凸起内圈：下沿暗线 + 上沿亮线，读成压模压出的台阶。
  const 内横 = 横半径 * 0.64;
  const 内纵 = 纵半径 * 0.6;
  绘图
    .lineStyle(Math.max(1.4, 纵半径 * 0.07), 色.饼干深, 0.75)
    .strokePoints(椭圆点(中心X, cy + 1, 内横, 内纵), true);
  绘图.lineStyle(1.2, 色.饼干浅, 0.95).strokePoints(椭圆点(中心X, cy - 0.6, 内横, 内纵), true);
  绘图
    .fillStyle(亮色(色.饼干, 0.12), 0.85)
    .fillPoints(椭圆点(中心X, cy, 内横 - 1.5, 内纵 - 1.5), true);
  绘图
    .fillStyle(色.白, 按下 ? 0.18 : 0.38)
    .fillEllipse(中心X - 横半径 * 0.36, cy - 纵半径 * 0.52, 横半径 * 0.5, 纵半径 * 0.2);
}

/** 糖霜甜甜圈：右转键。面团圈上浇一层滴落的草莓糖霜，撒彩针；箭头压在糖霜中心。 */
export function 绘制糖霜甜甜圈(
  绘图: 图形对象,
  中心X: number,
  中心Y: number,
  横半径: number,
  纵半径: number,
  按下 = false,
): void {
  const 色 = 糖果规范.色;
  const 厚 = Math.max(2.5, 纵半径 * (按下 ? 0.1 : 0.18));
  const cy = 中心Y - 厚 / 2 + (按下 ? 1.5 : 0);
  const 面团 = 椭圆点(中心X, cy, 横半径, 纵半径, 48);
  绘图.fillStyle(0x12060a, 按下 ? 0.25 : 0.38).fillPoints(平移点(面团, 1, 厚 + 3), true);
  绘图
    .fillStyle(色.饼干焦, 1)
    .fillPoints(椭圆点(中心X, cy + 厚, 横半径 + 1.4, 纵半径 + 1.4, 48), true);
  绘图.fillStyle(色.饼干焦, 1).fillPoints(椭圆点(中心X, cy, 横半径 + 1.4, 纵半径 + 1.4, 48), true);
  绘图.fillStyle(色.饼干深, 1).fillPoints(平移点(面团, 0, 厚), true);
  绘图
    .fillGradientStyle(色.饼干浅, 色.饼干浅, 色.饼干, 色.饼干深, 1, 1, 1, 1)
    .fillPoints(面团, true);
  // 糖霜：两组正弦叠出不规则滴落边，下缘多垂一点。
  const 段 = 64;
  const 糖霜 = Array.from({ length: 段 }, (_, 序) => {
    const 角 = (序 / 段) * Math.PI * 2;
    const 滴 = 0.045 * Math.sin(角 * 7 + 0.6) + 0.03 * Math.sin(角 * 13 + 1.7);
    const 垂 = Math.max(0, Math.sin(角)) * 0.05;
    const 缩 = 0.84 + 滴 + 垂;
    return {
      x: 中心X + Math.cos(角) * 横半径 * 缩,
      y: cy - 纵半径 * 0.04 + Math.sin(角) * 纵半径 * 缩,
    };
  });
  绘图.fillStyle(色.草莓深, 1).fillPoints(平移点(糖霜, 0, 1.4), true);
  绘图.fillGradientStyle(色.草莓浅, 色.草莓浅, 色.草莓, 色.草莓, 1, 1, 1, 1).fillPoints(糖霜, true);
  // 中心孔：糖霜内缘一圈暗边，孔里露面团。
  const 孔横 = 横半径 * 0.24;
  const 孔纵 = 纵半径 * 0.24;
  绘图.fillStyle(色.草莓深, 1).fillPoints(椭圆点(中心X, cy, 孔横 + 1.6, 孔纵 + 1.6, 24), true);
  绘图
    .fillGradientStyle(色.饼干深, 色.饼干深, 色.饼干, 色.饼干, 1, 1, 1, 1)
    .fillPoints(椭圆点(中心X, cy + 0.6, 孔横, 孔纵, 24), true);
  const 糖针 = [色.薄荷, 色.柠檬, 色.蓝莓, 色.糖纸, 色.葡萄, 色.叶绿];
  const 针长 = Math.max(2.4, 纵半径 * 0.13);
  for (let 序 = 0; 序 < 22; 序 += 1) {
    const 角 = 序 * 2.399 + 0.4;
    const 环 = 0.42 + ((序 * 37) % 10) / 30;
    const x = 中心X + Math.cos(角) * 横半径 * 环;
    const y = cy + Math.sin(角) * 纵半径 * 环;
    const 斜 = 序 * 1.13;
    const dx = (Math.cos(斜) * 针长) / 2;
    const dy = (Math.sin(斜) * 针长) / 2;
    绘图
      .lineStyle(Math.max(1.5, 纵半径 * 0.065), 糖针[序 % 糖针.length] ?? 色.薄荷, 0.95)
      .lineBetween(x - dx, y - dy, x + dx, y + dy);
  }
  绘图
    .fillStyle(色.白, 按下 ? 0.2 : 0.5)
    .fillEllipse(中心X - 横半径 * 0.38, cy - 纵半径 * 0.46, 横半径 * 0.42, 纵半径 * 0.16);
}

/**
 * 扇贝苏打饼干：暂存键。四边一圈圆齿、内框压线与两排戳孔，和暂存槽的「收进盒里」区分开。
 * 中心定位，宽高为饼干本体（不含圆齿外凸）。
 */
export function 绘制扇贝饼干(
  绘图: 图形对象,
  中心X: number,
  中心Y: number,
  宽: number,
  高: number,
  按下 = false,
): void {
  const 色 = 糖果规范.色;
  const 厚 = 按下 ? 2.5 : 5;
  const 顶 = 中心Y - 高 / 2 - 厚 / 2 + (按下 ? 1.5 : 0);
  const 左 = 中心X - 宽 / 2;
  const 齿 = Math.max(3, 高 * 0.085);
  const 齿列 = Math.max(4, Math.round(宽 / (齿 * 2.4)));
  const 齿行 = Math.max(3, Math.round(高 / (齿 * 2.4)));
  const 圆齿 = (外扩: number, 纵移: number, 填: (x: number, y: number, r: number) => void) => {
    for (let 序 = 0; 序 <= 齿列; 序 += 1) {
      const x = 左 + (宽 * 序) / 齿列;
      填(x, 顶 + 纵移, 齿 + 外扩);
      填(x, 顶 + 高 + 纵移, 齿 + 外扩);
    }
    for (let 序 = 1; 序 < 齿行; 序 += 1) {
      const y = 顶 + (高 * 序) / 齿行 + 纵移;
      填(左, y, 齿 + 外扩);
      填(左 + 宽, y, 齿 + 外扩);
    }
  };
  const 画层 = (外扩: number, 纵移: number, 色值: number, 透明: number) => {
    绘图
      .fillStyle(色值, 透明)
      .fillRoundedRect(左 - 外扩, 顶 + 纵移 - 外扩, 宽 + 外扩 * 2, 高 + 外扩 * 2, 齿);
    圆齿(外扩, 纵移, (x, y, r) => 绘图.fillCircle(x, y, r));
  };
  画层(0, 厚 + 3, 0x12060a, 按下 ? 0.25 : 0.38);
  画层(1.4, 厚, 色.饼干焦, 1);
  画层(1.4, 0, 色.饼干焦, 1);
  画层(0, 厚, 色.饼干深, 1);
  画层(0, 0, 色.饼干, 1);
  绘图
    .fillGradientStyle(色.饼干浅, 色.饼干浅, 色.饼干, 色.饼干, 0.9, 0.9, 0, 0)
    .fillRoundedRect(左 - 齿 * 0.6, 顶 - 齿 * 0.6, 宽 + 齿 * 1.2, 高 * 0.55, 齿);
  const 框缩 = 齿 + 3;
  绘图
    .lineStyle(1.4, 色.饼干深, 0.7)
    .strokeRoundedRect(左 + 框缩, 顶 + 框缩 + 0.8, 宽 - 框缩 * 2, 高 - 框缩 * 2, 4);
  绘图
    .lineStyle(1, 色.饼干浅, 0.9)
    .strokeRoundedRect(左 + 框缩, 顶 + 框缩 - 0.4, 宽 - 框缩 * 2, 高 - 框缩 * 2, 4);
  const 孔半径 = Math.max(0.9, 高 * 0.035);
  for (const 行 of [0.3, 0.7])
    for (const 列 of [0.2, 0.8]) {
      const x = 左 + 宽 * 列;
      const y = 顶 + 高 * 行;
      绘图.fillStyle(色.饼干焦, 0.7).fillCircle(x, y, 孔半径);
      绘图.fillStyle(色.饼干浅, 0.7).fillCircle(x, y + 孔半径 * 0.8, 孔半径 * 0.6);
    }
  绘图
    .fillStyle(色.白, 按下 ? 0.15 : 0.32)
    .fillEllipse(左 + 宽 * 0.28, 顶 + 高 * 0.2, 宽 * 0.3, 高 * 0.1);
}

/**
 * 双格巧克力：左右移动键。外壳带侧面厚度，面上两块倒角凸起的巧克力格，中间压出凹槽。
 * 中心定位。
 */
export function 绘制巧克力条(
  绘图: 图形对象,
  中心X: number,
  中心Y: number,
  宽: number,
  高: number,
  按下 = false,
): void {
  const 色 = 糖果规范.色;
  const 厚 = 按下 ? 2.5 : 5;
  const 顶 = 中心Y - 高 / 2 - 厚 / 2 + (按下 ? 1.5 : 0);
  const 左 = 中心X - 宽 / 2;
  const 圆角 = Math.min(9, 高 * 0.18);
  绘图.fillStyle(0x12060a, 按下 ? 0.25 : 0.4).fillRoundedRect(左 + 1, 顶 + 厚 + 3, 宽, 高, 圆角);
  绘图
    .fillStyle(色.巧克力深, 1)
    .fillRoundedRect(左 - 1.4, 顶 - 1.4, 宽 + 2.8, 高 + 厚 + 2.8, 圆角 + 1.4);
  绘图.fillStyle(暗色(色.可可深, 0.12), 1).fillRoundedRect(左, 顶 + 厚, 宽, 高, 圆角);
  绘图
    .fillGradientStyle(亮色(色.可可, 0.08), 亮色(色.可可, 0.08), 色.可可深, 色.可可深, 1, 1, 1, 1)
    .fillRoundedRect(左, 顶, 宽, 高, 圆角);
  // 凸起巧克力块：外圈斜面（上亮下暗）+ 内顶面，顶面上两道斜光。
  const 内左 = 左 + 4;
  const 内上 = 顶 + 4;
  const 内宽 = 宽 - 8;
  const 内高 = 高 - 8;
  const 倒 = Math.min(5, 内高 * 0.16);
  绘图.fillStyle(暗色(色.可可深, 0.3), 1).fillRoundedRect(内左, 内上, 内宽, 内高, 4);
  绘图.fillStyle(亮色(色.可可, 0.3), 1).fillRoundedRect(内左, 内上, 内宽 - 1, 内高 - 1.5, 4);
  const 顶面: 边界 = { 左: 内左 + 倒, 上: 内上 + 倒, 右: 内左 + 内宽 - 倒, 下: 内上 + 内高 - 倒 };
  const 顶面形 = 圆角多边形(顶面, 同角(3));
  绘图
    .fillGradientStyle(
      亮色(色.可可, 0.12),
      亮色(色.可可, 0.12),
      色.可可,
      暗色(色.可可, 0.1),
      1,
      1,
      1,
      1,
    )
    .fillPoints(顶面形, true);
  for (const [起, 带宽, 透明] of [
    [顶面.左 - 顶面.上 + 内宽 * 0.18, 内宽 * 0.16, 0.14],
    [顶面.左 - 顶面.上 + 内宽 * 0.4, 内宽 * 0.06, 0.1],
  ] as const) {
    const 光 = 裁进凸形(斜带(起, 带宽, 顶面.上, 顶面.下), 顶面形);
    if (光.length >= 3) 绘图.fillStyle(色.白, 按下 ? 透明 * 0.5 : 透明).fillPoints(光, true);
  }
  绘图
    .fillStyle(色.白, 按下 ? 0.08 : 0.2)
    .fillRoundedRect(左 + 5, 顶 + 2.5, 宽 * 0.42, Math.max(1.6, 高 * 0.06), 1);
}

/**
 * 珊瑚糖纸糖：软降键。圆润糖身、金色收口与两端扭结糖纸，双折线压在糖身中心。
 * 中心定位，宽高是整颗糖（含扭结）的外接框。
 */
export function 绘制糖纸硬降(
  绘图: 图形对象,
  中心X: number,
  中心Y: number,
  宽: number,
  高: number,
  按下 = false,
): void {
  const 色 = 糖果规范.色;
  const 厚 = 按下 ? 2 : 4;
  const cy = 中心Y - 厚 / 2 + (按下 ? 1.5 : 0);
  const 身高 = 高 - 厚 - 4;
  const 身宽 = Math.max(身高 * 1.3, 宽 - 身高 * 1.3);
  const 左 = 中心X - 身宽 / 2;
  const 顶 = cy - 身高 / 2;
  const 圆角 = 身高 / 2;
  for (const 向 of [-1, 1] as const)
    绘制糖纸扭结(绘图, 中心X + 向 * (身宽 / 2 - 2), cy, 身高, 向, 色.珊瑚, 色.珊瑚深);
  绘图
    .fillStyle(0x12060a, 按下 ? 0.25 : 0.38)
    .fillRoundedRect(左 + 1, 顶 + 厚 + 3, 身宽, 身高, 圆角);
  绘图
    .fillStyle(色.莓暗, 1)
    .fillRoundedRect(左 - 1.4, 顶 - 1.4, 身宽 + 2.8, 身高 + 厚 + 2.8, 圆角 + 1.4);
  绘图.fillStyle(暗色(色.珊瑚深, 0.2), 1).fillRoundedRect(左, 顶 + 厚, 身宽, 身高, 圆角);
  绘图
    .fillGradientStyle(亮色(色.珊瑚, 0.22), 亮色(色.珊瑚, 0.22), 色.珊瑚深, 色.珊瑚深, 1, 1, 1, 1)
    .fillRoundedRect(左, 顶, 身宽, 身高, 圆角);
  // 金色收口：糖身两端各一道金箍。
  for (const 向 of [-1, 1] as const) {
    const x = 中心X + 向 * (身宽 / 2 - 身高 * 0.2);
    绘图.fillStyle(色.金深, 1).fillRoundedRect(x - 3, 顶 + 身高 * 0.12, 6, 身高 * 0.76, 3);
    绘图.fillStyle(色.金, 1).fillRoundedRect(x - 2.2, 顶 + 身高 * 0.12, 3.6, 身高 * 0.7, 2);
  }
  绘图
    .fillStyle(色.白, 按下 ? 0.25 : 0.55)
    .fillRoundedRect(左 + 身高 * 0.5, 顶 + 身高 * 0.12, 身宽 * 0.42, Math.max(2, 身高 * 0.12), 3);
  绘图
    .fillStyle(色.白, 0.3)
    .fillCircle(左 + 身高 * 0.42, 顶 + 身高 * 0.2, Math.max(1.2, 身高 * 0.05));
  绘图
    .fillStyle(暗色(色.珊瑚深, 0.15), 0.35)
    .fillRoundedRect(
      左 + 身高 * 0.3,
      顶 + 身高 * 0.78,
      身宽 - 身高 * 0.6,
      Math.max(2, 身高 * 0.1),
      3,
    );
}
