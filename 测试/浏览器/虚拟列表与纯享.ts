import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { chromium } from "playwright";
import type {} from "../../代码/应用/启动";

// 项目目标：手机390×844 DPR1；Chrome模拟视口，不是真机。
const 输出 = resolve(process.argv[3] ?? "reports/虚拟列表与纯享");
await mkdir(输出, { recursive: true });
const 浏览器 = await chromium.launch({ channel: "chrome" });
const 页 = await 浏览器.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
const 错误: string[] = [];
页.on("pageerror", (e) => 错误.push(e.message));
const 记录: object[] = [];
let 通过 = false;
const 界面 = () => 页.evaluate(() => window.__three版__?.读取界面());
async function 截图(名称: string) {
  await 页.evaluate(
    () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))),
  );
  await 页.screenshot({ path: join(输出, `${名称}.png`) });
  记录.push({ 名称, 界面: await 界面() });
}
async function 点击(名称: string) {
  await 页.waitForFunction(
    (名) => window.__three版__?.读取界面().按钮.some((项) => 项.名称 === 名),
    名称,
  );
  const 项 = (await 界面())?.按钮.find((x) => x.名称 === 名称 && x.可用 !== false);
  assert.ok(项, `缺少按钮 ${名称}`);
  await 页.mouse.click(项.左 + 项.宽 / 2, 项.上 + 项.高 / 2);
}
async function 等文字(文字: string) {
  await 页.waitForFunction((v) => window.__three版__?.读取界面()?.文字?.includes(v), 文字);
  await 页.waitForFunction(
    () =>
      !window.__three版__
        ?.读取界面()
        .文字?.some((项) => 项 === "过渡:移出" || 项 === "过渡:移入" || 项 === "过渡:流转"),
  );
}
async function 滚动(纵向: number, 横向 = 0, x = 200, y = 450) {
  await 页.mouse.move(x, y);
  await 页.mouse.wheel(横向, 纵向);
  await 页.evaluate(
    () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))),
  );
}
try {
  await 页.goto(process.argv[2] ?? "http://127.0.0.1:3000");
  await 页.waitForFunction(() => window.__three版__);
  await 截图("01-菜单");
  await 页.mouse.click(300, 450);
  await 页.waitForFunction(
    () =>
      Number(
        window.__three版__
          ?.读取界面()
          ?.文字?.find((x) => x.startsWith("退场:"))
          ?.slice(3),
      ) > 0.07,
  );
  assert.equal((await 界面())?.按钮.length, 0, "退场屏蔽旧热区");
  await 截图("02-菜单退场中");
  await 等文字("状态:纯享");
  await 截图("03-菜单纯享");
  await 点击("纯享:返回");
  await 等文字("状态:菜单");
  await 点击("商店");
  await 等文字("纯享:false");
  await 截图("04-商店");
  // 独立浏览器档案中购买两套收藏，让设置背景横排也包含旅行缩略图与半张可视卡。
  await 页.evaluate(() => window.__three版__?.增加金币(10000));
  await 点击("购买:成都熊猫.整套");
  await 点击("确认交易");
  await 点击("取消交易");
  await 滚动(0, 310, 200, 720);
  assert.ok(Number((await 界面())?.文字?.find((x) => x.startsWith("目录滚动:"))?.slice(5)) > 0);
  await 截图("05-商店目录滚动");
  const 地点 = (await 界面())?.按钮.find((x) => x.名称.startsWith("商店地点:") && x.宽 >= 80);
  assert.ok(地点);
  await 点击(地点.名称);
  await 等文字(`地点:${地点.名称.slice("商店地点:".length)}`);
  const 购买 = (await 界面())?.按钮.find((x) => x.名称.startsWith("购买:"));
  assert.ok(购买);
  await 点击(购买.名称);
  await 点击("取消交易");
  await 点击(`购买:${地点.名称.slice("商店地点:".length)}.整套`);
  await 点击("确认交易");
  await 点击("取消交易");
  await 点击("商店:纯享");
  await 页.waitForFunction(
    () =>
      Number(
        window.__three版__
          ?.读取界面()
          ?.文字?.find((x) => x.startsWith("退场:"))
          ?.slice(3),
      ) > 0.07,
  );
  assert.equal((await 界面())?.按钮.length, 0);
  await 截图("06-商店退场中");
  await 等文字("纯享:true");
  await 截图("07-商店纯享");
  await 点击("商店:返回");
  await 等文字("纯享:false");
  await 点击("返回主菜单");
  await 点击("设置");
  await 截图("08-设置顶端");
  await 点击("语言下拉框");
  await 点击("语言:English");
  assert.equal(await 页.evaluate(() => window.__three版__?.读取设置().语言), "English");
  await 点击("语言下拉框");
  await 点击("语言:简体中文");
  await 点击("页签:外观");
  await 点击("页签:自定义");
  await 滚动(2000);
  await 截图("09-设置中部");
  await 截图("10-设置外观");
  // 外观横排在自定义页内，横滚与竖滚分别消费自己的方向。
  const 原方块 = await 页.evaluate(() => window.__three版__?.读取设置().方块外观);
  const 方块钮 = (await 界面())?.按钮.find((x) => x.名称.startsWith("外观:方块:"));
  assert.ok(方块钮, "自定义页有方块卡");
  const 点x = 方块钮.左 + Math.min(24, 方块钮.宽 / 2);
  const 点y = 方块钮.上 + 方块钮.高 / 2;
  await 滚动(0, 220, 点x + 70, 点y);
  await 页.mouse.click(点x, 点y);
  const 横滚方块 = await 页.evaluate(() => window.__three版__?.读取设置().方块外观);
  assert.notEqual(横滚方块, 原方块, "横滚后卡片命中使用新索引");
  await 截图("11-设置横排滚动");
  await 滚动(-10000);
  await 滚动(10000);
  await 页.mouse.click(点x, 点y);
  assert.equal(
    await 页.evaluate(() => window.__three版__?.读取设置().方块外观),
    横滚方块,
    "纵向离屏后重建仍保留横排位置",
  );
  await 滚动(600);
  await 截图("12-设置底端");
  await 滚动(-10000);
  await 点击("页签:常规");
  await 截图("13-设置返回顶端");
  await 点击("语言下拉框");
  await 点击("语言:English");
  assert.equal(
    await 页.evaluate(() => window.__three版__?.读取设置().语言),
    "English",
    "条目离屏后重新创建仍可点击",
  );
  await 点击("返回主菜单");
  await 点击("开始游戏");
  await 页.waitForFunction(() =>
    window.__three版__?.读取界面().按钮.some((项) => 项.名称 === "返回"),
  );
  assert.ok(
    (await 界面())?.按钮.some((x) => x.名称 === "返回"),
    "设置返回后菜单可操作",
  );
  assert.deepEqual(错误, []);
  通过 = true;
  console.log(JSON.stringify({ 通过, 截图: 记录.length, 页面错误: 错误 }));
} finally {
  await writeFile(
    join(输出, "结果.json"),
    JSON.stringify(
      { 目标: "手机390×844 DPR1 Chrome模拟视口", 通过, 页面错误: 错误, 记录 },
      null,
      2,
    ),
  );
  await 浏览器.close();
}
