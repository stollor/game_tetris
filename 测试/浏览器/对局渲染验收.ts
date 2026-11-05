import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { chromium } from "playwright";

/**
 * 对局可见性验收：验「画面真的在动」，而不是只验状态在变。
 *
 * 背景：1.2.0 的图层静音曾把对局动态层（下落方块/落点影/按钮态）的重绘吞掉，
 * 状态照常推进、`three版验收` 的按钮/分数断言全过，但屏幕上什么都不动。
 * 这里补两条像素级判定：
 * 1. 进对局后隔 1.2 秒两次截图必须不同（重力/动画在画）；
 * 2. 按键后截图必须再变（输入反馈在画）。
 *
 * 用法：
 *   bun 测试/浏览器/对局渲染验收.ts [地址] [--包体] [--DPR=2]
 *   地址缺省 http://127.0.0.1:3000；--包体 表示地址是剥离测试工具的发布包，
 *   只能按固定坐标点按（没有调试桥），判定只看截图差异。
 * 报告写 .gamemaker/报告/对局渲染验收/。
 */

const 参数 = process.argv.slice(2);
const 是包体 = 参数.includes("--包体");
const 地址 = 参数.find((项) => !项.startsWith("--")) ?? "http://127.0.0.1:3000";
const DPR = Number(参数.find((项) => 项.startsWith("--DPR="))?.split("=")[1] ?? 2);
const 输出 = resolve(".gamemaker/报告/对局渲染验收");
await mkdir(输出, { recursive: true });

const 哈希 = (数据: Buffer) => createHash("sha256").update(数据).digest("hex").slice(0, 16);
const 页面错误: string[] = [];
const 判定: { 项: string; 通过: boolean; 说明: string }[] = [];
const 记录 = (项: string, 通过: boolean, 说明: string) => {
  判定.push({ 项, 通过, 说明 });
  console.log(`${通过 ? "通过" : "失败"}：${项}｜${说明}`);
};

