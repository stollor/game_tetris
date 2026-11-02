import { 读取操作键规格 } from "../../../../.gamemaker/依赖/框架/样式/控件规格";
import { 亮色, 暗色, 混色 } from "../../../../.gamemaker/依赖/框架/界面/颜色工具";
import type { 对局布局操作键, 对局布局数据 } from "../../../../代码/页面/布局/对局布局";
import { 糖果规范 } from "../../../主题/糖果/糖果规范";
import { 圆角路径, 扇贝路径 } from "../../基础/装饰与蒙层/糖果画布";
import { 串 } from "./工具";

/**
 * 底板·底部操作盘：玫瑰糖托盘 + 六颗甜点键身。
 *
 * 托盘与键身都用 canvas 2D 画在整屏底板上（径向受光、柔影、斜纹、糖霜都是图形协议给不了的）；
 * 键上的矢量图标留给上层 `操作键配方`，按下态也在上层用矢量覆盖，键身位图因此可以只烘一次。
 * 颜色全部从 `糖果规范` 派生，尺寸只读 `对局布局.操作区.键` 与控件规格的托盘外扩。
 */

const 色 = 糖果规范.色;
/** 托盘外沿：莓亮掺一点饼干深，压掉紫味，读作灰玫瑰糖边。 */
const 盘沿 = 混色(混色(色.莓亮, 色.饼干深, 0.42), 色.草莓, 0.2);
/** 托盘内槽：莓深掺饼干深提亮一档，别沉成黑紫。 */
const 槽面 = 混色(色.莓深, 色.饼干深, 0.18);

/* ------------------------------------------------------------------ */
/* 接管标记：底板烘过托盘/键身后，矢量层只画图标与按下覆盖                 */
/* ------------------------------------------------------------------ */

let 已烘焙托盘 = "";
const 已烘焙键集 = new Set<string>();

function 键特征(键: 对局布局操作键): string {
  return `${键.名称}|${键.中心X.toFixed(2)}|${键.中心Y.toFixed(2)}|${键.宽.toFixed(2)}|${键.高.toFixed(2)}`;
}

/** 当前布局的托盘是否已由底板烘焙（矢量层据此跳过托盘形状）。 */
export function 糖果底板已接管托盘(键列表: readonly 对局布局操作键[]): boolean {
  if (键列表.length === 0 || 已烘焙托盘 === "") return false;
  return [...键列表].map(键特征).sort().join(";") === 已烘焙托盘;
}

/** 这颗键的键身是否已由底板烘焙（矢量层据此跳过键身形状）。 */
export function 糖果底板已接管键(键: 对局布局操作键): boolean {
  return 已烘焙键集.has(键特征(键));
}

/* ------------------------------------------------------------------ */
/* 画布小工具                                                          */
/* ------------------------------------------------------------------ */

type 色标 = readonly [number, string];

function 线性(
  笔: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  色标表: readonly 色标[],
) {
  const 渐变 = 笔.createLinearGradient(x0, y0, x1, y1);
  for (const [位置, 颜色] of 色标表) 渐变.addColorStop(位置, 颜色);
  return 渐变;
}

function 径向(
  笔: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  内径: number,
  x1: number,
  y1: number,
  外径: number,
  色标表: readonly 色标[],
) {
  const 渐变 = 笔.createRadialGradient(x0, y0, 内径, x1, y1, 外径);
  for (const [位置, 颜色] of 色标表) 渐变.addColorStop(位置, 颜色);
  return 渐变;
}

/** 当前画布的设备倍率：canvas 的 shadowBlur / shadowOffset 不吃变换矩阵，要自己乘回去。 */
function 设备倍率(笔: CanvasRenderingContext2D): number {
  const 倍 = Math.abs(笔.getTransform().a);
  return 倍 > 0 ? 倍 : 1;
}

/** 设一层柔和落影，返回设备倍率（供调用方再除回去）。 */
function 落影(笔: CanvasRenderingContext2D, 颜色: string, 模糊: number, 下移: number): void {
  const 倍 = 设备倍率(笔);
  笔.shadowColor = 颜色;
  笔.shadowBlur = 模糊 * 倍;
  笔.shadowOffsetY = 下移 * 倍;
}

/** 花边（扇贝）椭圆路径：四周一圈半圆瓣，读作裱花收口。 */
function 花边椭圆(
  笔: CanvasRenderingContext2D,
  中心X: number,
  中心Y: number,
  横半径: number,
  纵半径: number,
  瓣数: number,
  起伏: number,
): void {
  const 段 = Math.max(24, 瓣数 * 6);
  笔.beginPath();
  for (let 序 = 0; 序 <= 段; 序 += 1) {
    const 角 = (序 / 段) * Math.PI * 2;
    const 波 = 1 + 起伏 * Math.cos(角 * 瓣数);
    const x = 中心X + Math.cos(角) * 横半径 * 波;
    const y = 中心Y + Math.sin(角) * 纵半径 * 波;
    if (序 === 0) 笔.moveTo(x, y);
    else 笔.lineTo(x, y);
  }
  笔.closePath();
}

/* ------------------------------------------------------------------ */
/* 托盘                                                                */
/* ------------------------------------------------------------------ */

