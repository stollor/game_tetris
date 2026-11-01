import type { 图形对象 } from "../../../.gamemaker/依赖/框架/界面/绘制/协议";
import { 亮色, 暗色, 混色 } from "../../../.gamemaker/依赖/框架/界面/颜色工具";
import { 糖果规范 } from "../../主题/糖果/糖果规范";
import { 绘制糖粒 } from "../../预制体/基础/装饰与蒙层/糖果花纹";
import { 绘制暗角, 随机值 } from "./通用";

/**
 * 「糖果超甜」的正式背景：酒红糖果铺的墙面——上浅下深的酒红底、淡竖纹墙纸、
 * 顶部一条深玫瑰扇贝帘、角落的棒棒糖与松露巧克力、散落的彩色糖针。
 * 与像素/立体背景同职责：只依赖 `图形对象` 与 `糖果规范`，
 * 不读设置、不 import 引擎运行时；静态层可单独取帧给缩略图与预览。
 */

const 色 = 糖果规范.色;

/** 顶部扇贝帘高度（按高度比例，小屏不至于吃掉标题）。 */
function 帘高(高: number): number {
  return Math.min(糖果规范.背景.顶部条纹高 * 0.36, 高 * 0.032);
}

/** 静态底图：底、墙纸竖纹、扇贝帘、角落甜点、糖针与暗角。 */
export function 绘制糖果背景(绘图: 图形对象, 宽: number, 高: number): void {
  const 顶色 = 混色(色.酒红, 色.莓, 0.3);
  绘图.fillGradientStyle(顶色, 顶色, 色.酒红深, 色.酒红深, 1, 1, 1, 1).fillRect(0, 0, 宽, 高);
  // 墙纸竖纹：宽窄两档交替，透明度很低，只在大面积空处读得出来。
  const 纹宽 = Math.max(10, 宽 * 0.046);
  for (let x = 0; x < 宽; x += 纹宽 * 2) {
    绘图.fillStyle(色.莓, 0.12).fillRect(x, 0, 纹宽, 高);
    绘图.fillStyle(色.莓浅, 0.05).fillRect(x + 纹宽 * 0.45, 0, Math.max(1, 纹宽 * 0.08), 高);
  }
  // 糖霜细点：固定随机种子，帧间不闪。
  for (let 序 = 0; 序 < 90; 序 += 1) {
    const x = 随机值(序 + 1201) * 宽;
    const y = 随机值(序 + 1321) * 高;
    const r = 0.6 + 随机值(序 + 1441) * 0.9;
    绘图.fillStyle(色.莓浅, 0.06 + 随机值(序 + 1561) * 0.06).fillCircle(x, y, r);
  }
  const 单位 = Math.min(宽, 高);
  绘制棒棒糖(绘图, 宽 * 0.02, 高 * 0.118, 单位 * 0.085);
  绘制巧克力球(绘图, 宽 * 0.985, 高 * 0.07, 单位 * 0.06);
  绘制巧克力球(绘图, 宽 * 0.93, 高 * 0.085, 单位 * 0.045);
  绘制马卡龙(绘图, 宽 * 0.04, 高 * 0.54, 单位 * 0.03, 色.薄荷, 色.薄荷深);
  绘制甜甜圈(绘图, 宽 * 0.97, 高 * 0.92, 单位 * 0.07);
  绘制巧克力球(绘图, 宽 * 0.03, 高 * 0.93, 单位 * 0.05);
  // 散落的彩色糖针：短胶囊，方向随机。
  const 糖色 = [色.薄荷, 色.叶绿, 色.蓝莓, 色.葡萄, 色.橙, 色.柠檬, 色.草莓糖, 色.象牙];
  for (let 序 = 0; 序 < 糖果规范.背景.糖粒数 + 14; 序 += 1) {
    const x = 随机值(序 + 2101) * 宽;
    const y = 帘高(高) + 随机值(序 + 2221) * (高 - 帘高(高));
    const 色值 = 糖色[序 % 糖色.length] ?? 色.草莓糖;
    绘制糖针(绘图, x, y, 2.6 + 随机值(序 + 2341) * 2.4, 色值, 0.5, 随机值(序 + 2581) * Math.PI);
  }
  绘制扇贝帘(绘图, 宽, 帘高(高));
  绘制暗角(绘图, 宽, 高);
}

/** 顶部扇贝帘：深玫瑰竖条底，下缘一排半圆，扇贝上点一颗高光。 */
function 绘制扇贝帘(绘图: 图形对象, 宽: number, 高: number): void {
  const 半径 = Math.max(6, 高 * 0.62);
  const 数 = Math.max(4, Math.round(宽 / (半径 * 2)));
  const 步 = 宽 / 数;
  绘图.fillStyle(色.莓暗, 0.55);
  for (let 序 = 0; 序 < 数; 序 += 1) 绘图.fillCircle(步 * (序 + 0.5), 高 + 2, 步 / 2);
  绘图.fillStyle(色.莓深, 1).fillRect(0, 0, 宽, 高);
  for (let 序 = 0; 序 < 数; 序 += 1) {
    绘图.fillStyle(序 % 2 === 0 ? 色.莓深 : 混色(色.莓深, 色.莓, 0.35), 1);
    绘图.fillRect(步 * 序, 0, 步, 高);
    绘图.fillCircle(步 * (序 + 0.5), 高, 步 / 2);
  }
  绘图.fillStyle(色.莓浅, 0.18);
  for (let 序 = 0; 序 < 数; 序 += 1)
    绘图.fillEllipse(步 * (序 + 0.5), 高 + 步 * 0.18, 步 * 0.42, 步 * 0.14);
}

