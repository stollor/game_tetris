import { 扁平外观 } from "../../../主题/糖果/扁平外观";

/**
 * 扁平版糖果笔法：给 `底板/` 五块区域和角键共用的一组 canvas 2D 基元。
 *
 * 只有三类东西在这里：形状路径（圆角 / 扇贝 / 花边）、扁平上色（纯色面 + 侧边 + 柔影）、
 * 以及六个操作键重复用到的图标笔画。具体布局与配色组合仍由各区域自己写，
 * 这里不出现任何「哪个区域长什么样」的判断。
 */

const 色 = 扁平外观.色;
const 寸 = 扁平外观.尺寸;

/** 0xRRGGBB → canvas 颜色串。 */
export function 串(值: number, 透明 = 1): string {
  const r = (值 >> 16) & 0xff;
  const g = (值 >> 8) & 0xff;
  const b = 值 & 0xff;
  return `rgba(${r}, ${g}, ${b}, ${透明})`;
}

/* ------------------------------------------------------------------ */
/* 形状                                                                */
/* ------------------------------------------------------------------ */

/** 圆角矩形：只建路径，不填充。 */
export function 圆角矩形路径(
  笔: CanvasRenderingContext2D,
  左: number,
  上: number,
  宽: number,
  高: number,
  圆角: number,
): void {
  const r = Math.max(0, Math.min(圆角, 宽 / 2, 高 / 2));
  笔.moveTo(左 + r, 上);
  笔.lineTo(左 + 宽 - r, 上);
  笔.arcTo(左 + 宽, 上, 左 + 宽, 上 + r, r);
  笔.lineTo(左 + 宽, 上 + 高 - r);
  笔.arcTo(左 + 宽, 上 + 高, 左 + 宽 - r, 上 + 高, r);
  笔.lineTo(左 + r, 上 + 高);
  笔.arcTo(左, 上 + 高, 左, 上 + 高 - r, r);
  笔.lineTo(左, 上 + r);
  笔.arcTo(左, 上, 左 + r, 上, r);
  笔.closePath();
}

/** 扇贝（花边）矩形：四边一圈半圆瓣，顺时针一条连续路径。 */
export function 扇贝矩形路径(
  笔: CanvasRenderingContext2D,
  左: number,
  上: number,
  宽: number,
  高: number,
  瓣半径: number = 寸.花边.半径,
): void {
  const r = Math.max(0.8, 瓣半径);
  const 右 = 左 + 宽;
  const 下 = 上 + 高;
  笔.moveTo(左, 上);
  const 边 = (x1: number, y1: number, x2: number, y2: number, nx: number, ny: number) => {
    const 长 = Math.hypot(x2 - x1, y2 - y1);
    const 数 = Math.max(1, Math.round(长 / (r * 2)));
    const 步 = 长 / 数;
    const dx = (x2 - x1) / 长;
    const dy = (y2 - y1) / 长;
    for (let i = 0; i < 数; i += 1) {
      const sx = x1 + dx * 步 * i;
      const sy = y1 + dy * 步 * i;
      const mx = sx + dx * 步 * 0.5;
      const my = sy + dy * 步 * 0.5;
      笔.quadraticCurveTo(mx + nx * r, my + ny * r, sx + dx * 步, sy + dy * 步);
    }
  };
  边(左, 上, 右, 上, 0, -1);
  边(右, 上, 右, 下, 1, 0);
  边(右, 下, 左, 下, 0, 1);
  边(左, 下, 左, 上, -1, 0);
  笔.closePath();
}

/** 花边椭圆：饼干、甜甜圈那圈云朵边；极坐标取瓣，采样点密，视觉上是一条平滑云边。 */
export function 花边椭圆路径(
  笔: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  横半径: number,
  纵半径: number,
  瓣数: number,
  相位 = 0,
): void {
  const 瓣深 = 0.085;
  const 数 = Math.max(48, Math.round(瓣数 * 14));
  for (let i = 0; i <= 数; i += 1) {
    const 角 = 相位 + (i / 数) * Math.PI * 2;
    const 比 = 1 + 瓣深 * Math.cos(瓣数 * 角);
    const x = cx + Math.cos(角) * 横半径 * 比;
    const y = cy + Math.sin(角) * 纵半径 * 比;
    if (i === 0) 笔.moveTo(x, y);
    else 笔.lineTo(x, y);
  }
  笔.closePath();
}

/**
 * 当前设备倍率。
 *
 * canvas 的 shadowBlur / shadowOffsetY **不跟随 CTM**（Chrome 实测：scale(2) 下
 * shadowBlur=10 只有约 10 设备像素的扩散，等于设定值的一半），
 * 所以影参数必须先乘回倍率，否则 DPR2 下所有投影都会缩小一半、显得又硬又小。
 */
export function 设备倍率(笔: CanvasRenderingContext2D): number {
  const 比 = 笔.getTransform().a;
  return Number.isFinite(比) && 比 > 0 ? 比 : 1;
}