/** 玫瑰糖托盘：外沿一圈受光亮边，内槽压深，槽沿吃影、底沿反光。 */
export function 画糖果操作托盘(
  笔: CanvasRenderingContext2D,
  左: number,
  上: number,
  宽: number,
  高: number,
): void {
  const 圆角 = Math.max(16, Math.min(22, 高 * 0.17));
  const 缩 = Math.max(4.2, 高 * 0.034);
  const 槽左 = 左 + 缩;
  const 槽上 = 上 + 缩;
  const 槽宽 = 宽 - 缩 * 2;
  const 槽高 = 高 - 缩 * 2;
  const 槽角 = Math.max(9, 圆角 - 缩);

  // ① 整盘落影：托盘压在巧克力墙上，近层实、远层淡。
  笔.save();
  落影(笔, 串(色.巧克力深, 0.5), 12, 5);
  圆角路径(笔, 左, 上 + 1, 宽, 高, 圆角);
  笔.fillStyle = 串(色.莓暗);
  笔.fill();
  笔.restore();

  // ② 盘底侧壁：下缘露一圈深莓厚度，再压一道底影。
  圆角路径(笔, 左 + 0.5, 上 + 3.5, 宽 - 1, 高 - 1, 圆角);
  笔.fillStyle = 串(色.莓暗);
  笔.fill();

  // ③ 盘面：上亮下深的玫瑰木。
  圆角路径(笔, 左, 上, 宽, 高, 圆角);
  笔.fillStyle = 线性(笔, 0, 上, 0, 上 + 高, [
    [0, 串(亮色(盘沿, 0.16))],
    [0.34, 串(盘沿)],
    [0.72, 串(混色(盘沿, 色.莓, 0.45))],
    [1, 串(混色(色.莓, 色.莓暗, 0.22))],
  ]);
  笔.fill();

  // ④ 盘面内：顶棱亮带 + 底部内阴影。
  笔.save();
  圆角路径(笔, 左, 上, 宽, 高, 圆角);
  笔.clip();
  笔.fillStyle = 线性(笔, 0, 上, 0, 上 + 14, [
    [0, "rgba(255,226,232,0.5)"],
    [1, "rgba(255,226,232,0)"],
  ]);
  笔.fillRect(左, 上, 宽, 14);
  笔.fillStyle = 线性(笔, 0, 上 + 高 - 20, 0, 上 + 高, [
    [0, "rgba(0,0,0,0)"],
    [1, 串(色.巧克力深, 0.45)],
  ]);
  笔.fillRect(左, 上 + 高 - 20, 宽, 20);
  笔.restore();

  // ⑤ 外沿描边：左上受光、右下压暗，用一道斜向渐变描边同时给出两者。
  笔.save();
  圆角路径(笔, 左 + 0.9, 上 + 0.9, 宽 - 1.8, 高 - 1.8, 圆角 - 0.9);
  笔.strokeStyle = 线性(笔, 左, 上, 左 + 宽, 上 + 高, [
    [0, 串(色.莓浅, 0.75)],
    [0.55, 串(色.莓浅, 0.15)],
    [1, 串(暗色(色.莓, 0.4), 0.5)],
  ]);
  笔.lineWidth = 1.6;
  笔.stroke();
  笔.restore();

  // ⑥ 内槽：槽肩台阶 + 凹面 + 上沿吃影 + 底沿反光唇 + 左右内壁压深。
  圆角路径(笔, 槽左 - 1.6, 槽上 - 1.6, 槽宽 + 3.2, 槽高 + 3.2, 槽角 + 1.6);
  笔.fillStyle = 串(暗色(色.莓, 0.26), 0.6);
  笔.fill();
  圆角路径(笔, 槽左, 槽上, 槽宽, 槽高, 槽角);
  笔.fillStyle = 线性(笔, 0, 槽上, 0, 槽上 + 槽高, [
    [0, 串(暗色(槽面, 0.1))],
    [0.55, 串(槽面)],
    [1, 串(暗色(槽面, 0.06))],
  ]);
  笔.fill();
  笔.save();
  圆角路径(笔, 槽左, 槽上, 槽宽, 槽高, 槽角);
  笔.clip();
  笔.fillStyle = 线性(笔, 0, 槽上, 0, 槽上 + 22, [
    [0, 串(色.巧克力深, 0.15)],
    [0.6, 串(色.巧克力深, 0.04)],
    [1, "rgba(0,0,0,0)"],
  ]);
  笔.fillRect(槽左, 槽上, 槽宽, 22);
  笔.fillStyle = 线性(笔, 0, 槽上 + 槽高 - 7, 0, 槽上 + 槽高, [
    [0, "rgba(0,0,0,0)"],
    [1, 串(色.莓浅, 0.22)],
  ]);
  笔.fillRect(槽左, 槽上 + 槽高 - 7, 槽宽, 7);
  笔.fillStyle = 线性(笔, 槽左, 0, 槽左 + 11, 0, [
    [0, 串(色.巧克力深, 0.1)],
    [1, "rgba(0,0,0,0)"],
  ]);
  笔.fillRect(槽左, 槽上, 11, 槽高);
  笔.fillStyle = 线性(笔, 槽左 + 槽宽 - 11, 0, 槽左 + 槽宽, 0, [
    [0, "rgba(0,0,0,0)"],
    [1, 串(色.巧克力深, 0.09)],
  ]);
  笔.fillRect(槽左 + 槽宽 - 11, 槽上, 11, 槽高);
  笔.restore();
  笔.save();
  圆角路径(笔, 槽左 + 0.6, 槽上 + 0.6, 槽宽 - 1.2, 槽高 - 1.2, 槽角);
  笔.strokeStyle = 串(色.莓浅, 0.18);
  笔.lineWidth = 1;
  笔.stroke();
  笔.restore();
}

/* ------------------------------------------------------------------ */
/* 上排：花边漩涡饼干 / 波浪威化 / 糖霜甜甜圈                            */
/* ------------------------------------------------------------------ */

