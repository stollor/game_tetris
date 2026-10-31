import { 像素规范 } from "../../主题/像素/像素规范";
import { 是像素风格 } from "../../主题/像素/像素风格";
import { 对局像素规格 } from "../../主题/像素/对局像素规格";
import { 立体规范 } from "../../主题/立体/立体规范";
import { 是立体风格 } from "../../主题/立体/立体风格";
import { 颜色值 } from "../../主题/配色/主题读取";
import { 读取霓虹调色板 } from "../../主题/配色/调色板";
import type { 对局布局操作键 } from "../../代码/页面/布局/对局布局";
import { 读取操作键规格, 读取角键规格 } from "../../框架/样式/控件规格";
import { 生成倒角矩形点 } from "../../框架/界面/绘制/倒角多边形";
import type { 图形对象, 点, 矩形 } from "../../框架/界面/绘制/协议";
import { 混色, 选取对比文字色, 颜色字符串, 颜色数值 } from "../../框架/界面/颜色工具";
import { 绘制像素图案 } from "../基础/装饰与蒙层/像素图案";
import { 绘制像素面板 } from "../基础/面板/像素面板";
import { 绘制金属板 } from "../基础/面板/金属板";
import { 绘制金属键 } from "../基础/按钮/金属键";
import { 绘制像素操作键 } from "./像素对局绘制";

/**
 * 竖屏对局底部操作盘：一块主题色托盘，六颗倒角厚键。
 * 形状数字读控件规格 `操作键` / `角键`（切角、描边、下沉、托盘外扩等）；
 * 异形轮廓（曲肩移动键、折底软降）仍由本配方决定，可在主题外观业务分组里调共用参数。
 */

export const 控件分类 = "业务" as const;

const 图标对比候选 = ["#161616", "#ffffff"] as const;

export interface 操作键配色 {
  托盘: number;
  唇: number;
  普通面: number;
  按下: number;
  软降: number;
  描边: number;
  强调: number;
  普通图标: number;
  按下图标: number;
  软降图标: number;
}

/** 从主题候选与框架默认深/白候选中，选当前实际键面上对比度最高的图标色。 */
function 选取图标色(底色: number, 主题候选: readonly string[]): number {
  return 颜色数值(选取对比文字色(颜色字符串(底色), [...主题候选, ...图标对比候选]));
}

/**
 * 操作键整套配色。样式参数供纯绘制测试切换主题；不传时跟随当前预览/玩家主题，不在模块级缓存。
 */
export function 读取操作键配色(样式?: Parameters<typeof 读取霓虹调色板>[0]): 操作键配色 {
  const 调色板 = 读取霓虹调色板(样式);
  const 普通面 = 颜色值(调色板.次要按钮.面板);
  const 按下 = 混色(普通面, 调色板.强调, 0.28);
  const 软降 = 混色(普通面, 调色板.强调, 0.18);
  const 主题候选 = [调色板.次要按钮.文字, 调色板.主要按钮.文字];
  return {
    托盘: 调色板.面板底,
    唇: 混色(调色板.背景, 调色板.面板底, 0.5),
    普通面,
    按下,
    软降,
    描边: 颜色值(调色板.次要按钮.边框),
    强调: 调色板.强调,
    普通图标: 选取图标色(普通面, 主题候选),
    按下图标: 选取图标色(按下, 主题候选),
    软降图标: 选取图标色(软降, 主题候选),
  };
}

