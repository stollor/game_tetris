import type { 对局布局数据 } from "../../../../代码/页面/布局/对局布局";
import { 亮色, 暗色, 混色 } from "../../../../.gamemaker/依赖/框架/界面/颜色工具";
import { 糖果规范 } from "../../../主题/糖果/糖果规范";
import { 串 } from "./工具";

const 色 = 糖果规范.色;

/**
 * 底板·顶栏：标题糖（糖纸扭结 + 金箍）、LV / SCORE / LINES 三块玫瑰木名牌（金边、月桂枝）、
 * 糖绳与正中蝴蝶结。暂停键归操作区，这里不画。
 *
 * 牌位与 `计算对局仪表` 同源：舱位矩形只在内部收边，文字仍由矢量层画在原坐标上。
 */

/* 玫瑰木牌面：比底板背景亮一档、比描边暗一档，全部由糖果规范混出。 */
const 牌面顶 = 混色(色.奶油, 色.粉, 0.45);
const 牌面中 = 混色(牌面顶, 暗色(牌面顶, 0.16), 0.35);
const 牌面底 = 混色(牌面顶, 色.草莓浅, 0.5);
const 牌边 = 混色(色.莓浅, 色.粉, 0.34);
const 牌线 = 混色(色.粉, 色.奶油, 0.45);
/* 金饰：金线、月桂枝、糖钉。 */
const 金 = 混色(色.金, 色.金深, 0.3);
const 金亮 = 亮色(色.金, 0.3);
const 金暗 = 混色(色.金深, 色.巧克力, 0.25);

interface 牌位 {
  左: number;
  上: number;
  宽: number;
  高: number;
}

/** 三块名牌的作画矩形：沿用仪表舱位（主/左/右）的左右与高度，只把上沿收到标签文字之下。 */
export function 计算糖果牌位(布局: 对局布局数据): { 主: 牌位; 左: 牌位; 右: 牌位 } {
  const 栏 = 布局.信息栏;
  const 左 = 栏.中心X - 栏.宽 / 2;
  const 顶 = 栏.中心Y - 栏.高 / 2;
  const 主宽 = 栏.宽 * 0.49;
  const 侧宽 = 栏.宽 * 0.245 - 5;
  const 上 = 顶 + 8;
  const 高 = 栏.高 - 3;
  return {
    主: { 左: 栏.中心X - 主宽 / 2, 上, 宽: 主宽, 高 },
    左: { 左, 上, 宽: 侧宽, 高 },
    右: { 左: 左 + 栏.宽 - 侧宽, 上, 宽: 侧宽, 高 },
  };
}

/** 小名牌外形：上沿圆角、下沿一排扇贝，读作被糖纸包住的胶囊标签。 */
function 小牌路径(
  笔: CanvasRenderingContext2D,
  左: number,
  上: number,
  宽: number,
  高: number,
  圆角: number,
  瓣数 = 6,
): void {
  const 右 = 左 + 宽;
  const 下 = 上 + 高;
  const 圆 = Math.min(圆角, 宽 / 2, 高 / 2);
  笔.beginPath();
  笔.moveTo(左, 下 - 2.6);
  笔.lineTo(左, 上 + 圆);
  笔.quadraticCurveTo(左, 上, 左 + 圆, 上);
  笔.lineTo(右 - 圆, 上);
  笔.quadraticCurveTo(右, 上, 右, 上 + 圆);
  笔.lineTo(右, 下 - 2.6);
  for (let i = 瓣数; i >= 1; i -= 1) {
    const x1 = 左 + (i * 宽) / 瓣数;
    const x2 = 左 + ((i - 1) * 宽) / 瓣数;
    笔.quadraticCurveTo((x1 + x2) / 2, 下 + 3.2, x2, 下 - 2.6);
  }
  笔.closePath();
}

/** 主名牌外形：四角切角的长圆角票签。 */
function 大牌路径(
  笔: CanvasRenderingContext2D,
  左: number,
  上: number,
  宽: number,
  高: number,
  切: number,
): void {
  const 右 = 左 + 宽;
  const 下 = 上 + 高;
  笔.beginPath();
  笔.moveTo(左 + 切, 上);
  笔.lineTo(右 - 切, 上);
  笔.lineTo(右, 上 + 切);
  笔.lineTo(右, 下 - 切);
  笔.lineTo(右 - 切, 下);
  笔.lineTo(左 + 切, 下);
  笔.lineTo(左, 下 - 切);
  笔.lineTo(左, 上 + 切);
  笔.closePath();
}

