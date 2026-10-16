import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { basename, join } from "node:path";
import { chromium, type Page } from "playwright";
import type {} from "../../代码/场景/对局/对局";
import type { 游戏测试节点 } from "../../框架/开发/测试桥接";

const 根 = join(import.meta.dir, "../..");
const 输出 = join(根, "reports/resolution");
await mkdir(输出, { recursive: true });
// 只提供本次正式包中的平级文件，不经过开发服务器或重新构建。
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
async function 点击(页: Page, 名称: string) {
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
  const { width, height } = 页.viewportSize() ?? { width: 0, height: 0 };
  assert.ok(
    框.x >= -1 && 框.y >= -1 && 框.x + 框.width <= width + 1 && 框.y + 框.height <= height + 1,
    `${名称} 越界`,
  );
  await 页.mouse.click(框.x + 框.width / 2, 框.y + 框.height / 2);
  await 页.waitForTimeout(100);
}
function 扁平(节点: 游戏测试节点[]): 游戏测试节点[] {
  return 节点.flatMap((项) => [项, ...扁平(项.children ?? [])]);
}
const 结果 = [];
try {
  for (const [宽, 高, 像素比] of [
    [320, 568, 1],
    [430, 932, 3],
    [844, 390, 1],
    [1366, 768, 1],
    [1920, 1080, 1],
    [2560, 1440, 1],
    [3840, 2160, 1],
    [3440, 1440, 1],
    [1920, 1080, 2],
  ]) {
    const 页 = await 浏览器.newPage({
      viewport: { width: 宽, height: 高 },
      deviceScaleFactor: 像素比,
    });
    页.on("pageerror", (错) => 错误.push(错.message));
    await 页.goto(服务.url.href);
    await 页.waitForFunction(() => window.__GAMEMAKER_TEST__?.getSnapshot().sceneId === "开始菜单");
    const 标签 = `${宽}x${高}-dpr${像素比}`;
    const 菜单 = await 页.evaluate(() => window.__GAMEMAKER_TEST__?.getSnapshot("完整"));
    assert.ok(菜单);
    const 开始按钮 = 菜单.interactives.find((项) => 项.name === "menu.start")?.bounds;
    assert.ok(开始按钮);
    if (高 >= 1080) assert.ok(开始按钮.width / 高 > 0.4, "大屏主菜单应随屏幕放大");
    const 文字 = 扁平(菜单.nodes ?? []).find((项) => 项.text === "俄罗斯方块");
    if (高 === 2160)
      assert.ok(Number(文字?.文字样式?.resolution) >= 2.4, "放大文字源纹理应同步提高清晰度");
    await 页.screenshot({ path: join(输出, `${标签}-菜单.png`) });
    await 点击(页, "menu.settings");
    await 页.mouse.move(宽 / 2, 高 / 2);
    await 页.mouse.wheel(0, 400);
    await 页.waitForTimeout(100);
    await 页.screenshot({ path: join(输出, `${标签}-设置.png`) });
    if (高 >= 1080) {
      const 框 = await 页.evaluate(
        () =>
          window.__GAMEMAKER_TEST__
            ?.getSnapshot()
            .interactives.find(
              (项) => 项.name === "settings.blocks.默认" && 项.visible && 项.enabled,
            )?.bounds,
      );
      assert.ok(框, "设置列表中的方块选项可用");
      const 截图 = await 页.screenshot({ clip: 框 });
      const 亮点 = await 页.evaluate(async (数据) => {
        const 图片 = await createImageBitmap(
          await (await fetch(`data:image/png;base64,${数据}`)).blob(),
        );
        const 画布 = new OffscreenCanvas(图片.width, 图片.height);
        const 绘图 = 画布.getContext("2d");
        if (!绘图) throw new Error("无法检查列表像素");
        绘图.drawImage(图片, 0, 0);
        const 像素 = 绘图.getImageData(0, 0, 图片.width, 图片.height).data;
        let 数量 = 0;
        for (let i = 0; i < 像素.length; i += 4) if (像素[i] > 120 && 像素[i + 1] > 80) 数量++;
        return 数量;
      }, 截图.toString("base64"));
      assert.ok(亮点 > 100, "放大后列表内容实际绘出，没有被遮罩清空");
      await 点击(页, "settings.blocks.柔瓷");
      assert.equal(
        await 页.evaluate(
          () => JSON.parse(localStorage.getItem("俄罗斯方块:设置") ?? "{}").方块外观,
        ),
        "柔瓷",
      );
    }
    await 点击(页, "settings.done");
    await 点击(页, "menu.achievements");
    await 页.mouse.move(宽 / 2, 高 / 2);
    await 页.mouse.wheel(0, 400);
    await 页.waitForTimeout(100);
    assert.ok(
      await 页.evaluate(() => (window.__俄罗斯方块成就__?.().滚动 ?? 0) > 0),
      "放大成就列表可滚动",
    );
    await 点击(页, "achievements.back");
    await 点击(页, "menu.start");
    await 点击(页, "mode.马拉松");
    await 页.waitForFunction(() => Boolean(window.__俄罗斯方块测试__));
    const 界面 = await 页.evaluate(() => window.__俄罗斯方块测试__?.读取界面());
    assert.ok(界面);
    const { 棋盘, 视口 } = 界面;
    assert.ok(
      棋盘.左 >= 0 && 棋盘.顶 >= 0 && 棋盘.左 + 棋盘.宽 <= 视口.宽 && 棋盘.顶 + 棋盘.高 <= 视口.高,
      "完整棋盘在视口内",
    );
    if (高 >= 1080) assert.ok((棋盘.高 * 视口.比例) / 高 >= 0.75, "大屏棋盘应占据主要高度");
    await 页.keyboard.press("ArrowLeft");
    await 页.keyboard.press("Space");
    await 页.waitForTimeout(200);
    await 页.screenshot({ path: join(输出, `${标签}-对局.png`) });
    await 点击(页, "game.pause");
    await 点击(页, "game.pause.settings");
    await 页.screenshot({ path: join(输出, `${标签}-局内设置.png`) });
    await 点击(页, "game.settings.back");
    await 点击(页, "game.pause.resume");
    if (宽 === 3840) {
      const 前 = await 页.evaluate(() => window.__俄罗斯方块测试__?.读取状态());
      await 页.setViewportSize({ width: 430, height: 932 });
      await 页.waitForFunction(() => window.__俄罗斯方块测试__?.读取界面().视口.宽 === 430);
      await 页.waitForTimeout(100);
      assert.deepEqual(
        await 页.evaluate(() => window.__俄罗斯方块测试__?.读取状态().棋盘),
        前?.棋盘,
        "重排保留对局",
      );
      await 点击(页, "game.pause");
      await 点击(页, "game.pause.resume");
      await 点击(页, "touch.left");
      await 页.setViewportSize({ width: 宽, height: 高 });
      await 页.waitForFunction(() => window.__俄罗斯方块测试__?.读取界面().视口.比例 === 2.4);
      await 页.waitForTimeout(100);
      await 点击(页, "game.pause");
      await 点击(页, "game.pause.resume");
    }
    结果.push({
      宽,
      高,
      像素比,
      画布: await 页
        .locator("canvas")
        .evaluate((项: HTMLCanvasElement) => ({ 宽: 项.width, 高: 项.height })),
      菜单按钮宽: 开始按钮.width,
      视口,
      棋盘,
    });
    await 页.close();
  }
  assert.deepEqual(错误, []);
  await Bun.write(join(输出, "结果.json"), JSON.stringify(结果, null, 2));
  console.log(
    `正式发布包 ${结果.length} 种屏幕通过：菜单、设置、成就滚动、对局、暂停设置与窗口重排。`,
  );
} finally {
  await 浏览器.close();
  服务.stop(true);
}