/** 花边漩涡饼干（左转）：裱花盘一圈花边，三圈错位漩涡，左上受光。 */
function 画漩涡饼干(
  笔: CanvasRenderingContext2D,
  中心X: number,
  中心Y: number,
  区宽: number,
  区高: number,
): void {
  const 横半径 = Math.min(区宽 / 2 - 3, 39);
  const 纵半径 = Math.min(区高 / 2 + 1, 30);
  const cy = 中心Y - 2;
  const 厚 = 5;
  const 瓣数 = 11;
  const 花边 = (外扩: number, 纵移: number) =>
    花边椭圆(笔, 中心X, cy + 纵移, 横半径 + 外扩, 纵半径 + 外扩, 瓣数, 0.05);

  // ① 接触投影 + ② 焦糖侧壁
  笔.save();
  落影(笔, 串(色.巧克力深, 0.5), 6, 4);
  花边(0.9, 0.8);
  笔.fillStyle = 串(色.饼干焦);
  笔.fill();
  笔.restore();
  花边(0.9, 厚);
  笔.fillStyle = 串(暗色(色.饼干焦, 0.3));
  笔.fill();
  花边(0.9, 厚 * 0.45);
  笔.fillStyle = 串(色.饼干焦);
  笔.fill();

  // ③ 饼干面：左上奶油径向受光，右下压暖褐。
  花边(0, 0);
  笔.fillStyle = 径向(笔, 中心X - 横半径 * 0.42, cy - 纵半径 * 0.52, 0, 中心X, cy, 横半径 * 1.55, [
    [0, 串(亮色(色.饼干浅, 0.3))],
    [0.34, 串(色.饼干浅)],
    [0.7, 串(混色(色.饼干浅, 色.饼干, 0.5))],
    [1, 串(混色(色.饼干, 色.饼干深, 0.58))],
  ]);
  笔.fill();

  // ④ 裱花漩涡：三圈错位弧，暗谷 + 贴外亮脊；中心挤一朵花心。
  笔.save();
  花边(0, 0);
  笔.clip();
  笔.lineCap = "round";
  const 臂数 = 7;
  for (let 序 = 0; 序 < 臂数; 序 += 1) {
    const 起角 = (序 / 臂数) * Math.PI * 2;
    const 谷: { x: number; y: number }[] = [];
    for (let 步 = 0; 步 <= 16; 步 += 1) {
      const 比 = 步 / 16;
      const 角 = 起角 + 比 * 1.45;
      const 半 = 0.2 + 比 * 0.76;
      谷.push({ x: 中心X + Math.cos(角) * 横半径 * 半, y: cy + Math.sin(角) * 纵半径 * 半 });
    }
    笔.beginPath();
    for (const [序2, 点] of 谷.entries()) {
      if (序2 === 0) 笔.moveTo(点.x, 点.y);
      else 笔.lineTo(点.x, 点.y);
    }
    笔.strokeStyle = 串(暗色(色.饼干深, 0.3), 0.32);
    笔.lineWidth = 3.4;
    笔.stroke();
    笔.beginPath();
    for (const [序2, 点] of 谷.entries()) {
      const x = 点.x + (点.x - 中心X) * 0.09;
      const y = 点.y + (点.y - cy) * 0.09;
      if (序2 === 0) 笔.moveTo(x, y);
      else 笔.lineTo(x, y);
    }
    笔.strokeStyle = 串(亮色(色.饼干浅, 0.62), 0.35);
    笔.lineWidth = 2.2;
    笔.stroke();
  }
  笔.beginPath();
  笔.ellipse(中心X, cy - 纵半径 * 0.05, 横半径 * 0.2, 纵半径 * 0.2, 0, 0, Math.PI * 2);
  笔.fillStyle = 串(亮色(色.饼干浅, 0.35), 0.8);
  笔.fill();
  笔.strokeStyle = 串(暗色(色.饼干, 0.24), 0.55);
  笔.lineWidth = 1.3;
  笔.stroke();
  // ⑤ 左上镜面 + 底部内阴影
  笔.beginPath();
  笔.ellipse(
    中心X - 横半径 * 0.34,
    cy - 纵半径 * 0.54,
    横半径 * 0.4,
    纵半径 * 0.18,
    -0.35,
    0,
    Math.PI * 2,
  );
  笔.fillStyle = "rgba(255,246,228,0.34)";
  笔.fill();
  笔.fillStyle = 线性(笔, 0, cy + 纵半径 * 0.42, 0, cy + 纵半径, [
    [0, "rgba(0,0,0,0)"],
    [1, 串(暗色(色.饼干, 0.38), 0.34)],
  ]);
  笔.fillRect(中心X - 横半径, cy + 纵半径 * 0.42, 横半径 * 2, 纵半径 * 0.6);
  笔.restore();

  // ⑥ 花边外沿：一圈奶油亮线，右下收暗。
  笔.save();
  花边(0.35, -0.5);
  笔.strokeStyle = 线性(笔, 中心X - 横半径, cy - 纵半径, 中心X + 横半径, cy + 纵半径, [
    [0, 串(亮色(色.饼干浅, 0.6), 0.85)],
    [0.6, 串(亮色(色.饼干浅, 0.4), 0.35)],
    [1, 串(暗色(色.饼干, 0.2), 0.45)],
  ]);
  笔.lineWidth = 1.2;
  笔.stroke();
  笔.restore();
}

