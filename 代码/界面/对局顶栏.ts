import type Phaser from "phaser";
import type { 界面数值面板 } from "../../框架/界面/数值面板";
import { 创建霓虹信息栏, 创建霓虹模式文字 } from "../../组件/霓虹街机/对局顶栏";
import { 读取霓虹调色板 } from "../../组件/霓虹街机/调色板";
import type { 游戏文案 } from "../语言/类型";

export interface 对局信息栏选项 {
  x: number;
  y: number;
  宽: number;
  高: number;
  文案: 游戏文案;
}

/** 对局顶部信息栏：等级/分数/消行标题来自文案，配色与字体沿用霓虹配方。 */
export function 创建对局信息栏(场景: Phaser.Scene, 选项: 对局信息栏选项): 界面数值面板 {
  const 调色板 = 读取霓虹调色板();
  return 创建霓虹信息栏(场景, {
    x: 选项.x,
    y: 选项.y,
    宽: 选项.宽,
    高: 选项.高,
    指标: [
      { 标题: 选项.文案.面板等级, 数值: "1", 强调色: 调色板.强调色 },
      { 标题: 选项.文案.面板分数, 数值: "000000", 强调色: 调色板.正文 },
      { 标题: 选项.文案.面板消行, 数值: "0", 强调色: 调色板.强调色 },
    ],
  });
}

/** 棋盘上方的模式提示文字，内容由场景按模式更新。 */
export function 创建对局模式文字(场景: Phaser.Scene): Phaser.GameObjects.Text {
  return 创建霓虹模式文字(场景, "");
}
