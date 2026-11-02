import { 亮色, 暗色, 混色 } from "../../../../.gamemaker/依赖/框架/界面/颜色工具";
import type { 对局布局数据 } from "../../../../代码/页面/布局/对局布局";
import { 糖果规范 } from "../../../主题/糖果/糖果规范";
import { 串 } from "./工具";

/**
 * 底板·侧栏：暂存位与队列位的纸杯、两枚标签牌、底部奖章盘。
 *
 * 纸杯按「纸杯蛋糕杯」造型画：上口一圈外翻的褶边（折痕从口沿一路延续到杯底）、
 * 杯壁竖棱用亮棱夹暗沟表现折纸节奏、杯底一圈扇贝裙边、内井深巧克力并带上沿内阴影。
 * 文字与方块不在这里画：文字走文字服务，方块/预览走矢量动态层。
 */

const 色 = 糖果规范.色;

/** 把值夹在区间内。 */
function 夹(值: number, 低: number, 高: number): number {
  return Math.max(低, Math.min(高, 值));
}

/** 一只纸杯的比例尺：褶边高、裙边高、侧壁厚、折痕数、口沿外扩、底圆角。 */
interface 杯尺 {
  褶高: number;
  底高: number;
  侧内: number;
  褶数: number;
  峰: number;
  上外: number;
  底内: number;
  瓣数: number;
  瓣步: number;
}

function 量杯(宽: number, 高: number): 杯尺 {
  const 底内 = 宽 * 0.06;
  const 瓣数 = Math.max(5, Math.round(宽 / 12.5));
  return {
    褶高: 夹(高 * 0.32, 12, 30),
    底高: 夹(高 * 0.135, 10, 15),
    侧内: Math.max(6, 宽 * 0.075),
    褶数: Math.max(5, Math.round(宽 / 13)),
    峰: 夹(宽 * 0.05, 3, 5),
    上外: 夹(宽 * 0.022, 1.5, 2.5),
    底内,
    瓣数,
    瓣步: (宽 - 底内 * 2) / 瓣数,
  };
}

/** 杯壁外轮廓：上口外翻的扇贝褶、两侧内凹微收、下底一排扇贝裙边。 */
function 杯壁路径(左: number, 上: number, 宽: number, 高: number, 尺: 杯尺): Path2D {
  const 顶左 = 左 - 尺.上外;
  const 顶宽 = 宽 + 尺.上外 * 2;
  const 瓣R = 尺.瓣步 / 2;
  const 瓣心Y = 上 + 高 - 1.2;
  const 路径 = new Path2D();
  路径.moveTo(左 + 尺.底内, 瓣心Y);
  路径.quadraticCurveTo(左 + 尺.底内 * 0.95, 上 + 高 * 0.56, 左 + 尺.底内 * 0.3, 上 + 高 * 0.26);
  路径.quadraticCurveTo(左 - 尺.上外 * 0.5, 上 + 高 * 0.11, 顶左, 上 + 3);
  for (let 序 = 0; 序 < 尺.褶数; 序 += 1) {
    const 中 = (序 + 0.5) / 尺.褶数;
    const 高倍 = 1 + 0.08 * Math.abs(中 - 0.5) * 2;
    路径.quadraticCurveTo(
      顶左 + 顶宽 * 中,
      上 + 3 - 尺.峰 * 2 * 高倍,
      顶左 + 顶宽 * ((序 + 1) / 尺.褶数),
      上 + 3,
    );
  }
  路径.quadraticCurveTo(
    左 + 宽 + 尺.上外 * 0.5,
    上 + 高 * 0.11,
    左 + 宽 - 尺.底内 * 0.3,
    上 + 高 * 0.26,
  );
  路径.quadraticCurveTo(左 + 宽 - 尺.底内 * 0.95, 上 + 高 * 0.56, 左 + 宽 - 尺.底内, 瓣心Y);
  for (let 序 = 尺.瓣数 - 1; 序 >= 0; 序 -= 1) {
    const 瓣心X = 左 + 尺.底内 + 尺.瓣步 * (序 + 0.5);
    路径.quadraticCurveTo(瓣心X, 瓣心Y + 3.2, 瓣心X - 瓣R, 瓣心Y);
  }
  路径.closePath();
  return 路径;
}

