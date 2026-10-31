import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { chromium } from "playwright";
import type {} from "../../../代码/应用/启动";
import type { 界面按钮快照 } from "../../../代码/应用/接口/上下文";

const 地址 = process.argv[2] ?? "http://127.0.0.1:3000";
const 输出 = resolve(".gamemaker/报告/界面细修/修改后");
await mkdir(输出, { recursive: true });
const 浏览器 = await chromium.launch({ channel: "chrome" });
const 环境 = await 浏览器.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 1,
  hasTouch: true,
});
const 页 = await 环境.newPage();
const 错误: string[] = [];
const 记录: object[] = [];
页.on("pageerror", (错) => 错误.push(错.message));
页.on("console", (消息) => {
  if (消息.type() === "error") 错误.push(消息.text());
});
const 界面 = () => 页.evaluate(() => window.__three版__?.读取界面());
const 状态 = () => 页.evaluate(() => window.__three版__?.读取状态());
async function 取按钮(名称: string): Promise<界面按钮快照> {
  await 页
    .waitForFunction(
      (名) => window.__three版__?.读取界面().按钮.some((键) => 键.名称 === 名 && 键.可用 !== false),
      名称,
      { timeout: 6000 },
    )
    .catch(async () => {
      throw new Error(
        `未找到 ${名称}：${JSON.stringify(await 状态())}；${JSON.stringify(await 界面())}`,
      );
    });
  const 键 = (await 界面())?.按钮.find((键) => 键.名称 === 名称);
  assert(键, 名称);
  return 键;
}
async function 点击(名称: string) {
  const 键 = await 取按钮(名称);
  await 页.mouse.click(键.左 + 键.宽 / 2, 键.上 + 键.高 / 2);
}
const 等落位 = () =>
  页.waitForFunction(() => !window.__three版__?.读取界面().文字?.includes("页面开合:播放中"));
