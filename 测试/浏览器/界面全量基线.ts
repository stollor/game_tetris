import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { inflateSync } from "node:zlib";
import { chromium, type Page } from "playwright";

/**
 * 全页面 × 主题视觉基线比对。
 *
 * 背景：11-04 的性能优化（节点自动分带 / 页面扩展带 / 同带内按纹理合批）打破了界面层级语义，
 * 像素级问题（纸页被文字穿透、文字被遮罩压暗、3D 井被 2D 棋盘底盖住）在状态断言里看不出来。
 * 这里对「场景 × 主题」逐格截图并记 sha256 + 像素指纹：第一次跑写基线，之后跑报变化/新增/消失。
 *
 * 为什么不是只比 sha256：每页背景/装饰都在动，同一页面连跑两次的 PNG 字节必然不同，
 * 只比 sha256 每次都会报几十条假变化。所以再记一份 16×35 的像素指纹（格子均值），
 * 用「格差容忍」区分「动画微抖」与「真变化」：整片区域被压暗/盖住会让很多格子大幅变化。
 *
 * 用法：
 *   bun 测试/浏览器/界面全量基线.ts [地址]          对比基线（默认 http://127.0.0.1:3000）
 *   bun 测试/浏览器/界面全量基线.ts --更新基线      重写基线
 *   bun 测试/浏览器/界面全量基线.ts http://127.0.0.1:3000 --更新基线
 *
 * 产物：
 *   .gamemaker/报告/界面全量基线/<场景>-<主题>.png
 *   .gamemaker/报告/界面全量基线/基线.json（sha256 + 像素指纹 + 本页抖动噪声）
 *   .gamemaker/报告/界面全量基线/比对结果.json / 比对结果.md
 *
 * 说明：
 * - 同一浏览器上下文内串行导航（切焦点会让游戏自动暂停），组合之间先回根页再进目标场景。
 * - 每次进入后固定等 1.2s 再抓第一帧（游戏逻辑是固定步长，抓帧时刻固定才能跨跑对齐相位），
 *   另抓 350ms 后的第二帧量「这一页自己的动画抖动」，作为容差噪声。
 * - `进入素材场景` 会临时解锁并应用主题（走金币服务），所以后跑到的「商店」截图是已拥有状态。
 * - 素材桥的「结算成功/结算失败」在跳页途中会被后到的进入重置（见报告），脚本自动降级为
 *   对局桥的准备结算，并在基线项里标 状态=降级路径，不静默。
 */

type 页面快照 = { sceneId?: string };

interface 像素指纹 {
  列: number;
  行: number;
  /** 每格 RGB 均值，按 列×行×3 存 base64。 */
  数据: string;
}

interface 基线项 {
  文件: string;
  sha256: string;
  指纹: 像素指纹;
  /** 同页两帧（间隔 350ms）之间的差异格数，代表该页动画噪声。 */
  抖动格数: number;
  场景: string;
  主题: string;
  到达页面: string;
  状态: "正常" | "降级路径";
  说明?: string;
}

interface 基线数据 {
  说明: string;
  视口: { 宽: number; 高: number; 设备像素比: number };
  网格: { 列: number; 行: number; 格差阈值: number; 差异比例阈值: number };
  生成时间: string;
  组合: Record<string, 基线项>;
}

const 场景列表 = [
  "主界面",
  "模式选择",
  "对局",
  "结算成功",
  "结算失败",
  "设置",
  "成就",
  "排行榜",
  "商店",
] as const;
const 主题列表 = ["极光原野", "砖机液晶", "街机彩砖", "立体晶格", "糖果超甜"] as const;
const 结算场景 = new Set(["结算成功", "结算失败"]);
/** 素材场景名 → 页面编号：素材目录叫「主界面」，页面栈里是「菜单」；结算落在浮层「结算」。 */
const 期望页面: Record<string, string> = {
  主界面: "菜单",
  模式选择: "模式选择",
  对局: "对局",
  结算成功: "结算",
  结算失败: "结算",
  设置: "设置",
  成就: "成就",
  排行榜: "排行榜",
  商店: "商店",
};
const 视口 = { 宽: 390, 高: 844, 设备像素比: 1 };
/** 指纹网格：格差超过「格差阈值」算一格变化；变化格占比超过「差异比例阈值」算真变化。 */
const 网格 = { 列: 16, 行: 35, 格差阈值: 24, 差异比例阈值: 0.04 };
/** 抓帧时刻：进入页面后固定等这么久，跨跑相位才对得上。 */
const 稳定毫秒 = 1200;
/** 噪声采样：连抓 3 帧、每帧间隔这么久，把「动态背景相位漂移」量成该页噪声。 */
const 噪声间隔毫秒 = 700;

