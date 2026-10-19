import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium, type Page } from "playwright";
import { 方块外观方案表 } from "../../代码/配置/方块外观";

const 地址 = process.argv[2] ?? "http://127.0.0.1:3220";
const 主题验收 = process.argv.includes("--主题");
const 输出 = 主题验收 ? "reports/interface-themes" : "reports/block-appearances";
const 案例 = 主题验收
  ? [
      { 方案: 方块外观方案表[0], 主题: "夜空鎏金", 控件: "gilded-night" },
      { 方案: 方块外观方案表[0], 主题: "暖纸古典", 控件: "warm-paper" },
      { 方案: 方块外观方案表[0], 主题: "青蓝未来", 控件: "neon-tide" },
    ]
  : 方块外观方案表.slice(0, 4).map((方案) => ({ 方案, 主题: "夜空鎏金", 控件: "gilded-night" }));
await mkdir(输出, { recursive: true });
const 浏览器 = await chromium.launch({ channel: "chrome" });
const 错误: string[] = [];
async function 点击(页: Page, 名称: string) {
  await 页.waitForFunction(
    (名称) =>
      window.__GAMEMAKER_TEST__
        ?.getSnapshot("标准")
        .interactives.some((项) => 项.name === 名称 && 项.enabled && 项.visible),
    名称,
  );
  const 数据 = await 页.evaluate((名称) => {
    const 快照 = window.__GAMEMAKER_TEST__?.getSnapshot("标准");
    const 目标 = 快照?.interactives.find((项) => 项.name === 名称 && 项.enabled && 项.visible);
    return 快照 && 目标?.bounds ? { 宽: 快照.width, 高: 快照.height, 框: 目标.bounds } : null;
  }, 名称);
  assert.ok(数据, `存在可点击的 ${名称}`);
  const 画布 = await 页.locator("canvas").boundingBox();
  assert.ok(画布);
  await 页.mouse.click(
    画布.x + ((数据.框.x + 数据.框.width / 2) * 画布.width) / 数据.宽,
    画布.y + ((数据.框.y + 数据.框.height / 2) * 画布.height) / 数据.高,
  );
}
try {
  for (const 宽 of [1280, 430])
    for (const { 方案, 主题, 控件 } of 案例) {
      const 页 = await 浏览器.newPage({ viewport: { width: 宽, height: 900 } });
      页.on("pageerror", (错) => 错误.push(错.message));
      await 页.goto(地址);
      await 页.evaluate(() =>
        localStorage.setItem(
          "再消一行:设置",
          JSON.stringify({ 旋转180: false, 背景主题: "极光原野" }),
        ),
      );
      await 页.reload();
      await 页.waitForFunction(
        () => window.__GAMEMAKER_TEST__?.getSnapshot().sceneId === "开始菜单",
      );
      await 点击(页, "menu.settings");
      await 页.waitForFunction(
        () => window.__GAMEMAKER_TEST__?.getSnapshot().sceneId === "设置界面",
      );
      if (主题验收) {
        await 点击(页, `settings.style.${控件}`);
        assert.equal(
          await 页.evaluate(
            () => JSON.parse(localStorage.getItem("gamemaker:settings") ?? "{}").样式,
          ),
          主题,
        );
      }
      const 标记 = 主题验收 ? 主题 : 方案.名称;
      const 名称 = `settings.blocks.${方案.名称}`;
      for (let i = 0; i < 10; i++) {
        if (
          await 页.evaluate(
            (名称) =>
              window.__GAMEMAKER_TEST__
                ?.getSnapshot("标准")
                .interactives.some(
                  (项) =>
                    项.name === 名称 &&
                    项.enabled &&
                    项.visible &&
                    项.bounds &&
                    项.bounds.y > 60 &&
                    项.bounds.y + 项.bounds.height < innerHeight - 60,
                ),
            名称,
          )
        )
          break;
        await 页.mouse.move(宽 / 2, 450);
        await 页.mouse.wheel(0, 300);
        await 页.waitForTimeout(80);
      }
      await 点击(页, 名称);
      const 设置 = await 页.evaluate(() =>
        JSON.parse(localStorage.getItem("再消一行:设置") ?? "{}"),
      );
      assert.equal(设置.方块外观, 方案.名称);
      assert.equal(设置.旋转180, false);
      assert.equal(设置.背景主题, "极光原野");
      await 页.screenshot({ path: `${输出}/${宽}-${标记}-设置.png` });
      await 点击(页, "settings.done");
      await 点击(页, "menu.start");
      const 模式 = await 页.evaluate(() =>
        window.__GAMEMAKER_TEST__
          ?.getSnapshot("标准")
          .interactives.map((项) => 项.name)
          .find((名) => 名.includes("marathon") || 名.includes("马拉松")),
      );
      assert.ok(模式);
      await 点击(页, 模式);
      await 页.waitForFunction(() => Boolean(window.__再消一行测试__));
      await 页.evaluate(() => {
        window.__再消一行测试__?.准备四行消除(false, true);
      });
      await 页.keyboard.press("c");
      await 页.waitForTimeout(150);
      await 页.screenshot({ path: `${输出}/${宽}-${标记}-对局.png` });
      await 页.reload();
      await 页.waitForFunction(
        () => window.__GAMEMAKER_TEST__?.getSnapshot().sceneId === "开始菜单",
      );
      assert.equal(
        await 页.evaluate(() => JSON.parse(localStorage.getItem("再消一行:设置") ?? "{}").方块外观),
        方案.名称,
      );
      if (主题验收)
        assert.equal(
          await 页.evaluate(
            () => JSON.parse(localStorage.getItem("gamemaker:settings") ?? "{}").样式,
          ),
          主题,
        );
      await 页.close();
    }
  assert.deepEqual(错误, []);
  console.log(
    主题验收
      ? "通过：三套主题在 1280/430 下通过设置选择、保存与刷新，采集设置和对局实际画面。"
      : "通过：四套材质在 1280/430 下通过游戏设置选择、保存与刷新，保留旧设置，并检查棋盘、预告和暂存实际画面。",
  );
} finally {
  await 浏览器.close();
}
