import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { chromium } from "playwright";
import type { 调试状态, 调试统计 } from "../../代码/应用/启动";
import type { 界面快照, 界面按钮快照 } from "../../代码/应用/接口/上下文";
import type { 对局快照 } from "../../代码/页面/对局/对局页面";

/**
 * 《再消一行》Three 版完整功能实机验收：390×844 DPR1，只截当前视口。
 * 覆盖：主界面 → 设置/成就/排行榜/商店导航与返回 → 四模式开始 → 落块/计分 →
 * 暂停/继续 → 结束 → 结算 → 重新开始 → 返回主菜单；设置项持久化；商店购买/穿戴；
 * 音频静音；性能数据（首帧/平均帧间隔/单帧脚本耗时/内存/绘制调用/四边形数）。
 * 页面操作通过调试桥 `读取界面()` 的按钮名称真实点击，不硬编码坐标。
 * 结果写 .gamemaker/报告/three版/结果.json 与截图。
 */

const 地址 = process.argv[2] ?? "http://127.0.0.1:3000";
/** 默认与历史证据一致用 DPR1；P3 手机验收要求 DPR2，可用 --DPR=2 复跑。 */
const DPR = Number(process.argv.find((项) => 项.startsWith("--DPR="))?.split("=")[1] ?? 1);
const 输出 = resolve(".gamemaker/报告/three版");
await mkdir(输出, { recursive: true });

type 验收记录 = {
  步骤: string;
  页面?: string;
  场景栈?: string[];
  说明?: string;
};

