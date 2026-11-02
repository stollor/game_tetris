import type { 图形对象, 点 } from "../../../../.gamemaker/依赖/框架/界面/绘制/协议";
import { 亮色, 暗色 } from "../../../../.gamemaker/依赖/框架/界面/颜色工具";
import { 糖果规范 } from "../../../主题/糖果/糖果规范";
import { type 边界, 同角, 圆角多边形, 裁进凸形 } from "./圆角裁剪";

/**
 * 糖果 2D 质感工具箱：把「一块糖」的六层读法沉成一套原语。
 *
 * 统一光向：左上主光。每块材质按同一顺序叠——
 * ①接触投影（多层偏移半透明）②深色糖边（暗色而非纯黑）③顶亮底暗的糖面
 * ④顶边窄高光条 + 左上镜面 ⑤底部内阴影 ⑥糖体侧壁（比顶面暗 20~35%）。
 *
 * 只读 `糖果规范` 与颜色工具的派生色，不新增字面色值；圆角与厚度两套形状
 * （圆角矩形 / 任意凸多边形）共用同一实现，供面板、按钮、仪表、侧栏、操作盘复用。
 */

/** 糖块侧壁比顶面压暗的比例：底色越浅壁越明显，夹在 0.2~0.35 之间。 */
const 壁暗 = 0.32;
/** 接触投影的三层：下移、外扩、透明度。近层最实，远层最淡。 */
const 投影层 = [
  [1.6, 0.6, 0.42],
  [4.2, 2.4, 0.2],
  [7.6, 5, 0.1],
] as const;

function 平移(形: readonly 点[], 横移: number, 纵移: number): 点[] {
  return 形.map((点) => ({ x: 点.x + 横移, y: 点.y + 纵移 }));
}

function 包围(形: readonly 点[]): 边界 {
  let 左 = Number.POSITIVE_INFINITY;
  let 上 = Number.POSITIVE_INFINITY;
  let 右 = Number.NEGATIVE_INFINITY;
  let 下 = Number.NEGATIVE_INFINITY;
  for (const 点 of 形) {
    左 = Math.min(左, 点.x);
    上 = Math.min(上, 点.y);
    右 = Math.max(右, 点.x);
    下 = Math.max(下, 点.y);
  }
  return { 左, 上, 右, 下 };
}

/** 用「填充 + 同色粗描边」把任意凸形外扩一圈，得到投影/糖边的轮廓。 */
function 膨胀填充(
  图: 图形对象,
  形: readonly 点[],
  色: number,
  透明度: number,
  外扩: number,
): void {
  图.fillStyle(色, 透明度).fillPoints(形, true);
  if (外扩 > 0.05) 图.lineStyle(外扩 * 2, 色, 透明度).strokePoints(形, true);
}

/** 矩形转圆角多边形；宽度方向被 2 截断，避免圆角吃掉整块。 */
function 糖形(左: number, 上: number, 宽: number, 高: number, 圆角: number): 点[] {
  const r = Math.max(0, Math.min(圆角, 宽 / 2, 高 / 2));
  return 圆角多边形({ 左, 上, 右: 左 + 宽, 下: 上 + 高 }, 同角(r));
}

/** ①接触投影：三层同色叠加，近层实、远层淡，糖块才像压进巧克力底里。 */
export function 绘制形状投影(
  图: 图形对象,
  形: readonly 点[],
  透明度 = 1,
  强度 = 1,
  色: number = 糖果规范.色.巧克力深,
  尺度 = 1,
): void {
  for (const [下移, 外扩, 透明] of 投影层)
    膨胀填充(图, 平移(形, 0, 下移 * 尺度), 色, 透明 * 透明度 * 强度, 外扩 * 尺度);
}

/** 感官亮度 0~1：只用来决定提亮要打几折，不做精确色彩计算。 */
export function 提亮系数(色: number): number {
  const 红 = (色 >> 16) & 0xff;
  const 绿 = (色 >> 8) & 0xff;
  const 蓝 = 色 & 0xff;
  const 亮度 = (0.299 * 红 + 0.587 * 绿 + 0.114 * 蓝) / 255;
  return Math.min(1, Math.max(0.3, 1.3 - 亮度));
}

