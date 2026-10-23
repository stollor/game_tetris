import type { 地点纹样 } from "../../代码/框架配置/旅行地点";
import type { 图形对象 } from "../../框架/界面/绘制/协议";

/** 地点纹样是纯 Graphics 指令，Phaser Graphics 与 Three 画笔共用同一份。 */
export function 绘制地点纹样(
  g: 图形对象,
  x: number,
  y: number,
  格: number,
  纹样: 地点纹样,
  透明度: number,
): void {
  const 中x = x + 格 * 0.5,
    中y = y + 格 * 0.52;
  g.lineStyle(Math.max(0.65, 格 * 0.025), 0xf9f0d6, 透明度 * 0.5);
  if (纹样 === "熊猫") {
    g.fillStyle(0xf7f0df, 透明度 * 0.9).fillCircle(中x, 中y, 格 * 0.24);
    g.fillStyle(0x263d38, 透明度 * 0.9)
      .fillCircle(中x - 格 * 0.16, 中y - 格 * 0.17, 格 * 0.08)
      .fillCircle(中x + 格 * 0.16, 中y - 格 * 0.17, 格 * 0.08)
      .fillEllipse(中x - 格 * 0.09, 中y, 格 * 0.1, 格 * 0.14)
      .fillEllipse(中x + 格 * 0.09, 中y, 格 * 0.1, 格 * 0.14);
  } else if (纹样 === "冰晶") {
    for (let i = 0; i < 3; i++) {
      const a = (i * Math.PI) / 3;
      g.lineBetween(
        中x - Math.cos(a) * 格 * 0.3,
        中y - Math.sin(a) * 格 * 0.3,
        中x + Math.cos(a) * 格 * 0.3,
        中y + Math.sin(a) * 格 * 0.3,
      );
    }
  } else if (纹样 === "城砖") {
    g.lineStyle(格 * 0.035, 0x26333c, 透明度 * 0.4)
      .lineBetween(x + 格 * 0.12, 中y, x + 格 * 0.88, 中y)
      .lineBetween(中x, y + 格 * 0.12, 中x, 中y)
      .lineBetween(x + 格 * 0.28, 中y, x + 格 * 0.28, y + 格 * 0.86);
  } else if (纹样 === "宫阙") {
    g.strokeRect(x + 格 * 0.2, y + 格 * 0.2, 格 * 0.6, 格 * 0.6).strokeRect(
      x + 格 * 0.35,
      y + 格 * 0.35,
      格 * 0.3,
      格 * 0.3,
    );
  } else if (纹样 === "莲叶") {
    g.strokeEllipse(中x, 中y, 格 * 0.58, 格 * 0.35)
      .lineBetween(中x, 中y, 中x + 格 * 0.21, 中y - 格 * 0.1)
      .lineBetween(中x, 中y, 中x, 中y + 格 * 0.2);
  } else if (纹样 === "流沙") {
    for (let i = 0; i < 3; i++)
      g.lineBetween(
        x + 格 * 0.2,
        y + 格 * (0.35 + i * 0.14),
        x + 格 * 0.78,
        y + 格 * (0.23 + i * 0.14),
      );
  } else if (纹样 === "山水") {
    g.strokeTriangle(
      x + 格 * 0.18,
      y + 格 * 0.74,
      中x,
      y + 格 * 0.25,
      x + 格 * 0.81,
      y + 格 * 0.74,
    );
    g.lineBetween(中x, y + 格 * 0.25, 中x, y + 格 * 0.7);
  } else if (纹样 === "窗棂") {
    g.strokeCircle(中x, 中y, 格 * 0.28)
      .lineBetween(中x, y + 格 * 0.25, 中x, y + 格 * 0.8)
      .lineBetween(x + 格 * 0.23, 中y, x + 格 * 0.77, 中y);
  } else if (纹样 === "霓虹") {
    g.lineStyle(格 * 0.035, 0xe9faff, 透明度 * 0.75)
      .lineBetween(x + 格 * 0.2, y + 格 * 0.25, x + 格 * 0.2, y + 格 * 0.68)
      .lineBetween(x + 格 * 0.2, y + 格 * 0.68, x + 格 * 0.7, y + 格 * 0.68)
      .fillStyle(0xe9faff, 透明度 * 0.8)
      .fillCircle(x + 格 * 0.72, y + 格 * 0.3, 格 * 0.045);
  } else if (纹样 === "铜纹") {
    g.strokeCircle(中x, 中y, 格 * 0.27).strokeRect(
      中x - 格 * 0.1,
      中y - 格 * 0.1,
      格 * 0.2,
      格 * 0.2,
    );
  } else if (纹样 === "松针") {
    g.lineBetween(x + 格 * 0.25, y + 格 * 0.75, x + 格 * 0.72, y + 格 * 0.24);
    for (let i = 0; i < 3; i++)
      g.lineBetween(
        x + 格 * (0.33 + i * 0.11),
        y + 格 * (0.66 - i * 0.12),
        x + 格 * (0.25 + i * 0.11),
        y + 格 * (0.4 - i * 0.1),
      );
  } else {
    g.strokeTriangle(中x, y + 格 * 0.19, x + 格 * 0.81, 中y, 中x, y + 格 * 0.83).strokeTriangle(
      中x,
      y + 格 * 0.19,
      x + 格 * 0.19,
      中y,
      中x,
      y + 格 * 0.83,
    );
  }
}
