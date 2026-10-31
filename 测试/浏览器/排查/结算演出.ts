import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { chromium } from "playwright";
import type {} from "../../../代码/应用/启动";
import type { 结算页面 } from "../../../代码/页面/结算/结算页面";

const 输出 = resolve(process.argv[3] ?? ".gamemaker/报告/结算循环");
await mkdir(输出, { recursive: true });
const 浏览器 = await chromium.launch({ channel: "chrome" });
const 页 = await 浏览器.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
const 错误: string[] = [];
const 记录: object[] = [];
页.on("pageerror", (e) => 错误.push(e.message));
const 界面 = () => 页.evaluate(() => window.__three版__?.读取界面());
const 状态 = () =>
  页.evaluate(() => {
    const 值 = window.__three版__?.读取状态();
    if (值?.场景栈.at(-1) !== "结算") return null;
    const 是结算 = (候选: object): 候选 is ReturnType<结算页面["读取快照"]> =>
      Reflect.get(候选, "阶段") === "结束" &&
      typeof Reflect.get(候选, "动画毫秒") === "number" &&
      typeof Reflect.get(候选, "需要连续帧") === "boolean" &&
      Array.isArray(Reflect.get(候选, "飘字"));
    if (!是结算(值)) throw new Error("结算页未返回完整的演出快照");
    return 值;
  });
