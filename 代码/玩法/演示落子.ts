import { type 再消一行状态, 旋转方块, 硬降, 移动方块 } from "./再消一行";

export interface 演示落点 {
  旋转次数: number;
  平移: number;
}

const 静随机 = () => 0;

function 列高度(状态: 再消一行状态): number[] {
  const 高度: number[] = [];
  for (let 列 = 0; 列 < 10; 列++) {
    let 值 = 0;
    for (let 行 = 0; 行 < 20; 行++) {
      if (状态.棋盘[行 + 2]?.[列]) {
        值 = 20 - 行;
        break;
      }
    }
    高度.push(值);
  }
  return 高度;
}

function 洞数(状态: 再消一行状态): number {
  let 洞 = 0;
  for (let 列 = 0; 列 < 10; 列++) {
    let 见过方块 = false;
    for (let 行 = 0; 行 < 20; 行++) {
      if (状态.棋盘[行 + 2]?.[列]) 见过方块 = true;
      else if (见过方块) 洞 += 1;
    }
  }
  return 洞;
}

function 评估(前: 再消一行状态, 后: 再消一行状态, 目标: "成功" | "失败"): number {
  if (后.完赛) return 目标 === "成功" ? 1_000_000 + 后.消行数 : -1_000_000;
  if (后.阶段 === "结束") return 目标 === "成功" ? -1_000_000 : 500_000;
  const 消行 = 后.消行数 - 前.消行数;
  const 高度 = 列高度(后);
  const 最高 = Math.max(...高度);
  let 起伏 = 0;
  for (let i = 1; i < 高度.length; i++) 起伏 += Math.abs((高度[i] ?? 0) - (高度[i - 1] ?? 0));
  const 洞 = 洞数(后);
  if (目标 === "成功") return 消行 * 1000 - 洞 * 90 - 最高 * 16 - 起伏 * 6;
  return 洞 * 50 + 最高 * 28 + 起伏 * 3 - 消行 * 250;
}

/** 为当前方块选一个落点。成功尽量消行并压低堆叠；失败先堆高，落子足够后再接受顶死。 */
export function 选择演示落点(原: 再消一行状态, 目标: "成功" | "失败", 已落: number): 演示落点 {
  const 候选: { 旋转次数: number; 平移: number; 分: number; 结束: boolean }[] = [];
  for (let 旋转次数 = 0; 旋转次数 < 4; 旋转次数++) {
    const 基准 = structuredClone(原);
    let 可转 = true;
    for (let i = 0; i < 旋转次数; i++) {
      if (!旋转方块(基准, 1, false, 静随机)) {
        可转 = false;
        break;
      }
    }
    if (!可转) continue;
    let 左 = 0;
    while (移动方块(基准, -1, 0, 静随机)) 左 += 1;
    let 右 = 0;
    for (;;) {
      const 落下 = structuredClone(基准);
      硬降(落下, 静随机);
      候选.push({
        旋转次数,
        平移: 右 - 左,
        分: 评估(原, 落下, 目标),
        结束: 落下.阶段 === "结束",
      });
      if (!移动方块(基准, 1, 0, 静随机)) break;
      右 += 1;
      if (右 > 12) break;
    }
  }
  let 池 = 候选;
  if (目标 === "失败" && 已落 < 12) {
    const 活着 = 候选.filter((项) => !项.结束);
    if (活着.length) 池 = 活着;
  }
  池.sort((甲, 乙) => 乙.分 - 甲.分);
  const 最好 = 池[0];
  return 最好 ? { 旋转次数: 最好.旋转次数, 平移: 最好.平移 } : { 旋转次数: 0, 平移: 0 };
}
