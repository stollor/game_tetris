import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { chromium, type Page } from "playwright";

/**
 * 界面层级验收：用节点绘制带核对「浮层压在内容之上、遮罩压在内容之下」。
 *
 * 背景：1.2.0 的节点自动分带把弹窗遮罩分到交互带(2)，而内容文字在主体带(1)，
 * 设置界面出现「文字被黑罩压暗」；商店确认纸页与部位卡文字同带不同纹理，
 * 合批按纹理排序又把文字翻到纸页上方。状态级验收全过，肉眼看才发现。
 *
 * 判定：商店确认层的最低带必须高于所有部位卡/部位名称节点；
 * 设置遮罩带必须低于内容节点，且内容里的标签带不高于遮罩（避免再次反过来）。
 *
 * 用法：bun 测试/浏览器/界面层级验收.ts [地址]
 * 报告写 .gamemaker/报告/界面层级验收/（含两个界面截图）。
 */

const 地址 = process.argv.slice(2).find((项) => !项.startsWith("--")) ?? "http://127.0.0.1:3000";
const 输出 = resolve(".gamemaker/报告/界面层级验收");
await mkdir(输出, { recursive: true });

type 节点带 = { 名称: string; 带: number; 可见: boolean };
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
  const 节点带 = (): Promise<节点带[]> =>
    页.evaluate(() =>
      (
        window as unknown as { __再消一行测试__: { 读取节点带(): 节点带[] } }
      ).__再消一行测试__.读取节点带(),
    );

  // —— 设置界面：遮罩必须比内容更底 ——
  await 点("设置");
  await 页.waitForTimeout(900);
  await 页.screenshot({ path: join(输出, "01-设置界面.png") });
  const 设置节点 = await 节点带();
  const 遮罩 = 设置节点.find((项) => 项.名称 === "设置:遮罩");
  const 内容 = 设置节点.find((项) => 项.名称 === "设置:内容");
  const 遮罩带 = 遮罩?.带 ?? -1;
  const 内容带 = 内容?.带 ?? -1;
  记录(
    "设置遮罩在内容之下（不再压暗标签）",
    遮罩带 >= 0 && 内容带 > 遮罩带,
    `遮罩带 ${遮罩带} < 内容带 ${内容带}`,
  );

  // —— 商店确认层：必须在所有部位卡之上 ——
  await 点("返回主菜单");
  await 页.waitForTimeout(900);
  await 点("商店");
  await 页.waitForTimeout(1200);
  await 点("商店部位:静态背景");
  const 按钮 = (
    await 页.evaluate(() => window.__GAMEMAKER_TEST__!.getSnapshot!())
  ).interactives.map((项: { name: string }) => 项.name) as string[];
  const 穿戴 = 按钮.find((名称) => 名称.startsWith("穿戴:") && !名称.includes("整套"));
  if (穿戴) await 点(穿戴);
  await 页.waitForTimeout(900);
  await 页.screenshot({ path: join(输出, "02-商店购买确认.png") });
  const 商店节点 = await 节点带();
  const 确认节点 = 商店节点.filter((项) =>
    ["交易遮罩", "交易面板", "确认交易", "取消交易", "关闭交易"].includes(项.名称),
  );
  const 部位节点 = 商店节点.filter((项) => 项.名称.startsWith("商店部位"));
  const 确认最低带 = Math.min(...确认节点.map((项) => 项.带));
  const 部位最高带 = Math.max(...部位节点.map((项) => 项.带));
  记录(
    "商店确认层压在部位卡/名称之上",
    确认节点.length >= 5 && 确认最低带 > 部位最高带,
    `确认最低带 ${确认最低带} > 部位最高带 ${部位最高带}（确认 ${确认节点.length} 个节点、部位 ${部位节点.length} 个节点）`,
  );
  const 确认遮罩们 = 确认节点.filter((项) => 项.名称 === "交易遮罩");
  const 纸页们 = 确认节点.filter((项) => 项.名称 !== "交易遮罩");
  const 确认遮罩带 = Math.min(...确认遮罩们.map((项) => 项.带));
  const 纸页最低带 = Math.min(...纸页们.map((项) => 项.带));
  记录(
    "商店确认纸页压在遮罩之上",
    纸页们.length >= 4 && 纸页最低带 > 确认遮罩带,
    `遮罩带 ${确认遮罩带} < 纸页最低带 ${纸页最低带}`,
  );
  const 名称节点 = 部位节点.filter((项) => 项.名称.startsWith("商店部位名称:"));
  记录(
    "部位名称是卡片自己的文字组件节点",
    名称节点.length > 0,
    `部位名称节点 ${名称节点.length} 个，带 ${[...new Set(名称节点.map((项) => 项.带))].join("/")}`,
  );
  // —— 暂停菜单里的「对局设置」是嵌套浮层：遮罩压暂停按钮，纸页与文字再压遮罩 ——
  await 页.evaluate(() => (window as any).__再消一行测试__.进入素材场景("对局", 390, 844, "极光原野"));
  await 页.waitForTimeout(2000);
  const 对局按钮 = (await 页.evaluate(() => window.__GAMEMAKER_TEST__!.getSnapshot!())).interactives.map(
    (项: { name: string }) => 项.name,
  ) as string[];
  const 暂停键 = 对局按钮.find((名) => 名 === "暂停") ?? 对局按钮.find((名) => 名.includes("暂停"));
  if (暂停键) await 点(暂停键);
  await 页.waitForTimeout(1600);
  const 有暂停 = async () => (await 节点带()).some((项) => 项.名称 === "暂停菜单:面板");
  if (await 有暂停()) {
    await 点("对局设置");
    await 页.waitForTimeout(900);
    await 页.screenshot({ path: join(输出, "03-暂停菜单-对局设置.png") });
    const 节点 = await 节点带();
    const 设置遮罩 = 节点.find((项) => 项.名称 === "关闭对局设置:遮罩");
    const 设置面板 = 节点.find((项) => 项.名称 === "对局设置:面板");
    const 设置文字 = 节点.filter((项) => 项.名称.startsWith("对局设置:文字"));
    const 暂停按钮 = 节点.filter((项) => ["继续", "重新开始", "对局设置", "返回主菜单"].includes(项.名称));
    const 暂停最高带 = Math.max(...暂停按钮.map((项) => 项.带));
    记录(
      "暂停菜单：设置遮罩压在暂停按钮之上",
      (设置遮罩?.带 ?? -1) > 暂停最高带,
      `遮罩带 ${设置遮罩?.带 ?? -1} > 暂停按钮最高带 ${暂停最高带}`,
    );
    记录(
      "暂停菜单：设置面板与文字都在遮罩之上",
      (设置面板?.带 ?? -1) > (设置遮罩?.带 ?? -1) &&
        设置文字.length > 0 &&
        Math.min(...设置文字.map((项) => 项.带)) > (设置遮罩?.带 ?? -1),
      `遮罩 ${设置遮罩?.带 ?? -1} < 面板 ${设置面板?.带 ?? -1}，文字最低带 ${设置文字.length ? Math.min(...设置文字.map((项) => 项.带)) : "-"}`,
    );
  }

  记录("无页面错误", 页面错误.length === 0, 页面错误.slice(0, 3).join("；") || "无");

  const 结果 = { 地址, 判定, 页面错误, 通过: 判定.every((项) => 项.通过) };
  await writeFile(join(输出, "结果.json"), JSON.stringify(结果, null, 2), "utf8");
  console.log(`\n界面层级验收${结果.通过 ? "通过" : "失败"}：${输出}`);
  process.exitCode = 结果.通过 ? 0 : 1;
} finally {
  await 浏览器.close();
}