const 浏览器 = await chromium.launch({ channel: "chrome" });
try {
  const 页 = await 浏览器.newPage({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: DPR,
  });
  页.on("pageerror", (错误) => 页面错误.push(错误.message));
  页.on("console", (消息) => {
    const 文本 = 消息.text();
    if (消息.type() === "error" && !文本.includes("127.0.0.1:4175")) 页面错误.push(文本);
  });

  await 页.goto(地址);
  await 页.waitForTimeout(4500);
  if (!是包体)
    await 页.waitForFunction(() => window.__GAMEMAKER_TEST__ !== undefined, undefined, {
      timeout: 30000,
    });

  /** 开发构建按按钮名点；发布包没有调试桥，按已验收过的逻辑坐标点。 */
  const 点 = async (名称: string, x: number, y: number) => {
    if (是包体) {
      await 页.mouse.click(x, y);
      await 页.waitForTimeout(400);
      return;
    }
    await 页.waitForFunction(
      (名) =>
        Boolean(
          window.__GAMEMAKER_TEST__
            ?.getSnapshot?.()
            ?.interactives.some((项) => 项.name === 名 && 项.enabled),
        ),
      名称,
      { timeout: 20000 },
    );
    const 矩形 = await 页.evaluate((名) => {
      const 界面 = window.__GAMEMAKER_TEST__!.getSnapshot!();
      return 界面.interactives.find((项) => 项.name === 名)!.bounds!;
    }, 名称);
    await 页.mouse.click(矩形.x + 矩形.width / 2, 矩形.y + 矩形.height / 2);
    await 页.waitForTimeout(400);
  };

  await 点("开始游戏", 195, 608);
  await 点("模式:马拉松", 195, 274);
  // 过入场：Ready/Go 属于转场层，这里只验正式对局画面。
  await 页.waitForTimeout(3500);

  const 截图 = async (名: string) => {
    const 数据 = await 页.screenshot({ path: join(输出, `${名}.png`) });
    return { 哈希: 哈希(数据), 数据 };
  };

  const 甲 = await 截图("01-对局-静止帧");
  await 页.waitForTimeout(1200);
  const 乙 = await 截图("02-对局-1.2秒后");
  记录(
    "对局画面会变化（重力/动画在画）",
    甲.哈希 !== 乙.哈希,
    `静止帧 ${甲.哈希} → 1.2 秒后 ${乙.哈希}`,
  );

  await 页.keyboard.press("ArrowLeft");
  await 页.waitForTimeout(500);
  const 丙 = await 截图("03-对局-按键后");
  记录("按键有画面反馈", 丙.哈希 !== 乙.哈希, `按键后 ${丙.哈希}`);

  if (!是包体) {
    const 统计 = await 页.evaluate(() => window.__three版__!.读取统计().图层缓存);
    记录(
      "图层内容指纹静音保持关闭",
      统计.静音次数 === 0,
      `静音次数 ${统计.静音次数}（>0 说明可能再次吞掉动态层重绘）`,
    );
    const 累计 = 统计.累计重建层数;
    await 页.waitForTimeout(800);
    const 累计后 = (await 页.evaluate(() => window.__three版__!.读取统计().图层缓存)).累计重建层数;
    记录("对局持续重建脏层", 累计后 > 累计, `累计重建 ${累计} → ${累计后}`);
  }

  // 透视主题（立体晶格）：井内是 3D 房间，2D 棋盘/已落/底板一次都不许画；
  // 1.2.0 的拆带重构正是在这里漏了门控，2D 不透明底板把 3D 盖死，下落方块与落点影不可见。
  if (!是包体) {
    await 页.evaluate(() =>
      (window as any).__再消一行测试__.进入素材场景("对局", 390, 844, "立体晶格"),
    );
    await 页.waitForTimeout(1600);
    await 页.evaluate(() => (window as any).__再消一行测试__.重置棋盘2D计数());
    await 页.waitForTimeout(1200);
    const 统计 = await 页.evaluate(() => window.__three版__!.读取统计());
    const 棋盘2D = (统计 as unknown as { 棋盘2D: { 棋盘: number; 已落: number; 底: number } })
      .棋盘2D;
    const 棋盘表现 = (统计 as unknown as { 棋盘表现: string | null }).棋盘表现;
    记录(
      "透视主题井内交给 3D，2D 不再画棋盘",
      棋盘表现 === "透视" && 棋盘2D.棋盘 === 0 && 棋盘2D.已落 === 0 && 棋盘2D.底 === 0,
      `棋盘表现 ${棋盘表现}；2D 落笔 棋盘 ${棋盘2D.棋盘} / 已落 ${棋盘2D.已落} / 底 ${棋盘2D.底}`,
    );
    const 甲 = await 截图("04-立体晶格-3D");
    await 页.waitForTimeout(1200);
    const 乙 = await 截图("05-立体晶格-1.2秒后");
    记录("立体晶格 3D 画面在动", 甲.哈希 !== 乙.哈希, `${甲.哈希} → ${乙.哈希}`);

    // 回到默认主题，确认 2D 棋盘照常落笔（防止门控写成全局跳过）。
    await 页.evaluate(() =>
      (window as any).__再消一行测试__.进入素材场景("对局", 390, 844, "极光原野"),
    );
    await 页.waitForTimeout(2200);
    await 页.evaluate(() => (window as any).__再消一行测试__.重置棋盘2D计数());
    await 页.waitForTimeout(3500);
    const 平面 = (await 页.evaluate(() => window.__three版__!.读取统计())) as unknown as {
      棋盘2D: { 棋盘: number; 已落: number; 底: number };
      棋盘表现: string | null;
    };
    记录(
      "平面主题仍由 2D 画棋盘",
      平面.棋盘表现 !== "透视" && 平面.棋盘2D.棋盘 > 0,
      `棋盘表现 ${平面.棋盘表现}；2D 落笔 棋盘 ${平面.棋盘2D.棋盘} / 已落 ${平面.棋盘2D.已落} / 底 ${平面.棋盘2D.底}`,
    );
  }

  记录("无页面错误", 页面错误.length === 0, 页面错误.slice(0, 3).join("；") || "无");

  const 结果 = {
    地址,
    包体: 是包体,
    视口: { 宽: 390, 高: 844, 设备像素比: DPR },
    判定,
    页面错误,
    通过: 判定.every((项) => 项.通过),
  };
  await writeFile(join(输出, "结果.json"), JSON.stringify(结果, null, 2), "utf8");
  console.log(`\n对局可见性验收${结果.通过 ? "通过" : "失败"}：${输出}`);
  process.exitCode = 结果.通过 ? 0 : 1;
} finally {
  await 浏览器.close();
}