/** ⑥糖体侧壁：整块下移填暗色，底缘再压一档，读作糖身的厚度。 */
export function 绘制形状侧壁(
  图: 图形对象,
  形: readonly 点[],
  填色: number,
  厚度: number,
  透明度 = 1,
): void {
  if (厚度 <= 0.2) return;
  图
    .fillStyle(暗色(填色, 壁暗), 透明度)
    .fillPoints(平移(形, 0, 厚度), true);
  图
    .fillStyle(暗色(填色, 壁暗 + 0.24), 0.85 * 透明度)
    .fillPoints(平移(形, 0, Math.max(1, 厚度 * 0.52)), true);
}

/** ②深色糖边：先铺一层外扩的暗色轮廓，再用糖面盖住内侧。 */
export function 绘制形状糖边(
  图: 图形对象,
  形: readonly 点[],
  边色: number,
  描宽: number,
  透明度 = 1,
): void {
  if (描宽 <= 0.05) return;
  膨胀填充(图, 形, 边色, 透明度, 描宽);
}

/** ③糖面：四角渐变 + 右侧收暗 + 左侧受光棱，顶亮底暗且带一点横向转折。 */
export function 绘制形状糖面(
  图: 图形对象,
  形: readonly 点[],
  填色: number,
  透明度 = 1,
  顶亮 = 0.2,
  底暗 = 0.24,
): void {
  const 左 = 包围(形);
  const 宽 = Math.max(1, 左.右 - 左.左);
  // 亮色糖果提亮的比例要收着用：奶油、粉这类高明度底色被提亮会直接洗白。
  const 提 = 顶亮 * 提亮系数(填色);
  图
    .fillGradientStyle(
      亮色(填色, 提),
      亮色(填色, 提 * 0.55),
      暗色(填色, 底暗 * 0.45),
      暗色(填色, 底暗),
      透明度,
      透明度,
      透明度,
      透明度,
    )
    .fillPoints(形, true);
  // 右侧背光带：避开主光方向，让糖面从左上向右下转暗。
  const 横带 = Math.min(宽 * 0.34, 16);
  const 右带 = 裁进凸形(
    [
      { x: 左.左 + 宽 - 横带, y: 左.上 },
      { x: 左.右, y: 左.上 },
      { x: 左.右, y: 左.下 },
      { x: 左.左 + 宽 - 横带, y: 左.下 },
    ],
    形,
  );
  if (右带.length >= 3)
    图
      .fillGradientStyle(
        填色,
        暗色(填色, 0.26),
        填色,
        暗色(填色, 0.26),
        0,
        0.62 * 透明度,
        0,
        0.62 * 透明度,
      )
      .fillPoints(右带, true);
  // 左缘受光棱：宽度只有 2px，读作糖衣的转折而不是另一块面。
  const 左带 = 裁进凸形(
    [
      { x: 左.左, y: 左.上 },
      { x: 左.左 + 2.2, y: 左.上 },
      { x: 左.左 + 2.2, y: 左.下 },
      { x: 左.左, y: 左.下 },
    ],
    形,
  );
  if (左带.length >= 3)
    图
      .fillGradientStyle(亮色(填色, 0.3), 亮色(填色, 0.3), 亮色(填色, 0.3), 亮色(填色, 0.3), 0.4, 0, 0.4, 0)
      .fillPoints(左带, true);
}

