import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { chromium, type Page } from "playwright";
import type {} from "../../../代码/应用/启动";

/**
 * 英文界面覆盖验收：语言设为 English，逐页走主菜单、模式选择、排行榜、设置、成就、商店、
 * 五种模式的对局（含暂停、对局设置、结束结算），读取框架记录的
 * 「翻译后仍含汉字的文案」，每个场景必须为空。
 *
 * - 默认：保存语言后重新加载，等同玩家下次进入游戏。
 * - `--live`：不重新加载，等同玩家在设置里当场切语言，页面里缓存的旧语言也要被对照表兜住。
 *
 * 手机 390×844，DPR1，只截当前视口；串行执行（失焦会触发自动暂停）。
 * 用法：bun 测试/浏览器/英文覆盖.ts [游戏地址] [--live]
 */
const 地址 = process.argv.find((项) => /^https?:/.test(项)) ?? "http://127.0.0.1:3000";
const 当场切换 = process.argv.includes("--live");
const 输出 = resolve(
  当场切换 ? ".gamemaker/报告/英文覆盖/当场切换" : ".gamemaker/报告/英文覆盖/重新加载",
);
await mkdir(输出, { recursive: true });
const 浏览器 = await chromium.launch({ channel: "chrome" });
const 环境 = await 浏览器.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 1,
  hasTouch: true,
});
const 页 = await 环境.newPage();
const 错误: string[] = [];
页.on("pageerror", (错) => 错误.push(错.message));
const 界面 = () => 页.evaluate(() => window.__three版__?.读取界面());
const 状态 = () => 页.evaluate(() => window.__three版__?.读取状态());
const 未翻译 = () => 页.evaluate(() => window.__未翻译文案__?.() ?? []);
const 缺口: Record<string, string[]> = {};
const 已见 = new Set<string>();

async function 稳定(页面: Page) {
  await 页面.waitForTimeout(600);
  await 页面
    .waitForFunction(
      () => !window.__three版__?.读取界面().文字?.includes("页面开合:播放中"),
      null,
      {
        timeout: 6000,
      },
    )
    .catch(() => {});
  await 页面.waitForTimeout(250);
}
async function 有按钮(名称: string) {
  return Boolean((await 界面())?.按钮.some((键) => 键.名称 === 名称 && 键.可用 !== false));
}
async function 点击(名称: string) {
  await 页.waitForFunction(
    (名) => window.__three版__?.读取界面().按钮.some((键) => 键.名称 === 名 && 键.可用 !== false),
    名称,
    { timeout: 6000 },
  );
  const 键 = (await 界面())?.按钮.find((项) => 项.名称 === 名称);
  assert(键, 名称);
  await 页.mouse.click(键.左 + 键.宽 / 2, 键.上 + 键.高 / 2);
}
async function 尝试点击(名称: string) {
  if (!(await 有按钮(名称))) return false;
  await 点击(名称);
  return true;
}
async function 记录(场景: string) {
  await 稳定(页);
  const 全部 = await 未翻译();
  const 新增 = 全部.filter((文案) => !已见.has(文案));
  for (const 文案 of 新增) 已见.add(文案);
  if (新增.length > 0) 缺口[场景] = 新增;
  await 页.screenshot({ path: join(输出, `${场景}.png`) });
}
async function 重新进入() {
  await 页.goto(地址);
  await 页.waitForFunction(() => !!window.__three版__);
  await 页.bringToFront();
  await 页.evaluate(() =>
    window.__three版__?.更新设置({ 背景动态: false, 音效音量: 0, 音乐音量: 0 }),
  );
  await 稳定(页);
}
async function 开局(模式: string) {
  await 点击("开始游戏");
  await 点击(`开始:${模式}`);
  await 页.waitForFunction(() => window.__three版__?.读取界面().文字?.includes("入场:完成"), null, {
    timeout: 10000,
  });
}
async function 打到结束() {
  for (let 次 = 0; 次 < 80; 次++) {
    if ((await 状态())?.阶段 === "结束") return;
    await 页.evaluate(() => window.__three版__?.操作("硬降"));
    await 页.waitForTimeout(40);
  }
}

