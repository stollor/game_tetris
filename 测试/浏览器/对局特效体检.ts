import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { chromium, type Page } from "playwright";

/**
 * 对局特效体检（诊断，不是统一口径检查）：五个主题各自的表现是否**缺失、不可见或定格**。
 *
 * 每个主题都有自己的特效语言，这里只回答三件事，不评价风格、不要求彼此一致：
 * 1. 硬降拖尾：特效状态有没有、画面上有没有可测量的变化；
 * 2. 消行演出：状态有没有、进度是否在推进、期间连续三帧是否还在变（防「定格」）；
 * 3. 页面有没有报错。
 *
 * 已知各主题的实现分派（改配方时同步更新这张表，便于人读报告）：
 * - 极光原野 / 糖果超甜：矢量 `绘制落块拖尾` + `绘制消行光带`；
 * - 砖机液晶 / 街机彩砖：像素 `绘制像素落块拖尾` + `绘制消行光带`（像素配色）；
 * - 立体晶格：3D 井自绘——落点上方残影 + 被消格收缩、上方行补间下移。
 *
 * 用法：bun 测试/浏览器/对局特效体检.ts [地址]
 * 报告写 .gamemaker/报告/特效体检/。
 */

const 地址 = process.argv.slice(2).find((项) => !项.startsWith("--")) ?? "http://127.0.0.1:3000";
const 输出 = resolve(".gamemaker/报告/特效体检");
await mkdir(输出, { recursive: true });

interface 主题设定 {
  名称: string;
  拖尾语言: string;
  消行语言: string;
}

const 主题列表: 主题设定[] = [
  { 名称: "极光原野", 拖尾语言: "矢量拖尾（宝石色渐隐段）", 消行语言: "消行光带" },
  { 名称: "砖机液晶", 拖尾语言: "像素拖尾（点阵段）", 消行语言: "消行光带（像素配色）" },
  { 名称: "街机彩砖", 拖尾语言: "像素拖尾（点阵段）", 消行语言: "消行光带（像素配色）" },
  { 名称: "立体晶格", 拖尾语言: "3D 落点残影", 消行语言: "3D 收缩 + 上方行补间" },
  { 名称: "糖果超甜", 拖尾语言: "矢量拖尾（糖果色渐隐段）", 消行语言: "消行光带" },
];

const 部位 = ["静态背景", "动态背景", "界面样式", "方块外观", "音效套装", "音乐"];
const 已购 = 主题列表
  .map((项) => 项.名称)
  .filter((项) => 项 !== "极光原野")
  .flatMap((主题) => 部位.map((项) => `${主题}.${项}`));

interface 体检项 {
  主题: string;
  拖尾语言: string;
  消行语言: string;
  拖尾数据: boolean;
  拖尾画面变化: number;
  消行数据: boolean;
  消行进度: number;
  消行帧间变化: number[];
  定格: boolean;
  页面错误: number;
  结论: "正常" | "不足";
  说明: string;
}

const 结果表: 体检项[] = [];
const 井盒 = { x: 14, y: 164, w: 250, h: 512 };

/** 井内「方块亮色像素数」：按饱和度+亮度判，跨主题通用。 */
const 井内亮色像素 = async (页: Page, 图: Buffer): Promise<number> =>
  页.evaluate(
    async (载荷: { 图: string; 盒: { x: number; y: number; w: number; h: number } }) => {
      const { 图, 盒 } = 载荷;
      const 位图 = await createImageBitmap(
        await (await fetch(`data:image/png;base64,${图}`)).blob(),
      );
      const 画布 = new OffscreenCanvas(位图.width, 位图.height);
      const 上下文 = 画布.getContext("2d");
      if (!上下文) return 0;
      上下文.drawImage(位图, 0, 0);
      const 数据 = 上下文.getImageData(盒.x, 盒.y, 盒.w, 盒.h).data;
      let 计 = 0;
      for (let i = 0; i < 数据.length; i += 4) {
        const r = 数据[i] ?? 0;
        const g = 数据[i + 1] ?? 0;
        const b = 数据[i + 2] ?? 0;
        const 最大 = Math.max(r, g, b);
        const 最小 = Math.min(r, g, b);
        if (最大 > 150 && 最大 - 最小 > 60) 计 += 1;
      }
      return 计;
    },
    { 图: 图.toString("base64"), 盒: 井盒 },
  );

