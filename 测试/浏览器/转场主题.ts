import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { inflateSync } from "node:zlib";
import { type Browser, chromium, type Page } from "playwright";
import type {} from "../../代码/应用/启动";
import { 并行池, 解析并发 } from "../接入/并行池";

/**
 * 五主题「模式选择 → 对局」转场关键帧验收（390×844 DPR1，只截当前视口）。
 *
 * 用法：`bun ./测试/浏览器/转场主题.ts [地址] [--主题=砖机液晶,糖果超甜] [--并发=N]`
 * （地址默认 http://127.0.0.1:3002，要求开发服务器稳定；验收中途 HMR 重载会让那一轮作废）。
 *
 * 抓帧不靠定时器：两页都轮询时间轴读数，越过目标秒的那一帧立刻 `page.screenshot()`。
 * - 模式选择页：快照文字 `入场秒:` 有读数，`入场:` 是演出阶段（居中/压线/蓄力）；
 * - 对局页：界面文字只有 `入场:展开|Ready|Go|完成`，**没有** `入场秒:`，
 *   秒数必须从 `读取状态().入场秒` 读（对局快照对象里有）。
 * 像素采样放在 Node 侧解 PNG：验收自己的采样若占用页面主线程，就会错过下一帧，误差不止一帧。
 * 正式抓帧前先空点一次模式卡进对局、等 Ready/Go 都演完再退回菜单：对局页首次构建与
 * Ready/Go 文字图集的停顿会被固定步长一次补齐，否则 0.06s 首帧与 0.95s 帧会跳拍。
 *
 * 断言（退出码非 0 即失败）：
 * 1. 两页接力在 2.4s 时间轴内跑完并进入 `进行中`，且没有跳过演出；
 * 2. 每主题至少一帧接缝带（屏幕中线上下各 20px）比幕布带更亮，说明接缝演出真的在画；
 * 3. 五套主题的幕布主色不全相同，说明画法确实按主题分发；
 * 4. 每主题六帧齐全、抓帧误差不超一到两帧（按命中时实测帧间隔）、关键节拍都覆盖到；
 * 5. 各主题在闭合帧（模式选择 1.02s）的幕布区/接缝带命中自己的调色板锚点：
 *    液晶四色、彩砖七色、立体壳/壳面/板与灯、糖果巧克力/草莓/奶油、极光幕外与高亮接缝线。
 *    取色源：`资源/主题/像素/像素规范.ts`、`资源/主题/立体/立体规范.ts`、
 *    `资源/主题/糖果/糖果规范.ts`、`资源/视效/过渡/转场主题/极光.ts`。
 *
 * 产物：`.gamemaker/报告/转场主题/<主题>/<阶段>-<秒>.png` 与 `汇总.json`。
 */

const 默认地址 = "http://127.0.0.1:3002";
const 视口 = { 宽: 390, 高: 844 } as const;
const 主题顺序 = ["极光原野", "砖机液晶", "街机彩砖", "立体晶格", "糖果超甜"] as const;
type 主题 = (typeof 主题顺序)[number];
/** 两页各自的帧目标秒：都相对该页自己的时间轴，不是相对点击时刻。 */
const 模式选择帧 = [0.35, 0.72, 1.02] as const;
const 对局帧 = [0.06, 0.45, 0.95] as const;
const 帧目标 = { 模式选择: [...模式选择帧], 对局: [...对局帧] } as const;
type 阶段 = keyof typeof 帧目标;
const 一帧毫秒 = 1000 / 60;
/** 2.4s 时间轴 + 点击到首帧、末帧轮询的余量；下限防止演出被跳过。 */
const 总耗时上限毫秒 = 2700;
const 总耗时下限毫秒 = 2300;
const 中线 = 视口.高 / 2;

/** 亮度对比用：接缝带与上下幕布带。 */
const 亮度取样 = {
  接缝: { 左: 0, 上: Math.round(中线) - 20, 宽: 视口.宽, 高: 40 },
  幕布: [
    { 左: 0, 上: 40, 宽: 视口.宽, 高: 80 },
    { 左: 0, 上: 视口.高 - 120, 宽: 视口.宽, 高: 80 },
  ],
} as const;

/**
 * 锚点取样：闭合帧（模式选择 1.02s）幕布厚约 330px，这几条横带依次覆盖
 * 外缘（巧克力边/壳）、远段、中段、近缝砖带与贴缝裱花；接缝带取屏幕中线上下 20px。
 */
const 锚点取样 = {
  幕布: [
    { 左: 0, 上: 2, 宽: 视口.宽, 高: 24 },
    { 左: 0, 上: 30, 宽: 视口.宽, 高: 80 },
    { 左: 0, 上: 170, 宽: 视口.宽, 高: 70 },
    { 左: 0, 上: 250, 宽: 视口.宽, 高: 60 },
    { 左: 0, 上: 310, 宽: 视口.宽, 高: 18 },
  ],
  接缝: { 左: 0, 上: Math.round(中线) - 20, 宽: 视口.宽, 高: 40 },
} as const;

type 矩形区 = {
  readonly 左: number;
  readonly 上: number;
  readonly 宽: number;
  readonly 高: number;
};

interface 区域统计 {
  /** 0~1 的平均亮度。 */
  平均亮度: number;
  /** 亮度 > 0.3 的像素数。 */
  亮点数: number;
  /** 最亮一行的平均亮度：接缝是横线，按行看比整块平均更敏感。 */
  最亮行亮度: number;
}

interface 锚点色 {
  名称: string;
  值: number;
}

/** 一套主题的锚点期望：幕布区与接缝带各要命中哪几种规范色。 */
interface 主题锚点 {
  幕布: readonly 锚点色[];
  幕布至少: number;
  /** 幕布区判据的最近调色板距离（欧氏，0~441）。 */
  幕布容差: number;
  幕布最少像素: number;
  /** 必须命中的指定色（例如液晶的「墨 与 暗」）。 */
  幕布必需?: readonly 锚点色[];
  接缝: readonly 锚点色[];
  接缝至少: number;
  接缝容差: number;
  接缝最少像素: number;
  /** 接缝带平均亮度下限（极光的「高亮接缝线」）。 */
  接缝亮度下限?: number;
}