/** ④顶边窄高光条 + 左上镜面：一条贴着顶棱的亮带和两点柔光。 */
export function 绘制形状高光(
  图: 图形对象,
  形: readonly 点[],
  透明度 = 1,
  带比 = 0.13,
  提亮 = 1,
): void {
  const 边 = 包围(形);
  const 宽 = Math.max(1, 边.右 - 边.左);
  const 高 = Math.max(1, 边.下 - 边.上);
  if (宽 < 6 || 高 < 4) return;
  const 带高 = Math.max(1.4, Math.min(高 * 带比, 5));
  const 白 = 糖果规范.色.白;
  const 顶带 = 裁进凸形(
    [
      { x: 边.左 + 1, y: 边.上 + 0.8 },
      { x: 边.右 - 1, y: 边.上 + 0.8 },
      { x: 边.右 - 1, y: 边.上 + 0.8 + 带高 },
      { x: 边.左 + 1, y: 边.上 + 0.8 + 带高 },
    ],
    形,
  );
  if (顶带.length >= 3)
    图
      .fillGradientStyle(
        白,
        白,
        白,
        白,
        0.42 * 透明度 * 提亮,
        0.3 * 透明度 * 提亮,
        0,
        0,
      )
      .fillPoints(顶带, true);
  // 左上镜面：一块大柔光 + 一个更亮的小点，位置固定在左上 1/5 处。
  const 光X = 边.左 + 宽 * 0.24;
  const 光Y = 边.上 + 高 * 0.26;
  图
    .fillStyle(白, 0.2 * 透明度 * 提亮)
    .fillEllipse(光X, 光Y, 宽 * 0.3, 高 * 0.24);
  图
    .fillStyle(白, 0.34 * 透明度 * 提亮)
    .fillEllipse(边.左 + 宽 * 0.17, 边.上 + 高 * 0.17, 宽 * 0.13, 高 * 0.13);
}

/** ⑤内阴影：贴着指定边向内衰减的暗带，裁进糖面。 */
export function 绘制形状内阴影(
  图: 图形对象,
  形: readonly 点[],
  贴边: "上" | "下" = "下",
  透明度 = 0.34,
  厚度 = 6,
  色?: number,
): void {
  const 边 = 包围(形);
  const 宽 = Math.max(1, 边.右 - 边.左);
  const 高 = Math.max(1, 边.下 - 边.上);
  const 带 = Math.min(厚度, 高 * 0.45);
  if (带 < 1) return;
  const 上 = 贴边 === "上" ? 边.上 : 边.下 - 带;
  const 带形 = 裁进凸形(
    [
      { x: 边.左 - 1, y: 上 },
      { x: 边.左 + 宽 + 1, y: 上 },
      { x: 边.左 + 宽 + 1, y: 上 + 带 },
      { x: 边.左 - 1, y: 上 + 带 },
    ],
    形,
  );
  if (带形.length < 3) return;
  const 暗 = 色 ?? 糖果规范.色.巧克力深;
  if (贴边 === "上")
    图
      .fillGradientStyle(暗, 暗, 暗, 暗, 透明度, 透明度, 0, 0)
      .fillPoints(带形, true);
  else
    图
      .fillGradientStyle(暗, 暗, 暗, 暗, 0, 0, 透明度 * 0.9, 透明度)
      .fillPoints(带形, true);
}

/** 糖霜颗粒：按固定种子撒的细点，亮暗两色交错，读作糖面的糖霜而不是噪点。 */
export function 绘制糖霜颗粒(
  图: 图形对象,
  形: readonly 点[],
  数量: number,
  种子 = 1,
  透明度 = 1,
  色?: number,
): void {
  const 边 = 包围(形);
  const 宽 = Math.max(1, 边.右 - 边.左);
  const 高 = Math.max(1, 边.下 - 边.上);
  for (let 序 = 0; 序 < 数量; 序 += 1) {
    const 甲 = Math.sin((序 + 种子 * 31.7) * 127.1) * 43758.5453;
    const 乙 = Math.sin((序 + 种子 * 11.3) * 311.7) * 24634.6345;
    const x = 边.左 + ((甲 - Math.floor(甲)) * 0.92 + 0.04) * 宽;
    const y = 边.上 + ((乙 - Math.floor(乙)) * 0.88 + 0.05) * 高;
    const 亮 = 序 % 3 !== 0;
    const 半径 = 0.5 + ((序 * 17) % 7) * 0.09;
    图.fillStyle(亮 ? 糖果规范.色.白 : (色 ?? 糖果规范.色.巧克力深), (亮 ? 0.2 : 0.16) * 透明度);
    图.fillCircle(x, y, 半径);
  }
}