/** 沿当前路径内缩一圈描边（用中心缩放近似，招牌面只有一层裱线，够用）。 */
function 内缩描边(笔: CanvasRenderingContext2D, 牌: 牌位, 路径: () => void, 色串: string, 线宽: number): void {
  const 中心X = 牌.左 + 牌.宽 / 2;
  const 中心Y = 牌.上 + 牌.高 / 2;
  笔.save();
  笔.translate(中心X, 中心Y);
  笔.scale(1 - 7 / 牌.宽, 1 - 7 / 牌.高);
  笔.translate(-中心X, -中心Y);
  路径();
  笔.strokeStyle = 色串;
  笔.lineWidth = 线宽;
  笔.stroke();
  笔.restore();
}

/** 牌面：落影 → 上亮下暗的玫瑰木 → 顶部内阴影 → 底沿反光 → 粉边；主牌再压一圈奶油裱线。 */
function 填牌面(笔: CanvasRenderingContext2D, 牌: 牌位, 主: boolean, 路径: () => void): void {
  笔.save();
  笔.shadowColor = "rgba(0,0,0,0.5)";
  笔.shadowBlur = 7;
  笔.shadowOffsetY = 3.5;
  路径();
  笔.fillStyle = 串(牌面中);
  笔.fill();
  笔.restore();

  const 渐 = 笔.createLinearGradient(0, 牌.上, 0, 牌.上 + 牌.高);
  渐.addColorStop(0, 串(亮色(牌面顶, 0.1)));
  渐.addColorStop(0.5, 串(牌面顶));
  渐.addColorStop(1, 串(牌面底));
  路径();
  笔.fillStyle = 渐;
  笔.fill();

  笔.save();
  路径();
  笔.clip();
  const 顶影 = 笔.createLinearGradient(0, 牌.上, 0, 牌.上 + 牌.高 * 0.34);
  顶影.addColorStop(0, "rgba(20,6,10,0.16)");
  顶影.addColorStop(1, "rgba(20,6,10,0)");
  笔.fillStyle = 顶影;
  笔.fillRect(牌.左, 牌.上, 牌.宽, 牌.高 * 0.5);
  笔.fillStyle = 串(色.粉, 0.12);
  笔.fillRect(牌.左, 牌.上 + 牌.高 - 7, 牌.宽, 7);
  笔.restore();

  路径();
  笔.strokeStyle = 串(色.莓暗, 0.55);
  笔.lineWidth = 4.2;
  笔.stroke();
  路径();
  笔.strokeStyle = 串(牌边);
  笔.lineWidth = 2.4;
  笔.stroke();
  内缩描边(笔, 牌, 路径, 串(色.莓暗, 0.5), 1.1);
  if (主) 内缩描边(笔, 牌, 路径, 串(牌线, 0.34), 1);
}

/** 侧牌：两颗金糖钉把名牌咬在糖墙上。 */
function 画糖钉(笔: CanvasRenderingContext2D, 牌: 牌位): void {
  for (const x of [牌.左 + 9.5, 牌.左 + 牌.宽 - 9.5]) {
    const y = 牌.上 + 牌.高 * 0.5;
    笔.beginPath();
    笔.arc(x, y, 2.2, 0, Math.PI * 2);
    笔.fillStyle = 串(金暗, 0.85);
    笔.fill();
    笔.beginPath();
    笔.arc(x, y - 0.2, 1.7, 0, Math.PI * 2);
    笔.fillStyle = 串(金, 0.95);
    笔.fill();
    笔.beginPath();
    笔.arc(x - 0.6, y - 0.8, 0.8, 0, Math.PI * 2);
    笔.fillStyle = "rgba(255,248,228,0.9)";
    笔.fill();
  }
}

