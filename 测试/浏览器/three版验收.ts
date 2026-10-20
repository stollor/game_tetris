import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { chromium } from "playwright";
import type { 运行统计 } from "../../代码/three版/启动";
import type { 对局快照 } from "../../代码/three版/对局";
import { type 再消一行状态, 旋转方块, 硬降, 移动方块 } from "../../代码/玩法/再消一行";

/**
 * 《再消一行》Three 版实机验收：390×844 DPR1 只截当前视口。
 * 连玩一局到结束（记录落块/消行/计分），点结算「重新开始」再开一局，
 * 采集首帧、平均帧间隔、单帧脚本耗时与 JS 堆内存，产物写 reports/three版/。
 */

type 对局状态 = 对局快照 & { 场景栈: string[] };

interface 操作记录 {
  序号: number;
  动作: "落块" | "消行" | "重开";
  说明: string;
  分数: number;
  消行数: number;
  阶段: string;
  有效用时: number;
}

const 地址 = process.argv[2] ?? "http://127.0.0.1:3000";
const 输出 = resolve("reports/three版");
await mkdir(输出, { recursive: true });

const 浏览器 = await chromium.launch({ channel: "chrome" });
try {
  const 页 = await 浏览器.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  const 页面错误: string[] = [];
  页.on("pageerror", (错误) => 页面错误.push(错误.message));
  页.on("console", (消息) => {
    if (消息.type() !== "error") return;
    const 文本 = 消息.text();
    // 宿主不做 <link rel="icon"> 时浏览器会自己请求 favicon，404 与游戏无关。
    if (文本.includes("favicon")) return;
    页面错误.push(文本);
  });
  await 页.goto(地址);
  try {
    await 页.waitForFunction(() => window.__three版__ !== undefined, undefined, { timeout: 20000 });
  } catch {
    throw new Error(`游戏未就绪：${页面错误.join("；")}`);
  }
  await 页.waitForTimeout(600);

  const 读取状态 = async (): Promise<对局状态> => {
    const 状态 = await 页.evaluate(() => window.__three版__?.读取状态());
    if (!状态) throw new Error("读取状态失败");
    return 状态;
  };
  const 读取统计 = async (): Promise<运行统计> => {
    const 统计 = await 页.evaluate(() => window.__three版__?.读取统计());
    if (!统计) throw new Error("读取统计失败");
    return 统计;
  };

  const 开局 = await 读取状态();
  assert.equal(页面错误.length, 0, `启动报错：${页面错误.join("；")}`);
  assert.equal(开局.阶段, "进行中");
  assert.equal(开局.分数, 0);
  assert.equal(开局.消行数, 0);
  await 页.screenshot({ path: join(输出, "01-开局.png") });

  const 操作记录: 操作记录[] = [];
  let 记录序号 = 0;
  const 记录 = (动作: 操作记录["动作"], 说明: string, 状态: 对局状态) => {
    操作记录.push({
      序号: ++记录序号,
      动作,
      说明,
      分数: 状态.分数,
      消行数: 状态.消行数,
      阶段: 状态.阶段,
      有效用时: 状态.有效用时,
    });
  };

  // 落块策略在页面外模拟规则后选点：优先消行，其次少挖洞、压低堆高。
  const 选择落点 = async (): Promise<{ 旋转: number; 目标列: number }> => {
    const 原状态 = await 页.evaluate(() => window.__three版__?.读取原始状态());
    if (!原状态) throw new Error("读取原始状态失败");
    const 随机源 = () => 0.5;
    let 最优 = { 旋转: 0, 目标列: 5, 评分: Number.NEGATIVE_INFINITY };
    const 旋转后 = structuredClone(原状态) as 再消一行状态;
    for (let 旋转次数 = 0; 旋转次数 <= 3; 旋转次数++) {
      if (旋转次数 > 0 && !旋转方块(旋转后, 1, false, 随机源)) break;
      for (let 目标列 = 0; 目标列 <= 9; 目标列++) {
        const 模拟 = structuredClone(旋转后) as 再消一行状态;
        for (let 次 = 0; 次 < 10; 次++) 移动方块(模拟, -1, 0, 随机源);
        for (let 次 = 0; 次 < 目标列; 次++) 移动方块(模拟, 1, 0, 随机源);
        硬降(模拟, 随机源);
        const 评分 = 评估落点(原状态, 模拟);
        if (评分 > 最优.评分) 最优 = { 旋转: 旋转次数, 目标列, 评分 };
      }
    }
    return { 旋转: 最优.旋转, 目标列: 最优.目标列 };
  };

  const 落一块 = async (旋转: number, 目标列: number) => {
    for (let 次 = 0; 次 < 旋转; 次++) await 页.keyboard.press("ArrowUp");
    for (let 次 = 0; 次 < 10; 次++) await 页.keyboard.press("ArrowLeft");
    for (let 次 = 0; 次 < 目标列; 次++) await 页.keyboard.press("ArrowRight");
    await 页.keyboard.press(" ");
    await 页.waitForTimeout(12);
  };

  let 上一消行 = 0;
  let 消行截图 = false;
  let 结束状态: 对局状态 | null = null;
  let 块 = 0;
  // 阶段一：正常落块直到至少消一行（最多 40 块）。
  while (块 < 40 && 上一消行 === 0) {
    const 落点 = await 选择落点();
    await 落一块(落点.旋转, 落点.目标列);
    const 状态 = await 读取状态();
    记录("落块", `第 ${块 + 1} 块 → 第 ${落点.目标列} 列（旋转 ${落点.旋转} 次）`, 状态);
    if (状态.消行数 > 上一消行) {
      记录("消行", `本次消除 ${状态.消行数 - 上一消行} 行`, 状态);
      if (!消行截图) {
        消行截图 = true;
        await 页.screenshot({ path: join(输出, "02-消行后.png") });
      }
    }
    上一消行 = Math.max(上一消行, 状态.消行数);
    块++;
    if (状态.阶段 === "结束") 结束状态 = 状态;
  }
  assert.ok(上一消行 >= 1, `阶段一应至少消 1 行，实际 ${上一消行}`);
  assert.ok((await 读取状态()).分数 > 0, "阶段一计分应大于 0");

  // 阶段二：同一列硬降直到顶出，验证自然结束与结算覆盖页。
  while (!结束状态 && 块 < 160) {
    await 落一块(0, 0);
    const 状态 = await 读取状态();
    记录("落块", `第 ${块 + 1} 块 → 第 0 列（堆高）`, 状态);
    上一消行 = Math.max(上一消行, 状态.消行数);
    块++;
    if (状态.阶段 === "结束") 结束状态 = 状态;
  }

  assert.ok((结束状态?.分数 ?? 0) > 0, `计分应大于 0，实际 ${结束状态?.分数}`);
  assert.ok(结束状态, "一局应能自然结束（顶出）");
  assert.deepEqual(结束状态.场景栈, ["对局", "结算"]);
  await 页.screenshot({ path: join(输出, "03-结束.png") });

  // 结算面板「重新开始」按钮中心：左 115 + 宽 160/2，上 500 + 高 56/2。
  await 页.mouse.click(195, 528);
  await 页.waitForTimeout(300);
  const 重开状态 = await 读取状态();
  assert.equal(重开状态.阶段, "进行中");
  assert.equal(重开状态.分数, 0);
  assert.equal(重开状态.消行数, 0);
  assert.deepEqual(重开状态.场景栈, ["对局"]);
  记录("重开", "点击结算面板重新开始", 重开状态);
  await 页.screenshot({ path: join(输出, "04-重开.png") });

  // 至少 300 帧后再取性能数据；headless 浏览器刷新率不固定，同时给出脚本耗时。
  let 统计 = await 读取统计();
  for (let 等待 = 0; 等待 < 80 && 统计.循环.帧数 < 320; 等待++) {
    await 页.waitForTimeout(100);
    统计 = await 读取统计();
  }
  assert.equal(页面错误.length, 0, `运行中报错：${页面错误.join("；")}`);
  assert.deepEqual(统计.画布, { 宽: 390, 高: 844, 视口宽: "390", 视口高: "844" });
  assert.equal(统计.设备像素比, 1);
  assert.ok(统计.循环.帧数 >= 300, `帧数不足：${统计.循环.帧数}`);
  assert.ok(统计.循环.首帧毫秒 !== null, "首帧耗时缺失");
  assert.ok(统计.循环.平均工作毫秒 < 16, `单帧脚本耗时过高：${统计.循环.平均工作毫秒}`);
  assert.ok(统计.渲染.绘制调用 <= 8, `绘制调用过多：${统计.渲染.绘制调用}`);
  assert.ok(统计.合批.四边形数 > 20, `四边形数异常：${统计.合批.四边形数}`);
  assert.ok(统计.内存 && 统计.内存.已用MB > 0, "JS 堆内存缺失");

  const 结果 = {
    地址,
    视口: { 宽: 390, 高: 844, 设备像素比: 1 },
    开局,
    结束状态,
    重开状态,
    统计,
    操作记录,
    页面错误,
    时间: new Date().toISOString(),
  };
  await writeFile(join(输出, "结果.json"), JSON.stringify(结果, null, 2));
  await writeFile(join(输出, "操作记录.json"), JSON.stringify(操作记录, null, 2));
  console.log(
    JSON.stringify(
      {
        落块数: 统计.对局统计.落块数,
        消行次数: 统计.对局统计.消行次数,
        最终分数: 结束状态.分数,
        首帧毫秒: 统计.循环.首帧毫秒,
        平均帧间隔毫秒: 统计.循环.平均帧间隔毫秒,
        平均工作毫秒: 统计.循环.平均工作毫秒,
        最长工作毫秒: 统计.循环.最长工作毫秒,
        帧数: 统计.循环.帧数,
        内存: 统计.内存,
        绘制调用: 统计.渲染.绘制调用,
        四边形数: 统计.合批.四边形数,
        操作记录条数: 操作记录.length,
      },
      null,
      2,
    ),
  );
  console.log("Three 版实机验收通过，截图与结果：reports/three版/");
} finally {
  await 浏览器.close();
}

/** 落点评分：消行权重最高，其次少留洞、压低总高度与最高列。 */
function 评估落点(原状态: 再消一行状态, 模拟: 再消一行状态): number {
  const 新增消行 = 模拟.消行数 - 原状态.消行数;
  let 洞数 = 0;
  let 总高度 = 0;
  let 最高 = 0;
  for (let 列 = 0; 列 < 10; 列++) {
    let 见到方块 = false;
    let 高度 = 0;
    for (let 行 = 0; 行 < 20; 行++) {
      const 有 = Boolean(模拟.棋盘[行 + 2]?.[列]);
      if (有) {
        if (!见到方块) 高度 = 20 - 行;
        见到方块 = true;
      } else if (见到方块) 洞数++;
    }
    总高度 += 高度;
    if (高度 > 最高) 最高 = 高度;
  }
  const 结束惩罚 = 模拟.阶段 === "结束" ? 100000 : 0;
  return 新增消行 * 10000 - 洞数 * 120 - 总高度 * 4 - 最高 * 6 - 结束惩罚;
}
