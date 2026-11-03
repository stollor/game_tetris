import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { type Browser, chromium, type Page } from "playwright";
import type { 调试状态, 调试统计 } from "../../代码/应用/启动";
import { 并行池, 解析并发, 默认并发数 } from "../接入/并行池";

/**
 * 文字图集验收：四套主题 × 中/英两套文案，逐个打开所有界面，再完整打一局马拉松，
 * 记录每一步的文字图集（页数、每页宽高、纹理字节、图集索引数、页内字形数）、
 * 绘制调用与合批批次，并把共享图集页本身导出成 PNG 作为证据。
 *
 * ## 并行是本脚本的默认策略（不是可选优化）
 *
 * 「语言 × 主题」每一轮都是独立浏览器上下文里的独立游戏实例，轮次之间不共享任何状态，
 * 所以可以同时跑；同一轮内部的导航必须串行（游戏是单实例、单页面）。
 * 并发度由 `--并发=N` 控制，默认 `默认并发数 = 4`（正好覆盖四套主题）。
 * 并发只改变墙钟时间，不改变断言：记录按轮次顺序合并后再统一汇总。
 * 内存/CPU 随并发线性增长（每个实例各有一份 Three 场景与纹理），机器吃紧时降到 2 或 1。
 *
 * ## 耗时（390×844 DPR1，本机实测）
 *
 * - 快速冒烟（`--快速`，1 轮）：约 11 秒；
 * - 完整 8 轮串行：约 119 秒（单轮约 14.6 秒）；按默认 4 并发约 35～40 秒。
 *
 * 运行：先在另一个终端 `bun run dev`，再
 * `bun 测试/浏览器/文字图集验收.ts <地址> [--快速] [--DPR=2] [--并发=4]`。
 * 产物：.gamemaker/报告/文字图集验收/（各主题各语言的共享页贴图、汇总.json、汇总.md）。
 */

const 地址 = process.argv[2] ?? "http://127.0.0.1:3004";
const DPR = Number(process.argv.find((项) => 项.startsWith("--DPR="))?.split("=")[1] ?? 1);
/** 快速模式：1 主题 × 1 语言、只走关键界面、不截图不导图，用来十几秒内冒烟。 */
const 快速 = process.argv.includes("--快速");
const 输出 = resolve(".gamemaker/报告/文字图集验收");
await mkdir(输出, { recursive: true });

const 主题列表 = 快速
  ? (["极光原野"] as const)
  : (["极光原野", "砖机液晶", "街机彩砖", "立体晶格"] as const);
const 语言列表: readonly ("简体中文" | "English")[] = 快速 ? ["简体中文"] : ["简体中文", "English"];

type 记录项 = {
  语言: string;
  主题: string;
  步骤: string;
  页面: string;
  图集索引数: number;
  页数: number;
  共享页: { 纹理键: string; 宽: number; 高: number; 字形数: number }[];
  纹理字节: number;
  文字字节: number;
  烘焙字号: number[];
  绘制调用: number;
  绘制批数: number;
  四边形数: number;
  内存: number;
  平均工作毫秒: number;
  平均帧间隔毫秒: number;
};

type 轮结果 = {
  语言: string;
  主题: string;
  记录: 记录项[];
  计时毫秒: number;
  错误: string[];
};

interface 页面操作 {
  页: Page;
  错误: string[];
}

/** 把「一轮」包成可独立并行的任务：自己开上下文、自己关上下文，轮次之间零共享。 */
async function 跑一轮(
  浏览器: Browser,
  语言: "简体中文" | "English",
  主题: string,
): Promise<轮结果> {
  const 起点 = performance.now();
  const 上下文 = await 浏览器.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: DPR,
  });
  const 页 = await 上下文.newPage();
  const 错误: string[] = [];
  页.on("pageerror", (错误值) => 错误.push(错误值.message));
  页.on("console", (消息) => {
    if (消息.type() === "error" && !消息.text().includes("/control?project="))
      错误.push(消息.text());
  });
  const 操作: 页面操作 = { 页, 错误 };
  const 记录表: 记录项[] = [];
  try {
    await 页.goto(地址);
    await 页.waitForFunction(() => window.__three版__ !== undefined, undefined, { timeout: 20000 });
    await 页.waitForTimeout(400);
    await 页.evaluate((值) => {
      const 语言选择 = 值 === "English" ? "English" : "简体中文";
      window.__three版__?.更新设置({ 语言: 语言选择 });
    }, 语言);
    await 页.waitForTimeout(300);
    await 进入(操作, "菜单", 主题);
    await 记录(操作, 记录表, 语言, 主题, "主菜单");
    await 遍历界面(操作, 记录表, 语言, 主题);
    await 打一局马拉松(操作, 记录表, 语言, 主题);
    if (!快速) {
      const 页数 = await 导出图集(操作, 语言, 主题);
      console.log(`  → 导出图集页 ${页数} 张（${语言}/${主题}）`);
    }
  } finally {
    await 上下文.close().catch(() => undefined);
  }
  return { 语言, 主题, 记录: 记录表, 计时毫秒: Math.round(performance.now() - 起点), 错误 };
}