/** 月桂枝：一根上弯的茎，两侧交错六对尖叶，叶尖朝外上方，紧贴读数外侧。 */
function 画月桂枝(笔: CanvasRenderingContext2D, x: number, y: number, 向: 1 | -1): void {
  笔.save();
  笔.translate(x, y);
  笔.scale(向, 1);
  笔.beginPath();
  笔.moveTo(0, 11.5);
  笔.quadraticCurveTo(5.6, 2, 2.2, -11.5);
  笔.lineCap = "round";
  笔.strokeStyle = 串(金暗, 0.95);
  笔.lineWidth = 1.8;
  笔.stroke();
  笔.strokeStyle = 串(金亮, 0.9);
  笔.lineWidth = 0.8;
  笔.stroke();
  for (let i = 0; i < 5; i += 1) {
    const t = i / 4;
    const 茎X = 1.4 + t * 3.6;
    const 茎Y = 9.2 - t * 17.6;
    const 长 = 6.2 - i * 0.55;
    for (const 侧 of [-1, 1] as const) {
      笔.save();
      笔.translate(茎X, 茎Y);
      笔.rotate(侧 < 0 ? -2.38 + t * 0.22 : -0.76 - t * 0.22);
      笔.beginPath();
      笔.moveTo(0, 0);
      笔.quadraticCurveTo(长 * 0.5, -长 * 0.42, 长, 0);
      笔.quadraticCurveTo(长 * 0.5, 长 * 0.42, 0, 0);
      笔.closePath();
      笔.fillStyle = 串(侧 < 0 ? 金 : 金亮, 0.95);
      笔.fill();
      笔.strokeStyle = 串(金暗, 0.55);
      笔.lineWidth = 0.6;
      笔.stroke();
      笔.restore();
    }
  }
  笔.restore();
}

/** 一块名牌：主牌带月桂枝，侧牌带糖钉。 */
function 画名牌(笔: CanvasRenderingContext2D, 牌: 牌位, 主: boolean): void {
  const 路径 = () =>
    主 ? 大牌路径(笔, 牌.左, 牌.上, 牌.宽, 牌.高, 10) : 小牌路径(笔, 牌.左, 牌.上, 牌.宽, 牌.高, 12);
  填牌面(笔, 牌, 主, 路径);
  if (!主) {
    画糖钉(笔, 牌);
    return;
  }
  const y = 牌.上 + 牌.高 * 0.62;
  画月桂枝(笔, 牌.左 + 19, y, 1);
  画月桂枝(笔, 牌.左 + 牌.宽 - 19, y, -1);
  // 牌面下沿一道奶油压线，把读数兜住。
  笔.save();
  路径();
  笔.clip();
  笔.fillStyle = 串(色.奶油, 0.16);
  笔.fillRect(牌.左 + 10, 牌.上 + 牌.高 - 3.2, 牌.宽 - 20, 1.6);
  笔.restore();
}

