import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const 根 = `http://127.0.0.1:${process.env.PORT ?? 4175}`;
const 地址 = new URL(`/ui/${encodeURIComponent("俄罗斯方块")}/index.html`, 根);
地址.searchParams.set("category", "动效");
地址.searchParams.set("sample", "背景动态");
const 输出 = "reports/ui-suite-background";
await mkdir(输出, { recursive: true });
const 浏览器 = await chromium.launch({
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
const 错误: string[] = [];
try {
  const 页 = await 浏览器.newPage();
  页.on("pageerror", (错) => 错误.push(错.message));
  for (const 宽 of [1440, 430]) {
    await 页.setViewportSize({ width: 宽, height: 1000 });
    await 页.goto(地址.href);
    await 页.locator("canvas").waitFor();
    if (宽 < 700) await 页.getByRole("button", { name: "展开面板", exact: true }).click();
    const 画布 = 页.locator("canvas");
    for (let 轮 = 0; 轮 < 2; 轮++) {
      for (const 主题 of ["晨光海岸", "云海山岚", "极光原野", "霓虹天际"]) {
        const 按钮 = 页.getByRole("button", { name: 主题, exact: true });
        await 按钮.click();
        assert.equal(await 按钮.getAttribute("aria-pressed"), "true");
        const 前 = await 画布.screenshot();
        await 页.waitForTimeout(180);
        const 后 = await 画布.screenshot({ path: `${输出}/${宽}-${主题}.png` });
        assert.deepEqual(错误, [], `${宽} ${主题} 切换后不得报错`);
        assert.ok(!前.equals(后), `${宽} ${主题} 切换后动画须继续运行`);
      }
    }
    await 页.getByRole("button", { name: "重置", exact: true }).click();
    assert.equal(
      await 页.getByRole("button", { name: "晨光海岸", exact: true }).getAttribute("aria-pressed"),
      "true",
    );
    await 页.getByRole("button", { name: "颜色", exact: true }).click();
    await 页.getByRole("button", { name: "动效", exact: true }).click();
    await 页.waitForTimeout(180);
    assert.deepEqual(错误, [], "离开再返回动效分类不得残留失效回调");
  }
  await 页.setViewportSize({ width: 1440, height: 1000 });
  await 页.goto(`${根}/?project=${encodeURIComponent("俄罗斯方块")}&view=UI%20套件&suite=project`);
  const 框 = 页.frameLocator(".suite-preview");
  await 框.getByRole("button", { name: "动效", exact: true }).click();
  for (const 主题 of ["云海山岚", "极光原野", "霓虹天际", "晨光海岸"]) {
    await 框.getByRole("button", { name: 主题, exact: true }).click();
    await 页.waitForTimeout(100);
    assert.deepEqual(错误, [], "看板内嵌切换背景不得报错");
  }
  await 页.screenshot({ path: `${输出}/看板.png`, fullPage: true });
  console.log("通过：1440/430 四种背景反复切换、持续动画、重置、分类返回和看板内嵌切换。");
} finally {
  await 浏览器.close();
}
