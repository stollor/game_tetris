import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const 输出 = "测试/视觉快照/旧版玩法接入";
await mkdir(输出, { recursive: true });
const browser = await chromium.launch();
const 错误: string[] = [];
function check(ok: unknown, s: string): asserts ok {
  if (!ok) throw new Error(s);
  console.log(`通过：${s}`);
}
try {
  for (const [width, height, 样式] of [
    [1280, 720, "夜空鎏金"],
    [375, 667, "暖纸古典"],
    [430, 860, "青蓝未来"],
    [844, 390, "夜空鎏金"],
    [667, 375, "暖纸古典"],
  ] as const) {
    const page = await browser.newPage({ viewport: { width, height } });
    page.on("pageerror", (e) => 错误.push(e.message));
    await page.addInitScript(
      ({ 样式, 语言 }) =>
        localStorage.setItem("gamemaker:settings", JSON.stringify({ 样式, 语言 })),
      { 样式, 语言: width === 667 ? "English" : "简体中文" },
    );
    await page.goto(process.argv[2] ?? "http://localhost:3220");
    await page.waitForFunction(
      () => window.__GAMEMAKER_TEST__?.getSnapshot().sceneId === "开始菜单",
    );
    const click = async (name: string) => {
      const s = await page.evaluate(() => window.__GAMEMAKER_TEST__?.getSnapshot());
      const b = s?.interactives.find((o) => o.name === name && o.visible)?.bounds;
      check(
        b &&
          s &&
          b.x >= 0 &&
          b.y >= 0 &&
          b.x + b.width <= s.width + 1 &&
          b.y + b.height <= s.height + 1,
        `${width}×${height} ${name} 可点击且不越界`,
      );
      await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
      await page.waitForTimeout(60);
    };
    const state = () => page.evaluate(() => window.__再消一行测试__?.读取状态());
    const shot = (名: string) => page.screenshot({ path: `${输出}/${width}x${height}-${名}.png` });
    await click("menu.start");
    await click("mode.马拉松");
    await page.evaluate(() => window.__再消一行测试__?.设置序列(["T", "I", "O", "J"]));
    await page.keyboard.press("c");
    check(
      (await state())?.暂存方块 === "T" && (await state())?.当前方块 === "I",
      "C 暂存当前块并取下一块",
    );
    await shot("暂存锁定");
    await click("game.hold");
    check((await state())?.当前方块 === "I", "已暂存的卡片真正禁用");
    const 动画 = await page.evaluate(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { code: "Space" }));
      window.dispatchEvent(new KeyboardEvent("keyup", { code: "Space" }));
      return window.__再消一行测试__?.读取界面().落块特效;
    });
    check(动画?.硬降拖尾 && 动画.锁定闪光, "真实硬降同时触发拖尾与锁定闪光");
    check(!(await state())?.本块已暂存, "落块恢复暂存权限");
    await click("game.hold");
    check(
      (await state())?.当前方块 === "T" && (await state())?.暂存方块 === "O",
      "点击卡片交换已有暂存",
    );
    await page.keyboard.press("Escape");
    await page.keyboard.press("c");
    check((await state())?.当前方块 === "T", "暂停时暂存键无效");
    await click("game.pause.resume");
    await page.evaluate(() => window.__再消一行测试__?.准备四行消除());
    await page.keyboard.press("Space");
    const 一次 = await page.evaluate(() => window.__再消一行测试__?.读取界面());
    check(
      一次?.技巧反馈.includes(width === 667 ? "PERFECT CLEAR" : "完美清场") &&
        一次.技巧反馈.includes(width === 667 ? "QUAD!" : "四连消"),
      "真实四行全清显示分层奖励",
    );
    await shot("四行全清");
    await page.evaluate(() => window.__再消一行测试__?.准备四行消除(true));
    await page.keyboard.press("Space");
    const 二次 = await page.evaluate(() => window.__再消一行测试__?.读取界面());
    check(
      二次?.技巧反馈.includes(width === 667 ? "COMBO ×2" : "连击 ×2") &&
        二次.技巧反馈.includes(width === 667 ? "BACK-TO-BACK" : "背靠背"),
      "连续四行显示真实连击和高难奖励",
    );
    await shot("连击技巧");
    await page.evaluate(() => window.__再消一行测试__?.设置序列(["I", "O"]));
    const 新局 = await state(),
      清理 = await page.evaluate(() => window.__再消一行测试__?.读取界面());
    check(
      新局?.暂存方块 === null && !清理?.落块特效?.硬降拖尾 && !清理?.落块特效?.锁定闪光,
      "重开清空暂存和旧动画",
    );
    await shot("对局布局");
    await page.close();
  }
  check(错误.length === 0, `无页面运行错误 ${错误.join()}`);
} finally {
  await browser.close();
}