/** 糖纸扭结：从糖身端部向外张开的褶扇，褶线一深一浅。 */
function 画扭结(
  笔: CanvasRenderingContext2D,
  颈X: number,
  中心Y: number,
  向: 1 | -1,
  伸: number,
  身高: number,
): void {
  const 颈 = 身高 * 0.3;
  const 尖 = 身高 * 0.7;
  // 外缘做成三个褶尖，读作拧起来的糖纸。
  const 路径 = () => {
    笔.beginPath();
    笔.moveTo(0, -颈);
    笔.quadraticCurveTo(伸 * 0.55, -尖 * 1.02, 伸, -尖 * 0.62);
    笔.quadraticCurveTo(伸 - 5, -尖 * 0.42, 伸 + 1.5, -尖 * 0.2);
    笔.quadraticCurveTo(伸 - 5, 0, 伸 + 1.5, 尖 * 0.2);
    笔.quadraticCurveTo(伸 - 5, 尖 * 0.42, 伸, 尖 * 0.62);
    笔.quadraticCurveTo(伸 * 0.55, 尖 * 1.02, 0, 颈);
    笔.quadraticCurveTo(-3.4, 0, 0, -颈);
    笔.closePath();
  };
  笔.save();
  笔.translate(颈X, 中心Y);
  笔.scale(向, 1);
  路径();
  const 渐 = 笔.createLinearGradient(0, 0, 伸, 0);
  渐.addColorStop(0, 串(混色(色.草莓, 色.粉, 0.38)));
  渐.addColorStop(0.5, 串(混色(色.草莓, 色.草莓深, 0.28)));
  渐.addColorStop(1, 串(混色(色.草莓深, 色.莓, 0.3)));
  笔.fillStyle = 渐;
  笔.fill();
  笔.save();
  笔.clip();
  笔.strokeStyle = 串(色.草莓深, 0.4);
  笔.lineWidth = 1.1;
  for (const k of [-0.62, 0.06, 0.68]) {
    笔.beginPath();
    笔.moveTo(1, k * 颈 * 0.9);
    笔.lineTo(伸 - 0.5, k * 尖 * 0.94);
    笔.stroke();
  }
  笔.strokeStyle = 串(色.草莓浅, 0.55);
  笔.lineWidth = 1.3;
  for (const k of [-0.32, 0.38]) {
    笔.beginPath();
    笔.moveTo(1, k * 颈 * 0.9);
    笔.lineTo(伸 - 0.5, k * 尖 * 0.94);
    笔.stroke();
  }
  // 端部尖角压一记暗，读作折过来的糖纸背面。
  笔.fillStyle = 串(色.莓暗, 0.24);
  笔.fillRect(伸 - 5, -尖, 6, 尖 * 2);
  笔.restore();
  路径();
  笔.strokeStyle = 串(色.莓暗, 0.6);
  笔.lineWidth = 1.1;
  笔.stroke();
  笔.restore();
}

/** 金箍：糖身两端各一道竖金环，左亮右暗，压住糖纸与糖身的接缝。 */
function 画金箍(笔: CanvasRenderingContext2D, x: number, 中心Y: number, 身高: number): void {
  const 宽 = 10.5;
  const 高 = 身高 * 0.86;
  const 渐 = 笔.createLinearGradient(x - 宽 / 2, 0, x + 宽 / 2, 0);
  渐.addColorStop(0, 串(色.金深));
  渐.addColorStop(0.24, 串(金亮));
  渐.addColorStop(0.6, 串(金));
  渐.addColorStop(1, 串(色.金深));
  笔.beginPath();
  笔.roundRect(x - 宽 / 2, 中心Y - 高 / 2, 宽, 高, 3.4);
  笔.fillStyle = 渐;
  笔.fill();
  笔.strokeStyle = 串(色.巧克力, 0.34);
  笔.lineWidth = 1;
  笔.stroke();
  笔.strokeStyle = 串(色.巧克力, 0.16);
  for (const t of [-0.26, 0.26]) {
    笔.beginPath();
    笔.moveTo(x - 宽 / 2 + 1, 中心Y + 高 * t);
    笔.lineTo(x + 宽 / 2 - 1, 中心Y + 高 * t);
    笔.stroke();
  }
  笔.fillStyle = "rgba(255,248,232,0.6)";
  笔.beginPath();
  笔.roundRect(x - 宽 / 2 + 1.6, 中心Y - 高 / 2 + 2.2, 2.2, 高 - 4.4, 1.1);
  笔.fill();
}

/** 四角闪星（糖纸上的装饰星）。 */
function 画闪星(笔: CanvasRenderingContext2D, x: number, y: number, 尺寸: number): void {
  const 腰 = 尺寸 * 0.28;
  笔.beginPath();
  笔.moveTo(x, y - 尺寸);
  笔.lineTo(x + 腰, y - 腰);
  笔.lineTo(x + 尺寸, y);
  笔.lineTo(x + 腰, y + 腰);
  笔.lineTo(x, y + 尺寸);
  笔.lineTo(x - 腰, y + 腰);
  笔.lineTo(x - 尺寸, y);
  笔.lineTo(x - 腰, y - 腰);
  笔.closePath();
  笔.fillStyle = 串(色.象牙, 0.95);
  笔.fill();
}