interface 锚点命中 {
  名称: string;
  值: number;
  /** 最近调色板归到该色的像素数（距离 ≤ 容差）。 */
  命中像素: number;
  /** 该色在取样区里的最近像素。 */
  最近像素: string;
  最小距离: number;
  /** 是否达到「最少像素」门槛。 */
  达标: boolean;
}

interface 锚点判定 {
  幕布命中: string[];
  接缝命中: string[];
  幕布均值: string;
  幕布像素数: number;
  接缝平均亮度: number;
  通过: boolean;
  原因: string[];
}

interface 帧记录 {
  阶段: 阶段;
  目标秒: number;
  /** 页面内轮询命中目标秒时的读数（≥ 目标，最多超一帧）。 */
  抓帧秒: number | null;
  /** 截图刚结束时的读数，用来量化截图本身的延迟。 */
  截图后秒: number | null;
  触发误差毫秒: number | null;
  截图延迟毫秒: number | null;
  /** 该帧的入场节拍（模式选择页是演出阶段，对局页是 展开/Ready/Go/完成）。 */
  入场节拍: string;
  /** 命中时的实测平均帧间隔，抓帧误差按它判定「一帧」。 */
  帧间隔毫秒: number;
  路径: string;
  接缝: 区域统计;
  幕布: 区域统计;
  /** 幕布带平均色（#rrggbb）：主题分发是否生效看它。 */
  幕布主色: string;
}

interface 主题结果 {
  主题: 主题;
  帧: 帧记录[];
  进入进行中: boolean;
  总耗时毫秒: number;
  /** 接缝达标的那一帧名；null 表示任何一帧的接缝都不比幕布亮。 */
  接缝达标帧: string | null;
  /** 主题调色板锚点判定（在闭合帧上采样）。 */
  锚点: 锚点判定 | null;
  页面错误: string[];
  失败: string | null;
}

interface 抓帧缓冲 {
  截图: Buffer;
  阶段: 阶段;
  目标秒: number;
  抓帧秒: number | null;
  截图后秒: number | null;
  入场节拍: string;
  帧间隔毫秒: number;
  路径: string;
}

interface 抓帧标记 {
  秒: number;
  节拍: string;
  /** 命中时的实测平均帧间隔：并发压满时页面可能低于 60fps，一帧就不是 16.7ms。 */
  帧间隔毫秒: number;
}

interface 位图 {
  宽: number;
  高: number;
  通道: 3 | 4;
  像素: Uint8Array;
}

declare global {
  interface Window {
    /** 转场抓帧：页面内轮询命中目标秒时写入读数，截图后统一读回。 */
    __转场抓帧__?: 抓帧标记;
  }
}

// —— 主题规范色：只抄调色板，不改画法；改配色要同步改这里 ——
const 锚点 = {
  幕外: { 名称: "幕外", 值: 0x182b3f },
  墨: { 名称: "墨", 值: 0x0f380f },
  液晶暗: { 名称: "暗", 值: 0x306230 },
  液晶亮: { 名称: "亮", 值: 0x8bac0f },
  液晶底: { 名称: "底", 值: 0x9bbc0f },
  红: { 名称: "红", 值: 0xff5a7a },
  黄: { 名称: "黄", 值: 0xffe14a },
  绿: { 名称: "绿", 值: 0x5dff7a },
  蓝: { 名称: "蓝", 值: 0x4d8aff },
  紫: { 名称: "紫", 值: 0xc46bff },
  青: { 名称: "青", 值: 0x3dffff },
  橙: { 名称: "橙", 值: 0xff9a3c },
  壳: { 名称: "壳", 值: 0x050d18 },
  壳面: { 名称: "壳面", 值: 0x0a1c30 },
  板: { 名称: "板", 值: 0x163a58 },
  灯: { 名称: "灯", 值: 0x12bfff },
  灯芯: { 名称: "灯芯", 值: 0xe7fbff },
  巧克力深: { 名称: "巧克力深", 值: 0x220d15 },
  草莓: { 名称: "草莓", 值: 0xf58fa8 },
  奶油: { 名称: "奶油", 值: 0xf8ddc8 },
} as const;

const 彩砖七色: readonly 锚点色[] = [锚点.红, 锚点.黄, 锚点.绿, 锚点.蓝, 锚点.紫, 锚点.青, 锚点.橙];

/**
 * 每套主题的锚点期望。容差不是 0：幕布是渐变与混色画出来的，
 * 砖面色是「七色混向深底」的，所以按最近调色板距离判定，而不是逐通道 ±6。
 */