/** 单边扇贝：给面板做只有上沿或下沿有花边的「糖纸边」（篷檐、托盘沿）。 */
export function 单边扇贝(
  笔: CanvasRenderingContext2D,
  左: number,
  上: number,
  宽: number,
  高: number,
  边: "上" | "下",
  瓣半径: number = 寸.花边.半径,
): void {
  const r = Math.max(0.8, 瓣半径);
  const y = 边 === "上" ? 上 + 高 : 上;
  const 向 = 边 === "上" ? -1 : 1;
  const 数 = Math.max(1, Math.round(宽 / (r * 2)));
  const 步 = 宽 / 数;
  笔.moveTo(左, y);
  for (let i = 0; i < 数; i += 1) {
    const sx = 左 + 步 * i;
    笔.quadraticCurveTo(sx + 步 * 0.5, y + 向 * r, sx + 步, y);
  }
}

/* ------------------------------------------------------------------ */
/* 上色                                                                */
/* ------------------------------------------------------------------ */

/** 填当前路径。 */
export function 填充(笔: CanvasRenderingContext2D, 颜色: number, 透明 = 1): void {
  笔.fillStyle = 串(颜色, 透明);
  笔.fill();
}

/** 描当前路径。 */
export function 描边(
  笔: CanvasRenderingContext2D,
  颜色: number,
  线宽: number = 寸.描边,
  透明 = 1,
): void {
  笔.strokeStyle = 串(颜色, 透明);
  笔.lineWidth = 线宽;
  笔.stroke();
}

/**
 * 扁平 2.5D 块：柔影 → 侧边 → 面。
 * `路径` 只负责往当前路径里加形状，beginPath 由本函数负责。
 */
export function 画块(
  笔: CanvasRenderingContext2D,
  面: number,
  侧: number,
  路径: () => void,
  选项: { 侧厚?: number; 影?: boolean; 影透明?: number } = {},
): void {
  const 侧厚 = 选项.侧厚 ?? 寸.侧厚.键;
  const 画影 = 选项.影 ?? true;
  if (画影) {
    const 倍 = 设备倍率(笔);
    笔.save();
    笔.shadowColor = 串(色.井, 选项.影透明 ?? 寸.影.透明 + 0.12);
    笔.shadowBlur = 寸.影.模糊 * 倍;
    笔.shadowOffsetY = 寸.影.偏移Y * 倍;
    笔.beginPath();
    路径();
    填充(笔, 侧);
    笔.restore();
  }
  if (侧厚 > 0) {
    笔.save();
    笔.translate(0, 侧厚);
    笔.beginPath();
    路径();
    填充(笔, 侧);
    笔.restore();
  }
  笔.beginPath();
  路径();
  填充(笔, 面);
}

/** 斜纹：在已裁切的区域里铺一组同宽斜带（拐杖糖、巧克力、封面斜纹共用）。 */
export function 铺斜纹(
  笔: CanvasRenderingContext2D,
  左: number,
  上: number,
  宽: number,
  高: number,
  颜色: number,
  选项: { 条宽?: number; 间距?: number; 角度?: number; 透明?: number } = {},
): void {
  const 条宽 = 选项.条宽 ?? 寸.条纹.宽;
  const 间距 = 选项.间距 ?? 寸.条纹.间距;
  const 角度 = ((选项.角度 ?? 寸.条纹.角度) * Math.PI) / 180;
  笔.save();
  笔.fillStyle = 串(颜色, 选项.透明 ?? 1);
  const 斜长 = Math.abs(高 / Math.cos(角度)) + 宽;
  const 起 = 左 - 斜长 / 2;
  const 止 = 左 + 宽 + 斜长 / 2;
  for (let x = 起; x < 止; x += 间距) {
    const dx = Math.tan(角度) * 高;
    笔.beginPath();
    笔.moveTo(x, 上);
    笔.lineTo(x + 条宽, 上);
    笔.lineTo(x + 条宽 + dx, 上 + 高);
    笔.lineTo(x + dx, 上 + 高);
    笔.closePath();
    笔.fill();
  }
  笔.restore();
}

/** 圆形键的落影：椭圆接触影，比整块投影更贴扁平图。 */
export function 圆落影(
  笔: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  横半径: number,
  纵半径: number,
  透明 = 0.28,
): void {
  const 倍 = 设备倍率(笔);
  笔.save();
  笔.shadowColor = 串(色.井, 透明);
  笔.shadowBlur = 寸.影.模糊 * 倍;
  笔.shadowOffsetY = 寸.影.偏移Y * 倍;
  笔.beginPath();
  笔.ellipse(cx, cy, 横半径, 纵半径, 0, 0, Math.PI * 2);
  笔.fillStyle = 串(色.井, 0.001);
  笔.fill();
  笔.restore();
}

/* ------------------------------------------------------------------ */
/* 图标笔画：统一圆头、统一线宽，全部用巧克力色压在上面                  */
/* ------------------------------------------------------------------ */