/** 一根糖针：圆头胶囊加一道亮边。 */
function 绘制糖针(
  绘图: 图形对象,
  x: number,
  y: number,
  长: number,
  色值: number,
  透明度: number,
  旋转: number,
): void {
  const 粗 = Math.max(1.4, 长 * 0.36);
  绘图.save().translateCanvas(x, y).rotateCanvas(旋转);
  绘图.fillStyle(色值, 透明度).fillRoundedRect(-长 / 2, -粗 / 2, 长, 粗, 粗 / 2);
  绘图
    .fillStyle(0xffffff, 0.45 * 透明度)
    .fillRoundedRect(-长 / 2 + 粗 * 0.3, -粗 / 2 + 粗 * 0.15, 长 - 粗 * 0.6, 粗 * 0.3, 粗 * 0.15);
  绘图.restore();
}

/** 动态层：缓慢飘落的糖粒、糖霜光斑与甜点微光；亮度乘子与其它主题一致。 */
export function 绘制糖果背景动态(
  绘图: 图形对象,
  宽: number,
  高: number,
  时间秒: number,
  亮度 = 1,
): void {
  const 单位 = Math.min(宽, 高);
  const 糖色 = [色.薄荷, 色.叶绿, 色.蓝莓, 色.葡萄, 色.橙, 色.柠檬, 色.草莓糖];
  // 飘落糖粒：每颗按不同速度与横向摆幅循环下落。
  for (let 序 = 0; 序 < 30; 序 += 1) {
    const 速度 = 0.012 + 随机值(序 + 3101) * 0.02;
    const 循环 = (时间秒 * 速度 + 随机值(序 + 3221)) % 1;
    const y = 高 * 1.02 - 循环 * 高 * 1.08;
    const 摆 = Math.sin(时间秒 * (0.4 + 随机值(序 + 3341) * 0.6) + 序) * 宽 * 0.02;
    const x = 随机值(序 + 3461) * 宽 + 摆;
    const 半径 = 1.2 + 随机值(序 + 3581) * 1.8;
    const 色值 = 糖色[序 % 糖色.length] ?? 色.草莓糖;
    绘制糖粒(
      绘图,
      x,
      y,
      半径,
      色值,
      (0.3 + 随机值(序 + 3701) * 0.25) * 亮度,
      时间秒 * (0.4 + 序 * 0.05),
    );
  }
  // 甜点微光：角落插画上缓慢呼吸的高光。
  const 呼吸 = 0.5 + 0.5 * Math.sin(时间秒 * 1.1);
  绘制光斑(绘图, 宽 * 0.04, 高 * 0.12, 单位 * 0.1, 色.莓浅, 0.08 * 呼吸 * 亮度);
  绘制光斑(绘图, 宽 * 0.95, 高 * 0.08, 单位 * 0.09, 色.草莓浅, 0.07 * 呼吸 * 亮度);
  绘制光斑(绘图, 宽 * 0.95, 高 * 0.9, 单位 * 0.09, 色.金, 0.06 * (1 - 呼吸) * 亮度);
}

/** 柔和光斑：两层同心圆，叠加后不刺眼。 */
function 绘制光斑(
  绘图: 图形对象,
  x: number,
  y: number,
  半径: number,
  颜: number,
  透明度: number,
): void {
  绘图.fillStyle(颜, 透明度 * 0.35).fillCircle(x, y, 半径);
  绘图.fillStyle(颜, 透明度 * 0.22).fillCircle(x, y, 半径 * 0.62);
}

/* ------------------------------------------------------------------ */
/* 甜点插画                                                            */
/* ------------------------------------------------------------------ */