const 参数 = process.argv.slice(2);
const 更新基线 = 参数.includes("--更新基线");
const 地址 = 参数.find((项) => !项.startsWith("--")) ?? "http://127.0.0.1:3000";
const 输出目录 = resolve(".gamemaker/报告/界面全量基线");
const 基线文件 = join(输出目录, "基线.json");

await mkdir(输出目录, { recursive: true });

// —— PNG 解码（Chrome 截图是 8bit RGB/RGBA，不引第三方图像库） ——
function 解码PNG(数据: Buffer): { 宽: number; 高: number; 像素: Uint8Array } {
  let 偏移 = 8;
  let 宽 = 0;
  let 高 = 0;
  let 位深 = 0;
  let 颜色类型 = 0;
  const 数据块: Buffer[] = [];
  while (偏移 + 8 <= 数据.length) {
    const 长度 = 数据.readUInt32BE(偏移);
    const 类型 = 数据.toString("ascii", 偏移 + 4, 偏移 + 8);
    const 内容 = 数据.subarray(偏移 + 8, 偏移 + 8 + 长度);
    if (类型 === "IHDR") {
      宽 = 内容.readUInt32BE(0);
      高 = 内容.readUInt32BE(4);
      位深 = 内容[8] ?? 8;
      颜色类型 = 内容[9] ?? 6;
    } else if (类型 === "IDAT") 数据块.push(内容);
    偏移 += 12 + 长度;
  }
  if (!宽 || !高) throw new Error("PNG 缺 IHDR");
  if (位深 !== 8) throw new Error(`只支持 8bit PNG，实际 ${位深}`);
  const 通道 = 颜色类型 === 6 ? 4 : 颜色类型 === 2 ? 3 : 颜色类型 === 0 ? 1 : 0;
  if (!通道) throw new Error(`不支持的 PNG 颜色类型 ${颜色类型}`);
  const 原始 = inflateSync(Buffer.concat(数据块));
  const 每行字节 = 宽 * 通道;
  const 像素 = new Uint8Array(宽 * 高 * 3);
  let 上一行 = new Uint8Array(每行字节);
  for (let y = 0; y < 高; y++) {
    const 过滤 = 原始[y * (每行字节 + 1)] ?? 0;
    const 源 = 原始.subarray(y * (每行字节 + 1) + 1, y * (每行字节 + 1) + 1 + 每行字节);
    const 行 = new Uint8Array(每行字节);
    for (let x = 0; x < 每行字节; x++) {
      const 原 = 源[x] ?? 0;
      const 左 = x >= 通道 ? (行[x - 通道] ?? 0) : 0;
      const 上 = 上一行[x] ?? 0;
      const 左上 = x >= 通道 ? (上一行[x - 通道] ?? 0) : 0;
      let 值 = 原;
      if (过滤 === 1) 值 = 原 + 左;
      else if (过滤 === 2) 值 = 原 + 上;
      else if (过滤 === 3) 值 = 原 + ((左 + 上) >> 1);
      else if (过滤 === 4) {
        const 估 = 左 + 上 - 左上;
        const 距左 = Math.abs(估 - 左);
        const 距上 = Math.abs(估 - 上);
        const 距左上 = Math.abs(估 - 左上);
        值 = 原 + (距左 <= 距上 && 距左 <= 距左上 ? 左 : 距上 <= 距左上 ? 上 : 左上);
      }
      行[x] = 值 & 0xff;
    }
    上一行 = 行;
    for (let x = 0; x < 宽; x++) {
      const 源位 = x * 通道;
      const 目标 = (y * 宽 + x) * 3;
      像素[目标] = 行[源位] ?? 0;
      像素[目标 + 1] = 通道 > 2 ? (行[源位 + 1] ?? 0) : 像素[目标];
      像素[目标 + 2] = 通道 > 2 ? (行[源位 + 2] ?? 0) : 像素[目标];
    }
  }
  return { 宽, 高, 像素 };
}