const 读取统计 = async (操作: 页面操作): Promise<调试统计> => {
  const 统计 = await 操作.页.evaluate(() => window.__three版__?.读取统计());
  if (!统计) throw new Error("读取统计失败");
  return 统计;
};
const 读取状态 = async (操作: 页面操作): Promise<调试状态> => {
  const 状态 = await 操作.页.evaluate(() => window.__three版__?.读取状态());
  if (!状态) throw new Error("读取状态失败");
  return 状态;
};
const 读取界面 = async (操作: 页面操作) =>
  (await 操作.页.evaluate(() => window.__three版__?.读取界面())) ?? { 按钮: [] };
const 等待开合 = (操作: 页面操作) =>
  操作.页.waitForFunction(() => window.__three版__?.读取界面开合中?.() === false, undefined, {
    timeout: 8000,
  });
const 点按钮 = async (操作: 页面操作, 候选: readonly string[]): Promise<string | null> => {
  await 等待开合(操作);
  for (let 尝试 = 0; 尝试 < 20; 尝试++) {
    const 按钮 = (await 读取界面(操作)).按钮.find(
      (项) => 候选.includes(项.名称) && 项.可用 !== false,
    );
    if (按钮) {
      await 操作.页.mouse.click(按钮.左 + 按钮.宽 / 2, 按钮.上 + 按钮.高 / 2);
      await 操作.页.waitForTimeout(260);
      return 按钮.名称;
    }
    await 操作.页.waitForTimeout(100);
  }
  return null;
};

/** 等到可见脏层归零：按需渲染下页面刚切过去时静态层还没重画，此时读统计会读到上一页的图集。 */
const 等到重绘完成 = async (操作: 页面操作) => {
  const 截止 = Date.now() + 3000;
  while (Date.now() < 截止) {
    const 缓存统计 = (await 读取统计(操作)).图层缓存;
    if ((缓存统计.可见脏层数 ?? 0) === 0) {
      await 操作.页.waitForTimeout(150);
      return;
    }
    await 操作.页.waitForTimeout(80);
  }
};

/** 进素材场景并等到页面真的切过去、且可见层重画完：连续调用时导航会被上一个过渡丢弃。 */
const 进入 = async (操作: 页面操作, 场景: string, 主题?: string) => {
  for (let 尝试 = 0; 尝试 < 3; 尝试++) {
    await 操作.页.evaluate(
      (参数) => window.__再消一行测试__?.进入素材场景(参数.场景, 390, 844, 参数.主题),
      { 场景, 主题 },
    );
    const 截止 = Date.now() + 2500;
    while (Date.now() < 截止) {
      if ((await 读取状态(操作)).页面 === 场景) {
        await 等到重绘完成(操作);
        return 场景;
      }
      await 操作.页.waitForTimeout(100);
    }
  }
  return (await 读取状态(操作)).页面;
};

