import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";
import { 游戏主题表 } from "../../框架/样式/主题";

const 输出 = "测试/视觉快照/样式特效验收";
await mkdir(输出, { recursive: true });
const browser = await chromium.launch();
const 错误: string[] = [];
const check = (ok: unknown, 文案: string) => {
  if (!ok) throw new Error(文案);
  console.log(`通过：${文案}`);
};
try {
  for (const 样式 of ["夜空鎏金", "暖纸古典", "青蓝未来"] as const) {
    if (process.argv.includes("--switch-only")) break;
    for (const [width, height] of [
      [1280, 720],
      [375, 667],
      [430, 860],
      [844, 390],
    ]) {
      const page = await browser.newPage({ viewport: { width, height } });
      page.on("pageerror", (e) => 错误.push(e.message));
      await page.addInitScript(
        (样式) => localStorage.setItem("gamemaker:settings", JSON.stringify({ 样式 })),
        样式,
      );
      await page.goto(process.argv[2] ?? "http://localhost:3220");
      await page.waitForFunction(
        () => window.__GAMEMAKER_TEST__?.getSnapshot().sceneId === "开始菜单",
      );
      const snap = () => page.evaluate(() => window.__GAMEMAKER_TEST__?.getSnapshot());
      const click = async (name: string) => {
        const s = await snap();
        const b = s?.interactives.find((o) => o.name === name && o.visible)?.bounds;
        check(
          b &&
            s &&
            b.x >= -1 &&
            b.y >= -1 &&
            b.x + b.width <= s.width + 1 &&
            b.y + b.height <= s.height + 1,
          `${样式} ${width}×${height} ${name} 可见并适配`,
        );
        if (!b || !s) throw new Error(name);
        await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
        await page.waitForTimeout(100);
      };
      const shot = (名: string) =>
        page.screenshot({ path: `${输出}/${样式}-${width}x${height}-${名}.png` });
      await shot("首页");
      await click("menu.settings");
      await shot("设置");
      await click("settings.done");
      await click("menu.start");
      await shot("模式");
      await click("mode.马拉松");
      await page.waitForFunction(() => Boolean(window.__再消一行测试__));
      const 界面 = await page.evaluate(() => window.__再消一行测试__?.读取界面());
      check(界面?.样式 === 样式, "对局沿用所选主题");
      check(
        Object.values(界面?.界面配色 ?? {}).every(
          (色) => 色 === 游戏主题表[样式].面板.主面板.正文文字,
        ),
        "HUD、纪录、结算实际文字颜色匹配主题",
      );
      await shot("对局");
      await page.keyboard.press("Escape");
      await shot("暂停");
      await click("game.pause.settings");
      await shot("对局设置");
      await page.keyboard.press("Escape");
      await click("game.pause.resume");
      await page.evaluate(() => window.__再消一行测试__?.准备单行消除());
      await page.keyboard.press("Space");
      await page.waitForTimeout(60);
      const 单行 = await page.evaluate(() => window.__再消一行测试__?.读取界面().消行特效);
      check(
        单行?.活跃 && 单行.行.join() === "19" && 单行.碎片数 === 0,
        "单行实际位置已触发，光带不再生成碎片",
      );
      await shot("单行特效");
      await page.keyboard.press("Escape");
      const 冻结前 = await page.evaluate(() => window.__再消一行测试__?.读取界面().消行特效?.时间);
      await page.waitForTimeout(150);
      check(
        (await page.evaluate(() => window.__再消一行测试__?.读取界面().消行特效?.时间)) === 冻结前,
        "暂停冻结特效",
      );
      await click("game.pause.resume");
      await page.waitForFunction(() => !window.__再消一行测试__?.读取界面().消行特效?.活跃, {
        timeout: 3000,
      });
      check(
        !(await page.evaluate(() => window.__再消一行测试__?.读取界面().消行特效?.活跃)),
        "特效完成后清空",
      );
      await page.evaluate(() => window.__再消一行测试__?.准备四行消除());
      await page.keyboard.press("Space");
      await page.waitForTimeout(90);
      const 四行 = await page.evaluate(() => window.__再消一行测试__?.读取界面().消行特效);
      check(
        四行?.活跃 && 四行.行.length === 4 && 四行.碎片数 === 0,
        "四行效果具有真实四行位置，光带不再生成碎片",
      );
      await shot("四行特效");
      await page.evaluate(() => window.__再消一行测试__?.准备结算(true));
      await shot("结算");
      await page.close();
    }
  }
  const 切换页 = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  切换页.on("pageerror", (e) => 错误.push(e.message));
  await 切换页.goto(process.argv[2] ?? "http://localhost:3220");
  await 切换页.waitForFunction(
    () => window.__GAMEMAKER_TEST__?.getSnapshot().sceneId === "开始菜单",
  );
  const 点选 = async (名称: string) => {
    const b = await 切换页.evaluate(
      (name) =>
        window.__GAMEMAKER_TEST__
          ?.getSnapshot()
          .interactives.find((o) => o.name === name && o.visible)?.bounds,
      名称,
    );
    if (!b) throw new Error(名称);
    await 切换页.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
    await 切换页.waitForTimeout(100);
  };
  for (const [样式, 卡片] of [
    ["暖纸古典", "warm-paper"],
    ["青蓝未来", "neon-tide"],
    ["夜空鎏金", "gilded-night"],
  ]) {
    await 点选("menu.settings");
    await 点选(`settings.style.${卡片}`);
    check(
      (await 切换页.evaluate(() => document.documentElement.dataset.style)) === 样式,
      "实际点击样式卡即时应用主题",
    );
    await 点选("settings.done");
    await 切换页.screenshot({ path: `${输出}/实际切换-${样式}-首页.png` });
    await 点选("menu.start");
    await 点选("mode.马拉松");
    const 界面 = await 切换页.evaluate(() => window.__再消一行测试__?.读取界面());
    check(界面?.样式 === 样式, "返回首页并开始游戏后仍沿用新样式");
    await 点选("game.leave");
  }
  await 切换页.close();
  check(错误.length === 0, `无页面错误 ${错误.join()}`);
} finally {
  await browser.close();
}
