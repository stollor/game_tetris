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
  const 控制台日志: string[] = [];
  页.on("pageerror", (错误) => 页面错误.push(错误.message));
  页.on("console", (消息) => {
    if (消息.type() === "error") 页面错误.push(消息.text());
    else 控制台日志.push(消息.text());
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
  };
  await 准备();

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
  const 查找按钮 = async (名称: string): Promise<界面按钮快照> => {
    await 页.waitForFunction(
      (名) => window.__three版__?.读取界面().按钮.some((项) => 项.名称 === 名),
      名称,
    );
    const 界面 = await 读取界面();
    const 按钮 = 界面.按钮.find((项) => 项.名称 === 名称);
    if (!按钮) {
      throw new Error(
        `页面缺少按钮「${名称}」，现有：${界面.按钮.map((项) => 项.名称).join("、")}`,
      );
    }
    return 按钮;
  };
  const 弹层按钮名 = ["确认交易", "确认购买", "穿戴", "确认", "取消交易", "取消"];
  const 找弹层按钮 = async (候选: readonly string[]) => {
    const 界面 = await 读取界面();
    return 界面.按钮.find((项) => 候选.includes(项.名称) && 项.可用 !== false);
  };
  const 关闭可能的弹层 = async () => {
    const 取消 = await 找弹层按钮(["取消交易", "取消"]);
    if (取消) {
      await 页.mouse.click(取消.左 + 取消.宽 / 2, 取消.上 + 取消.高 / 2);
      await 页.waitForTimeout(150);
    }
  };
  const 点击按钮 = async (名称: string) => {
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
  /** 主界面两态：菜单态有「开始游戏」，模式选择态有「返回」。从任何页面回到菜单态。 */
  const 回到菜单态 = async () => {
    await 等待页面("菜单");
    if (await 查找按钮名("开始游戏")) return;
    if (await 查找按钮名("返回")) {
      await 点击按钮("返回");
      await 等待按钮("开始游戏");
    }
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

  // —— 2) 子页面导航与返回（设置/成就/商店）——
  for (const 子页 of ["设置", "成就", "商店"] as const) {
    await 点击按钮(子页);
    await 等待页面(子页);
    await 记录步骤(`主界面 → ${子页}`);
    if (子页 === "商店") {
      await 增加金币(5000);
      const 界面 = await 读取界面();
      const 可买 = 界面.按钮.find((项) => 项.名称.startsWith("购买:") && 项.可用 !== false);
      if (可买) {
        await 点击按钮(可买.名称);
        const 确认 = await 找弹层按钮(弹层按钮名);
        if (确认) {
          await 页.mouse.click(确认.左 + 确认.宽 / 2, 确认.上 + 确认.高 / 2);
          await 页.waitForTimeout(200);
        }
        await 记录步骤(`商店购买 ${可买.名称}`);
        const 买后 = await 读取界面();
        const 可穿 = 买后.按钮.find((项) => 项.名称.startsWith("穿戴:") && 项.可用 !== false);
        if (可穿) {
          await 点击按钮(可穿.名称);
          const 穿戴确认 = await 找弹层按钮(弹层按钮名);
          if (穿戴确认) {
            await 页.mouse.click(穿戴确认.左 + 穿戴确认.宽 / 2, 穿戴确认.上 + 穿戴确认.高 / 2);
            await 页.waitForTimeout(200);
          }
          await 记录步骤(`商店穿戴 ${可穿.名称}`);
        }
      }
      await 关闭可能的弹层();
      await 截图("05-商店");
    }
    await 点击按钮("返回主菜单");
    await 等待页面("菜单");
    await 回到菜单态();
    await 记录步骤(`${子页} → 主界面`);
  }

  // —— 2b) 排行榜：入口在模式选择态模式卡右上角（与 Phaser 一致） ——
  await 点击按钮("开始游戏");
  await 等待按钮("排行榜:马拉松");
  await 点击按钮("排行榜:马拉松");
  await 等待页面("排行榜");
  await 截图("07-排行榜");
  await 记录步骤("模式选择 → 排行榜:马拉松");
  await 点击按钮("返回主菜单");
  await 等待页面("菜单");
  await 回到菜单态();
  await 记录步骤("排行榜 → 主界面");

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

  // —— 4) 四模式对局：开始 → 落块/计分 → 暂停/继续 → 结束 → 结算 → 重开 → 返回 ——
  const 模式列表 = ["马拉松", "冲刺", "极限", "每日挑战"] as const;
  const 对局证据: { 模式: string; 落块数: number; 分数: number; 消行数: number }[] = [];
  const 消行证据: { 模式: string; 落块数: number; 分数: number; 消行数: number }[] = [];
  for (const 模式 of 模式列表) {
    await 回到菜单态();
    await 点击按钮("开始游戏");
    await 等待按钮(`开始:${模式}`);
    await 点击按钮(`开始:${模式}`);
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
  assert.equal(页面错误.length, 0, `运行中报错：${页面错误.join("；")}`);
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
