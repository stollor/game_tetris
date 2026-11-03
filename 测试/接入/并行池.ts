/**
 * 固定并发任务池：浏览器验收默认并行，串行才是特例。
 *
 * 验收脚本里的「一轮」= 一个独立浏览器上下文 + 一个游戏实例，轮次之间没有共享状态，
 * 所以天然可以并发；并发只改变墙钟时间，不改变断言与记录顺序。
 * 新增验收脚本时优先用这个池，而不是手写 `for` + `await` 串行跑主题。
 *
 * 并发度来源优先级：命令行 `--并发=N` > 环境变量 `GM_TEST_并发` > `默认并发数`，
 * 最终夹在 `1..任务数` 之间。机器吃紧时把它降到 2 或 1 即可，不需要改代码。
 */

/** 默认同时跑几轮：四套主题正好跑满。 */
export const 默认并发数 = 4;

/** 从命令行参数/环境变量解析并发度，并夹到 1..任务数。 */
export function 解析并发(参数: readonly string[], 任务数: number): number {
  const 命令行 = 参数.find((项) => 项.startsWith("--并发="))?.split("=")[1];
  const 环境 = process.env.GM_TEST_并发;
  const 数值 = Number(命令行 ?? 环境 ?? Number.NaN);
  const 请求 = Number.isFinite(数值) && 数值 >= 1 ? Math.floor(数值) : 默认并发数;
  return Math.max(1, Math.min(请求, Math.max(1, 任务数)));
}

/**
 * 固定并发的任务池：输入顺序即结果顺序。
 * 某个任务抛错时直接向上抛（与串行语义一致），由调用方决定是否降并发重跑。
 */
export async function 并行池<任务, 结果>(
  任务列表: readonly 任务[],
  并发: number,
  执行: (任务: 任务, 序号: number) => Promise<结果>,
): Promise<结果[]> {
  const 结果 = new Array<结果>(任务列表.length);
  let 下一个 = 0;
  const 工人 = async (): Promise<void> => {
    for (;;) {
      const 序号 = 下一个++;
      const 任务 = 任务列表[序号];
      if (任务 === undefined) return;
      结果[序号] = await 执行(任务, 序号);
    }
  };
  const 工人数 = Math.max(1, Math.min(并发, 任务列表.length));
  await Promise.all(Array.from({ length: 工人数 }, () => 工人()));
  return 结果;
}