/** 标题糖：两端褶扇糖纸 + 金箍 + 上亮下暗的草莓糖身 + 顶部糖衣反光 + 两侧闪星。 */
function 画标题糖(
  笔: CanvasRenderingContext2D,
  中心X: number,
  中心Y: number,
  身宽: number,
  身高: number,
): void {
  const 身左 = 中心X - 身宽 / 2;
  const 身右 = 中心X + 身宽 / 2;
  const 身上 = 中心Y - 身高 / 2;
  const 伸 = 30;
  const 胶囊 = () => {
    笔.beginPath();
    笔.roundRect(身左, 身上, 身宽, 身高, 身高 / 2);
  };

  // ① 落影：糖体连同糖纸一起压在墙上。
  笔.save();
  笔.shadowColor = "rgba(0,0,0,0.5)";
  笔.shadowBlur = 10;
  笔.shadowOffsetY = 4;
  胶囊();
  笔.fillStyle = 串(混色(色.草莓深, 色.莓暗, 0.4));
  笔.fill();
  笔.restore();

  // ② 糖纸扭结在糖身之后。
  画扭结(笔, 身左, 中心Y, -1, 伸, 身高);
  画扭结(笔, 身右, 中心Y, 1, 伸, 身高);

  // ③ 糖身
  胶囊();
  const 体 = 笔.createLinearGradient(0, 身上, 0, 身上 + 身高);
  体.addColorStop(0, 串(混色(色.草莓糖, 色.莓暗, 0.34)));
  体.addColorStop(0.45, 串(混色(色.草莓糖, 色.莓暗, 0.46)));
  体.addColorStop(1, 串(混色(色.草莓糖, 色.莓暗, 0.58)));
  笔.fillStyle = 体;
  笔.fill();

  笔.save();
  胶囊();
  笔.clip();
  // 顶部糖衣反光带
  const 反光 = 笔.createLinearGradient(0, 身上 + 1, 0, 身上 + 身高 * 0.42);
  反光.addColorStop(0, "rgba(255,238,232,0.2)");
  反光.addColorStop(1, "rgba(255,238,232,0)");
  笔.fillStyle = 反光;
  笔.fillRect(身左, 身上, 身宽, 身高 * 0.5);
  // 顶上一条宽糖衣亮带：横贯糖身，比椭圆镜面更像包装玻璃纸。
  const 亮带 = 笔.createLinearGradient(0, 身上 + 2, 0, 身上 + 身高 * 0.42);
  亮带.addColorStop(0, "rgba(255,244,238,0.34)");
  亮带.addColorStop(0.5, "rgba(255,244,238,0.1)");
  亮带.addColorStop(1, "rgba(255,244,238,0)");
  笔.fillStyle = 亮带;
  笔.fillRect(身左 + 身高 * 0.4, 身上 + 2, 身宽 - 身高 * 0.8, 身高 * 0.42);
  // 底部内阴影
  const 底影 = 笔.createLinearGradient(0, 身上 + 身高 * 0.6, 0, 身上 + 身高);
  底影.addColorStop(0, "rgba(84,12,28,0)");
  底影.addColorStop(1, "rgba(84,12,28,0.24)");
  笔.fillStyle = 底影;
  笔.fillRect(身左, 身上, 身宽, 身高);
  // 两端被糖纸收紧的褶影
  for (const 向 of [-1, 1] as const) {
    const x = 向 < 0 ? 身左 + 3 : 身右 - 3;
    const 褶影 = 笔.createLinearGradient(x, 0, x + 向 * 14, 0);
    褶影.addColorStop(0, "rgba(84,12,28,0.3)");
    褶影.addColorStop(1, "rgba(84,12,28,0)");
    笔.fillStyle = 褶影;
    笔.fillRect(向 < 0 ? 身左 : 身右 - 14, 身上, 14, 身高);
  }
  笔.restore();

  胶囊();
  笔.strokeStyle = 串(色.莓暗, 0.85);
  笔.lineWidth = 1.6;
  笔.stroke();
  // 糖纸内沿的奶油裱线：糖身四周一圈浅唇，读作包住糖的糖纸边。
  笔.beginPath();
  笔.roundRect(身左 + 1.8, 身上 + 1.8, 身宽 - 3.6, 身高 - 3.6, (身高 - 3.6) / 2);
  笔.strokeStyle = 串(色.象牙, 0.55);
  笔.lineWidth = 1.8;
  笔.stroke();

  // ④ 金箍压住糖身与糖纸的接缝。
  画金箍(笔, 身左 + 2, 中心Y, 身高);
  画金箍(笔, 身右 - 2, 中心Y, 身高);

  // ⑤ 闪星
  画闪星(笔, 中心X - 身宽 / 2 + 22, 中心Y, 4.2);
  画闪星(笔, 中心X + 身宽 / 2 - 22, 中心Y, 4.2);
}

