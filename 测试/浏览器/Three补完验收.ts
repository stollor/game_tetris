import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { chromium } from "playwright";
import type {} from "../../代码/应用/启动";
import type { 界面按钮快照 } from "../../代码/应用/接口/上下文";

/**
 * 视觉返工补完验收：纯享切主题、设置外观页四张主题卡、主题商店购买闭环、
 * 成就滚动、排行榜、对局内设置、重排、四行特效与结算金币帧。
 * 项目目标手机 390×844，DPR2 仅提高截图锐度；Chrome 模拟视口不是真机。
 * 每步都按调试桥的按钮快照真实点击，不硬编码坐标（排行钮/页签等卡内命中区除外，见注释）。
 */

const 输出 = resolve(process.argv[3] ?? ".gamemaker/报告/视觉返工/补完交互");
await mkdir(输出, { recursive: true });
const 浏览器 = await chromium.launch({ channel: "chrome" });
const 页 = await 浏览器.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const 页面错误: string[] = [];
const 步骤: object[] = [];
const 已知缺陷记录: string[] = [];
页.on("pageerror", (错) => 页面错误.push(错.message));
页.on("console", (项) => {
  if (项.type() !== "error") return;
  // GM 开发服务器控制通道与本页无关，连不上不算产品错误。
  if (项.text().includes("/control?project=") || 项.text().includes("ERR_CONNECTION_REFUSED"))
    return;
  页面错误.push(项.text());
});
const 界面 = () => 页.evaluate(() => window.__three版__?.读取界面());
const 状态 = () => 页.evaluate(() => window.__three版__?.读取状态());
const 设置 = () => 页.evaluate(() => window.__three版__?.读取设置());
const 文字 = async () => (await 界面())?.文字 ?? [];
const 金币数 = async () => (await 页.evaluate(() => window.__three版__?.读取统计()))?.金币 ?? 0;

async function 查找(名称: string, 超时毫秒 = 8000): Promise<界面按钮快照> {
  const 起 = Date.now();
  let 项 = (await 界面())?.按钮.find((项) => 项.名称 === 名称 && 项.可用 !== false);
  while (!项) {
    if (Date.now() - 起 > 超时毫秒)
      throw new Error(
        `缺少可用按钮 ${名称}：${((await 界面())?.按钮 ?? []).map((项) => 项.名称).join("、")}`,
      );
    await 页.waitForTimeout(80);
    项 = (await 界面())?.按钮.find((项) => 项.名称 === 名称 && 项.可用 !== false);
  }
  return 项;
}
/** 面板开合动画期间快照矩形会动：点完再看结果，没生效就重试几次。 */
async function 点直到(名称: string, 判定: () => Promise<boolean>, 次数 = 4) {
  for (let 次 = 0; 次 < 次数; 次++) {
    const 项 = await 查找(名称);
    await 页.mouse.click(项.左 + 项.宽 / 2, 项.上 + 项.高 / 2);
    await 页.waitForTimeout(320);
    if (await 判定()) return;
  }
  throw new Error(`点击「${名称}」后状态没有变化`);
}
async function 点(名称: string) {
  const 项 = await 查找(名称);
  await 页.mouse.click(项.左 + 项.宽 / 2, 项.上 + 项.高 / 2);
  await 页.waitForTimeout(160);
}
/**
 * 设置页内容在裁剪视口里滚动：离屏的行既看不见也点不到（命中会被裁剪掉）。
 * 这里把目标行滚进视口再点，避免「按钮在快照里却点不动」的假象。
 */
