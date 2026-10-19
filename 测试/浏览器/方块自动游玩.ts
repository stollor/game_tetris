import type { Page } from "playwright";
import type { 游戏模式 } from "../../代码/玩法/再消一行";
import { 执行测试操作, 点击测试交互, 等待测试场景 } from "../../框架/开发/浏览器测试操作";
import { 生成自动落子计划 } from "../自动落子";

type 落子计划 = ReturnType<typeof 生成自动落子计划>;
interface 游玩记录 {
  累计落块?: number;
  累计完赛?: number;
  请求频率?: number;
  计划: 落子计划;
  已落块: number;
  完赛: boolean;
  重开数: number;
  完赛消行数: number;
}
const 记录 = new WeakMap<Page, 游玩记录>();
export async function 准备自动游玩(页: Page, 模式: 游戏模式) {
  const 计划 = 生成自动落子计划(模式, 模式 === "冲刺" ? 400 : 35);
  await 点击测试交互(页, "menu.start");
  await 页.waitForFunction(
    (模式) =>
      window.__GAMEMAKER_TEST__
        ?.getSnapshot("概要")
        .interactives.some((项) => 项.name === `mode.${模式}` && 项.enabled && 项.visible),
    模式,
  );
  await 点击测试交互(页, `mode.${模式}`);
  await 等待测试场景(页, "再消一行对局");
  await 页.waitForFunction(() => Boolean(window.__再消一行测试__));
  await 页.evaluate((序列) => window.__再消一行测试__?.设置序列(序列), 计划.序列);
  记录.set(页, { 计划, 已落块: 0, 完赛: false, 重开数: 0, 完赛消行数: 0 });
}
export async function 执行自动游玩(页: Page, 秒数: number) {
  const 当前 = 记录.get(页);
  if (!当前) throw new Error("自动游玩尚未准备");
  const 起 = performance.now();
  const 间隔 = (秒数 * 1000 * 0.85) / 当前.计划.步骤.length;
  for (const [i, 步] of 当前.计划.步骤.entries()) {
    const 等待 = 起 + i * 间隔 - performance.now();
    if (等待 > 0) await 页.waitForTimeout(等待);
    await 执行一步(页, 当前, 步, i);
  }
}
async function 执行一步(页: Page, 当前: 游玩记录, 步: 落子计划["步骤"][number], i: number) {
  for (let n = 0; n < 步.旋转; n++)
    await 执行测试操作(页, { action: "旋转", keyboard: { key: "x" } });
  for (let n = 0; n < Math.abs(步.横移); n++)
    await 执行测试操作(页, {
      action: "横移",
      keyboard: { key: 步.横移 < 0 ? "ArrowLeft" : "ArrowRight" },
    });
  await 执行测试操作(页, { action: "硬降", keyboard: { key: "Space" } });
  const 状态 = await 页.evaluate(() => window.__再消一行测试__?.读取状态());
  if (!状态 || 状态.消行数 !== 步.消行数 || JSON.stringify(状态.棋盘) !== JSON.stringify(步.棋盘))
    throw new Error(`第${i + 1}块与真实规则计划不符`);
  当前.已落块++;
  if (步.阶段 === "结束") {
    当前.完赛 = 状态.阶段 === "结束" && 状态.消行数 >= 40;
    当前.完赛消行数 = 状态.消行数;
  }
}
/** 时长增加会增加真实操作；超过40行后在同页通过真实按钮重开。 */
export async function 执行持续游玩(页: Page, 秒数: number, 每秒次数: number) {
  const 当前 = 记录.get(页);
  if (!当前 || !Number.isFinite(每秒次数) || 每秒次数 <= 0) throw new Error("持续游玩参数无效");
  当前.累计落块 = 0;
  当前.累计完赛 = 0;
  当前.请求频率 = 每秒次数;
  const 起 = performance.now();
  let 序号 = 0;
  const 目标次数 = Math.ceil(秒数 * 每秒次数);
  while (performance.now() - 起 < 秒数 * 1000 && 序号 < 目标次数) {
    const 等待 = 起 + (序号 * 1000) / 每秒次数 - performance.now();
    if (等待 > 0)
      await 页.waitForTimeout(Math.min(等待, Math.max(0, 秒数 * 1000 - (performance.now() - 起))));
    if (performance.now() - 起 >= 秒数 * 1000) break;
    if (当前.已落块 === 当前.计划.步骤.length) {
      if (!当前.完赛) throw new Error("持续游玩计划不足");
      当前.累计完赛++;
      await 完赛后重开(页);
      await 页.evaluate((序列) => window.__再消一行测试__?.设置序列(序列), 当前.计划.序列);
      当前.已落块 = 0;
      当前.完赛 = false;
    }
    const i = 当前.已落块;
    await 执行一步(页, 当前, 当前.计划.步骤[i], i);
    当前.累计落块++;
    序号++;
  }
}
export async function 自动游玩证据(页: Page) {
  const 当前 = 记录.get(页);
  const 状态 = await 页.evaluate(() => window.__再消一行测试__?.读取状态());
  return {
    序列: "固定七袋2026-10-18",
    累计落块: 当前?.累计落块,
    累计完赛: 当前?.累计完赛,
    请求频率: 当前?.请求频率,
    策略: "真实规则离线规划-v1",
    已落块: 当前?.已落块,
    计划落块: 当前?.计划.步骤.length,
    完赛: 当前?.完赛,
    完赛消行数: 当前?.完赛消行数,
    重开数: 当前?.重开数,
    消行数: 状态?.消行数,
    阶段: 状态?.阶段,
  };
}
export async function 验收自动游玩(页: Page, 阶段?: "准备" | "完成") {
  const 当前 = 记录.get(页);
  if (!当前) throw new Error("自动游玩未准备");
  if (await 页.evaluate(() => document.visibilityState !== "visible"))
    throw new Error("游戏不可见");
  if (阶段 === "准备") {
    const 状态 = await 页.evaluate(() => window.__再消一行测试__?.读取状态());
    if (状态?.阶段 !== "进行中" || 状态.消行数 !== 0) throw new Error("自动游玩没有从真实新局开始");
    return;
  }
  if (当前.已落块 !== 当前.计划.步骤.length) throw new Error("自动游玩未完成全部操作");
  if (当前.计划.完赛 && !当前.完赛) throw new Error("冲刺没有通过真实消行完成");
}
export async function 完赛后重开(页: Page) {
  const 当前 = 记录.get(页);
  if (!当前?.完赛) throw new Error("没有真实完赛记录");
  await 页.waitForFunction(() =>
    window.__GAMEMAKER_TEST__
      ?.getSnapshot("概要")
      .interactives.some((项) => 项.name === "restart" && 项.enabled && 项.visible),
  );
  await 点击测试交互(页, "restart");
  await 页.waitForFunction(() => {
    const 状态 = window.__再消一行测试__?.读取状态();
    return 状态?.阶段 === "进行中" && 状态.消行数 === 0 && 状态.分数 === 0;
  });
  当前.重开数++;
}