function 计算指纹(帧: Buffer): 像素指纹 {
  const { 宽, 高, 像素 } = 解码PNG(帧);
  const 数据 = new Uint8Array(网格.列 * 网格.行 * 3);
  for (let 行 = 0; 行 < 网格.行; 行++) {
    const 上 = Math.floor((行 * 高) / 网格.行);
    const 下 = Math.max(上 + 1, Math.floor(((行 + 1) * 高) / 网格.行));
    for (let 列 = 0; 列 < 网格.列; 列++) {
      const 左 = Math.floor((列 * 宽) / 网格.列);
      const 右 = Math.max(左 + 1, Math.floor(((列 + 1) * 宽) / 网格.列));
      const 和 = [0, 0, 0];
      let 数 = 0;
      for (let y = 上; y < 下; y++) {
        for (let x = 左; x < 右; x++) {
          const 位 = (y * 宽 + x) * 3;
          和[0] = (和[0] ?? 0) + (像素[位] ?? 0);
          和[1] = (和[1] ?? 0) + (像素[位 + 1] ?? 0);
          和[2] = (和[2] ?? 0) + (像素[位 + 2] ?? 0);
          数 += 1;
        }
      }
      const 基 = (行 * 网格.列 + 列) * 3;
      数据[基] = Math.round((和[0] ?? 0) / 数);
      数据[基 + 1] = Math.round((和[1] ?? 0) / 数);
      数据[基 + 2] = Math.round((和[2] ?? 0) / 数);
    }
  }
  return { 列: 网格.列, 行: 网格.行, 数据: Buffer.from(数据).toString("base64") };
}

function 比较指纹(甲: 像素指纹, 乙: 像素指纹): { 差异格数: number; 最大差: number; 总格: number } {
  const 甲数据 = Buffer.from(甲.数据, "base64");
  const 乙数据 = Buffer.from(乙.数据, "base64");
  const 总格 = Math.min(甲数据.length, 乙数据.length) / 3;
  let 差异格数 = 0;
  let 最大差 = 0;
  for (let 格 = 0; 格 < 总格; 格++) {
    const 基 = 格 * 3;
    const 差 = Math.max(
      Math.abs((甲数据[基] ?? 0) - (乙数据[基] ?? 0)),
      Math.abs((甲数据[基 + 1] ?? 0) - (乙数据[基 + 1] ?? 0)),
      Math.abs((甲数据[基 + 2] ?? 0) - (乙数据[基 + 2] ?? 0)),
    );
    最大差 = Math.max(最大差, 差);
    if (差 > 网格.格差阈值) 差异格数 += 1;
  }
  return { 差异格数, 最大差, 总格 };
}

const 计算哈希 = (数据: Buffer) => createHash("sha256").update(数据).digest("hex");

/** 调试桥的 `进入素材场景` 会抛错（未知场景/主题）；在页面内捕获，返回结构化结果。 */
async function 进入场景(
  页: Page,
  场景: string,
  主题: string,
): Promise<{ 正常: boolean; 错误?: string }> {
  return 页.evaluate(
    (参) => {
      const 桥 = (
        window as Window & {
          __再消一行测试__?: { 进入素材场景(s: string, w?: number, h?: number, t?: string): void };
        }
      ).__再消一行测试__;
      if (!桥) return { 正常: false, 错误: "缺少 window.__再消一行测试__" };
      try {
        桥.进入素材场景(参.场景, 参.宽, 参.高, 参.主题);
        return { 正常: true };
      } catch (错误) {
        return { 正常: false, 错误: String(错误) };
      }
    },
    { 场景, 主题, 宽: 视口.宽, 高: 视口.高 },
  );
}

async function 读取页面(页: Page): Promise<string> {
  const 快照 = await 页.evaluate<页面快照 | undefined>(
    () => window.__GAMEMAKER_TEST__?.getSnapshot?.() as 页面快照 | undefined,
  );
  return 快照?.sceneId ?? "";
}

/** 等目标页面到达（结算页是浮层，需要等对局结算演出结束）。 */
async function 等页面(页: Page, 目标: string, 超时毫秒: number): Promise<boolean> {
  const 截止 = Date.now() + 超时毫秒;
  while (Date.now() < 截止) {
    if ((await 读取页面(页)) === 目标) return true;
    await 页.waitForTimeout(120);
  }
  return (await 读取页面(页)) === 目标;
}

