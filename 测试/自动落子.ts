import {
  type 再消一行状态,
  创建新局,
  type 方块类型,
  旋转方块,
  每日方块序列,
  type 游戏模式,
  硬降,
  移动方块,
} from "../代码/玩法/再消一行";

export interface 自动落子步骤 {
  旋转: number;
  横移: number;
  消行数: number;
  棋盘: (方块类型 | null)[][];
  阶段: string;
}
function 棋盘评分(状态: 再消一行状态, 新消行: number) {
  const 高度 = Array.from({ length: 10 }, (_, 列) => {
    const 顶 = 状态.棋盘.findIndex((行) => 行[列] !== null);
    return 顶 === -1 ? 0 : 状态.棋盘.length - 顶;
  });
  let 洞 = 0;
  for (let 列 = 0; 列 < 10; 列++) {
    for (let 行 = 状态.棋盘.length - 高度[列]; 行 < 状态.棋盘.length; 行++)
      if (状态.棋盘[行][列] === null) 洞++;
  }
  const 起伏 = 高度.slice(1).reduce((和, 高, i) => 和 + Math.abs(高 - 高度[i]), 0);
  return (
    新消行 * 0.760666 -
    高度.reduce((和, 高) => 和 + 高, 0) * 0.510066 -
    洞 * 0.760666 -
    起伏 * 0.184483
  );
}
export function 选择自动落子(状态: 再消一行状态) {
  let 最好: { 状态: 再消一行状态; 旋转: number; 横移: number; 分: number } | undefined;
  for (let 转 = 0; 转 < 4; 转++) {
    for (let 移 = -5; 移 <= 5; 移++) {
      const 模拟 = structuredClone(状态);
      let 有效 = true;
      for (let i = 0; i < 转; i++) if (!旋转方块(模拟, -1)) 有效 = false;
      for (let i = 0; i < Math.abs(移); i++) if (!移动方块(模拟, Math.sign(移))) 有效 = false;
      if (!有效) continue;
      硬降(模拟, () => 0.5);
      if (模拟.阶段 === "结束" && !模拟.完赛) continue;
      const 分 = 棋盘评分(模拟, 模拟.消行数 - 状态.消行数);
      if (!最好 || 分 > 最好.分) 最好 = { 状态: 模拟, 旋转: 转, 横移: 移, 分 };
    }
  }
  if (!最好) throw new Error("自动玩家没有找到可存活的落点");
  return 最好;
}
export function 生成自动落子计划(模式: 游戏模式, 上限 = 400) {
  const 序列 = 每日方块序列("2026-10-18", 上限 + 10);
  let 状态 = 创建新局(() => 0.5, 序列, 模式, 0);
  const 步骤: 自动落子步骤[] = [];
  for (let i = 0; i < 上限 && 状态.阶段 === "进行中"; i++) {
    const 选择 = 选择自动落子(状态);
    状态 = 选择.状态;
    步骤.push({
      旋转: 选择.旋转,
      横移: 选择.横移,
      消行数: 状态.消行数,
      棋盘: structuredClone(状态.棋盘),
      阶段: 状态.阶段,
    });
  }
  return { 序列, 步骤, 完赛: 状态.完赛, 消行数: 状态.消行数 };
}