const 主题锚点: Record<主题, 主题锚点> = {
  // 极光不是调色板主题：幕布区只要出现幕外深色（外缘渐变起点），闭合帧接缝是整条高亮线。
  极光原野: {
    幕布: [锚点.幕外],
    幕布至少: 1,
    幕布容差: 32,
    幕布最少像素: 256,
    接缝: [],
    接缝至少: 0,
    接缝容差: 32,
    接缝最少像素: 1,
    接缝亮度下限: 0.45,
  },
  // 液晶：幕外墨 → 中段暗 → 接缝侧亮砖带；接缝是亮/底交替的液晶块。
  砖机液晶: {
    幕布: [锚点.墨, 锚点.液晶暗, 锚点.液晶亮, 锚点.液晶底],
    幕布至少: 2,
    幕布容差: 24,
    幕布最少像素: 256,
    幕布必需: [锚点.墨, 锚点.液晶暗],
    接缝: [锚点.液晶亮, 锚点.液晶底],
    接缝至少: 1,
    接缝容差: 48,
    接缝最少像素: 64,
  },
  // 彩砖：幕墙砖面混向深底，最近调色板距离会到 60~100，所以容差放宽；接缝整排七色。
  街机彩砖: {
    幕布: 彩砖七色,
    幕布至少: 4,
    幕布容差: 96,
    幕布最少像素: 64,
    接缝: 彩砖七色,
    接缝至少: 4,
    接缝容差: 72,
    接缝最少像素: 48,
  },
  // 立体：幕底壳 → 壳面 → 板三段；接缝是灯色灯条 + 灯芯亮块。
  立体晶格: {
    幕布: [锚点.壳, 锚点.壳面, 锚点.板],
    幕布至少: 2,
    幕布容差: 48,
    幕布最少像素: 256,
    接缝: [锚点.灯, 锚点.灯芯],
    接缝至少: 1,
    接缝容差: 48,
    接缝最少像素: 64,
  },
  // 糖果：巧克力幕面 + 草莓高光带 + 接缝侧奶油裱花；接缝是草莓糖浆条。
  糖果超甜: {
    幕布: [锚点.巧克力深, 锚点.草莓, 锚点.奶油],
    幕布至少: 2,
    幕布容差: 64,
    幕布最少像素: 128,
    接缝: [锚点.草莓, 锚点.奶油],
    接缝至少: 1,
    接缝容差: 48,
    接缝最少像素: 64,
  },
};

const 地址 = process.argv.slice(2).find((项) => !项.startsWith("--")) ?? 默认地址;
const 主题参数 = process.argv.find((项) => 项.startsWith("--主题="))?.split("=")[1];
const 选定主题 = 主题参数
  ? 主题顺序.filter((项) => 主题参数.split(",").includes(项))
  : [...主题顺序];
if (选定主题.length === 0) {
  throw new Error(`--主题= 没有匹配到主题：${主题参数}。可选：${主题顺序.join("、")}`);
}
const 输出 = resolve(".gamemaker/报告/转场主题");
await mkdir(输出, { recursive: true });

/** 带说明的页面内轮询：超时信息里带上「在等什么」和当时的快照，排错不用猜。 */
async function 等(页: Page, 说明: string, 条件: () => boolean, 超时毫秒 = 8000): Promise<void> {
  try {
    await 页.waitForFunction(条件, undefined, { polling: "raf", timeout: 超时毫秒 });
  } catch {
    const 快照 = await 页.evaluate(() => ({
      页面: window.__three版__?.读取状态().页面,
      文字: window.__three版__?.读取界面().文字,
    }));
    throw new Error(`等待「${说明}」超时：${JSON.stringify(快照)}`);
  }
}

/** 页面开合（跨页过渡）或模式选择页自己的开合还在播时，按钮会被标成不可用。 */
const 等开合结束 = (页: Page) =>
  等(页, "页面开合结束", () => {
    const 文字 = window.__three版__?.读取界面().文字 ?? [];
    return !文字.some((行) => 行 === "页面开合:播放中" || 行.startsWith("开合:播放中"));
  });

/** 页面内轮询该页时间轴，命中目标秒时把读数写进 window，供截图后读回。 */
async function 等该页时间轴(页: Page, 阶段: 阶段, 目标秒: number): Promise<void> {
  if (阶段 === "模式选择") {
    await 页.waitForFunction(
      (目标) => {
        const 桥 = window.__three版__;
        const 文字 = 桥?.读取界面().文字 ?? [];
        const 秒 = Number(文字.find((项) => 项.startsWith("入场秒:"))?.slice("入场秒:".length));
        if (!(Number.isFinite(秒) && 秒 >= 目标)) return false;
        window.__转场抓帧__ = {
          秒,
          节拍: 文字.find((项) => 项.startsWith("入场:"))?.slice("入场:".length) ?? "",
          帧间隔毫秒: 桥?.读取统计().循环.平均帧间隔毫秒 ?? 16.7,
        };
        return true;
      },
      目标秒,
      { polling: "raf", timeout: 6000 },
    );
    return;
  }
  await 页.waitForFunction(
    (目标) => {
      const 桥 = window.__three版__;
      const 状态 = 桥?.读取状态();
      if (状态?.页面 !== "对局") return false;
      const 秒 = 状态.入场秒;
      if (typeof 秒 !== "number" || 秒 < 目标) return false;
      window.__转场抓帧__ = {
        秒,
        节拍:
          桥
            ?.读取界面()
            .文字?.find((项) => 项.startsWith("入场:"))
            ?.slice("入场:".length) ?? "",
        帧间隔毫秒: 桥?.读取统计().循环.平均帧间隔毫秒 ?? 16.7,
      };
      return true;
    },
    目标秒,
    { polling: "raf", timeout: 8000 },
  );
}

/**
 * 等该页时间轴越过目标秒，命中那一帧立刻截图。
 * 页面内 `polling: "raf"` 保证最多超一帧，且不在截图前多走一次往返。
 */
async function 触发抓帧(页: Page, 主题: 主题, 阶段: 阶段, 目标秒: number): Promise<抓帧缓冲> {
  try {
    await 等该页时间轴(页, 阶段, 目标秒);
  } catch {
    // 抓帧超时：把当时的页面/文字/状态带进错误里，区分「没点进去」和「开发服务器重载」。
    const 快照 = await 页.evaluate(() => ({
      页面: window.__three版__?.读取状态().页面,
      文字: window.__three版__?.读取界面().文字,
      入场秒: window.__three版__?.读取状态().入场秒,
    }));
    throw new Error(`抓帧超时 ${阶段}-${目标秒.toFixed(2)}：${JSON.stringify(快照)}`);
  }
  const 路径 = join(输出, 主题, 帧文件名(阶段, 目标秒));
  const 缓冲 = await 页.screenshot({ path: 路径 });
  const 读数 = await 页.evaluate((阶段名) => {
    const 桥 = window.__three版__;
    const 标记 = window.__转场抓帧__ ?? null;
    if (!桥) return { 标记, 秒: null };
    if (阶段名 === "对局") {
      const 状态 = 桥.读取状态();
      return { 标记, 秒: 状态.页面 === "对局" ? 状态.入场秒 : null };
    }
    const 行 = 桥.读取界面().文字?.find((项) => 项.startsWith("入场秒:"));
    const 秒 = Number(行?.slice("入场秒:".length));
    return { 标记, 秒: Number.isFinite(秒) ? 秒 : null };
  }, 阶段);
  return {
    截图: 缓冲,
    阶段,
    目标秒,
    抓帧秒: 读数.标记?.秒 ?? null,
    截图后秒: 读数.秒,
    入场节拍: 读数.标记?.节拍 ?? "",
    帧间隔毫秒: 读数.标记?.帧间隔毫秒 ?? 一帧毫秒,
    路径,
  };
}

