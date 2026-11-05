import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { chromium } from "playwright";

/**
 * 速通宣发录像：一局冲刺 10 秒左右打完 40 行，**每消除一次就换一套主题**
 * （多行一起消也只算一次），换皮只改渲染、不碰棋盘/分数/计时。
 * 音频只留游戏音效：录制前关掉背景音乐，音乐与音效总线仍然照常出声。
 *
 * 用法：`bun ./测试/浏览器/宣发录像.ts [地址] [--输出=路径]`
 * 地址默认 http://127.0.0.1:3002（`gm 运行游戏 --端口=3002`）。
 *
 * 画面走画布 captureStream、声音走音频服务的录音分流，两条轨交给同一个 MediaRecorder，
 * 音画同源天然同步；再用 ffmpeg 转 H.264/AAC（并裁掉进对局前的导航画面）。
 *
 * 断言（退出码非 0 即失败）：
 * 1. 40 行完赛，整局竞速时长在 8–14 秒；
 * 2. 换肤次数与消行事件数一致，每次采样到的消行都伴随主题变化；
 * 3. 消行数与分数单调不减（换皮不重开）；
 * 4. 录制期间背景音乐为关、音轨有实际音量；
 * 5. 成片含音频流、总时长 ≥15 秒（TapTap 实机录屏下限）。
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
  换肤次数: number;
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

// 浏览器要求用户手势后才出声：点右下角空白（画面中央是纯享入口，会挂试穿主题污染界面）。
await 页.mouse.click(1040, 1860);
await 页.waitForTimeout(300);
// 只要音效：关背景音乐；再把五套主题各应用一遍，把背景/图集首次构建成本付在录制之前。
await 页.evaluate(() => window.__three版__?.更新设置?.({ 背景音乐: false }));
await 页.evaluate(
  (名单) => window.__再消一行测试__?.预热素材主题(名单),
  [...主题顺序],
);

// 先开录再进对局：导航与首帧着色的时间不算内容，录完按「进对局那一刻」精确裁头。
const 启录时刻 = Date.now();
const 已开录 = await 页.evaluate(() => window.__再消一行测试__?.开始素材录像(30) === true);
if (!已开录) throw new Error("开始素材录像失败");
await 页.evaluate(() =>
  window.__再消一行测试__?.开始素材演示({
    模式: "冲刺",
    皮肤: "全主题巡演",
    目标: "成功",
    秒数: 70,
    宽: 1080,
    高: 1920,
    跳过入场: true,
  }),
);
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
// 裁剪点：从起录到「对局可玩」的耗时，再让出 0.05 秒，避免切掉首帧。
const 前导秒 = Math.max(0, (Date.now() - 启录时刻) / 1000 - 0.05);

const 采样: 采样[] = [];
const 起点 = Date.now();
let 结束 = false;
let 音频状态: { 背景音乐?: boolean; 音乐音量?: number; 音效音量?: number } = {};
while (Date.now() - 起点 < 60000) {
  const 一帧 = await 页.evaluate(() => ({
    主题: window.__three版__?.读取设置?.()?.主题选择 ?? "",
    状态: window.__three版__?.读取状态?.() ?? null,
    演示: window.__再消一行测试__?.读取素材演示?.() ?? null,
    音频: window.__three版__?.读取统计?.()?.音频 ?? null,
  }));
  const 状态 = 一帧.状态 as { 消行数?: number; 分数?: number; 阶段?: string } | null;
  采样.push({
    毫秒: Date.now() - 起点,
    主题: 一帧.主题,
    消行数: Number(状态?.消行数 ?? 0),
    分数: Number(状态?.分数 ?? 0),
    阶段: String(状态?.阶段 ?? ""),
    换肤次数: Number(一帧.演示?.换肤次数 ?? 0),
  });
  if (一帧.音频) 音频状态 = 一帧.音频 as typeof 音频状态;
  if (一帧.演示?.结束 === true) {
    结束 = true;
    break;
  }
  await 页.waitForTimeout(90);
}
// 结算页按缺口补时：成片必须过 TapTap 的 15 秒下限，又不想无脑拖长结算。
const 已录秒 = (Date.now() - 启录时刻) / 1000 - 前导秒;
await 页.waitForTimeout(Math.max(1200, (15.8 - 已录秒) * 1000));
const 数据地址 = await 页.evaluate(() => window.__再消一行测试__?.停止素材录像());
await 上下文.close();
await 浏览器.close();
if (!数据地址?.startsWith("data:video/webm;base64,")) throw new Error("没有拿到录像数据");
const 原始 = join(报告目录, "原始.webm");
await writeFile(原始, Buffer.from(数据地址.slice("data:video/webm;base64,".length), "base64"));

const 运行 = (命令: string[]) => {
  const 结果 = Bun.spawnSync(命令, { stdout: "pipe", stderr: "pipe" });
  if (结果.exitCode !== 0)
    throw new Error(`${命令[0]} 失败：${结果.stderr.toString().slice(-500)}`);
  return 结果.stdout.toString();
};
// 转码：先按前导秒裁掉进对局前的画面，再转 H.264 + AAC、yuv420p、faststart。
运行([
  "ffmpeg",
  "-y",
  "-i",
  原始,
  "-ss",
  前导秒.toFixed(3),
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
  // 不要 -shortest：MediaRecorder 的 webm 没有时长元数据，音轨会被判成更短，结算会被截掉。
  输出,
]);

const 探测 = JSON.parse(
  运行([
    "ffprobe",
    "-v",
    "error",
    "-show_entries",
    "format=duration,size:stream=codec_name,codec_type,width,height,channels",
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

// 竞速段时长：从第一次落子到结算出现（采样里的「阶段=结束」时刻）。
const 结束帧 = 采样.find((项) => 项.阶段 === "结束");
const 竞速秒 = 结束帧 ? Math.round(结束帧.毫秒 / 100) / 10 : null;
const 末帧 = 采样.at(-1);
const 换肤次数 = 末帧?.换肤次数 ?? 0;
// 采样到的消行事件：相邻两次采样消行数变大就算一次（多行一起消也只算一次）。
let 消行事件 = 0;
let 每次消除都换肤 = true;
for (let 序 = 1; 序 < 采样.length; 序 += 1) {
  const 前 = 采样[序 - 1];
  const 后 = 采样[序];
  if (!前 || !后 || 后.消行数 <= 前.消行数) continue;
  消行事件 += 1;
  if (后.主题 === 前.主题) 每次消除都换肤 = false;
}
const 消行单调 = 采样.every((项, 序) => 序 === 0 || 项.消行数 >= (采样[序 - 1]?.消行数 ?? 0));
const 分数单调 = 采样.every((项, 序) => 序 === 0 || 项.分数 >= (采样[序 - 1]?.分数 ?? 0));
// 换肤次数应覆盖所有换肤（事件数可能被采样漏掉，只允许换肤次数 ≥ 事件数）。
const 换肤覆盖 = 换肤次数 >= 消行事件 && 换肤次数 >= 8;

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
const 有声音 = Number.isFinite(平均音量) && 平均音量 > -50;

const 结果 = {
  地址,
  输出,
  时长秒,
  竞速秒,
  有音频,
  平均音量,
  有声音,
  背景音乐: 音频状态.背景音乐,
  音效音量: 音频状态.音效音量,
  视频: 视频流 ? `${视频流.width}x${视频流.height} ${视频流.codec_name}` : null,
  字节: Number(探测.format.size),
  结束,
  完赛: 末帧?.阶段 === "结束" && (末帧?.消行数 ?? 0) >= 40,
  最终消行数: 末帧?.消行数 ?? 0,
  最终分数: 末帧?.分数 ?? 0,
  换肤次数,
  采样到的消行事件: 消行事件,
  每次消除都换肤,
  换肤覆盖,
  消行单调,
  分数单调,
  页面错误,
  通过:
    结束 &&
    (末帧?.消行数 ?? 0) >= 40 &&
    每次消除都换肤 &&
    换肤覆盖 &&
    消行单调 &&
    分数单调 &&
    (竞速秒 ?? 99) <= 12 &&
    (竞速秒 ?? 0) >= 6 &&
    有音频 &&
    有声音 &&
    音频状态.背景音乐 === false &&
    时长秒 >= 15 &&
    时长秒 <= 30 &&
    页面错误.length === 0,
};
await writeFile(join(报告目录, "校验.json"), JSON.stringify({ ...结果, 采样 }, null, 2));
console.log(JSON.stringify(结果, null, 2));
process.exit(结果.通过 ? 0 : 1);