/** 一整块糖的六层画法；面板、按钮、托盘、名牌都走这一条路径。 */
export interface 糖片选项 {
  圆角?: number;
  填色?: number;
  /** 深色糖边，缺省由填色向黑压 0.52 派生。 */
  边色?: number;
  描宽?: number;
  /** 侧壁厚度（向下露出的墙），0 = 平贴。 */
  厚度?: number;
  透明度?: number;
  投影?: boolean;
  高光?: boolean;
  内阴影?: boolean;
  顶亮?: number;
  底暗?: number;
  /** 糖霜颗粒数量，0 = 不撒。 */
  颗粒?: number;
  种子?: number;
}

/** 画一块圆角糖片（左上角定位），六层按固定顺序叠加。 */
export function 绘制糖片(
  图: 图形对象,
  左: number,
  上: number,
  宽: number,
  高: number,
  选项: 糖片选项 = {},
): void {
  const 圆角 = Math.max(1, Math.min(选项.圆角 ?? 糖果规范.圆角.卡片, 宽 / 2, 高 / 2));
  const 填色 = 选项.填色 ?? 糖果规范.色.莓;
  const 边色 = 选项.边色 ?? 暗色(填色, 0.52);
  const 描宽 = 选项.描宽 ?? Math.min(糖果规范.描边.外, Math.min(宽, 高) * 0.1);
  const 厚度 = 选项.厚度 ?? 0;
  const 透明度 = 选项.透明度 ?? 1;
  const 形 = 糖形(左, 上, 宽, 高, 圆角);
  if (选项.投影 !== false && 高 > 10)
    绘制形状投影(图, 形, 透明度, 1, 糖果规范.色.巧克力深, Math.min(1, Math.max(0.45, 高 / 26)));
  if (厚度 > 0.2) 绘制形状侧壁(图, 形, 填色, 厚度, 透明度);
  绘制形状糖边(图, 形, 边色, 描宽, 透明度);
  绘制形状糖面(图, 形, 填色, 透明度, 选项.顶亮, 选项.底暗);
  if (选项.内阴影 !== false && 高 > 12)
    绘制形状内阴影(图, 形, "下", 0.36 * 透明度, Math.min(9, 高 * 0.24));
  if (选项.高光 !== false) 绘制形状高光(图, 形, 透明度, 0.13, 提亮系数(填色));
  if ((选项.颗粒 ?? 0) > 0) 绘制糖霜颗粒(图, 形, 选项.颗粒 ?? 0, 选项.种子 ?? 1, 透明度);
}

/** 糖钉：暗色垫圈 + 色点 + 左上高光；面板四角与按钮铆钉共用。 */
export function 绘制糖钉(
  图: 图形对象,
  中心X: number,
  中心Y: number,
  半径: number,
  色: number,
  透明度 = 1,
): void {
  图.fillStyle(糖果规范.色.巧克力深, 0.4 * 透明度).fillCircle(中心X, 中心Y + 0.9, 半径);
  图.fillStyle(暗色(色, 0.28), 透明度).fillCircle(中心X, 中心Y, 半径);
  图.fillStyle(色, 透明度).fillCircle(中心X, 中心Y - 0.2, 半径 * 0.82);
  图
    .fillStyle(糖果规范.色.白, 0.62 * 透明度)
    .fillCircle(中心X - 半径 * 0.3, 中心Y - 半径 * 0.34, 半径 * 0.34);
}

/** 圆角矩形的多边形轮廓，供调用方在自己的复合形状里拼接（如名牌侧耳）。 */
export function 糖片轮廓(
  左: number,
  上: number,
  宽: number,
  高: number,
  圆角: number,
): 点[] {
  return 糖形(左, 上, 宽, 高, 圆角);
}
