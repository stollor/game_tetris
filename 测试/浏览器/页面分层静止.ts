import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "playwright";

/** 分层静止截图（验收辅助）：对局、暂停菜单、设置、成就、商店、商店纯享。 */

const 地址 = process.argv[2] ?? "http://127.0.0.1:3000";
const 输出 = resolve("reports/过渡抓帧/静止");
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
const 拍 = async (名: string) => {
  await 页.waitForTimeout(320);
  await 页.screenshot({ path: resolve(输出, `${名}.png`) });
  console.log("拍", 名);
};

await 页.goto(地址);
await 页.waitForFunction(() => !!window.__three版__);
await 页.bringToFront();
await 页.evaluate(() => window.__three版__?.更新设置({ 背景动态: false, 省电模式: "开" }));
await 页.waitForTimeout(400);

await 点("开始游戏");
await 等页面("模式选择");
await 等过渡结束();
await 拍("01-模式选择");

await 点("开始:马拉松");
await 等页面("对局");
await 页.waitForTimeout(2400);
await 拍("02-对局");

await 页.keyboard.press("KeyP");
await 等页面("暂停菜单");
await 拍("03-暂停菜单");
// 回菜单：直接重开页面，避免依赖暂停菜单的按钮名。
await 页.goto(地址);
await 页.waitForFunction(() => !!window.__three版__);
await 页.evaluate(() => window.__three版__?.更新设置({ 背景动态: false, 省电模式: "开" }));
await 页.bringToFront();
await 页.waitForTimeout(500);
await 拍("04-菜单");

await 点("设置");
await 等页面("设置");
await 等过渡结束();
await 拍("05-设置");
await 点("返回主菜单");
await 等页面("菜单");
await 页.waitForTimeout(400);

await 点("成就");
await 等页面("成就");
await 等过渡结束();
await 拍("06-成就");
await 点("返回主菜单");
await 等页面("菜单");
await 页.waitForTimeout(400);

await 点("商店");
await 等页面("商店");
await 等过渡结束();
await 页.waitForTimeout(1200);
await 拍("07-商店");

console.log("错误", 错误);
await 浏览器.close();
if (错误.length) process.exitCode = 1;
