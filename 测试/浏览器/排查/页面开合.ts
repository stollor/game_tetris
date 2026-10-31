import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { chromium } from "playwright";
import type { 界面按钮快照 } from "../../../代码/应用/接口/上下文";

const 地址 = process.argv[2] ?? "http://127.0.0.1:3001";
const 省电 = process.argv.includes("--省电");
const 输出 = resolve(`.gamemaker/报告/页面开合/${省电 ? "省电" : "标准"}`);
await mkdir(输出, { recursive: true });
const 浏览器 = await chromium.launch({ channel: "chrome" });
const 环境 = await 浏览器.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 1,
  hasTouch: true,
  recordVideo: { dir: join(输出, "录像"), size: { width: 390, height: 844 } },
});
const 页 = await 环境.newPage();
const 错误: string[] = [];
const 记录: { 页面: string; 关闭方式: string; 持续毫秒: number }[] = [];
页.on("pageerror", (错) => 错误.push(错.message));
页.on("console", (消息) => {
  if (消息.type() === "error") 错误.push(消息.text());
});
const 界面 = () => 页.evaluate(() => window.__three版__?.读取界面());
const 当前页 = () => 页.evaluate(() => window.__three版__?.读取状态().页面);
const 取按钮 = async (名称: string): Promise<界面按钮快照> => {
  const 按钮 = (await 界面())?.按钮.find((项) => 项.名称 === 名称);
  assert(按钮, `缺少按钮 ${名称}`);
  return 按钮;
};
const 点 = async (按钮: 界面按钮快照) => {
  await 页.mouse.click(按钮.左 + 按钮.宽 / 2, 按钮.上 + 按钮.高 / 2);
};
const 等落位 = () =>
  页.waitForFunction(
    () => !window.__three版__?.读取界面().文字?.includes("页面开合:播放中"),
    undefined,
    { polling: "raf" },
  );
try {
  await 页.goto(地址);
  await 页.waitForFunction(() => !!window.__three版__);
  await 页.bringToFront();
  await 页.evaluate(
    (开) => window.__three版__?.更新设置({ 背景动态: false, 省电模式: 开 ? "开" : "关" }),
    省电,
  );
  await 页.screenshot({ path: join(输出, "00-菜单.png") });
  for (const 页面 of ["设置", "成就", "商店"] as const) {
    for (const 关闭方式 of ["按钮", "Escape"] as const) {
      assert.equal(await 当前页(), "菜单");
      const 开始 = Date.now();
      await 点(await 取按钮(页面));
      assert.equal(await 当前页(), 页面);
      const 入场 = await 界面();
      assert(入场?.文字?.includes("页面开合:播放中"));
      const 返回 = await 取按钮("返回主菜单");
      assert.equal(返回.可用, false, "打开期间返回热区禁用");
      // 正在打开时连点与 Escape 均不能越过动画或穿透到菜单。
      await 点(返回);
      await 页.keyboard.press("Escape");
      assert.equal(await 当前页(), 页面);
      if (关闭方式 === "按钮") {
        await 页.screenshot({ path: join(输出, `${页面}-01-打开中.png`) });
      }
      await 等落位();
      assert.equal((await 取按钮("返回主菜单")).可用, true);
      const 打开毫秒 = Date.now() - 开始;
      if (关闭方式 === "按钮") {
        await 页.screenshot({ path: join(输出, `${页面}-02-落位.png`) });
        // 只检查内容/控件；商店风景仍按原节拍更新。
        const 内容重建 = () =>
          页.evaluate(() => {
            const 统计 = window.__three版__?.读取统计().图层缓存;
            return Object.entries(统计?.各层重建耗时 ?? {})
              .filter(([层]) => Number(层) % 7 >= 2)
              .reduce((和, [, 值]) => 和 + 值.次数, 0);
          });
        const 前 = await 内容重建();
        await 页.waitForTimeout(150);
        const 后 = await 内容重建();
        assert.equal(前, 后, "落位后恢复缓存");
      }
      if (关闭方式 === "按钮") await 点(await 取按钮("返回主菜单"));
      else await 页.keyboard.press("Escape");
      assert.equal(await 当前页(), 页面, "收回完成前不切页");
      assert.equal((await 取按钮("返回主菜单")).可用, false);
      await 页.keyboard.press("Escape");
      if (关闭方式 === "按钮") {
        await 页.screenshot({ path: join(输出, `${页面}-03-关闭中.png`) });
      }
      await 页.waitForFunction(() => window.__three版__?.读取状态().页面 === "菜单");
      const 栈 = await 页.evaluate(() => window.__three版__?.读取状态().场景栈);
      assert.deepEqual(栈, ["菜单"], "不重复返回或遗留页面");
      记录.push({ 页面, 关闭方式, 持续毫秒: 打开毫秒 });
      await 页.waitForTimeout(80);
    }
  }
  // 再次进入设置并改变真实设置，确认动画后热区与显示位置一致。
  await 点(await 取按钮("设置"));
  await 等落位();
  const 原音量 = await 页.evaluate(() => window.__three版__?.读取设置().音效音量);
  const 音量 = await 取按钮("音量:音效音量");
  await 页.mouse.click(音量.左 + 音量.宽 * 0.35, 音量.上 + 音量.高 / 2);
  const 新音量 = await 页.evaluate(() => window.__three版__?.读取设置().音效音量);
  assert.notEqual(原音量, 新音量);
  await 页.evaluate((值) => {
    if (值 !== undefined) window.__three版__?.更新设置({ 音效音量: 值 });
  }, 原音量);
  await 点(await 取按钮("返回主菜单"));
  await 页.waitForFunction(() => window.__three版__?.读取状态().页面 === "菜单");
  await 页.screenshot({ path: join(输出, "99-返回菜单.png") });
  assert.deepEqual(错误, []);
  await writeFile(
    join(输出, "结果.json"),
    JSON.stringify({ 通过: true, 模拟视口: "390x844 DPR1，非手机真机", 省电, 记录, 错误 }, null, 2),
  );
  console.log(JSON.stringify({ 通过: true, 输出, 记录, 错误 }));
} finally {
  await 环境.close();
  await 浏览器.close();
}
