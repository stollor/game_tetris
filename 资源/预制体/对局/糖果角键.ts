import type { 图形对象, 矩形 } from "../../../.gamemaker/依赖/框架/界面/绘制/协议";
import { 扁平外观 } from "../../主题/糖果/扁平外观";
import { 串, 画块, 画暂停继续, 花边椭圆路径 } from "../基础/装饰与蒙层/扁平笔法";
import { 取烘焙画布, 贴烘焙画布 } from "../基础/装饰与蒙层/糖果画布";

/**
 * 糖果角键（暂停/继续/离开）：奶油花边饼干 + 巧克力动作图标。
 *
 * 扁平版：饼干只有一个纯色面、下移一档的暗侧边与大而柔的落影，
 * 没有径向高光、碎屑与内圈模压；图标是圆头粗笔画，不带描边阴影。
 * 饼干与图标同画在一张离屏画布上再贴回界面：图形协议的位图会盖住同层的矢量图标，
 * 把图标一起烘进去，层级就不再取决于调用顺序。缓存键带图标名，暂停/继续/离开各烘一张。
 */

const 色 = 扁平外观.色;

type 角键图标 = "离开" | "暂停" | "继续";

/** 花边饼干轮廓：平滑云边椭圆，瓣数与瓣深由共享笔法定。 */
function 饼干路径(
  笔: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  横半径: number,
  纵半径: number,
): void {
  花边椭圆路径(笔, cx, cy, 横半径, 纵半径, 12);
}

/** 动作图标（画布版，坐标以键中心为基准，与矢量版 `绘制角键图标` 同一套尺寸）。 */
function 画角键图标(
  笔: CanvasRenderingContext2D,
  图标: 角键图标,
  x: number,
  y: number,
  尺寸: number,
): void {
  if (图标 === "离开") {
    笔.save();
    笔.strokeStyle = 串(色.图标巧克力);
    笔.lineWidth = 2.2;
    笔.lineCap = "round";
    笔.lineJoin = "round";
    笔.beginPath();
    笔.moveTo(2, -9);
    笔.lineTo(9, -9);
    笔.lineTo(9, 9);
    笔.lineTo(2, 9);
    笔.stroke();
    笔.beginPath();
    笔.moveTo(-7.6, 0);
    笔.lineTo(0.6, 0);
    笔.stroke();
    笔.beginPath();
    笔.moveTo(-3.8, -3.6);
    笔.lineTo(-7.6, 0);
    笔.lineTo(-3.8, 3.6);
    笔.stroke();
    笔.restore();
    return;
  }
  // 共享笔法的图标笔画假定当前路径是空的：先开一条新路径，否则会把饼干的轮廓一起填成巧克力色
  笔.beginPath();
  画暂停继续(笔, x, y, 尺寸, 图标, 色.图标巧克力);
}

function 烘焙角键(宽: number, 高: number, 图标: 角键图标): HTMLCanvasElement {
  return 取烘焙画布(`糖果角键-扁平|${图标}`, 宽, 高, (笔) => {
    const cx = 宽 / 2;
    const cy = 高 / 2 - 1;
    const 纵半径 = 高 / 2 - 2.6;
    const 横半径 = Math.min(宽 / 2 - 2.6, 纵半径 * 1.08);
    // ① 花边饼干：柔影 + 下移一档的暗饼干边 + 纯色面
    画块(笔, 色.饼干, 色.饼干深, () => 饼干路径(笔, cx, cy, 横半径, 纵半径), {
      侧厚: 3,
      影透明: 0.44,
    });
    // ② 图标：巧克力圆头粗笔画，直接压在饼干面上
    画角键图标(笔, 图标, cx, cy - 0.6, 纵半径 * 0.94);
  });
}

export function 绘制糖果角键(绘图: 图形对象, 区域: 矩形, 图标: 角键图标): void {
  绘图.save();
  const 饼 = 烘焙角键(区域.宽, 区域.高, 图标);
  贴烘焙画布(绘图, 饼, 区域.左, 区域.上, 区域.宽, 区域.高);
  绘图.restore();
}
