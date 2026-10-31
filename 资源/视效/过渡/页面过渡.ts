import { 缓入缓出 } from "../../../.gamemaker/依赖/框架/界面/控件/工具";
import type { 画笔 } from "../../../.gamemaker/依赖/框架/界面/绘制/画笔";

export const 页面过渡时长 = 0.22;

/** 传经过时间移出，传时长减经过时间移入；文字与嵌套裁剪同步。 */
export function 绘制页面过渡(
  原画笔: 画笔,
  经过秒: number | null,
  x: number,
  y: number,
  绘制: (画笔: 画笔) => void,
): void {
  if (经过秒 === null || 经过秒 <= 0) {
    绘制(原画笔);
    return;
  }
  const 进度 = 缓入缓出(经过秒 / 页面过渡时长);
  if (进度 >= 1) return;
  const 偏移X = x * 进度;
  const 偏移Y = y * 进度;
  const 图形 = 原画笔.图形;
  图形.save();
  图形.translateCanvas(偏移X, 偏移Y);
  图形.setAlpha(1 - 进度);
  try {
    绘制({
      ...原画笔,
      绘制文字: (项) => 原画笔.绘制文字({ ...项, x: 项.x + 偏移X, y: 项.y + 偏移Y }),
      压入裁剪: (矩形) => 原画笔.压入裁剪({ ...矩形, 左: 矩形.左 + 偏移X, 上: 矩形.上 + 偏移Y }),
    });
  } finally {
    图形.restore();
  }
}
