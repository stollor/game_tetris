import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { basename, join } from "node:path";
import { chromium, type Page } from "playwright";
import type {} from "../../代码/场景/对局/对局";
import { 地点皮肤表 } from "../../代码/框架配置/旅行地点";

const 根 = join(import.meta.dir, "../.."),
  输出 = join(根, "reports/travel");
await mkdir(输出, { recursive: true });
const 服务 = Bun.serve({
  hostname: "127.0.0.1",
  port: 0,
  async fetch(请求) {
    const 路径 = new URL(请求.url).pathname.slice(1) || "index.html";
    if (basename(路径) !== 路径) return new Response("Not Found", { status: 404 });
    const 文件 = Bun.file(join(根, "产物", 路径));
    return (await 文件.exists()) ? new Response(文件) : new Response("Not Found", { status: 404 });
  },
});
const 浏览器 = await chromium.launch({ channel: "chrome" });
const 错误: string[] = [];
async function 点击(页: Page, 名称: string): Promise<void> {
  await 页.waitForFunction(
    (名称) =>
      window.__GAMEMAKER_TEST__
        ?.getSnapshot()
        .interactives.some((项) => 项.name === 名称 && 项.visible && 项.enabled),
    名称,
  );
  const 框 = await 页.evaluate(
    (名称) =>
      window.__GAMEMAKER_TEST__
        ?.getSnapshot()
        .interactives.find((项) => 项.name === 名称 && 项.visible && 项.enabled)?.bounds,
    名称,
  );
  assert.ok(框, 名称);
  const 视口 = 页.viewportSize();
  assert.ok(视口);
  assert.ok(
    框.x >= -1 &&
      框.y >= -1 &&
      框.x + 框.width <= 视口.width + 1 &&
      框.y + 框.height <= 视口.height + 1,
    `${名称} 不越界 ${JSON.stringify(框)}`,
  );
  if (视口.width <= 430) await 页.touchscreen.tap(框.x + 框.width / 2, 框.y + 框.height / 2);
  else await 页.mouse.click(框.x + 框.width / 2, 框.y + 框.height / 2, { delay: 70 });
  await 页.waitForTimeout(140);
}
async function 滑动(页: Page, x: number, y: number, tx: number, ty: number): Promise<void> {
  const 视口 = 页.viewportSize();
  if ((视口?.width ?? 0) <= 430) {
    const cdp = await 页.context().newCDPSession(页);
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x, y, id: 1 }],
    });
    for (let i = 1; i <= 8; i++) {
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ x: x + ((tx - x) * i) / 8, y: y + ((ty - y) * i) / 8, id: 1 }],
      });
      await 页.waitForTimeout(16);
    }
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  } else {
    await 页.mouse.move(x, y);
    await 页.mouse.down();
    await 页.mouse.move(tx, ty, { steps: 8 });
    await 页.mouse.up();
  }
  await 页.waitForTimeout(180);
}
async function 点地点(页: Page, 名称: string): Promise<void> {
  for (let i = 0; i < 16; i++) {
    if (
      await 页.evaluate(
        (名称) =>
          window.__GAMEMAKER_TEST__
            ?.getSnapshot()
            .interactives.some(
              (项) => 项.name === `shop.place.${名称}` && 项.enabled && 项.visible,
            ),
        名称,
      )
    )
      break;
    const 卡 = await 页.evaluate(
      () =>
        window.__GAMEMAKER_TEST__
          ?.getSnapshot()
          .interactives.find((项) => 项.name.startsWith("shop.place.") && 项.visible)?.bounds,
    );
    if (!卡) break;
    await 滑动(页, 卡.x + 卡.width * 0.85, 卡.y + 卡.height / 2, 卡.x + 16, 卡.y + 卡.height / 2);
  }
  await 点击(页, `shop.place.${名称}`);
}
const 等页面 = (页: Page, 名称: string) =>
  页.waitForFunction((名称) => window.__GAMEMAKER_TEST__?.getSnapshot().sceneId === 名称, 名称);
