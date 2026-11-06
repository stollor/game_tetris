import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { chromium, type Page } from "playwright";

/**
 * 商店与设置的主题联动验收。
 *
 * 覆盖三件容易回归、且状态断言容易漏的事：
 * 1. 设置里点「已拥有」主题卡 → 留在设置并切换主题（不是跳商店）；
 * 2. 设置里点「未拥有」主题卡 → 进商店并直接选中该主题；
 * 3. 商店底部目录里选中的 tab 水平居中（首尾主题也要能居中）。
 *
 * 用法：bun 测试/浏览器/商店设置联动验收.ts [地址]
 * 报告写 .gamemaker/报告/商店设置联动验收/。
 */

const 地址 = process.argv.slice(2).find((项) => !项.startsWith("--")) ?? "http://127.0.0.1:3000";
const 输出 = resolve(".gamemaker/报告/商店设置联动验收");
await mkdir(输出, { recursive: true });

const 判定: { 项: string; 通过: boolean; 说明: string }[] = [];
const 记录 = (项: string, 通过: boolean, 说明: string) => {
  判定.push({ 项, 通过, 说明 });
  console.log(`${通过 ? "通过" : "失败"}：${项}｜${说明}`);
};

const 浏览器 = await chromium.launch({ channel: "chrome" });
try {
  const 页: Page = await 浏览器.newPage({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
  });
  const 页面错误: string[] = [];
  页.on("pageerror", (错误) => 页面错误.push(错误.message));
  await 页.goto(地址);
  await 页.waitForFunction(() => window.__GAMEMAKER_TEST__ !== undefined, undefined, {
    timeout: 30000,
  });
  await 页.waitForTimeout(1500);

  const 点 = async (名: string) => {
    console.log("点", 名);
    await 页.waitForFunction(
      (n) =>
        Boolean(
          window.__GAMEMAKER_TEST__
            ?.getSnapshot?.()
            ?.interactives.some((项) => 项.name === n && 项.enabled),
        ),
      名,
      { timeout: 20000 },
    );
    const 矩形 = await 页.evaluate((n) => {
      const 界面 = window.__GAMEMAKER_TEST__!.getSnapshot!();
      return 界面.interactives.find((项) => 项.name === n)!.bounds!;
    }, 名);
    await 页.mouse.click(矩形.x + 矩形.width / 2, 矩形.y + 矩形.height / 2);
    await 页.waitForTimeout(500);
  };
  const 框 = async (名: string) =>
    页.evaluate((n) => {
      const 界面 = window.__GAMEMAKER_TEST__!.getSnapshot!();
      return 界面.interactives.find((项) => 项.name === n)?.bounds ?? null;
    }, 名);
  const 状态 = async () =>
    页.evaluate(() => ({
      页面: window.__three版__!.读取状态().页面,
      主题选择: window.__three版__!.读取设置().主题选择,
    }));
  // 设置的外观页签是单个命中节点，按坐标点中段切页。
  const 切外观 = async () => {
    const 页签 = await 框("设置:页签");
    if (!页签) throw new Error("找不到设置页签");
    await 页.mouse.click(页签.x + 页签.width / 2, 页签.y + 页签.height / 2);
    await 页.waitForTimeout(700);
  };
  const 增加金币 = async (数量: number) => {
    await 页.evaluate((数) => window.__three版__!.增加金币(数), 数量);
    await 页.waitForTimeout(300);
  };

  // —— 先用真实购买流程拿下一套主题：金币 → 商店买整套 ——
  await 增加金币(10000);
  await 点("商店");
  await 点("商店地点:砖机液晶");
  // 地点切换后按钮名会变成 穿戴:砖机液晶.整套，等它出现再买。
  await 页.waitForFunction(
    () =>
      Boolean(
        window.__GAMEMAKER_TEST__
          ?.getSnapshot?.()
          ?.interactives.some(
            (项) =>
              (项.name === "购买:砖机液晶.整套" || 项.name === "穿戴:砖机液晶.整套") && 项.enabled,
          ),
      ),
    undefined,
    { timeout: 10000 },
  );
  await 点("购买:砖机液晶.整套");
  await 页.waitForFunction(
    () =>
      Boolean(
        window.__GAMEMAKER_TEST__
          ?.getSnapshot?.()
          ?.interactives.some((项) => 项.name === "确认交易"),
      ),
    undefined,
    { timeout: 10000 },
  );
  await 点("确认交易");
  await 页.waitForFunction(
    () =>
      !window.__GAMEMAKER_TEST__
        ?.getSnapshot?.()
        ?.interactives.some((项) => 项.name === "确认交易"),
    undefined,
    { timeout: 10000 },
  );
  await 点("返回主菜单");
  await 页.waitForTimeout(900);

  // —— 1. 已拥有 → 设置内直接切换 ——
  await 点("设置");
  await 切外观();
  const 购买后 = await 状态();
  await 点("外观:主题:砖机液晶");
  await 页.waitForTimeout(700);
  const 切换后 = await 状态();
  记录(
    "设置里点已拥有主题卡直接切换（不跳商店）",
    切换后.页面 === "设置" && 切换后.主题选择 === "砖机液晶",
    `点击前页面 ${购买后.页面} → 点击后页面 ${切换后.页面}、主题 ${切换后.主题选择}`,
  );
  await 页.screenshot({ path: join(输出, "01-设置-已拥有可直接切换.png") });

  // —— 2. 未拥有 → 进商店并选中该主题 ——
  await 点("外观:主题:糖果超甜");
  await 页.waitForTimeout(1200);
  const 商店页 = await 状态();
  记录("设置里点未拥有主题卡进入商店", 商店页.页面 === "商店", `当前页面 ${商店页.页面}`);
  const 目录 = await 框("商店:目录");
  const 糖果 = await 框("商店地点:糖果超甜");
  const 标题居中 =
    目录 && 糖果 ? Math.abs(糖果.x + 糖果.width / 2 - (目录.x + 目录.width / 2)) : -1;
  记录(
    "商店打开即选中该主题且 tab 居中",
    糖果 !== null && 标题居中 >= 0 && 标题居中 < 6,
    `糖果 tab 中心与目录中心相差 ${标题居中.toFixed(1)}px`,
  );
  await 页.screenshot({ path: join(输出, "02-商店-选中未拥有主题.png") });

  // —— 3. 关闭再打开：显示主题与设置选中一致 ——
  // 从设置跳进来的商店「返回主菜单」会先回设置，再回菜单：最多退两次到菜单。
  for (let 退 = 0; 退 < 3; 退 += 1) {
    if ((await 状态()).页面 === "菜单") break;
    await 点("返回主菜单");
    await 页.waitForTimeout(700);
  }
  await 点("商店");
  await 页.waitForTimeout(1200);
  const 再次打开 = await 状态();
  const 目录2 = await 框("商店:目录");
  const 选中Tab = await 框(`商店地点:${再次打开.主题选择}`);
  const 居中2 =
    目录2 && 选中Tab ? Math.abs(选中Tab.x + 选中Tab.width / 2 - (目录2.x + 目录2.width / 2)) : -1;
  记录(
    "重开商店仍停在当前主题且居中",
    再次打开.页面 === "商店" && 选中Tab !== null && 居中2 >= 0 && 居中2 < 6,
    `主题 ${再次打开.主题选择}，tab 中心偏差 ${居中2.toFixed(1)}px`,
  );
  await 页.screenshot({ path: join(输出, "03-商店-重开保持选中.png") });

  记录("无页面错误", 页面错误.length === 0, 页面错误.slice(0, 3).join("；") || "无");

  const 结果 = { 地址, 判定, 页面错误, 通过: 判定.every((项) => 项.通过) };
  await writeFile(join(输出, "结果.json"), JSON.stringify(结果, null, 2), "utf8");
  console.log(`\n商店设置联动验收${结果.通过 ? "通过" : "失败"}：${输出}`);
  process.exitCode = 结果.通过 ? 0 : 1;
} finally {
  await 浏览器.close();
}