/** 解码 Chrome 截图（8 位、非隔行、RGB/RGBA）：只接受验收真的会收到的格式。 */
function 解码截图(数据: Buffer): 位图 {
  let 位 = 8;
  let 宽 = 0;
  let 高 = 0;
  let 通道: 3 | 4 = 4;
  const 图像块: Buffer[] = [];
  while (位 + 8 <= 数据.length) {
    const 长度 = 数据.readUInt32BE(位);
    位 += 4;
    const 类型 = 数据.subarray(位, 位 + 4).toString("ascii");
    位 += 4;
    const 体 = 数据.subarray(位, 位 + 长度);
    位 += 长度 + 4;
    if (类型 === "IHDR") {
      宽 = 体.readUInt32BE(0);
      高 = 体.readUInt32BE(4);
      if (体[8] !== 8 || 体[12] !== 0) throw new Error("截图不是 8 位非隔行 PNG");
      const 颜色类型 = 体[9];
      if (颜色类型 === 2) 通道 = 3;
      else if (颜色类型 === 6) 通道 = 4;
      else throw new Error(`截图颜色类型 ${颜色类型} 不支持`);
    } else if (类型 === "IDAT") {
      图像块.push(体);
    } else if (类型 === "IEND") {
      break;
    }
  }
  if (宽 === 0 || 高 === 0) throw new Error("截图缺少 IHDR");
  const 原始 = inflateSync(Buffer.concat(图像块));
  const 行字节 = 宽 * 通道;
  const 像素 = new Uint8Array(宽 * 高 * 通道);
  for (let 行 = 0; 行 < 高; 行++) {
    const 起 = 行 * (行字节 + 1);
    const 过滤 = 原始[起] ?? 0;
    const 源 = 原始.subarray(起 + 1, 起 + 1 + 行字节);
    const 出 = 像素.subarray(行 * 行字节, (行 + 1) * 行字节);
    const 上行 = 行 === 0 ? null : 像素.subarray((行 - 1) * 行字节, 行 * 行字节);
    for (let i = 0; i < 行字节; i++) {
      const 左 = i >= 通道 ? (出[i - 通道] ?? 0) : 0;
      const 上 = 上行?.[i] ?? 0;
      const 左上 = 上行 && i >= 通道 ? (上行[i - 通道] ?? 0) : 0;
      const 加 =
        过滤 === 0
          ? 0
          : 过滤 === 1
            ? 左
            : 过滤 === 2
              ? 上
              : 过滤 === 3
                ? Math.floor((左 + 上) / 2)
                : 过滤 === 4
                  ? 帕斯预测(左, 上, 左上)
                  : (() => {
                      throw new Error(`未知 PNG 行过滤 ${过滤}`);
                    })();
      出[i] = ((源[i] ?? 0) + 加) & 0xff;
    }
  }
  return { 宽, 高, 通道, 像素 };
}

/** PNG Paeth 预测器。 */
function 帕斯预测(左: number, 上: number, 左上: number): number {
  const 估 = 左 + 上 - 左上;
  const 距左 = Math.abs(估 - 左);
  const 距上 = Math.abs(估 - 上);
  const 距左上 = Math.abs(估 - 左上);
  if (距左 <= 距上 && 距左 <= 距左上) return 左;
  return 距上 <= 距左上 ? 上 : 左上;
}

/** 区域统计：多块区域合并算平均亮度、亮点数与最亮行。 */
function 统计区(图: 位图, 区集: readonly 矩形区[]): 区域统计 {
  let 亮度合计 = 0;
  let 像素数 = 0;
  let 亮点数 = 0;
  let 最亮行亮度 = 0;
  for (const 区 of 区集) {
    for (let 行 = 区.上; 行 < 区.上 + 区.高; 行++) {
      let 行合计 = 0;
      for (let 列 = 区.左; 列 < 区.左 + 区.宽; 列++) {
        const 位 = (行 * 图.宽 + 列) * 图.通道;
        const 亮 =
          ((图.像素[位] ?? 0) * 0.2126 +
            (图.像素[位 + 1] ?? 0) * 0.7152 +
            (图.像素[位 + 2] ?? 0) * 0.0722) /
          255;
        行合计 += 亮;
        if (亮 > 0.3) 亮点数 += 1;
      }
      最亮行亮度 = Math.max(最亮行亮度, 行合计 / 区.宽);
      亮度合计 += 行合计;
      像素数 += 区.宽;
    }
  }
  const 除数 = Math.max(1, 像素数);
  return { 平均亮度: 亮度合计 / 除数, 亮点数, 最亮行亮度 };
}

/** RGB 平均色转 #rrggbb。 */
function 十六色(主色: readonly [number, number, number]): string {
  const 两位 = (值: number) =>
    Math.max(0, Math.min(255, Math.round(值)))
      .toString(16)
      .padStart(2, "0");
  return `#${两位(主色[0])}${两位(主色[1])}${两位(主色[2])}`;
}