async function 截图(页: Page, 名称: string) {
  await 页.screenshot({ path: join(输出, `${名称}.png`) });
}
try {
  for (const 宽 of [1366, 430, 320]) {
    const 页 = await 浏览器.newPage({
      viewport: { width: 宽, height: 900 },
      hasTouch: 宽 <= 430,
      isMobile: 宽 <= 430,
      deviceScaleFactor: 宽 <= 430 ? 2 : 1,
    });
    页.on("pageerror", (错) => {
      错误.push(错.message);
      console.error(错.stack);
    });
    await 页.goto(服务.url.href);
    await 等页面(页, "开始菜单");
    assert.equal(await 页.title(), "俄罗斯方块 旅行版");
    await 截图(页, `${宽}-菜单`);
    await 点击(页, "menu.scenery");
    await 截图(页, `${宽}-纯享`);
    assert.ok(
      await 页.evaluate(() => window.__GAMEMAKER_TEST__?.getSnapshot().texts.includes("晨光海岸")),
    );
    const 视口 = 页.viewportSize();
    assert.ok(视口);
    await 滑动(页, 视口.width * 0.78, 视口.height * 0.45, 视口.width * 0.18, 视口.height * 0.45);
    await 页.waitForFunction(() =>
      Boolean(window.__GAMEMAKER_TEST__?.getSnapshot().texts.includes("云海山岚")),
    );
    await 点击(页, "menu.scenery.exit");
    await 点击(页, "menu.shop");
    await 等页面(页, "旅行商店");
    await 截图(页, `${宽}-商店`);
    if (宽 <= 430) await 点地点(页, "拉萨晴空");
    await 点地点(页, "成都熊猫");
    await 截图(页, `${宽}-成都详情`);
    await 点击(页, "shop.item.静态背景");
    await 点击(页, "shop.buy");
    await 截图(页, `${宽}-购买确认`);
    await 点击(页, "shop.confirm.buy");
    await 页.waitForFunction(() =>
      Boolean(
        window.__GAMEMAKER_TEST__
          ?.getSnapshot()
          .interactives.some((项) => 项.name === "shop.confirm.use"),
      ),
    );
    const 收藏 = await 页.evaluate(
      () => JSON.parse(localStorage.getItem("旅行版:收藏") ?? "{}").数据,
    );
    assert.equal(收藏.金币, 40);
    assert.ok(收藏.已购.includes("成都熊猫.静态背景"));
    await 点击(页, "shop.confirm.use");
    assert.equal(
      await 页.evaluate(() => JSON.parse(localStorage.getItem("俄罗斯方块:设置") ?? "{}").背景主题),
      "成都熊猫",
    );
    await 点击(页, "shop.item.动态背景");
    await 点击(页, "shop.buy");
    assert.ok(
      await 页.evaluate(() =>
        window.__GAMEMAKER_TEST__?.getSnapshot().texts.some((项) => 项.includes("100 金币")),
      ),
    );
    await 截图(页, `${宽}-不足余额`);
    assert.ok(
      await 页.evaluate(() =>
        window.__GAMEMAKER_TEST__
          ?.getSnapshot()
          .interactives.some((项) => 项.name === "shop.confirm.buy" && !项.enabled),
      ),
    );
    if (宽 <= 430) await 页.touchscreen.tap(5, 5);
    else await 页.mouse.click(5, 5);
    await 点击(页, "shop.close");
    await 等页面(页, "开始菜单");
    await 页.reload();
    await 等页面(页, "开始菜单");
    await 点击(页, "menu.scenery");
    await 页.waitForTimeout(150);
    const 静态帧 = await 页.screenshot();
    await 页.waitForTimeout(200);
    assert.deepEqual(await 页.screenshot(), 静态帧, "静态背景不播放动态层");
    await 点击(页, "menu.scenery.exit");
    await 点击(页, "menu.settings");
    await 等页面(页, "设置界面");
    await 截图(页, `${宽}-设置`);
    if (宽 === 320) await 点击(页, "settings.touch-tips.off");
    await 点击(页, "settings.done");
    await 点击(页, "menu.start");
    await 点击(页, "mode.马拉松");
    await 页.waitForFunction(() => Boolean(window.__俄罗斯方块测试__));
    await 页.keyboard.press("Space");
    await 页.keyboard.press("c");
    await 页.waitForFunction(
      () => JSON.parse(localStorage.getItem("旅行版:收藏") ?? "{}").数据?.金币 >= 160,
    );
    if (宽 === 430) await 截图(页, "430-触屏功能提示");
    if (宽 === 320)
      assert.ok(
        await 页.evaluate(() => window.__GAMEMAKER_TEST__?.getSnapshot().texts.includes("↓")),
        "关闭提示后只显示操作图形",
      );
    await 点击(页, "game.pause");
    if (宽 <= 430) await 页.touchscreen.tap(5, 5);
    else await 页.mouse.click(5, 5);
    await 页.waitForFunction(() => window.__俄罗斯方块测试__?.读取状态().阶段 === "进行中");
    if (宽 === 1366) {
      await 页.evaluate(() =>
        localStorage.setItem("neon-pulse:best:马拉松", JSON.stringify({ 分数: 1, 用时: null })),
      );
      for (let i = 0; i < 10; i++) {
        await 页.evaluate(() => window.__俄罗斯方块测试__?.准备四行消除(true));
        await 页.keyboard.press("Space");
      }
      await 页.waitForFunction(
        () => (window.__俄罗斯方块测试__?.读取状态().有效用时 ?? 0) >= 31000,
        {},
        { timeout: 40000 },
      );
      await 页.evaluate(() => window.__俄罗斯方块测试__?.结束当前对局());
      await 页.waitForFunction(
        () => JSON.parse(localStorage.getItem("旅行版:收藏") ?? "{}").数据?.已结算.length === 1,
      );
      assert.ok(
        await 页.evaluate(() =>
          window.__GAMEMAKER_TEST__?.getSnapshot().texts.some((项) => 项.includes("破纪录 35")),
        ),
      );
      await 截图(页, "对局金币与破纪录结算");
      const 钱包 = await 页.evaluate(() => localStorage.getItem("旅行版:收藏"));
      await 页.waitForTimeout(300);
      assert.equal(
        await 页.evaluate(() => localStorage.getItem("旅行版:收藏")),
        钱包,
        "重复渲染不重复发奖",
      );
      await 点击(页, "main-menu");
      await 等页面(页, "开始菜单");
      await 页.reload();
      await 等页面(页, "开始菜单");
      assert.equal(
        await 页.evaluate(() => localStorage.getItem("旅行版:收藏")),
        钱包,
        "刷新不重复领取成就和结算",
      );
    }
    await 页.close();
  }
  const 页 = await 浏览器.newPage({ viewport: { width: 1440, height: 900 } });
  页.on("pageerror", (错) => {
    错误.push(错.message);
    console.error(错.stack);
  });
  await 页.goto(服务.url.href);
  await 等页面(页, "开始菜单");
  // 独立浏览器中的视觉验收资金，不写入用户的真实浏览器或游戏存档。
  await 页.evaluate(() =>
    localStorage.setItem(
      "旅行版:收藏",
      JSON.stringify({
        版本: 1,
        数据: {
          金币: 20000,
          累计获得: 20000,
          已购: [],
          已结算: [],
          已领成就: [],
          最近首局日期: "",
        },
      }),
    ),
  );
  await 页.reload();
  await 等页面(页, "开始菜单");
  for (const 地点 of 地点皮肤表) {
    await 点击(页, "menu.shop");
    await 等页面(页, "旅行商店");
    await 点地点(页, 地点.名称);
    await 点击(页, "shop.preview");
    await 截图(页, `${地点.名称}-风景`);
    const 前 = await 页.screenshot();
    await 页.waitForTimeout(180);
    assert.notDeepEqual(await 页.screenshot(), 前, `${地点.名称} 动画运行`);
    await 点击(页, "shop.preview.back");
    await 点击(页, "shop.bundle");
    await 点击(页, "shop.confirm.buy");
    await 页.waitForFunction(() =>
      window.__GAMEMAKER_TEST__
        ?.getSnapshot()
        .interactives.some((项) => 项.name === "shop.confirm.use"),
    );
    await 点击(页, "shop.confirm.use");
    await 点击(页, "shop.close");
    await 等页面(页, "开始菜单");
    const 设置 = await 页.evaluate(() =>
      JSON.parse(localStorage.getItem("俄罗斯方块:设置") ?? "{}"),
    );
    assert.equal(设置.方块外观, 地点.名称);
    assert.equal(设置.旅行样式, 地点.名称);
    assert.equal(设置.旅行音乐, 地点.名称);
    assert.equal(设置.旅行音效, 地点.名称);
    assert.equal(设置.背景动态, true);
    await 截图(页, `${地点.名称}-菜单`);
    await 点击(页, "menu.start");
    await 点击(页, "mode.马拉松");
    await 页.waitForFunction(() => Boolean(window.__俄罗斯方块测试__));
    assert.equal(await 页.evaluate(() => window.__俄罗斯方块测试__?.读取界面().样式), 地点.名称);
    await 页.keyboard.press("Space");
    await 页.waitForTimeout(220);
    await 截图(页, `${地点.名称}-对局`);
    await 点击(页, "game.leave");
    await 等页面(页, "开始菜单");
  }
  await 页.close();
  assert.deepEqual(错误, []);
  console.log(
    "旅行版发布包通过：三种宽度购买/存储/穿戴/成就金币/空白关闭；12套风景、动画、整套购买、主题与音频接入。",
  );
} catch (错误) {
  for (const [i, 页] of 浏览器
    .contexts()
    .flatMap((项) => 项.pages())
    .entries()) {
    await 截图(页, `失败-${i}`);
    await Bun.write(
      join(输出, `失败-${i}.json`),
      JSON.stringify(
        await 页.evaluate(() => ({
          快照: window.__GAMEMAKER_TEST__?.getSnapshot(),
          状态: window.__俄罗斯方块测试__?.读取状态(),
          收藏: localStorage.getItem("旅行版:收藏"),
        })),
        null,
        2,
      ),
    );
  }
  throw 错误;
} finally {
  await 浏览器.close();
  服务.stop(true);
}