try {
  await 页.goto(地址);
  await 页.waitForFunction(() => !!window.__three版__);
  await 页.bringToFront();
  await 页.evaluate(() =>
    window.__three版__?.更新设置({
      语言: "English",
      背景动态: false,
      音效音量: 0,
      音乐音量: 0,
    }),
  );
  if (!当场切换) await 重新进入();
  await 记录("菜单");

  // 模式选择与排行榜
  await 点击("开始游戏");
  await 记录("模式选择");
  for (const 模式 of ["马拉松", "冲刺", "极限", "每日挑战"]) {
    if (await 尝试点击(`排行榜:${模式}`)) {
      await 记录(`排行榜-${模式}`);
      await 点击("返回").catch(async () => 点击("返回主菜单"));
      await 稳定(页);
    }
  }
  await 点击("返回");
  await 稳定(页);

  // 设置三个页签和套装/自定义子页签
  await 点击("设置");
  await 记录("设置-常规");
  for (const 页签 of ["页签:外观", "页签:套装", "页签:自定义", "页签:账号"]) {
    if (await 尝试点击(页签)) await 记录(`设置-${页签.slice(3)}`);
  }
  await 点击("返回主菜单");
  await 稳定(页);

  // 成就
  await 点击("成就");
  await 记录("成就");
  await 点击("返回主菜单");
  await 稳定(页);

  // 商店：六个部位、换地点、购买确认、纯享
  await 点击("商店");
  await 记录("商店");
  for (const 部位 of ["静态背景", "动态背景", "界面样式", "方块外观", "音效套装", "音乐"]) {
    if (await 尝试点击(`商店部位:${部位}`)) await 记录(`商店-${部位}`);
  }
  if (await 尝试点击("商店地点:丽江雪山")) await 记录("商店-换地点");
  const 购买 = (await 界面())?.按钮.find((键) => 键.名称.startsWith("购买:") && 键.可用 !== false);
  if (购买) {
    await 页.mouse.click(购买.左 + 购买.宽 / 2, 购买.上 + 购买.高 / 2);
    await 记录("商店-购买确认");
    if (!(await 尝试点击("确认交易"))) await 尝试点击("取消交易");
    await 记录("商店-确认后");
    await 尝试点击("取消交易");
    await 尝试点击("关闭交易");
  }
  if (await 尝试点击("商店:纯享")) {
    await 记录("商店-纯享");
    await 尝试点击("商店:返回");
  }
  await 稳定(页);
  await 点击("返回主菜单").catch(() => {});

  // 对局：暂停层、对局设置、各模式结束结算
  await 重新进入();
  await 开局("马拉松");
  await 记录("对局-马拉松");
  await 页.evaluate(() => window.__three版__?.操作("软降"));
  await 页.evaluate(() => window.__three版__?.操作("暂存"));
  await 点击("暂停");
  await 记录("对局-暂停");
  if (await 尝试点击("对局设置")) {
    await 记录("对局-设置");
    for (const 名称 of (await 界面())?.按钮.map((键) => 键.名称) ?? []) {
      if (/^(设置|开关|选项|对局设置):/.test(名称)) {
        await 点击(名称).catch(() => {});
        await 页.waitForTimeout(150);
      }
    }
    await 记录("对局-设置切换后");
    await 页.keyboard.press("Escape");
    await 稳定(页);
  }
  await 点击("继续").catch(() => {});
  await 打到结束();
  await 记录("结算-马拉松");

  for (const 模式 of ["冲刺", "极限", "每日挑战", "练习"]) {
    await 重新进入();
    await 开局(模式);
    await 记录(`对局-${模式}`);
    await 打到结束();
    await 记录(`结算-${模式}`);
  }

  console.log(JSON.stringify({ 缺口, 页面错误: 错误 }, null, 2));
  assert.deepEqual(错误, [], "页面不应有运行错误");
  assert.equal(Object.keys(缺口).length, 0, "英文界面仍有未翻译的汉字文案");
} finally {
  await 浏览器.close();
}
