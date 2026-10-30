import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { chromium } from "playwright";
import type {} from "../../代码/应用/启动";
import { 入场参数, 对局入场时长, 模式退场时长 } from "../../视效/过渡/入场演出";

const 地址 = process.argv[2] ?? "http://127.0.0.1:3001";
const 宽 = Number(process.argv.find((项) => 项.startsWith("--宽="))?.split("=")[1] ?? 390);
const 高 = Number(process.argv.find((项) => 项.startsWith("--高="))?.split("=")[1] ?? 844);
const 省电 = process.argv.includes("--省电");
const 输出 = resolve(`reports/入场精修/${宽}x${高}${省电 ? "-省电" : ""}`);
await mkdir(输出, { recursive: true });
const 浏览器 = await chromium.launch({ channel: "chrome" });
const 上下文 = await 浏览器.newContext({
  viewport: { width: 宽, height: 高 },
  hasTouch: true,
  deviceScaleFactor: 1,
  recordVideo: { dir: join(输出, "录像"), size: { width: 宽, height: 高 } },
});
const 页 = await 上下文.newPage();
declare global {
  interface Window {
    __入场声音测试__?: { 频率: number; 节拍: string; 时刻: number }[];
  }
}
await 页.addInitScript(() => {
  window.__入场声音测试__ = [];
  const 原 = OscillatorNode.prototype.start;
  OscillatorNode.prototype.start = function (时刻?: number) {
    window.__入场声音测试__?.push({
      频率: this.frequency.value,
      节拍: window.__three版__?.读取界面().文字?.find((项) => 项.startsWith("入场:")) ?? "",
      时刻: performance.now(),
    });
    原.call(this, 时刻);
  };
});
const 错误: string[] = [];
const 记录: object[] = [];
页.on("pageerror", (错) => 错误.push(错.message));
const 界面 = () => 页.evaluate(() => window.__three版__?.读取界面());
async function 点击(名称: string) {
  await 页.waitForFunction(
    (名) => window.__three版__?.读取界面().按钮.some((项) => 项.名称 === 名 && 项.可用 !== false),
    名称,
  );
  const 项 = (await 界面())?.按钮.find((项) => 项.名称 === 名称);
  assert.ok(项, 名称);
  await 页.mouse.click(项.左 + 项.宽 / 2, 项.上 + 项.高 / 2);
}
async function 等待节拍(节拍: string) {
  await 页.waitForFunction(
    (拍) => window.__three版__?.读取界面().文字?.includes(`入场:${拍}`),
    节拍,
  );
  const 最早 = (
    {
      居中: 0.27,
      压线: 0.78,
      蓄力: 入场参数.时间.收束止 + 0.025,
      展开: 0.14,
      Ready: 入场参数.时间.Ready起 + 0.08,
      Go: 入场参数.时间.Ready止 + 0.1,
    } as Record<string, number>
  )[节拍];
  if (最早 !== undefined)
    await 页.waitForFunction(
      ({ 拍, 起 }) => {
        const 桥 = window.__three版__;
        const 秒 =
          桥?.读取状态().页面 === "对局"
            ? 桥.读取状态().入场秒
            : Number(
                桥
                  ?.读取界面()
                  .文字?.find((项) => 项.startsWith("入场秒:"))
                  ?.slice(4),
              );
        return (
          桥?.读取界面().文字?.includes(`入场:${拍}`) && 秒 !== null && 秒 !== undefined && 秒 >= 起
        );
      },
      { 拍: 节拍, 起: 最早 },
    );
}
async function 截图(名: string) {
  await 页.screenshot({ path: join(输出, `${名}.png`) });
  记录.push({
    名,
    界面: await 界面(),
    状态: await 页.evaluate(() => window.__three版__?.读取状态()),
  });
}
async function 入模式页() {
  await 页.waitForFunction(() => window.__three版__?.读取状态().页面 === "主界面");
  if ((await 界面())?.按钮.some((项) => 项.名称 === "开始游戏")) await 点击("开始游戏");
  await 页.waitForFunction(() =>
    window.__three版__?.读取界面().按钮.some((项) => 项.名称 === "开始:马拉松"),
  );
}
let 成功 = false;
try {
  await 页.goto(地址);
  await 页.waitForFunction(() => window.__three版__);
  if (省电) await 页.evaluate(() => window.__three版__?.更新设置({ 省电模式: "开" }));
  for (const 模式 of ["马拉松", "冲刺", "极限", "每日挑战"]) {
    await 入模式页();
    await 截图(`${模式}-00-选择`);
    const 起 = performance.now();
    await 点击(`开始:${模式}`);
    assert.equal((await 界面())?.按钮.length, 0, "入场清除旧热区");
    await 页.keyboard.press("Escape");
    await 页.keyboard.press("Space");
    await 等待节拍("居中");
    await 截图(`${模式}-01-居中`);
    await 等待节拍("压线");
    await 截图(`${模式}-02-压线`);
    await 等待节拍("蓄力");
    await 截图(`${模式}-03-蓄力`);
    await 等待节拍("展开");
    await 页.keyboard.down("ArrowLeft");
    await 页.keyboard.press("Space");
    await 页.evaluate(() => window.__再消一行测试__?.硬降());
    await 截图(`${模式}-04-展开`);
    const 初始 = await 页.evaluate(() => window.__再消一行测试__?.读取状态());
    assert.equal(初始?.有效用时, 0, "展开前不计时");
    assert.equal(
      (await 页.evaluate(() => window.__three版__?.读取统计()))?.对局统计.落块数,
      0,
      "入场拒绝键盘与测试硬降",
    );
    await 等待节拍("Ready");
    await 截图(`${模式}-05-Ready`);
    assert.equal(
      (await 页.evaluate(() => window.__再消一行测试__?.读取状态()))?.有效用时,
      0,
      "Ready不计时",
    );
    const 准备音 = await 页.evaluate(() =>
      window.__入场声音测试__?.some((项) => 项.节拍 === "入场:Ready"),
    );
    assert.ok(准备音, "Ready 发出真实合成音");
    assert.equal(
      (await 页.evaluate(() => window.__three版__?.读取音频()))?.当前音乐,
      null,
      "入场期间音乐不抢拍",
    );
    await 等待节拍("Go");
    await 截图(`${模式}-06-Go`);
    assert.ok(
      await 页.evaluate(() => window.__入场声音测试__?.some((项) => 项.节拍 === "入场:Go")),
      "Go 发出真实开始音",
    );
    await 等待节拍("完成");
    await 页.keyboard.up("ArrowLeft");
    const 用时 = performance.now() - 起;
    assert.ok(用时 >= (模式退场时长 + 对局入场时长) * 1000 - 80 && 用时 < 2850, `入场时长${用时}`);
    await 页.keyboard.press("Space");
    await 页.waitForFunction(() => (window.__three版__?.读取统计().对局统计.落块数 ?? 0) >= 1);
    await 截图(`${模式}-07-可玩`);
    记录.push({ 模式, 总耗时毫秒: 用时, 输入门禁: true });
    await 点击("暂停");
    await 点击("返回主菜单");
    console.log(`${模式}：2.4秒入场、音符和输入门禁通过`);
  }
  if (!process.argv.includes("--仅模式")) {
    // 失焦、暂停恢复，以及重开只接短节拍。
    await 入模式页();
    await 点击("开始:极限");
    await 等待节拍("Ready");
    await 页.keyboard.press("KeyP");
    await 页.waitForFunction(() => window.__再消一行测试__?.读取状态().阶段 === "暂停");
    const 暂停前 = await 页.evaluate(() => window.__three版__?.读取状态());
    await 截图("暂停-Ready冻结");
    const 起帧 = await 页.evaluate(() => window.__three版__?.读取统计().循环.帧数 ?? 0);
    await 页.waitForFunction(
      (帧) => (window.__three版__?.读取统计().循环.帧数 ?? 0) >= 帧 + 4,
      起帧,
    );
    assert.equal(
      (await 页.evaluate(() => window.__three版__?.读取状态()))?.入场秒,
      暂停前?.入场秒,
      "暂停冻结入场进度",
    );
    await 页.keyboard.press("KeyP");
    await 等待节拍("完成");
    await 页.keyboard.press("KeyR");
    await 等待节拍("Ready");
    assert.equal((await 页.evaluate(() => window.__再消一行测试__?.读取状态()))?.有效用时, 0);
    await 截图("重开-短Ready");
    await 等待节拍("完成");
    await 页.keyboard.press("Space");
    await 页.waitForFunction(() => (window.__three版__?.读取统计().对局统计.落块数 ?? 0) >= 1);
    记录.push({ 暂停前, 重开可玩: true });
    // 注入浏览器失焦/聚焦事件，验证实际监听器；不把它称作系统焦点验收。
    await 页.keyboard.press("KeyR");
    await 等待节拍("Ready");
    await 页.evaluate(() => window.dispatchEvent(new Event("blur")));
    await 页.waitForFunction(() => window.__再消一行测试__?.读取状态().阶段 === "暂停");
    const 失焦前 = await 页.evaluate(() => window.__three版__?.读取状态().入场秒);
    const 失焦帧 = await 页.evaluate(() => window.__three版__?.读取统计().循环.帧数 ?? 0);
    await 页.waitForFunction(
      (帧) => (window.__three版__?.读取统计().循环.帧数 ?? 0) >= 帧 + 4,
      失焦帧,
    );
    await 页.evaluate(() => window.dispatchEvent(new Event("focus")));
    assert.equal((await 页.evaluate(() => window.__three版__?.读取状态()))?.入场秒, 失焦前);
    await 点击("继续");
    await 等待节拍("完成");
    console.log("暂停与失焦事件恢复通过");
    await 页.evaluate(() => window.__再消一行测试__?.准备结算(true));
    await 点击("重新开始");
    await 等待节拍("Ready");
    assert.equal((await 页.evaluate(() => window.__再消一行测试__?.读取状态()))?.有效用时, 0);
    await 截图("结算重开-短Ready");
    await 等待节拍("完成");
    // 展开中退出后再次选择模式，旧入场不能继续推动新页面。
    await 点击("暂停");
    await 点击("返回主菜单");
    await 入模式页();
    await 点击("开始:冲刺");
    await 等待节拍("展开");
    await 点击("暂停");
    await 点击("返回主菜单");
    await 入模式页();
    await 点击("开始:每日挑战");
    await 等待节拍("完成");
    assert.equal((await 页.evaluate(() => window.__three版__?.读取状态()))?.模式, "每日挑战");
    记录.push({
      失焦事件注入后冻结: true,
      结算重开: true,
      提前退出后可再次入场: true,
      音频: await 页.evaluate(() => window.__入场声音测试__),
    });
  }
  assert.deepEqual(错误, []);
  成功 = true;
} finally {
  记录.push({ 最终状态: await 页.evaluate(() => window.__three版__?.读取状态()) });
  await writeFile(
    join(输出, "浏览器结果.json"),
    JSON.stringify(
      { 成功, 范围: `Chrome模拟手机${宽}x${高} DPR1，非手机真机`, 错误, 记录 },
      null,
      2,
    ),
  );
  await 上下文.close();
  await 浏览器.close();
}
console.log(`入场演出验收通过：${输出}`);
