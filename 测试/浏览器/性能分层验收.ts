import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import type Phaser from "phaser";
import { chromium } from "playwright";
import type {} from "../../代码/场景/对局/对局";

declare global {
  interface Window {
    __分层计数__: Record<string, number>;
  }
}

const 地址 = process.argv[2] ?? "http://127.0.0.1:3221";
const 输出 = "reports/performance-iteration";
await mkdir(输出, { recursive: true });
const 浏览器 = await chromium.launch({ channel: "chrome" });
const 页 = await 浏览器.newPage({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
});
const 错误: string[] = [];
页.on("pageerror", (e) => 错误.push(e.message));
try {
  await 页.addInitScript(() =>
    localStorage.setItem("再消一行:设置", JSON.stringify({ 省电模式: "关", 背景动态: true })),
  );
  await 页.goto(`${地址}/?perf-debug`);
  await 页.waitForFunction(() => window.__游戏__?.scene.isActive("开始菜单"));
  await 页.keyboard.press("Enter");
  await 页.waitForTimeout(400);
  await 页.keyboard.press("Enter");
  await 页.waitForFunction(() => Boolean(window.__再消一行测试__));
  await 页.evaluate(() => {
    window.__再消一行测试__?.准备四行消除(false, true);
    const s = window.__游戏__.scene.getScene("再消一行对局") as Phaser.Scene & {
      绘制下一个方块(): void;
      信息栏: { 更新(值: string[]): void };
    };
    const 计数: Record<string, number> = {};
    window.__分层计数__ = 计数;
    const 扫描 = (列表: Phaser.GameObjects.GameObject[]) => {
      for (const n of 列表) {
        if (n.type === "Graphics" && n.name.startsWith("board.")) {
          const g = n as Phaser.GameObjects.Graphics;
          const 原 = g.clear;
          g.clear = function () {
            计数[this.name] = (计数[this.name] ?? 0) + 1;
            return 原.call(this);
          };
        }
        if (n.type === "Container") 扫描((n as Phaser.GameObjects.Container).list);
      }
    };
    扫描(s.children.list);
    const 原预告 = s.绘制下一个方块;
    s.绘制下一个方块 = function () {
      计数.预告 = (计数.预告 ?? 0) + 1;
      原预告.call(this);
    };
    const 原数值 = s.信息栏.更新;
    s.信息栏.更新 = function (值) {
      计数.数值 = (计数.数值 ?? 0) + 1;
      原数值.call(this, 值);
    };
  });
  await 页.waitForTimeout(250);
  const 前 = await 页.evaluate(() => ({ ...window.__分层计数__ }));
  for (const 键 of ["ArrowLeft", "ArrowRight", "KeyX", "KeyX"]) await 页.keyboard.press(键);
  const 后 = await 页.evaluate(() => ({ ...window.__分层计数__ }));
  assert.equal(后["board.fixed"] ?? 0, 前["board.fixed"] ?? 0, "移旋不重画固定层");
  assert.ok((后["board.active"] ?? 0) > (前["board.active"] ?? 0), "活动层实际变化");
  await 页.evaluate(() => window.__再消一行测试__?.准备四行消除(false, true));
  const 锁前 = await 页.evaluate(() => window.__分层计数__["board.fixed"] ?? 0);
  await 页.keyboard.press("Space");
  assert.equal(await 页.evaluate(() => window.__再消一行测试__?.读取状态().消行数), 4);
  assert.ok(
    await 页.evaluate(() => (window.__分层计数__["board.fixed"] ?? 0) > 0),
    "消行刷新固定层",
  );
  const 锁后 = await 页.evaluate(() => window.__分层计数__["board.fixed"] ?? 0);
  assert.ok(锁后 > 锁前);
  await 页.screenshot({ path: `${输出}/四行消除.png` });
  await 页.waitForTimeout(1100);
  assert.equal(await 页.evaluate(() => window.__再消一行测试__?.读取界面().消行特效?.活跃), false);
  await 页.evaluate(() => window.__再消一行测试__?.设置序列(["T", "I", "O"]));
  await 页.waitForTimeout(250);
  const 静前 = await 页.evaluate(() => ({ ...window.__分层计数__ }));
  await 页.waitForTimeout(500);
  const 静后 = await 页.evaluate(() => ({ ...window.__分层计数__ }));
  assert.equal(静后.预告, 静前.预告, "普通计时不刷新预告");
  assert.equal(静后.数值, 静前.数值, "普通计时不刷新数值栏");
  const 背景 = await 页.evaluate(async () => {
    const s = window.__游戏__.scene.getScene("再消一行对局") as Phaser.Scene & {
      背景动画层: Phaser.GameObjects.Graphics & {
        __替身?: { x: number; y: number; 透明度: number; 贴图: Phaser.GameObjects.Image }[];
      };
    };
    const g = s.背景动画层;
    const 前 = g.__替身?.map((x) => [x.x, x.y, x.透明度]);
    await new Promise((f) => setTimeout(f, 500));
    return {
      前,
      后: g.__替身?.map((x) => [x.x, x.y, x.透明度]),
      命令: g.commandBuffer.length,
      贴图数: g.__替身?.length,
    };
  });
  assert.equal(背景.贴图数, 43, "三帘幕与40光点复用贴图");
  assert.equal(背景.命令, 0, "动态极光不重复生成矢量命令");
  assert.notDeepEqual(背景.前, 背景.后, "贴图位置与明暗仍在动态变化");
  await 页.screenshot({ path: `${输出}/对局.png` });
  const 点击 = async (名称: string) => {
    const 框 = await 页.evaluate(
      (名称) =>
        window.__GAMEMAKER_TEST__
          ?.getSnapshot()
          .interactives.find((项) => 项.name === 名称 && 项.visible && 项.enabled)?.bounds,
      名称,
    );
    const 画布 = await 页.locator("canvas").boundingBox();
    const 尺寸 = await 页.evaluate(() => ({
      宽: window.__游戏__.canvas.width,
      高: window.__游戏__.canvas.height,
    }));
    assert.ok(框 && 画布, 名称);
    await 页.touchscreen.tap(
      画布.x + ((框.x + 框.width / 2) * 画布.width) / 尺寸.宽,
      画布.y + ((框.y + 框.height / 2) * 画布.height) / 尺寸.高,
    );
  };
  const 模式验收 = [];
  for (const 模式 of ["冲刺", "极限"]) {
    await 页.reload();
    await 页.waitForFunction(() => window.__游戏__?.scene.isActive("开始菜单"));
    await 页.keyboard.press("Enter");
    await 页.waitForTimeout(350);
    await 点击(`mode.${模式}`);
    await 页.waitForFunction(() => Boolean(window.__再消一行测试__));
    const 时前 = await 页.evaluate(() => window.__再消一行测试__?.读取界面().模式文字.文本);
    await 页.waitForTimeout(1100);
    const 时后 = await 页.evaluate(() => window.__再消一行测试__?.读取界面().模式文字.文本);
    assert.notEqual(时前, 时后, `${模式}独立计时继续更新`);
    await 页.keyboard.press("p");
    const 暂停 = await 页.evaluate(() => window.__再消一行测试__?.读取状态().有效用时);
    await 页.waitForTimeout(450);
    assert.equal(await 页.evaluate(() => window.__再消一行测试__?.读取状态().有效用时), 暂停);
    await 页.keyboard.press("p");
    await 页.keyboard.press("c");
    assert.ok(await 页.evaluate(() => window.__再消一行测试__?.读取状态().暂存方块));
    await 页.evaluate(() => window.__再消一行测试__?.准备结算(true));
    const 结算 = await 页.evaluate(() => window.__再消一行测试__?.读取界面());
    assert.ok(
      结算?.结算徽标.可见 && 结算.结算统计.some((项) => 项.可见 && /用时|Time/.test(项.标签)),
    );
    await 页.waitForTimeout(3200);
    await 点击("restart");
    assert.equal(await 页.evaluate(() => window.__再消一行测试__?.读取状态().阶段), "进行中");
    assert.equal(await 页.evaluate(() => window.__再消一行测试__?.读取状态().分数), 0);
    模式验收.push({ 模式, 时前, 时后, 暂停, 结算: 结算.结算徽标.文本 });
  }
  assert.deepEqual(错误, []);
  await writeFile(
    `${输出}/分层验收.json`,
    JSON.stringify({ 前, 后, 锁前, 锁后, 静前, 静后, 背景, 模式验收, 错误 }, null, 2),
  );
  console.log("通过：固定层、真实四行、HUD变化、极光预绘；冲刺/极限计时、暂停、暂存、结算与重开。");
} finally {
  await 浏览器.close();
}