/** 波浪边威化（暂存）：四边一圈圆齿，面上戳孔，底边露一圈带竖压痕的侧壁。 */
function 画威化饼干(
  笔: CanvasRenderingContext2D,
  中心X: number,
  中心Y: number,
  区宽: number,
  区高: number,
): void {
  const 齿 = Math.max(3.8, Math.min(区高 * 0.09, 5.2));
  const 宽 = Math.min(区宽 - 4, 118);
  const 高 = Math.min(区高 - 2, 56);
  const 左 = 中心X - 宽 / 2;
  const 顶 = 中心Y - 高 / 2 - 1;
  const 厚 = 7;
  const 威化面 = 混色(混色(色.饼干, 色.珊瑚, 0.38), 色.饼干深, 0.08);
  const 扇贝 = (纵移: number, 外扩: number) =>
    扇贝路径(
      笔,
      左 + 齿 - 外扩,
      顶 + 纵移 + 齿 - 外扩,
      宽 - 齿 * 2 + 外扩 * 2,
      高 - 齿 * 2 + 外扩 * 2,
      齿,
    );

  // ① 接触投影 + ② 侧壁
  笔.save();
  落影(笔, 串(色.巧克力深, 0.5), 6, 4);
  扇贝(厚, 0.7);
  笔.fillStyle = 串(暗色(色.饼干焦, 0.35));
  笔.fill();
  笔.restore();
  扇贝(厚, 0);
  笔.fillStyle = 串(混色(威化面, 色.饼干焦, 0.62));
  笔.fill();
  // 侧壁竖压痕：花边挤出的饼干侧面是一道道竖棱
  笔.save();
  扇贝(厚, 0);
  笔.clip();
  const 痕数 = Math.max(6, Math.round(宽 / 9));
  for (let 序 = 0; 序 <= 痕数; 序 += 1) {
    const x = 左 + (宽 * 序) / 痕数;
    笔.beginPath();
    笔.moveTo(x, 顶 + 高 - 3);
    笔.lineTo(x, 顶 + 高 + 厚 + 1);
    笔.strokeStyle = 串(暗色(色.饼干深, 0.4), 0.5);
    笔.lineWidth = 1.2;
    笔.stroke();
    笔.beginPath();
    笔.moveTo(x + 2.4, 顶 + 高 - 3);
    笔.lineTo(x + 2.4, 顶 + 高 + 厚 + 1);
    笔.strokeStyle = 串(亮色(色.饼干浅, 0.3), 0.4);
    笔.lineWidth = 1;
    笔.stroke();
  }
  笔.restore();

  // ③ 饼干面：上亮下暗的奶油渐变。
  扇贝(0, 0);
  笔.fillStyle = 线性(笔, 0, 顶, 0, 顶 + 高, [
    [0, 串(亮色(威化面, 0.34))],
    [0.36, 串(威化面)],
    [0.86, 串(混色(威化面, 色.饼干深, 0.5))],
    [1, 串(混色(威化面, 色.饼干焦, 0.46))],
  ]);
  笔.fill();

  // ④ 面内细节：内框压线 + 戳孔 + 顶部受光带。
  笔.save();
  扇贝(0, 0);
  笔.clip();
  笔.fillStyle = 线性(笔, 0, 顶, 0, 顶 + 16, [
    [0, "rgba(255,242,220,0.2)"],
    [1, "rgba(255,242,220,0)"],
  ]);
  笔.fillRect(左, 顶, 宽, 16);
  笔.fillStyle = 线性(笔, 0, 顶 + 高 - 12, 0, 顶 + 高, [
    [0, "rgba(0,0,0,0)"],
    [1, 串(暗色(色.饼干, 0.3), 0.35)],
  ]);
  笔.fillRect(左, 顶 + 高 - 12, 宽, 14);
  // 内框压线：上一道亮、下一道暗，读成压模的台阶
  const 框缩 = 齿 + 4;
  圆角路径(笔, 左 + 框缩, 顶 + 框缩 + 0.8, 宽 - 框缩 * 2, 高 - 框缩 * 2, 4);
  笔.strokeStyle = 串(暗色(色.饼干, 0.22), 0.45);
  笔.lineWidth = 1.3;
  笔.stroke();
  圆角路径(笔, 左 + 框缩, 顶 + 框缩 - 0.5, 宽 - 框缩 * 2, 高 - 框缩 * 2, 4);
  笔.strokeStyle = 串(亮色(色.饼干浅, 0.55), 0.5);
  笔.lineWidth = 1;
  笔.stroke();
  // 戳孔：暗孔 + 下沿亮口
  const 孔 = [
    [0.24, 0.32],
    [0.62, 0.26],
    [0.84, 0.44],
    [0.16, 0.62],
    [0.42, 0.72],
    [0.72, 0.66],
    [0.9, 0.78],
    [0.33, 0.46],
  ] as const;
  for (const [列比, 行比] of 孔) {
    const x = 左 + 宽 * 列比;
    const y = 顶 + 高 * 行比;
    const 半 = Math.max(1.2, 高 * 0.028);
    笔.beginPath();
    笔.ellipse(x, y, 半, 半 * 0.92, 0, 0, Math.PI * 2);
    笔.fillStyle = 串(暗色(色.饼干, 0.42), 0.72);
    笔.fill();
    笔.beginPath();
    笔.ellipse(x, y + 半 * 1.1, 半 * 0.9, 半 * 0.5, 0, 0, Math.PI * 2);
    笔.fillStyle = 串(亮色(色.饼干浅, 0.5), 0.5);
    笔.fill();
  }
  // 顶部左上镜面
  笔.beginPath();
  笔.ellipse(左 + 宽 * 0.3, 顶 + 高 * 0.2, 宽 * 0.26, 高 * 0.09, -0.06, 0, Math.PI * 2);
  笔.fillStyle = "rgba(255,247,230,0.5)";
  笔.fill();
  笔.restore();

  // ⑤ 扇贝外沿亮线
  笔.save();
  扇贝(-0.4, 0.45);
  笔.strokeStyle = 线性(笔, 左, 顶, 左 + 宽, 顶 + 高, [
    [0, 串(亮色(色.饼干浅, 0.65), 0.85)],
    [0.6, 串(亮色(色.饼干浅, 0.4), 0.3)],
    [1, 串(暗色(色.饼干, 0.2), 0.4)],
  ]);
  笔.lineWidth = 1.2;
  笔.stroke();
  笔.restore();
}

