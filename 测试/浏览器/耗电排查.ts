import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import type Phaser from "phaser";
import { chromium, type Page } from "playwright";

declare global {
  interface Window {
    __游戏__: Phaser.Game;
    __烘焙统计__: { 烘焙次数: number };
  }
}

const 地址 = process.argv[2] ?? "http://127.0.0.1:3221";
const 标签 = process.argv[3] ?? "current";
const 输出 = "reports/power-audit";
await mkdir(输出, { recursive: true });
const 浏览器 = await chromium.launch({ channel: "chrome" });
const 错误: string[] = [];
const 结果: unknown[] = [];

async function 采样(页: Page, 名称: string, 按住 = false) {
  await 页.waitForTimeout(1800);
  const 会话 = await 页.context().newCDPSession(页);
  await 会话.send("Performance.enable");
  await 会话.send("Profiler.enable");
  const 前 = await 会话.send("Performance.getMetrics");
  await 会话.send("Profiler.start");
  if (按住) await 页.keyboard.down("ArrowLeft");
  try {
    const 帧 = await 页.evaluate(async () => {
      const 游戏 = window.__游戏__;
      let 更新 = 0,
        渲染 = 0,
        更新毫秒 = 0,
        渲染毫秒 = 0,
        逻辑毫秒 = 0;
      let 更新起 = 0,
        渲染起 = 0;
      const 前步 = () => {
        更新起 = performance.now();
      };
      const 后步 = (_时间: number, 间隔: number) => {
        更新++;
        逻辑毫秒 += 间隔;
        更新毫秒 += performance.now() - 更新起;
      };
      const 前画 = () => {
        渲染起 = performance.now();
      };
      const 后画 = () => {
        渲染++;
        渲染毫秒 += performance.now() - 渲染起;
      };
      游戏.events
        .on("prestep", 前步)
        .on("poststep", 后步)
        .on("prerender", 前画)
        .on("postrender", 后画);
      const 烘焙初 = window.__烘焙统计__.烘焙次数;
      const 起 = performance.now();
      await new Promise((完成) => setTimeout(完成, 4000));
      游戏.events
        .off("prestep", 前步)
        .off("poststep", 后步)
        .off("prerender", 前画)
        .off("postrender", 后画);
      return {
        秒: (performance.now() - 起) / 1000,
        更新,
        渲染,
        更新毫秒,
        渲染毫秒,
        逻辑毫秒,
        烘焙: window.__烘焙统计__.烘焙次数 - 烘焙初,
        像素: [游戏.canvas.width, 游戏.canvas.height],
        限帧: 游戏.loop.fpsLimit,
        场景: 游戏.scene.getScenes(true).map((s) => s.scene.key),
      };
    });
    const 后 = await 会话.send("Performance.getMetrics");
    const { profile } = await 会话.send("Profiler.stop");
    await writeFile(`${输出}/${标签}-${名称}.cpuprofile`, JSON.stringify(profile));
    const 自耗时 = new Map<number, number>();
    profile.samples?.forEach((id, i) => {
      自耗时.set(id, (自耗时.get(id) ?? 0) + (profile.timeDeltas?.[i] ?? 0));
    });
    const 热点 = profile.nodes
      .map((n) => ({
        函数: n.callFrame.functionName,
        地址: n.callFrame.url,
        行: n.callFrame.lineNumber + 1,
        毫秒: (自耗时.get(n.id) ?? 0) / 1000,
      }))
      .filter((n) => !["(idle)", "(root)", "(program)"].includes(n.函数))
      .sort((a, b) => b.毫秒 - a.毫秒)
      .slice(0, 12);
    const 指标 = (名: string) => {
      const p = 前.metrics.find((m) => m.name === 名),
        q = 后.metrics.find((m) => m.name === 名);
      assert.ok(p && q, 名);
      return (q.value - p.value) * 1000;
    };
    assert.ok(帧.更新 > 0, 名称);
    const 项 = {
      名称,
      按住,
      ...帧,
      任务毫秒: 指标("TaskDuration"),
      脚本毫秒: 指标("ScriptDuration"),
      热点,
    };
    console.log(JSON.stringify(项));
    结果.push(项);
  } finally {
    if (按住) await 页.keyboard.up("ArrowLeft");
    await 会话.detach();
  }
}

async function 开页(动态: boolean) {
  const 页 = await 浏览器.newPage({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  });
  页.on("pageerror", (e) => 错误.push(e.message));
  await 页.addInitScript((动态) => {
    localStorage.setItem(
      "再消一行:设置",
      JSON.stringify({
        背景主题: "极光原野",
        背景动态: 动态,
        省电模式: "关",
        背景音乐: false,
        音乐音量: 0,
        背景音效音量: 0,
      }),
    );
  }, 动态);
  // 正式域名关闭本地开发扫描；只保留 perf-debug 观察口。
  await 页.route("http://one-more-line.local/**", (r) =>
    r.continue({ url: r.request().url().replace("http://one-more-line.local", 地址) }),
  );
  await 页.goto("http://one-more-line.local/?perf-debug");
  await 页.waitForFunction(() => window.__游戏__?.scene.isActive("开始菜单"));
  return 页;
}

async function 进入对局(页: Page) {
  await 页.evaluate(() => {
    window.__游戏__.scene.stop("开始菜单");
    window.__游戏__.scene.start("再消一行对局", { 模式: "马拉松" });
  });
  await 页.waitForFunction(() => window.__游戏__.scene.isActive("再消一行对局"));
}

try {
  const 动态页 = await 开页(true);
  await 采样(动态页, "菜单动态");
  await 动态页.evaluate(() => {
    const 菜单 = window.__游戏__.scene.getScene("开始菜单") as Phaser.Scene & { 进入纯享(): void };
    菜单.进入纯享();
  });
  await 采样(动态页, "纯享");
  await 进入对局(动态页);
  await 采样(动态页, "动态马拉松");
  await 采样(动态页, "动态马拉松长按", true);
  await 动态页.close();
  const 静态页 = await 开页(false);
  await 进入对局(静态页);
  await 采样(静态页, "静态马拉松");
  await 静态页.keyboard.press("p");
  await 采样(静态页, "静态暂停");
  await 静态页.keyboard.press("p");
  await 采样(静态页, "静态恢复");
  await 静态页.close();
  await writeFile(
    `${输出}/${标签}.json`,
    JSON.stringify({ 环境: "Chrome 手机模拟390×844 DPR3，非真机功耗", 结果, 错误 }, null, 2),
  );
  assert.deepEqual(错误, []);
} finally {
  await 浏览器.close();
}