/** 对局角键与操作盘共用厚壳、切角和按键色，只显示动作图形。 */
export function 绘制图标角键(绘图: 图形对象, 区域: 矩形, 图标: "离开" | "暂停" | "继续"): void {
  if (是像素风格()) {
    绘制像素操作键(绘图, 图标, 区域.左, 区域.上, 区域.宽, 区域.高, false, true);
    return;
  }
  if (是立体风格()) {
    const 规格 = 读取角键规格();
    绘制金属板(绘图, 区域.左, 区域.上, 区域.宽, 区域.高, {
      六角: true,
      强调: true,
      厚: 规格.厚度,
      透明度: 规格.面透明度,
      描边宽: 规格.描边宽,
      描边透明度: 规格.描边透明度,
    });
    const 色 = 立体规范.界面;
    const x = 区域.左 + 区域.宽 / 2;
    const y = 区域.上 + 区域.高 / 2 - 1;
    绘图.fillStyle(色.灯芯, 0.95);
    if (图标 === "暂停") 绘图.fillRect(x - 7, y - 8, 4, 16).fillRect(x + 3, y - 8, 4, 16);
    else if (图标 === "继续") 绘图.fillTriangle(x - 5, y - 9, x - 5, y + 9, x + 8, y);
    else {
      绘图
        .lineStyle(1.8, 色.灯芯, 0.9)
        .lineBetween(x + 2, y - 9, x + 9, y - 9)
        .lineBetween(x + 9, y - 9, x + 9, y + 9)
        .lineBetween(x + 9, y + 9, x + 2, y + 9);
      绘图.fillRect(x - 8, y - 1, 13, 2).fillTriangle(x - 12, y, x - 5, y - 6, x - 5, y + 6);
    }
    return;
  }
  const 色 = 读取操作键配色();
  const 规格 = 读取角键规格();
  const { 左, 上, 宽, 高 } = 区域;
  const x = 左 + 宽 / 2;
  const y = 上 + 高 / 2 - 1;
  const 切 = 规格.切角;
  const 唇移 = 规格.下沉;
  绘图.fillStyle(色.唇, 1).fillPoints(生成倒角矩形点(左, 上 + 唇移, 宽, 高, 切), true);
  绘图
    .fillStyle(色.普通面, 规格.面透明度)
    .fillPoints(生成倒角矩形点(左, 上, 宽, 高 - 规格.厚度, 切), true);
  绘图
    .lineStyle(规格.描边宽, 色.描边, 规格.描边透明度)
    .strokePoints(生成倒角矩形点(左, 上, 宽, 高 - 规格.厚度, 切), true);
  绘图.lineStyle(1, 色.强调, 0.3).lineBetween(左 + 12, 上 + 4, 左 + 宽 - 12, 上 + 4);
  绘图.fillStyle(色.普通图标, 0.95);
  if (图标 === "暂停") {
    绘图.fillRect(x - 7, y - 8, 4, 16).fillRect(x + 3, y - 8, 4, 16);
  } else if (图标 === "继续") {
    绘图.fillTriangle(x - 5, y - 9, x - 5, y + 9, x + 8, y);
  } else {
    绘图
      .lineStyle(1.8, 色.普通图标, 0.9)
      .lineBetween(x + 2, y - 9, x + 9, y - 9)
      .lineBetween(x + 9, y - 9, x + 9, y + 9)
      .lineBetween(x + 9, y + 9, x + 2, y + 9);
    绘图.fillRect(x - 8, y - 1, 13, 2).fillTriangle(x - 12, y, x - 5, y - 6, x - 5, y + 6);
  }
}