/** 一条从杯口贯到杯底的折痕带：口沿按比例 f 定位，向杯底收窄时同步内移。 */
function 折痕带(
  左: number,
  上: number,
  宽: number,
  高: number,
  尺: 杯尺,
  f: number,
  半宽: number,
): Path2D {
  const 顶X = 左 - 尺.上外 + (宽 + 尺.上外 * 2) * f;
  const 底X = 左 + 尺.底内 + (宽 - 尺.底内 * 2) * f;
  const 路径 = new Path2D();
  路径.moveTo(顶X - 半宽, 上 - 8);
  路径.lineTo(顶X + 半宽, 上 - 8);
  路径.lineTo(底X + 半宽, 上 + 高 + 8);
  路径.lineTo(底X - 半宽, 上 + 高 + 8);
  路径.closePath();
  return 路径;
}

/** 纸杯：玫瑰杯壁 + 竖向 fluted 棱 + 扇贝杯口/杯底 + 深巧克力内井。 */
export function 画纸杯(
  笔: CanvasRenderingContext2D,
  左: number,
  上: number,
  宽: number,
  高: number,
  圆角: number,
): void {
  const 尺 = 量杯(宽, 高);
  const 体 = 杯壁路径(左, 上, 宽, 高, 尺);
  const 棱宽 = (宽 + 尺.上外 * 2) / 尺.褶数;

  // ① 落影：整只杯压在酒红底上，近实远淡。
  笔.save();
  笔.shadowColor = 串(0x140609, 0.6);
  笔.shadowBlur = 9;
  笔.shadowOffsetY = 5;
  笔.fillStyle = 串(暗色(色.莓, 0.5));
  笔.fill(体);
  笔.restore();

  笔.save();
  笔.clip(体);

  // ② 杯壁底色：左上受光、右下压暗的玫瑰木。
  const 壁面 = 笔.createLinearGradient(左, 上, 左 + 宽, 上 + 高);
  const 壁色 = 混色(色.莓亮, 色.可可, 0.2);
  壁面.addColorStop(0, 串(亮色(壁色, 0.26)));
  壁面.addColorStop(0.4, 串(壁色));
  壁面.addColorStop(1, 串(暗色(混色(色.莓, 色.可可, 0.22), 0.2)));
  笔.fillStyle = 壁面;
  笔.fillRect(左 - 8, 上 - 10, 宽 + 16, 高 + 16);

  // ③ 竖棱：亮棱夹暗沟，明暗随杯身弧度（中间亮、两侧暗）。
  const 棱亮 = 混色(色.莓浅, 色.奶油, 0.3);
  const 棱暗 = 混色(色.莓暗, 色.可可, 0.22);
  for (let 序 = 0; 序 < 尺.褶数; 序 += 1) {
    const 中 = (序 + 0.5) / 尺.褶数;
    const 曲 = Math.cos((中 - 0.5) * Math.PI);
    笔.fillStyle = 串(棱亮, 0.18 + 0.34 * 曲);
    笔.fill(折痕带(左, 上, 宽, 高, 尺, 中, 棱宽 * 0.18));
    笔.fillStyle = 串(棱暗, 0.14 + 0.24 * 曲);
    笔.fill(折痕带(左, 上, 宽, 高, 尺, 序 / 尺.褶数, 棱宽 * 0.14));
  }
  // 左侧一道柔光、右缘一道压暗：纸杯是圆的。
  const 左光 = 笔.createLinearGradient(左, 0, 左 + 宽 * 0.42, 0);
  左光.addColorStop(0, 串(色.白, 0.16));
  左光.addColorStop(1, 串(色.白, 0));
  笔.fillStyle = 左光;
  笔.fillRect(左 - 6, 上 - 8, 宽 * 0.5, 高 + 12);
  const 右影 = 笔.createLinearGradient(左 + 宽 * 0.64, 0, 左 + 宽, 0);
  右影.addColorStop(0, 串(色.莓暗, 0));
  右影.addColorStop(1, 串(色.莓暗, 0.26));
  笔.fillStyle = 右影;
  笔.fillRect(左 + 宽 * 0.6, 上 - 8, 宽 * 0.46, 高 + 12);

  // ④ 上口褶边：外翻的一圈折纸，越靠口沿越亮，往下没入杯壁。
  const 褶亮 = 混色(色.莓浅, 色.奶油, 0.3);
  const 口面 = 笔.createLinearGradient(0, 上 - 8, 0, 上 + 尺.褶高);
  口面.addColorStop(0, 串(亮色(褶亮, 0.3)));
  口面.addColorStop(0.42, 串(褶亮, 0.96));
  口面.addColorStop(0.78, 串(混色(色.莓亮, 色.可可, 0.14), 0.96));
  口面.addColorStop(1, 串(混色(色.莓, 色.可可, 0.2), 0.96));
  笔.fillStyle = 口面;
  笔.fillRect(左 - 8, 上 - 10, 宽 + 16, 尺.褶高 + 12);
  // 折面：从井口向外放射的扇面，左亮右暗，读作一圈折起来的纸。
  const 顶左 = 左 - 尺.上外;
  const 顶宽 = 宽 + 尺.上外 * 2;
  const 底左 = 左 + 尺.侧内;
  const 底宽 = 宽 - 尺.侧内 * 2;
  const 折亮 = 混色(色.莓浅, 色.奶油, 0.34);
  const 折中 = 混色(色.莓亮, 色.可可, 0.14);
  const 折暗 = 暗色(混色(色.莓, 色.可可, 0.2), 0.3);
  for (let 序 = 0; 序 < 尺.褶数; 序 += 1) {
    const 顶x0 = 顶左 + 顶宽 * (序 / 尺.褶数);
    const 顶x1 = 顶左 + 顶宽 * ((序 + 1) / 尺.褶数);
    const 底x0 = 底左 + 底宽 * (序 / 尺.褶数);
    const 底x1 = 底左 + 底宽 * ((序 + 1) / 尺.褶数);
    const 面 = new Path2D();
    面.moveTo(顶x0, 上 - 8);
    面.lineTo(顶x1, 上 - 8);
    面.lineTo(底x1, 上 + 尺.褶高 + 4);
    面.lineTo(底x0, 上 + 尺.褶高 + 4);
    面.closePath();
    const 折 = 笔.createLinearGradient(顶x0, 0, 顶x1, 0);
    折.addColorStop(0, 串(折暗, 0.9));
    折.addColorStop(0.3, 串(折亮, 0.96));
    折.addColorStop(0.58, 串(折中, 0.96));
    折.addColorStop(1, 串(折暗, 0.92));
    笔.fillStyle = 折;
    笔.fill(面);
  }
  // 折面往下压暗，褶边才不是一条条纹带。
  const 折影 = 笔.createLinearGradient(0, 上 + 尺.褶高 * 0.5, 0, 上 + 尺.褶高 + 4);
  折影.addColorStop(0, 串(0x2a1018, 0));
  折影.addColorStop(1, 串(0x2a1018, 0.3));
  笔.fillStyle = 折影;
  笔.fillRect(左 - 8, 上 + 尺.褶高 * 0.5, 宽 + 16, 尺.褶高 * 0.6);
  // 折尖：每道褶的顶端压一点高光，口沿才是一圈纸边。
  for (let 序 = 0; 序 < 尺.褶数; 序 += 1) {
    const 中 = (序 + 0.5) / 尺.褶数;
    const cx = 顶左 + 顶宽 * 中;
    const 高倍 = 1 + 0.28 * Math.abs(中 - 0.5) * 2;
    const cy = 上 + 3 - 尺.峰 * 高倍 * 0.7;
    const 尖 = 笔.createRadialGradient(cx, cy, 0.5, cx, cy, 棱宽 * 0.5);
    尖.addColorStop(0, 串(亮色(折亮, 0.5), 0.9));
    尖.addColorStop(1, 串(折亮, 0));
    笔.fillStyle = 尖;
    笔.beginPath();
    笔.ellipse(cx, cy, 棱宽 * 0.46, 尺.峰 * 0.8, 0, 0, Math.PI * 2);
    笔.fill();
  }
  // 口沿描一条细高光，纸的折边才立得住。
  笔.save();
  笔.shadowColor = 串(亮色(色.莓浅, 0.4), 0.85);
  笔.shadowBlur = 2.5;
  笔.strokeStyle = 串(亮色(色.莓浅, 0.28), 0.6);
  笔.lineWidth = 1.1;
  笔.stroke(体);
  笔.restore();
  笔.restore();

  // ⑤ 内井：深巧克力，上沿被褶边压出内阴影，井底透出内壁的反光。
  const 内上 = 上 + 尺.褶高;
  const 内左 = 左 + 尺.侧内;
  const 内宽 = 宽 - 尺.侧内 * 2;
  const 内高 = 高 - 尺.褶高 - 尺.底高;
  const 井圆 = Math.min(圆角, 内宽 * 0.2);
  const 井褶 = Math.max(5, Math.round(内宽 / 13));
  // 井壁跟着杯壁一起收窄，侧壁厚度才从头到尾一致。
  const 井收 = 宽 * 0.035;
  const 底内左 = 内左 + 井收;
  const 底内右 = 内左 + 内宽 - 井收;
  const 井 = new Path2D();
  井.moveTo(内左, 内上);
  for (let 序 = 0; 序 < 井褶; 序 += 1) {
    井.quadraticCurveTo(
      内左 + (内宽 * (序 + 0.5)) / 井褶,
      内上 + 1.6,
      内左 + (内宽 * (序 + 1)) / 井褶,
      内上,
    );
  }
  井.lineTo(底内右, 内上 + 内高 - 井圆);
  井.quadraticCurveTo(底内右, 内上 + 内高, 底内右 - 井圆, 内上 + 内高);
  井.lineTo(底内左 + 井圆, 内上 + 内高);
  井.quadraticCurveTo(底内左, 内上 + 内高, 底内左, 内上 + 内高 - 井圆);
  井.closePath();
  // 井沿：一道莓暗细边，把内井和杯壁分开。
  笔.save();
  笔.strokeStyle = 串(混色(色.莓暗, 色.莓深, 0.45));
  笔.lineWidth = 1.6;
  笔.stroke(井);
  笔.restore();
  const 井内 = new Path2D();
  井内.addPath(井);
  笔.save();
  笔.clip(井内);
  const 井面 = 笔.createLinearGradient(0, 内上, 0, 内上 + 内高);
  井面.addColorStop(0, 串(混色(0x2a1018, 色.莓暗, 0.4)));
  井面.addColorStop(0.32, 串(混色(色.莓暗, 色.莓深, 0.5)));
  井面.addColorStop(1, 串(混色(色.莓深, 色.巧克力, 0.45)));
  笔.fillStyle = 井面;
  笔.fillRect(内左 - 2, 内上 - 2, 内宽 + 4, 内高 + 4);
  // 内井远壁：杯底内侧那一圈玫瑰扇贝，被光打亮，读作「杯子里还有一圈」。
  const 壁高 = 夹(内高 * 0.13, 5, 11);
  const 壁顶 = 内上 + 内高 - 壁高;
  const 壁数 = Math.max(5, Math.round(内宽 / 12));
  const 壁步 = 内宽 / 壁数;
  const 壁 = new Path2D();
  壁.moveTo(内左, 内上 + 内高);
  壁.lineTo(内左, 壁顶);
  for (let 序 = 0; 序 < 壁数; 序 += 1) {
    壁.quadraticCurveTo(内左 + 壁步 * (序 + 0.5), 壁顶 - 壁步 * 0.4, 内左 + 壁步 * (序 + 1), 壁顶);
  }
  壁.lineTo(内左 + 内宽, 内上 + 内高);
  壁.closePath();
  const 内壁面 = 笔.createLinearGradient(0, 壁顶, 0, 内上 + 内高);
  内壁面.addColorStop(0, 串(混色(色.莓, 色.可可, 0.2), 0.9));
  内壁面.addColorStop(0.55, 串(混色(色.莓亮, 色.可可, 0.16), 0.9));
  内壁面.addColorStop(1, 串(混色(色.莓浅, 色.奶油, 0.25), 0.34));
  笔.fillStyle = 内壁面;
  笔.fill(壁);
  // 内壁上方一圈压暗，井才有深度。
  const 壁影 = 笔.createLinearGradient(0, 壁顶 - 壁高, 0, 壁顶);
  壁影.addColorStop(0, 串(0x1a0910, 0));
  壁影.addColorStop(1, 串(0x1a0910, 0.55));
  笔.fillStyle = 壁影;
  笔.fillRect(内左, 壁顶 - 壁高, 内宽, 壁高);
  // 井口三面内阴影：上沿最重，两侧次之。
  const 顶影 = 笔.createLinearGradient(0, 内上, 0, 内上 + 内高 * 0.5);
  顶影.addColorStop(0, 串(0x1c0a10, 0.45));
  顶影.addColorStop(1, 串(0x1c0a10, 0));
  笔.fillStyle = 顶影;
  笔.fillRect(内左 - 2, 内上 - 2, 内宽 + 4, 内高 * 0.54);
  const 侧影宽 = 内宽 * 0.2;
  for (const [起X, 止X] of [
    [内左, 内左 + 侧影宽],
    [内左 + 内宽, 内左 + 内宽 - 侧影宽],
  ] as const) {
    const 侧影 = 笔.createLinearGradient(起X, 0, 止X, 0);
    侧影.addColorStop(0, 串(0x1c0a10, 0.45));
    侧影.addColorStop(1, 串(0x1c0a10, 0));
    笔.fillStyle = 侧影;
    笔.fillRect(内左, 内上, 内宽, 内高);
  }
  // 井底一点玫瑰反光，井不是纯黑洞。
  const 反光 = 笔.createLinearGradient(0, 内上 + 内高 * 0.66, 0, 内上 + 内高);
  反光.addColorStop(0, 串(色.莓, 0));
  反光.addColorStop(1, 串(色.莓, 0.16));
  笔.fillStyle = 反光;
  笔.fillRect(内左, 内上, 内宽, 内高);
  笔.restore();
  // 井沿口沿一条细高光：井口是一圈被光打亮的边。
  笔.save();
  笔.beginPath();
  笔.moveTo(内左, 内上);
  笔.quadraticCurveTo(内左 + 内宽 * 0.5, 内上 + 3.4, 内左 + 内宽, 内上);
  笔.strokeStyle = 串(混色(色.莓浅, 色.奶油, 0.3), 0.5);
  笔.lineWidth = 1.2;
  笔.stroke();
  笔.restore();

  // ⑥ 杯底裙边：竖棱一直延到底，底边一圈浅扇贝加一条亮唇。
  笔.save();
  笔.clip(体);
  const 底顶 = 上 + 高 - 尺.底高;
  const 折痕 = 笔.createLinearGradient(0, 底顶 - 3, 0, 底顶 + 3);
  折痕.addColorStop(0, 串(暗色(色.莓, 0.42), 0));
  折痕.addColorStop(1, 串(暗色(色.莓, 0.42), 0.6));
  笔.fillStyle = 折痕;
  笔.fillRect(左, 底顶 - 3, 宽, 6);
  const 底面 = 笔.createLinearGradient(0, 底顶, 0, 上 + 高);
  底面.addColorStop(0, 串(混色(色.莓亮, 色.可可, 0.16), 0.98));
  底面.addColorStop(0.45, 串(亮色(混色(色.莓亮, 色.可可, 0.08), 0.1), 0.98));
  底面.addColorStop(1, 串(混色(色.莓浅, 色.奶油, 0.18), 0.96));
  笔.fillStyle = 底面;
  笔.fillRect(左 - 4, 底顶 + 1, 宽 + 8, 尺.底高 + 2);
  // 竖棱的暗沟延伸到裙边：裙边是同一圈折纸的收口。
  for (let 序 = 0; 序 <= 尺.褶数; 序 += 1) {
    const f = 序 / 尺.褶数;
    const cx = 左 + 尺.底内 + (宽 - 尺.底内 * 2) * f;
    笔.fillStyle = 串(棱暗, 0.22);
    笔.fillRect(cx - 0.6, 底顶 + 1, 1.2, 尺.底高 - 0.5);
  }
  // 底唇：沿扇贝底边一条亮线。
  const 唇 = 笔.createLinearGradient(0, 上 + 高 - 3.2, 0, 上 + 高 + 1.2);
  唇.addColorStop(0, 串(褶亮, 0));
  唇.addColorStop(1, 串(褶亮, 0.38));
  笔.fillStyle = 唇;
  笔.fillRect(左 + 尺.底内 * 0.3, 上 + 高 - 3.2, 宽 - 尺.底内 * 0.6, 4.4);
  // 瓣间的浅凹：只在底边压一小段暗弧，扇贝才数得清。
  for (let 序 = 0; 序 < 尺.瓣数; 序 += 1) {
    const cx = 左 + 尺.底内 + 尺.瓣步 * (序 + 0.5);
    笔.strokeStyle = 串(暗色(色.莓, 0.3), 0.22);
    笔.lineWidth = 1.1;
    笔.beginPath();
    笔.arc(cx, 上 + 高 - 1.2, 尺.瓣步 * 0.34, Math.PI * 1.12, Math.PI * 1.88);
    笔.stroke();
  }
  笔.restore();

  // ⑦ 外轮廓：一道莓暗收边，和酒红底分开。
  笔.strokeStyle = 串(暗色(色.莓, 0.42), 0.75);
  笔.lineWidth = 1.1;
  笔.stroke(体);
}

