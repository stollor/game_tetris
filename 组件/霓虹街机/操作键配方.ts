import type { 对局布局操作键 } from "../../代码/视觉/对局布局";
import type { 图形对象, 点, 矩形 } from "../../框架/界面/绘制/协议";

/**
 * 竖屏对局底部操作盘：一块暗托盘，六颗倒角厚键。
 * 键面只留居中图标；旋转键带镜像弯转轮廓，软降更宽、描边更亮。按下时键面下沉，托盘不动。
 */

const 托盘色 = 0x07111f;
const 唇色 = 0x050b14;
const 面色 = 0x10263f;
const 按下色 = 0x1a4d78;
const 软降色 = 0x124a76;
const 边色 = 0x4fd2ff;
const 图标色 = 0xe8fbff;
const 下沉像素 = 3;

function 倒角点(左: number, 上: number, 宽: number, 高: number, 切: number): 点[] {
  const 角 = Math.max(4, Math.min(切, 宽 / 3, 高 / 3));
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

/** 对局角键与操作盘共用厚壳、切角和按键色，只显示动作图形。 */
export function 绘制图标角键(绘图: 图形对象, 区域: 矩形, 图标: "离开" | "暂停" | "继续"): void {
  const { 左, 上, 宽, 高 } = 区域;
  const x = 左 + 宽 / 2;
  const y = 上 + 高 / 2 - 1;
  绘图.fillStyle(唇色, 1).fillPoints(倒角点(左, 上 + 3, 宽, 高, 9), true);
  绘图.fillStyle(面色, 0.98).fillPoints(倒角点(左, 上, 宽, 高 - 2, 9), true);
  绘图.lineStyle(1.4, 边色, 0.7).strokePoints(倒角点(左, 上, 宽, 高 - 2, 9), true);
  绘图.lineStyle(1, 边色, 0.3).lineBetween(左 + 12, 上 + 4, 左 + 宽 - 12, 上 + 4);
  绘图.fillStyle(图标色, 0.95);
  if (图标 === "暂停") {
    绘图.fillRect(x - 7, y - 8, 4, 16).fillRect(x + 3, y - 8, 4, 16);
  } else if (图标 === "继续") {
    绘图.fillTriangle(x - 5, y - 9, x - 5, y + 9, x + 8, y);
  } else {
    绘图
      .lineStyle(1.8, 图标色, 0.9)
      .lineBetween(x + 2, y - 9, x + 9, y - 9)
      .lineBetween(x + 9, y - 9, x + 9, y + 9)
      .lineBetween(x + 9, y + 9, x + 2, y + 9);
    绘图.fillRect(x - 8, y - 1, 13, 2).fillTriangle(x - 12, y, x - 5, y - 6, x - 5, y + 6);
  }
}

/** 六键外的暗托盘，范围由键的外接矩形外扩；与键共用倒角轮廓，底壳下移 4px。 */
export function 绘制操作盘托盘(绘图: 图形对象, 键列表: readonly 对局布局操作键[]): void {
  if (键列表.length === 0) return;
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
  const 外扩 = 8;
  const 切 = 14;
  const 托盘左 = 左 - 外扩;
  const 托盘上 = 上 - 外扩;
  const 宽 = 右 - 左 + 外扩 * 2;
  const 高 = 下 - 上 + 外扩 * 2;
  const 托盘点 = (纵移: number) => 倒角点(托盘左, 托盘上 + 纵移, 宽, 高, 切);
  // 投影、下侧厚度、上面板三层，厚度只从底部露出 4px。
  绘图.fillStyle(0x000000, 0.35).fillPoints(倒角点(托盘左 + 2, 托盘上 + 5, 宽, 高, 切), true);
  绘图.fillStyle(唇色, 1).fillPoints(托盘点(4), true);
  绘图.fillStyle(托盘色, 0.92).fillPoints(托盘点(0), true);
  // 内侧上缘线与左右角短装饰线，低对比地勾出面板层级。
  绘图
    .lineStyle(1, 边色, 0.18)
    .lineBetween(托盘左 + 切 + 8, 托盘上 + 6, 托盘左 + 宽 - 切 - 8, 托盘上 + 6);
  绘图.lineStyle(1.5, 边色, 0.3);
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
  绘图.lineStyle(1.5, 边色, 0.35).strokePoints(托盘点(0), true);
}

/**
 * 操作键键面轮廓。左右旋转键共用一份实心曲肩键面，承托中央粗实回转箭头；
 * 右转按水平方向逐点镜像；其余键保持原轮廓。
 */
export function 生成操作键轮廓(
  键: 对局布局操作键,
  左: number,
  上: number,
  宽: number,
  高: number,
): 点[] {
  if (键.名称 === "左转" || 键.名称 === "右转") {
    const 点集: 点[] = [
      { x: 左 + 22, y: 上 },
      { x: 左 + 宽 - 12, y: 上 },
      { x: 左 + 宽, y: 上 + 12 },
      { x: 左 + 宽, y: 上 + 高 - 12 },
      { x: 左 + 宽 - 12, y: 上 + 高 },
      { x: 左 + 22, y: 上 + 高 },
      { x: 左 + 8, y: 上 + 高 - 8 },
      { x: 左, y: 上 + 高 / 2 },
      { x: 左 + 8, y: 上 + 8 },
    ];
    return 键.名称 === "左转" ? 点集 : 点集.map((点) => ({ x: 左 + 宽 - (点.x - 左), y: 点.y }));
  }
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
  return 倒角点(左, 上, 宽, 高, 键.名称 === "暂存操作" ? 16 : 10);
}

/** 绘制操作键只留图标，图标永远落在键中心并随键面一起下沉。 */
export function 绘制操作键(绘图: 图形对象, 键: 对局布局操作键, 按下: boolean): void {
  const 沉 = 按下 ? 下沉像素 : 0;
  const 左 = 键.中心X - 键.宽 / 2;
  const 上 = 键.中心Y - 键.高 / 2;
  const 强调 = 键.名称 === "软降";
  const 厚度 = 强调 ? 3 : 2;
  绘图
    .fillStyle(0x000000, 按下 ? 0.18 : 0.32)
    .fillEllipse(键.中心X, 上 + 键.高 + 6, 键.宽 * 0.8, 8);
  // 面板上的嵌槽不随按键下沉，让每颗键看起来是从托盘里嵌出来的。
  绘图
    .fillStyle(唇色, 0.55)
    .fillPoints(生成操作键轮廓(键, 左 - 3, 上 - 1, 键.宽 + 6, 键.高 + 6), true);
  绘图
    .lineStyle(1, 边色, 0.1)
    .strokePoints(生成操作键轮廓(键, 左 - 3, 上 - 1, 键.宽 + 6, 键.高 + 6), true);
  绘图.save();
  绘图.translateCanvas(0, 沉);
  // 底壳到键矩形底边为止，厚度只在键面下方露出，不侵入相邻键。
  绘图.fillStyle(唇色, 1).fillPoints(生成操作键轮廓(键, 左, 上 + 厚度, 键.宽, 键.高 - 厚度), true);
  const 面 = 按下 ? 按下色 : 强调 ? 软降色 : 面色;
  绘图.fillStyle(面, 0.98).fillPoints(生成操作键轮廓(键, 左, 上, 键.宽, 键.高 - 厚度), true);
  绘图.fillStyle(0xffffff, 强调 ? 0.16 : 0.1).fillRect(左 + 14, 上 + 3, 键.宽 - 28, 2);
  绘图
    .lineStyle(强调 ? 2.2 : 1.5, 边色, 按下 || 强调 ? 0.95 : 0.65)
    .strokePoints(生成操作键轮廓(键, 左, 上, 键.宽, 键.高 - 厚度), true);
  绘制操作图标(绘图, 键, 键.中心X, 键.中心Y, 1.25);
  绘图.restore();
}

function 绘制操作图标(
  绘图: 图形对象,
  键: 对局布局操作键,
  中心X: number,
  中心Y: number,
  比例: number,
): void {
  const 色 = 图标色;
  if (键.名称 === "左转" || 键.名称 === "右转") {
    绘制旋转箭头(绘图, 中心X, 中心Y, 13 * 比例, 键.名称 === "右转");
    return;
  }
  if (键.名称 === "暂存操作") {
    绘制暂存图标(绘图, 中心X, 中心Y, 比例);
    return;
  }
  if (键.名称 === "软降") {
    绘制双折线(绘图, 中心X, 中心Y, 11 * 比例);
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
): void {
  const 镜像 = 顺时针 ? -1 : 1;
  // 一颗粗实的回转箭头，箭头端与弧线相切，避免双层细环混淆方向。
  const 点集: 点[] = Array.from({ length: 21 }, (_, i) => {
    const 角 = -Math.PI / 2 + (i / 20) * Math.PI * 1.55;
    return { x: 中心X + Math.cos(角) * 半径 * 镜像, y: 中心Y + Math.sin(角) * 半径 };
  });
  绘图.lineStyle(4, 图标色, 1).strokePoints(点集, false);
  const 端 = 点集[0];
  if (!端) return;
  绘图
    .fillStyle(图标色, 1)
    .fillTriangle(端.x - 8 * 镜像, 端.y, 端.x + 3 * 镜像, 端.y - 6, 端.x + 3 * 镜像, 端.y + 6);
}

export function 绘制暂存图标(绘图: 图形对象, 中心X: number, 中心Y: number, 比例: number): void {
  const 盒宽 = 16 * 比例;
  const 盒高 = 6 * 比例;
  const 盒上 = 中心Y + 2 * 比例;
  绘图.fillStyle(图标色, 0.95).fillRect(中心X - 1.2 * 比例, 中心Y - 8 * 比例, 2.4 * 比例, 7 * 比例);
  绘图.fillTriangle(
    中心X,
    中心Y + 1 * 比例,
    中心X - 5 * 比例,
    中心Y - 4 * 比例,
    中心X + 5 * 比例,
    中心Y - 4 * 比例,
  );
  绘图.lineStyle(1.6, 图标色, 0.95).strokeRect(中心X - 盒宽 / 2, 盒上, 盒宽, 盒高);
}

function 绘制双折线(绘图: 图形对象, 中心X: number, 中心Y: number, 半宽: number): void {
  绘图.lineStyle(2.4, 图标色, 0.98);
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
