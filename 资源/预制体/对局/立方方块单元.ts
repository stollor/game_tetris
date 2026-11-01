import type { 图形对象, 点 } from "../../../.gamemaker/依赖/框架/界面/绘制/协议";
import { 亮色, 暗色 } from "../../../.gamemaker/依赖/框架/界面/颜色工具";

/**
 * 立体晶格的二维方块：一个格子画成「正面 + 顶面 + 右侧面」的立方体。
 *
 * 对局井内是真正的透视 3D（`资源/视效/透视`）；商店陈列、暂存槽、下一个、主题卡这些
 * 二维界面只能发绘制指令，就用这一份立方画法把「立体」带到所有二维场合——
 * 否则同一个主题在一处是 3D、另一处是平涂色块，主题就认不出来了。
 *
 * 立方恰好填满所在的格子方框，多格方块并排时不互相遮挡，画法也就不依赖绘制顺序。
 * 光从左上方来：顶面最亮、正面本色、右侧面最暗，正面右下压一条暗带做厚度。
 */

/** 立方的分面配色：按本体色派生顶面/侧面/轮廓三层。 */
export interface 立方面色 {
  顶: number;
  正: number;
  侧: number;
  棱: number;
  暗带: number;
}

export function 读取立方面色(色值: number): 立方面色 {
  return {
    顶: 亮色(色值, 0.34),
    正: 色值,
    侧: 暗色(色值, 0.4),
    棱: 暗色(色值, 0.62),
    暗带: 暗色(色值, 0.52),
  };
}

/** 立方在格子方框里的几何：进深 d 同时给出顶面与右侧面的斜边。 */
export function 计算立方几何(x: number, y: number, 格子: number) {
  const 进深 = Math.max(1, Math.round(格子 * (格子 < 10 ? 0.3 : 0.22)));
  const 面 = Math.max(2, 格子 - 进深);
  const 顶面: readonly 点[] = [
    { x: x + 进深, y },
    { x: x + 格子, y },
    { x: x + 格子 - 进深, y: y + 进深 },
    { x, y: y + 进深 },
  ];
  const 右侧面: readonly 点[] = [
    { x: x + 格子, y },
    { x: x + 格子, y: y + 格子 - 进深 },
    { x: x + 格子 - 进深, y: y + 格子 },
    { x: x + 格子 - 进深, y: y + 进深 },
  ];
  return {
    左: x,
    上: y,
    格子,
    进深,
    面,
    顶面,
    正面: { 左: x, 上: y + 进深, 宽: 面, 高: 面 },
    右侧面,
  };
}

/** 画一个立方方块单元（左上角定位，落在格子方框内）。 */
export function 绘制立方单元(
  绘图: 图形对象,
  x: number,
  y: number,
  格子: number,
  色值: number,
  透明度 = 1,
): void {
  if (!(格子 > 0) || 透明度 <= 0) return;
  const 几何 = 计算立方几何(x, y, 格子);
  const 色 = 读取立方面色(色值);
  const { 进深, 面 } = 几何;

  // 右侧面与顶面先铺，正面最后压上：接缝处不会露出 1px 底。
  绘图.fillStyle(色.侧, 透明度).fillPoints(几何.右侧面, true);
  绘图.fillStyle(色.顶, 透明度).fillPoints(几何.顶面, true);
  绘图.fillStyle(色.正, 透明度).fillRect(几何.正面.左, 几何.正面.上, 面, 面);

  // 正面右下压暗、左上受光：一条斜向体积暗示，不做渐变也成立。
  const 暗带高 = Math.max(1, 面 * 0.16);
  绘图.fillStyle(色.暗带, 0.5 * 透明度).fillRect(x, y + 格子 - 暗带高, 面, 暗带高);
  绘图
    .fillStyle(0xffffff, 0.14 * 透明度)
    .fillRect(x, y + 进深, Math.max(1, 面 * 0.42), Math.max(1, 面 * 0.1));

  // 顶面反光带：让顶面读成受光面，而不是另一块平涂色。
  if (面 >= 8) {
    const 顶高 = Math.max(1, 进深 * 0.55);
    绘图.fillStyle(0xffffff, 0.22 * 透明度).fillPoints(
      [
        { x: x + 进深 + 面 * 0.18, y: y + Math.max(1, 进深 * 0.28) },
        { x: x + 格子 - 面 * 0.14, y: y + Math.max(1, 进深 * 0.28) },
        { x: x + 格子 - 进深 - 面 * 0.3, y: y + 顶高 },
        { x: x + Math.max(1, 面 * 0.1), y: y + 顶高 },
      ],
      true,
    );
  }

  // 外轮廓六边形 + 正面两条棱：边线统一压暗，立方才不会糊成一团。
  绘图.lineStyle(1, 色.棱, 0.9 * 透明度);
  绘图.beginPath();
  绘图.moveTo(x + 进深, y);
  绘图.lineTo(x + 格子, y);
  绘图.lineTo(x + 格子, y + 格子 - 进深);
  绘图.lineTo(x + 格子 - 进深, y + 格子);
  绘图.lineTo(x, y + 格子);
  绘图.lineTo(x, y + 进深);
  绘图.closePath();
  绘图.strokePath();
  if (面 >= 6) {
    绘图.lineStyle(1, 色.棱, 0.5 * 透明度);
    绘图.lineBetween(x, y + 进深, x + 进深, y);
    绘图.lineBetween(x + 格子 - 进深, y + 进深, x + 格子, y);
  }
}

/** 立方辉光：格子外圈几层柔光。用椭圆叠，方形光晕在暗室里会露成一块块方板。 */
export function 绘制立方辉光(
  绘图: 图形对象,
  x: number,
  y: number,
  格子: number,
  色值: number,
  强度 = 1,
): void {
  if (!(格子 > 0) || 强度 <= 0) return;
  const 光 = 亮色(色值, 0.2);
  const 中心X = x + 格子 / 2;
  const 中心Y = y + 格子 / 2;
  for (let 层 = 0; 层 < 3; 层 += 1) {
    const 扩 = 格子 * (0.55 + 层 * 0.42);
    绘图.fillStyle(光, (0.14 - 层 * 0.04) * 强度).fillEllipse(中心X, 中心Y, 扩, 扩 * 0.92);
  }
}