/** 圆弧箭头（左转/右转/刷新）：缺口圆 + 三角箭头，方向 1 顺时针、−1 逆时针。 */
export function 画弧箭头(
  笔: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  半径: number,
  方向: 1 | -1,
  颜色: number,
  线宽: number = 寸.图标.线宽,
): void {
  const 缺口 = 0.62;
  笔.save();
  笔.strokeStyle = 串(颜色);
  笔.fillStyle = 串(颜色);
  笔.lineWidth = 线宽;
  笔.lineCap = "round";
  const 起 = -Math.PI / 2 + 缺口 * 方向;
  const 止 = 起 + Math.PI * 1.42 * 方向;
  笔.beginPath();
  笔.arc(cx, cy, 半径, 起, 止, 方向 < 0);
  笔.stroke();
  // 箭头：落在圆弧收尾处，沿切线方向指出去
  const 头角 = 止;
  const 头X = cx + Math.cos(头角) * 半径;
  const 头Y = cy + Math.sin(头角) * 半径;
  const 切角 = 头角 + (Math.PI / 2) * 方向;
  const 大小 = 线宽 * 2.1;
  笔.beginPath();
  笔.moveTo(头X + Math.cos(切角) * 大小, 头Y + Math.sin(切角) * 大小);
  笔.lineTo(头X + Math.cos(切角 + 2.3) * 大小, 头Y + Math.sin(切角 + 2.3) * 大小);
  笔.lineTo(头X + Math.cos(切角 - 2.3) * 大小, 头Y + Math.sin(切角 - 2.3) * 大小);
  笔.closePath();
  笔.fill();
  笔.restore();
}

/** 三角形（左右移动、播放）：尖角朝 `向`，圆角三角贴扁平图。 */
export function 画三角(
  笔: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  尺寸: number,
  向: 1 | -1,
  颜色: number,
): void {
  笔.save();
  笔.fillStyle = 串(颜色);
  笔.beginPath();
  笔.moveTo(cx + 向 * 尺寸 * 0.62, cy);
  笔.lineTo(cx - 向 * 尺寸 * 0.5, cy + 尺寸 * 0.62);
  笔.lineTo(cx - 向 * 尺寸 * 0.5, cy - 尺寸 * 0.62);
  笔.closePath();
  笔.fill();
  笔.restore();
}

/** 双下箭头（软降）：两条圆头折线。 */
export function 画双箭头(
  笔: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  半宽: number,
  颜色: number,
  线宽: number = 寸.图标.线宽 + 0.6,
): void {
  笔.save();
  笔.strokeStyle = 串(颜色);
  笔.lineWidth = 线宽;
  笔.lineCap = "round";
  笔.lineJoin = "round";
  for (const 纵移 of [-半宽 * 0.42, 半宽 * 0.42]) {
    笔.beginPath();
    笔.moveTo(cx - 半宽, cy + 纵移 - 半宽 * 0.34);
    笔.lineTo(cx, cy + 纵移 + 半宽 * 0.34);
    笔.lineTo(cx + 半宽, cy + 纵移 - 半宽 * 0.34);
    笔.stroke();
  }
  笔.restore();
}

/** 下载/落下图标：向下的箭头 + 托盘横线。 */
export function 画下载图标(
  笔: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  尺寸: number,
  颜色: number,
  线宽: number = 寸.图标.线宽 + 0.4,
): void {
  笔.save();
  笔.strokeStyle = 串(颜色);
  笔.fillStyle = 串(颜色);
  笔.lineWidth = 线宽;
  笔.lineCap = "round";
  笔.lineJoin = "round";
  笔.beginPath();
  笔.moveTo(cx, cy - 尺寸 * 0.55);
  笔.lineTo(cx, cy + 尺寸 * 0.15);
  笔.moveTo(cx - 尺寸 * 0.3, cy - 尺寸 * 0.16);
  笔.lineTo(cx, cy + 尺寸 * 0.15);
  笔.lineTo(cx + 尺寸 * 0.3, cy - 尺寸 * 0.16);
  笔.stroke();
  笔.beginPath();
  笔.moveTo(cx - 尺寸 * 0.46, cy + 尺寸 * 0.4);
  笔.lineTo(cx + 尺寸 * 0.46, cy + 尺寸 * 0.4);
  笔.stroke();
  笔.restore();
}

/** 暂停/继续的动作图标（角键、角标共用）。 */
export function 画暂停继续(
  笔: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  尺寸: number,
  图标: "暂停" | "继续",
  颜色: number,
): void {
  笔.save();
  笔.fillStyle = 串(颜色);
  if (图标 === "暂停") {
    for (const 向 of [-1, 1] as const)
      圆角矩形路径(
        笔,
        cx + 向 * 尺寸 * 0.3 - 尺寸 * 0.13,
        cy - 尺寸 * 0.5,
        尺寸 * 0.26,
        尺寸,
        尺寸 * 0.1,
      );
  } else {
    笔.beginPath();
    笔.moveTo(cx - 尺寸 * 0.28, cy - 尺寸 * 0.5);
    笔.lineTo(cx + 尺寸 * 0.52, cy);
    笔.lineTo(cx - 尺寸 * 0.28, cy + 尺寸 * 0.5);
    笔.closePath();
  }
  笔.fill();
  笔.restore();
}
