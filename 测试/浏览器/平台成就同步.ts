import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { chromium } from "playwright";
import type {} from "../../代码/应用/启动";
import type { Tap成就管理器 } from "../../框架/平台/TapTap/宿主类型";

declare global {
  interface Window {
    __成就测试__?: { 请求: string[] };
  }
}
const 地址 = process.argv[2] ?? "http://127.0.0.1:3001";
const 输出 = resolve("reports/更新准备/成就浏览器");
await mkdir(输出, { recursive: true });
const 浏览器 = await chromium.launch({ channel: "chrome" });
const 环境 = await 浏览器.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 1,
  hasTouch: true,
});
const 页 = await 环境.newPage();
const 错误: string[] = [];
页.on("pageerror", (e) => 错误.push(e.message));
await 页.addInitScript(() => {
  if (!sessionStorage.getItem("成就夹具")) {
    localStorage.setItem(
      "neon-pulse:achievements",
      JSON.stringify({ 版本: 1, 数据: { "first-lock": { 进度: 1, 解锁时间: 1 } } }),
    );
    localStorage.removeItem("旅行版:成就同步");
    sessionStorage.setItem("成就夹具", "1");
  }
  const 请求: string[] = [];
  window.__成就测试__ = { 请求 };
  let 监听: Parameters<NonNullable<Tap成就管理器["registerListener"]>>[0] = {};
  const 管理器: Tap成就管理器 = {
    registerListener: (值) => {
      监听 = 值;
    },
    unlockAchievement: ({ achievementId }) => {
      请求.push(achievementId);
      setTimeout(() => {
        if (achievementId === "FIRST_LOCK" && !sessionStorage.getItem("失败过")) {
          sessionStorage.setItem("失败过", "1");
          监听.onAchievementFailure?.(achievementId, 500001, "achievement pending publish");
        } else 监听.onAchievementSuccess?.(0, { achievementId });
      }, 20);
    },
  };
  window.tap = { createAchievementManager: () => 管理器 };
});
async function 点击(名称: string) {
  await 页.waitForFunction(
    (n) => window.__three版__?.读取界面().按钮.some((k) => k.名称 === n && k.可用 !== false),
    名称,
  );
  const 键 = await 页.evaluate(
    (n) => window.__three版__?.读取界面().按钮.find((k) => k.名称 === n),
    名称,
  );
  assert(键);
  await 页.mouse.click(键.左 + 键.宽 / 2, 键.上 + 键.高 / 2);
}
const 同步状态 = () =>
  页.evaluate(() => JSON.parse(localStorage.getItem("旅行版:成就同步") ?? "{}"));
try {
  await 页.goto(地址);
  await 页.waitForFunction(() => !!window.__three版__);
  await 页.bringToFront();
  await 页.waitForFunction(
    () =>
      JSON.parse(localStorage.getItem("旅行版:成就同步") ?? "{}")["first-lock"]?.状态 === "失败",
  );
  assert.equal((await 同步状态())["first-lock"].状态, "失败");
  await 点击("成就");
  await 页.waitForFunction(
    () =>
      JSON.parse(localStorage.getItem("旅行版:成就同步") ?? "{}")["first-lock"]?.状态 === "已同步",
  );
  await 页.waitForFunction(() => !window.__three版__?.读取界面().文字?.includes("页面开合:播放中"));
  assert.deepEqual(await 页.evaluate(() => window.__成就测试__?.请求), [
    "FIRST_LOCK",
    "FIRST_LOCK",
  ]);
  await 页.screenshot({ path: join(输出, "历史成就补同步.png") });
  await 点击("返回主菜单");
  await 页.waitForFunction(() => window.__three版__?.读取状态().页面 === "菜单");
  await 点击("开始游戏");
  await 点击("开始:马拉松");
  await 页.waitForFunction(
    () =>
      window.__three版__?.读取界面().文字?.includes("入场:完成") &&
      window.__three版__?.读取状态().页面 === "对局",
  );
  await 点击("暂存操作");
  await 页.keyboard.press("Space");
  await 页.waitForFunction(
    () => JSON.parse(localStorage.getItem("旅行版:成就同步") ?? "{}").hold?.状态 === "已同步",
  );
  assert.equal(
    (await 页.evaluate(() => window.__three版__?.读取状态()))?.阶段,
    "进行中",
    "新成就无需等结算就同步",
  );
  assert.equal(
    await 页.evaluate(() => window.__成就测试__?.请求.filter((id) => id === "HOLD").length),
    1,
  );
  await 点击("暂停");
  await 点击("返回主菜单");
  await 页.reload();
  await 页.waitForFunction(() => !!window.__three版__);
  assert.deepEqual(
    await 页.evaluate(() => window.__成就测试__?.请求),
    [],
    "已成功项刷新后不重复上报",
  );
  assert.deepEqual(错误, []);
  const 结果 = {
    通过: true,
    性质: "Chrome宿主协议模拟，非TapTap App实测",
    检查: [
      "启动补旧成就",
      "失败进入成就页重试",
      "官方监听回调确认",
      "新解锁结算前同步",
      "已同步持久去重",
    ],
    状态: await 同步状态(),
    错误,
  };
  await writeFile(join(输出, "结果.json"), JSON.stringify(结果, null, 2));
  console.log(JSON.stringify(结果));
} catch (错误) {
  console.error(
    JSON.stringify(
      await 页.evaluate(() => ({
        状态: window.__three版__?.读取状态(),
        界面: window.__three版__?.读取界面(),
        请求: window.__成就测试__,
        同步: localStorage.getItem("旅行版:成就同步"),
      })),
    ),
  );
  throw 错误;
} finally {
  await 环境.close();
  await 浏览器.close();
}