const 拆色 = (值: number): [number, number, number] => [
  (值 >> 16) & 0xff,
  (值 >> 8) & 0xff,
  值 & 0xff,
];

const 色距 = (甲: readonly [number, number, number], 乙: readonly [number, number, number]) =>
  Math.hypot(甲[0] - 乙[0], 甲[1] - 乙[1], 甲[2] - 乙[2]);

/** 取样区平均色。 */
function 区域均色(图: 位图, 区集: readonly 矩形区[]): [number, number, number] {
  let 红 = 0;
  let 绿 = 0;
  let 蓝 = 0;
  let 数 = 0;
  for (const 区 of 区集) {
    for (let 行 = 区.上; 行 < 区.上 + 区.高; 行++) {
      for (let 列 = 区.左; 列 < 区.左 + 区.宽; 列++) {
        const 位 = (行 * 图.宽 + 列) * 图.通道;
        红 += 图.像素[位] ?? 0;
        绿 += 图.像素[位 + 1] ?? 0;
        蓝 += 图.像素[位 + 2] ?? 0;
        数 += 1;
      }
    }
  }
  const 除数 = Math.max(1, 数);
  return [红 / 除数, 绿 / 除数, 蓝 / 除数];
}

/**
 * 锚点命中：每个像素归到最近的调色板色，只有距离 ≤ 容差才算命中，
 * 避免「红色与橙色都算」把命中种数虚抬上去；同时记录每种色的最近像素便于报错。
 */
function 取锚点命中(
  图: 位图,
  区集: readonly 矩形区[],
  调色板: readonly 锚点色[],
  容差: number,
  最少像素: number,
): 锚点命中[] {
  const 命中 = 调色板.map((锚) => ({
    名称: 锚.名称,
    值: 锚.值,
    命中像素: 0,
    最近像素: "",
    最小距离: Number.POSITIVE_INFINITY,
    达标: false,
  }));
  for (const 区 of 区集) {
    for (let 行 = 区.上; 行 < 区.上 + 区.高; 行++) {
      for (let 列 = 区.左; 列 < 区.左 + 区.宽; 列++) {
        const 位 = (行 * 图.宽 + 列) * 图.通道;
        const 像素: [number, number, number] = [
          图.像素[位] ?? 0,
          图.像素[位 + 1] ?? 0,
          图.像素[位 + 2] ?? 0,
        ];
        let 最近序 = -1;
        let 最近距 = Number.POSITIVE_INFINITY;
        for (let 序 = 0; 序 < 调色板.length; 序++) {
          const 锚 = 调色板[序];
          if (!锚) continue;
          const 距 = 色距(像素, 拆色(锚.值));
          const 记 = 命中[序];
          if (记 && 距 < 记.最小距离) {
            记.最小距离 = 距;
            记.最近像素 = 十六色(像素);
          }
          if (距 < 最近距) {
            最近距 = 距;
            最近序 = 序;
          }
        }
        if (最近序 >= 0 && 最近距 <= 容差) {
          const 记 = 命中[最近序];
          if (记) 记.命中像素 += 1;
        }
      }
    }
  }
  for (const 记 of 命中) 记.达标 = 记.命中像素 >= 最少像素;
  return 命中;
}

/** 把一种锚点色的命中情况写成一行，报错时能直接看出「缺哪个色、实测多少」。 */
function 锚点摘要(记: 锚点命中): string {
  return `${记.名称}(${十六色(拆色(记.值))}) 命中 ${记.命中像素}px / 最近 ${记.最近像素 || "-"} 距 ${记.最小距离.toFixed(1)}`;
}

/** 闭合帧锚点判定：幕布区与接缝带各按主题调色板查命中。 */
function 判定锚点(主题: 主题, 闭合帧: 抓帧缓冲 | undefined): 锚点判定 | null {
  if (!闭合帧) return null;
  const 期望 = 主题锚点[主题];
  const 图 = 解码截图(闭合帧.截图);
  const 幕布命中 = 取锚点命中(图, 锚点取样.幕布, 期望.幕布, 期望.幕布容差, 期望.幕布最少像素);
  const 接缝命中 = 取锚点命中(图, [锚点取样.接缝], 期望.接缝, 期望.接缝容差, 期望.接缝最少像素);
  const 幕布均值 = 十六色(区域均色(图, 锚点取样.幕布));
  const 接缝亮度 = 统计区(图, [锚点取样.接缝]).平均亮度;
  const 原因: string[] = [];

  const 幕布达标 = 幕布命中.filter((记) => 记.达标);
  if (幕布达标.length < 期望.幕布至少) {
    原因.push(
      `${主题} 幕布区只命中 ${幕布达标.length} 种锚点色（要求 ≥${期望.幕布至少}，容差 ${期望.幕布容差}、最少 ${期望.幕布最少像素}px）：` +
        `${幕布达标.map((记) => 记.名称).join("、") || "无"}；实测 ${幕布命中.map(锚点摘要).join("；")}；区域均值 ${幕布均值}`,
    );
  }
  for (const 必需 of 期望.幕布必需 ?? []) {
    const 记 = 幕布命中.find((项) => 项.名称 === 必需.名称);
    if (!记?.达标) {
      原因.push(
        `${主题} 幕布区缺少必需锚点色 ${必需.名称}(${十六色(拆色(必需.值))})：` +
          `${记 ? 锚点摘要(记) : "无命中记录"}；区域均值 ${幕布均值}`,
      );
    }
  }
  const 接缝达标 = 接缝命中.filter((记) => 记.达标);
  if (接缝达标.length < 期望.接缝至少) {
    原因.push(
      `${主题} 接缝带只命中 ${接缝达标.length} 种锚点色（要求 ≥${期望.接缝至少}，容差 ${期望.接缝容差}、最少 ${期望.接缝最少像素}px）：` +
        `${接缝达标.map((记) => 记.名称).join("、") || "无"}；实测 ${接缝命中.map(锚点摘要).join("；")}`,
    );
  }
  if (期望.接缝亮度下限 !== undefined && 接缝亮度 < 期望.接缝亮度下限) {
    原因.push(`${主题} 接缝带平均亮度 ${接缝亮度.toFixed(3)} 低于高亮线判据 ${期望.接缝亮度下限}`);
  }
  return {
    幕布命中: 幕布达标.map((记) => 记.名称),
    接缝命中: 接缝达标.map((记) => 记.名称),
    幕布均值,
    幕布像素数: 幕布命中.reduce((合计, 记) => 合计 + 记.命中像素, 0),
    接缝平均亮度: 接缝亮度,
    通过: 原因.length === 0,
    原因,
  };
}