/** 糖绳：一条横贯全屏的粉白斜纹糖带，两端出画。 */
function 画糖绳(笔: CanvasRenderingContext2D, 左: number, 右: number, y: number): void {
  const 粗 = 14;
  const 上 = y - 粗 / 2;
  const 圆 = 粗 / 2;
  const 条 = () => {
    笔.beginPath();
    笔.roundRect(左, 上, 右 - 左, 粗, 圆);
  };
  笔.save();
  笔.shadowColor = "rgba(0,0,0,0.45)";
  笔.shadowBlur = 6;
  笔.shadowOffsetY = 3;
  条();
  笔.fillStyle = 串(混色(色.草莓深, 色.莓, 0.35));
  笔.fill();
  笔.restore();

  条();
  笔.fillStyle = 串(色.莓暗);
  笔.fill();

  笔.save();
  笔.beginPath();
  笔.roundRect(左, 上 + 1, 右 - 左, 粗 - 2, 圆);
  笔.clip();
  笔.fillStyle = 串(色.草莓);
  笔.fillRect(左, 上, 右 - 左, 粗);
  for (let s = 左 - 粗; s < 右 + 粗; s += 22) {
    笔.beginPath();
    笔.moveTo(s, 上);
    笔.lineTo(s + 9.5, 上);
    笔.lineTo(s + 9.5 - 粗, 上 + 粗);
    笔.lineTo(s - 粗, 上 + 粗);
    笔.closePath();
    笔.fillStyle = 串(混色(色.草莓浅, 色.粉, 0.4), 0.5);
    笔.fill();
  }
  笔.fillStyle = "rgba(255,244,240,0.24)";
  笔.fillRect(左, 上 + 0.8, 右 - 左, 2.2);
  笔.fillStyle = "rgba(88,18,34,0.3)";
  笔.fillRect(左, 上 + 粗 - 4, 右 - 左, 3);
  笔.restore();

  条();
  笔.strokeStyle = 串(色.草莓深, 0.85);
  笔.lineWidth = 1.2;
  笔.stroke();
}

