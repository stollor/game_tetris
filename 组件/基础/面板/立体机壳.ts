import { 立体规范 } from "../../../主题/立体/立体规范";
import type { 图形对象, 矩形 } from "../../../框架/界面/绘制/协议";

const 面 = 立体规范.界面;

/** 井口以外铺不透明机壳，3D 房间只从开口露出来。 */
export function 绘制立体机壳(图: 图形对象, 宽: number, 高: number, 井: 矩形): void {
  const 框 = 面.框;
  图.fillStyle(面.壳, 1).fillRect(0, 0, 宽, 井.上);
  图.fillStyle(面.壳, 1).fillRect(0, 井.上, 井.左, 井.高);
  图.fillStyle(面.壳, 1).fillRect(井.左 + 井.宽, 井.上, 宽 - 井.左 - 井.宽, 井.高);
  图.fillStyle(面.壳, 1).fillRect(0, 井.上 + 井.高, 宽, 高 - 井.上 - 井.高);
  图.fillStyle(面.板暗, 1).fillRect(井.左 - 框, 井.上 - 框, 井.宽 + 框 * 2, 框);
  图.fillStyle(面.板暗, 1).fillRect(井.左 - 框, 井.上 + 井.高, 井.宽 + 框 * 2, 框);
  图.fillStyle(面.板暗, 1).fillRect(井.左 - 框, 井.上, 框, 井.高);
  图.fillStyle(面.板暗, 1).fillRect(井.左 + 井.宽, 井.上, 框, 井.高);
  图.fillStyle(面.板, 1).fillRect(井.左 - 框 + 1, 井.上 - 框 + 1, 井.宽 + 框 * 2 - 2, 框 - 2);
  图.fillStyle(面.板, 1).fillRect(井.左 - 框 + 1, 井.上 + 井.高 + 1, 井.宽 + 框 * 2 - 2, 框 - 2);
  图.fillStyle(面.板, 1).fillRect(井.左 - 框 + 1, 井.上, 框 - 2, 井.高);
  图.fillStyle(面.板, 1).fillRect(井.左 + 井.宽 + 1, 井.上, 框 - 2, 井.高);
  图.lineStyle(2, 面.灯, 0.82).strokeRect(井.左, 井.上, 井.宽, 井.高);
  图.lineStyle(5, 面.灯芯, 0.1).strokeRect(井.左 - 2, 井.上 - 2, 井.宽 + 4, 井.高 + 4);
  图
    .lineStyle(1, 面.板高光, 0.35)
    .strokeRect(井.左 - 框, 井.上 - 框, 井.宽 + 框 * 2, 井.高 + 框 * 2);
  图
    .lineStyle(面.灯宽, 面.灯, 0.22)
    .strokeRect(面.外沿, 面.外沿, 宽 - 面.外沿 * 2, 高 - 面.外沿 * 2);
}
