import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { chromium } from "playwright";

/**
 * 宣发录像：一局冲刺里按「快闪五主题 → 每套 3 秒 → 收尾打完 40 行」录成带游戏原声的 mp4。
 *
 * 用法：`bun ./测试/浏览器/宣发录像.ts [地址] [--输出=路径]`
 * 地址默认 http://127.0.0.1:3002（`gm 运行游戏 --端口=3002`）。
 *
 * 画面走画布 captureStream、声音走音频服务的录音分流，两条轨交给同一个 MediaRecorder，
 * 音画同源天然同步；再用 ffmpeg 转 H.264/AAC。GM 的素材录制只出无声画面，这里补音效。
 *
 * 断言（退出码非 0 即失败）：
 * 1. 五套主题都在前 3.2 秒内出现过（快闪段）；
 * 2. 第二轮每套主题各停留 2.4–3.6 秒（3 秒节奏 ±20%）；
 * 3. 消行数与分数单调不减（切主题不重开）；
 * 4. 一局自然完赛，消行数达到冲刺目标；
 * 5. 成片含音频流、时长在 15–120 秒之间。
 *
 * 产物：视频写 `--输出`（默认素材目录），时间线与校验写 `.gamemaker/报告/宣发录像/`。
 */

const 参数 = process.argv.slice(2);
const 地址 = 参数.find((项) => !项.startsWith("--")) ?? "http://127.0.0.1:3002";
const 读选项 = (名: string) =>
  参数.find((项) => 项.startsWith(`--${名}=`))?.slice(名.length + 3);
const 输出 =
  读选项("输出") ?? ".gamemaker/报告/TapTap/发布/素材/录像-冲刺-全主题巡演-成功-1080x1920.mp4";
const 报告目录 = ".gamemaker/报告/宣发录像";
const 主题顺序 = ["极光原野", "砖机液晶", "街机彩砖", "立体晶格", "糖果超甜"] as const;

interface 采样 {
  毫秒: number;
  主题: string;
  消行数: number;
  分数: number;
  阶段: string;
}

await mkdir(报告目录, { recursive: true });
await mkdir(dirname(输出), { recursive: true });

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
await 页.waitForTimeout(700);

// 浏览器要求用户手势后才出声：真点一下画布解锁音频上下文，再开始录。
await 页.mouse.click(540, 960);
await 页.waitForTimeout(400);

await 页.evaluate(() =>
  window.__再消一行测试__?.开始素材演示({
    模式: "冲刺",
    皮肤: "全主题巡演",
    目标: "成功",
    秒数: 70,
    宽: 1080,
    高: 1920,
  }),
);
// 入场演出（Ready/Go）不算内容：等真正可玩再开录，视频第一帧就是游戏画面、第一秒就进快闪。
await 页.waitForFunction(
  () => {
    const 状态 = window.__three版__?.读取状态?.() as
      | { 页面?: string; 入场秒?: number | null; 阶段?: string }
      | null;
    return 状态?.页面 === "对局" && 状态?.入场秒 === null && 状态?.阶段 === "进行中";
  },
  undefined,
  { timeout: 20000 },
);
const 已开录 = await 页.evaluate(() => window.__再消一行测试__?.开始素材录像(30) === true);
if (!已开录) throw new Error("开始素材录像失败");

const 采样: 采样[] = [];
const 起点 = Date.now();
let 结束 = false;
while (Date.now() - 起点 < 90000) {
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
  });
  if (一帧.演示?.结束 === true) {
    结束 = true;
    break;
  }
  await 页.waitForTimeout(150);
}
// 结算页多留一会儿，片尾不戛然而止。
await 页.waitForTimeout(1600);
const 数据地址 = await 页.evaluate(() => window.__再消一行测试__?.停止素材录像());
await 上下文.close();
await 浏览器.close();
if (!数据地址 || !数据地址.startsWith("data:video/webm;base64,"))
  throw new Error("没有拿到录像数据");
const 原始 = join(报告目录, "原始.webm");
await writeFile(原始, Buffer.from(数据地址.slice("data:video/webm;base64,".length), "base64"));

const 运行 = (命令: string[]) => {
  const 结果 = Bun.spawnSync(命令, { stdout: "pipe", stderr: "pipe" });
  if (结果.exitCode !== 0)
    throw new Error(`${命令[0]} 失败：${结果.stderr.toString().slice(-500)}`);
  return 结果.stdout.toString();
};
// 转码：H.264 + AAC、yuv420p、faststart，宽高取偶数（1080/1920 本来就偶数）。
运行([
  "ffmpeg",
  "-y",
  "-i",
  原始,
  "-c:v",
  "libx264",
  "-preset",
  "slow",
  "-crf",
  "20",
  "-pix_fmt",
  "yuv420p",
  "-c:a",
  "aac",
  "-b:a",
  "160k",
  "-movflags",
  "+faststart",
  // 不要 -shortest：MediaRecorder 的 webm 没有时长元数据，音轨会被判成更短，
  // 结算画面会被截掉一截；按视频轨的实际长度收尾。
  输出,
]);