/** 标签牌轮廓：圆角方牌，左右两端各三个扇贝凸起（包糖果纸的糖牌）。 */
function 牌路径(左: number, 上: number, 宽: number, 高: number): Path2D {
  const 凸 = 高 / 5.6;
  const 主左 = 左 + 凸;
  const 主右 = 左 + 宽 - 凸;
  const 路径 = new Path2D();
  路径.moveTo(主左, 上);
  路径.lineTo(主右, 上);
  for (let 序 = 0; 序 < 3; 序 += 1) {
    路径.arc(主右, 上 + 凸 * (序 * 2 + 1), 凸, -Math.PI / 2, Math.PI / 2, false);
  }
  路径.lineTo(主左, 上 + 高);
  for (let 序 = 2; 序 >= 0; 序 -= 1) {
    路径.arc(主左, 上 + 凸 * (序 * 2 + 1), 凸, Math.PI / 2, -Math.PI / 2, true);
  }
  路径.closePath();
  return 路径;
}

/** 标签牌：深莓糖牌 + 莓浅描边 + 两端扇贝，字由矢量层压在正中。 */
export function 画标签牌(
  笔: CanvasRenderingContext2D,
  中心X: number,
  中心Y: number,
  宽: number,
  高: number,
): void {
  const 左 = 中心X - 宽 / 2;
  const 上 = 中心Y - 高 / 2;
  const 牌 = 牌路径(左, 上, 宽, 高);
  // 落影
  笔.save();
  笔.shadowColor = 串(0x140609, 0.55);
  笔.shadowBlur = 4;
  笔.shadowOffsetY = 2.4;
  笔.fillStyle = 串(色.莓暗);
  笔.fill(牌);
  笔.restore();
  // 牌面：上亮下暗的莓糖
  const 面 = 笔.createLinearGradient(0, 上, 0, 上 + 高);
  面.addColorStop(0, 串(混色(色.莓深, 色.莓亮, 0.2)));
  面.addColorStop(0.45, 串(混色(色.莓深, 色.巧克力, 0.18)));
  面.addColorStop(1, 串(暗色(混色(色.莓深, 色.巧克力, 0.18), 0.2)));
  笔.fillStyle = 面;
  笔.fill(牌);
  // 描边：外深内浅，糖牌才有厚度
  笔.strokeStyle = 串(暗色(色.莓, 0.42), 0.9);
  笔.lineWidth = 4;
  笔.stroke(牌);
  笔.strokeStyle = 串(色.莓浅, 0.9);
  笔.lineWidth = 2.4;
  笔.stroke(牌);
  // 顶棱高光
  笔.save();
  笔.clip(牌);
  const 顶光 = 笔.createLinearGradient(0, 上, 0, 上 + 高 * 0.55);
  顶光.addColorStop(0, 串(色.白, 0.18));
  顶光.addColorStop(1, 串(色.白, 0));
  笔.fillStyle = 顶光;
  笔.fillRect(左, 上, 宽, 高 * 0.55);
  笔.restore();
  // 内圈一条亮线：糖牌中间是压出来的。
  笔.strokeStyle = 串(亮色(色.莓浅, 0.2), 0.32);
  笔.lineWidth = 1;
  笔.beginPath();
  笔.roundRect(左 + 高 * 0.22, 上 + 高 * 0.22, 宽 - 高 * 0.44, 高 * 0.56, 高 * 0.16);
  笔.stroke();
}

