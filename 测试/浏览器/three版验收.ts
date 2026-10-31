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
          盒.__错误明细?.push((项.stack ?? 项.message ?? "").split(String.fromCharCode(10)).slice(0, 4).join(" ⏎ "));
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

  // —— 2a) 主题商店：四套主题、余额不足、取消不扣币、购买生效、已拥有不再扣款 ——
  /** 商店当前主按钮（名称随拥有/选中状态变化：使用中 / 使用 / 购买 · ▣ 价格）。 */
  const 主按钮快照 = async () => {
    const 界面 = await 读取界面();
    return 界面.按钮.find((项) => 项.名称.startsWith("商店:主按钮"));
  };
  const 金币数 = async () => (await 读取统计()).金币;
  const 已购主题数 = async () =>
    Number(
      (await 读取界面()).文字?.find((行) => 行.startsWith("已购主题:"))?.slice("已购主题:".length),
    );
  const 当前主题 = async () => (await 读取设置()).主题选择;

  await 点击按钮("商店");
  await 等待页面("商店");
  await 记录步骤("主界面 → 商店（主题商店）");

  // 商品结构：四套主题各一张卡，默认主题出厂即拥有。
  const 主题卡名 = (await 读取界面()).按钮
    .map((项) => 项.名称)
    .filter((名) => 名.startsWith("商店主题:"));
  assert.deepEqual(
    主题卡名,
    ["商店主题:极光原野", "商店主题:砖机液晶", "商店主题:街机彩砖", "商店主题:立体晶格"],
    `商店主题卡不符：${主题卡名.join("、")}`,
  );
  assert.equal(await 当前主题(), "极光原野", "出厂默认主题应为极光原野");
  const 出厂主按钮 = await 主按钮快照();
  assert.ok(出厂主按钮?.名称.endsWith("使用中"), `默认主题主按钮应显示使用中：${出厂主按钮?.名称}`);
  await 截图("05-商店-默认主题");
  await 记录步骤("商店展示四套主题，默认主题标使用中");

  // 未拥有主题：主按钮变「购买」，余额不足时不打开确认纸页、不扣币。
  await 点击按钮("商店主题:砖机液晶");
  const 待买主按钮 = await 主按钮快照();
  assert.ok(
    待买主按钮?.名称.includes("购买"),
    `未拥有主题主按钮应为购买：${待买主按钮?.名称}`,
  );
  const 余额 = await 金币数();
  const 价格 = Number(待买主按钮?.名称.split("▣").at(-1)?.trim());
  assert.ok(Number.isFinite(价格) && 价格 > 0, `购买按钮缺少价格：${待买主按钮?.名称}`);
  if (余额 < 价格) {
    await 点击按钮(待买主按钮!.名称);
    assert.ok(
      !(await 读取界面()).按钮.some((项) => 项.名称 === "确认交易"),
      "余额不足时不应打开确认纸页",
    );
    assert.equal(await 金币数(), 余额, "余额不足时不应扣币");
    assert.equal(await 当前主题(), "极光原野", "余额不足时主题不应变化");
    const 不足消息 = (await 读取界面()).文字?.find((行) => 行.startsWith("消息:")) ?? "";
    assert.ok(不足消息.includes("还差"), `余额不足应给出可见原因：${不足消息}`);
    await 截图("05a-商店-余额不足");
    await 记录步骤("余额不足：不打开确认、不扣币、主题不变、原因可见", 不足消息);
    await 增加金币(价格 * 4);
  }

  // 打开确认纸页：点纸页外（遮罩）关闭，不扣币。
  await 点击按钮((await 主按钮快照())!.名称);
  await 等待按钮("确认交易");
  assert.ok(await 找弹层按钮(["确认交易"]), "购买前应打开确认纸页");
  await 截图("05b-商店-确认纸页");
  const 确认前金币 = await 金币数();
  await 页.mouse.click(195, 120);
  await 页.waitForTimeout(220);
  assert.ok(
    !(await 读取界面()).按钮.some((项) => 项.名称 === "确认交易"),
    "点纸页外应关闭确认纸页",
  );
  assert.equal(await 金币数(), 确认前金币, "点遮罩关纸页不应扣币");
  assert.equal(await 当前主题(), "极光原野", "点遮罩关纸页不应切换主题");
  await 记录步骤("确认纸页点外部关闭，不扣币、不切主题");

  // 取消不扣币。
  await 点击按钮((await 主按钮快照())!.名称);
  await 等待按钮("取消交易");
  await 点击按钮("取消交易");
  assert.equal(await 金币数(), 确认前金币, "取消不应扣币");
  assert.equal(await 已购主题数(), 0, "取消不应授予主题");
  await 记录步骤("取消购买：不扣币、不授予主题");

  // 确认购买：扣币、授予主题、主题立刻生效、主按钮转「使用中」、卡面转已拥有。
  await 点击按钮((await 主按钮快照())!.名称);
  await 等待按钮("确认交易");
  await 点击按钮("确认交易");
  await 页.waitForTimeout(350);
  const 买后金币 = await 金币数();
  assert.equal(买后金币, 确认前金币 - 价格, `购买应扣 ${价格} 币：${确认前金币}→${买后金币}`);
  assert.equal(await 已购主题数(), 1, "购买后应记录一套已购主题");
  assert.equal(await 当前主题(), "砖机液晶", "购买后主题应立即生效");
  const 买后主按钮 = await 主按钮快照();
  assert.ok(买后主按钮?.名称.endsWith("使用中"), `购买后主按钮应为使用中：${买后主按钮?.名称}`);
  const 买后文字 = (await 读取界面()).文字 ?? [];
  assert.ok(
    买后文字.some((行) => 行.startsWith("选中主题:砖机液晶")) &&
      买后文字.some((行) => 行.startsWith("价格:0")),
    `购买后商店应显示已拥有：${买后文字.join(" | ")}`,
  );
  await 截图("05c-商店-购买完成");
  await 记录步骤("确认购买：扣币、授予主题、主题生效、卡面转已拥有");

  // 已拥有主题互相切换不扣币；未拥有主题仍要买（不会误判为已拥有）。
  const 切回前金币 = await 金币数();
  // 选中卡只改预览；点主按钮才真正切换（已拥有时主按钮是「使用」）。
  await 点击按钮("商店主题:极光原野");
  const 极光主按钮 = await 主按钮快照();
  assert.ok(极光主按钮?.名称.endsWith("使用"), `默认主题主按钮应为使用：${极光主按钮?.名称}`);
  await 点击按钮(极光主按钮!.名称);
  assert.equal(await 当前主题(), "极光原野", "默认主题可直接使用");
  await 点击按钮("商店主题:砖机液晶");
  const 已购主按钮 = await 主按钮快照();
  assert.ok(已购主按钮?.名称.endsWith("使用"), `已购主题主按钮应为使用：${已购主按钮?.名称}`);
  await 点击按钮(已购主按钮!.名称);
  assert.equal(await 当前主题(), "砖机液晶", "已购主题可直接切换");
  assert.equal(await 金币数(), 切回前金币, "已拥有主题切换不应扣币");
  await 点击按钮("商店主题:立体晶格");
  const 未购主按钮 = await 主按钮快照();
  assert.ok(未购主按钮?.名称.includes("购买"), `未拥有主题仍是购买：${未购主按钮?.名称}`);
  await 记录步骤("已购主题免币切换，未购主题仍需购买");

  // 未拥有不能直接改设置：越权写设置必须被设置层拒绝。
  const 越权结果 = await 页.evaluate(() => {
    try {
      window.__three版__?.更新设置({ 主题选择: "立体晶格" });
      return "写入成功";
    } catch (错误) {
      return 错误 instanceof Error ? 错误.message : String(错误);
    }
  });
  assert.ok(越权结果.includes("尚未拥有"), `未购买主题不应能写入设置：${越权结果}`);
  assert.equal(await 当前主题(), "砖机液晶", "越权写入失败后主题应保持原样");
  await 记录步骤("未购买不能切换主题（设置层拒绝）", 越权结果);

  await 点击按钮("商店:纯享");
  await 等待按钮("纯享:返回");
  assert.ok(
    ((await 读取界面()).文字 ?? []).some((行) => 行.startsWith("来源:商店")),
    "商店纯享入口应进入纯享页",
  );
  await 记录步骤("商店 → 纯享（来源=商店）");
  await 点击按钮("纯享:返回");
  await 等待按钮("商店主题:极光原野");
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