/** 帧记录：把抓帧读数与截图像素统计拼在一起。 */
function 采样帧(缓冲: 抓帧缓冲): 帧记录 {
  const 图 = 解码截图(缓冲.截图);
  const 接缝 = 统计区(图, [亮度取样.接缝]);
  const 幕布 = 统计区(图, 亮度取样.幕布);
  const 抓帧秒 = 缓冲.抓帧秒;
  const 截图后秒 = 缓冲.截图后秒;
  return {
    阶段: 缓冲.阶段,
    目标秒: 缓冲.目标秒,
    抓帧秒,
    截图后秒,
    触发误差毫秒: 抓帧秒 === null ? null : Math.round((抓帧秒 - 缓冲.目标秒) * 1000),
    截图延迟毫秒:
      抓帧秒 === null || 截图后秒 === null ? null : Math.round((截图后秒 - 抓帧秒) * 1000),
    入场节拍: 缓冲.入场节拍,
    帧间隔毫秒: 缓冲.帧间隔毫秒,
    路径: 缓冲.路径,
    接缝,
    幕布,
    幕布主色: 十六色(区域均色(图, 亮度取样.幕布)),
  };
}

function 帧文件名(阶段: 阶段, 目标秒: number): string {
  return `${阶段}-${目标秒.toFixed(2)}.png`;
}

/** 读当前界面按钮并点中心（只给预热流程用；正式抓帧不点按钮）。 */
async function 点界面按钮(页: Page, 名称: string): Promise<void> {
  for (let 次数 = 0; 次数 < 3; 次数++) {
    await 等开合结束(页);
    // 纸页/弹层的关闭动画要 400ms 上下才落定，等短了会把点击吞掉（彩砖作者复现过）。
    await 页.waitForTimeout(420);
    const 项 = await 页.evaluate(
      (名) => window.__three版__?.读取界面().按钮.find((键) => 键.名称 === 名),
      名称,
    );
    if (!项) {
      if (次数 > 0) return;
      throw new Error(`预热流程找不到按钮「${名称}」`);
    }
    await 页.mouse.click(项.左 + 项.宽 / 2, 项.上 + 项.高 / 2);
    await 页.waitForTimeout(420);
    const 还在 = await 页.evaluate(
      (名) => (window.__three版__?.读取界面().按钮 ?? []).some((键) => 键.名称 === 名),
      名称,
    );
    if (!还在) return;
  }
  throw new Error(`点击「${名称}」三次都没切走`);
}

/**
 * 预热对局页：第一次进对局要构建整页和 Ready/Go 文字图集，主线程停顿时固定步长会一次补齐，
 * 0.06s 首帧与 0.95s（Go 出现）帧都会跳拍。先真点一次模式卡进对局，等整条入场演完
 * （Ready/Go 都画过）再从暂停菜单回模式选择；正式抓帧时页面与图集都已复用。
 */
async function 预热对局页(页: Page): Promise<void> {
  await 等开合结束(页);
  const 卡片 = await 页.evaluate(() =>
    window.__three版__?.读取界面().按钮.find((项) => 项.名称.includes("模式:冲刺")),
  );
  if (!卡片) throw new Error("预热时模式选择页没有「模式:冲刺」按钮");
  await 页.mouse.click(卡片.左 + 卡片.宽 / 2, 卡片.上 + 卡片.高 / 2);
  await 等(页, "预热：进入对局", () => window.__three版__?.读取状态().页面 === "对局");
  await 等(页, "预热：对局入场跑完（建好 Ready/Go 文字图集）", () => {
    const 状态 = window.__three版__?.读取状态();
    return 状态?.页面 === "对局" && 状态.入场秒 === null && 状态.阶段 === "进行中";
  });
  await 页.waitForTimeout(240);
  await 点界面按钮(页, "暂停");
  await 点界面按钮(页, "返回主菜单");
  await 等(页, "预热：回到菜单", () => window.__three版__?.读取状态().页面 === "菜单");
  await 点界面按钮(页, "开始游戏");
  await 等(页, "预热：模式选择页可点", () =>
    (window.__three版__?.读取界面().按钮 ?? []).some(
      (项) => 项.名称.includes("模式:冲刺") && 项.可用 !== false,
    ),
  );
  await 等开合结束(页);
}