/** 奖章盘：两条缎带尾 + 扇贝玫瑰圆盘 + 奶油环 + 内部徽章底（奖杯与数值由矢量层压上）。 */
export function 画奖章盘(
  笔: CanvasRenderingContext2D,
  中心X: number,
  中心Y: number,
  半径: number,
): void {
  // ① 缎带尾：从盘后向外下垂，末端 V 口。
  for (const 向 of [-1, 1] as const) {
    const 尾 = new Path2D();
    尾.moveTo(中心X + 向 * 半径 * 0.2, 中心Y + 半径 * 0.16);
    尾.lineTo(中心X + 向 * 半径 * 0.92, 中心Y + 半径 * 0.5);
    尾.lineTo(中心X + 向 * 半径 * 1.02, 中心Y + 半径 * 1.18);
    尾.lineTo(中心X + 向 * 半径 * 0.7, 中心Y + 半径 * 1.02);
    尾.lineTo(中心X + 向 * 半径 * 0.44, 中心Y + 半径 * 1.16);
    尾.closePath();
    笔.save();
    笔.shadowColor = 串(0x140609, 0.5);
    笔.shadowBlur = 5;
    笔.shadowOffsetY = 2;
    const 带 = 笔.createLinearGradient(
      中心X + 向 * 半径 * 0.2,
      中心Y,
      中心X + 向 * 半径,
      中心Y + 半径 * 1.2,
    );
    带.addColorStop(0, 串(亮色(混色(色.莓亮, 色.可可, 0.1), 0.12)));
    带.addColorStop(1, 串(混色(色.莓, 色.可可, 0.1)));
    笔.fillStyle = 带;
    笔.fill(尾);
    笔.restore();
    笔.strokeStyle = 串(暗色(色.莓, 0.2), 0.8);
    笔.lineWidth = 1;
    笔.stroke(尾);
  }
  // ② 扇贝玫瑰盘：一圈圆瓣花边，外缘受光最亮。
  const 瓣数 = 11;
  const 盘 = new Path2D();
  const 段 = 瓣数 * 8;
  for (let 序 = 0; 序 <= 段; 序 += 1) {
    const a = (序 / 段) * Math.PI * 2;
    const r = 半径 * (0.95 + 0.05 * Math.cos(a * 瓣数));
    const x = 中心X + Math.cos(a) * r;
    const y = 中心Y + Math.sin(a) * r;
    if (序 === 0) 盘.moveTo(x, y);
    else 盘.lineTo(x, y);
  }
  盘.closePath();
  笔.save();
  笔.shadowColor = 串(0x140609, 0.55);
  笔.shadowBlur = 7;
  笔.shadowOffsetY = 4;
  const 盘面 = 笔.createRadialGradient(
    中心X - 半径 * 0.32,
    中心Y - 半径 * 0.44,
    半径 * 0.08,
    中心X,
    中心Y,
    半径 * 1.02,
  );
  盘面.addColorStop(0, 串(亮色(色.莓亮, 0.42)));
  盘面.addColorStop(0.5, 串(亮色(色.莓亮, 0.16)));
  盘面.addColorStop(1, 串(混色(色.莓亮, 色.草莓, 0.34)));
  笔.fillStyle = 盘面;
  笔.fill(盘);
  笔.restore();
  笔.strokeStyle = 串(暗色(色.莓, 0.34), 0.85);
  笔.lineWidth = 1.1;
  笔.stroke(盘);
  // ③ 奶油环：贴着徽章底的一圈奶油裱花，顶部受光最亮。
  const 心Y = 中心Y - 半径 * 0.02;
  const 心R = 半径 * 0.66;
  // 徽章外一圈边光：顶部是奶油金，转到两侧沉成莓暗，徽章才有厚度。
  const 环 = 笔.createLinearGradient(0, 心Y - 心R, 0, 心Y + 心R);
  环.addColorStop(0, 串(混色(色.奶油, 色.金, 0.4)));
  环.addColorStop(0.34, 串(混色(色.莓浅, 色.奶油, 0.4)));
  环.addColorStop(0.62, 串(色.莓暗, 0.95));
  环.addColorStop(1, 串(混色(色.莓, 色.莓暗, 0.5), 0.8));
  笔.beginPath();
  笔.arc(中心X, 心Y, 心R + 2, 0, Math.PI * 2);
  笔.strokeStyle = 环;
  笔.lineWidth = 3.6;
  笔.stroke();
  // ④ 内部徽章底：深玫瑰圆井，上沿内阴影、下沿一点反光。
  const 心 = new Path2D();
  心.arc(中心X, 心Y, 心R, 0, Math.PI * 2);
  笔.save();
  笔.clip(心);
  const 心面 = 笔.createLinearGradient(0, 心Y - 心R, 0, 心Y + 心R);
  心面.addColorStop(0, 串(混色(色.巧克力浅, 色.莓, 0.16)));
  心面.addColorStop(0.55, 串(色.巧克力浅));
  心面.addColorStop(1, 串(混色(色.巧克力, 色.巧克力浅, 0.3)));
  笔.fillStyle = 心面;
  笔.fillRect(中心X - 心R, 心Y - 心R, 心R * 2, 心R * 2);
  const 心影 = 笔.createLinearGradient(0, 心Y - 心R, 0, 心Y - 心R * 0.1);
  心影.addColorStop(0, 串(0x1e0b11, 0.5));
  心影.addColorStop(1, 串(0x1e0b11, 0));
  笔.fillStyle = 心影;
  笔.fillRect(中心X - 心R, 心Y - 心R, 心R * 2, 心R * 2);
  const 心光 = 笔.createLinearGradient(0, 心Y + 心R * 0.3, 0, 心Y + 心R);
  心光.addColorStop(0, 串(色.莓, 0));
  心光.addColorStop(1, 串(色.莓, 0.2));
  笔.fillStyle = 心光;
  笔.fillRect(中心X - 心R, 心Y - 心R, 心R * 2, 心R * 2);
  笔.restore();
}

/** 侧栏整块：暂存杯、队列杯、两枚标签牌、底部奖章盘。 */
export function 画糖果侧栏(笔: CanvasRenderingContext2D, 布局: 对局布局数据): void {
  const 栏 = 布局.侧栏;
  if (!栏) return;
  const 暂存 = 栏.暂存;
  const 队列 = 栏.预览栏;
  const 中心X = 暂存.左 + 暂存.宽 / 2;

  // 暂存位：矮杯，杯口宽、杯身收。
  画纸杯(笔, 暂存.左, 暂存.上, 暂存.宽, 暂存.高, 14);
  // 队列位：高杯，和暂存杯同一套造型拉长。
  画纸杯(笔, 暂存.左, 队列.顶, 暂存.宽, 队列.高 + 5, 16);
  // 两枚标签牌压在杯口正中；文字由矢量层按同一中心绘制。
  画标签牌(笔, 中心X, 暂存.上 + 1, 58, 20);
  画标签牌(笔, 中心X, 队列.顶 + 1, 58, 20);
  // 底部奖章盘。
  画奖章盘(笔, 中心X, 栏.最佳纪录.值Y - 3, Math.min(34, 暂存.宽 * 0.37));
}