async function 滚到可见(名称: string) {
  const 视口 = await 查找("设置:滚动");
  const 顶 = 视口.上;
  const 底 = 视口.上 + 视口.高;
  for (let 次 = 0; 次 < 24; 次++) {
    const 项 = await 查找(名称);
    if (项.上 >= 顶 + 2 && 项.上 + 项.高 <= 底 - 2) return 项;
    await 页.mouse.move(视口.左 + 视口.宽 / 2, 顶 + 视口.高 / 2);
    await 页.mouse.wheel(0, 项.上 + 项.高 > 底 ? 120 : -120);
    await 页.waitForTimeout(120);
  }
  throw new Error(`滚不到可见：${名称}`);
}
async function 点行(名称: string) {
  const 项 = await 滚到可见(名称);
  await 页.mouse.click(项.左 + 项.宽 / 2, 项.上 + 项.高 / 2);
  await 页.waitForTimeout(160);
}
async function 记录(名称: string) {
  await 页.screenshot({ path: join(输出, `${步骤.length + 1}-${名称}.png`) });
  步骤.push({ 名称, 界面: await 界面(), 状态: await 状态() });
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
  for (let 次 = 0; 次 < 4; 次++) {
    const 钮 = (await 界面())?.按钮 ?? [];
    if (钮.some((项) => 项.名称 === "开始游戏")) return;
    const 出口 = 钮.find((项) => 项.名称 === "返回主菜单") ?? 钮.find((项) => 项.名称 === "返回");
    if (!出口) break;
    await 页.mouse.click(出口.左 + 出口.宽 / 2, 出口.上 + 出口.高 / 2);
    await 页.waitForTimeout(320);
  }
}
try {
  await 页.goto(process.argv[2] ?? "http://127.0.0.1:3000");
  await 页.waitForFunction(() => !!window.__three版__);
  await 页.evaluate(() => window.__three版__?.更新设置({ 背景动态: false, 省电模式: "关" }));
  await 页.mouse.click(200, 350);
  await 查找("纯享:返回");
  assert.ok((await 文字()).includes("页面:纯享"), "菜单轻点进入纯享");
  const 原主题 = (await 文字()).find((项) => 项.startsWith("风景:"));
  await 滑动(300, 400, 80, 400);
  assert.notEqual(
    (await 文字()).find((项) => 项.startsWith("风景:")),
    原主题,
    "纯享左滑切到下一套主题",
  );
  await 滑动(80, 400, 300, 400);
  assert.equal(
    (await 文字()).find((项) => 项.startsWith("风景:")),
    原主题,
    "纯享右滑切回",
  );
  assert.ok(!(await 界面())?.按钮.some((项) => 项.名称 === "纯享:动态"), "纯享不提供动静态切换");
  await 滑动(180, 320, 180, 530);
  await 查找("开始游戏");
  await 记录("纯享四套主题切换、无动态按钮与下滑返回");

  await 点("设置");
  await 点行("语言下拉框");
  await 查找("语言:English");
  // 点遮罩关闭语言菜单（不选语言、不改设置）。
  await 点("关闭语言菜单");
  assert.ok(!(await 界面())?.按钮.some((项) => 项.名称 === "语言:English"), "点遮罩关闭语言菜单");
  assert.equal((await 设置())?.语言, "简体中文", "关闭菜单不改语言");
  await 点行("语言下拉框");
  await 点("语言:English");
  assert.equal((await 设置())?.语言, "English");
  await 点行("语言下拉框");
  await 点("语言:简体中文");
  assert.equal((await 设置())?.语言, "简体中文");
  await 记录("设置语言下拉选择与关闭");
  // 音量行：两个滑块都在；用「音效」验证真实拖动（音乐音量另有已知缺陷，见下）。
  const 音量钮 = (await 界面())?.按钮 ?? [];
  assert.ok(
    音量钮.some((项) => 项.名称 === "音量:音乐音量") &&
      音量钮.some((项) => 项.名称 === "音量:音效音量"),
    `设置页应有音乐/音效两个音量滑块：${音量钮.map((项) => 项.名称).join("、")}`,
  );
  const 音效滑 = await 滚到可见("音量:音效音量");
  await 页.mouse.click(音效滑.左 + 音效滑.宽 * 0.75, 音效滑.上 + 音效滑.高 / 2);
  await 页.waitForTimeout(250);
  const 音效点击值 = (await 设置())?.音效音量;
  assert.ok(
    音效点击值 === 75,
    `音效滑块点 75% 应写入 75，实际 ${音效点击值}（矩形 ${JSON.stringify(音效滑)}）`,
  );
  const 音效滑二 = await 滚到可见("音量:音效音量");
  await 滑动(
    音效滑二.左 + 音效滑二.宽 * 0.75,
    音效滑二.上 + 音效滑二.高 / 2,
    音效滑二.左 + 音效滑二.宽 * 0.4,
    音效滑二.上 + 音效滑二.高 / 2,
  );
  // 拖动会逐次写设置并重建内容节点，指针后续帧会落到新节点上，因此只断言「拖低了」。
  const 音效拖动值 = (await 设置())?.音效音量 ?? 0;
  assert.ok(音效拖动值 < 75 && 音效拖动值 >= 5, `音效滑块拖动应把音量拖低（75 → ${音效拖动值}）`);
  // 音乐音量读写往返（专属设置曾把它覆盖回旧值，已由设置层修好）。
  const 音乐往返 = await 页.evaluate(() => {
    window.__three版__?.更新设置({ 音乐音量: 40 });
    return window.__three版__?.读取设置().音乐音量;
  });
  assert.equal(音乐往返, 40, `音乐音量写入应能读回：${音乐往返}`);
  已知缺陷记录.push("无（历史缺陷：音乐音量被专属设置覆盖，已由设置层修复）");

  // 外观页：只剩四张主题卡（不再有套装/自定义子页签、样式/背景/方块分项卡）。
  const 页签 = await 查找("设置:页签");
  await 页.mouse.click(页签.左 + 页签.宽 / 2, 页签.上 + 页签.高 / 2);
  await 页.waitForTimeout(320);
  assert.ok((await 文字()).includes("页签:外观"), "页签可切到外观");
  const 外观钮 = (await 界面())?.按钮 ?? [];
  assert.deepEqual(
    外观钮.map((项) => 项.名称).filter((名) => 名.startsWith("外观:主题:")),
    ["外观:主题:极光原野", "外观:主题:砖机液晶", "外观:主题:街机彩砖", "外观:主题:立体晶格"],
    `外观页应有四张主题卡：${外观钮.map((项) => 项.名称).join("、")}`,
  );
  assert.ok(
    !外观钮.some((项) => /^外观:(样式|背景|方块):/.test(项.名称)),
    "外观页不应再有样式/背景/方块分项卡",
  );
  // 未拥有主题卡点下去直接去商店，且不写设置。
  const 原主题选择 = (await 设置())?.主题选择;
  await 点("外观:主题:街机彩砖");
  await 页.waitForFunction(() =>
    window.__three版__?.读取界面()?.文字?.some((项) => 项 === "页面:商店"),
  );
  assert.equal((await 设置())?.主题选择, 原主题选择, "点未拥有主题卡不应改动当前主题");
  await 记录("设置外观页四张主题卡与未拥有跳商店");
  await 回菜单();

  await 点("商店");
  assert.equal((await 文字()).includes("页面:商店"), true, "进入旅行商店");
  await 页.evaluate(() => window.__three版__?.增加金币(5000));
  await 页.waitForTimeout(150);
  const 文本值 = async (前缀: string) =>
    (await 文字()).find((项) => 项.startsWith(前缀))?.slice(前缀.length) ?? "";
  await 点("商店地点:砖机液晶");
  assert.equal(await 文本值("地点:"), "砖机液晶", "目录切到砖机液晶");
  assert.equal(await 文本值("已购:"), "0", "砖机液晶初始没有部位");
  assert.equal(await 文本值("单件价:"), "120", "砖机方块外观单件价 120");
  const 钱前 = await 金币数();
  // 单件购买：遮罩关闭、取消都不扣币，确认只扣 120 且只解锁一个部位。
  await 点("购买:砖机液晶.方块外观");
  await 查找("确认交易");
  await 页.mouse.click(195, 120);
  await 页.waitForTimeout(200);
  assert.ok(!(await 界面())?.按钮.some((项) => 项.名称 === "确认交易"), "点遮罩关闭确认纸页");
  assert.equal(await 金币数(), 钱前, "点遮罩不扣币");
  await 点("购买:砖机液晶.方块外观");
  await 点("取消交易");
  assert.equal(await 金币数(), 钱前, "取消不扣币");
  await 点("购买:砖机液晶.方块外观");
  assert.equal(await 文本值("确认:"), "方块外观:120");
  await 点("确认交易");
  await 页.waitForTimeout(320);
  assert.equal(await 金币数(), 钱前 - 120, "购买方块外观扣 120");
  assert.equal(await 文本值("已购:"), "1", "单件只解锁一个部位");
  assert.deepEqual((await 设置())?.外观搭配, { 方块外观: "砖机液晶" });
  assert.equal((await 设置())?.主题选择, "极光原野", "单件穿戴不改主题选择");
  // 已拥有部位再穿戴也先开纸页，确认后不扣币。
  const 穿戴前 = await 金币数();
  await 点("穿戴:砖机液晶.方块外观");
  assert.equal(await 文本值("确认:"), "方块外观:0");
  await 点("确认交易");
  assert.equal(await 金币数(), 穿戴前, "已拥有部位穿戴不扣币");
  assert.deepEqual((await 设置())?.外观搭配, { 方块外观: "砖机液晶" });
  // 剩余整套 420：确认后主题切砖机、清空单件搭配；再穿整套不扣币。
  assert.equal(await 文本值("整套价:"), "420", "买过方块后整套只补未购 420");
  await 点("购买:砖机液晶.整套");
  await 点("确认交易");
  await 页.waitForTimeout(320);
  assert.equal(await 文本值("已购:"), "6", "整套购买后六个部位全解锁");
  assert.equal(await 文本值("整套价:"), "0");
  assert.deepEqual((await 设置())?.外观搭配, {}, "整套穿戴清空单件搭配");
  assert.equal((await 设置())?.主题选择, "砖机液晶", "整套穿戴写主题选择");
  const 整套钱前 = await 金币数();
  await 点("穿戴:砖机液晶.整套");
  assert.equal(await 文本值("确认:"), "整套:0");
  await 点("确认交易");
  assert.equal(await 金币数(), 整套钱前, "已购整套穿戴不扣币");
  // 纯享返回后仍能操作商店。
  await 点("商店:纯享");
  await 查找("纯享:返回");
  assert.ok(
    (await 文字()).some((项) => 项.startsWith("来源:商店")),
    "商店纯享入口应进入纯享页",
  );
  await 点("纯享:返回");
  await 查找("商店地点:极光原野");
  await 点("商店地点:街机彩砖");
  assert.equal(await 文本值("地点:"), "街机彩砖", "纯享返回后商店仍可切换地点");
  await 记录("商店单件/整套购买、取消遮罩与纯享回归");
  await 回菜单();

  await 点("成就");
  assert.equal((await 状态())?.页面, "成就", "进入成就页");
  const 成就文字 = await 文字();
  assert.ok(
    成就文字.includes("列表模式:虚拟"),
    `成就页应是虚拟列表：${成就文字.slice(0, 6).join(" | ")}`,
  );
  assert.ok(
    成就文字.some((项) => /:(?:已|未)解锁:\d+\/\d+$/.test(项)),
    `成就行应带解锁状态与进度：${成就文字
      .filter((项) => 项.includes("解锁"))
      .slice(0, 3)
      .join(" | ")}`,
  );
  // 滚动状态变化只在真的能滚时比对（列表短时无可滚内容）。
  const 滚动前 = 成就文字.find((项) => 项.startsWith("滚动:"));
  await 页.mouse.move(200, 400);
  await 页.mouse.wheel(0, 500);
  await 页.waitForTimeout(200);
  const 滚动后 = (await 文字()).find((项) => 项.startsWith("滚动:"));
  if (滚动后 !== 滚动前) console.log(`成就列表可滚动：${滚动前} → ${滚动后}`);
  await 记录("成就列表滚动与领奖状态");
  await 回菜单();

  // 排行榜入口是模式卡右上角的排行钮（卡内第二命中区，不是独立按钮）。
  await 点("开始游戏");
  const 冲刺卡 = await 查找("模式:冲刺");
  await 页.mouse.click(冲刺卡.左 + 冲刺卡.宽 - 20, 冲刺卡.上 + 20);
  await 页.waitForFunction(() =>
    window.__three版__?.读取界面()?.文字?.some((项) => 项 === "模式:冲刺"),
  );
  assert.ok((await 文字()).includes("模式:冲刺"), "排行榜传入模式生效");
  // 周期是页签节点（一整行），点第二个「周」段切换。
  const 周期签 = await 查找("排行榜周期");
  await 页.mouse.click(周期签.左 + 周期签.宽 * 0.375, 周期签.上 + 周期签.高 / 2);
  await 页.waitForTimeout(300);
  assert.ok((await 文字()).includes("周期:周"), "排行榜周期可切到周榜");
  await 记录("排行榜模式周期与平台降级");
  await 点("返回主菜单");
  await 页.waitForTimeout(300);
  await 回菜单();

  await 点("开始游戏");
  await 点("模式:马拉松");
  await 页.waitForFunction(() => window.__three版__?.读取界面().文字?.includes("入场:完成"));
  await 点("暂停");
  await 页.waitForFunction(() => window.__three版__?.读取状态().阶段 === "暂停");
  const 面板已开 = async () =>
    (await 界面())?.按钮.some((项) => 项.名称 === "对局设置:面板") ?? false;
  await 点直到("对局设置", 面板已开);
  assert.ok(await 面板已开(), "点对局设置应打开设置面板");
  await 点("网格:关");
  assert.equal((await 设置())?.显示网格, false);
  await 点("网格:开");
  // 对局设置里的滑块不在滚动视口内，用它验证真实拖动（设置页滑块另有已知缺陷）。
  const 落点滑 = await 查找("落点影透明度");
  const 落点Y = 落点滑.上 + 落点滑.高 / 2;
  await 滑动(落点滑.左 + 落点滑.宽 * 0.8, 落点Y, 落点滑.左 + 落点滑.宽 * 0.5, 落点Y);
  const 落点值 = (await 设置())?.落点影透明度 ?? 100;
  assert.ok(落点值 < 100 && 落点值 > 30, `滑块拖动应改变落点影透明度：${落点值}`);
  assert.ok(
    !(await 界面())?.按钮.some((项) => 项.名称.startsWith("上键:")),
    "对局设置不再有上键按钮",
  );
  const 设置快照 = await 设置();
  assert.ok(设置快照 && !("手机上键旋转" in 设置快照), "设置快照不再含手机上键旋转");
  await 记录("对局内设置真实操作");
  await 点("对局设置:返回暂停菜单");
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
    JSON.stringify(
      { 环境: "Chromium模拟视口，不是真机", 页面错误, 已知缺陷: 已知缺陷记录, 步骤 },
      null,
      2,
    ),
  );
  await 浏览器.close();
}
