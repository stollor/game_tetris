import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "playwright";

/**
 * 页面过渡抓帧 + 背景像素比对（验收脚本）。
 *
 * - CDP screencast 连续收帧（≈40ms/张），覆盖 0.36s 过渡，产物每帧一张 jpg；
 * - 另抓「菜单 / 模式选择 / 纯享」三张静止图，在页面里解码后比对背景区域像素，
 *   确认三个界面的背景完全一致（取样带避开三页各自的 UI）。
 *
 * 用法：bun ./运行/运行游戏命令.ts ./测试/浏览器/页面过渡.ts http://127.0.0.1:3000
 */

const 地址 = process.argv[2] ?? "http://127.0.0.1:3000";
const 输出 = resolve(".gamemaker/报告/过渡抓帧");
await mkdir(输出, { recursive: true });
const 浏览器 = await chromium.launch({ channel: "chrome" });
const 环境 = await 浏览器.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 1,
  hasTouch: true,
});
const 页 = await 环境.newPage();
const 错误: string[] = [];
页.on("pageerror", (错) => 错误.push(`pageerror ${错.message}`));
页.on("console", (消息) => {
  if (消息.type() === "error") 错误.push(`console ${消息.text()}`);
});
const 界面 = () => 页.evaluate(() => window.__three版__?.读取界面());
const 点 = async (名称: string) => {
  const 按钮 = (await 界面())?.按钮.find((项) => 项.名称 === 名称);
  if (!按钮) throw new Error(`缺少按钮 ${名称}`);
  await 页.mouse.click(按钮.左 + 按钮.宽 / 2, 按钮.上 + 按钮.高 / 2);
};
const 等页面 = (名: string) =>
  页.waitForFunction((目标) => window.__three版__?.读取状态().页面 === 目标, 名, {
    polling: "raf",
    timeout: 8000,
  });
const 等过渡结束 = () =>
  页.waitForFunction(() => !window.__three版__?.读取界面().文字?.includes("过渡:流转"), undefined, {
    polling: "raf",
    timeout: 8000,
  });

/** 用 CDP screencast 连续收帧：触发切页后约 900ms 内的所有合成帧。 */
async function 抓帧(目录: string, 触发: () => Promise<void>): Promise<void> {
  const 目标 = resolve(输出, 目录);
  await mkdir(目标, { recursive: true });
  const 会话 = await 页.context().newCDPSession(页);
  const 帧: Buffer[] = [];
  会话.on("Page.screencastFrame", async (事件) => {
    帧.push(Buffer.from(事件.data, "base64"));
    await 会话.send("Page.screencastFrameAck", { sessionId: 事件.sessionId }).catch(() => {});
  });
  await 会话.send("Page.startScreencast", { format: "jpeg", quality: 85, everyNthFrame: 1 });
  await 触发();
  await 页.waitForTimeout(900);
  await 会话.send("Page.stopScreencast").catch(() => {});
  for (const [序号, 数据] of 帧.entries())
    await writeFile(resolve(目标, `${String(序号).padStart(2, "0")}.jpg`), 数据);
  console.log(`${目录} 收帧 ${帧.length} 张`);
  await 会话.detach().catch(() => {});
}

await 页.goto(地址);
await 页.waitForFunction(() => !!window.__three版__);
await 页.bringToFront();
await 页.evaluate(() => window.__three版__?.更新设置({ 背景动态: false, 省电模式: "开" }));
await 页.waitForTimeout(400);

const 静止 = resolve(输出, "静止");
await mkdir(静止, { recursive: true });
await 页.screenshot({ path: resolve(静止, "01-菜单.png") });

await 抓帧("01-菜单到模式选择", () => 点("开始游戏"));
await 等页面("模式选择");
await 等过渡结束();
await 页.waitForTimeout(320);
await 页.screenshot({ path: resolve(静止, "02-模式选择.png") });

await 点("返回");
await 等页面("菜单");
await 页.waitForTimeout(300);
await 抓帧("02-菜单到纯享", () => 页.mouse.click(195, 760));
await 等页面("纯享");
await 等过渡结束();
await 页.waitForTimeout(320);
await 页.screenshot({ path: resolve(静止, "03-纯享.png") });

// —— 背景像素比对：三张静止图在页面里解码，取三页都没有 UI 的背景带对比 ——
const 三张 = ["01-菜单.png", "02-模式选择.png", "03-纯享.png"];
const 图: string[] = [];
for (const 名 of 三张) 图.push((await readFile(resolve(静止, 名))).toString("base64"));
const 比对 = await 页.evaluate(
  async ({
    图,
    区域,
  }: {
    图: string[];
    区域: { x: number; y: number; 宽: number; 高: number };
  }) => {
    const 解码 = async (base64: string) => {
      const 位图 = await createImageBitmap(
        await (await fetch(`data:image/png;base64,${base64}`)).blob(),
      );
      const 画布 = new OffscreenCanvas(位图.width, 位图.height);
      const 上下文 = 画布.getContext("2d");
      if (!上下文) throw new Error("缺少 2D 上下文");
      上下文.drawImage(位图, 0, 0);
      return 上下文.getImageData(区域.x, 区域.y, 区域.宽, 区域.高).data;
    };
    const 像素: Uint8ClampedArray[] = [];
    for (const 项 of 图) 像素.push(await 解码(项));
    const 甲 = 像素[0];
    if (!甲) throw new Error("解码失败");
    const 结果: { 对: string; 最大差: number; 不同像素占比: number }[] = [];
    for (let i = 1; i < 像素.length; i++) {
      const 乙 = 像素[i];
      if (!乙) continue;
      let 最大差 = 0;
      let 不同 = 0;
      for (let 下标 = 0; 下标 < 甲.length; 下标 += 4) {
        const 差 = Math.max(
          Math.abs((甲[下标] ?? 0) - (乙[下标] ?? 0)),
          Math.abs((甲[下标 + 1] ?? 0) - (乙[下标 + 1] ?? 0)),
          Math.abs((甲[下标 + 2] ?? 0) - (乙[下标 + 2] ?? 0)),
        );
        最大差 = Math.max(最大差, 差);
        if (差 > 2) 不同++;
      }
      结果.push({ 对: `菜单 vs 图${i + 1}`, 最大差, 不同像素占比: 不同 / (甲.length / 4) });
    }
    return 结果;
  },
  { 图, 区域: { x: 0, y: 150, 宽: 390, 高: 18 } },
);
console.log("背景带比对（y=150..168）：", 比对);

console.log("错误", 错误);
await 浏览器.close();
if (错误.length) process.exitCode = 1;