/** 六键外的主题色托盘，范围由键的外接矩形外扩；与键共用倒角轮廓。 */
export function 绘制操作盘托盘(绘图: 图形对象, 键列表: readonly 对局布局操作键[]): void {
  if (键列表.length === 0) return;
  const 色 = 读取操作键配色();
  const 规格 = 读取操作键规格();
  let 左 = Number.POSITIVE_INFINITY;
  let 上 = Number.POSITIVE_INFINITY;
  let 右 = Number.NEGATIVE_INFINITY;
  let 下 = Number.NEGATIVE_INFINITY;
  for (const 键 of 键列表) {
    左 = Math.min(左, 键.中心X - 键.宽 / 2);
    上 = Math.min(上, 键.中心Y - 键.高 / 2);
    右 = Math.max(右, 键.中心X + 键.宽 / 2);
    下 = Math.max(下, 键.中心Y + 键.高 / 2);
  }
  const 外扩 = 规格.托盘外扩;
  const 切 = 规格.托盘切角;
  const 托盘左 = 左 - 外扩;
  const 托盘上 = 上 - 外扩;
  const 宽 = 右 - 左 + 外扩 * 2;
  const 高 = 下 - 上 + 外扩 * 2;
  if (是像素风格()) {
    绘制像素面板(绘图, 托盘左, 托盘上, 宽, 高, 像素规范.色.暗纸, 像素规范.色.墨);
    return;
  }
  if (是立体风格()) {
    绘制金属板(绘图, 托盘左, 托盘上, 宽, 高, {
      切: 规格.托盘切角,
      厚: 规格.厚度,
      透明度: 规格.面透明度,
      描边宽: 规格.描边宽,
      描边透明度: 规格.描边透明度,
    });
    return;
  }
  const 托盘点 = (纵移: number) => 生成倒角矩形点(托盘左, 托盘上 + 纵移, 宽, 高, 切);
  // 投影、下侧厚度、上面板三层，厚度只从底部露出。
  绘图
    .fillStyle(0x000000, 0.35)
    .fillPoints(生成倒角矩形点(托盘左 + 2, 托盘上 + 5, 宽, 高, 切), true);
  绘图.fillStyle(色.唇, 1).fillPoints(托盘点(规格.厚度 + 2), true);
  绘图.fillStyle(色.托盘, 0.92).fillPoints(托盘点(0), true);
  绘图
    .lineStyle(1, 色.强调, 0.18)
    .lineBetween(托盘左 + 切 + 8, 托盘上 + 6, 托盘左 + 宽 - 切 - 8, 托盘上 + 6);
  绘图.lineStyle(1.5, 色.强调, 0.3);
  绘图
    .beginPath()
    .moveTo(托盘左 + 8, 托盘上 + 切)
    .lineTo(托盘左 + 8, 托盘上 + 切 + 11)
    .strokePath();
  绘图
    .beginPath()
    .moveTo(托盘左 + 宽 - 8, 托盘上 + 切)
    .lineTo(托盘左 + 宽 - 8, 托盘上 + 切 + 11)
    .strokePath();
  绘图.lineStyle(1.5, 色.描边, 0.35).strokePoints(托盘点(0), true);
}

/**
 * 操作键键面轮廓。左右转与暂存共用倒角矩形（切角读规格）；移动键保留曲肩，软降保留加宽折底。
 */
export function 生成操作键轮廓(
  键: 对局布局操作键,
  左: number,
  上: number,
  宽: number,
  高: number,
): 点[] {
  const 切 = 读取操作键规格().切角;
  if (键.名称 === "左转" || 键.名称 === "右转" || 键.名称 === "暂存操作")
    return 生成倒角矩形点(左, 上, 宽, 高, 切);
  if (键.名称 === "左移" || 键.名称 === "右移") {
    const 点集 = [
      { x: 左, y: 上 + 高 / 2 },
      { x: 左 + 18, y: 上 + 3 },
      { x: 左 + 宽 - 8, y: 上 + 3 },
      { x: 左 + 宽, y: 上 + 11 },
      { x: 左 + 宽, y: 上 + 高 - 11 },
      { x: 左 + 宽 - 8, y: 上 + 高 - 3 },
      { x: 左 + 18, y: 上 + 高 - 3 },
    ];
    return 键.名称 === "左移" ? 点集 : 点集.map((点) => ({ x: 左 + 宽 - (点.x - 左), y: 点.y }));
  }
  if (键.名称 === "软降")
    return [
      { x: 左 + 12, y: 上 },
      { x: 左 + 宽 - 12, y: 上 },
      { x: 左 + 宽, y: 上 + 12 },
      { x: 左 + 宽, y: 上 + 高 - 14 },
      { x: 左 + 宽 / 2, y: 上 + 高 },
      { x: 左, y: 上 + 高 - 14 },
      { x: 左, y: 上 + 12 },
    ];
  return 生成倒角矩形点(左, 上, 宽, 高, Math.max(切, 10));
}