async function 等主菜单() {
  await 页.waitForFunction(() => window.__three版__?.读取状态().页面 === "菜单");
}
async function 截图(名称: string) {
  await 页.screenshot({ path: join(输出, `${名称}.png`) });
}
async function 等暂停(暂停: boolean) {
  await 页.waitForFunction(
    (值) => window.__three版__?.读取状态().阶段 === (值 ? "暂停" : "进行中"),
    暂停,
  );
}
try {
  await 页.goto(地址);
  await 页.waitForFunction(() => !!window.__three版__);
  await 页.bringToFront();
  // 使用隔离存档，完整主题都实际进入对局；更新走与设置页相同的服务。
  const 套装 = [
    { 名: "极光原野", 变化: { 样式: "极光原野" } },
    { 名: "夜空鎏金", 变化: { 样式: "夜空鎏金" } },
    { 名: "暖纸古典", 变化: { 样式: "暖纸古典" } },
    { 名: "砖机液晶", 变化: { 主题选择: "砖机液晶" } },
    { 名: "街机彩砖", 变化: { 主题选择: "街机彩砖" } },
    { 名: "立体晶格", 变化: { 主题选择: "立体晶格" } },
  ] as const;
  for (const 项 of 套装) {
    const 样式 = 项.名;
    await 页.evaluate(
      (变化) =>
        window.__three版__?.更新设置({ ...变化, 背景动态: false, 音效音量: 0, 音乐音量: 0 }),
      项.变化,
    );
    await 点击("开始游戏");
    await 点击("模式:马拉松");
    await 页.waitForFunction(
      () =>
        window.__three版__?.读取状态().页面 === "对局" &&
        window.__three版__?.读取界面().文字?.includes("入场:完成"),
    );
    assert(!(await 界面())?.按钮.some((键) => 键.名称 === "离开"), "对局不暴露直接退出入口");
    const 暂停 = await 取按钮("暂停");
    assert(暂停.左 < 50 && 暂停.上 < 50, "暂停应在左上");
    const 前 = await 状态();
    await 页.mouse.click(347, 38);
    assert.equal((await 状态())?.阶段, "进行中", "旧右上区域不再暂停或退出");
    await 截图(`${样式}-对局`);
    const 对局统计 = await 页.evaluate(() => window.__three版__?.读取统计());
    if (样式 === "立体晶格") {
      assert.equal(对局统计?.棋盘表现, "透视");
      assert.equal(对局统计?.仪表表现, "装置");
      assert.equal(对局统计?.透视棋盘, true);
    }
    if (样式 === "极光原野") {
      assert.equal(对局统计?.棋盘表现, "平面");
      assert.equal(对局统计?.仪表表现, "装置");
      assert.equal(对局统计?.透视棋盘, false);
    }
    if (样式 === "砖机液晶" || 样式 === "街机彩砖") {
      assert.equal(对局统计?.棋盘表现, "平面");
      assert.equal(对局统计?.透视棋盘, false);
    }
    const 左转 = await 取按钮("左转");
    await 页.mouse.move(左转.左 + 左转.宽 / 2, 左转.上 + 左转.高 / 2);
    await 页.mouse.down();
    await 页.waitForFunction(() => (window.__three版__?.读取统计().对局统计.操作次数 ?? 0) > 0);
    await 截图(`${样式}-按下`);
    await 页.mouse.up();
    await 点击("暂存操作");
    assert.equal((await 状态())?.本块已暂存, true);
    await 点击("软降");
    await 点击("暂停");
    await 等暂停(true);
    const 暂停用时 = (await 状态())?.有效用时;
    await 页.evaluate(
      () =>
        new Promise<void>((完成) => {
          let 帧 = 0;
          const 下一帧 = () => (++帧 >= 8 ? 完成() : requestAnimationFrame(下一帧));
          requestAnimationFrame(下一帧);
        }),
    );
    assert.equal((await 状态())?.有效用时, 暂停用时, "暂停后不计时");
    await 截图(`${样式}-暂停`);
    await 点击("对局设置");
    assert.equal((await 状态())?.对局设置打开, true);
    await 页.mouse.click(195, 80);
    assert.equal((await 状态())?.对局设置打开, false, "对局内设置外点击关闭");
    assert.equal((await 状态())?.阶段, "暂停", "关闭设置保留暂停");
    await 点击("继续");
    await 等暂停(false);
    await 点击("暂停");
    await 等暂停(true);
    await 点击("返回主菜单");
    await 等主菜单();
    await 点击("返回");
    await 点击("设置");
    await 等落位();
    await 截图(`${样式}-设置`);
    // 点面板内空白不能关闭，也不能穿透到菜单。
    await 页.mouse.click(22, 500);
    assert.equal((await 状态())?.页面, "设置");
    const 开 = await 取按钮("设置:动态背景:开");
    await 点击("设置:动态背景:开");
    assert.equal(await 页.evaluate(() => window.__three版__?.读取设置().背景动态), true);
    await 点击("设置:动态背景:关");
    await 点击("关闭设置:上");
    assert((await 界面())?.文字?.includes("页面开合:播放中"), "外点击复用关闭动画");
    await 等主菜单();
    记录.push({ 样式, 暂停按钮: 暂停, 动态背景按钮: 开, 起始用时: 前?.有效用时, 暂停用时 });
  }
  await 页.evaluate(() => window.__three版__?.更新设置({ 主题选择: "极光原野" }));
  assert.equal(await 页.evaluate(() => window.__three版__?.读取统计().主题), "极光原野");
  await 页.evaluate(
    () =>
      new Promise<void>((完成) => {
        requestAnimationFrame(() => requestAnimationFrame(() => 完成()));
      }),
  );
  await 截图("极光原野-切回");
  assert.equal(
    await 页.evaluate(() => window.__three版__?.读取统计().透视棋盘),
    false,
    "离开 3D 对局后释放透视场景",
  );
  await 点击("开始游戏");
  await 点击("模式:马拉松");
  await 页.waitForFunction(
    () =>
      window.__three版__?.读取状态().页面 === "对局" &&
      window.__three版__?.读取界面().文字?.includes("入场:完成"),
  );
  const 切回对局 = await 页.evaluate(() => window.__three版__?.读取统计());
  assert.equal(切回对局?.棋盘表现, "平面");
  assert.equal(切回对局?.仪表表现, "装置");
  assert.equal(切回对局?.透视棋盘, false);
  await 截图("极光原野-切回对局");
  await 点击("暂停");
  await 等暂停(true);
  await 点击("返回主菜单");
  await 等主菜单();
  await 点击("返回");
  for (const 方位 of ["下", "左", "右"] as const) {
    await 点击("设置");
    await 等落位();
    await 点击(`关闭设置:${方位}`);
    await 等主菜单();
  }
  // 语言下拉优先消费外点击：第一次收下拉，第二次关闭设置。
  await 点击("设置");
  await 等落位();
  await 页.mouse.move(195, 500);
  await 页.mouse.wheel(0, 250);
  await 点击("语言下拉框");
  assert((await 界面())?.文字?.includes("语言菜单:true"));
  await 页.mouse.click(195, 80);
  assert.equal((await 状态())?.页面, "设置");
  assert((await 界面())?.文字?.includes("语言菜单:false"));
  await 点击("关闭设置:上");
  await 等主菜单();
  assert.deepEqual(错误, []);
  await writeFile(
    join(输出, "结果.json"),
    JSON.stringify(
      { 通过: true, 环境: "Chrome 390×844 DPR1 模拟视口，非手机真机", 配色: 记录, 错误 },
      null,
      2,
    ),
  );
  console.log(JSON.stringify({ 通过: true, 配色数: 记录.length, 错误, 输出 }));
} finally {
  await 环境.close();
  await 浏览器.close();
}