const 记录 = async (操作: 页面操作, 记录表: 记录项[], 语言: string, 主题: string, 步骤: string) => {
  const 统计 = await 读取统计(操作);
  const 状态 = await 读取状态(操作);
  const 图集 = 统计.文字图集;
  const 项: 记录项 = {
    语言,
    主题,
    步骤,
    页面: 状态.页面,
    图集索引数: 图集.图集数,
    页数: 图集.页数,
    共享页: (图集.页明细 ?? []).map((页项) => ({
      纹理键: 页项.纹理键,
      宽: 页项.宽,
      高: 页项.高,
      字形数: 页项.字形数,
    })),
    纹理字节: 统计.渲染.纹理字节,
    文字字节: 图集.纹理字节,
    烘焙字号: 图集.烘焙字号列表 ?? [],
    绘制调用: 统计.渲染.绘制调用,
    绘制批数: 统计.合批.绘制批数,
    四边形数: 统计.合批.四边形数,
    内存: 统计.内存?.已用MB ?? 0,
    平均工作毫秒: Number((统计.循环.平均工作毫秒 ?? 0).toFixed(2)),
    平均帧间隔毫秒: Number((统计.循环.平均帧间隔毫秒 ?? 0).toFixed(2)),
  };
  记录表.push(项);
  const 页描述 = 项.共享页
    .map((页项) => `${页项.纹理键}(${页项.宽}×${页项.高},${页项.字形数}字)`)
    .join(" ");
  console.log(
    `[${语言}/${主题}] ${步骤} → 页=${状态.页面} 索引=${项.图集索引数} 页=${项.页数} ` +
      `文字=${(项.文字字节 / 1024).toFixed(0)}KB draw=${项.绘制调用} 批=${项.绘制批数} ` +
      `工作=${项.平均工作毫秒}ms ${页描述}`,
  );
  return 项;
};

/** 导出当前共享图集页的像素，作为「图集里到底装了什么」的证据。 */
const 导出图集 = async (操作: 页面操作, 语言: string, 主题: string) => {
  const 快照 = await 操作.页.evaluate(() => window.__three版__?.读取文字图集快照?.() ?? []);
  const 列表 = (快照 ?? []) as { 纹理键: string; 宽: number; 高: number; 图片: string }[];
  for (const 项 of 列表) {
    const 数据 = 项.图片.split(",")[1];
    if (!数据) continue;
    await writeFile(
      join(输出, `${语言}-${主题}-${项.纹理键.replace("#", "-")}.png`),
      Buffer.from(数据, "base64"),
    );
  }
  return 列表.length;
};

const 遍历界面 = async (操作: 页面操作, 记录表: 记录项[], 语言: string, 主题: string) => {
  const 界面列表 = 快速 ? ["设置", "模式选择"] : ["设置", "成就", "排行榜", "商店", "模式选择"];
  for (const 界面 of 界面列表) {
    await 进入(操作, 界面, 主题);
    await 记录(操作, 记录表, 语言, 主题, 界面);
  }
};

/** 真实打一局马拉松：落块 → 快进到后期分数 → 暂停/继续 → 结束 → 结算 → 返回菜单。 */
const 打一局马拉松 = async (操作: 页面操作, 记录表: 记录项[], 语言: string, 主题: string) => {
  const 页 = 操作.页;
  await 进入(操作, "模式选择", 主题);
  const 开始 = await 点按钮(操作, ["模式:马拉松"]);
  assert.ok(开始, `模式选择里找不到马拉松入口（${语言}/${主题}）`);
  await 页.waitForFunction(() => window.__three版__?.读取状态().页面 === "对局", undefined, {
    timeout: 8000,
  });
  await 页.waitForTimeout(400);
  // 落块：让棋盘、消行提示、分数位宽都真实出现过。
  const 落块次数 = 快速 ? 6 : 14;
  for (let 次 = 0; 次 < 落块次数; 次++) {
    await 页.evaluate(() => window.__再消一行测试__?.硬降());
    await 页.waitForTimeout(110);
  }
  await 页.evaluate(() =>
    window.__再消一行测试__?.快进后期({ 消行数: 40, 分数: 12345, 最长连击: 3, 堆叠行: 8 }),
  );
  await 页.waitForTimeout(400);
  await 记录(操作, 记录表, 语言, 主题, "对局:马拉松");
  if (!快速) await 页.screenshot({ path: join(输出, `${语言}-${主题}-对局.png`) });

  await 页.evaluate(() => window.__再消一行测试__?.设置暂停(true));
  await 页.waitForTimeout(360);
  await 记录(操作, 记录表, 语言, 主题, "暂停面板");
  if (!快速) await 页.screenshot({ path: join(输出, `${语言}-${主题}-暂停.png`) });
  await 页.evaluate(() => window.__再消一行测试__?.设置暂停(false));
  await 页.waitForTimeout(300);

  await 页.evaluate(() => window.__再消一行测试__?.结束当前对局());
  await 页.waitForTimeout(700);
  await 记录(操作, 记录表, 语言, 主题, "结算");
  if (!快速) await 页.screenshot({ path: join(输出, `${语言}-${主题}-结算.png`) });

  for (let 次 = 0; 次 < 3; 次++) {
    if ((await 读取状态(操作)).页面 === "菜单") break;
    if (!(await 点按钮(操作, ["返回主菜单", "返回"]))) break;
    await 等待开合(操作);
    await 页.waitForTimeout(200);
  }
  await 记录(操作, 记录表, 语言, 主题, "回菜单");
};