/** 一轮 = 独立浏览器上下文 + 独立游戏实例：主题之间没有共享状态，可以并发。 */
async function 采集主题(浏览器: Browser, 主题: 主题): Promise<主题结果> {
  const 结果: 主题结果 = {
    主题,
    帧: [],
    进入进行中: false,
    总耗时毫秒: 0,
    接缝达标帧: null,
    锚点: null,
    页面错误: [],
    失败: null,
  };
  await mkdir(join(输出, 主题), { recursive: true });
  const 上下文 = await 浏览器.newContext({
    viewport: { width: 视口.宽, height: 视口.高 },
    deviceScaleFactor: 1,
  });
  const 页 = await 上下文.newPage();
  页.on("pageerror", (错) => 结果.页面错误.push(错.message));
  页.on("console", (消息) => {
    if (消息.type() !== "error") return;
    const 文本 = 消息.text();
    // GM 开发服务器的控制通道与游戏无关；断连只说明看板没开。
    if (文本.includes("/control?project=") || 文本.includes("ERR_CONNECTION_REFUSED")) return;
    结果.页面错误.push(文本);
  });
  try {
    await 页.goto(地址);
    try {
      await 页.waitForFunction(() => window.__three版__ !== undefined, undefined, {
        timeout: 20000,
      });
    } catch {
      throw new Error(`游戏未就绪：${结果.页面错误.join("；") || "测试桥没有挂上"}`);
    }
    await 页.waitForTimeout(400);
    // 测试桥在 __再消一行测试__ 上（不在 __three版__）：切主题 + 导航到模式选择页。
    await 页.evaluate(
      (项) => window.__再消一行测试__?.进入素材场景("模式选择", 390, 844, 项),
      主题,
    );
    await 等开合结束(页);
    const 当前主题 = await 页.evaluate(() => window.__three版__?.读取设置().主题选择);
    if (当前主题 !== 主题) throw new Error(`主题没切过去：期望 ${主题}，实际 ${当前主题}`);
    // 预热对局页：首次构建与 Ready/Go 图集的停顿会被固定步长一次补齐，直接毁掉首帧/Go 帧。
    await 预热对局页(页);
    await 等(页, "模式选择页可点", () =>
      (window.__three版__?.读取界面().按钮 ?? []).some(
        (项) => 项.名称.includes("模式:冲刺") && 项.可用 !== false,
      ),
    );
    const 卡片 = await 页.evaluate(() =>
      window.__three版__?.读取界面().按钮.find((项) => 项.名称.includes("模式:冲刺")),
    );
    if (!卡片) throw new Error("模式选择页没有「模式:冲刺」按钮");
    // 预热截图路径：首张截图要多付一帧以上，别让第 0.35s 帧替它买单。
    await 页.screenshot();

    const 起 = Date.now();
    await 页.mouse.click(卡片.左 + 卡片.宽 / 2, 卡片.上 + 卡片.高 / 2);

    // 模式选择页三帧串联触发：时间轴不等人，先截图，采样放到 Node 侧做。
    const 模式选择缓冲: 抓帧缓冲[] = [];
    for (const 目标 of 模式选择帧) 模式选择缓冲.push(await 触发抓帧(页, 主题, "模式选择", 目标));
    // 1.02 截图后立刻开始等对局首帧：0.06s 的窗口只有几帧。
    const 对局首帧任务 = 触发抓帧(页, 主题, "对局", 对局帧[0]);
    for (const 缓冲 of 模式选择缓冲) 结果.帧.push(采样帧(缓冲));
    结果.帧.push(采样帧(await 对局首帧任务));
    for (const 目标 of 对局帧.slice(1)) {
      结果.帧.push(采样帧(await 触发抓帧(页, 主题, "对局", 目标)));
    }

    await 等(
      页,
      "对局进入进行中",
      () => {
        const 状态 = window.__three版__?.读取状态();
        return 状态?.页面 === "对局" && 状态.入场秒 === null && 状态.阶段 === "进行中";
      },
      5000,
    );
    结果.总耗时毫秒 = Date.now() - 起;
    结果.进入进行中 = true;
    结果.锚点 = 判定锚点(主题, 模式选择缓冲.at(-1));
    const 达标 = 结果.帧.find(
      (帧) => 帧.接缝.平均亮度 > 帧.幕布.平均亮度 * 1.05 && 帧.接缝.亮点数 > 50,
    );
    结果.接缝达标帧 = 达标 ? `${达标.阶段}-${达标.目标秒.toFixed(2)}` : null;
  } catch (错) {
    结果.失败 = String(错);
  } finally {
    await 上下文.close();
  }
  return 结果;
}

/** 幕布主色按 8 级量化后再比：同一主题的轻微渐变噪声不参与「是否相同」的判断。 */
function 主色键(十六进制: string): string {
  const 数 = Number.parseInt(十六进制.slice(1), 16);
  return [(数 >> 16) & 0xff, (数 >> 8) & 0xff, 数 & 0xff].map((值) => Math.round(值 / 8)).join(",");
}

const 浏览器 = await chromium.launch({ channel: "chrome" });
let 主题结果: 主题结果[] = [];
try {
  主题结果 = await 并行池(选定主题, 解析并发(process.argv, 选定主题.length), (主题) =>
    采集主题(浏览器, 主题),
  );
} finally {
  await 浏览器.close();
}