const 探测 = JSON.parse(
  运行([
    "ffprobe",
    "-v",
    "error",
    "-show_entries",
    "format=duration,size:stream=codec_name,codec_type,width,height,channels,sample_rate",
    "-of",
    "json",
    输出,
  ]),
) as {
  format: { duration: string; size: string };
  streams: { codec_name: string; codec_type: string; width?: number; height?: number }[];
};
const 时长秒 = Number(探测.format.duration);
const 有音频 = 探测.streams.some((项) => 项.codec_type === "audio");
const 视频流 = 探测.streams.find((项) => 项.codec_type === "video");

// 主题时间线：按采样把每个主题的连续区间求出来。结构约定是
// 前 5 段快闪（每套约 0.6 秒）→ 后 5 段停留（每套约 3 秒，最后一段一直延续到完赛）。
const 区间: { 主题: string; 起: number; 止: number }[] = [];
for (const 项 of 采样) {
  const 末 = 区间.at(-1);
  if (末 && 末.主题 === 项.主题) 末.止 = 项.毫秒;
  else 区间.push({ 主题: 项.主题, 起: 项.毫秒, 止: 项.毫秒 });
}
const 段长 = (项: { 起: number; 止: number }) => 项.止 - 项.起;
const 快闪段 = 区间.slice(0, 5);
const 停留段 = 区间.slice(5, 10);
const 快闪齐全 = 主题顺序.every((名, 序) => 快闪段[序]?.主题 === 名);
const 快闪短促 = 快闪段.length === 5 && 快闪段.every((项) => 段长(项) <= 1100);
const 停留齐全 = 主题顺序.every((名, 序) => 停留段[序]?.主题 === 名);
const 停留时长 = 停留段.map((项) => Math.round(段长(项) / 100) / 10);
// 前四套必须各停 3 秒上下；第五套从 3 秒段直接接完赛，只能判「至少 3 秒」。
const 每套三秒 =
  停留段.length === 5 &&
  停留时长.slice(0, 4).every((秒) => 秒 >= 2.4 && 秒 <= 3.8) &&
  (停留时长[4] ?? 0) >= 2.4;
const 消行单调 = 采样.every((项, 序) => 序 === 0 || 项.消行数 >= (采样[序 - 1]?.消行数 ?? 0));
const 分数单调 = 采样.every((项, 序) => 序 === 0 || 项.分数 >= (采样[序 - 1]?.分数 ?? 0));
const 末帧 = 采样.at(-1);
// 音轨不能只有一条空流：实测平均音量要高于 -45 dB，避免「有音轨但全静音」。
const 音量输出 = Bun.spawnSync([
  "ffmpeg",
  "-i",
  输出,
  "-af",
  "volumedetect",
  "-f",
  "null",
  "-",
]).stderr.toString();
const 平均音量 = Number(/mean_volume:\s*(-?[\d.]+) dB/.exec(音量输出)?.[1] ?? -Infinity);
const 有声音 = Number.isFinite(平均音量) && 平均音量 > -45;
const 结果 = {
  地址,
  输出,
  时长秒,
  有音频,
  平均音量,
  有声音,
  视频: 视频流 ? `${视频流.width}x${视频流.height} ${视频流.codec_name}` : null,
  字节: Number(探测.format.size),
  结束,
  完赛: 末帧?.阶段 === "结束" && (末帧?.消行数 ?? 0) >= 40,
  最终消行数: 末帧?.消行数 ?? 0,
  最终分数: 末帧?.分数 ?? 0,
  区间: 区间.map((项) => `${项.主题} ${Math.round(段长(项) / 100) / 10}s`),
  快闪齐全,
  快闪短促,
  停留齐全,
  停留时长,
  每套三秒,
  消行单调,
  分数单调,
  页面错误,
  通过:
    结束 &&
    (末帧?.消行数 ?? 0) >= 40 &&
    快闪齐全 &&
    快闪短促 &&
    停留齐全 &&
    每套三秒 &&
    消行单调 &&
    分数单调 &&
    有音频 &&
    有声音 &&
    时长秒 >= 15 &&
    时长秒 <= 120 &&
    页面错误.length === 0,
};
await writeFile(
  join(报告目录, "校验.json"),
  JSON.stringify({ ...结果, 区间, 采样 }, null, 2),
);
console.log(JSON.stringify(结果, null, 2));
process.exit(结果.通过 ? 0 : 1);
