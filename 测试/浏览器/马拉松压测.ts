import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { chromium, type Page } from "playwright";

/**
 * 马拉松压测：把对局快进到「后期」（等级/分数/消行/堆叠都是真实后期量级），
 * 让页内自动落子跑 N 秒，读 `__three版__.压测` 的 1 秒窗口时间线（帧间隔、整帧工作、
 * 长任务、全量帧、文字图集/合批/纹理/内存账本），最后给「首窗 vs 末窗」的退化比。
 *
 * 用法：
 *   bun 测试/浏览器/马拉松压测.ts [地址] [--秒数=120] [--消行数=300] [--间隔毫秒=90]
 *     [--堆叠行=8] [--DPR=1] [--预热=3] [--不判定]
 *
 * 判定（默认开）：末窗帧间隔 P95 / 首窗帧间隔 P95 > 1.35 视为「后期显著变慢」，退出码 1。
 * 报告写 .gamemaker/报告/马拉松压测/<时间戳>/结果.json 与 原始.cpuprofile。
 */

const 参数 = process.argv.slice(2);
const 地址 = 参数.find((项) => !项.startsWith("--")) ?? "http://127.0.0.1:3004/";
const 取值 = (键: string, 默认: number): number => {
  const 项 = 参数.find((值) => 值.startsWith(`--${键}=`));
  if (!项) return 默认;
  const 数 = Number(项.split("=")[1]);
  return Number.isFinite(数) ? 数 : 默认;
};
const 有开关 = (键: string) => 参数.includes(`--${键}`);

const 秒数 = 取值("秒数", 120);
const 消行数 = 取值("消行数", 300);
const 堆叠行 = 取值("堆叠行", 8);
const 间隔毫秒 = 取值("间隔毫秒", 90);
const 预热秒 = 取值("预热", 3);
const DPR = 取值("DPR", 1);
const 退化阈值 = 取值("退化阈值", 1.35);
/** 分数口径：默认按消行数折算；传 `--分数=` 可单独放大分数（隔离「分数位数」变量）。 */
const 分数 = 取值("分数", 消行数 * 2000);

const 报告根 = resolve(".gamemaker/报告/马拉松压测");
const 时间戳 = new Date().toISOString().replace(/[:.]/g, "-");
const 报告目录 = join(报告根, 时间戳);
await mkdir(报告目录, { recursive: true });

type 压测读回 = { 点: unknown[]; 汇总: unknown };

async function 点击(页: Page, 名称: string) {
  await 页.waitForFunction(
    (名) => {
      const 快照 = window.__GAMEMAKER_TEST__?.getSnapshot();
      return Boolean(快照?.interactives.some((项) => 项.name === 名 && 项.enabled));
    },
    名称,
    { timeout: 15000 },
  );
  const 点 = await 页.evaluate((名) => {
    const 桥 = window.__GAMEMAKER_TEST__;
    const 快照 = 桥?.getSnapshot();
    const 项 = 快照?.interactives.find((项) => 项.name === 名 && 项.enabled);
    const 布 = document.querySelector("canvas")?.getBoundingClientRect();
    if (!项?.bounds || !布 || !快照) throw new Error("找不到真实按钮：" + 名);
    return {
      x: 布.x + ((项.bounds.x + 项.bounds.width / 2) / 快照.width) * 布.width,
      y: 布.y + ((项.bounds.y + 项.bounds.height / 2) / 快照.height) * 布.height,
    };
  }, 名称);
  await 页.mouse.click(点.x, 点.y);
}

/**
 * 浏览器默认无痕头，但必须关掉「后台/被遮挡页面节流」：否则 rAF 会被限到 30fps，
 * 帧间隔翻倍会被误读成游戏后期掉帧。
 */
