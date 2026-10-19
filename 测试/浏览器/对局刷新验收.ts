import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import type Phaser from "phaser";
import { chromium } from "playwright";
import { 执行测试操作, 读取测试快照 } from "../../框架/开发/浏览器测试操作";
import { 计算画布点击位置 } from "../../框架/开发/画布点击";
import type { 界面数值面板 } from "../../框架/界面/数值面板";
import { 准备页面 } from "./性能准备";
import { 准备自动游玩 } from "./方块自动游玩";

declare global {
  interface Window {
    __刷新验收__: { 信息栏: number; 预览: number };
  }
}
type 对局现场 = Phaser.Scene & { 信息栏: 界面数值面板; 绘制下一个方块(): void };
const 输出 = "reports/hud-refresh";
await mkdir(输出, { recursive: true });
const 浏览器 = await chromium.launch({ channel: "chrome" });
const 页 = await 浏览器.newPage({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 1,
  isMobile: true,
  hasTouch: true,
});
const 错误: string[] = [];
页.on("pageerror", (错) => 错误.push(错.message));
try {
  await 准备页面(页, process.env.GAME_URL ?? "http://127.0.0.1:3221", false);
  await 准备自动游玩(页, "冲刺");
  await 页.evaluate(() => {
    const 场景 = window.__游戏__.scene.getScene("再消一行对局") as 对局现场;
    window.__刷新验收__ = { 信息栏: 0, 预览: 0 };
    const 原信息栏 = 场景.信息栏.更新;
    场景.信息栏.更新 = (...参数: Parameters<typeof 原信息栏>) => {
      window.__刷新验收__.信息栏++;
      return 原信息栏.apply(场景.信息栏, 参数);
    };
    const 原预览 = 场景.绘制下一个方块;
    场景.绘制下一个方块 = () => {
      window.__刷新验收__.预览++;
      原预览.call(场景);
    };
  });
  for (const 键 of ["ArrowLeft", "ArrowLeft", "ArrowRight", "x", "z"]) {
    await 执行测试操作(页, { action: "按键", keyboard: { key: 键 } });
  }
  const 移动后 = await 页.evaluate(() => ({ ...window.__刷新验收__ }));
  await writeFile(`${输出}/移动.json`, JSON.stringify(移动后, null, 2));
  assert.deepEqual(移动后, { 信息栏: 0, 预览: 0 }, "仅移动和旋转不重建未变化的面板");
  await 执行测试操作(页, { action: "硬降", keyboard: { key: "Space" } });
  await 页.waitForTimeout(350);
  const 落块后 = await 页.evaluate(() => {
    const 场景 = window.__游戏__.scene.getScene("再消一行对局") as 对局现场;
    const 分数 = 场景.信息栏.getByName("数值.1") as Phaser.GameObjects.Text;
    return { ...window.__刷新验收__, 分数: 分数.text, 状态: window.__再消一行测试__?.读取状态() };
  });
  assert.ok(落块后.信息栏 > 0 && 落块后.预览 > 0);
  assert.ok(落块后.状态);
  assert.equal(落块后.分数, String(落块后.状态.分数).padStart(6, "0"));
  const 前 = await 页.evaluate(() => window.__再消一行测试__?.读取状态().当前格子);
  const 快照 = await 读取测试快照(页);
  const 按钮 = 快照.interactives.find(
    (项) => 项.name === "touch.right" && 项.enabled && 项.visible,
  );
  const 画布 = await 页.locator("canvas").first().boundingBox();
  assert.ok(按钮 && 画布);
  const 坐标 = 计算画布点击位置(按钮, 画布, { 宽度: 快照.width, 高度: 快照.height });
  await 页.touchscreen.tap(坐标.x, 坐标.y);
  const 后 = await 页.evaluate(() => window.__再消一行测试__?.读取状态().当前格子);
  assert.notDeepEqual(前, 后, "触屏横移即时更新棋盘");
  await 页.screenshot({ path: `${输出}/对局.png` });
  assert.deepEqual(错误, []);
  await writeFile(`${输出}/结果.json`, JSON.stringify({ 移动后, 落块后, 错误 }, null, 2));
  console.log("移动旋转不刷新无变化面板，硬降后分数/预览更新，真实触屏横移通过");
} finally {
  await 浏览器.close();
}
