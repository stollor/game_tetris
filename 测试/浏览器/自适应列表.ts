import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { chromium } from "playwright";
import type {} from "../../代码/应用/启动";

const 输出 = resolve(".gamemaker/报告/自适应列表");
await mkdir(输出, { recursive: true });
const 浏览器 = await chromium.launch({ channel: "chrome" });
const 页 = await 浏览器.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
const 错误: string[] = [];
页.on("pageerror", (e) => 错误.push(e.message));
const 记录: object[] = [];
async function 点击(名称: string) {
  await 页.waitForFunction(
    (名) => window.__three版__?.读取界面().按钮.some((项) => 项.名称 === 名 && 项.可用 !== false),
    名称,
  );
  const 项 = await 页.evaluate(
    (名) => window.__three版__?.读取界面().按钮.find((项) => 项.名称 === 名),
    名称,
  );
  assert.ok(项);
  await 页.mouse.click(项.左 + 项.宽 / 2, 项.上 + 项.高 / 2);
}
async function 截图(名称: string) {
  const 起 = await 页.evaluate(() => window.__three版__?.读取统计().循环.帧数 ?? 0);
  await 页.waitForFunction((起) => (window.__three版__?.读取统计().循环.帧数 ?? 0) >= 起 + 2, 起);
  await 页.screenshot({ path: join(输出, `${名称}.png`) });
  记录.push({ 名称, 界面: await 页.evaluate(() => window.__three版__?.读取界面()) });
}
try {
  await 页.goto(process.argv[2] ?? "http://127.0.0.1:3001");
  await 页.waitForFunction(() => window.__three版__);
  await 点击("成就");
  await 页.waitForFunction(() => window.__three版__?.读取状态().场景栈.at(-1) === "成就");
  const 文字 = await 页.evaluate(() => window.__three版__?.读取界面().文字 ?? []);
  assert.ok(文字.includes("列表模式:普通"), "12项自绘成就保持普通，绘制只取可视项");
  const 行 = JSON.parse(文字.find((项) => 项.startsWith("首项矩形:"))?.slice(5) ?? "null");
  assert.deepEqual(行, { 左: 6, 上: 0, 宽: 346, 高: 94 });
  assert.equal(16 + 行.左, 390 - (16 + 行.左 + 行.宽), "卡片在屏幕左右留白相等");
  await 截图("01-收藏居中上部");
  await 页.mouse.move(200, 430);
  await 页.mouse.wheel(0, 1000);
  await 页.waitForFunction(() => window.__three版__?.读取界面().文字?.includes("滚动:456"));
  await 截图("02-收藏居中底部");
  assert.equal(
    (await 页.evaluate(() => window.__three版__?.读取界面().文字 ?? [])).filter((项) =>
      /:未解锁:|:已解锁:/.test(项),
    ).length,
    12,
  );
  await 点击("返回主菜单");
  await 点击("成就");
  await 页.waitForFunction(() => window.__three版__?.读取状态().场景栈.at(-1) === "成就");
  await 截图("03-返回后列表");
  await 点击("返回主菜单");
  await 页.evaluate(() => window.__three版__?.更新设置({ 语言: "English" }));
  await 点击("成就");
  await 页.waitForFunction(() => window.__three版__?.读取状态().场景栈.at(-1) === "成就");
  await 截图("04-英文收藏");
  assert.deepEqual(错误, []);
  await Bun.write(
    join(输出, "结果.json"),
    JSON.stringify({ 通过: true, 视口: "390x844 DPR1 Chrome模拟", 错误, 记录 }, null, 2),
  );
  console.log(JSON.stringify({ 通过: true, 截图: 记录.length, 错误 }));
} finally {
  await 浏览器.close();
}
