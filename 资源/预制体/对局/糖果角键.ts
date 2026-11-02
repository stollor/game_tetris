import type { 图形对象, 矩形 } from "../../../.gamemaker/依赖/框架/界面/绘制/协议";
import { 亮色, 暗色, 混色 } from "../../../.gamemaker/依赖/框架/界面/颜色工具";
import { 糖果规范 } from "../../主题/糖果/糖果规范";
import { 取烘焙画布, 扇贝路径, 贴烘焙画布 } from "../基础/装饰与蒙层/糖果画布";

/**
 * 糖果角键（暂停/继续/离开）：花边小饼干 + 可可色动作图标。
 *
 * 饼干与图标同画在一张离屏画布上再贴回界面：图形协议的位图会盖住同层的矢量图标，
 * 把图标一起烘进去，层级就不再取决于调用顺序。缓存键带图标名，暂停/继续各烘一张。
 * 用 canvas 的原因：径向渐变、模糊柔影与奶油亮边是图形协议没有的。
 */

const 色 = 糖果规范.色;

type 角键图标 = "离开" | "暂停" | "继续";

function 串(值: number, 透明 = 1): string {
  const r = (值 >> 16) & 0xff;
  const g = (值 >> 8) & 0xff;
  const b = 值 & 0xff;
  return `rgba(${r}, ${g}, ${b}, ${透明})`;
}

/** 动作图标（画布版，坐标以键中心为基准，与矢量版 `绘制角键图标` 同一套尺寸）。 */
function 画角键图标(笔: CanvasRenderingContext2D, 图标: 角键图标, x: number, y: number): void {
  const 深 = 串(色.可可深, 0.96);
  笔.save();
  笔.translate(x, y);
  笔.scale(0.92, 0.92);
  笔.shadowColor = 串(色.巧克力深, 0.35);
  笔.shadowBlur = 2;
  笔.shadowOffsetY = 1;
  笔.fillStyle = 深;
  if (图标 === "暂停") {
    笔.fillRect(-7, -8, 4, 16);
    笔.fillRect(3, -8, 4, 16);
  } else if (图标 === "继续") {
    笔.beginPath();
    笔.moveTo(-5, -9);
    笔.lineTo(-5, 9);
    笔.lineTo(8, 0);
    笔.closePath();
    笔.fill();
  } else {
    笔.lineWidth = 1.9;
    笔.strokeStyle = 深;
    笔.beginPath();
    笔.moveTo(2, -9);
    笔.lineTo(9, -9);
    笔.lineTo(9, 9);
    笔.lineTo(2, 9);
    笔.stroke();
    笔.fillRect(-8, -1, 13, 2);
    笔.beginPath();
    笔.moveTo(-12, 0);
    笔.lineTo(-5, -6);
    笔.lineTo(-5, 6);
    笔.closePath();
    笔.fill();
  }
  笔.restore();
  // 左缘一道奶油反光：图标像压在饼干里，不是浮在上面
  笔.save();
  笔.strokeStyle = 串(亮色(色.饼干浅, 0.5), 0.4);
  笔.lineWidth = 0.8;
  if (图标 === "暂停") {
    笔.beginPath();
    笔.moveTo(-6.4, -6.4);
    笔.lineTo(-6.4, 6.4);
    笔.moveTo(3.6, -6.4);
    笔.lineTo(3.6, 6.4);
    笔.stroke();
  }
  笔.restore();
}

