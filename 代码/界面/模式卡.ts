import type Phaser from "phaser";
import { 霓虹模式卡 } from "../../组件/霓虹街机/模式卡";
import { 读取霓虹调色板 } from "../../组件/霓虹街机/调色板";
import { 创建纪录存档, type 对局纪录 } from "../存档/对局纪录";
import type { 游戏模式 } from "../玩法/再消一行";
import { 组装模式卡数据 } from "./模式卡数据";

export interface 模式卡选项 {
  索引: number;
  模式: 游戏模式;
  x: number;
  y: number;
  宽: number;
  高: number;
  英文: boolean;
  点击: () => void;
  排行点击?: () => void;
}

/** 读取模式历史最佳，损坏或不可用存储时按无纪录处理。 */
function 读取模式纪录(模式: 游戏模式): 对局纪录 | null {
  try {
    return 创建纪录存档(模式, new Date().toISOString().slice(0, 10), localStorage).读取();
  } catch {
    /* 存储不可用时仍可开始游戏。 */
    return null;
  }
}

/** 把游戏外观的模式数据、历史最佳和开始回调接到霓虹模式卡上。 */
export function 创建模式选择卡(
  场景: Phaser.Scene,
  根: Phaser.GameObjects.Container,
  选项: 模式卡选项,
): 霓虹模式卡 {
  const 数据 = 组装模式卡数据(
    选项.模式,
    选项.英文,
    读取模式纪录(选项.模式),
    读取霓虹调色板().强调色,
  );
  const 卡 = new 霓虹模式卡(场景, {
    x: 选项.x,
    y: 选项.y,
    宽: 选项.宽,
    高: 选项.高,
    名称: `mode.${选项.模式}`,
    标题: 数据.标题,
    细节: 数据.细节,
    说明: 数据.说明,
    纪录: 数据.纪录,
    强调色: 数据.强调色,
    点击: 选项.点击,
    排行点击: 选项.排行点击,
  });
  根.add(卡);
  return 卡;
}
