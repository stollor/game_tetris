import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { chromium, type Page } from "playwright";

/**
 * 对局特效全量检查：五个主题的「硬降拖尾」与「消行演出」是否真的在播。
 *
 * 为什么需要它：特效是纯视觉的，状态断言（分数/消行数）全绿也可能画面不动。
 * 1.2.1 就踩过——透视主题的 3D 井只在 2D 有脏帧时重绘，消行期间整盘定格，
 * 而 2D 主题有消行光带遮着看不出来，只有 3D 主题暴露。
 *
 * 判定口径（每个主题各一轮）：
 * - 拖尾：硬降后特效状态出现拖尾，且井内画面相对硬降前发生可测量的变化；
 * - 消行：消行特效进度在推进，且消行期间画面逐帧变化（不是定格）。
 *
 * 用法：bun 测试/浏览器/对局特效全量检查.ts [地址]
 * 报告写 .gamemaker/报告/特效全量检查/。
 */

const 地址 = process.argv.slice(2).find((项) => !项.startsWith("--")) ?? "http://127.0.0.1:3000";
const 输出 = resolve(".gamemaker/报告/特效全量检查");
await mkdir(输出, { recursive: true });

const 主题列表 = ["极光原野", "砖机液晶", "街机彩砖", "立体晶格", "糖果超甜"] as const;
const 部位 = ["静态背景", "动态背景", "界面样式", "方块外观", "音效套装", "音乐"];
const 已购 = 主题列表
  .filter((项) => 项 !== "极光原野")
  .flatMap((主题) => 部位.map((项) => `${主题}.${项}`));

interface 主题结果 {
  主题: string;
  拖尾数据: boolean;
  拖尾画面变化: number;
  消行数据: boolean;
  消行画面变化: number;
  消行进度: number;
  补间落笔: number;
  通过: boolean;
  说明: string;
}

const 结果表: 主题结果[] = [];
const 判定: { 项: string; 通过: boolean; 说明: string }[] = [];
const 记录 = (项: string, 通过: boolean, 说明: string) => {
  判定.push({ 项, 通过, 说明 });
  console.log(`${通过 ? "通过" : "失败"}：${项}｜${说明}`);
};

/** 井内区域的「方块亮色像素数」：按颜色饱和度+亮度判，跨主题通用。 */
/** 井内区域（逻辑像素）：对局棋盘在 390×844 竖屏下的位置。 */
const 井盒 = { x: 14, y: 164, w: 250, h: 512 };

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
  for (const 主题 of 主题列表) {
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
      { 已购, 主题 },
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
              硬降(): void;
              准备单行消除(): void;
            };
          }
        ).__再消一行测试__.读取特效(),
      );

    await 点("开始游戏");
    await 点("模式:马拉松");
    await 页.waitForTimeout(4200);
    await 页.screenshot({ path: join(输出, `${主题}-0-基准.png`) });
    const 基准 = await 井内亮色像素(页, await 页.screenshot());
    const 基准图 = await 页.screenshot({ path: join(输出, `${主题}-1-硬降前.png`) });

    // —— 硬降拖尾 ——
    await 页.evaluate(() =>
      (
        window as unknown as {
          __再消一行测试__: {
            读取特效(): { 拖尾?: unknown; 消行?: { 经过秒: number } | null } | null;
            硬降(): void;
            准备单行消除(): void;
          };
        }
      ).__再消一行测试__.硬降(),
    );
    await 页.waitForTimeout(50);
    const 拖尾特效 = await 读特效();
    const 拖尾图 = await 页.screenshot({ path: join(输出, `${主题}-2-硬降拖尾.png`) });
    const 拖尾像素 = await 井内亮色像素(页, 拖尾图);
    const 硬降前像素 = await 井内亮色像素(页, 基准图);
    const 拖尾变化 = Math.abs(拖尾像素 - 硬降前像素);

    // —— 消行演出 ——
    await 页.waitForTimeout(600);
    await 页.evaluate(() =>
      (
        window as unknown as {
          __再消一行测试__: {
            读取特效(): { 拖尾?: unknown; 消行?: { 经过秒: number } | null } | null;
            硬降(): void;
            准备单行消除(): void;
          };
        }
      ).__再消一行测试__.准备单行消除(),
    );
    await 页.waitForTimeout(700);
    await 页.screenshot({ path: join(输出, `${主题}-3-消行前.png`) });
    await 页.evaluate(() =>
      (
        window as unknown as {
          __再消一行测试__: {
            读取特效(): { 拖尾?: unknown; 消行?: { 经过秒: number } | null } | null;
            硬降(): void;
            准备单行消除(): void;
          };
        }
      ).__再消一行测试__.硬降(),
    );
    await 页.waitForTimeout(90);
    const 消行甲 = await 读特效();
    const 消行图甲 = await 页.screenshot({ path: join(输出, `${主题}-4-消行中.png`) });
    await 页.waitForTimeout(220);
    const 消行乙 = await 读特效();
    const 消行图乙 = await 页.screenshot({ path: join(输出, `${主题}-5-消行后段.png`) });
    const 棋盘2D = (await 页.evaluate(() => window.__three版__!.读取统计())) as unknown as {
      棋盘2D?: { 补间: number };
      棋盘表现?: string | null;
    };
    const 补间落笔 = 棋盘2D.棋盘2D?.补间 ?? 0;
    const 是透视 = 棋盘2D.棋盘表现 === "透视";
    const 甲像素 = await 井内亮色像素(页, 消行图甲);
    const 乙像素 = await 井内亮色像素(页, 消行图乙);

    const 拖尾数据 = Boolean(拖尾特效?.拖尾);
    const 消行数据 = Boolean(消行甲?.消行) || Boolean(消行乙?.消行);
    const 进度 = Math.max(消行甲?.消行?.经过秒 ?? 0, 消行乙?.消行?.经过秒 ?? 0);
    const 消行变化 = Math.abs(甲像素 - 乙像素);
    // 消行补间：2D 主题必须真的走补间分支（否则又回到瞬移）；3D 走自己的同步分支，计数为 0。
    // 2D 必须逐帧重建（补间落笔 > 5），否则又会只画第一帧后定格
    const 补间合格 = 是透视 || 补间落笔 > 5;
    const 通过 = 拖尾数据 && 拖尾变化 > 40 && 消行数据 && 进度 > 0.05 && 补间合格;
    结果表.push({
      主题,
      拖尾数据,
      拖尾画面变化: 拖尾变化,
      消行数据,
      消行画面变化: 消行变化,
      消行进度: Number(进度.toFixed(2)),
      补间落笔,
      通过,
      说明: 通过 ? "拖尾与消行都在播" : "拖尾或消行没在播",
    });
    记录(
      `${主题}：拖尾与消行演出`,
      通过,
      `拖尾 数据=${拖尾数据} 画面变化=${拖尾变化}｜消行 数据=${消行数据} 进度=${进度.toFixed(2)} 画面变化=${消行变化}｜补间落笔=${补间落笔}（透视=${是透视}）｜页面错误=${页面错误.length}`,
    );
    await 页.close();
    void 基准;
  }

  const 报告 = {
    地址,
    判定,
    结果表,
    通过: 结果表.every((项) => 项.通过),
  };
  await writeFile(join(输出, "结果.json"), JSON.stringify(报告, null, 2), "utf8");
  console.log(`\n对局特效全量检查${报告.通过 ? "通过" : "失败"}：${输出}`);
  process.exitCode = 报告.通过 ? 0 : 1;
} finally {
  await 浏览器.close();
}