async function 点击(名称: string) {
  await 页.waitForFunction(
    (名) => window.__three版__?.读取界面().按钮.some((项) => 项.名称 === 名 && 项.可用 !== false),
    名称,
  );
  const 按钮 = (await 界面())?.按钮.find((项) => 项.名称 === 名称);
  assert.ok(按钮, 名称);
  await 页.mouse.click(按钮.左 + 按钮.宽 / 2, 按钮.上 + 按钮.高 / 2);
}
async function 等时间(时间: number) {
  await 页.waitForFunction((时间) => {
    const 值 = window.__three版__?.读取状态();
    return 值?.场景栈.at(-1) === "结算" && Number(Reflect.get(值, "动画毫秒")) >= 时间;
  }, 时间);
}
async function 截图(名称: string) {
  await 页.evaluate(() => new Promise<void>((完成) => requestAnimationFrame(() => 完成())));
  await 页.screenshot({ path: join(输出, `${名称}.png`) });
  const 值 = await 状态();
  assert.ok(值);
  const 按钮 = (await 界面())?.按钮 ?? [];
  if (值.飘字绘制) {
    assert.ok(
      值.飘字绘制.矩形.上 + 值.飘字绘制.矩形.高 < Math.min(...按钮.map((项) => 项.上)),
      "飘字与操作区全程分开",
    );
    assert.ok(值.飘字绘制.矩形.上 >= 值.提示区.上);
  }
  记录.push({ 名称, 状态: 值, 界面: await 界面() });
  return 值;
}
async function 开局(模式: string) {
  await 点击("开始游戏");
  await 点击(`开始:${模式}`);
  await 页.waitForFunction(() => window.__three版__?.读取状态().页面 === "对局");
}
try {
  await 页.goto(process.argv[2] ?? "http://127.0.0.1:3001");
  await 页.waitForFunction(() => window.__three版__);
  await 页.evaluate(() =>
    window.__three版__?.更新设置({ 背景动态: false, 省电模式: "关", 样式: "极光原野" }),
  );
  await 开局("马拉松");
  console.log("等待真实有效对局45秒，再完成15次实际落块以满足奖励条件");
  await 页.waitForFunction(
    () => (window.__再消一行测试__?.读取状态().有效用时 ?? 0) >= 45000,
    undefined,
    { timeout: 60000 },
  );
  for (let i = 0; i < 15; i++)
    await 页.evaluate(() => {
      window.__再消一行测试__?.准备四行消除(true);
      window.__再消一行测试__?.硬降();
    });
  const 奖励条件 = await 页.evaluate(() => ({
    时长: window.__再消一行测试__?.读取状态().有效用时,
    落块: window.__three版__?.读取统计().对局统计.落块数,
  }));
  assert.ok(奖励条件.时长 && 奖励条件.时长 >= 45000);
  assert.ok(奖励条件.落块 && 奖励条件.落块 >= 15);
  await 页.evaluate(() => {
    const 原保存 = Storage.prototype.setItem;
    Reflect.set(window, "__恢复结算存储", () => {
      Storage.prototype.setItem = 原保存;
    });
    Storage.prototype.setItem = function (键, 值) {
      if (键.includes("旅行版:收藏")) throw new Error("结算验收：模拟保存失败");
      原保存.call(this, 键, 值);
    };
  });
  await 页.evaluate(() => window.__再消一行测试__?.结束当前对局());
  await 等时间(100);
  await 截图("01-方块入场");
  assert.ok((await 界面())?.按钮.every((项) => 项.可用 === false));
  await 等时间(650);
  await 截图("02-分数落定中");
  await 等时间(850);
  const 失败 = await 截图("02a-保存失败独立重试");
  assert.ok(失败.金币失败原因);
  assert.equal(失败.飘字.length, 0, "保存失败时先保留重试操作，不用飘字覆盖");
  await 等时间(6500);
  const 延迟重试 = await 截图("02b-待机阶段仍可重试");
  assert.equal(延迟重试.显示金币, null);
  assert.equal(延迟重试.循环提示, undefined, "保存失败操作不与轮播重叠");
  await 页.evaluate(() => {
    const 恢复 = Reflect.get(window, "__恢复结算存储");
    if (typeof 恢复 === "function") 恢复();
  });
  await 点击("重试奖励");
  const 演出偏移 = ((await 状态())?.动画毫秒 ?? 0) - 900;
  await 等时间(演出偏移 + 1200);
  const 奖励初 = await 截图("03-奖励飘字");
  assert.equal(奖励初.飘字类型, "说明");
  assert.ok(奖励初.飘字.length > 0);
  assert.equal(
    奖励初.金币余额,
    失败.金币余额 + (奖励初.金币奖励?.新增 ?? 0),
    "重试只增加本局一次奖励",
  );
  assert.ok(!(await 界面())?.按钮.some((项) => 项.名称 === "重试奖励"));
  await 等时间(演出偏移 + 2350);
  const 奖励末 = await 截图("04-奖励飘字上移");
  assert.ok(
    奖励末.飘字绘制 && 奖励初.飘字绘制 && 奖励末.飘字绘制.矩形.上 < 奖励初.飘字绘制.矩形.上,
  );
  await 等时间(演出偏移 + 3250);
  const 成就 = await 截图("05-成就飘字");
  assert.equal(成就.飘字类型, "成就");
  assert.ok(成就.新成就.length > 0);
  await 等时间(演出偏移 + 6000);
  const 静止 = await 截图("06-提示消失后的结算");
  assert.equal(静止.飘字.length, 0);
  assert.equal(静止.飘字绘制, null);
  assert.equal(静止.需要连续帧, true);
  assert.equal(静止.演出阶段, "循环");
  assert.equal(静止.显示金币, 静止.金币奖励?.新增);
  assert.equal(静止.显示分数, 静止.分数);
  assert.equal(静止.金币余额, 奖励初.金币余额, "动画不重复发奖");
  await 页.evaluate(() => window.__three版__?.开始绘制采样());
  await 等时间(演出偏移 + 10000);
  const 正常采样 = await 页.evaluate(() => window.__three版__?.结束绘制采样());
  assert.ok(正常采样 && 正常采样.样本数 > 20);
  记录.push({ 名称: "正常待机绘制采样", 采样: 正常采样 });
  const 循环 = await 截图("06a-持续循环与常驻金币");
  assert.equal(循环.显示分数, 静止.显示分数);
  assert.equal(循环.显示金币, 静止.显示金币);
  assert.equal(循环.金币余额, 静止.金币余额);
  assert.ok(循环.动画毫秒 > 静止.动画毫秒);
  assert.notDeepEqual(
    await Bun.file(join(输出, "06-提示消失后的结算.png")).bytes(),
    await Bun.file(join(输出, "06a-持续循环与常驻金币.png")).bytes(),
  );
  const 主 = (await 界面())?.按钮.find((项) => 项.名称 === "重新开始");
  assert.ok(主?.可用);
  await 页.mouse.move(主.左 + 主.宽 / 2, 主.上 + 主.高 / 2);
  await 页.mouse.down();
  await 截图("07-重开按钮按压");
  await 页.mouse.move(10, 10);
  await 页.mouse.up();
  assert.ok(await 状态(), "按下移出不会重开");
  await 点击("重新开始");
  await 页.waitForFunction(() => window.__three版__?.读取状态().场景栈.at(-1) === "对局");
  await 页.evaluate(() => window.__再消一行测试__?.结束当前对局());
  await 等时间(1000);
  await 截图("08-零分新局也有入场");
  await 点击("返回主菜单");
  await 页.waitForFunction(() => window.__three版__?.读取状态().场景栈.at(-1) === "菜单");
  await 页.evaluate(() => window.__three版__?.更新设置({ 语言: "English", 省电模式: "开" }));
  await 页.reload();
  await 页.waitForFunction(() => window.__three版__?.读取设置().语言 === "English");
  await 开局("冲刺");
  await 页.evaluate(() => window.__再消一行测试__?.准备结算(true));
  await 等时间(500);
  await 截图("09-英文省电挑战完成");
  await 等时间(6000);
  assert.equal((await 状态())?.需要连续帧, false);
  const 省电初 = await 截图("10-英文省电待机");
  await 页.evaluate(() => window.__three版__?.开始绘制采样());
  await 等时间(9200);
  const 省电采样 = await 页.evaluate(() => window.__three版__?.结束绘制采样());
  assert.ok(
    省电采样 && 省电采样.样本数 > 5 && 省电采样.样本数 < 正常采样.样本数 * 0.55,
    "省电档必须实际降低绘制频率",
  );
  记录.push({ 名称: "省电待机绘制采样", 采样: 省电采样 });
  const 省电末 = await 截图("10a-英文省电仍在循环");
  assert.equal(省电末.显示金币, 0);
  assert.equal(省电末.演出阶段, "循环");
  assert.equal(省电末.循环帧间隔毫秒, 100);
  assert.ok(省电末.动画毫秒 > 省电初.动画毫秒);
  assert.equal(省电末.金币余额, 省电初.金币余额);
  assert.notDeepEqual(
    await Bun.file(join(输出, "10-英文省电待机.png")).bytes(),
    await Bun.file(join(输出, "10a-英文省电仍在循环.png")).bytes(),
  );
  assert.deepEqual(错误, []);
  await Bun.write(
    join(输出, "结果.json"),
    JSON.stringify({ 通过: true, 环境: "Chrome 390x844 DPR1模拟视口", 错误, 记录 }, null, 2),
  );
  console.log(
    JSON.stringify({ 通过: true, 截图: 记录.filter((项) => Reflect.has(项, "界面")).length, 错误 }),
  );
} catch (错误) {
  await 页.screenshot({ path: join(输出, "失败现场.png") });
  await Bun.write(
    join(输出, "失败现场.json"),
    JSON.stringify(
      await 页.evaluate(() => ({
        状态: window.__three版__?.读取状态(),
        界面: window.__three版__?.读取界面(),
        设置: window.__three版__?.读取设置(),
      })),
      null,
      2,
    ),
  );
  throw 错误;
} finally {
  await 浏览器.close();
}
