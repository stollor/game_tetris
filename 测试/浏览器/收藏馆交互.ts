import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium, type Page } from "playwright";
import type { 游戏测试节点 } from "../../框架/开发/测试桥接";

const 地址 = process.argv[2] ?? "http://127.0.0.1:3330",
  输出 = "reports/shop-redesign";
await mkdir(输出, { recursive: true });
const b = await chromium.launch({ channel: "chrome" });
async function 点击(p: Page, name: string) {
  await p.waitForFunction(
    (n) =>
      window.__GAMEMAKER_TEST__
        ?.getSnapshot()
        .interactives.some((x) => x.name === n && x.enabled && x.visible),
    name,
  );
  const r = await p.evaluate(
    (n) =>
      window.__GAMEMAKER_TEST__
        ?.getSnapshot()
        .interactives.find((x) => x.name === n && x.enabled && x.visible)?.bounds,
    name,
  );
  assert.ok(r);
  const v = p.viewportSize();
  assert.ok(v);
  assert.ok(
    r.x >= 0 && r.y >= 0 && r.x + r.width <= v.width + 1 && r.y + r.height <= v.height + 1,
    `${name} 完整可见`,
  );
  if (v.width <= 844) await p.touchscreen.tap(r.x + r.width / 2, r.y + r.height / 2);
  else await p.mouse.click(r.x + r.width / 2, r.y + r.height / 2, { delay: 70 });
  await p.waitForTimeout(210);
}
try {
  for (const [宽, 高] of [
    [1366, 768],
    [430, 900],
    [320, 568],
    [844, 390],
  ]) {
    const p = await b.newPage({
      viewport: { width: 宽, height: 高 },
      hasTouch: true,
      isMobile: 宽 <= 844,
    });
    const 错误: string[] = [];
    p.on("pageerror", (e) => 错误.push(e.message));
    await p.goto(地址);
    await p.waitForFunction(() => window.__GAMEMAKER_TEST__?.getSnapshot().sceneId === "开始菜单");
    await p.waitForTimeout(250);
    await 点击(p, "menu.shop");
    await p.screenshot({ path: `${输出}/${宽}x${高}-收藏馆.png` });
    if (宽 <= 844) {
      const cdp = await p.context().newCDPSession(p);
      const 滑动 = async (x: number, y: number, tx: number, ty: number) => {
        await cdp.send("Input.dispatchTouchEvent", {
          type: "touchStart",
          touchPoints: [{ x, y, id: 1 }],
        });
        for (let i = 1; i <= 8; i++) {
          await cdp.send("Input.dispatchTouchEvent", {
            type: "touchMove",
            touchPoints: [{ x: x + ((tx - x) * i) / 8, y: y + ((ty - y) * i) / 8, id: 1 }],
          });
          await p.waitForTimeout(18);
        }
        await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
        await p.waitForTimeout(160);
      };
      const 读标题 = async () =>
        p.evaluate(() => {
          function 查找(n: 游戏测试节点): string | undefined {
            if (n.name === "shop.hero.title") return n.text;
            for (const c of n.children ?? []) {
              const v = 查找(c);
              if (v) return v;
            }
          }
          for (const n of window.__GAMEMAKER_TEST__?.getSnapshot("完整").nodes ?? []) {
            const v = 查找(n);
            if (v) return v;
          }
        });
      const 底卡 = await p.evaluate(
        () =>
          window.__GAMEMAKER_TEST__
            ?.getSnapshot()
            .interactives.find((项) => 项.name === "shop.place.成都熊猫" && 项.visible)?.bounds,
      );
      assert.ok(底卡);
      await 滑动(
        底卡.x + 底卡.width * 0.8,
        底卡.y + 底卡.height / 2,
        底卡.x + 20,
        底卡.y + 底卡.height / 2,
      );
      assert.equal(await 读标题(), "成都熊猫", "底栏滑动不误选目的地");
      await 滑动(
        宽 * 0.72,
        Math.min(高 * 0.36, 高 - 240),
        宽 * 0.18,
        Math.min(高 * 0.36, 高 - 240),
      );
      assert.equal(await 读标题(), "丽江雪山", "主图左右滑动切换套装");
      await 点击(p, "shop.place.成都熊猫");
      assert.equal(await 读标题(), "成都熊猫");
      await p.screenshot({ path: `${输出}/${宽}x${高}-滑动后.png` });
    }
    await 点击(p, "shop.item.静态背景");
    await 点击(p, "shop.buy");
    await p.screenshot({ path: `${输出}/${宽}x${高}-购买.png` });
    await 点击(p, "shop.confirm.buy");
    await p.waitForFunction(() =>
      window.__GAMEMAKER_TEST__
        ?.getSnapshot()
        .interactives.some((x) => x.name === "shop.confirm.use"),
    );
    assert.equal(
      await p.evaluate(() => JSON.parse(localStorage.getItem("旅行版:收藏") ?? "{}").数据.金币),
      40,
    );
    await p.screenshot({ path: `${输出}/${宽}x${高}-获得.png` });
    await 点击(p, "shop.confirm.use");
    await 点击(p, "shop.close");
    assert.deepEqual(错误, []);
    await p.close();
  }
  console.log("通过：收藏馆四种宽高、底栏滑动不误选、主图左右滑动切换、真实购买保存与穿戴。");
} finally {
  await b.close();
}
