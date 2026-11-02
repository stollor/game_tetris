import type { 对局布局数据 } from "../../../../代码/页面/布局/对局布局";
import { 串 } from "./工具";

/**
 * 底板·棋盘（区域 0,150,285,560）。
 *
 * 全部以 `布局.棋盘`（井口内区）为基准向外量，严格画在棋盘区域内（左右 14、上下 20）。
 * 由外到内五层：
 *   ① 糖棍外框：玫瑰底 + 45° 奶油斜条 + 顶棱高光 + 外描边 + 柔和落影
 *   ② 内凹槽：框与唇之间的暗槽，撑出外框厚度
 *   ③ 奶油唇：淡粉亮沿 + 暗缝 + 玫瑰唇体（越靠井口越亮）
 *   ④ 扇贝内沿：唇压住井口，内沿按格子节奏（瓣距 = 格子大小）起伏，谷底透出针孔暗点
 *   ⑤ 井底：近黑巧克力 + 粉糖点阵（格点交会处）+ 顶部内影 + 轻微暗角
 *
 * 上下框比左右厚（托盘透视），多出来的厚度全给奶油唇——与目标图的比例一致。
 * 糖果块、幽灵、当前块都不在这里画（矢量层负责）。
 * 注意：矢量层仍会叠画旧棋盘外框（守卫由 Lead 加），对照图里出现重影属正常，
 * 本文件只保证 canvas 版本身与目标一致。
 */

/** 一块框边：自井口向外量。 */
interface 框边 {
  左: number;
  上: number;
  右: number;
  下: number;
}

/** 能接受路径指令的最小集合（Path2D 与 2D 上下文都满足）。 */
type 画路 = Pick<
  CanvasRenderingContext2D,
  "moveTo" | "lineTo" | "arcTo" | "closePath" | "quadraticCurveTo"
>;

const 外框: 框边 = { 左: 14, 上: 20, 右: 14, 下: 20 };
/** 糖棍斜纹带的厚度：上下宽（受光面大），左右窄。 */
const 轨厚: 框边 = { 左: 7, 上: 6.2, 右: 7, 下: 6.2 };
/** 凹槽厚度：左右窄（侧壁几乎看不见），上下宽（托盘内壁）。 */
const 槽厚: 框边 = { 左: 1.4, 上: 4.6, 右: 1.4, 下: 4.6 };
/** 唇外沿淡粉亮沿厚度。 */
const 棱厚: 框边 = { 左: 1.6, 上: 2.2, 右: 1.6, 下: 2.2 };
/** 亮沿与唇体之间的暗缝。 */
const 缝厚 = 0.6;
/** 井口圆角。 */
const 井圆角 = 7;
/** 外框圆角。 */
const 外圆角 = 16;
/** 斜条纹周期（沿 x 量）。 */
const 条距 = 13;
/** 斜条纹的奶油条宽度（沿 x 量）。 */
const 条宽 = 6.4;
/** 唇的扇贝凸入井口的深度：左右唇薄，起伏收小；上下唇厚，起伏更明显。 */
const 瓣幅 = { 横: 1.5, 竖: 2.5 };

const 四边 = (v: number): 框边 => ({ 左: v, 上: v, 右: v, 下: v });
const 减 = (边: 框边, 厚: 框边 | number): 框边 => {
  const t = typeof 厚 === "number" ? 四边(厚) : 厚;
  return {
    左: Math.max(0, 边.左 - t.左),
    上: Math.max(0, 边.上 - t.上),
    右: Math.max(0, 边.右 - t.右),
    下: Math.max(0, 边.下 - t.下),
  };
};

const 轨内 = 减(外框, 轨厚);
const 槽内 = 减(轨内, 槽厚);
const 棱内 = 减(槽内, 棱厚);
const 缝内 = 减(棱内, 缝厚);
/** 外框矩形（canvas 坐标）。 */
const 外框矩形 = (井: { 左: number; 上: number; 宽: number; 高: number }) => ({
  左: 井.左 - 外框.左,
  上: 井.上 - 外框.上,
  宽: 井.宽 + 外框.左 + 外框.右,
  高: 井.高 + 外框.上 + 外框.下,
});

