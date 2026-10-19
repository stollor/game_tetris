/** 从真实 Chromium 运行时采集关键界面，并为每张图记录场景、视口和运行版本。 */

import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "playwright";

const 地址 = process.argv[2] ?? "http://localhost:3000";
const 输出目录 = resolve(process.argv[3] ?? "测试/视觉快照");
const 仅对局 = process.argv.includes("--only-gameplay");
await mkdir(输出目录, { recursive: true });

type 快照 = {
  sceneId: string;
  width: number;
  height: number;
  texts: string[];
  interactives: {
    name: string;
    label: string;
    visible: boolean;
    bounds: { x: number; y: number; width: number; height: number } | null;
  }[];
  state?: unknown;
};

const 浏览器 = await chromium.launch({ headless: true });
const 页面 = await 浏览器.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
const 读快照 = () =>
  页面.evaluate(() =>
    (
      window as unknown as { __GAMEMAKER_TEST__?: { getSnapshot: () => 快照 } }
    ).__GAMEMAKER_TEST__?.getSnapshot(),
  );

const 等待场景 = async (sceneId: string) => {
  await 页面.waitForFunction(
    (目标) =>
      (
        window as unknown as { __GAMEMAKER_TEST__?: { getSnapshot: () => 快照 } }
      ).__GAMEMAKER_TEST__?.getSnapshot()?.sceneId === 目标,
    sceneId,
  );
};

const 点击对象 = async (关键字: string) => {
  const 快照 = await 读快照();
  const 项目 = 快照?.interactives.find((对象) => 对象.name === 关键字 && 对象.visible);
  const 画布框 = await 页面.locator("canvas").first().boundingBox();
  if (!项目?.bounds || !画布框 || !快照) throw new Error(`找不到可见交互对象 ${关键字}`);
  await 页面.mouse.click(
    画布框.x + ((项目.bounds.x + 项目.bounds.width / 2) / 快照.width) * 画布框.width,
    画布框.y + ((项目.bounds.y + 项目.bounds.height / 2) / 快照.height) * 画布框.height,
  );
};

const 采集 = async (名称: string, 文件名: string, 场景: string, 应有文案: string) => {
  await 等待场景(场景);
  await 页面.evaluate(
    () =>
      new Promise<void>((resolveFrame) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolveFrame())),
      ),
  );
  const 快照 = await 读快照();
  if (!快照) throw new Error(`采集 ${名称} 时测试桥快照不可用`);
  if (!快照.texts.some((文字) => 文字.includes(应有文案))) {
    throw new Error(`${名称} 场景虽然是 ${场景}，但缺少用于核对命名的文案：${应有文案}`);
  }
  const 文件 = resolve(输出目录, 文件名);
  await 页面.screenshot({ path: 文件 });
  const viewport = 页面.viewportSize();
  const 记录 = {
    名称,
    文件名,
    场景: 快照.sceneId,
    逻辑尺寸: `${快照.width}×${快照.height}`,
    浏览器视口: viewport ? `${viewport.width}×${viewport.height}` : "未知",
    核对文案: 应有文案,
    采集时刻: `${new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai", hour12: false })} Asia/Shanghai`,
    状态: 快照.state,
  };
  return 记录;
};