/** 糖霜甜甜圈（右转）：面团圈 + 花瓣状草莓糖霜 + 撒针 + 中孔。 */
function 画糖霜甜甜圈(
  笔: CanvasRenderingContext2D,
  中心X: number,
  中心Y: number,
  区宽: number,
  区高: number,
): void {
  const 横半径 = Math.min(区宽 / 2 - 3, 40);
  const 纵半径 = Math.min(区高 / 2, 29);
  const cy = 中心Y - 2;
  const 厚 = 5;

  // ① 接触投影
  笔.save();
  落影(笔, 串(色.巧克力深, 0.45), 7, 4);
  笔.beginPath();
  笔.ellipse(中心X, cy + 厚 * 0.8, 横半径 + 0.6, 纵半径 + 0.6, 0, 0, Math.PI * 2);
  笔.fillStyle = 串(暗色(色.饼干深, 0.3));
  笔.fill();
  笔.restore();

  // ② 面团：底圈侧壁 + 上亮下暗的面团面
  笔.beginPath();
  笔.ellipse(中心X, cy + 厚, 横半径 + 0.4, 纵半径 + 0.4, 0, 0, Math.PI * 2);
  笔.fillStyle = 串(色.饼干焦);
  笔.fill();
  笔.beginPath();
  笔.ellipse(中心X, cy + 厚 * 0.45, 横半径 + 0.4, 纵半径 + 0.4, 0, 0, Math.PI * 2);
  笔.fillStyle = 串(暗色(色.饼干深, 0.14));
  笔.fill();
  笔.beginPath();
  笔.ellipse(中心X, cy, 横半径, 纵半径, 0, 0, Math.PI * 2);
  笔.fillStyle = 径向(
    笔,
    中心X - 横半径 * 0.4,
    cy - 纵半径 * 0.58,
    0,
    中心X,
    cy + 纵半径 * 0.2,
    横半径 * 1.5,
    [
      [0, 串(混色(色.饼干浅, 色.饼干, 0.25))],
      [0.5, 串(混色(色.饼干, 色.饼干深, 0.25))],
      [1, 串(混色(色.饼干, 色.饼干焦, 0.35))],
    ],
  );
  笔.fill();

  // ③ 糖霜：花瓣状滴落边，外一圈深草莓轮廓
  const 瓣数 = 13;
  const 起伏 = 0.075;
  const 霜横 = 横半径 * 0.99;
  const 霜纵 = 纵半径 * 0.9;
  花边椭圆(笔, 中心X, cy - 2.8, 霜横, 霜纵, 瓣数, 起伏);
  笔.fillStyle = 串(色.草莓深);
  笔.fill();
  花边椭圆(笔, 中心X, cy - 3.6, 霜横, 霜纵, 瓣数, 起伏);
  笔.fillStyle = 径向(
    笔,
    中心X - 霜横 * 0.45,
    cy - 3.6 - 霜纵 * 0.6,
    0,
    中心X,
    cy - 3.4,
    霜横 * 1.45,
    [
      [0, 串(亮色(色.草莓浅, 0.28))],
      [0.32, 串(色.草莓浅)],
      [0.72, 串(色.草莓)],
      [1, 串(混色(色.草莓, 色.草莓深, 0.55))],
    ],
  );
  笔.fill();

  // ④ 中孔：孔沿一圈深草莓，孔底压暗
  const 孔横 = 霜横 * 0.25;
  const 孔纵 = 霜纵 * 0.27;
  笔.beginPath();
  笔.ellipse(中心X, cy - 3.4, 孔横 + 1.8, 孔纵 + 1.8, 0, 0, Math.PI * 2);
  笔.fillStyle = 串(色.草莓深);
  笔.fill();
  笔.beginPath();
  笔.ellipse(中心X, cy - 3, 孔横, 孔纵, 0, 0, Math.PI * 2);
  笔.fillStyle = 径向(笔, 中心X, cy - 3 - 孔纵 * 0.5, 0, 中心X, cy - 3, 孔横 * 1.2, [
    [0, 串(混色(色.莓深, 色.草莓深, 0.3))],
    [1, 串(混色(色.草莓深, 色.莓暗, 0.3))],
  ]);
  笔.fill();

  // ⑤ 撒针：一圈彩色糖针，先落一道暗影再画针身
  const 针色 = [色.薄荷, 色.柠檬, 色.蓝莓, 色.糖纸, 色.葡萄, 色.叶绿, 色.草莓糖];
  const 针长 = Math.max(2.8, 纵半径 * 0.155);
  const 针宽 = Math.max(2, 纵半径 * 0.1);
  for (let 序 = 0; 序 < 18; 序 += 1) {
    const 角 = 序 * 2.399 + 0.5;
    const 环 = 0.44 + ((序 * 37) % 10) / 26;
    const x = 中心X + Math.cos(角) * 霜横 * 环;
    const y = cy - 3.4 + Math.sin(角) * 霜纵 * 环;
    const 斜 = 序 * 1.27;
    const dx = (Math.cos(斜) * 针长) / 2;
    const dy = (Math.sin(斜) * 针长) / 2;
    笔.lineCap = "round";
    笔.beginPath();
    笔.moveTo(x - dx + 0.6, y - dy + 0.9);
    笔.lineTo(x + dx + 0.6, y + dy + 0.9);
    笔.strokeStyle = 串(色.草莓深, 0.22);
    笔.lineWidth = 针宽;
    笔.stroke();
    笔.beginPath();
    笔.moveTo(x - dx, y - dy);
    笔.lineTo(x + dx, y + dy);
    笔.strokeStyle = 串(针色[序 % 针色.length] ?? 色.薄荷, 1);
    笔.lineWidth = 针宽;
    笔.stroke();
  }

  // ⑥ 高光：左上糖霜镜面 + 两点甜光
  笔.beginPath();
  笔.ellipse(
    中心X - 霜横 * 0.42,
    cy - 3.6 - 霜纵 * 0.5,
    霜横 * 0.4,
    霜纵 * 0.16,
    -0.4,
    0,
    Math.PI * 2,
  );
  笔.fillStyle = "rgba(255,246,247,0.45)";
  笔.fill();
  笔.beginPath();
  笔.ellipse(
    中心X - 霜横 * 0.52,
    cy - 3.6 - 霜纵 * 0.2,
    霜横 * 0.1,
    霜纵 * 0.05,
    -0.4,
    0,
    Math.PI * 2,
  );
  笔.fillStyle = "rgba(255,255,255,0.5)";
  笔.fill();
}

