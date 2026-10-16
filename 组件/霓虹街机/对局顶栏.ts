import { 界面数值面板 } from "Phaser框架/界面/数值面板";
import type Phaser from "phaser";
import { 游戏外观 } from "../../代码/配置/游戏外观";
import { 添加霓虹原生文字 } from "./文字";
import { 读取霓虹调色板 } from "./调色板";

export interface 霓虹顶栏指标 {
  标题: string;
  数值: string;
  强调色?: string;
}

export interface 霓虹顶栏配置 {
  x: number;
  y: number;
  宽: number;
  高: number;
  指标: 霓虹顶栏指标[];
  数值变化动画?: boolean;
}

/**
 * 对局顶部信息栏：等级/分数/消行等指标由调用方的 `指标` 决定，
 * 配色与字体走霓虹配方。数值只通过 `更新(数值)` 写入，不读取玩法状态。
 */
export function 创建霓虹信息栏(场景: Phaser.Scene, 配置: 霓虹顶栏配置): 界面数值面板 {
  const 调色板 = 读取霓虹调色板();
  return new 界面数值面板(
    场景,
    配置.x,
    配置.y,
    配置.宽,
    配置.高,
    配置.指标.map((指标) => ({
      标题: 指标.标题,
      数值: 指标.数值,
      强调色: 指标.强调色 ?? 调色板.强调色,
    })),
    {
      面板色: 调色板.面板底字符串,
      边框色: 调色板.次要按钮.边框,
      标签色: 调色板.次要文字,
      数值变化动画: 配置.数值变化动画 ?? true,
      字体: 游戏外观.字体.家族,
    },
  );
}

/** 对局内模式提示文字（棋盘上方），由场景按模式更新文本。 */
export function 创建霓虹模式文字(场景: Phaser.Scene, 文案 = ""): Phaser.GameObjects.Text {
  return 添加霓虹原生文字(场景, undefined, 0, 0, 文案, {
    字号: 游戏外观.字体.辅助,
    颜色: 读取霓虹调色板().强调色,
  });
}
