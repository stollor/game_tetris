import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { chromium } from "playwright";
import type {} from "../../代码/three版/启动";
import type { 界面按钮快照 } from "../../代码/three版/接口/上下文";

const 输出 = resolve(process.argv[3] ?? "reports/视觉返工/补完交互");
await mkdir(输出, { recursive: true });
const 浏览器 = await chromium.launch({ channel: "chrome" });
const 页 = await 浏览器.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const 页面错误: string[] = [];
const 步骤: object[] = [];
页.on("pageerror", (错) => 页面错误.push(错.message));
页.on("console", (项) => {
  if (项.type() === "error") 页面错误.push(项.text());
});
const 界面 = () => 页.evaluate(() => window.__three版__?.读取界面());
const 状态 = () => 页.evaluate(() => window.__three版__?.读取状态());
const 设置 = () => 页.evaluate(() => window.__three版__?.读取设置());
const 文字 = async () => (await 界面())?.文字 ?? [];
async function 查找(名称: string): Promise<界面按钮快照> {
  const 项 = (await 界面())?.按钮.find((项) => 项.名称 === 名称 && 项.可用 !== false);
  assert.ok(项, `缺少可用按钮 ${名称}：${JSON.stringify(await 界面())}`);
  return 项;
}
async function 点(名称: string) {
  const 项 = await 查找(名称);
  await 页.mouse.click(项.左 + 项.宽 / 2, 项.上 + 项.高 / 2);
  await 页.waitForTimeout(120);
}
async function 记录(名称: string) {
  await 页.screenshot({ path: join(输出, `${步骤.length + 1}-${名称}.png`) });
  步骤.push({
    名称,
    界面: await 界面(),
    状态: await 状态(),
    统计: await 页.evaluate(() => window.__three版__?.读取统计()),
  });
  console.log(名称);
}
async function 滑动(x: number, y: number, 终X: number, 终Y: number) {
  await 页.mouse.move(x, y);
  await 页.mouse.down();
  await 页.mouse.move(终X, 终Y, { steps: 10 });
  await 页.mouse.up();
  await 页.waitForTimeout(180);
}
async function 回菜单() {
  const 按钮 = (await 界面())?.按钮 ?? [];
  if (按钮.some((项) => 项.名称 === "返回主菜单")) await 点("返回主菜单");
  if ((await 界面())?.按钮.some((项) => 项.名称 === "返回")) await 点("返回");
}
try {
  await 页.goto(process.argv[2] ?? "http://127.0.0.1:3000");
  await 页.waitForFunction(() => !!window.__three版__);
  await 页.evaluate(() => window.__three版__?.更新设置({ 背景动态: false, 省电模式: "关" }));
  await 页.mouse.click(200, 350);
  assert.ok((await 文字()).includes("状态:纯享"));
  const 原风景 = (await 文字()).find((项) => 项.startsWith("纯享:"));
  await 滑动(300, 400, 80, 400);
  assert.notEqual(
    (await 文字()).find((项) => 项.startsWith("纯享:")),
    原风景,
    "纯享左滑切景",
  );
  await 滑动(180, 320, 180, 530);
  await 查找("开始游戏");
  await 记录("纯享左右切景与下滑返回");

  await 点("设置");
  await 点("语言下拉框");
  await 查找("语言:English");
  await 页.keyboard.press("Escape");
  assert.ok(!(await 界面())?.按钮.some((项) => 项.名称 === "语言:English"));
  await 点("语言下拉框");
  await 点("语言:English");
  assert.equal((await 设置())?.语言, "English");
  await 点("语言下拉框");
  await 点("语言:简体中文");
  assert.equal((await 设置())?.语言, "简体中文");
  await 记录("设置语言下拉选择与关闭");
  const 音量 = await 查找("音量:音乐音量");
  const 音量Y = 音量.上 + 音量.高 / 2;
  await 滑动(音量.左 + 2, 音量Y, 音量.左 + 音量.宽 * 0.6, 音量Y);
  assert.ok(((await 设置())?.音乐音量 ?? 0) > 30, "滑块连续拖动");
  await 页.mouse.click(音量.左, 音量Y);
  assert.equal((await 设置())?.音乐音量, 0);
  await 页.mouse.move(200, 650);
  await 页.mouse.wheel(0, 450);
  await 页.waitForTimeout(220);
  const 滚动文字 = (await 文字()).find((项) => 项.startsWith("滚动:"));
  assert.ok(Number(滚动文字?.slice("滚动:".length) ?? 0) > 0, "设置列表纵向滚动");
  // 滚动后快照坐标与真实命中一致：语言下拉框已随内容上移，点它仍能打开菜单。
  await 点("语言下拉框");
  assert.ok((await 文字()).includes("语言菜单:true"), "滚动后语言下拉框命中和坐标一致");
  await 页.keyboard.press("Escape");
  assert.ok(!(await 文字()).includes("语言菜单:true"), "Esc 关闭滚动后的语言菜单");
  await 记录("设置纵向滚动与滑块");
  await 点("返回主菜单");

  await 点("商店");
  await 页.evaluate(() => window.__three版__?.增加金币(5000));
  const 可买 = (await 界面())?.按钮.find(
    (项) => 项.名称.startsWith("购买:") && !项.名称.endsWith("整套"),
  );
  assert.ok(可买);
  const 钱前 = await 页.evaluate(() => window.__three版__?.读取统计().金币);
  await 点(可买.名称);
  await 查找("确认交易");
  assert.equal(
    (await 界面())?.按钮.find((项) => 项.名称 === 可买.名称)?.可用,
    false,
    "弹层底层按钮禁用",
  );
  // Phaser 真相：确认纸页的遮罩只在面板外按下时关闭纸页；购买按钮坐标落在遮罩上，
  // 所以这里应关闭纸页，但底层按钮已禁用，不会在关闭的同时误触第二次购买。
  await 页.mouse.click(可买.左 + 可买.宽 / 2, 可买.上 + 可买.高 / 2);
  await 页.waitForTimeout(120);
  assert.ok(
    !(await 界面())?.按钮.some((项) => 项.名称 === "确认交易"),
    "点遮罩关闭确认纸页（Phaser 同口径）",
  );
  assert.equal(
    await 页.evaluate(() => window.__three版__?.读取统计().金币),
    钱前,
    "点遮罩不误触底层购买",
  );
  await 点(可买.名称);
  await 点("取消交易");
  assert.equal(await 页.evaluate(() => window.__three版__?.读取统计().金币), 钱前, "取消不扣币");
  await 点(可买.名称);
  await 点("确认交易");
  assert.ok(
    ((await 页.evaluate(() => window.__three版__?.读取统计().金币)) ?? 0) < (钱前 ?? 0),
    "确认购买扣币",
  );
  // Phaser 购买后保留确认纸页，下一次确认才穿戴。
  await 点("确认交易");
  assert.ok(!(await 界面())?.按钮.some((项) => 项.名称 === "确认交易"));
  await 记录("商店购买穿戴与模态隔离");
  await 滑动(320, 720, 80, 720);
  await 记录("商店地点目录横向滚动");
  await 点("商店:纯享");
  await 滑动(300, 350, 80, 350);
  await 页.keyboard.press("Escape");
  await 查找("返回主菜单");
  await 回菜单();
  await 点("成就");
  const 成就前 = await 文字();
  await 页.mouse.move(200, 400);
  await 页.mouse.wheel(0, 500);
  await 页.waitForTimeout(200);
  assert.notDeepEqual(await 文字(), 成就前, "成就滚动状态变化");
  await 记录("成就列表滚动与领奖状态");
  await 回菜单();

  await 点("开始游戏");
  await 点("排行榜:冲刺");
  assert.ok((await 文字()).includes("模式:冲刺"), "排行榜传入模式生效");
  await 点("排行榜周期:周");
  assert.ok((await 文字()).includes("周期:周"));
  await 记录("排行榜模式周期与平台降级");
  await 回菜单();
  await 点("开始游戏");
  await 点("开始:马拉松");
  await 点("暂停");
  await 点("对局设置");
  assert.equal((await 状态())?.对局设置打开, true);
  await 点("网格:关");
  assert.equal((await 设置())?.显示网格, false);
  await 点("网格:开");
  await 点("上键:左转");
  assert.equal((await 设置())?.手机上键旋转, "左转");
  await 记录("对局内设置真实操作");
  await 点("返回暂停菜单");
  await 点("继续");
  const 对局前 = await 页.evaluate(() => window.__three版__?.读取原始状态());
  await 页.setViewportSize({ width: 1280, height: 720 });
  await 页.waitForTimeout(250);
  const 对局后 = await 页.evaluate(() => window.__three版__?.读取原始状态());
  assert.ok(对局前 && 对局后);
  assert.deepEqual(Reflect.get(对局后, "棋盘"), Reflect.get(对局前, "棋盘"), "resize保留棋盘");
  await 点("暂停");
  await 点("继续");
  await 记录("对局重排后暂停继续可点");
  await 页.setViewportSize({ width: 390, height: 844 });
  await 页.waitForTimeout(160);
  await 页.evaluate(() => {
    window.__再消一行测试__?.准备四行消除();
    window.__再消一行测试__?.硬降();
  });
  const 四行 = await 状态();
  assert.equal(四行?.消行数, 4, "真实四行消除");
  assert.equal(四行.特效.消行?.四行, true);
  assert.ok(四行.特效.庆祝 > 0 && 四行.特效.锁定 && 四行.特效.拖尾);
  await 记录("四行光带拖尾锁定震动技巧");
  await 页.evaluate(() => window.__再消一行测试__?.结束当前对局());
  await 页.waitForFunction(() => window.__three版__?.读取状态().场景栈.at(-1) === "结算");
  for (const 帧 of [0, 1, 2, 3]) {
    await 页.waitForTimeout(100);
    await 记录(`结算金币连续帧${帧}`);
  }
  const 统计 = await 页.evaluate(() => window.__three版__?.读取统计());
  assert.ok(统计 && 统计.渲染.纹理峰值字节 <= 32 * 1024 * 1024);
  assert.deepEqual(页面错误, []);
} finally {
  await writeFile(
    join(输出, "结果.json"),
    JSON.stringify({ 环境: "Chromium模拟视口，不是真机", 页面错误, 步骤 }, null, 2),
  );
  await 浏览器.close();
}