try {
  await 页面.goto(地址, { waitUntil: "domcontentloaded" });
  await 页面.waitForFunction(() =>
    Boolean((window as unknown as { __GAMEMAKER_TEST__?: unknown }).__GAMEMAKER_TEST__),
  );

  const 采集结果: Awaited<ReturnType<typeof 采集>>[] = [];
  if (!仅对局) 采集结果.push(await 采集("A-首页", "A-首页.png", "开始菜单", "开始游戏"));

  await 点击对象("menu.settings");
  if (!仅对局) 采集结果.push(await 采集("E-设置", "E-设置.png", "设置界面", "设置"));
  await 点击对象("settings.done");
  await 等待场景("开始菜单");

  await 点击对象("menu.start");
  if (!仅对局)
    采集结果.push(await 采集("B-模式选择", "B-模式选择.png", "开始菜单", "选择游戏模式"));
  await 点击对象("mode.马拉松");
  采集结果.push(await 采集("C-桌面对局", "C-对局.png", "再消一行对局", "最佳纪录"));

  if (!仅对局) {
    await 页面.keyboard.press("p");
    采集结果.push(await 采集("F-暂停", "F-暂停.png", "再消一行对局", "继续"));
    await 页面.keyboard.press("p");
  }
  await 页面.setViewportSize({ width: 430, height: 860 });
  采集结果.push(await 采集("D-手机竖屏对局", "D-对局竖屏.png", "再消一行对局", "最佳纪录"));

  const 头部 = execFileSync("git", ["rev-parse", "--short", "HEAD"], { encoding: "utf8" }).trim();
  const 包 = JSON.parse(await Bun.file(resolve("package.json")).text()) as {
    version: string;
    devDependencies: Record<string, string>;
  };
  const Playwright版本 = 包.devDependencies.playwright;
  const 时间 = new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai", hour12: false });
  const 旧元数据路径 = resolve(输出目录, "视觉快照.json");
  const 旧元数据存在 = 仅对局 && (await Bun.file(旧元数据路径).exists());
  const 旧元数据 = 旧元数据存在
    ? (JSON.parse(await Bun.file(旧元数据路径).text()) as {
        采集时间: string;
        快照: typeof 采集结果;
      })
    : undefined;
  const 保留快照时间 = 旧元数据
    ? [
        ...new Set(
          旧元数据.快照
            .filter((项) =>
              ["A-首页.png", "B-模式选择.png", "E-设置.png", "F-暂停.png"].includes(项.文件名),
            )
            .map((项) => 项.采集时刻)
            .filter(Boolean),
        ),
      ].join("、")
    : "上次记录";
  const 文件快照 = 旧元数据
    ? [
        ...旧元数据.快照.filter((旧) => !采集结果.some((新) => 新.文件名 === 旧.文件名)),
        ...采集结果,
      ]
    : 采集结果;
  const 顺序 = [
    "A-首页.png",
    "B-模式选择.png",
    "C-对局.png",
    "D-对局竖屏.png",
    "E-设置.png",
    "F-暂停.png",
  ];
  文件快照.sort((a, b) => 顺序.indexOf(a.文件名) - 顺序.indexOf(b.文件名));
  for (const 项 of 文件快照) {
    if (!项.采集时刻) 项.采集时刻 = 旧元数据?.采集时间 ?? 时间;
  }
  const 元数据 = {
    采集时间: `${时间} Asia/Shanghai`,
    地址,
    应用版本: 包.version,
    Git提交: 头部,
    工作区有未提交改动:
      execFileSync("git", ["status", "--short"], { encoding: "utf8" }).trim().length > 0,
    浏览器: `Chromium ${浏览器.version()} / Playwright ${Playwright版本}`,
    无头模式: true,
    deviceScaleFactor: 1,
    快照: 文件快照,
    本次更新: 仅对局 ? ["C-对局.png", "D-对局竖屏.png"] : 顺序,
    未覆盖范围: [
      "本轮只采集首页、模式选择、设置、马拉松对局与暂停界面。",
      "未采集冲刺、极限、每日挑战、结算面板、英文界面或真实移动设备。",
      "截图只核对可见布局，不替代规则交互和完整浏览器回归。",
    ],
  };
  await writeFile(
    resolve(输出目录, "视觉快照.json"),
    `${JSON.stringify(元数据, null, 2)}\n`,
    "utf8",
  );

  const 行 = 文件快照.map(
    (项) =>
      `| ${项.名称} | ${项.场景} | ${项.浏览器视口} | ${项.采集时刻} | [${项.文件名}](./${项.文件名}) |`,
  );
  const 报告 = [
    "# 当前版本视觉快照",
    "",
    `采集时间：${元数据.采集时间}。运行版本：${元数据.应用版本}（Git ${头部}，采集时工作区有未提交改动）。浏览器：Chromium ${浏览器.version()}，Playwright，无头模式，deviceScaleFactor=1。`,
    "",
    "| 快照 | 实际场景 | 浏览器视口 | 采集时间 | 文件 |",
    "|---|---|---:|---|---|",
    ...行,
    "",
    "## 核对结果",
    "",
    "各图片已按场景 ID 和可见文案核对。手机截图为 Chromium 模拟视口；布局与可读性请查看本次截图，交互结果由独立浏览器验收确认。",
    仅对局 ? `本次仅重采对局，其他图片保留 ${保留快照时间} 的记录。` : "本次重新采集全部六张界面。",
    "",
    "## 未覆盖范围",
    "",
    ...元数据.未覆盖范围.map((项) => `- ${项}`),
    "",
  ].join("\n");
  await writeFile(resolve(输出目录, "视觉快照报告.md"), 报告, "utf8");
  console.log(JSON.stringify(元数据, null, 2));
} finally {
  await 浏览器.close();
}