const 任务列表 = 语言列表.flatMap((语言) => 主题列表.map((主题) => ({ 语言, 主题 })));
const 并发 = 解析并发(process.argv, 任务列表.length);
console.log(`文字图集验收：${任务列表.length} 轮，并发 ${并发}（默认 ${默认并发数}）`);

const 浏览器 = await chromium.launch({ channel: "chrome" });
try {
  const 各轮 = await 并行池(任务列表, 并发, (任务) => 跑一轮(浏览器, 任务.语言, 任务.主题));
  const 记录表 = 各轮.flatMap((轮) => 轮.记录);
  const 页面错误 = 各轮.flatMap((轮) => 轮.错误);
  const 最终 = 记录表.at(-1);
  const 汇总 = {
    地址,
    DPR,
    并发,
    页面错误,
    记录: 记录表,
    每轮峰值: {
      页数: Math.max(...记录表.map((项) => 项.页数)),
      共享页张数: Math.max(...记录表.map((项) => 项.共享页.length)),
      最大边: Math.max(
        ...记录表.map((项) => Math.max(0, ...项.共享页.map((页项) => Math.max(页项.宽, 页项.高)))),
      ),
      文字字节: Math.max(...记录表.map((项) => 项.文字字节)),
      绘制调用: Math.max(...记录表.map((项) => 项.绘制调用)),
    },
    最终图集: 最终 ? { 页数: 最终.页数, 文字字节: 最终.文字字节 } : null,
  };
  await writeFile(
    join(输出, DPR === 1 ? "汇总.json" : `汇总-DPR${DPR}.json`),
    JSON.stringify(汇总, null, 2),
    "utf8",
  );

  const 行 = [
    "| 语言 | 主题 | 步骤 | 页面 | 图集索引 | 页数 | 共享页(宽×高/字形) | 文字KB | 总纹理KB | draw | 批 | 工作ms |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
    ...记录表.map(
      (项) =>
        `| ${项.语言} | ${项.主题} | ${项.步骤} | ${项.页面} | ${项.图集索引数} | ${项.页数} | ` +
        `${项.共享页.map((页项) => `${页项.纹理键}:${页项.宽}×${页项.高}/${页项.字形数}字`).join("<br>")} | ` +
        `${(项.文字字节 / 1024).toFixed(0)} | ${(项.纹理字节 / 1024).toFixed(0)} | ${项.绘制调用} | ${项.绘制批数} | ${项.平均工作毫秒} |`,
    ),
  ];
  await writeFile(join(输出, "汇总.md"), 行.join("\n"), "utf8");

  const 轮次合计毫秒 = 各轮.reduce((总, 轮) => 总 + 轮.计时毫秒, 0);
  console.log(
    "耗时分布:",
    JSON.stringify(
      {
        模式: 快速 ? "快速" : "完整",
        并发,
        串行合计毫秒: 轮次合计毫秒,
        墙钟毫秒: Math.round(Math.max(...各轮.map((轮) => 轮.计时毫秒))),
        记录步数: 记录表.length,
        各轮: 各轮.map((轮) => ({ 标签: `${轮.语言}/${轮.主题}`, 毫秒: 轮.计时毫秒 })),
      },
      null,
      2,
    ),
  );
  console.log("\n每轮峰值:", JSON.stringify(汇总.每轮峰值));
  console.log("页面错误:", JSON.stringify(页面错误));
  assert.equal(页面错误.length, 0, `页面报错：${页面错误.join("；")}`);
  assert.ok(汇总.每轮峰值.页数 <= 5, `文字页数异常：${汇总.每轮峰值.页数}`);
  assert.ok(汇总.每轮峰值.最大边 <= 2048, `单页超过 2048：${汇总.每轮峰值.最大边}`);
  assert.ok(汇总.每轮峰值.绘制调用 <= 24, `绘制调用异常：${汇总.每轮峰值.绘制调用}`);
} finally {
  await 浏览器.close();
}