/** 棒棒糖：奶油糖面 + 螺旋糖纹 + 糖棍。 */
function 绘制棒棒糖(绘图: 图形对象, x: number, y: number, 半径: number): void {
  const 倾角 = -0.35;
  const 棍长 = 半径 * 2.2;
  const 棍端X = x + Math.sin(倾角) * 棍长;
  const 棍端Y = y + Math.cos(倾角) * 棍长;
  绘图.lineStyle(Math.max(2, 半径 * 0.16), 色.奶油深, 0.9).lineBetween(x, y, 棍端X, 棍端Y);
  绘图.fillStyle(色.奶油, 1).fillCircle(x, y, 半径);
  绘图.fillStyle(色.粉, 0.95).fillCircle(x, y, 半径 * 0.9);
  // 螺旋糖纹：按阿基米德螺线采样成折线。
  const 段 = 26;
  for (let 序 = 0; 序 < 段; 序 += 1) {
    const t0 = 序 / 段;
    const t1 = (序 + 1) / 段;
    const a0 = t0 * Math.PI * 3.2;
    const a1 = t1 * Math.PI * 3.2;
    const r0 = 半径 * (0.14 + t0 * 0.78);
    const r1 = 半径 * (0.14 + t1 * 0.78);
    绘图
      .lineStyle(Math.max(1.2, 半径 * 0.12), 色.草莓浅, 0.92)
      .lineBetween(
        x + Math.cos(a0) * r0,
        y + Math.sin(a0) * r0,
        x + Math.cos(a1) * r1,
        y + Math.sin(a1) * r1,
      );
  }
  绘图.fillStyle(色.白, 0.5).fillEllipse(x - 半径 * 0.3, y - 半径 * 0.38, 半径 * 0.5, 半径 * 0.3);
}

/** 马卡龙：上下两片糖壳 + 中间奶油夹心。 */
function 绘制马卡龙(
  绘图: 图形对象,
  x: number,
  y: number,
  半径: number,
  壳色: number,
  深色: number,
): void {
  绘图.fillStyle(暗色(壳色, 0.3), 1).fillEllipse(x, y + 半径 * 0.12, 半径 * 2, 半径 * 1.1);
  绘图.fillStyle(壳色, 1).fillEllipse(x, y - 半径 * 0.34, 半径 * 1.9, 半径 * 0.72);
  绘图.fillStyle(壳色, 1).fillEllipse(x, y + 半径 * 0.34, 半径 * 1.9, 半径 * 0.72);
  绘图.fillStyle(色.奶油, 1).fillEllipse(x, y, 半径 * 1.78, 半径 * 0.42);
  绘图
    .fillStyle(深色, 0.55)
    .fillRect(x - 半径 * 0.9, y + 半径 * 0.06, 半径 * 1.8, Math.max(1, 半径 * 0.08));
  绘图
    .fillStyle(色.白, 0.45)
    .fillEllipse(x - 半径 * 0.34, y - 半径 * 0.5, 半径 * 0.62, 半径 * 0.24);
}

/** 巧克力球：深巧圆 + 顶部反光 + 可可粉点。 */
function 绘制巧克力球(绘图: 图形对象, x: number, y: number, 半径: number): void {
  绘图.fillStyle(暗色(色.可可, 0.4), 0.9).fillCircle(x + 1, y + 2, 半径);
  绘图.fillStyle(色.可可, 1).fillCircle(x, y, 半径);
  绘图
    .fillStyle(亮色(色.可可, 0.28), 0.85)
    .fillCircle(x - 半径 * 0.12, y - 半径 * 0.14, 半径 * 0.82);
  绘图.fillStyle(色.白, 0.4).fillEllipse(x - 半径 * 0.34, y - 半径 * 0.4, 半径 * 0.44, 半径 * 0.26);
  for (let 序 = 0; 序 < 5; 序 += 1)
    绘图
      .fillStyle(色.奶油, 0.22)
      .fillCircle(
        x + (随机值(序 + 4101) - 0.5) * 半径 * 1.3,
        y + (随机值(序 + 4221) - 0.5) * 半径 * 1.3,
        Math.max(0.6, 半径 * 0.06),
      );
}

/** 甜甜圈：糖霜圆环 + 彩色糖针。 */
function 绘制甜甜圈(绘图: 图形对象, x: number, y: number, 半径: number): void {
  const 糖针 = [色.薄荷, 色.叶绿, 色.蓝莓, 色.葡萄, 色.橙, 色.柠檬];
  绘图.fillStyle(暗色(色.奶油深, 0.25), 0.9).fillCircle(x + 1, y + 2, 半径);
  绘图.fillStyle(色.奶油深, 1).fillCircle(x, y, 半径);
  绘图.fillStyle(色.粉, 1).fillCircle(x, y, 半径 * 0.94);
  绘图.fillStyle(色.草莓浅, 1).fillCircle(x, y, 半径 * 0.88);
  绘图.fillStyle(色.巧克力浅, 1).fillCircle(x, y, 半径 * 0.34);
  for (let 序 = 0; 序 < 12; 序 += 1) {
    const 角 = 随机值(序 + 5101) * Math.PI * 2;
    const 距 = 半径 * (0.42 + 随机值(序 + 5221) * 0.42);
    const 色值 = 糖针[序 % 糖针.length] ?? 色.薄荷;
    绘图
      .lineStyle(Math.max(1.2, 半径 * 0.08), 色值, 0.95)
      .lineBetween(
        x + Math.cos(角) * 距,
        y + Math.sin(角) * 距,
        x + Math.cos(角) * 距 + Math.cos(角 + 1.2) * 半径 * 0.12,
        y + Math.sin(角) * 距 + Math.sin(角 + 1.2) * 半径 * 0.12,
      );
  }
  绘图.fillStyle(色.白, 0.35).fillEllipse(x - 半径 * 0.4, y - 半径 * 0.52, 半径 * 0.4, 半径 * 0.2);
}