/** 绘制操作键只留图标，图标永远落在键中心并随键面一起下沉。 */
export function 绘制操作键(绘图: 图形对象, 键: 对局布局操作键, 按下: boolean): void {
  if (是像素风格()) {
    绘制像素操作键(绘图, 键.名称, 键.中心X - 键.宽 / 2, 键.中心Y - 键.高 / 2, 键.宽, 键.高, 按下);
    return;
  }
  if (是立体风格()) {
    const 规格 = 读取操作键规格();
    const 左 = 键.中心X - 键.宽 / 2;
    const 上 = 键.中心Y - 键.高 / 2;
    const 强调 = 键.名称 === "软降";
    绘制金属键(绘图, 生成操作键轮廓(键, 左, 上, 键.宽, 键.高), {
      按下,
      强调,
      厚: 规格.厚度,
      透明度: 规格.面透明度,
      描边宽: 规格.描边宽,
      描边透明度: 规格.描边透明度,
    });
    绘图.save();
    绘图.translateCanvas(0, 按下 ? 规格.下沉 : 0);
    绘制操作图标(绘图, 键, 键.中心X, 键.中心Y, 1.25, 立体规范.界面.灯芯);
    绘图.restore();
    return;
  }
  const 色 = 读取操作键配色();
  const 规格 = 读取操作键规格();
  const 沉 = 按下 ? 规格.下沉 : 0;
  const 左 = 键.中心X - 键.宽 / 2;
  const 上 = 键.中心Y - 键.高 / 2;
  const 强调 = 键.名称 === "软降";
  const 厚度 = 强调 ? 规格.厚度 + 1 : 规格.厚度;
  绘图
    .fillStyle(0x000000, 按下 ? 0.18 : 0.32)
    .fillEllipse(键.中心X, 上 + 键.高 + 6, 键.宽 * 0.8, 8);
  // 面板上的嵌槽不随按键下沉，让每颗键看起来是从托盘里嵌出来的。
  绘图
    .fillStyle(色.唇, 0.55)
    .fillPoints(生成操作键轮廓(键, 左 - 3, 上 - 1, 键.宽 + 6, 键.高 + 6), true);
  绘图
    .lineStyle(1, 色.描边, 0.1)
    .strokePoints(生成操作键轮廓(键, 左 - 3, 上 - 1, 键.宽 + 6, 键.高 + 6), true);
  绘图.save();
  绘图.translateCanvas(0, 沉);
  绘图.fillStyle(色.唇, 1).fillPoints(生成操作键轮廓(键, 左, 上 + 厚度, 键.宽, 键.高 - 厚度), true);
  const 面 = 按下 ? 色.按下 : 强调 ? 色.软降 : 色.普通面;
  const 图标 = 按下 ? 色.按下图标 : 强调 ? 色.软降图标 : 色.普通图标;
  绘图
    .fillStyle(面, 规格.面透明度)
    .fillPoints(生成操作键轮廓(键, 左, 上, 键.宽, 键.高 - 厚度), true);
  绘图.fillStyle(0xffffff, 强调 ? 0.16 : 0.1).fillRect(左 + 14, 上 + 3, 键.宽 - 28, 2);
  绘图
    .lineStyle(
      强调 ? 规格.描边宽 + 0.7 : 规格.描边宽,
      色.描边,
      按下 || 强调 ? 0.95 : 规格.描边透明度,
    )
    .strokePoints(生成操作键轮廓(键, 左, 上, 键.宽, 键.高 - 厚度), true);
  绘制操作图标(绘图, 键, 键.中心X, 键.中心Y, 1.25, 图标);
  绘图.restore();
}