const 浏览器 = await chromium.launch({ channel: "chrome" });
try {
  for (const 设定 of 主题列表) {
    const 页 = await 浏览器.newPage({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 1,
    });
    const 页面错误: string[] = [];
    页.on("pageerror", (错误) => 页面错误.push(错误.message));
    await 页.addInitScript(
      (载荷) => {
        localStorage.setItem(
          "再消一行:收藏",
          JSON.stringify({
            版本: 2,
            数据: {
              金币: 9999,
              累计获得: 9999,
              已购: 载荷.已购,
              已结算: [],
              已领成就: [],
              最近首局日期: "",
            },
          }),
        );
        localStorage.setItem("再消一行:设置", JSON.stringify({ 主题选择: 载荷.主题 }));
      },
      { 已购, 主题: 设定.名称 },
    );
    await 页.goto(地址);
    await 页.waitForFunction(() => window.__GAMEMAKER_TEST__ !== undefined, undefined, {
      timeout: 30000,
    });
    await 页.waitForTimeout(1700);

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
    const 读特效 = () =>
      页.evaluate(() =>
        (
          window as unknown as {
            __再消一行测试__: {
              读取特效(): { 拖尾?: unknown; 消行?: { 经过秒: number } | null } | null;
            };
          }
        ).__再消一行测试__.读取特效(),
      );

    await 点("开始游戏");
    await 点("模式:马拉松");
    await 页.waitForTimeout(4200);
    const 基准图 = await 页.screenshot({ path: join(输出, `${设定.名称}-1-基准.png`) });
    const 基准像素 = await 井内亮色像素(页, 基准图);

    // —— 硬降拖尾 ——
    await 页.evaluate(() =>
      (window as unknown as { __再消一行测试__: { 硬降(): void } }).__再消一行测试__.硬降(),
    );
    await 页.waitForTimeout(50);
    const 拖尾特效 = await 读特效();
    const 拖尾图 = await 页.screenshot({ path: join(输出, `${设定.名称}-2-硬降拖尾.png`) });
    const 拖尾像素 = await 井内亮色像素(页, 拖尾图);
    const 拖尾变化 = Math.abs(拖尾像素 - 基准像素);

    // —— 消行演出：抓三帧看是否定格 ——
    await 页.waitForTimeout(600);
    await 页.evaluate(() =>
      (
        window as unknown as { __再消一行测试__: { 准备单行消除(): void } }
      ).__再消一行测试__.准备单行消除(),
    );
    await 页.waitForTimeout(700);
    await 页.evaluate(() =>
      (window as unknown as { __再消一行测试__: { 硬降(): void } }).__再消一行测试__.硬降(),
    );
    await 页.waitForTimeout(70);
    const 消行甲 = await 读特效();
    const 图甲 = await 页.screenshot({ path: join(输出, `${设定.名称}-3-消行帧1.png`) });
    await 页.waitForTimeout(160);
    const 图乙 = await 页.screenshot({ path: join(输出, `${设定.名称}-4-消行帧2.png`) });
    await 页.waitForTimeout(160);
    const 消行丙 = await 读特效();
    const 图丙 = await 页.screenshot({ path: join(输出, `${设定.名称}-5-消行帧3.png`) });

    const 甲像素 = await 井内亮色像素(页, 图甲);
    const 乙像素 = await 井内亮色像素(页, 图乙);
    const 丙像素 = await 井内亮色像素(页, 图丙);
    const 帧间 = [Math.abs(乙像素 - 甲像素), Math.abs(丙像素 - 乙像素)];
    const 消行数据 = Boolean(消行甲?.消行) || Boolean(消行丙?.消行);
    const 进度 = Math.max(消行甲?.消行?.经过秒 ?? 0, 消行丙?.消行?.经过秒 ?? 0);
    // 三帧全一样 = 画面定格（特效在播也看不见）
    const 定格 = 帧间[0] === 0 && 帧间[1] === 0;
    const 拖尾可见 = Boolean(拖尾特效?.拖尾) && 拖尾变化 > 40;
    const 消行可见 = 消行数据 && 进度 > 0.05 && !定格;
    const 结论: 体检项["结论"] = 拖尾可见 && 消行可见 && 页面错误.length === 0 ? "正常" : "不足";
    const 说明 = [
      拖尾可见 ? "拖尾可见" : "拖尾缺失/不可见",
      消行可见 ? "消行演出在播" : 定格 ? "消行画面定格" : "消行缺失",
      页面错误.length ? `页面错误 ${页面错误.length}` : "",
    ]
      .filter(Boolean)
      .join("；");

    结果表.push({
      主题: 设定.名称,
      拖尾语言: 设定.拖尾语言,
      消行语言: 设定.消行语言,
      拖尾数据: Boolean(拖尾特效?.拖尾),
      拖尾画面变化: 拖尾变化,
      消行数据,
      消行进度: Number(进度.toFixed(2)),
      消行帧间变化: 帧间,
      定格,
      页面错误: 页面错误.length,
      结论,
      说明,
    });
    console.log(
      `${结论 === "正常" ? "正常" : "不足"}：${设定.名称}（${设定.拖尾语言}／${设定.消行语言}）｜${说明}｜拖尾变化=${拖尾变化} 消行帧间=${帧间.join("/")}`,
    );
    await 页.close();
  }

  const 有不足 = 结果表.some((项) => 项.结论 === "不足");
  const 报告 = { 地址, 结果表, 全部正常: !有不足 };
  await writeFile(join(输出, "结果.json"), JSON.stringify(报告, null, 2), "utf8");
  console.log(`\n特效体检完成：${有不足 ? "有主题存在不足，见上" : "五个主题表现均正常"}｜${输出}`);
  process.exitCode = 有不足 ? 1 : 0;
} finally {
  await 浏览器.close();
}