/* ------------------------------------------------------------------ */
/* 下排：巧克力条 / 糖纸糖                                              */
/* ------------------------------------------------------------------ */

/** 深色巧克力条（左移/右移）：倒角厚板，面上斜向沟槽，边沿一圈亮棱。 */
/** 巧克力方向键的定稿色：面 / 环带 / 外轮廓（与糖果规范的可可—草莓深混合同源）。 */
const 巧克力面 = 0x8b453b;
const 巧克力环 = 0x9d5245;
const 巧克力廓 = 0x3f1714;

/**
 * 一条斜线的横截面标尺（定稿参数，逐像素对齐原图调出来的那一版）。
 *
 * 从左边界到右边界依次是：平地 → 亮脊 → 转折 → 暗面。
 * 「起 / 中 / 止」是这一段在宽度方向上的三个色标，负值压暗、正值提亮。
 * 亮脊紧贴暗面 —— 中间隔开就会读成凹槽，贴住才有凸起感。
 */
const 巧克力斜纹: readonly { 宽: number; 起: number; 中: number; 止: number }[] = [
  { 宽: 3.8, 起: 0, 中: 0, 止: 0 },
  { 宽: 0.2, 起: 0.125, 中: 0.25, 止: 0.08 },
  { 宽: 0.8, 起: 0.08, 中: -0.09, 止: -0.275 },
  { 宽: 0.5, 起: -0.275, 中: -0.46, 止: -0.23 },
];
/** 相邻两条斜线的法向间距与走向。 */
const 巧克力斜纹间距 = 14.2;
const 巧克力斜纹角度 = -39;

/** 明暗系数 → 颜色：>0 往暖白提，<0 往深棕压。 */
function 巧克力明暗色(明暗: number): number {
  return 明暗 >= 0 ? 混色(巧克力面, 0xffd2a8, 明暗) : 混色(巧克力面, 0x2a0d08, -明暗);
}

/**
 * 巧克力条（左移 / 右移键）：平躺的巧克力片，不是凸起的厚键。
 *
 * 分层就是叠放顺序，每层都能单独换色换宽：
 *   ① 外圆角矩形（键身）
 *   ② 内圆角矩形（顶面区域）
 *   ③ 两角之间的环带（倒角带）
 *   ④ 顶面：底色 + 极轻竖向渐变
 *   ⑤ 六条斜线：每条按横截面标尺画出「平地 → 亮脊 → 转折 → 暗面」
 *
 * 斜线的渐变是沿宽度方向（跨过一条斜线），不是沿长度方向。
 */
function 画巧克力条(
  笔: CanvasRenderingContext2D,
  中心X: number,
  中心Y: number,
  区宽: number,
  区高: number,
): void {
  // 参照图上的巧克力键是 2 : 1 的扁片，不跟键格等高；所有尺寸按宽度等比缩放
  const 宽 = Math.min(区宽 - 2, 96);
  const 比 = 宽 / 90;
  const 高 = Math.min(区高 - 2, 宽 / 2);
  const 左 = 中心X - 宽 / 2;
  const 顶 = 中心Y - 高 / 2;
  const 圆角 = 7 * 比;
  const 内左 = 左 + 2.3 * 比;
  const 内上 = 顶 + 1.7 * 比;
  const 内宽 = 宽 - 4.6 * 比;
  const 内高 = 高 - 2.5 * 比;
  const 内圆角 = 5 * 比;
  const 间距 = 巧克力斜纹间距 * 比;

  // ① 外圆角矩形
  圆角路径(笔, 左, 顶, 宽, 高, 圆角);
  笔.fillStyle = 串(巧克力廓);
  笔.fill();

  // ② 内圆角矩形 + ③ 环带（内层铺环色，外层留出的那一圈就是环带）
  圆角路径(笔, 内左, 内上, 内宽, 内高, 内圆角);
  笔.fillStyle = 串(巧克力环);
  笔.fill();

  // ④ 顶面：底色 + 极轻渐变
  圆角路径(笔, 内左, 内上, 内宽, 内高, 内圆角);
  笔.fillStyle = 线性(笔, 0, 内上, 0, 内上 + 内高, [
    [0, 串(混色(巧克力面, 0xffffff, 0.07))],
    [0.55, 串(巧克力面)],
    [1, 串(混色(巧克力面, 0x000000, 0.06))],
  ]);
  笔.fill();

  // ⑤ 六条斜线：按标尺横向渐变，铺满整个间距，不留平涂块
  const 段总宽 = 巧克力斜纹.reduce((和, 段) => 和 + 段.宽, 0) * 比;
  const 拉伸 = 间距 / 段总宽;
  const 跨度 = 宽 + 高 + 段总宽 * 拉伸;
  笔.save();
  圆角路径(笔, 内左, 内上, 内宽, 内高, 内圆角);
  笔.clip();
  笔.translate(中心X, 中心Y);
  笔.rotate((巧克力斜纹角度 * Math.PI) / 180);
  for (let 条 = 0; 条 < 6; 条 += 1) {
    let 偏移 = (条 - 2.5) * 间距 - (段总宽 * 拉伸) / 2;
    for (const 段 of 巧克力斜纹) {
      const 段宽 = 段.宽 * 比 * 拉伸;
      const 段渐变 = 笔.createLinearGradient(0, 偏移, 0, 偏移 + 段宽);
      段渐变.addColorStop(0, 串(巧克力明暗色(段.起)));
      段渐变.addColorStop(0.5, 串(巧克力明暗色(段.中)));
      段渐变.addColorStop(1, 串(巧克力明暗色(段.止)));
      笔.fillStyle = 段渐变;
      笔.fillRect(-跨度, 偏移, 跨度 * 2, 段宽);
      偏移 += 段宽;
    }
  }
  笔.restore();
}

