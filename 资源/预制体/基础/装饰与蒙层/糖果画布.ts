import type { 图形对象 } from "../../../../.gamemaker/依赖/框架/界面/绘制/协议";

/**
 * 2D 离屏烘焙：用 canvas 2D 把部件画成一张位图，再贴回界面。
 *
 * 为什么需要它：项目的图形协议只有纯色、四角渐变、多边形与圆，做不出径向渐变、
 * 模糊、柔影、发光这类「画出来的」细节；canvas 2D 全都有。于是把这类部件在
 * 离屏画布上按 DPR 烘一遍（运行时生成，不落文件、不进包），再作为一张图贴回来，
 * 既保留代码即资源，又拿到 canvas 的完整绘制与后处理能力。
 *
 * 约定：
 * - 画布内容视为不可变；重新烘焙必须换新画布（缓存按 键+尺寸+倍率 区分）。
 * - 只烘焙静态形状；文字仍走文字服务，按下/悬停等状态用变换 + 叠色，不重新烘焙。
 * - 倍率取设备像素比（1~3），保证在 1x 验收机上也是像素级清晰。
 */

const 倍率上限 = 3;
const 缓存 = new Map<string, HTMLCanvasElement>();

function 当前倍率(): number {
  const 比 = typeof devicePixelRatio === "number" && devicePixelRatio > 0 ? devicePixelRatio : 1;
  return Math.max(1, Math.min(倍率上限, Math.round(比)));
}

/** 取一张按逻辑尺寸烘焙好的画布；同键只画一次。 */
export function 取烘焙画布(
  键: string,
  宽: number,
  高: number,
  画: (笔: CanvasRenderingContext2D, 倍率: number) => void,
): HTMLCanvasElement {
  const 倍率 = 当前倍率();
  const 全键 = `${键}|${宽.toFixed(1)}x${高.toFixed(1)}|${倍率}`;
  const 已有 = 缓存.get(全键);
  if (已有) return 已有;
  const 画布 = document.createElement("canvas");
  画布.width = Math.max(1, Math.ceil(宽 * 倍率));
  画布.height = Math.max(1, Math.ceil(高 * 倍率));
  const 笔 = 画布.getContext("2d");
  if (!笔) throw new Error("烘焙画布需要 2d 上下文");
  笔.scale(倍率, 倍率);
  画(笔, 倍率);
  缓存.set(全键, 画布);
  return 画布;
}

/** 把烘焙画布贴到绘制坐标（跟随当前图形变换与透明度）。 */
export function 贴烘焙画布(
  绘图: 图形对象,
  画布: HTMLCanvasElement,
  左: number,
  上: number,
  宽: number,
  高: number,
  透明度 = 1,
): void {
  绘图.绘制画布(画布, { 左, 上, 宽, 高 }, 透明度);
}

/** 清空烘焙缓存（主题/尺寸/配色变化时调用，避免旧画布常驻）。 */
export function 清空烘焙画布(): void {
  缓存.clear();
}

/* ------------------------------------------------------------------ */
/* 画布路径与后处理工具                                                 */
/* ------------------------------------------------------------------ */

/** 圆角矩形路径。 */
export function 圆角路径(
  笔: CanvasRenderingContext2D,
  左: number,
  上: number,
  宽: number,
  高: number,
  圆角: number,
): void {
  const r = Math.max(0, Math.min(圆角, 宽 / 2, 高 / 2));
  笔.beginPath();
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

/** 扇贝（花边）矩形路径：四边一圈半圆瓣，读作裱花收口。顺时针一条连续路径。 */
export function 扇贝路径(
  笔: CanvasRenderingContext2D,
  左: number,
  上: number,
  宽: number,
  高: number,
  瓣半径: number,
): void {
  const r = Math.max(1, 瓣半径);
  const 右 = 左 + 宽;
  const 下 = 上 + 高;
  笔.beginPath();
  const 边 = (x1: number, y1: number, x2: number, y2: number, nx: number, ny: number) => {
    const 长 = Math.hypot(x2 - x1, y2 - y1);
    const 数 = Math.max(1, Math.round(长 / (r * 2)));
    const 步 = 长 / 数;
    const dx = (x2 - x1) / 长;
    const dy = (y2 - y1) / 长;
    for (let i = 0; i < 数; i += 1) {
      const sx = x1 + dx * 步 * i;
      const sy = y1 + dy * 步 * i;
      if (i === 0 && x1 === 左 && y1 === 上) 笔.moveTo(sx, sy);
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

/** 给一条路径描「外发光」：按层描边，越外层越淡。 */
export function 描边辉光(
  笔: CanvasRenderingContext2D,
  路径: Path2D,
  颜色: string,
  层数 = 4,
  间距 = 2,
  线宽 = 2,
  最大透明 = 0.35,
): void {
  for (let i = 层数; i >= 1; i -= 1) {
    笔.globalAlpha = (最大透明 * i) / 层数;
    笔.strokeStyle = 颜色;
    笔.lineWidth = 线宽 + i * 间距;
    笔.stroke(路径);
  }
  笔.globalAlpha = 1;
}

/** 画一条从上到下「亮 → 透明」的柔光带（贴图内部的受光用）。 */
export function 竖向柔光(
  笔: CanvasRenderingContext2D,
  左: number,
  上: number,
  宽: number,
  高: number,
  颜色: string,
  最强 = 0.5,
): void {
  const 渐变 = 笔.createLinearGradient(0, 上, 0, 上 + 高);
  渐变.addColorStop(0, 颜色);
  渐变.addColorStop(1, "rgba(0,0,0,0)");
  笔.save();
  笔.globalAlpha = 最强;
  笔.fillStyle = 渐变;
  笔.fillRect(左, 上, 宽, 高);
  笔.restore();
}
