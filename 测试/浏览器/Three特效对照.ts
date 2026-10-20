import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { chromium } from "playwright";
import type {} from "../../代码/three版/启动";
import type {} from "../../代码/场景/对局/对局";

const 输出 = resolve("reports/视觉返工/特效对照");
await mkdir(输出, { recursive: true });
const 浏览器 = await chromium.launch({ channel: "chrome" });
const 错误: string[] = [];
const 记录: object[] = [];
try {
  for (const 引擎 of ["phaser", "three"]) {
    const 目录 = join(输出, 引擎);
    await mkdir(目录, { recursive: true });
    const 上下文 = await 浏览器.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
      recordVideo: { dir: 目录, size: { width: 390, height: 844 } },
    });
    const 页 = await 上下文.newPage();
    页.on("pageerror", (错) => 错误.push(`${引擎}: ${错.message}`));
    页.on("console", (项) => {
      if (项.type() === "error") 错误.push(`${引擎}: ${项.text()}`);
    });
    await 页.addInitScript(() =>
      localStorage.setItem(
        "再消一行:设置",
        JSON.stringify({ 背景动态: false, 省电模式: "关", 音乐音量: 0, 音效音量: 80 }),
      ),
    );
    await 页.goto(`http://127.0.0.1:${引擎 === "three" ? 3000 : 3220}/?perf-debug`);
    await 页.waitForFunction(
      (引擎) => (引擎 === "three" ? !!window.__three版__ : !!window.__GAMEMAKER_TEST__),
      引擎,
    );
    for (const 名称 of 引擎 === "three"
      ? ["开始游戏", "开始:马拉松"]
      : ["menu.start", "mode.马拉松"]) {
      const 框 = await 页.evaluate(
        ({ 引擎, 名称 }) => {
          if (引擎 === "three") {
            const 项 = window.__three版__?.读取界面().按钮.find((项) => 项.名称 === 名称);
            if (项) return { x: 项.左 + 项.宽 / 2, y: 项.上 + 项.高 / 2 };
          }
          const 快照 = window.__GAMEMAKER_TEST__?.getSnapshot();
          const 项 = 快照?.interactives.find((项) => 项.name === 名称)?.bounds;
          const 画布 = document.querySelector("canvas")?.getBoundingClientRect();
          return 快照 && 项 && 画布
            ? {
                x: 画布.x + ((项.x + 项.width / 2) / 快照.width) * 画布.width,
                y: 画布.y + ((项.y + 项.height / 2) / 快照.height) * 画布.height,
              }
            : null;
        },
        { 引擎, 名称 },
      );
      assert.ok(框, `${引擎} ${名称}`);
      await 页.mouse.click(框.x, 框.y);
      await 页.waitForTimeout(120);
    }
    await 页.waitForFunction(() => !!window.__再消一行测试__);
    for (const 事件 of ["硬降锁定", "单行", "四行", "连击背靠背", "目标达成", "结算金币"]) {
      const 触发 = await 页.evaluate((事件) => {
        const 桥 = window.__再消一行测试__;
        if (!桥) throw new Error("对局桥缺失");
        if (事件 === "硬降锁定") 桥.设置序列(["T", "I", "O"]);
        if (事件 === "单行") 桥.准备单行消除();
        if (事件 === "四行") 桥.准备四行消除(false, true);
        if (事件 === "连击背靠背") 桥.准备四行消除(true, true);
        if (事件 === "目标达成") 桥.准备目标达成();
        if (事件 === "结算金币") 桥.准备结算(false);
        else 桥.硬降();
        return performance.now();
      }, 事件);
      for (const 毫秒 of [0, 60, 150, 350, 700, 1100]) {
        const 已过 = await 页.evaluate((时刻) => performance.now() - 时刻, 触发);
        if (毫秒 > 已过) await 页.waitForTimeout(毫秒 - 已过);
        const 状态 = await 页.evaluate(
          (引擎) => ({
            实际时刻: performance.now(),
            状态:
              引擎 === "three"
                ? window.__three版__?.读取状态()
                : window.__再消一行测试__?.读取状态(),
            界面:
              引擎 === "three"
                ? window.__three版__?.读取界面()
                : window.__再消一行测试__?.读取界面(),
          }),
          引擎,
        );
        记录.push({ 引擎, 事件, 目标毫秒: 毫秒, 经过毫秒: 状态.实际时刻 - 触发, ...状态 });
        await 页.screenshot({ path: join(目录, `${事件}-${毫秒}.png`) });
      }
      const 状态 = await 页.evaluate(() => window.__再消一行测试__?.读取状态());
      if (事件 === "单行") assert.equal(状态?.消行数, 1, `${引擎} 单行`);
      if (事件 === "四行") assert.equal(状态?.消行数, 4, `${引擎} 四行`);
      if (事件 === "连击背靠背") assert.equal(状态?.消行数, 8, `${引擎} 连续四行`);
      console.log(`${引擎} ${事件}`);
    }
    await 上下文.close();
  }
  assert.deepEqual(错误, []);
} finally {
  await writeFile(
    join(输出, "结果.json"),
    JSON.stringify({ 环境: "Chromium模拟视口390×844 DPR2，不是真机", 错误, 记录 }, null, 2),
  );
  await 浏览器.close();
}
