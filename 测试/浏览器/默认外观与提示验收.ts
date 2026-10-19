import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium, type Page } from "playwright";
import type { 游戏测试节点 } from "../../框架/开发/测试桥接";

const 地址 = process.argv[2] ?? "http://127.0.0.1:3003/";
const 输出 = resolve(process.argv[3] ?? "reports/默认外观与提示");
await mkdir(输出, { recursive: true });
const 浏览器 = await chromium.launch({ channel: "chrome", headless: true });
const 错误: string[] = [];
const 记录: string[] = [];
async function 新页面(存档?: Record<string, string>): Promise<Page> {
  const 页 = await 浏览器.newPage({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
    hasTouch: true,
    isMobile: true,
  });
  页.on("pageerror", (错) => 错误.push(错.message));
  if (存档)
    await 页.addInitScript((值) => {
      for (const [键, 内容] of Object.entries(值)) localStorage.setItem(键, 内容);
    }, 存档);
  await 页.goto(地址);
  await 页.waitForFunction(() => window.__GAMEMAKER_TEST__?.getSnapshot().sceneId === "开始菜单");
  await 页.waitForTimeout(350);
  return 页;
}
async function 点击(页: Page, 名称: string): Promise<void> {
  await 页.waitForFunction(
    (名) =>
      window.__GAMEMAKER_TEST__
        ?.getSnapshot()
        .interactives.some((项) => 项.name === 名 && 项.visible && 项.enabled),
    名称,
  );
  const 快照 = await 页.evaluate(() => window.__GAMEMAKER_TEST__?.getSnapshot());
  const 框 = 快照?.interactives.find((项) => 项.name === 名称 && 项.visible && 项.enabled)?.bounds;
  const 画布 = await 页.locator("canvas").boundingBox();
  assert.ok(快照 && 框 && 画布, 名称);
  await 页.touchscreen.tap(
    画布.x + ((框.x + 框.width / 2) / 快照.width) * 画布.width,
    画布.y + ((框.y + 框.height / 2) / 快照.height) * 画布.height,
  );
  await 页.waitForTimeout(250);
}
async function 读按钮(页: Page, 名称: string) {
  return 页.evaluate((名) => {
    const 展平 = (节点: 游戏测试节点[]): 游戏测试节点[] =>
      节点.flatMap((项) => [项, ...展平(项.children ?? [])]);
    const 按钮 = 展平(window.__GAMEMAKER_TEST__?.getSnapshot("完整").nodes ?? []).find(
      (项) => 项.name === 名 && 项.children?.some((子) => 子.type === "Text"),
    );
    const 文案 = 按钮?.children?.find((项) => 项.type === "Text");
    return { text: 文案?.text, color: 文案?.文字样式?.color };
  }, 名称);
}
async function 开始对局(页: Page) {
  await 点击(页, "menu.start");
  await 点击(页, "mode.冲刺");
  await 页.waitForFunction(() => Boolean(window.__再消一行测试__));
}
try {
  const 页 = await 新页面();
  assert.equal(await 页.evaluate(() => document.documentElement.dataset.style), "青蓝未来");
  await 页.screenshot({ path: resolve(输出, "新存档-青蓝未来.png") });
  await 点击(页, "menu.shop");
  await 点击(页, "shop.preview");
  assert.deepEqual(await 读按钮(页, "shop.preview.back"), { text: "返回", color: "#fff8e7" });
  assert.equal((await 读按钮(页, "shop.preview.motion")).color, "#fff8e7");
  await 点击(页, "shop.preview.motion");
  assert.equal((await 读按钮(页, "shop.preview.motion")).color, "#fff8e7");
  await 点击(页, "shop.preview.back");
  await 点击(页, "shop.close");
  await 开始对局(页);
  assert.match((await 读按钮(页, "touch.left")).text ?? "", /左移/);
  assert.match((await 读按钮(页, "touch.soft-drop")).text ?? "", /软降.*双击硬降/);
  assert.match((await 读按钮(页, "touch.rotate")).text ?? "", /长按暂存/);
  await 页.screenshot({ path: resolve(输出, "新存档-默认按键说明.png") });
  await 点击(页, "game.pause");
  await 点击(页, "game.pause.settings");
  await 点击(页, "game.settings.key-guide.off");
  await 点击(页, "game.settings.back");
  await 点击(页, "game.pause.resume");
  assert.equal((await 读按钮(页, "touch.left")).text, "←");
  await 页.reload();
  await 页.waitForFunction(() => window.__GAMEMAKER_TEST__?.getSnapshot().sceneId === "开始菜单");
  await 开始对局(页);
  assert.equal((await 读按钮(页, "touch.left")).text, "←");
  await 点击(页, "game.leave");
  await 点击(页, "menu.settings");
  await 点击(页, "settings.defaults");
  await 点击(页, "settings.done");
  await 开始对局(页);
  assert.match((await 读按钮(页, "touch.left")).text ?? "", /左移/);
  记录.push("新存档青蓝未来、默认显示按键说明、关闭后重载保留、恢复默认重新显示均通过");
  await 页.context().close();

  for (const 样式 of ["青蓝未来", "夜空鎏金", "暖纸古典"]) {
    const 景页 = await 新页面({
      "gamemaker:settings": JSON.stringify({ 样式 }),
      "再消一行:设置": JSON.stringify({ 背景主题: "极光原野" }),
    });
    assert.equal(await 景页.evaluate(() => document.documentElement.dataset.style), 样式);
    await 点击(景页, "menu.scenery");
    await 景页.waitForTimeout(350);
    for (const 景 of ["极光原野", "云海山岚"]) {
      assert.ok(
        await 景页.evaluate(
          (名) => window.__GAMEMAKER_TEST__?.getSnapshot().texts.includes(名),
          景,
        ),
      );
      assert.deepEqual(await 读按钮(景页, "menu.scenery.exit"), { text: "返回", color: "#fff8e7" });
      await 景页.screenshot({ path: resolve(输出, `${样式}-${景}-纯享返回.png`) });
      if (景 === "极光原野") {
        await 景页.keyboard.press("ArrowLeft");
        await 景页.waitForTimeout(250);
      }
    }
    await 点击(景页, "menu.scenery.exit");
    await 景页.waitForFunction(() =>
      window.__GAMEMAKER_TEST__
        ?.getSnapshot()
        .interactives.some((项) => 项.name === "menu.start" && 项.visible && 项.enabled),
    );
    if (样式 === "暖纸古典") {
      await 点击(景页, "menu.settings");
      await 点击(景页, "settings.defaults");
      assert.equal(await 景页.evaluate(() => document.documentElement.dataset.style), "青蓝未来");
      await 点击(景页, "settings.done");
    }
    记录.push(`${样式}旧存档保留，亮暗两景纯享返回浅字及点击退出通过`);
    await 景页.context().close();
  }
  assert.deepEqual(错误, []);
  await writeFile(resolve(输出, "验收结果.json"), JSON.stringify({ 记录, 错误 }, null, 2));
  console.log(记录.join("\n"));
} finally {
  await 浏览器.close();
}
