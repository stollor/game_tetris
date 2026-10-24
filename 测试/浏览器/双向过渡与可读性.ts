import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { chromium } from "playwright";
import type {} from "../../代码/应用/启动";

const 地址 = process.argv[2] ?? "http://127.0.0.1:3001";
const 输出 = resolve(process.argv[3] ?? "reports/双向过渡与可读性");
await mkdir(输出, { recursive: true });
const 浏览器 = await chromium.launch({ channel: "chrome" });
const 页 = await 浏览器.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
const 错误: string[] = [];
const 记录: object[] = [];
let 通过 = false;
页.on("pageerror", (e) => 错误.push(e.message));
const 界面 = () => 页.evaluate(() => window.__three版__?.读取界面());
async function 稳定() {
  await 页.waitForFunction(
    () =>
      !window.__three版__?.读取界面().文字?.some((项) => 项 === "过渡:移出" || 项 === "过渡:移入"),
  );
}
async function 等待页面(名称: string) {
  await 页.waitForFunction((名) => window.__three版__?.读取状态().场景栈.at(-1) === 名, 名称);
}
async function 等待绘制() {
  const 起帧 = await 页.evaluate(() => window.__three版__?.读取统计().循环.帧数 ?? 0);
  await 页.waitForFunction((起) => (window.__three版__?.读取统计().循环.帧数 ?? 0) >= 起 + 2, 起帧);
}
async function 截图(名称: string, 等稳定 = true) {
  if (等稳定) {
    await 稳定();
    await 等待绘制();
  }
  await 页.screenshot({ path: join(输出, `${名称}.png`) });
  记录.push({
    名称,
    状态: await 页.evaluate(() => window.__three版__?.读取状态()),
    界面: await 界面(),
  });
}
async function 点击(名称: string) {
  await 页.waitForFunction(
    (名) => window.__three版__?.读取界面().按钮.some((项) => 项.名称 === 名 && 项.可用 !== false),
    名称,
  );
  const 项 = (await 界面())?.按钮.find((项) => 项.名称 === 名称);
  assert.ok(项, 名称);
  await 页.mouse.click(项.左 + 项.宽 / 2, 项.上 + 项.高 / 2);
}
async function 转场(执行: () => Promise<void>, 标记: string, 完成按钮: string) {
  await 执行();
  for (const 阶段 of ["移出", "移入"]) {
    await 页.waitForFunction((阶段) => {
      const 文 = window.__three版__?.读取界面().文字 ?? [];
      const 秒 = Number(文.find((项) => 项.startsWith("退场:"))?.slice(3));
      return 文.includes(`过渡:${阶段}`) && 秒 > 0.08 && 秒 < 0.13;
    }, 阶段);
    assert.equal((await 界面())?.按钮.length, 0, `${标记}${阶段}期间没有旧热区`);
    await 截图(`${标记}-${阶段}`, false);
  }
  await 稳定();
  assert.ok(
    (await 界面())?.按钮.some((项) => 项.名称 === 完成按钮),
    `${标记}恢复新热区`,
  );
  await 截图(`${标记}-完成`);
}
try {
  await 页.goto(地址);
  await 页.waitForFunction(() => window.__three版__);
  await 转场(() => 页.mouse.click(300, 450), "01-菜单进入纯享", "纯享:返回");
  await 转场(() => 点击("纯享:返回"), "02-纯享返回菜单", "开始游戏");
  await 转场(() => 点击("开始游戏"), "03-菜单进入模式", "返回");
  assert.ok((await 界面())?.按钮.some((项) => 项.名称 === "排行榜:极限"));
  await 转场(() => 点击("返回"), "04-模式返回菜单", "开始游戏");
  await 点击("商店");
  await 等待页面("商店");
  await 截图("05-中文商店");
  await 转场(() => 点击("商店:纯享"), "06-商店进入纯享", "商店:返回");
  await 转场(() => 点击("商店:返回"), "07-纯享返回商店", "商店:纯享");
  await 页.mouse.move(200, 720);
  await 页.mouse.wheel(310, 0);
  await 页.waitForFunction(
    () =>
      Number(
        window.__three版__
          ?.读取界面()
          .文字?.find((项) => 项.startsWith("目录滚动:"))
          ?.slice(5),
      ) > 0,
  );
  await 点击("商店地点:紫禁朱墙");
  await 截图("08-深色地点商店");
  await 点击("返回主菜单");
  await 等待页面("主界面");
  await 点击("成就");
  await 等待页面("成就");
  await 截图("09-中文成就上半");
  await 页.mouse.move(200, 450);
  await 页.mouse.wheel(0, 650);
  await 页.waitForFunction(
    () =>
      Number(
        window.__three版__
          ?.读取界面()
          .文字?.find((项) => 项.startsWith("滚动:"))
          ?.slice(3),
      ) > 0,
  );
  await 截图("10-中文成就下半");
  assert.equal((await 界面())?.文字?.filter((项) => /:未解锁:|:已解锁:/.test(项)).length, 12);
  await 点击("返回主菜单");
  await 等待页面("主界面");
  await 页.evaluate(() => window.__three版__?.更新设置({ 语言: "English" }));
  await 点击("开始游戏");
  await 稳定();
  await 截图("11-英文模式");
  await 点击("返回");
  await 稳定();
  await 点击("商店");
  await 等待页面("商店");
  await 截图("12-英文商店");
  await 点击("返回主菜单");
  await 等待页面("主界面");
  await 点击("成就");
  await 等待页面("成就");
  await 截图("13-英文成就");
  assert.deepEqual(错误, []);
  通过 = true;
  console.log(JSON.stringify({ 通过, 截图: 记录.length, 页面错误: 错误 }));
} finally {
  await writeFile(
    join(输出, "结果.json"),
    JSON.stringify({ 通过, 视口: "390×844 DPR1 Chrome模拟视口", 记录, 错误 }, null, 2),
  );
  await 浏览器.close();
}