/** 把「自井口内缩 d」的圆角矩形追加到路径。 */
function 追加框(
  目标: 画路,
  井: { 左: number; 上: number; 宽: number; 高: number },
  d: 框边,
  圆角: number,
): void {
  const 左 = 井.左 - d.左;
  const 上 = 井.上 - d.上;
  const 宽 = 井.宽 + d.左 + d.右;
  const 高 = 井.高 + d.上 + d.下;
  const r = Math.max(0, Math.min(圆角, 宽 / 2, 高 / 2));
  目标.moveTo(左 + r, 上);
  目标.lineTo(左 + 宽 - r, 上);
  目标.arcTo(左 + 宽, 上, 左 + 宽, 上 + r, r);
  目标.lineTo(左 + 宽, 上 + 高 - r);
  目标.arcTo(左 + 宽, 上 + 高, 左 + 宽 - r, 上 + 高, r);
  目标.lineTo(左 + r, 上 + 高);
  目标.arcTo(左, 上 + 高, 左, 上 + 高 - r, r);
  目标.lineTo(左, 上 + r);
  目标.arcTo(左, 上, 左 + r, 上, r);
  目标.closePath();
}

/** 把内缩 d 的圆角矩形设成当前路径。 */
function 框路径(
  笔: CanvasRenderingContext2D,
  井: { 左: number; 上: number; 宽: number; 高: number },
  d: 框边,
  圆角: number,
): void {
  笔.beginPath();
  追加框(笔, 井, d, 圆角);
}

/** 两条内缩框之间的环（evenodd 填。用于各层「带」）。 */
function 环路径(
  井: { 左: number; 上: number; 宽: number; 高: number },
  外距: 框边,
  内距: 框边,
  圆角: number,
): Path2D {
  const 路径 = new Path2D();
  追加框(路径, 井, 外距, 圆角);
  追加框(路径, 井, 内距, Math.max(1, 圆角 - 1));
  return 路径;
}

/**
 * 追加「扇贝矩形」：四条直边按瓣距起伏，峰值朝井内凸出 `幅度`，四角圆角过渡。
 */
function 追加扇贝(
  目标: 画路,
  井: { 左: number; 上: number; 宽: number; 高: number },
  圆角: number,
  瓣距: number,
  幅度: { 横: number; 竖: number },
): void {
  const 左 = 井.左;
  const 上 = 井.上;
  const 右 = 井.左 + 井.宽;
  const 下 = 井.上 + 井.高;
  const 角 = Math.max(1, Math.min(圆角, 井.宽 / 2, 井.高 / 2));
  const 边 = (
    起X: number,
    起Y: number,
    终X: number,
    终Y: number,
    法X: number,
    法Y: number,
    幅: number,
  ): void => {
    const 长 = Math.hypot(终X - 起X, 终Y - 起Y);
    if (长 < 0.5) return;
    const 数 = Math.max(1, Math.round(长 / 瓣距));
    const 步 = 长 / 数;
    const dx = (终X - 起X) / 长;
    const dy = (终Y - 起Y) / 长;
    for (let i = 0; i < 数; i += 1) {
      const ex = 起X + dx * 步 * (i + 1);
      const ey = 起Y + dy * 步 * (i + 1);
      const mx = 起X + dx * 步 * (i + 0.5) + 法X * 幅 * 2;
      const my = 起Y + dy * 步 * (i + 0.5) + 法Y * 幅 * 2;
      目标.quadraticCurveTo(mx, my, ex, ey);
    }
  };
  目标.moveTo(左 + 角, 上);
  边(左 + 角, 上, 右 - 角, 上, 0, 1, 幅度.竖);
  目标.quadraticCurveTo(右, 上, 右, 上 + 角);
  边(右, 上 + 角, 右, 下 - 角, 1, 0, 幅度.横);
  目标.quadraticCurveTo(右, 下, 右 - 角, 下);
  边(右 - 角, 下, 左 + 角, 下, 0, -1, 幅度.竖);
  目标.quadraticCurveTo(左, 下, 左, 下 - 角);
  边(左, 下 - 角, 左, 上 + 角, -1, 0, 幅度.横);
  目标.quadraticCurveTo(左, 上, 左 + 角, 上);
  目标.closePath();
}