/**
 * 软降·糖纸糖（按目标图复刻）：
 * 糖身横向胶囊 + 45° 宽斜纹 + 顶部亮带 + 底部侧壁，两端金箍，外接放射褶皱糖纸，
 * 中央双人字图标（先压浅色再压深咖，读作压印）。
 */
function 画糖纸糖(
  笔: CanvasRenderingContext2D,
  中心X: number,
  中心Y: number,
  区宽: number,
  区高: number,
): void {
  const 身宽 = Math.min(区宽 - 14, 122);
  const 身高 = Math.min(区高 - 8, 54);
  const 身左 = 中心X - 身宽 / 2;
  const 身顶 = 中心Y - 身高 / 2 - 1;
  const 圆角 = Math.max(10, 身高 / 2 - 0.5);
  const 厚 = 4;

  const 面亮 = 0xe89b70;
  const 面中 = 0xe08457;
  const 面暗 = 0xc96841;
  const 壁色 = 0xc06a49;
  const 金 = 0xe8b466;
  const 金亮 = 0xffe0a8;
  const 金暗 = 0xa06f2a;
  const 纸亮 = 0xeda093;
  const 纸中 = 0xdc8a7e;
  const 纸暗 = 0xc2726a;
  const 图标色 = 0x6b3a2a;

  const 身路径 = () => {
    笔.beginPath();
    笔.roundRect(身左, 身顶, 身宽, 身高, 圆角);
  };

  // ① 落影
  笔.save();
  笔.shadowColor = "rgba(40,10,14,0.45)";
  笔.shadowBlur = 11;
  笔.shadowOffsetY = 4;
  笔.beginPath();
  笔.roundRect(身左, 身顶 + 厚, 身宽, 身高, 圆角);
  笔.fillStyle = 串(壁色);
  笔.fill();
  笔.restore();

  // ② 两端糖纸：从糖身根部向外张开的折扇（扇形轮廓 + 放射折线）
  const 纸宽 = Math.min(16, (区宽 - 身宽) / 2 + 9);
  for (const 向 of [-1, 1] as const) {
    const 根X = 中心X + 向 * (身宽 / 2 - 7);
    const 半高 = 身高 * 0.64;
    const 瓣数 = 5;
    // 外缘点：中间鼓、两端收
    const 外点: { x: number; y: number }[] = [];
    for (let i = 0; i <= 瓣数; i += 1) {
      const t = i / 瓣数;
      const y = 中心Y - 半高 + 半高 * 2 * t;
      const 鼓 = 0.62 + 0.38 * Math.sin(Math.PI * t);
      const x = 根X + 向 * 纸宽 * 鼓;
      外点.push({ x, y });
    }
    笔.save();
    笔.beginPath();
    笔.moveTo(根X, 中心Y - 半高);
    for (const 点 of 外点) 笔.lineTo(点.x, 点.y);
    笔.lineTo(根X, 中心Y + 半高);
    笔.closePath();
    const 纸面 = 笔.createLinearGradient(根X, 中心Y, 根X + 向 * 纸宽, 中心Y);
    纸面.addColorStop(0, 串(纸暗));
    纸面.addColorStop(0.45, 串(纸中));
    纸面.addColorStop(1, 串(纸亮));
    笔.fillStyle = 纸面;
    笔.fill();
    // 折线：根部中心向每个外点发散，奇偶交替填充
    笔.save();
    笔.clip();
    for (let i = 0; i < 瓣数; i += 1) {
      const 甲 = 外点[i];
      const 乙 = 外点[i + 1];
      if (!甲 || !乙) continue;
      if (i % 2 === 0) {
        笔.beginPath();
        笔.moveTo(根X, 中心Y);
        笔.lineTo(甲.x, 甲.y);
        笔.lineTo(乙.x, 乙.y);
        笔.closePath();
        笔.fillStyle = 串(纸亮, 0.32);
        笔.fill();
      }
      笔.beginPath();
      笔.moveTo(根X, 中心Y);
      笔.lineTo(乙.x, 乙.y);
      笔.strokeStyle = 串(纸暗, 0.7);
      笔.lineWidth = 0.9;
      笔.stroke();
    }
    笔.restore();
    // 外缘亮线
    笔.beginPath();
    笔.moveTo(外点[0]?.x ?? 根X, 外点[0]?.y ?? 中心Y);
    for (const 点 of 外点) 笔.lineTo(点.x, 点.y);
    笔.strokeStyle = 串(纸亮, 0.75);
    笔.lineWidth = 1;
    笔.stroke();
    笔.restore();
  }

  // ③ 侧壁
  笔.beginPath();
  笔.roundRect(身左, 身顶 + 厚, 身宽, 身高, 圆角);
  笔.fillStyle = 串(壁色);
  笔.fill();

  // ④ 糖身
  身路径();
  笔.fillStyle = 线性(笔, 0, 身顶, 0, 身顶 + 身高, [
    [0, 串(0xf7b792)],
    [0.18, 串(面亮)],
    [0.55, 串(面中)],
    [1, 串(面暗)],
  ]);
  笔.fill();

  // ⑤ 纹理与明暗（裁进糖身）
  笔.save();
  身路径();
  笔.clip();
  笔.save();
  笔.translate(中心X, 中心Y);
  笔.rotate(Math.PI / 4);
  笔.fillStyle = "rgba(255,232,214,0.18)";
  const 斜周期 = 20;
  const 斜宽 = 10;
  for (let s = -180; s < 180; s += 斜周期) {
    笔.fillRect(s, -160, 斜宽, 320);
  }
  笔.restore();
  // 顶部高光带：上沿一道宽亮带，越往下越透明
  const 顶带 = 笔.createLinearGradient(0, 身顶, 0, 身顶 + 身高);
  顶带.addColorStop(0, "rgba(255,250,244,0.26)");
  顶带.addColorStop(0.2, "rgba(255,244,232,0.14)");
  顶带.addColorStop(0.55, "rgba(255,240,226,0.04)");
  顶带.addColorStop(1, "rgba(255,240,226,0)");
  笔.fillStyle = 顶带;
  笔.fillRect(身左, 身顶, 身宽, 身高);
  const 底影 = 笔.createLinearGradient(0, 身顶 + 身高 * 0.45, 0, 身顶 + 身高);
  底影.addColorStop(0, "rgba(0,0,0,0)");
  底影.addColorStop(0.65, "rgba(90,25,10,0.12)");
  底影.addColorStop(1, "rgba(70,18,8,0.26)");
  笔.fillStyle = 底影;
  笔.fillRect(身左, 身顶 + 身高 * 0.45, 身宽, 身高 * 0.55);
  笔.restore();

  // ⑥ 金箍
  const 箍宽 = 8.5;
  const 箍高 = 身高 * 0.6;
  for (const 向 of [-1, 1] as const) {
    const 箍X = 中心X + 向 * (身宽 / 2 - 箍宽 * 0.15) - 箍宽 / 2;
    笔.beginPath();
    笔.roundRect(箍X, 中心Y - 箍高 / 2, 箍宽, 箍高, 2.4);
    笔.fillStyle = 线性(笔, 0, 中心Y - 箍高 / 2, 0, 中心Y + 箍高 / 2, [
      [0, 串(金暗)],
      [0.3, 串(金亮)],
      [0.62, 串(金)],
      [1, 串(金暗)],
    ]);
    笔.fill();
    笔.strokeStyle = 串(0x8a5c22, 0.75);
    笔.lineWidth = 0.9;
    笔.stroke();
  }

  // ⑦ 双人字图标
  const 人字 = (偏移Y: number, 颜色: string, 宽: number) => {
    笔.strokeStyle = 颜色;
    笔.lineWidth = 宽;
    笔.lineCap = "round";
    笔.lineJoin = "round";
    for (const 下 of [-6.0, 4.2] as const) {
      笔.beginPath();
      笔.moveTo(中心X - 10.5, 中心Y + 下 - 3.8 + 偏移Y);
      笔.lineTo(中心X, 中心Y + 下 + 3.8 + 偏移Y);
      笔.lineTo(中心X + 10.5, 中心Y + 下 - 3.8 + 偏移Y);
      笔.stroke();
    }
  };
  人字(1.3, "rgba(255,214,184,0.5)", 3.9);
  人字(0, 串(图标色), 3.8);
}

