import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { chromium } from "playwright";

/**
 * 素材巡演校验：一局里切完五套主题，方块与分数必须连续。
 *
 * 用法：`bun ./测试/浏览器/素材巡演校验.ts [地址] [--秒数=70] [--主题=冲刺]`
 * 地址默认 http://127.0.0.1:3002（`gm 运行游戏 --端口=3002`）。
 *
 * 断言（退出码非 0 即失败）：
 * 1. 五套主题按顺序各出现一次，切换过程中对局不重开；
 * 2. 消行数与分数单调不减（切主题不清盘、不重置）；
 * 3. 一局自然结束（完赛），消行数达到冲刺目标；
 * 4. 全程无页面错误。
 *
 * 产物：`.gamemaker/报告/素材巡演/校验.json`。
 */

const 默认地址 = "http://127.0.0.1:3002";
const 主题顺序 = ["极光原野", "砖机液晶", "街机彩砖", "立体晶格", "糖果超甜"] as const;

const 参数 = process.argv.slice(2);
const 地址 = 参数.find((项) => !项.startsWith("--")) ?? 默认地址;
const 读选项 = (名: string, 兜底: string) =>
  参数.find((项) => 项.startsWith(`--${名}=`))?.slice(名.length + 3) ?? 兜底;
const 秒数 = Number(读选项("秒数", "70"));
const 模式 = 读选项("主题", "冲刺");

interface 采样 {
  毫秒: number;
  主题: string;
  消行数: number;
  分数: number;
  阶段: string;
  结束: boolean;
  完赛: boolean;
}

const 浏览器 = await chromium.launch({ channel: "chrome" });
const 上下文 = await 浏览器.newContext({
  viewport: { width: 1080, height: 1920 },
  deviceScaleFactor: 1,
  isMobile: true,
  hasTouch: true,
});
const 页 = await 上下文.newPage();
const 页面错误: string[] = [];
页.on("pageerror", (错) => 页面错误.push(错.message));

await 页.goto(地址, { waitUntil: "networkidle" });
await 页.waitForFunction(() => Boolean(window.__再消一行测试__), undefined, { timeout: 20000 });
await 页.waitForTimeout(600);
await 页.evaluate((参数) => window.__再消一行测试__?.开始素材演示(参数), {
  模式,
  皮肤: "全主题巡演",
  目标: "成功" as const,
  秒数,
  宽: 1080,
  高: 1920,
});

const 采样: 采样[] = [];
const 起点 = Date.now();
let 结束 = false;
while (Date.now() - 起点 < (秒数 + 25) * 1000) {
  const 一帧 = await 页.evaluate(() => ({
    主题: window.__three版__?.读取设置?.()?.主题选择 ?? "",
    状态: window.__three版__?.读取状态?.() ?? null,
    演示: window.__再消一行测试__?.读取素材演示?.() ?? null,
  }));
  const 状态 = 一帧.状态 as { 消行数?: number; 分数?: number; 阶段?: string } | null;
  采样.push({
    毫秒: Date.now() - 起点,
    主题: 一帧.主题,
    消行数: Number(状态?.消行数 ?? 0),
    分数: Number(状态?.分数 ?? 0),
    阶段: String(状态?.阶段 ?? ""),
    结束: 一帧.演示?.结束 === true,
    完赛: 一帧.演示?.完赛 === true,
  });
  if (一帧.演示?.结束 === true) {
    结束 = true;
    break;
  }
  await 页.waitForTimeout(300);
}
await 页.waitForTimeout(600);
await 页.screenshot({ path: join(process.cwd(), ".gamemaker/报告/素材巡演/结算画面.png") });
await 上下文.close();
await 浏览器.close();

const 出现主题 = [...new Set(采样.map((项) => 项.主题))].filter(Boolean);
const 主题齐全 = 主题顺序.every((名) => 出现主题.includes(名));
const 顺序正确 =
  出现主题.length === 主题顺序.length && 出现主题.every((名, 序) => 名 === 主题顺序[序]);
const 消行单调 = 采样.every((项, 序) => 序 === 0 || 项.消行数 >= (采样[序 - 1]?.消行数 ?? 0));
const 分数单调 = 采样.every((项, 序) => 序 === 0 || 项.分数 >= (采样[序 - 1]?.分数 ?? 0));
const 末帧 = 采样.at(-1);
const 结果 = {
  地址,
  模式,
  秒数,
  实际时长秒: Math.round(((末帧?.毫秒 ?? 0) / 1000) * 10) / 10,
  出现主题,
  主题齐全,
  顺序正确,
  消行单调,
  分数单调,
  结束,
  完赛: 末帧?.完赛 === true,
  最终消行数: 末帧?.消行数 ?? 0,
  最终分数: 末帧?.分数 ?? 0,
  页面错误,
  通过:
    主题齐全 &&
    顺序正确 &&
    消行单调 &&
    分数单调 &&
    结束 &&
    末帧?.完赛 === true &&
    页面错误.length === 0,
};
await mkdir(join(process.cwd(), ".gamemaker/报告/素材巡演"), { recursive: true });
await writeFile(
  join(process.cwd(), ".gamemaker/报告/素材巡演/校验.json"),
  JSON.stringify({ ...结果, 采样 }, null, 2),
);
console.log(JSON.stringify(结果, null, 2));
process.exit(结果.通过 ? 0 : 1);