const 失败原因: string[] = [];
const 幕布主色: Record<string, string> = {};
for (const 结果 of 主题结果) {
  const { 主题 } = 结果;
  const 首帧 = 结果.帧.find((帧) => 帧.阶段 === "对局" && 帧.目标秒 === 对局帧[0]);
  if (首帧) 幕布主色[主题] = 首帧.幕布主色;

  if (结果.失败) 失败原因.push(`${主题}：采集失败 ${结果.失败}`);
  if (结果.页面错误.length > 0) {
    失败原因.push(`${主题}：页面报错 ${结果.页面错误.join("；")}`);
  }
  if (!结果.进入进行中) {
    失败原因.push(`${主题}：没有在时间轴内进入「进行中」`);
  } else if (结果.总耗时毫秒 > 总耗时上限毫秒) {
    失败原因.push(`${主题}：转场总耗时 ${结果.总耗时毫秒}ms 超过 ${总耗时上限毫秒}ms`);
  } else if (结果.总耗时毫秒 < 总耗时下限毫秒) {
    失败原因.push(`${主题}：转场总耗时 ${结果.总耗时毫秒}ms 偏短，像跳过了演出`);
  }
  if (结果.帧.length !== 模式选择帧.length + 对局帧.length) {
    失败原因.push(
      `${主题}：抓到 ${结果.帧.length} 帧（应为 ${模式选择帧.length + 对局帧.length} 帧）`,
    );
  }
  for (const 帧 of 结果.帧) {
    // 并发压满时页面可能只跑到 20fps，一帧就是 50ms：按命中时的实测帧间隔判定。
    // 对局段（Ready/Go 文字图集）允许两帧，模式选择段只允许一帧。
    const 单帧毫秒 = Math.max(一帧毫秒, 帧.帧间隔毫秒);
    const 允许帧数 = 帧.阶段 === "对局" ? 2 : 1;
    if (帧.抓帧秒 === null || (帧.触发误差毫秒 ?? 单帧毫秒 * 9) > 单帧毫秒 * 允许帧数 + 8) {
      失败原因.push(
        `${主题} ${帧.阶段}-${帧.目标秒.toFixed(2)}：抓帧误差 ${帧.触发误差毫秒}ms 超过 ${允许帧数} 帧（实测 ${单帧毫秒.toFixed(1)}ms/帧）`,
      );
    }
  }
  const 模式节拍 = 结果.帧
    .filter((帧) => 帧.阶段 === "模式选择")
    .map((帧) => 帧.入场节拍)
    .join("/");
  const 对局节拍 = 结果.帧
    .filter((帧) => 帧.阶段 === "对局")
    .map((帧) => 帧.入场节拍)
    .join("/");
  if (模式节拍 !== "居中/压线/蓄力") {
    失败原因.push(`${主题}：模式选择页三帧节拍是「${模式节拍}」，应为 居中/压线/蓄力`);
  }
  if (对局节拍 !== "展开/Ready/Go") {
    失败原因.push(`${主题}：对局页三帧节拍是「${对局节拍}」，应为 展开/Ready/Go`);
  }
  if (结果.接缝达标帧 === null) {
    失败原因.push(`${主题}：没有任何一帧的接缝带比幕布带更亮，接缝演出可能没画`);
  }
  if (结果.锚点 === null) {
    失败原因.push(`${主题}：没有闭合帧（模式选择 1.02s），无法做锚点色判定`);
  } else {
    失败原因.push(...结果.锚点.原因);
  }
}
const 主色键集 = new Set(Object.values(幕布主色).map(主色键));
if (Object.keys(幕布主色).length !== 主题结果.length) {
  失败原因.push("幕布主色取样不全：有主题没抓到对局首帧");
} else if (主题结果.length >= 2 && 主色键集.size < 2) {
  失败原因.push(`五套主题的幕布主色完全相同（${JSON.stringify(幕布主色)}），主题分发没生效`);
} else if (主题结果.length < 2) {
  console.log("提示：只跑了 1 个主题，跳过「幕布主色互不相同」判定");
}

const 通过 = 失败原因.length === 0;
const 汇总 = {
  生成时间: new Date().toISOString(),
  地址,
  视口: { 宽: 视口.宽, 高: 视口.高, 设备像素比: 1 },
  帧目标,
  取样区: { 亮度: 亮度取样, 锚点: 锚点取样 },
  判定: {
    通过,
    失败原因,
    总耗时上限毫秒,
    总耗时下限毫秒,
    抓帧误差判据:
      "触发误差 ≤ 允许帧数 × 命中时实测帧间隔 + 8ms（模式选择 1 帧、对局 2 帧；并发下页面可能低于 60fps）",
    接缝判据: "接缝带平均亮度 > 幕布带平均亮度 × 1.05 且亮点像素 > 50",
    锚点判据:
      "闭合帧（模式选择 1.02s）幕布区/接缝带按「最近调色板距离 ≤ 容差 + 最少像素」统计命中种数；取色源见脚本头注释",
    幕布主色不同数: 主色键集.size,
    幕布主色键: Object.fromEntries(
      Object.entries(幕布主色).map(([主题, 十六进制]) => [主题, 主色键(十六进制)]),
    ),
  },
  幕布主色,
  主题: 主题结果,
};

for (const 结果 of 主题结果) {
  const 标记 = 结果.失败 ? "✗" : "✓";
  console.log(
    `${标记} ${结果.主题} 总耗时=${结果.总耗时毫秒}ms 帧=${结果.帧.length} 接缝达标帧=${结果.接缝达标帧 ?? "无"} 幕布主色=${幕布主色[结果.主题] ?? "?"}`,
  );
  for (const 帧 of 结果.帧) {
    console.log(
      `   ${帧.阶段}-${帧.目标秒.toFixed(2)} 实际=${帧.抓帧秒?.toFixed(3) ?? "-"} ` +
        `截图后=${帧.截图后秒?.toFixed(3) ?? "-"} 触发误差=${帧.触发误差毫秒 ?? "-"}ms ` +
        `截图延迟=${帧.截图延迟毫秒 ?? "-"}ms 帧间隔=${帧.帧间隔毫秒.toFixed(1)}ms 节拍=${帧.入场节拍} ` +
        `接缝亮度=${帧.接缝.平均亮度.toFixed(3)}/${帧.接缝.亮点数} 幕布亮度=${帧.幕布.平均亮度.toFixed(3)}`,
    );
  }
  if (结果.锚点) {
    console.log(
      `   锚点 幕布命中=${结果.锚点.幕布命中.join("、") || "无"}（${结果.锚点.幕布像素数}px 均值 ${结果.锚点.幕布均值}）` +
        ` 接缝命中=${结果.锚点.接缝命中.join("、") || "无"}（亮度 ${结果.锚点.接缝平均亮度.toFixed(3)}）`,
    );
  }
  if (结果.失败) console.log(`   失败：${结果.失败}`);
}
console.log("幕布主色：", JSON.stringify(幕布主色), "不同数=", 主色键集.size);
await writeFile(join(输出, "汇总.json"), JSON.stringify(汇总, null, 2));
if (!通过) {
  console.log("FAIL", JSON.stringify(失败原因, null, 2));
  process.exitCode = 1;
} else {
  console.log(`OK 五主题转场关键帧验收通过，报告：${join(输出, "汇总.json")}`);
}