/* ------------------------------------------------------------------ */
/* 六键的键身                                                          */
/* ------------------------------------------------------------------ */

/** 画一颗键的键身（不含图标）。矩形取对局布局里这颗键的区域。 */
export function 画糖果键身(
  笔: CanvasRenderingContext2D,
  键: 对局布局操作键,
  左: number,
  上: number,
  宽: number,
  高: number,
): void {
  const 中心X = 左 + 宽 / 2;
  const 中心Y = 上 + 高 / 2;
  if (键.名称 === "左转") 画漩涡饼干(笔, 中心X, 中心Y, 宽, 高);
  else if (键.名称 === "暂存操作") 画威化饼干(笔, 中心X, 中心Y, 宽, 高);
  else if (键.名称 === "右转") 画糖霜甜甜圈(笔, 中心X, 中心Y, 宽, 高);
  else if (键.名称 === "软降") 画糖纸糖(笔, 中心X, 中心Y, 宽, 高);
  else 画巧克力条(笔, 中心X, 中心Y, 宽, 高);
}

/* ------------------------------------------------------------------ */
/* 整块操作盘                                                          */
/* ------------------------------------------------------------------ */

/** 操作盘：托盘包住六键的外接矩形（外扩读控件规格），再逐颗压上甜点键身。 */
export function 画糖果操作盘(笔: CanvasRenderingContext2D, 布局: 对局布局数据): void {
  const 键列 = 布局.操作区.键;
  if (!布局.操作区.显示 || 键列.length === 0) return;
  const 外扩 = 读取操作键规格().托盘外扩;
  let 左 = Number.POSITIVE_INFINITY;
  let 上 = Number.POSITIVE_INFINITY;
  let 右 = Number.NEGATIVE_INFINITY;
  let 下 = Number.NEGATIVE_INFINITY;
  for (const 键 of 键列) {
    左 = Math.min(左, 键.中心X - 键.宽 / 2);
    上 = Math.min(上, 键.中心Y - 键.高 / 2);
    右 = Math.max(右, 键.中心X + 键.宽 / 2);
    下 = Math.max(下, 键.中心Y + 键.高 / 2);
  }
  画糖果操作托盘(笔, 左 - 外扩, 上 - 外扩, 右 - 左 + 外扩 * 2, 下 - 上 + 外扩 * 2);
  for (const 键 of 键列)
    画糖果键身(笔, 键, 键.中心X - 键.宽 / 2, 键.中心Y - 键.高 / 2, 键.宽, 键.高);
  已烘焙托盘 = 键列.map(键特征).sort().join(";");
  已烘焙键集.clear();
  for (const 键 of 键列) 已烘焙键集.add(键特征(键));
}
