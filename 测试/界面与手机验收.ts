/** biome-ignore-all lint/style/noNonNullAssertion: 浏览器夹具和测试桥在使用前已等待存在。 */
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";

const 输出 = "测试/视觉快照/界面与成就";
await mkdir(输出, { recursive: true });
const browser = await chromium.launch();
const 错误: string[] = [];
const 结果: unknown[] = [];
const check = (ok: unknown, 文案: string) => {
  if (!ok) throw new Error(文案);
  console.log(`通过：${文案}`);
};
try {
  const build = await Bun.build({ entrypoints: ["测试/输入隔离浏览器夹具.ts"], target: "browser" });
  if (!build.success) throw new Error(String(build.logs));
  const 脚本 = await build.outputs[0]!.text();
  const fixture = await browser.newPage({ viewport: { width: 400, height: 400 } });
  fixture.on("pageerror", (e) => 错误.push(e.message));
  await fixture.route("**/input-fixture", (route) =>
    route.fulfill({ body: "<html><style>body{margin:0}</style></html>", contentType: "text/html" }),
  );
  await fixture.goto("http://localhost:3220/input-fixture");
  await fixture.addScriptTag({ content: 脚本 });
  await fixture.waitForFunction(() => Boolean(window.__隔离夹具__));
  await fixture.evaluate(() => window.__隔离夹具__!.打开(2));
  await fixture.waitForTimeout(120);
  await fixture.screenshot({ path: `${输出}/输入隔离夹具.png` });
  await fixture.mouse.click(200, 200);
  await fixture.waitForTimeout(80);
  const f1 = await fixture.evaluate(() => window.__隔离夹具__!.读取());
  check(
    f1.二级 === 1 && f1.一级 === 0 && f1.底层 === 0,
    `同坐标关闭二级弹窗不穿透一级/底层（topOnly=false） ${JSON.stringify(f1)}`,
  );
  await fixture.mouse.move(100, 100);
  await fixture.mouse.wheel(0, 300);
  await fixture.waitForTimeout(80);
  check(
    (await fixture.evaluate(() => window.__隔离夹具__!.读取())).滚动 === 0,
    "模态弹窗自动隔离底层滚轮",
  );
  await fixture.mouse.click(200, 200);
  await fixture.waitForTimeout(80);
  const f2 = await fixture.evaluate(() => window.__隔离夹具__!.读取());
  check(f2.一级 === 1 && f2.底层 === 0, "关闭一级弹窗本次抬起不点击底层");
  await fixture.mouse.click(200, 200);
  await fixture.waitForTimeout(80);
  check(
    (await fixture.evaluate(() => window.__隔离夹具__!.读取())).底层 === 1,
    "弹窗关闭后的新点击正常恢复",
  );
  await fixture.close();
  for (const [width, height, 样式] of [
    [375, 667, "暖纸古典"],
    [1280, 720, "夜空鎏金"],
    [844, 390, "青蓝未来"],
  ] as const) {
    const page = await browser.newPage({ viewport: { width, height }, recordVideo: { dir: 输出 } });
    page.on("pageerror", (e) => 错误.push(e.message));
    await page.addInitScript(
      (样式) => localStorage.setItem("gamemaker:settings", JSON.stringify({ 样式 })),
      样式,
    );
    await page.goto(process.argv[2] ?? "http://localhost:3220");
    await page.waitForFunction(() =>
      window.__GAMEMAKER_TEST__?.getSnapshot().interactives.some((项) => 项.name === "menu.start"),
    );
    const snap = () => page.evaluate(() => window.__GAMEMAKER_TEST__!.getSnapshot());
    const click = async (name: string) => {
      const s = await snap(),
        b = s.interactives.find((o) => o.name === name && o.visible)?.bounds;
      check(
        b && b.x >= -1 && b.y >= -1 && b.x + b.width <= width + 1 && b.y + b.height <= height + 1,
        `${width}×${height} ${name} 可点击不越界`,
      );
      if (!b) throw new Error(name);
      await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
      await page.waitForTimeout(65);
    };
    const shot = (名: string) => page.screenshot({ path: `${输出}/${width}x${height}-${名}.png` });
    const state = () => page.evaluate(() => window.__俄罗斯方块测试__!.读取状态());
    await shot("主菜单开始");
    await click("menu.achievements");
    await page.waitForFunction(
      () => window.__GAMEMAKER_TEST__!.getSnapshot().sceneId === "成就界面",
    );
    await shot("成就未解锁");
    await page.mouse.move(width / 2, height / 2);
    await page.mouse.wheel(0, 700);
    await page.waitForTimeout(120);
    check(
      await page.evaluate(() => (window.__俄罗斯方块成就__?.().滚动 ?? 0) > 0),
      "成就列表滚轮实际改变滚动位置",
    );
    await shot("成就列表底部");
    await click("achievements.back");
    check((await snap()).sceneId === "开始菜单", "成就返回不穿透进入游戏");
    await click("menu.settings");
    await page.waitForFunction(
      () => window.__GAMEMAKER_TEST__!.getSnapshot().sceneId === "设置界面",
    );
    await click("settings.done");
    check((await snap()).sceneId === "开始菜单", "覆盖设置返回不误触主菜单");
    await click("menu.start");
    await click("mode.马拉松");
    await page.waitForFunction(() => Boolean(window.__俄罗斯方块测试__));
    if (width === 375) {
      await page.evaluate(() => window.__俄罗斯方块测试__!.设置序列(["T", "I", "O"]));
      await click("touch.rotate-left");
      check((await state()).当前朝向 === 3, "手机左按钮左转");
      await click("touch.rotate-right");
      check((await state()).当前朝向 === 0, "手机右按钮右转而非180°");
      await click("touch.rotate");
      check((await state()).当前朝向 === 3, "↑ 默认左转");
      await page.evaluate(() => window.__俄罗斯方块测试__!.设置序列(["T", "I", "O"]));
      const b = (await snap()).interactives.find((o) => o.name === "touch.soft-drop")!.bounds!;
      await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
      await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
      check((await state()).当前方块 === "I", "双击 ↓ 实际速降并换下一块");
      await page.evaluate(() => window.__俄罗斯方块测试__!.设置序列(["T", "I", "O"]));
      await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
      await page.mouse.down();
      await page.waitForTimeout(350);
      await page.mouse.up();
      await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
      check((await state()).当前方块 === "T", "长按软降后再点不会误判双击");
    }
    for (const [选项, 朝向] of [
      ["右转", 1],
      ["180度", 2],
      ["左转", 3],
    ] as const) {
      await click("game.pause");
      await click("game.pause.settings");
      const 暂停前 = await state();
      await click("game.pause");
      await click("game.leave");
      check(
        (await state()).阶段 === "暂停" && (await snap()).sceneId === "俄罗斯方块对局",
        "设置遮罩阻挡底层暂停与离开",
      );
      await click(`game.settings.touch-up.${选项}`);
      await shot(`局内设置-${选项}`);
      await click("game.settings.back");
      check((await state()).阶段 === "暂停", "关闭设置只回到暂停菜单，不穿透继续");
      await click("game.pause.resume");
      if (width === 375) {
        await page.evaluate(() => window.__俄罗斯方块测试__!.设置序列(["T", "I", "O"]));
        await click("touch.rotate");
        check((await state()).当前朝向 === 朝向, `↑ ${选项} 实际旋转正确`);
      }
      check(暂停前.阶段 === "暂停", "设置在暂停中编辑");
    }
    await page.evaluate(() => window.__俄罗斯方块测试__!.准备四行消除());
    await page.keyboard.press("Space");
    await shot("成就解锁提示");
    const 存档 = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("neon-pulse:achievements") ?? "null"),
    );
    check(
      存档?.数据?.tetris?.解锁时间 !== null &&
        存档?.数据?.perfect?.进度 === 1 &&
        存档?.数据?.lines?.进度 === 4,
      "真实四行全清解锁成就并累计存档",
    );
    await page.reload();
    await page.waitForFunction(() =>
      window.__GAMEMAKER_TEST__?.getSnapshot().interactives.some((项) => 项.name === "menu.start"),
    );
    await click("menu.achievements");
    await shot("成就刷新后保留");
    check(
      (await snap()).texts.some((t) => t.includes("一举四行")),
      "刷新后成就页面读取持久进度",
    );
    结果.push({ width, height, 成就: 存档 });
    await page.close();
  }
  check(错误.length === 0, `无页面错误 ${错误.join()}`);
  await writeFile(`${输出}/验收数据.json`, JSON.stringify(结果, null, 2));
} finally {
  await browser.close();
}