/**
 * 连抓三帧：第一帧落盘当基线图。
 * 三帧两两比较取最大差异格数，作为「本页动画噪声」——动态背景按调度重画，
 * 同一跑里间隔 0.7s/1.4s 的画面差，近似跨跑相位漂移的量级。
 */
async function 抓帧(
  页: Page,
  路径: string,
): Promise<{ sha256: string; 指纹: 像素指纹; 抖动格数: number }> {
  const 帧: Buffer[] = [await 页.screenshot()];
  for (let 次 = 0; 次 < 2; 次++) {
    await 页.waitForTimeout(噪声间隔毫秒);
    帧.push(await 页.screenshot());
  }
  const 首帧 = 帧[0];
  if (!首帧) throw new Error("截图失败");
  await writeFile(路径, 首帧);
  const 指纹表 = 帧.map(计算指纹);
  let 抖动格数 = 0;
  for (let 甲 = 0; 甲 < 指纹表.length; 甲++) {
    for (let 乙 = 甲 + 1; 乙 < 指纹表.length; 乙++) {
      const 甲指纹 = 指纹表[甲];
      const 乙指纹 = 指纹表[乙];
      if (!甲指纹 || !乙指纹) continue;
      抖动格数 = Math.max(抖动格数, 比较指纹(甲指纹, 乙指纹).差异格数);
    }
  }
  const 首指纹 = 指纹表[0];
  if (!首指纹) throw new Error("指纹计算失败");
  return {
    sha256: 计算哈希(首帧),
    指纹: 首指纹,
    抖动格数,
  };
}

async function 读取基线(): Promise<基线数据 | null> {
  try {
    return JSON.parse(await readFile(基线文件, "utf8")) as 基线数据;
  } catch {
    return null;
  }
}

const 浏览器 = await chromium.launch({ channel: "chrome" });
const 组合结果: Record<string, 基线项> = {};
const 跳过: { 键: string; 原因: string }[] = [];
const 页面错误: string[] = [];