/** 蝴蝶结：两只绸环 + 结心 + 两条短飘带，压在糖绳正中。 */
function 画蝴蝶结(笔: CanvasRenderingContext2D, 中心X: number, 中心Y: number, 宽: number, 高: number): void {
  const 环宽 = 宽 / 2;
  const 环高 = 高;
  const 环渐 = () => {
    const 渐 = 笔.createLinearGradient(0, -环高 * 0.8, 0, 环高 * 0.45);
    渐.addColorStop(0, 串(混色(色.草莓, 色.草莓浅, 0.5)));
    渐.addColorStop(0.5, 串(色.草莓));
    渐.addColorStop(1, 串(混色(色.草莓深, 色.莓, 0.26)));
    return 渐;
  };
  // ① 两条飘带先落在糖绳上。
  for (const 向 of [-1, 1] as const) {
    笔.save();
    笔.translate(中心X, 中心Y);
    笔.scale(向, 1);
    笔.beginPath();
    笔.moveTo(2.5, 1.5);
    笔.quadraticCurveTo(环宽 * 0.34, 环高 * 0.24, 环宽 * 0.5, 环高 * 0.62);
    笔.lineTo(环宽 * 0.38, 环高 * 0.66);
    笔.lineTo(环宽 * 0.3, 环高 * 0.56);
    笔.lineTo(环宽 * 0.06, 环高 * 0.2);
    笔.closePath();
    笔.fillStyle = 环渐();
    笔.fill();
    笔.strokeStyle = 串(色.莓暗, 0.55);
    笔.lineWidth = 1;
    笔.stroke();
    笔.restore();
  }
  // ② 两只绸环：外缘起拱、内侧收在结心，环内压一道折痕。
  for (const 向 of [-1, 1] as const) {
    笔.save();
    笔.translate(中心X, 中心Y);
    笔.scale(向, 1);
    笔.beginPath();
    笔.moveTo(0.5, 1);
    笔.bezierCurveTo(环宽 * 0.3, -环高 * 0.74, 环宽 * 0.88, -环高 * 0.82, 环宽, -环高 * 0.34);
    笔.bezierCurveTo(环宽 * 1.03, 环高 * 0.06, 环宽 * 0.6, 环高 * 0.44, 环宽 * 0.3, 环高 * 0.3);
    笔.bezierCurveTo(环宽 * 0.12, 环高 * 0.23, 0.5, 环高 * 0.12, 0.5, 1);
    笔.closePath();
    笔.fillStyle = 环渐();
    笔.fill();
    笔.strokeStyle = 串(色.莓暗, 0.6);
    笔.lineWidth = 1.2;
    笔.stroke();
    笔.beginPath();
    笔.moveTo(环宽 * 0.16, -环高 * 0.02);
    笔.quadraticCurveTo(环宽 * 0.56, -环高 * 0.16, 环宽 * 0.86, 环高 * 0.02);
    笔.strokeStyle = 串(色.草莓深, 0.34);
    笔.lineWidth = 1;
    笔.stroke();
    笔.beginPath();
    笔.moveTo(环宽 * 0.34, -环高 * 0.4);
    笔.quadraticCurveTo(环宽 * 0.64, -环高 * 0.66, 环宽 * 0.86, -环高 * 0.4);
    笔.strokeStyle = "rgba(255,242,244,0.62)";
    笔.lineWidth = 2;
    笔.stroke();
    // 环端折角：一块暗楔读作绸带折进去的那一面。
    笔.beginPath();
    笔.moveTo(环宽 * 0.86, -环高 * 0.4);
    笔.lineTo(环宽 * 1.0, -环高 * 0.28);
    笔.lineTo(环宽 * 0.9, -环高 * 0.1);
    笔.closePath();
    笔.fillStyle = 串(色.草莓深, 0.5);
    笔.fill();
    笔.restore();
  }
  // ③ 结心
  笔.beginPath();
  笔.roundRect(中心X - 6, 中心Y - 6, 12, 12, 3.4);
  const 结 = 笔.createLinearGradient(中心X - 6, 中心Y - 6, 中心X + 6, 中心Y + 6);
  结.addColorStop(0, 串(混色(色.草莓, 色.草莓浅, 0.46)));
  结.addColorStop(0.6, 串(混色(色.草莓, 色.草莓深, 0.24)));
  结.addColorStop(1, 串(混色(色.草莓深, 色.莓, 0.2)));
  笔.fillStyle = 结;
  笔.fill();
  笔.strokeStyle = 串(色.莓暗, 0.55);
  笔.lineWidth = 1;
  笔.stroke();
  笔.beginPath();
  笔.roundRect(中心X - 4.2, 中心Y - 4.6, 3.2, 6.4, 1.6);
  笔.fillStyle = "rgba(255,248,244,0.55)";
  笔.fill();
}

export function 画糖果顶栏(笔: CanvasRenderingContext2D, 布局: 对局布局数据): void {
  // ① 标题糖：糖身中心比标题文字低 4px，让 20 号字压在糖的正中偏上。
  画标题糖(笔, 布局.标题.中心X, 布局.标题.中心Y + 4, Math.min(150, 布局.视口宽 - 200), 44);

  // ② 三块名牌：侧牌先画，主牌压在中间。
  const 位 = 计算糖果牌位(布局);
  画名牌(笔, 位.左, false);
  画名牌(笔, 位.右, false);
  画名牌(笔, 位.主, true);

  // ③ 糖绳与蝴蝶结：只在与棋盘外框之间还留得下空档时画（与矢量版同一判据）。
  const 牌底 = 位.主.上 + 位.主.高;
  const 框顶 = 布局.棋盘.上 - 16;
  const 绳Y = Math.min(牌底 + 15, 框顶 - 8);
  if (绳Y - 牌底 >= 8) {
    画糖绳(笔, -8, 布局.视口宽 + 8, 绳Y);
    画蝴蝶结(笔, 布局.视口宽 / 2, 绳Y - 2, 72, 27);
  }
}
