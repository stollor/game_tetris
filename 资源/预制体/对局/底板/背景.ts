import { 扁平外观 } from "../../../主题/糖果/扁平外观";
import { 串, 填充, 画块, 铺斜纹 } from "../../基础/装饰与蒙层/扁平笔法";

/**
 * 底板·背景：深酒红纯色 + 一层很淡的糖霜点阵 + 顶部粉扇贝天幕 + 底部斜纹糖带 + 几件扁平糖饰。
 *
 * 扁平规则：面只有一个纯色，立体感只靠「下移一档的暗侧边 + 大而柔的落影」；
 * 旧版的竖渐变、暖光、暗角、拐杖糖与立体松露全部去掉，装饰糖一律读作平面圆点。
 */

const 色 = 扁平外观.色;
const 寸 = 扁平外观.尺寸;

/** 顶部天幕：一排深浅交替的扇贝瓣。每瓣是「一条直边 + 下半个椭圆」，瓣底压在屏幕上沿。 */
function 画天幕(笔: CanvasRenderingContext2D, 宽: number): void {
  const 半宽 = 12.4;
  const 直边 = 3.2;
  const 瓣深 = 8.4;
  const 搭接 = 0.4;
  const 数 = Math.ceil(宽 / (半宽 * 2)) + 1;
  for (let i = 0; i < 数; i += 1) {
    const cx = (i + 0.5) * 半宽 * 2;
    笔.beginPath();
    笔.moveTo(cx - 半宽 - 搭接, 0);
    笔.lineTo(cx + 半宽 + 搭接, 0);
    笔.lineTo(cx + 半宽 + 搭接, 直边);
    笔.ellipse(cx, 直边, 半宽 + 搭接, 瓣深, 0, 0, Math.PI);
    笔.closePath();
    笔.fillStyle = 串(i % 2 === 0 ? 色.幕粉 : 色.幕粉深);
    笔.fill();
  }
}

/** 糖霜点阵：交错排列的浅酒红圆点，只做一层很淡的底纹。整屏铺一遍，一次烘焙。 */
function 画糖霜点阵(笔: CanvasRenderingContext2D, 宽: number, 高: number): void {
  const 距 = 11;
  const 半径 = 1.25;
  笔.fillStyle = 串(色.背景点, 0.6);
  笔.beginPath();
  for (let 行 = 0, y = 5.5; y < 高; y += 距, 行 += 1) {
    for (let x = 行 % 2 === 0 ? 0 : 距 / 2; x < 宽; x += 距) {
      笔.moveTo(x + 半径, y);
      笔.arc(x, y, 半径, 0, Math.PI * 2);
    }
  }
  笔.fill();
}

/** 底部斜纹糖带：粉底 + 一组浅粉斜条，顶沿一道亮唇；压在操作盘后面，只露最下面一截。 */
function 画底带(笔: CanvasRenderingContext2D, 宽: number, 高: number): void {
  const 带高 = 26;
  const 上 = 高 - 带高;
  笔.beginPath();
  笔.rect(0, 上, 宽, 带高);
  填充(笔, 色.带粉);
  笔.save();
  笔.beginPath();
  笔.rect(0, 上, 宽, 带高);
  笔.clip();
  铺斜纹(笔, 0, 上, 宽, 带高, 色.带粉浅, { 条宽: 7, 间距: 14, 角度: 寸.条纹.角度 });
  笔.fillStyle = 串(色.带粉浅, 0.9);
  笔.fillRect(0, 上, 宽, 1.8);
  笔.restore();
}

/** 扁平糖球：纯色圆面 + 下移一档的暗侧边 + 柔影，可可碎是几粒平面圆点。 */
function 画巧克力球(笔: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
  画块(笔, 色.巧克力, 色.巧克力深, () => 笔.arc(cx, cy, r, 0, Math.PI * 2), {
    侧厚: 2.4,
    影透明: 0.34,
  });
  笔.fillStyle = 串(色.巧克力亮, 0.85);
  for (const [dx, dy, rr] of [
    [-0.38, -0.3, 0.1],
    [0.16, -0.44, 0.08],
    [0.34, 0.2, 0.09],
    [-0.12, 0.4, 0.07],
  ] as const) {
    笔.beginPath();
    笔.arc(cx + dx * r, cy + dy * r, rr * r, 0, Math.PI * 2);
    笔.fill();
  }
}

/** 扁平棒棒糖：浅粉圆饼 + 两道深粉螺旋弧，不做径向高光。 */
function 画螺旋糖(笔: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
  画块(笔, 色.糖纸, 色.糖纸深, () => 笔.arc(cx, cy, r, 0, Math.PI * 2), {
    侧厚: 2,
    影透明: 0.32,
  });
  笔.save();
  笔.lineCap = "round";
  笔.strokeStyle = 串(色.粉);
  笔.lineWidth = Math.max(2, r * 0.24);
  笔.beginPath();
  笔.arc(cx, cy, r * 0.62, Math.PI * 0.2, Math.PI * 1.6);
  笔.stroke();
  笔.beginPath();
  笔.arc(cx, cy, r * 0.28, Math.PI * 1.5, Math.PI * 2.7);
  笔.stroke();
  笔.restore();
}

/** 漂浮糖粒：几粒平色圆点，只填顶栏两翼那点空场。 */
function 画糖粒(
  笔: CanvasRenderingContext2D,
  点: readonly (readonly [number, number, number])[],
): void {
  for (const [x, y, r] of 点) {
    笔.beginPath();
    笔.arc(x, y, r, 0, Math.PI * 2);
    笔.fillStyle = 串(色.带粉浅, 0.55);
    笔.fill();
  }
}

export function 画糖果背景(笔: CanvasRenderingContext2D, 宽: number, 高: number): void {
  // ① 深酒红纯色底
  笔.fillStyle = 串(色.背景);
  笔.fillRect(0, 0, 宽, 高);

  // ② 糖霜点阵
  画糖霜点阵(笔, 宽, 高);

  // ③ 顶部天幕与底部糖带
  画天幕(笔, 宽);
  画底带(笔, 宽, 高);

  // ④ 顶栏两翼的扁平糖饰：左上棒棒糖、右上巧克力球，都压在标题横幅两侧的空场里
  画螺旋糖(笔, 80, 27, 11);
  画巧克力球(笔, 宽 - 12, 40, 21);
  画糖粒(笔, [
    [66, 52, 1.7],
    [64, 12, 1.3],
    [316, 22, 1.5],
    [340, 60, 1.9],
    [宽 - 4, 76, 1.4],
    [8, 128, 1.5],
  ]);
}