try {
  const 页 = await 浏览器.newPage({
    viewport: { width: 视口.宽, height: 视口.高 },
    deviceScaleFactor: 视口.设备像素比,
  });
  页.on("pageerror", (错误) => 页面错误.push(错误.message));
  // 固定 Math.random：素材画面的堆叠、方块序列、装饰粒子都吃随机数，
  // 不钉住的话同一页跨跑连棋盘形状都不同（实测差异 80~120 格），基线永远对不上。
  // 用 mulberry32 定种 PRNG 替掉 Math.random，跑内/跨跑同一序列 → 画面可复现。
  await 页.addInitScript(() => {
    let 种子 = 0x2f6e2b1;
    Math.random = () => {
      种子 = (种子 + 0x6d2b79f5) | 0;
      let 值 = Math.imul(种子 ^ (种子 >>> 15), 1 | 种子);
      值 = (值 + Math.imul(值 ^ (值 >>> 7), 61 | 值)) ^ 值;
      return ((值 ^ (值 >>> 14)) >>> 0) / 4294967296;
    };
  });
  await 页.goto(地址);
  await 页.waitForFunction(() => window.__再消一行测试__ !== undefined, undefined, {
    timeout: 30000,
  });
  // 首次进主界面要等文字图集/主题资源就绪。
  await 页.waitForTimeout(1800);

  for (const 场景 of 场景列表) {
    for (const 主题 of 主题列表) {
      const 键 = `${场景}-${主题}`;
      const 文件 = `${键}.png`;
      // 组合之间先回根页：避免上一个组合的浮层/对局页影响下一次导航。
      const 回根 = await 进入场景(页, "主界面", 主题);
      if (!回根.正常) {
        跳过.push({ 键, 原因: `回根页失败：${回根.错误 ?? "未知"}` });
        continue;
      }
      // 回根要等开合/转场走完：素材桥是在 rAF 里排素材画面的，跳页途中排队会被后到的进入重置。
      await 页.waitForTimeout(1000);
      const 进入 = await 进入场景(页, 场景, 主题);
      if (!进入.正常) {
        跳过.push({ 键, 原因: 进入.错误 ?? "进入素材场景抛错" });
        console.log(`跳过：${键}｜${进入.错误 ?? "进入素材场景抛错"}`);
        continue;
      }
      let 状态: 基线项["状态"] = "正常";
      let 说明: string | undefined;
      if (结算场景.has(场景)) {
        const 完赛 = 场景 === "结算成功";
        if (!(await 等页面(页, "结算", 5000))) {
          // 降级：素材桥的结算场景在「回根 → 进对局」的连续跳页里会被后到的进入重置，
          // 这里等对局页真正落定再走对局桥的准备结算。
          await 进入场景(页, "对局", 主题);
          await 等页面(页, "对局", 4000);
          await 页.waitForTimeout(1200);
          await 页.evaluate(
            (参数) =>
              (
                window as Window & {
                  __再消一行测试__: { 准备结算(完赛?: boolean): void };
                }
              ).__再消一行测试__.准备结算(参数),
            完赛,
          );
          const 到了 = await 等页面(页, "结算", 4000);
          状态 = "降级路径";
          说明 = 到了
            ? `素材桥「${场景}」未打开结算页，改走 对局→准备结算(${完赛})`
            : `素材桥「${场景}」未打开结算页，降级后仍未到达结算页`;
        }
      }
      const 到达页面 = await 读取页面(页);
      const 期望 = 期望页面[场景] ?? 场景;
      if (到达页面 !== 期望) {
        跳过.push({ 键, 原因: `到达页面异常：期望 ${期望}，实际 ${到达页面}` });
        console.log(`跳过：${键}｜到达页面 ${到达页面}`);
        continue;
      }
      await 页.waitForTimeout(稳定毫秒);
      const 帧 = await 抓帧(页, join(输出目录, 文件));
      组合结果[键] = {
        文件,
        sha256: 帧.sha256,
        指纹: 帧.指纹,
        抖动格数: 帧.抖动格数,
        场景,
        主题,
        到达页面,
        状态,
        ...(说明 ? { 说明 } : {}),
      };
      console.log(
        `截图：${键}｜页面 ${到达页面}｜${状态}｜${帧.sha256.slice(0, 12)}｜抖动 ${帧.抖动格数} 格`,
      );
    }
  }
  console.log(`\n场景导航结束，页面错误 ${页面错误.length} 个`);
} finally {
  await 浏览器.close();
}

// —— 基线比对 ——
const 旧基线 = await 读取基线();
type 对比项 = { 键: string; 差异格数: number; 最大差: number; 噪声: number; 阈值: number };
const 结果 = {
  地址,
  视口,
  网格,
  跑完时间: new Date().toISOString(),
  更新基线,
  页错误: 页面错误,
  跳过,
  截图数: Object.keys(组合结果).length,
  变化: [] as 对比项[],
  抖动: [] as 对比项[],
  新增: [] as string[],
  消失: [] as string[],
  未变: 0,
};

if (!旧基线 || 更新基线) {
  const 基线: 基线数据 = {
    说明:
      "界面全量基线：场景 × 主题的 sha256 + 16×35 像素指纹（另有每页两帧抖动噪声，用于区分动画微抖与真变化）。" +
      "改界面层级/绘制带/主题后重跑本脚本，先看「变化」再肉眼确认。",
    视口,
    网格,
    生成时间: new Date().toISOString(),
    组合: 组合结果,
  };
  await writeFile(基线文件, `${JSON.stringify(基线, null, 2)}\n`, "utf8");
  console.log(`\n已写入基线：${基线文件}（${组合结果 && Object.keys(组合结果).length} 个组合）`);
} else {
  const 总格 = 网格.列 * 网格.行;
  for (const 键 of Object.keys(组合结果)) {
    const 旧 = 旧基线.组合[键];
    const 新 = 组合结果[键];
    if (!旧) {
      结果.新增.push(键);
      continue;
    }
    if (旧.sha256 === 新.sha256) {
      结果.未变 += 1;
      continue;
    }
    const 差 = 比较指纹(旧.指纹, 新.指纹);
    // 噪声取两跑同页抖动的较大者，再留 2 倍余量：阈值低于它就把动画帧当成了回归。
    const 噪声 = Math.max(旧.抖动格数, 新.抖动格数);
    // 阈值：动画噪声的 1.8 倍再留 4 格余量，且不低于整屏 6%。
    const 阈值 = Math.max(4, Math.round(噪声 * 1.8) + 4, Math.round(总格 * 网格.差异比例阈值));
    const 项 = { 键, 差异格数: 差.差异格数, 最大差: 差.最大差, 噪声, 阈值 };
    if (差.差异格数 > 阈值) 结果.变化.push(项);
    else 结果.抖动.push(项);
  }
  for (const 键 of Object.keys(旧基线.组合)) if (!组合结果[键]) 结果.消失.push(键);
  console.log(
    `\n对比基线：变化 ${结果.变化.length}｜抖动（仅动画微差）${结果.抖动.length}｜新增 ${结果.新增.length}｜消失 ${结果.消失.length}｜未变 ${结果.未变}`,
  );
  for (const 项 of 结果.变化)
    console.log(
      `变化：${项.键}｜差异 ${项.差异格数}/${总格} 格（最大差 ${项.最大差}）｜阈值 ${项.阈值}`,
    );
  if (结果.新增.length) console.log(`新增：${结果.新增.join("、")}`);
  if (结果.消失.length) console.log(`消失：${结果.消失.join("、")}`);
}

