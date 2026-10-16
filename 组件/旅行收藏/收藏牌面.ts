import type Phaser from "phaser";
import { 创建霓虹按钮, type 霓虹按钮参数 } from "../霓虹街机/按钮";

export const 收藏色 = {
  夜: 0x10232a,
  墨: 0x28433f,
  纸: 0xeee6d2,
  金: 0xe5b96d,
  线: 0xb8b79d,
  正文: "#f1ead7",
  次要: "#a3bab0",
  深字: "#28433f",
  淡字: "#64756b",
};

export function 绘制收藏纸页(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  宽: number,
  高: number,
): void {
  g.fillStyle(0x030d13, 0.26).fillRoundedRect(x + 3, y + 8, 宽, 高, 14);
  g.fillStyle(收藏色.纸).fillRoundedRect(x, y, 宽, 高, 12);
  g.lineStyle(1, 0xfff7de, 0.6).strokeRoundedRect(x + 5, y + 5, 宽 - 10, 高 - 10, 8);
}

/** 收藏馆只替换牌面配方，命中、按下、取消与键鼠手势继续使用现有按钮。 */
export function 创建收藏按钮(
  场景: Phaser.Scene,
  参数: 霓虹按钮参数 & { 金色?: boolean; 纸面?: boolean },
) {
  return 创建霓虹按钮(场景, {
    ...参数,
    覆盖: {
      文字色跟随底色: true,
      面板色: 参数.金色 ? "#e5b96d" : 参数.纸面 ? "#eee6d2" : "#28433f",
      强调色: 参数.金色 ? "#e5b96d" : 参数.纸面 ? "#eee6d2" : "#28433f",
      文字色: 参数.金色 || 参数.纸面 ? 收藏色.深字 : 收藏色.正文,
      字重: 参数.金色 ? "bold" : "normal",
      绘制底板: (g, w, h, s) => {
        g.clear();
        const x = -w / 2,
          y = -h / 2;
        g.fillStyle(0x041218, 0.3).fillRoundedRect(x, y + 3, w, h, 7);
        const 背景 = 参数.金色 ? 收藏色.金 : 参数.纸面 ? 收藏色.纸 : 收藏色.墨;
        g.fillStyle(背景, s.可用 ? 1 : 0.5).fillRoundedRect(x, y, w, h, 7);
        g.lineStyle(
          s.已选 ? 2 : 1,
          s.悬停 || s.已选 ? 0xffe6a2 : 参数.纸面 ? 0xb3b59c : 0x607e73,
          s.可用 ? 0.9 : 0.35,
        ).strokeRoundedRect(x, y, w, h, 7);
        g.lineStyle(1, 0xfff5cc, s.按下 ? 0.06 : 0.22).lineBetween(x + 8, y + 2, x + w - 8, y + 2);
        if (s.悬停) g.fillStyle(0xfff8d6, 0.06).fillRoundedRect(x + 2, y + 2, w - 4, h - 4, 6);
      },
      ...参数.覆盖,
    },
  });
}