export function 画糖果棋盘(笔: CanvasRenderingContext2D, 布局: 对局布局数据): void {
  const 井 = 布局.棋盘;
  const 格 = 布局.格子大小;
  const 左 = 井.左;
  const 上 = 井.上;
  const 右 = 井.左 + 井.宽;
  const 下 = 井.上 + 井.高;
  const 井矩形 = { 左: 井.左, 上: 井.上, 宽: 井.宽, 高: 井.高 };
  const 外 = 外框矩形(井矩形);

  /* ---------- ① 糖棍外框 ---------- */
  笔.save();
  笔.shadowColor = "rgba(24, 4, 10, 0.6)";
  笔.shadowBlur = 10;
  笔.shadowOffsetY = 5;
  框路径(笔, 井矩形, 外框, 外圆角);
  笔.fillStyle = 串(0xb4525f);
  笔.fill();
  笔.restore();

  笔.save();
  框路径(笔, 井矩形, 外框, 外圆角);
  笔.clip();
  const 框底 = 笔.createLinearGradient(0, 外.上, 0, 外.上 + 外.高);
  框底.addColorStop(0, 串(0xcb6270));
  框底.addColorStop(0.42, 串(0xc25865));
  框底.addColorStop(1, 串(0xa44352));
  笔.fillStyle = 框底;
  笔.fillRect(外.左, 外.上, 外.宽, 外.高);

  // 45° 奶油斜条（"\" 方向，与目标一致）
  const 斜条 = (宽: number, 色: string): void => {
    笔.strokeStyle = 色;
    笔.lineWidth = 宽;
    笔.beginPath();
    for (let s = 外.左 - 外.高 - 条距; s < 外.左 + 外.宽 + 条距; s += 条距) {
      笔.moveTo(s, 外.上);
      笔.lineTo(s + 外.高, 外.上 + 外.高);
    }
    笔.stroke();
  };
  斜条(条宽 + 1.2, "rgba(244, 170, 158, 0.18)");
  斜条(条宽, 串(0xeaa196, 0.97));

  // 受光：上沿提亮、下沿压暗
  const 受光 = 笔.createLinearGradient(0, 外.上, 0, 外.上 + 外.高);
  受光.addColorStop(0, "rgba(255, 232, 220, 0.2)");
  受光.addColorStop(0.16, "rgba(255, 232, 220, 0.03)");
  受光.addColorStop(0.7, "rgba(74, 16, 28, 0.05)");
  受光.addColorStop(1, "rgba(46, 6, 18, 0.32)");
  笔.fillStyle = 受光;
  笔.fillRect(外.左, 外.上, 外.宽, 外.高);
  笔.restore();

  // 四个角的斜接缝：让外框读作四条糖棍拼成，而不是一圈印花
  {
    笔.save();
    笔.clip(环路径(井矩形, 外框, 轨内, 11), "evenodd");
    const 斜接 = (角X: number, 角Y: number, sx: number, sy: number): void => {
      const 长 = Math.max(外框.左, 外框.上) * 1.8;
      笔.beginPath();
      笔.moveTo(角X, 角Y);
      笔.lineTo(角X + sx * 长, 角Y + sy * 长);
      笔.lineWidth = 1.7;
      笔.strokeStyle = "rgba(78, 26, 38, 0.5)";
      笔.stroke();
    };
    斜接(外.左, 外.上, 1, 1);
    斜接(外.左 + 外.宽, 外.上, -1, 1);
    斜接(外.左, 外.上 + 外.高, 1, -1);
    斜接(外.左 + 外.宽, 外.上 + 外.高, -1, -1);
    笔.restore();
  }

  // 外描边（暗）+ 顶棱高光（浅）
  框路径(笔, 井矩形, 减(外框, 0.6), 外圆角 - 0.6);
  笔.lineWidth = 1.1;
  笔.strokeStyle = 串(0x55202c, 0.5);
  笔.stroke();
  const 顶棱 = 笔.createLinearGradient(0, 外.上, 0, 外.上 + 外.高);
  顶棱.addColorStop(0, "rgba(255, 214, 200, 0.5)");
  顶棱.addColorStop(0.45, "rgba(240, 168, 158, 0.3)");
  顶棱.addColorStop(1, "rgba(122, 44, 56, 0.34)");
  框路径(笔, 井矩形, 减(外框, 1.1), 外圆角 - 1.1);
  笔.lineWidth = 0.9;
  笔.strokeStyle = 顶棱;
  笔.stroke();

  /* ---------- ② 内凹槽（框与唇之间的暗带） ---------- */
  笔.fillStyle = 串(0x5f2b31);
  笔.fill(环路径(井矩形, 轨内, 槽内, 11), "evenodd");

  /* ---------- ③ 唇外沿：淡粉亮沿 + 暗缝 ---------- */
  const 亮沿 = 笔.createLinearGradient(0, 外.上, 0, 外.上 + 外.高);
  亮沿.addColorStop(0, "rgba(238, 164, 160, 0.96)");
  亮沿.addColorStop(0.5, "rgba(216, 136, 138, 0.92)");
  亮沿.addColorStop(1, "rgba(192, 114, 120, 0.88)");
  笔.fillStyle = 亮沿;
  笔.fill(环路径(井矩形, 槽内, 棱内, 10), "evenodd");
  笔.fillStyle = "rgba(72, 26, 34, 0.8)";
  笔.fill(环路径(井矩形, 棱内, 缝内, 9.4), "evenodd");

  /* ---------- ⑤ 井底（先铺底，唇压在井口上） ---------- */
  框路径(笔, 井矩形, 四边(0), 井圆角);
  笔.save();
  笔.clip();
  笔.fillStyle = 串(0x35181d);
  笔.fillRect(左, 上, 井.宽, 井.高);

  // 粉糖点阵：格点交会处一颗，越靠边越淡
  for (let 列 = 1; 列 < 井.列; 列 += 1) {
    for (let 行 = 1; 行 < 井.行; 行 += 1) {
      const x = 左 + 列 * 格;
      const y = 上 + 行 * 格;
      const 距边 = Math.min(x - 左, 右 - x, y - 上, 下 - y);
      const 淡 = Math.min(1, Math.max(0.42, 距边 / (格 * 1.8)));
      笔.fillStyle = 串(0x8c5b66, 0.16 * 淡);
      笔.beginPath();
      笔.arc(x, y, 1.9, 0, Math.PI * 2);
      笔.fill();
      笔.fillStyle = 串(0x8f5d67, 0.56 * 淡);
      笔.beginPath();
      笔.arc(x, y, 0.98, 0, Math.PI * 2);
      笔.fill();
    }
  }

  // 顶部内影
  const 顶影 = 笔.createLinearGradient(0, 上, 0, 上 + 格 * 1.3);
  顶影.addColorStop(0, "rgba(0, 0, 0, 0.3)");
  顶影.addColorStop(0.5, "rgba(0, 0, 0, 0.1)");
  顶影.addColorStop(1, "rgba(0, 0, 0, 0)");
  笔.fillStyle = 顶影;
  笔.fillRect(左, 上, 井.宽, 格 * 1.3);

  // 轻微暗角
  const 暗角 = 笔.createRadialGradient(
    左 + 井.宽 / 2,
    上 + 井.高 / 2,
    Math.min(井.宽, 井.高) * 0.3,
    左 + 井.宽 / 2,
    上 + 井.高 / 2,
    Math.max(井.宽, 井.高) * 0.74,
  );
  暗角.addColorStop(0, "rgba(0, 0, 0, 0)");
  暗角.addColorStop(1, "rgba(0, 0, 0, 0.12)");
  笔.fillStyle = 暗角;
  笔.fillRect(左, 上, 井.宽, 井.高);
  笔.restore();

  // 井口内沿一道暗线，把唇与井底分开
  框路径(笔, 井矩形, 四边(0.5), 井圆角);
  笔.lineWidth = 1;
  笔.strokeStyle = "rgba(18, 5, 9, 0.75)";
  笔.stroke();

  /* ---------- ④ 奶油扇贝唇 ---------- */
  const 环 = new Path2D();
  追加框(环, 井矩形, 缝内, 8.4);
  追加扇贝(环, 井矩形, 井圆角 + 1, 格, 瓣幅);
  笔.save();
  const 唇色 = 笔.createLinearGradient(0, 外.上, 0, 外.上 + 外.高);
  唇色.addColorStop(0, 串(0x8b464d));
  唇色.addColorStop(0.3, 串(0x954c51));
  唇色.addColorStop(0.65, 串(0xa4575b));
  唇色.addColorStop(1, 串(0xae6063));
  笔.fillStyle = 唇色;
  笔.fill(环, "evenodd");

  // 唇体圆度：靠井口一侧提亮，外沿一侧压暗
  const 内边 = new Path2D();
  追加扇贝(内边, 井矩形, 井圆角 + 1, 格, 瓣幅);
  笔.lineWidth = 1.8;
  笔.strokeStyle = "rgba(196, 118, 116, 0.42)";
  笔.stroke(内边);
  const 外边 = new Path2D();
  追加框(外边, 井矩形, 缝内, 8.4);
  笔.lineWidth = 1.4;
  笔.strokeStyle = "rgba(58, 18, 26, 0.42)";
  笔.stroke(外边);

  // 唇中线的一串小高光（挤花糖霜的质感）
  const 虚线 = (x1: number, y1: number, x2: number, y2: number): void => {
    const 长 = Math.hypot(x2 - x1, y2 - y1);
    const 数 = Math.max(1, Math.round(长 / 9));
    笔.fillStyle = "rgba(224, 158, 156, 0.3)";
    for (let i = 0; i < 数; i += 1) {
      const t = (i + 0.5) / 数;
      笔.beginPath();
      笔.arc(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t, 1.05, 0, Math.PI * 2);
      笔.fill();
    }
  };
  虚线(左, 上 - 缝内.上 / 2, 右, 上 - 缝内.上 / 2);
  虚线(左, 下 + 缝内.下 / 2, 右, 下 + 缝内.下 / 2);
  虚线(左 - 缝内.左 / 2, 上, 左 - 缝内.左 / 2, 下);
  虚线(右 + 缝内.右 / 2, 上, 右 + 缝内.右 / 2, 下);
  笔.restore();

  /* 扇贝谷底的针孔：缝隙里透出的井底暗色 */
  const 画孔 = (x: number, y: number, 半径 = 1.05): void => {
    笔.fillStyle = "rgba(22, 7, 11, 0.68)";
    笔.beginPath();
    笔.arc(x, y, 半径, 0, Math.PI * 2);
    笔.fill();
  };
  const 横数 = Math.max(1, Math.round((井.宽 - 井圆角 * 2) / 格));
  const 竖数 = Math.max(1, Math.round((井.高 - 井圆角 * 2) / 格));
  for (let i = 1; i < 横数; i += 1) {
    const x = 左 + 井圆角 + ((井.宽 - 井圆角 * 2) / 横数) * i;
    画孔(x, 上);
    画孔(x, 下);
  }
  for (let i = 1; i < 竖数; i += 1) {
    const y = 上 + 井圆角 + ((井.高 - 井圆角 * 2) / 竖数) * i;
    画孔(左, y, 0.85);
    画孔(右, y, 0.85);
  }
}