const 浏览器 = await chromium.launch({
  channel: "chrome",
  headless: !有开关("可见"),
  args: [
    "--disable-background-timer-throttling",
    "--disable-renderer-backgrounding",
    "--disable-backgrounding-occluded-windows",
    "--disable-features=CalculateNativeWinOcclusion",
  ],
});
const 页面错误: string[] = [];
try {
  const 页 = await 浏览器.newPage({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: DPR,
  });
  页.on("pageerror", (错误) => 页面错误.push(错误.message));
  页.on("console", (消息) => {
    if (消息.type() === "error") 页面错误.push(消息.text());
  });

  await 页.goto(地址);
  await 页.waitForFunction(() => window.__GAMEMAKER_TEST__ !== undefined, undefined, {
    timeout: 30000,
  });
  await 点击(页, "开始游戏");
  await 点击(页, "模式:马拉松");
  await 页.waitForFunction(
    () =>
      window.__three版__?.读取状态().入场秒 === null &&
      window.__three版__?.读取状态().阶段 === "进行中",
    undefined,
    { timeout: 20000 },
  );

  // 快进后期 + 自动对战 + 打开采样；三步在同一帧完成，避免预热窗口被拆散。
  await 页.evaluate(
    (配置) => {
      const 桥 = window.__three版__;
      const 测试 = window.__再消一行测试__;
      if (!桥?.压测) throw new Error("压测采样未挂载（确认 GM_TEST=1 且启动层已接线）");
      if (!测试?.快进后期 || !测试?.开始自动对战) throw new Error("压测控制未挂载");
      桥.压测.重置();
      测试.快进后期({
        消行数: 配置.消行数,
        分数: 配置.分数,
        堆叠行: 配置.堆叠行,
        最长连击: 24,
      });
      测试.开始自动对战({ 间隔秒: 配置.间隔毫秒 / 1000 });
    },
    { 消行数, 分数, 堆叠行, 间隔毫秒 },
  );

  const 会话 = await 页.context().newCDPSession(页);
  await 会话.send("Profiler.enable");
  await 会话.send("Profiler.setSamplingInterval", { interval: 1000 });
  await 会话.send("Profiler.start");
  await 页.waitForTimeout(预热秒 * 1000);
  // 预热后的正式窗口：先清掉预热点，再采满 秒数。
  await 页.evaluate(() => window.__three版__?.压测?.重置());
  await 页.waitForTimeout(秒数 * 1000);
  const { profile } = await 会话.send("Profiler.stop");

  const 状态 = await 页.evaluate(() => ({
    状态: window.__three版__?.读取状态(),
    统计: window.__three版__?.读取统计(),
  }));
  const 读回 = (await 页.evaluate(() => {
    const 压测 = window.__three版__?.压测;
    return (压测?.读取() ?? null) as 压测读回 | null;
  })) as 压测读回 | null;
  await 页.evaluate(() => window.__再消一行测试__?.停止自动对战?.());
  // 截图留证：压测同时要能被人工看一眼对局画面（震屏层变换改动的回归证据）。
  await 页.screenshot({ path: join(报告目录, "对局截图.png") });

  await writeFile(join(报告目录, "原始.cpuprofile"), JSON.stringify(profile));
  const 结果 = {
    参数: { 地址, 秒数, 消行数, 堆叠行, 间隔毫秒, DPR, 预热秒 },
    环境: await 页.evaluate(() => ({
      设备像素比: window.devicePixelRatio,
      视口: { 宽: innerWidth, 高: innerHeight },
      UA: navigator.userAgent,
    })),
    对局: 状态.状态,
    统计: 状态.统计,
    压测: 读回,
    页面错误,
  };
  await writeFile(join(报告目录, "结果.json"), JSON.stringify(结果, null, 2));

  const 汇总 = 读回?.汇总 as
    | {
        秒数: number;
        帧数: number;
        帧间隔: {
          平均: number | null;
          P50: number | null;
          P95: number | null;
          P99: number | null;
          最大: number | null;
        };
        整帧工作: { 平均: number | null; P95: number | null; 最大: number | null };
        长任务帧数: number;
        慢帧数: number;
        全量帧数: number;
        首窗帧间隔P95: number | null;
        末窗帧间隔P95: number | null;
        退化比: number | null;
        计数: Record<string, number>;
      }
    | undefined;

  const 点 = (读回?.点 ?? []) as {
    秒数: number;
    帧间隔: { P95: number | null };
    整帧工作: { P95: number | null };
    长任务帧数: number;
    资源: {
      内存已用MB: number | null;
      文字纹理字节: number;
      缓冲字节: number;
      纹理字节: number;
      待确认退役图集数: number;
    };
  }[];
  const 首点 = 点.at(0);
  const 末点 = 点.at(-1);
  const 内存增长 =
    首点?.资源.内存已用MB != null && 末点?.资源.内存已用MB != null
      ? Number((末点.资源.内存已用MB - 首点.资源.内存已用MB).toFixed(2))
      : null;
  const 文字增长 = 首点 && 末点 ? 末点.资源.文字纹理字节 - 首点.资源.文字纹理字节 : null;
  const 缓冲增长 = 首点 && 末点 ? 末点.资源.缓冲字节 - 首点.资源.缓冲字节 : null;
  const 待退役增长 = 首点 && 末点 ? 末点.资源.待确认退役图集数 - 首点.资源.待确认退役图集数 : null;

  const 帧率 = 汇总?.帧间隔.平均 ? Number((1000 / 汇总.帧间隔.平均).toFixed(1)) : null;
  const 退化 = 汇总?.退化比 ?? null;
  const 判定通过 = 退化 === null || 退化 <= 退化阈值;
  /** 全量失效帧是「所有可见层重画」：偶发可以接受，长期占比高说明图集/图层脏标记没收敛。 */
  const 全量帧比例 = 汇总 && 汇总.帧数 > 0 ? 汇总.全量帧数 / 汇总.帧数 : 0;
  const 全量帧通过 = 全量帧比例 <= 0.05;
  /** 退役图集不释放会持续吃显存：末窗仍 >0 视为释放链没收敛。 */
  const 末点待退役 = 末点?.资源.待确认退役图集数;
  const 退役通过 = 末点待退役 === undefined || 末点待退役 === 0;

  const 摘要 = [
    `# 马拉松后期压测`,
    ``,
    `- 参数：秒数 ${汇总?.秒数.toFixed(1) ?? "-"} / 消行 ${消行数} / 堆叠 ${堆叠行} 行 / 落子间隔 ${间隔毫秒}ms / 预热 ${预热秒}s`,
    `- 对局：等级 ${(状态.状态 as { 等级?: number })?.等级 ?? "-"}，分数 ${(状态.状态 as { 分数?: number })?.分数 ?? "-"}，落块 ${(状态.统计 as { 对局统计?: { 落块数?: number } })?.对局统计?.落块数 ?? "-"}，消行 ${(状态.统计 as { 对局统计?: { 消行次数?: number } })?.对局统计?.消行次数 ?? "-"}`,
    `- 帧间隔：平均 ${汇总?.帧间隔.平均?.toFixed(2) ?? "-"} ms（≈${帧率 ?? "-"} fps），P50 ${汇总?.帧间隔.P50?.toFixed(2) ?? "-"}，P95 ${汇总?.帧间隔.P95?.toFixed(2) ?? "-"}，P99 ${汇总?.帧间隔.P99?.toFixed(2) ?? "-"}，最大 ${汇总?.帧间隔.最大?.toFixed(2) ?? "-"}`,
    `- 整帧工作：平均 ${汇总?.整帧工作.平均?.toFixed(2) ?? "-"} ms，P95 ${汇总?.整帧工作.P95?.toFixed(2) ?? "-"}，最大 ${汇总?.整帧工作.最大?.toFixed(2) ?? "-"}`,
    `- 卡顿：>50ms ${汇总?.长任务帧数 ?? "-"} 帧，>33.4ms ${汇总?.慢帧数 ?? "-"} 帧；全量重绘帧 ${汇总?.全量帧数 ?? "-"}（占帧数 ${(全量帧比例 * 100).toFixed(1)}%，上限 5%）${全量帧通过 ? "" : " ❌"}`,
    `- 图集释放：末窗待确认退役图集 ${末点待退役 ?? "-"} 张${退役通过 ? "" : " ❌（退役链未收敛）"}`,
    `- 退化：首窗 P95 ${汇总?.首窗帧间隔P95?.toFixed(2) ?? "-"} → 末窗 P95 ${汇总?.末窗帧间隔P95?.toFixed(2) ?? "-"}，退化比 ${退化?.toFixed(2) ?? "-"}（阈值 ${退化阈值}）${判定通过 ? "" : " ❌"}`,
    `- 资源增长：内存 ${内存增长 ?? "-"} MB，文字图集 ${文字增长 ?? "-"} B，合批缓冲 ${缓冲增长 ?? "-"} B，待退役图集 ${待退役增长 ?? "-"} 张`,
    `- 事件计数：${JSON.stringify(汇总?.计数 ?? {})}`,
    `- 报告：${报告目录}`,
  ].join("\n");
  await writeFile(join(报告目录, "摘要.md"), 摘要);
  console.log(摘要);

  if (!读回) throw new Error("压测采样在运行中丢失");
  if (页面错误.length) {
    console.error(`页面错误 ${页面错误.length} 条：${页面错误.slice(0, 5).join("；")}`);
    process.exitCode = 1;
  } else if (!有开关("不判定") && (!判定通过 || !全量帧通过 || !退役通过)) {
    if (!判定通过) console.error(`后期退化比 ${退化?.toFixed(2)} 超过阈值 ${退化阈值}`);
    if (!全量帧通过) console.error(`全量失效帧占比 ${(全量帧比例 * 100).toFixed(1)}% 超过 5%`);
    if (!退役通过) console.error(`待确认退役图集 ${末点待退役} 张未释放`);
    process.exitCode = 1;
  }
} finally {
  await 浏览器.close();
}
