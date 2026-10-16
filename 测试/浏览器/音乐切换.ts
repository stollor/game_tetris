import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium, type Page } from "playwright";

declare global {
  interface Window {
    __俄罗斯方块音乐__?: () => { 曲目: string | null; 试听: string | null };
  }
}
const 地址 = process.argv[2] ?? "http://127.0.0.1:3330";
await mkdir("reports/music-switch", { recursive: true });
const 浏览器 = await chromium.launch({ channel: "chrome" });
async function 点击(页: Page, 名称: string) {
  await 页.waitForFunction(
    (名称) =>
      window.__GAMEMAKER_TEST__
        ?.getSnapshot()
        .interactives.some((项) => 项.name === 名称 && 项.enabled && 项.visible),
    名称,
  );
  const 框 = await 页.evaluate(
    (名称) =>
      window.__GAMEMAKER_TEST__
        ?.getSnapshot()
        .interactives.find((项) => 项.name === 名称 && 项.enabled && 项.visible)?.bounds,
    名称,
  );
  assert.ok(框);
  await 页.mouse.click(框.x + 框.width / 2, 框.y + 框.height / 2, { delay: 70 });
  await 页.waitForTimeout(200);
}
try {
  const 页 = await 浏览器.newPage({ viewport: { width: 1440, height: 900 } });
  const 错误: string[] = [];
  页.on("pageerror", (e) => 错误.push(e.message));
  await 页.goto(地址);
  await 页.waitForFunction(() => window.__GAMEMAKER_TEST__?.getSnapshot().sceneId === "开始菜单");
  await 页.bringToFront();
  const 读曲 = () => 页.evaluate(() => window.__俄罗斯方块音乐__?.() ?? { 曲目: null, 试听: null });
  assert.equal((await 读曲()).曲目, null, "菜单默认不播放背景曲");
  await 点击(页, "menu.shop");
  assert.equal((await 读曲()).试听, "旅行.成都熊猫", "打开商店即试听当前套装音乐");
  for (const 地点 of ["成都熊猫", "丽江雪山", "万里长城", "紫禁朱墙", "西湖烟雨"]) {
    await 点击(页, `shop.place.${地点}`);
    assert.equal((await 读曲()).试听, `旅行.${地点}`, `切换地点即试听 ${地点}`);
    await 点击(页, "shop.item.音乐");
    assert.equal((await 读曲()).试听, `旅行.${地点}`, `点音乐保持试听 ${地点}`);
  }
  await 页.evaluate(() => {
    for (let i = 0; i < 12; i++)
      window.dispatchEvent(
        new CustomEvent("gamemaker:settings-change", {
          detail: {
            背景音乐: true,
            音乐音量: 40 + i,
            音效音量: 80,
            主题: "跟随系统",
            语言: "跟随系统",
            样式: "夜空鎏金",
          },
        }),
      );
  });
  assert.equal((await 读曲()).试听, "旅行.西湖烟雨", "音量更新保持当前试听");
  await 点击(页, "shop.close");
  assert.deepEqual(await 读曲(), { 曲目: null, 试听: null }, "关闭商店停止试听且菜单仍无背景曲");
  await 点击(页, "menu.start");
  await 点击(页, "mode.马拉松");
  await 页.waitForFunction(() => Boolean(window.__俄罗斯方块测试__));
  assert.equal((await 读曲()).曲目, null, "对局默认不播放背景曲");
  assert.deepEqual(错误, []);
  await Bun.write("reports/music-switch/结果.json", JSON.stringify(await 读曲(), null, 2));
  console.log("通过：菜单与对局默认静音，商店选地点即试听，点音乐保持当前曲，关闭会停曲。");
} finally {
  await 浏览器.close();
}
