import type Phaser from "phaser";
import { 霓虹模式卡 } from "../../组件/霓虹街机/模式卡";
import { 读取霓虹调色板 } from "../../组件/霓虹街机/调色板";
import { 创建纪录存档 } from "../存档/对局纪录";
import type { 游戏模式 } from "../玩法/俄罗斯方块";
import { 游戏外观 } from "../配置/游戏外观";

const 英文标题 = ["MARATHON", "SPRINT", "ULTRA", "DAILY"];
const 英文细节 = ["ENDLESS", "40 LINES", "120 SEC", "TODAY"];
const 英文说明 = [
  "Keep climbing. Beat your best.",
  "Clear 40 lines as fast as you can.",
  "Score as much as possible in 120s.",
  "Same sequence for everyone today.",
];

/** 读取模式历史最佳，损坏或不可用存储时回退到无纪录文案。 */
function 读取模式纪录(模式: 游戏模式, 英文: boolean): string {
  let 纪录 = 英文 ? "NO RECORD YET" : "尚无纪录";
  try {
    const 纪录项 = 创建纪录存档(模式, new Date().toISOString().slice(0, 10), localStorage).读取();
    if (纪录项)
      纪录 =
        模式 === "冲刺"
          ? 纪录项.用时
            ? `${(纪录项.用时 / 1000).toFixed(2)}s`
            : 英文
              ? "NO FINISH YET"
              : "尚无完赛纪录"
          : `${纪录项.分数.toLocaleString()}${英文 ? " pts" : " 分"}`;
  } catch {
    /* 存储不可用时仍可开始游戏。 */
  }
  return 纪录;
}

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

/** 把游戏外观的模式数据、历史最佳和开始回调接到霓虹模式卡上。 */
export function 创建模式选择卡(
  场景: Phaser.Scene,
  根: Phaser.GameObjects.Container,
  选项: 模式卡选项,
): 霓虹模式卡 {
  const 项 = 游戏外观.模式[选项.模式];
  const t = (中文: string, 英文: string) => (选项.英文 ? 英文 : 中文);
  const 卡 = new 霓虹模式卡(场景, {
    x: 选项.x,
    y: 选项.y,
    宽: 选项.宽,
    高: 选项.高,
    名称: `mode.${选项.模式}`,
    标题: t(项.标题, 英文标题[选项.索引] ?? ""),
    细节: t(项.细节, 英文细节[选项.索引] ?? ""),
    说明: t(项.说明, 英文说明[选项.索引] ?? ""),
    纪录: `${t("最佳", "BEST")}  ${读取模式纪录(选项.模式, 选项.英文)}`,
    强调色: 读取霓虹调色板().强调色,
    点击: 选项.点击,
    排行点击: 选项.排行点击,
  });
  根.add(卡);
  return 卡;
}