function 烘焙角键(宽: number, 高: number, 图标: 角键图标): HTMLCanvasElement {
  return 取烘焙画布(`糖果角键-饼干|${图标}`, 宽, 高, (笔, 倍率) => {
    const cx = 宽 / 2;
    const cy = 高 / 2;
    const 纵半径 = 高 / 2 - 1.6;
    const 横半径 = Math.min(宽 / 2 - 1.6, 纵半径 * 1.06);
    const 瓣半径 = Math.max(2.2, 纵半径 * 0.17);
    // ① 柔和落影：饼干压在画布上，用 blur 阴影而不是叠矩形。
    笔.save();
    扇贝路径(笔, cx - 横半径, cy - 纵半径, 横半径 * 2, 纵半径 * 2, 瓣半径);
    笔.shadowColor = 串(色.巧克力深, 0.5);
    笔.shadowBlur = 3.5 * 倍率;
    笔.shadowOffsetY = 2.2 * 倍率;
    笔.fillStyle = 串(色.饼干深, 0.95);
    笔.fill();
    笔.restore();

    // ② 花边饼干轮廓：沿扇贝路径裁切，内部全部画在这块形状里。
    笔.save();
    扇贝路径(笔, cx - 横半径, cy - 纵半径, 横半径 * 2, 纵半径 * 2, 瓣半径);
    笔.clip();
    const 受光 = 笔.createRadialGradient(
      cx - 横半径 * 0.42,
      cy - 纵半径 * 0.55,
      0,
      cx,
      cy,
      横半径 * 1.3,
    );
    受光.addColorStop(0, 串(亮色(色.饼干浅, 0.4), 1));
    受光.addColorStop(0.38, 串(混色(色.饼干浅, 色.饼干, 0.22), 1));
    受光.addColorStop(0.84, 串(混色(色.饼干, 色.饼干深, 0.28), 1));
    受光.addColorStop(1, 串(暗色(色.饼干, 0.12), 1));
    笔.fillStyle = 受光;
    笔.fillRect(0, 0, 宽, 高);
    // 外缘压深一圈，读作饼干的焦边
    笔.strokeStyle = 串(色.饼干焦, 0.7);
    笔.lineWidth = Math.max(1.1, 纵半径 * 0.1);
    笔.beginPath();
    笔.ellipse(cx, cy, 横半径 - 0.7, 纵半径 - 0.7, 0, 0, Math.PI * 2);
    笔.stroke();
    // 内圈模压台阶：上亮下暗
    笔.lineWidth = Math.max(1.1, 纵半径 * 0.075);
    笔.strokeStyle = 串(亮色(色.饼干浅, 0.35), 0.5);
    笔.beginPath();
    笔.ellipse(cx, cy - 1, 横半径 * 0.66, 纵半径 * 0.62, 0, 0, Math.PI * 2);
    笔.stroke();
    笔.strokeStyle = 串(色.饼干焦, 0.35);
    笔.beginPath();
    笔.ellipse(cx, cy + 1, 横半径 * 0.66, 纵半径 * 0.62, 0, 0, Math.PI * 2);
    笔.stroke();
    // 碎屑：几粒焦糖点 + 贴着它们的白点
    const 碎屑 = [
      [0.42, 0.3],
      [0.66, 0.36],
      [0.32, 0.62],
      [0.7, 0.7],
      [0.52, 0.82],
      [0.3, 0.44],
    ] as const;
    for (const [列比, 行比] of 碎屑) {
      const x = cx + (列比 - 0.5) * 横半径 * 1.5;
      const y = cy + (行比 - 0.5) * 纵半径 * 1.6;
      笔.beginPath();
      笔.ellipse(x, y, 1, 0.85, 0, 0, Math.PI * 2);
      笔.fillStyle = 串(色.饼干焦, 0.5);
      笔.fill();
      笔.beginPath();
      笔.ellipse(x - 0.2, y + 0.8, 0.7, 0.45, 0, 0, Math.PI * 2);
      笔.fillStyle = 串(亮色(色.饼干浅, 0.5), 0.55);
      笔.fill();
    }
    // 左上柔光 + 顶棱高光
    const 高光 = 笔.createRadialGradient(
      cx - 横半径 * 0.42,
      cy - 纵半径 * 0.58,
      0,
      cx - 横半径 * 0.42,
      cy - 纵半径 * 0.58,
      横半径 * 0.85,
    );
    高光.addColorStop(0, "rgba(255,246,228,0.6)");
    高光.addColorStop(1, "rgba(255,246,228,0)");
    笔.fillStyle = 高光;
    笔.fillRect(0, 0, 宽, 高);
    笔.restore();

    // ③ 奶油亮边：沿扇贝外沿一圈亮线，饼干才从深底上「翻」出来
    笔.save();
    扇贝路径(笔, cx - 横半径 - 0.3, cy - 纵半径 - 0.3, 横半径 * 2 + 0.6, 纵半径 * 2 + 0.6, 瓣半径);
    笔.strokeStyle = 串(亮色(色.饼干浅, 0.55), 0.7);
    笔.lineWidth = 1.2;
    笔.stroke();
    笔.restore();

    // ④ 动作图标
    画角键图标(笔, 图标, cx, cy - 1);
  });
}

export function 绘制糖果角键(绘图: 图形对象, 区域: 矩形, 图标: 角键图标): void {
  绘图.save();
  const 饼 = 烘焙角键(区域.宽, 区域.高, 图标);
  贴烘焙画布(绘图, 饼, 区域.左, 区域.上, 区域.宽, 区域.高);
  绘图.restore();
}