await writeFile(join(输出目录, "比对结果.json"), `${JSON.stringify(结果, null, 2)}\n`, "utf8");

const 行 = [
  "# 界面全量基线比对",
  "",
  `- 地址：${地址}`,
  `- 视口：${视口.宽}×${视口.高} @${视口.设备像素比}x`,
  `- 指纹网格：${网格.列}×${网格.行}（格差 > ${网格.格差阈值} 记一格变化；变化格占比 > ${网格.差异比例阈值} 记真变化）`,
  `- 时间：${结果.跑完时间}`,
  `- 本次截图：${结果.截图数} 张；跳过：${跳过.length} 组；页错误：${页面错误.length} 个`,
  "",
];
if (!旧基线 || 更新基线) {
  行.push("本次写入了基线（无历史基线或 --更新基线）。", "");
  行.push("| 组合 | 到达页面 | 状态 | 指纹 | 本页抖动格 |", "| --- | --- | --- | --- | --- |");
  for (const [键, 项] of Object.entries(组合结果))
    行.push(`| ${键} | ${项.到达页面} | ${项.状态} | ${项.sha256.slice(0, 12)} | ${项.抖动格数} |`);
} else {
  行.push(
    `## 本次变化（${结果.变化.length}）`,
    "",
    "| 组合 | 差异格数 | 最大差 | 阈值 |",
    "| --- | --- | --- | --- |",
    ...(结果.变化.length
      ? 结果.变化.map((项) => `| ${项.键} | ${项.差异格数} | ${项.最大差} | ${项.阈值} |`)
      : ["| 无 | - | - | - |"]),
    "",
    `## 抖动（${结果.抖动.length}，仅动画帧微差，不算回归）`,
    "",
    ...(结果.抖动.length
      ? 结果.抖动.map((项) => `- ${项.键}：差异 ${项.差异格数} 格，阈值 ${项.阈值}`)
      : ["- 无"]),
    "",
    `## 新增（${结果.新增.length}）`,
    "",
    ...(结果.新增.length ? 结果.新增.map((键) => `- ${键}`) : ["- 无"]),
    "",
    `## 消失（${结果.消失.length}）`,
    "",
    ...(结果.消失.length ? 结果.消失.map((键) => `- ${键}`) : ["- 无"]),
    "",
    `其余 ${结果.未变} 组与基线逐字节一致。`,
  );
}
if (跳过.length) {
  行.push("", "## 跳过", "", ...跳过.map((项) => `- ${项.键}：${项.原因}`));
}
if (页面错误.length) {
  行.push("", "## 页面错误", "", ...页面错误.map((项) => `- ${项}`));
}
行.push("", "## 降级路径", "");
const 降级 = Object.entries(组合结果).filter(([, 项]) => 项.状态 !== "正常");
行.push(...(降级.length ? 降级.map(([键, 项]) => `- ${键}：${项.说明 ?? 项.状态}`) : ["- 无"]));
await writeFile(join(输出目录, "比对结果.md"), `${行.join("\n")}\n`, "utf8");

console.log(`结果：${join(输出目录, "比对结果.md")}`);