function 绘制操作图标(
  绘图: 图形对象,
  键: 对局布局操作键,
  中心X: number,
  中心Y: number,
  比例: number,
  色: number,
): void {
  if (键.名称 === "左转" || 键.名称 === "右转") {
    绘图.save();
    绘图.translateCanvas(中心X, 中心Y);
    绘图.scaleCanvas(0.64, 0.64);
    绘制旋转箭头(绘图, 0, 0, 13 * 比例, 键.名称 === "右转", 色);
    绘图.restore();
    return;
  }
  if (键.名称 === "暂存操作") {
    绘制暂存图标(绘图, 中心X, 中心Y, 比例, 色);
    return;
  }
  if (键.名称 === "软降") {
    绘制双折线(绘图, 中心X, 中心Y, 11 * 比例, 色);
    return;
  }
  const 朝右 = 键.名称 === "右移";
  const 半 = 8 * 比例;
  const 尖 = 朝右 ? 中心X + 半 : 中心X - 半;
  const 尾 = 朝右 ? 中心X - 半 * 0.55 : 中心X + 半 * 0.55;
  绘图.fillStyle(色, 0.95).fillTriangle(尖, 中心Y, 尾, 中心Y - 半 * 0.85, 尾, 中心Y + 半 * 0.85);
}

function 绘制旋转箭头(
  绘图: 图形对象,
  中心X: number,
  中心Y: number,
  半径: number,
  顺时针: boolean,
  色: number,
): void {
  const 镜像 = 顺时针 ? -1 : 1;
  const 点集: 点[] = Array.from({ length: 21 }, (_, i) => {
    const 角 = -Math.PI / 2 + (i / 20) * Math.PI * 1.55;
    return { x: 中心X + Math.cos(角) * 半径 * 镜像, y: 中心Y + Math.sin(角) * 半径 };
  });
  绘图.lineStyle(4, 色, 1).strokePoints(点集, false);
  const 端 = 点集[0];
  if (!端) return;
  绘图
    .fillStyle(色, 1)
    .fillTriangle(端.x - 8 * 镜像, 端.y, 端.x + 3 * 镜像, 端.y - 6, 端.x + 3 * 镜像, 端.y + 6);
}

export function 绘制暂存图标(
  绘图: 图形对象,
  中心X: number,
  中心Y: number,
  比例: number,
  颜色?: number,
): void {
  if (是像素风格()) {
    const 图案 = 对局像素规格.操作.图案.暂存操作;
    const 格 = 对局像素规格.操作.角键图案格 * 比例;
    绘制像素图案(
      绘图,
      图案,
      中心X - (图案[0].length * 格) / 2,
      中心Y - (图案.length * 格) / 2,
      格,
      颜色 ?? 像素规范.色.墨,
    );
    return;
  }
  const 色 = 颜色 ?? 读取操作键配色().普通图标;
  const 盒宽 = 16 * 比例;
  const 盒高 = 6 * 比例;
  const 盒上 = 中心Y + 2 * 比例;
  绘图.fillStyle(色, 0.95).fillRect(中心X - 1.2 * 比例, 中心Y - 8 * 比例, 2.4 * 比例, 7 * 比例);
  绘图.fillTriangle(
    中心X,
    中心Y + 1 * 比例,
    中心X - 5 * 比例,
    中心Y - 4 * 比例,
    中心X + 5 * 比例,
    中心Y - 4 * 比例,
  );
  绘图.lineStyle(1.6, 色, 0.95).strokeRect(中心X - 盒宽 / 2, 盒上, 盒宽, 盒高);
}

function 绘制双折线(绘图: 图形对象, 中心X: number, 中心Y: number, 半宽: number, 色: number): void {
  绘图.lineStyle(2.4, 色, 0.98);
  for (const 偏移 of [-5, 3]) {
    const y = 中心Y + 偏移;
    绘图
      .beginPath()
      .moveTo(中心X - 半宽, y - 4)
      .lineTo(中心X, y + 2)
      .lineTo(中心X + 半宽, y - 4)
      .strokePath();
    绘图.beginPath();
  }
}