const 浏览器 = await chromium.launch({ channel: "chrome" });
try {
  const 页 = await 浏览器.newPage({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: DPR,
  });
  const 页面错误: string[] = [];
  let 当前动作 = "启动";
  const 控制台日志: string[] = [];
  页.on("pageerror", (错误) => 页面错误.push(`[${当前动作}] ${错误.message}`));
  /** GM 开发服务器的控制通道与本页无关；连不上只说明没开看板，不算产品错误。 */
  const 是环境噪声 = (文本: string) =>
    文本.includes("/control?project=") || 文本.includes("ERR_CONNECTION_REFUSED");
  页.on("console", (消息) => {
    if (消息.type() === "error" && !是环境噪声(消息.text())) 页面错误.push(消息.text());
    else if (消息.type() !== "error") 控制台日志.push(消息.text());
  });

  const 准备 = async () => {
    await 页.goto(地址);
    try {
      await 页.waitForFunction(() => window.__three版__ !== undefined, undefined, {
        timeout: 20000,
      });
    } catch {
      throw new Error(`游戏未就绪：${页面错误.join("；")}`);
    }
    await 页.waitForTimeout(400);
    // 页内收集 AggregateError 的内层原因：框架只把外层消息抛到 window，重载后需重装。
    await 页.evaluate(() => {
      const 盒 = window as unknown as { __错误明细?: string[] };
      if (盒.__错误明细) return;
      盒.__错误明细 = [];
      window.addEventListener("error", (事件) => {
        const 错误 = (事件 as ErrorEvent).error as (Error & { errors?: unknown[] }) | undefined;
        for (const 内 of 错误?.errors ?? []) {
          const 项 = 内 as { message?: string; stack?: string };
          盒.__错误明细?.push(
            (项.stack ?? 项.message ?? "").split(String.fromCharCode(10)).slice(0, 4).join(" ⏎ "),
          );
        }
      });
    });
  };
  await 准备();
  /** 页内收集 AggregateError 的内层原因：框架只把外层消息抛到 window。 */
  const 安装错误明细 = async () => {
    await 页.evaluate(() => {
      const 盒 = window as unknown as { __错误明细?: string[] };
      if (盒.__错误明细) return;
      盒.__错误明细 = [];
      window.addEventListener("error", (事件) => {
        const 错误 = (事件 as ErrorEvent).error as (Error & { errors?: unknown[] }) | undefined;
        for (const 内 of 错误?.errors ?? []) {
          const 项 = 内 as { message?: string; stack?: string };
          盒.__错误明细?.push(
            (项.stack ?? 项.message ?? "").split(String.fromCharCode(10)).slice(0, 4).join(" ⏎ "),
          );
        }
      });
    });
  };
  const 读取错误明细 = async (): Promise<string[]> =>
    页.evaluate(() => (window as unknown as { __错误明细?: string[] }).__错误明细 ?? []);
  await 安装错误明细();

  // —— 调试桥读取封装（全部走页面真实对象，类型来自 启动.ts 的全局声明）——
  const 读取状态 = async (): Promise<调试状态> => {
    const 状态 = await 页.evaluate(() => window.__three版__?.读取状态());
    if (!状态) throw new Error("读取状态失败");
    return 状态;
  };
  const 读取统计 = async (): Promise<调试统计> => {
    const 统计 = await 页.evaluate(() => window.__three版__?.读取统计());
    if (!统计) throw new Error("读取统计失败");
    return 统计;
  };
  const 读取界面 = async (): Promise<界面快照> => {
    const 界面 = await 页.evaluate(() => window.__three版__?.读取界面());
    return 界面 ?? { 按钮: [] };
  };
  const 读取设置 = async () => {
    const 设置 = await 页.evaluate(() => window.__three版__?.读取设置());
    if (!设置) throw new Error("读取设置失败");
    return 设置;
  };
  const 更新设置 = async (变化: Partial<Awaited<ReturnType<typeof 读取设置>>>) => {
    await 页.evaluate((项) => window.__three版__?.更新设置(项), 变化);
    await 页.waitForTimeout(120);
  };
  const 读取音频 = async () => {
    const 音频 = await 页.evaluate(() => window.__three版__?.读取音频());
    if (!音频) throw new Error("读取音频失败");
    return 音频;
  };
  const 增加金币 = async (数量: number) => {
    await 页.evaluate((值) => window.__three版__?.增加金币(值), 数量);
    await 页.waitForTimeout(120);
  };
  const 测试桥 = {
    结束当前对局: () => 页.evaluate(() => window.__再消一行测试__?.结束当前对局()),
    设置暂停: () => 页.evaluate(() => window.__再消一行测试__?.设置暂停(true)),
    准备单行消除: () => 页.evaluate(() => window.__再消一行测试__?.准备单行消除()),
    硬降: () => 页.evaluate(() => window.__再消一行测试__?.硬降()),
  };

  const 步骤: 验收记录[] = [];
  const 记录步骤 = async (名称: string, 说明?: string) => {
    const 状态 = await 读取状态();
    console.log(`[步骤] ${名称} → 页面=${状态.页面} 栈=${状态.场景栈.join("/")}`);
    步骤.push({ 步骤: 名称, 页面: 状态.页面, 场景栈: 状态.场景栈, 说明 });
  };
  const 读取快照字段 = async (): Promise<对局快照 | null> => {
    const 状态 = await 读取状态();
    return 状态 ? (状态 as 对局快照) : null;
  };
  const 等待状态 = async (
    判断: (状态: 调试状态) => boolean,
    描述: string,
    超时毫秒 = 6000,
  ): Promise<调试状态> => {
    const 开始 = Date.now();
    while (Date.now() - 开始 < 超时毫秒) {
      const 状态 = await 读取状态();
      if (判断(状态)) return 状态;
      await 页.waitForTimeout(80);
    }
    const 最后 = await 读取状态();
    throw new Error(`等待「${描述}」超时，当前：${JSON.stringify(最后)}`);
  };
  const 等待页面 = (页面: string) => 等待状态((状态) => 状态.页面 === 页面, `页面 ${页面}`);
  const 等待覆盖 = (覆盖: string) =>
    等待状态((状态) => 状态.场景栈.at(-1) === 覆盖, `覆盖页 ${覆盖}`);
  const 等待回到对局 = () =>
    等待状态((状态) => 状态.页面 === "对局" && 状态.场景栈.at(-1) === "对局", "回到对局");
  const 查找按钮 = async (名称: string, 超时毫秒 = 8000): Promise<界面按钮快照> => {
    const 开始 = Date.now();
    let 界面 = await 读取界面();
    while (!界面.按钮.some((项) => 项.名称 === 名称)) {
      if (Date.now() - 开始 > 超时毫秒) {
        const 状态 = await 读取状态();
        throw new Error(
          `等待按钮「${名称}」超时（页面=${状态.页面} 栈=${状态.场景栈.join("/")}）：` +
            界面.按钮.map((项) => 项.名称).join("、"),
        );
      }
      await 页.waitForTimeout(80);
      界面 = await 读取界面();
    }
    const 按钮 = 界面.按钮.find((项) => 项.名称 === 名称);
    if (!按钮) {
      throw new Error(
        `页面缺少按钮「${名称}」，现有：${界面.按钮.map((项) => 项.名称).join("、")}`,
      );
    }
    return 按钮;
  };
  /** 确认纸页里的可用按钮（按名字查，避免依赖固定几何）。 */
  const 找弹层按钮 = async (候选: readonly string[]) => {
    const 界面 = await 读取界面();
    return 界面.按钮.find((项) => 候选.includes(项.名称) && 项.可用 !== false);
  };
  /** 过渡期间框架会丢弃点击，点之前先等开合结束，避免偶发空点。 */
  const 等待开合结束 = () =>
    页.waitForFunction(() => window.__three版__?.读取界面开合中?.() === false, undefined, {
      timeout: 8000,
    });
  const 点击按钮 = async (名称: string) => {
    当前动作 = `点 ${名称}`;
    await 等待开合结束();
    // 结算 3 秒重开锁等会把按钮标成不可用：先等它可用再点。
    let 按钮 = await 查找按钮(名称);
    if (按钮.可用 === false) {
      const 开始 = Date.now();
      while (按钮.可用 === false && Date.now() - 开始 < 5000) {
        await 页.waitForTimeout(120);
        按钮 = await 查找按钮(名称);
      }
      if (按钮.可用 === false) throw new Error(`按钮「${名称}」一直不可用`);
    }
    await 页.mouse.click(按钮.左 + 按钮.宽 / 2, 按钮.上 + 按钮.高 / 2);
    await 页.waitForTimeout(200);
  };
  const 截图 = async (名称: string) => {
    await 等待开合结束();
    await 页.waitForTimeout(200);
    await 页.screenshot({ path: join(输出, `${名称}.png`) });
  };
  const 查找按钮名 = async (名称: string) => (await 读取界面()).按钮.some((项) => 项.名称 === 名称);
  const 等待按钮 = async (名称: string, 超时毫秒 = 6000) => {
    const 开始 = Date.now();
    while (Date.now() - 开始 < 超时毫秒) {
      if (await 查找按钮名(名称)) return;
      await 页.waitForTimeout(80);
    }
    throw new Error(
      `等待按钮「${名称}」超时，现有：${(await 读取界面()).按钮.map((项) => 项.名称).join("、")}`,
    );
  };
  /** 按快照坐标直接点，不再二次查名：过渡中节点会短暂消失，重查会白等到超时。 */
  const 点快照 = async (项: 界面按钮快照) => {
    await 等待开合结束();
    await 页.mouse.click(项.左 + 项.宽 / 2, 项.上 + 项.高 / 2);
    await 页.waitForTimeout(260);
  };
  /**
   * 回到菜单根态（页面=菜单）：从子页/模式选择/排行榜逐层退回，不假设栈深。
   * 每次点完必须等到「页面真的换了」再重读快照：菜单页整屏都是「轻点进纯享」的手势，
   * 拿切页前的旧快照再点一次「返回」，那一下会落到菜单背景上把纯享推上来。
   */
  const 回到菜单态 = async () => {
    当前动作 = "回到菜单态";
    const 开始 = Date.now();
    while (Date.now() - 开始 < 15000) {
      await 等待开合结束();
      const 状态 = await 读取状态();
      if (状态.页面 === "菜单") return;
      const 界面 = await 读取界面();
      const 出口 =
        界面.按钮.find((项) => 项.名称 === "返回主菜单") ??
        界面.按钮.find((项) => 项.名称 === "返回");
      if (!出口) {
        await 页.waitForTimeout(150);
        continue;
      }
      const 点击时页面 = 状态.页面;
      await 点快照(出口);
      const 等切换 = Date.now();
      while (Date.now() - 等切换 < 6000) {
        if ((await 读取状态()).页面 !== 点击时页面) break;
        await 页.waitForTimeout(100);
      }
    }
    const 最后 = await 读取状态();
    throw new Error(
      `回不到菜单根态：页面=${最后.页面} 栈=${最后.场景栈.join("/")} 按钮=` +
        `${(await 读取界面()).按钮.map((项) => 项.名称).join("、")}`,
    );
  };

  const 错误检查点 = async (标签: string) => {
    const 明细 = await 读取错误明细();
    console.log(`[错误检查点] ${标签} → 累计=${页面错误.length} 本段=${明细.length}`);
    for (const 项 of 明细) console.log("   -", 项.split(" ⏎ ")[0]);
    await 页.evaluate(() => ((window as unknown as { __错误明细?: string[] }).__错误明细 = []));
  };

  let 统计 = await 读取统计();

  // —— 1) 主界面（菜单态 → 模式选择态 → 返回） ——
  const 主界面 = await 等待页面("菜单");
  assert.equal(主界面.场景栈.at(-1), "菜单");
  await 等待按钮("开始游戏");
  await 截图("01-主界面");
  await 记录步骤("主界面可见（菜单态）");
  await 点击按钮("开始游戏");
  await 等待按钮("返回");
  await 截图("01b-模式选择");
  await 记录步骤("开始游戏 → 模式选择");
  await 点击按钮("返回");
  await 等待按钮("开始游戏");
  await 记录步骤("模式选择 → 返回菜单态");

  // —— 2) 子页面导航与返回（设置/成就）——
  for (const 子页 of ["设置", "成就"] as const) {
    await 点击按钮(子页);
    await 等待页面(子页);
    await 记录步骤(`主界面 → ${子页}`);
    await 点击按钮("返回主菜单");
    await 等待页面("菜单");
    await 回到菜单态();
    await 记录步骤(`${子页} → 主界面`);
  }

  // —— 2a) 旅行商店：四地点 × 六部位、单件/整套、余额不足、遮罩/取消与穿戴闭环 ——
  const 金币数 = async () => (await 读取统计()).金币;
  const 当前主题 = async () => (await 读取设置()).主题选择;
  const 外观搭配 = async () => (await 读取设置()).外观搭配 ?? {};
  const 字段值 = (文字: readonly string[] | undefined, 前缀: string) =>
    文字?.find((行) => 行.startsWith(前缀))?.slice(前缀.length) ?? "";
  const 商店文字 = async () => (await 读取界面()).文字 ?? [];
  const 已购数 = async () => Number(字段值(await 商店文字(), "已购:"));
  const 单件价 = async () => Number(字段值(await 商店文字(), "单件价:"));
  const 整套价 = async () => Number(字段值(await 商店文字(), "整套价:"));
  const 目录滚动 = async () => Number(字段值(await 商店文字(), "目录滚动:"));
  const 选中地点 = async (地点: string) => {
    await 点击按钮(`商店地点:${地点}`);
    assert.equal(字段值(await 商店文字(), "地点:"), 地点, `目录应切到 ${地点}`);
  };
  const 选中部位 = async (部位: string) => {
    await 点击按钮(`商店部位:${部位}`);
    assert.equal(字段值(await 商店文字(), "部位:"), 部位, `部位应切到 ${部位}`);
  };
  const 确认按钮 = async () => (await 读取界面()).按钮.find((项) => 项.名称 === "确认交易");
  const 确认可用 = async () => (await 确认按钮())?.可用 !== false;
  const 确认纸页开着 = async () => (await 读取界面()).按钮.some((项) => 项.名称 === "确认交易");
  const 开确认 = async (名称: string) => {
    await 点击按钮(名称);
    await 等待按钮("确认交易");
    assert.ok(await 找弹层按钮(["取消交易"]), `打开确认纸页后应可取消：${名称}`);
  };

  await 点击按钮("商店");
  await 等待页面("商店");
  await 记录步骤("主界面 → 商店（旅行收藏：四地点六部位）");
  assert.equal(await 金币数(), 120, "初始金币应为 120");

  // 目录与部位：四个地点横向排布，六个部位沿用原布局。
  const 目录名 = (await 读取界面()).按钮
    .map((项) => 项.名称)
    .filter((名) => 名.startsWith("商店地点:"));
  assert.deepEqual(
    目录名,
    ["商店地点:极光原野", "商店地点:砖机液晶", "商店地点:街机彩砖", "商店地点:立体晶格"],
    `商店地点目录不符：${目录名.join("、")}`,
  );
  const 部位名 = (await 读取界面()).按钮
    .map((项) => 项.名称)
    .filter((名) => 名.startsWith("商店部位:"));
  assert.deepEqual(
    部位名,
    [
      "商店部位:静态背景",
      "商店部位:动态背景",
      "商店部位:界面样式",
      "商店部位:方块外观",
      "商店部位:音效套装",
      "商店部位:音乐",
    ],
    `商店部位按钮不符：${部位名.join("、")}`,
  );
  await 查找按钮("穿戴:极光原野.方块外观");
  await 查找按钮("穿戴:极光原野.整套");
  await 查找按钮("商店:纯享");
  await 查找按钮("返回主菜单");
  const 默认文字 = await 商店文字();
  assert.equal(字段值(默认文字, "地点:"), "极光原野");
  assert.equal(字段值(默认文字, "部位:"), "方块外观");
  assert.equal(字段值(默认文字, "已购:"), "6", "默认主题六个部位应全免费");
  assert.equal(字段值(默认文字, "单件价:"), "0");
  assert.equal(字段值(默认文字, "整套价:"), "0");
  assert.equal(字段值(默认文字, "确认:"), "无");
  assert.equal(字段值(默认文字, "动态:"), "true");
  assert.ok(Number.isFinite(await 目录滚动()), "商店快照应带目录滚动偏移");
  await 截图("05-商店-默认四地点六部位");
  await 记录步骤("商店：四地点目录、六部位、原布局与默认全套免费");

  // 初始 120 币买不起 510 的整套：纸页照开，但确认禁用、不扣币。
  await 选中地点("砖机液晶");
  assert.equal(await 已购数(), 0, "砖机液晶初始不可拥有");
  assert.equal(await 单件价(), 120, "砖机方块外观单件价应为 120");
  assert.equal(await 整套价(), 510, "砖机整套价应为 510");
  const 初始金币 = await 金币数();
  await 开确认("购买:砖机液晶.整套");
  assert.equal(字段值(await 商店文字(), "确认:"), "整套:510");
  assert.equal(await 确认可用(), false, "余额不足时整套确认应禁用");
  const 禁用确认 = await 确认按钮();
  assert.ok(禁用确认, "余额不足也应打开确认纸页");
  await 点快照(禁用确认);
  assert.equal(await 金币数(), 初始金币, "确认禁用时不应扣币");
  assert.equal(await 已购数(), 0, "确认禁用时不应授予部位");
  assert.equal(await 当前主题(), "极光原野", "确认禁用时主题不应变化");
  await 截图("05a-商店-整套余额不足");
  await 点击按钮("取消交易");
  assert.ok(!(await 确认纸页开着()), "取消后纸页应关闭");
  await 记录步骤("整套 510 余额不足：纸页打开、确认禁用、不扣币");

  await 增加金币(5000);
  assert.equal(await 金币数(), 初始金币 + 5000, "增加金币应即时到账");
  const 钱前 = await 金币数();

  // 遮罩关闭、纸页内空白不关闭、取消都不扣币。
  await 开确认("购买:砖机液晶.整套");
  await 页.mouse.click(195, 120);
  await 页.waitForTimeout(220);
  assert.ok(!(await 确认纸页开着()), "点遮罩应关闭确认纸页");
  assert.equal(await 金币数(), 钱前, "遮罩关闭不应扣币");
  assert.equal(await 已购数(), 0, "遮罩关闭不应授予部位");
  assert.equal(await 当前主题(), "极光原野", "遮罩关闭不应切换主题");
  await 开确认("购买:砖机液晶.整套");
  await 页.mouse.click(195, 470);
  await 页.waitForTimeout(200);
  assert.ok(await 确认纸页开着(), "点纸页内空白不应关闭");
  await 点击按钮("取消交易");
  assert.equal(await 金币数(), 钱前, "取消不应扣币");
  assert.equal(await 已购数(), 0, "取消不应授予部位");
  await 记录步骤("遮罩关闭、纸页内空白不关、取消：均不扣币");

  // 单件购买：只解锁方块外观，写对应搭配，不动整套主题选择。
  await 开确认("购买:砖机液晶.方块外观");
  assert.equal(字段值(await 商店文字(), "确认:"), "方块外观:120");
  await 点击按钮("确认交易");
  await 页.waitForTimeout(320);
  assert.equal(await 金币数(), 钱前 - 120, "买方块外观应扣 120");
  assert.equal(await 已购数(), 1, "买方块外观应只解锁 1 个部位");
  assert.equal(await 单件价(), 0, "已购部位单件价应为 0");
  assert.equal(await 整套价(), 420, "买过方块后整套应只补未购 420");
  assert.deepEqual(await 外观搭配(), { 方块外观: "砖机液晶" });
  assert.equal(await 当前主题(), "极光原野", "单件穿戴不改主题选择");
  await 截图("05b-商店-砖机方块已购");
  await 记录步骤("买砖机方块：解锁 1 部位、扣 120、搭配生效且主题仍极光");

  // 再买方块以外的静态背景：两个部位互不覆盖。
  await 选中地点("街机彩砖");
  assert.equal(await 已购数(), 0);
  await 选中部位("静态背景");
  assert.equal(await 单件价(), 80, "街机静态背景价应为 80");
  assert.equal(字段值(await 商店文字(), "动态:"), "false", "静态部位不画动态层");
  await 开确认("购买:街机彩砖.静态背景");
  assert.equal(字段值(await 商店文字(), "确认:"), "静态背景:80");
  await 点击按钮("确认交易");
  await 页.waitForTimeout(320);
  assert.deepEqual(
    await 外观搭配(),
    { 方块外观: "砖机液晶", 静态背景: "街机彩砖" },
    "静态与方块两个部位应互不覆盖",
  );
  assert.equal(await 当前主题(), "极光原野", "单件穿戴仍不改主题选择");

  // 动态背景扣掉静态的 80、只补 100，并同时写入静态/动态。
  await 选中部位("动态背景");
  assert.equal(await 单件价(), 100, "买静态后动态应抵扣 100");
  assert.equal(字段值(await 商店文字(), "动态:"), "true");
  await 开确认("购买:街机彩砖.动态背景");
  assert.equal(字段值(await 商店文字(), "确认:"), "动态背景:100");
  await 点击按钮("确认交易");
  await 页.waitForTimeout(320);
  assert.equal(await 已购数(), 2, "买动态后街机应有两个部位");
  assert.deepEqual(
    await 外观搭配(),
    { 方块外观: "砖机液晶", 静态背景: "街机彩砖", 动态背景: "街机彩砖" },
    "动态背景应同时写入静态/动态",
  );
  await 截图("05c-商店-街机静态动态混搭");
  await 记录步骤("买街机静态 80 后动态抵扣 100：混搭不互相覆盖且包含静态");

  // 砖机剩余整套只补未购：420；整套穿戴写主题选择并清空外观搭配。
  await 选中地点("砖机液晶");
  assert.equal(await 整套价(), 420, "砖机剩余整套价应为 420");
  await 开确认("购买:砖机液晶.整套");
  assert.equal(字段值(await 商店文字(), "确认:"), "整套:420");
  await 点击按钮("确认交易");
  await 页.waitForTimeout(320);
  assert.equal(await 已购数(), 6, "整套购买后六个部位应全解锁");
  assert.equal(await 整套价(), 0);
  assert.equal(await 当前主题(), "砖机液晶", "整套穿戴应写主题选择");
  assert.deepEqual(await 外观搭配(), {}, "整套穿戴应清空外观搭配");
  const 买完金币 = await 金币数();
  assert.equal(买完金币, 钱前 - 120 - 80 - 100 - 420, "整套只补未购部位");
  await 截图("05d-商店-砖机整套已购");
  await 记录步骤("买砖机剩余整套 420：清空搭配、主题选择砖机");

  // 默认整套与已购整套穿戴也先开纸页确认，确认后不扣币。
  await 选中地点("极光原野");
  await 查找按钮("穿戴:极光原野.整套");
  await 开确认("穿戴:极光原野.整套");
  assert.equal(字段值(await 商店文字(), "确认:"), "整套:0");
  await 点击按钮("确认交易");
  await 页.waitForTimeout(320);
  assert.equal(await 金币数(), 买完金币, "默认整套穿戴不应扣币");
  assert.equal(await 当前主题(), "极光原野", "默认整套穿戴应切回极光");
  assert.deepEqual(await 外观搭配(), {}, "整套穿戴不写单件搭配");
  await 选中地点("砖机液晶");
  await 查找按钮("穿戴:砖机液晶.整套");
  await 开确认("穿戴:砖机液晶.整套");
  assert.equal(字段值(await 商店文字(), "确认:"), "整套:0");
  await 点击按钮("确认交易");
  await 页.waitForTimeout(320);
  assert.equal(await 金币数(), 买完金币, "已购整套穿戴不应扣币");
  assert.equal(await 当前主题(), "砖机液晶");
  assert.deepEqual(await 外观搭配(), {});
  await 记录步骤("默认整套与已购整套穿戴：都经确认纸页且不扣币");

  // 第 4 个地点在目录右侧：滚到末尾后用快照点击。
  const 目录首项 = await 查找按钮("商店地点:极光原野");
  for (let 次 = 0; 次 < 4; 次++) {
    await 页.mouse.move(目录首项.左 + 目录首项.宽 / 2, 目录首项.上 + 目录首项.高 / 2);
    await 页.mouse.wheel(160, 0);
    await 页.waitForTimeout(120);
  }
  assert.ok((await 目录滚动()) > 0, "目录应能横向滚动");
  await 页.waitForTimeout(400);
  const 立体项 = await 查找按钮("商店地点:立体晶格");
  await 点快照(立体项);
  assert.equal(字段值(await 商店文字(), "地点:"), "立体晶格", "滚动后应能选中第四地点");
  assert.equal(await 已购数(), 0, "未购立体不应有部位");
  assert.equal(await 整套价(), 510, "未购立体整套仍为 510");
  await 截图("05e-商店-立体晶格");
  await 记录步骤("目录横向滚动后选中第四地点立体晶格");

  // 未购立体不能直接改设置：主题选择与外观搭配两条越权路径都必须被拒绝。
  const 越权主题 = await 页.evaluate(() => {
    try {
      window.__three版__?.更新设置({ 主题选择: "立体晶格" });
      return "写入成功";
    } catch (错误) {
      return 错误 instanceof Error ? 错误.message : String(错误);
    }
  });
  assert.ok(越权主题.includes("尚未拥有"), `未购立体不应能写主题选择：${越权主题}`);
  const 越权搭配 = await 页.evaluate(() => {
    try {
      window.__three版__?.更新设置({ 外观搭配: { 方块外观: "立体晶格" } });
      return "写入成功";
    } catch (错误) {
      return 错误 instanceof Error ? 错误.message : String(错误);
    }
  });
  assert.ok(越权搭配.includes("尚未拥有"), `未购立体不应能写外观搭配：${越权搭配}`);
  assert.equal(await 当前主题(), "砖机液晶", "越权写入失败后主题应保持原样");
  assert.deepEqual(await 外观搭配(), {}, "越权写入失败后搭配应保持原样");
  await 记录步骤("未购立体不能通过更新设置越权", `${越权主题} / ${越权搭配}`);

  await 点击按钮("商店:纯享");
  await 等待按钮("纯享:返回");
  assert.ok(
    ((await 读取界面()).文字 ?? []).some((行) => 行.startsWith("来源:商店")),
    "商店纯享入口应进入纯享页",
  );
  await 记录步骤("商店 → 纯享（来源=商店）");
  await 点击按钮("纯享:返回");
  await 等待按钮("商店地点:极光原野");
  await 选中地点("街机彩砖");
  assert.equal(await 已购数(), 2, "纯享返回后商店仍可切换地点并保留购买状态");
  await 截图("05f-商店-纯享返回");
  await 记录步骤("纯享返回后商店仍可操作");
  await 点击按钮("返回主菜单");
  await 等待页面("菜单");
  await 回到菜单态();
  await 记录步骤("商店 → 主界面");

  await 错误检查点("商店之后");

  // —— 2a2) 五轮往返复核：菜单 ↔ 模式选择 ↔（排行榜）↔ 纯享，栈必须回到只剩菜单 ——
  for (let 轮 = 1; 轮 <= 5; 轮++) {
    await 点击按钮("开始游戏");
    await 等待页面("模式选择");
    await 等待开合结束();
    if (轮 % 2 === 1) {
      const 模式卡 = await 查找按钮("模式:每日挑战");
      await 页.mouse.click(模式卡.左 + 模式卡.宽 - 20, 模式卡.上 + 20);
      await 等待页面("排行榜");
      await 点击按钮("返回主菜单");
      await 等待页面("模式选择");
      await 等待开合结束();
    } else {
      await 点击按钮("返回");
      await 等待页面("菜单");
      await 等待开合结束();
      await 页.mouse.click(200, 350);
      await 等待按钮("纯享:返回");
      await 点击按钮("纯享:返回");
      await 等待页面("菜单");
      await 等待开合结束();
      continue;
    }
    await 点击按钮("返回");
    await 等待页面("菜单");
  }
  const 往返后 = await 读取状态();
  assert.deepEqual(往返后.场景栈, ["菜单"], `五轮往返后不应残留页面：${往返后.场景栈.join("/")}`);
  await 记录步骤("五轮进出菜单/模式选择/排行榜/纯享无残留页面");
  await 错误检查点("五轮往返之后");

  // —— 2b) 排行榜：入口是模式卡右上角的排行钮（卡内第二命中区，不是独立按钮） ——
  await 点击按钮("开始游戏");
  await 等待页面("模式选择");
  await 等待开合结束();
  const 马拉松卡 = await 查找按钮("模式:马拉松");
  // 排行钮几何：卡右上角内缩 20、30×30（与 计算模式卡排行区域 同口径）。
  await 页.mouse.click(马拉松卡.左 + 马拉松卡.宽 - 20, 马拉松卡.上 + 20);
  await 等待页面("排行榜");
  const 排行文字 = (await 读取界面()).文字 ?? [];
  assert.ok(
    排行文字.some((行) => 行 === "模式:马拉松"),
    `排行榜应带模式参数：${排行文字.join(" | ")}`,
  );
  assert.ok(
    排行文字.some((行) => 行.startsWith("周期:")),
    `排行榜应有周期状态：${排行文字.join(" | ")}`,
  );
  await 截图("07-排行榜");
  await 记录步骤("模式选择 → 排行榜（模式卡右上角排行钮）");
  // 返回必须真的关掉排行榜（曾因「无流转进入未清空上次流转」抛页面生命周期错误，
  // 现由模式选择页显式传空流转修好）。
  await 点击按钮("返回主菜单");
  await 等待页面("模式选择");
  await 回到菜单态();
  await 记录步骤("排行榜 → 主界面");

  await 错误检查点("商店与排行榜之后");

  await 错误检查点("排行榜之后");

  // —— 3) 设置项持久化 ——
  await 点击按钮("设置");
  await 等待页面("设置");
  const 原设置 = await 读取设置();
  const 原音效音量 = 原设置.音效音量;
  await 更新设置({ 音效音量: 0 });
  await 准备();
  await 等待页面("菜单");
  const 重载设置 = await 读取设置();
  assert.equal(重载设置.音效音量, 0, `设置未持久化：${JSON.stringify(重载设置)}`);
  await 记录步骤("设置持久化（音效音量=0 刷新后仍生效）");
  await 更新设置({ 音效音量: 原音效音量 });

  // 语言持久化（切英文 → 刷新仍英文），再切回中文。
  const 原语言 = 原设置.语言;
  await 更新设置({ 语言: "English" });
  await 准备();
  await 等待页面("菜单");
  assert.equal((await 读取设置()).语言, "English", "语言切换未持久化");
  await 截图("06-主界面-英文");
  await 记录步骤("语言持久化（English 刷新后仍生效）");
  await 更新设置({ 语言: 原语言 });
  await 准备();
  await 等待页面("菜单");

  // 省电模式联动画质：上限 30fps，切回自动恢复 60。
  const 原省电 = 原设置.省电模式;
  await 更新设置({ 省电模式: "开" });
  统计 = await 读取统计();
  assert.equal(统计.省电, "开", "省电模式未生效");
  assert.equal(统计.渲染.最大帧率, 30, `省电应限 30fps，实际 ${统计.渲染.最大帧率}`);
  await 更新设置({ 省电模式: "自动" });
  统计 = await 读取统计();
  assert.equal(统计.渲染.最大帧率, 60, `恢复后应 60fps，实际 ${统计.渲染.最大帧率}`);
  await 记录步骤("省电模式限帧 30fps → 恢复 60fps", `原省电=${原省电}`);

  await 错误检查点("设置持久化之后");

  // —— 4) 四模式对局：开始 → 落块/计分 → 暂停/继续 → 结束 → 结算 → 重开 → 返回 ——
  const 模式列表 = ["马拉松", "冲刺", "极限", "每日挑战"] as const;
  const 对局证据: { 模式: string; 落块数: number; 分数: number; 消行数: number }[] = [];
  const 消行证据: { 模式: string; 落块数: number; 分数: number; 消行数: number }[] = [];
  for (const 模式 of 模式列表) {
    // 页面节点已由页面侧「进入时补建缺失节点」修好，这里连打四局不重载，也不残留页面。
    await 回到菜单态();
    await 点击按钮("开始游戏");
    await 等待按钮(`模式:${模式}`);
    await 点击按钮(`模式:${模式}`);
    const 开局 = await 等待状态(
      (状态) => 状态.页面 === "对局" && 状态.场景栈.at(-1) === "对局",
      `开始 ${模式}`,
    );
    assert.equal(开局.模式, 模式, `模式不符：${JSON.stringify(开局)}`);
    await 页.waitForFunction(() => window.__three版__?.读取界面().文字?.includes("入场:完成"));
    // 真实键盘落 3 块：方向键移动 + 空格硬降。
    for (let 块 = 0; 块 < 3; 块++) {
      await 页.keyboard.press("ArrowLeft");
      await 页.keyboard.press("ArrowRight");
      await 页.keyboard.press(" ");
      await 页.waitForTimeout(50);
    }
    const 落块后 = await 读取统计();
    assert.ok(
      落块后.对局统计.落块数 >= 3,
      `${模式} 落块数不足：${JSON.stringify(落块后.对局统计)}`,
    );
    assert.ok(落块后.对局统计.操作次数 >= 3, `${模式} 操作数不足`);
    // 准备单行消除 + 硬降：验证真实消行与计分链路（不是只看落块分）。
    await 测试桥.准备单行消除();
    await 测试桥.硬降();
    await 页.waitForTimeout(120);
    const 消行后 = await 读取统计();
    const 快照 = await 读取快照字段();
    assert.ok((快照?.消行数 ?? 0) >= 1, `${模式} 消行未发生：${JSON.stringify(快照)}`);
    assert.ok((快照?.分数 ?? 0) > 0, `${模式} 分数为 0`);
    消行证据.push({
      模式,
      消行数: 快照?.消行数 ?? 0,
      分数: 快照?.分数 ?? 0,
      落块数: 消行后.对局统计.落块数,
    });
    await 截图(`02-消行-${模式}`);
    对局证据.push({
      模式,
      落块数: 落块后.对局统计.落块数,
      分数: 快照?.分数 ?? 0,
      消行数: 快照?.消行数 ?? 0,
    });
    if (模式 === "马拉松") {
      await 点击按钮("暂停");
      await 等待状态((状态) => (状态.阶段 ?? "") === "暂停", "暂停");
      await 截图("02-暂停面板");
      await 点击按钮("继续");
      await 等待状态((状态) => (状态.阶段 ?? "") === "进行中", "继续");
      await 记录步骤("暂停 → 继续");
    }
    // 结束当前对局并进结算，再重开一局确认可继续玩。
    await 测试桥.结束当前对局();
    await 等待覆盖("结算");
    await 截图(`03-结算-${模式}`);
    await 点击按钮("重新开始");
    await 等待回到对局();
    await 页.waitForFunction(() => window.__three版__?.读取界面().文字?.includes("入场:完成"));
    await 记录步骤(`${模式}：结束 → 结算 → 重新开始`);
    // 再结束一次，从结算返回主菜单，准备下一个模式。
    await 测试桥.结束当前对局();
    await 等待覆盖("结算");
    await 点击按钮("返回主菜单");
    await 等待页面("菜单");
    await 记录步骤(`${模式}：结算 → 返回主菜单`);
  }

  await 错误检查点("四模式对局之后");

  // —— 5) 音频静音联动 ——
  const 音频设置前 = await 读取音频();
  await 更新设置({ 音效音量: 0, 音乐音量: 0, 背景音乐: false });
  const 音频设置后 = await 读取音频();
  assert.equal(音频设置后.音效音量, 0);
  assert.equal(音频设置后.背景音乐, false);
  await 记录步骤("音频静音联动", `上下文=${音频设置后.上下文}`);
  await 更新设置({
    音效音量: 原音效音量,
    音乐音量: 音频设置前.音乐音量,
    背景音乐: 音频设置前.背景音乐,
  });

  // —— 6) 性能数据（≥300 帧）——
  统计 = await 读取统计();
  for (let 等待 = 0; 等待 < 100 && 统计.循环.帧数 < 320; 等待++) {
    await 页.waitForTimeout(100);
    统计 = await 读取统计();
  }
  const 生命周期明细 = await 读取错误明细();
  assert.equal(
    页面错误.length,
    0,
    `运行中报错：${页面错误.join("；")}｜内层原因：${生命周期明细.join("；") || "无"}`,
  );

  assert.deepEqual(统计.画布, {
    宽: 390 * DPR,
    高: 844 * DPR,
    视口宽: "390",
    视口高: "844",
  });
  assert.equal(统计.设备像素比, DPR);
  assert.ok(统计.循环.帧数 >= 300, `帧数不足：${统计.循环.帧数}`);
  assert.ok(统计.循环.首帧毫秒 !== null, "首帧耗时缺失");
  assert.ok(统计.循环.平均工作毫秒 < 16, `单帧脚本耗时过高：${统计.循环.平均工作毫秒}`);
  assert.ok(统计.渲染.绘制调用 <= 12, `绘制调用过多：${统计.渲染.绘制调用}`);
  assert.ok(统计.内存.已用MB !== null && 统计.内存.已用MB > 0, "JS 堆内存缺失");
  await 截图("04-主界面-最终");

  const 结果 = {
    地址,
    视口: { 宽: 390, 高: 844, 设备像素比: DPR },
    步骤,
    对局证据,
    消行证据,
    设置持久化: { 原音效音量, 重载后音效音量: 重载设置.音效音量 },
    音频: { 前: 音频设置前, 后: 音频设置后 },
    统计,
    控制台drawCall日志: 控制台日志.filter((日志) => 日志.includes("draw call")).slice(-3),
    页面错误,
    生命周期明细,
    时间: new Date().toISOString(),
  };
  await writeFile(join(输出, "结果.json"), JSON.stringify(结果, null, 2));
  console.log(
    JSON.stringify(
      {
        步数: 步骤.length,
        对局证据,
        消行证据,
        首帧毫秒: 统计.循环.首帧毫秒,
        平均帧间隔毫秒: 统计.循环.平均帧间隔毫秒,
        平均工作毫秒: 统计.循环.平均工作毫秒,
        帧数: 统计.循环.帧数,
        内存: 统计.内存,
        绘制调用: 统计.渲染.绘制调用,
        四边形数: 统计.合批.四边形数,
        页面错误,
      },
      null,
      2,
    ),
  );
  console.log("Three 版完整功能验收通过，截图与结果：.gamemaker/报告/three版/");
} finally {
  await 浏览器.close();
}
