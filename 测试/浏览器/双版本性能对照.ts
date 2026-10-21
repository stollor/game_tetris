import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { cpus, platform, release } from "node:os";
import { join, resolve } from "node:path";
import { type CDPSession, chromium, type Page } from "playwright";
import type {} from "../../代码/three版/启动";
import type {} from "../../代码/场景/对局/对局";
import type { 游戏性能接口 } from "../../框架/开发/性能协议";
import { 汇总数值, 解析轮次, 计算采样窗口 } from "./性能对照统计";

/**
 * 双版本性能对照：同一台机器、同一 Chromium、同一玩家路径与同一操作脚本，
 * 分别跑 Three 版与 Phaser 对照版，采样独立于引擎的 rAF 帧间隔 + 各引擎自带统计。
 *
 * 场景（每引擎 × 每个视口）：
 * - 启动：domcontentloaded → 测试桥就绪 → 首帧，记录加载耗时与传输字节；
 * - A 主界面菜单态 3s（静态 UI）；
 * - B 旅行商店 4s（重 UI：风景/牌面/目录/动效）；
 * - C 对局 10s：每 500ms 触发一次真实硬降（两版事件数一致），比较帧间隔/长帧/工作耗时。
 *
 * 用法：
 *   bun 测试/浏览器/双版本性能对照.ts [输出目录] [--three=http://ip:3000] [--phaser=http://ip:3220] [--仅=390|1280]
 * 说明：Chromium 模拟视口 + 无头模式，不等于真机；本机通过局域网 IP 访问本机服务。
 */

const 输出 = resolve(process.argv[2] ?? "reports/视觉返工/性能对照");
const 三地址 =
  process.argv.find((项) => 项.startsWith("--three="))?.split("=")[1] ?? "http://127.0.0.1:3000";
const 对照地址 =
  process.argv.find((项) => 项.startsWith("--phaser="))?.split("=")[1] ?? "http://127.0.0.1:3220";
const 仅 = process.argv.find((项) => 项.startsWith("--仅="))?.split("=")[1];
const 轮次 = 解析轮次(process.argv);
await mkdir(输出, { recursive: true });

type 引擎 = "three" | "phaser";
const 视口组 = (
  [
    { 标签: "手机390x844-DPR2", 宽: 390, 高: 844, 像素比: 2 },
    { 标签: "桌面1280x720-DPR1", 宽: 1280, 高: 720, 像素比: 1 },
  ] as const
).filter((项) => !仅 || 项.标签.includes(仅));

const 浏览器 = await chromium.launch({ channel: "chrome" });
const 记录: Record<string, unknown>[] = [];
const 页面错误: string[] = [];

const 地址 = (引擎: 引擎) => (引擎 === "three" ? 三地址 : 对照地址);

async function 点(页: Page, 引擎: 引擎, 名称: string): Promise<void> {
  const 框 = await 页.evaluate(
    ({ 引擎, 名称 }) => {
      if (引擎 === "three") {
        const 项 = window.__three版__
          ?.读取界面()
          .按钮.find((项) => 项.名称 === 名称 && 项.可用 !== false);
        return 项 ? { x: 项.左, y: 项.上, width: 项.宽, height: 项.高 } : null;
      }
      const 快照 = window.__GAMEMAKER_TEST__?.getSnapshot();
      const 项 = 快照?.interactives.find(
        (项) => 项.name === 名称 && 项.visible && 项.enabled,
      )?.bounds;
      const 画布 = document.querySelector("canvas")?.getBoundingClientRect();
      if (快照 && 项 && 画布)
        return {
          x: 画布.x + (项.x / 快照.width) * 画布.width,
          y: 画布.y + (项.y / 快照.height) * 画布.height,
          width: (项.width / 快照.width) * 画布.width,
          height: (项.height / 快照.height) * 画布.height,
        };
      return null;
    },
    { 引擎, 名称 },
  );
  assert.ok(框, `${引擎} 缺少可点按钮 ${名称}`);
  await 页.mouse.click(框.x + 框.width / 2, 框.y + 框.height / 2);
  await 页.waitForTimeout(160);
}

/** 页面内独立 rAF 采样器：与引擎实现无关。 */
const 开始采样 = (页: Page) =>
  页.evaluate(() => {
    const 状态 = {
      运行: true,
      间隔: [] as number[],
      首帧: null as number | null,
    };
    let 上一帧 = performance.now();
    const 计 = (时刻: number) => {
      if (状态.首帧 === null) 状态.首帧 = 时刻;
      状态.间隔.push(时刻 - 上一帧);
      上一帧 = 时刻;
      if (状态.运行) requestAnimationFrame(计);
    };
    requestAnimationFrame(计);
    Reflect.set(window, "__性能采样", 状态);
  });

const 结束采样 = (页: Page) =>
  页.evaluate(() => {
    const 状态 = Reflect.get(window, "__性能采样") as
      | { 运行: boolean; 间隔: number[]; 首帧: number | null }
      | undefined;
    if (!状态) throw new Error("采样器缺失");
    状态.运行 = false;
    const 间隔 = 状态.间隔.slice(1).filter((项) => 项 > 0);
    const 排序 = [...间隔].sort((甲, 乙) => 甲 - 乙);
    const 分位 = (比例: number) =>
      排序[Math.min(排序.length - 1, Math.floor(排序.length * 比例))] ?? 0;
    const 合计 = 间隔.reduce((总, 项) => 总 + 项, 0);
    return {
      帧数: 间隔.length,
      平均帧间隔毫秒: 间隔.length ? 合计 / 间隔.length : 0,
      P95帧间隔毫秒: 分位(0.95),
      P99帧间隔毫秒: 分位(0.99),
      最长帧间隔毫秒: 排序.at(-1) ?? 0,
      超过50毫秒帧数: 间隔.filter((项) => 项 > 50).length,
      超过33毫秒帧数: 间隔.filter((项) => 项 > 33).length,
    };
  });

const 读引擎统计 = (页: Page, 引擎: 引擎) =>
  页.evaluate((引擎) => {
    if (引擎 === "three") {
      const 统计 = window.__three版__?.读取统计();
      if (!统计) return null;
      return {
        循环: 统计.循环,
        渲染: {
          绘制调用: 统计.渲染.绘制调用,
          三角面: 统计.渲染.三角面,
          渲染帧数: 统计.渲染.渲染帧数,
          跳过帧数: 统计.渲染.跳过帧数,
          纹理峰值字节: 统计.渲染.纹理峰值字节,
          纹理字节: 统计.渲染.纹理字节,
        },
        图元: 统计.图元,
      };
    }
    const 性能 = Reflect.get(window, "__GAMEMAKER_TEST__")?.性能 as
      | { 引擎: string; 读取: (明细?: boolean) => unknown }
      | undefined;
    if (!性能) return null;
    const 点 = 性能.读取(false) as {
      秒数: number;
      逻辑帧: number;
      绘制帧: number;
      绘制间隔?: {
        P95毫秒: number | null;
        P99毫秒: number | null;
        最大毫秒: number | null;
        超过50毫秒: number;
      };
      逻辑阶段: { 总毫秒: number; 最大毫秒: number | null; P95毫秒: number | null };
      绘制阶段: { 总毫秒: number; 最大毫秒: number | null; P95毫秒: number | null };
      对象: { 总数: number; 活跃: number };
      贴图: { 数量: number; RGBA8字节: number };
      浏览器?: { JS堆字节: number | null };
    };
    return {
      引擎: 性能.引擎,
      秒数: 点.秒数,
      逻辑帧: 点.逻辑帧,
      绘制帧: 点.绘制帧,
      绘制间隔: 点.绘制间隔,
      逻辑阶段: 点.逻辑阶段,
      绘制阶段: 点.绘制阶段,
      对象: 点.对象,
      贴图: 点.贴图,
    };
  }, 引擎);

/** CPU采用CDP TaskDuration；只比较同机同诊断参数的窗口差值。 */
const CDP会话 = new WeakMap<Page, CDPSession>();
async function 读指标(页: Page) {
  let 会话 = CDP会话.get(页);
  if (!会话) {
    会话 = await 页.context().newCDPSession(页);
    await 会话.send("Performance.enable");
    CDP会话.set(页, 会话);
  }
  const { metrics } = await 会话.send("Performance.getMetrics");
  const 任务 = metrics.find((项) => 项.name === "TaskDuration");
  assert.ok(任务, "CDP缺少TaskDuration");
  return {
    CPU毫秒: 任务.value * 1000,
    JS堆字节: metrics.find((项) => 项.name === "JSHeapUsedSize")?.value ?? null,
  };
}

async function 开始引擎采样(页: Page, 引擎: 引擎) {
  await 页.evaluate((引擎) => {
    if (引擎 === "three") {
      if (!window.__three版__?.开始绘制采样) throw new Error("Three服务未加载绘制采样接口");
      window.__three版__.开始绘制采样();
    } else {
      const 桥 = Reflect.get(window, "__GAMEMAKER_TEST__");
      const 观测: 游戏性能接口 | undefined = 桥?.性能;
      if (!观测) throw new Error("Phaser性能观测缺失");
      观测.停止();
      观测.开始();
    }
  }, 引擎);
}
async function 读采样点(页: Page, 引擎: 引擎) {
  return 页.evaluate((引擎) => {
    const 观测: 游戏性能接口 | undefined = Reflect.get(window, "__GAMEMAKER_TEST__")?.性能;
    const 点 = 引擎 === "phaser" ? 观测?.读取(false) : null;
    const 统计 = 引擎 === "three" ? window.__three版__?.读取统计() : null;
    const 帧计数 = 统计?.渲染.渲染帧数 ?? 点?.绘制帧;
    if (帧计数 === undefined) throw new Error("实际渲染帧计数缺失");
    return { 时刻毫秒: performance.now(), 帧计数, 绘制间隔: 点?.绘制间隔 ?? null };
  }, 引擎);
}
async function 采样场景(页: Page, 引擎: 引擎, 毫秒: number, 驱动?: () => Promise<void>) {
  await 开始引擎采样(页, 引擎);
  await 开始采样(页);
  const 指标前 = await 读指标(页);
  const 前 = await 读采样点(页, 引擎);
  if (驱动) await 驱动();
  await 页.waitForTimeout(毫秒);
  const 后 = await 读采样点(页, 引擎);
  const 指标后 = await 读指标(页);
  const 调度 = await 结束采样(页);
  const 绘制间隔 =
    引擎 === "three"
      ? await 页.evaluate(() => window.__three版__?.结束绘制采样() ?? null)
      : 后.绘制间隔;
  return {
    ...调度,
    CPU毫秒: 指标后.CPU毫秒 - 指标前.CPU毫秒,
    JS堆字节: 指标后.JS堆字节,
    实际渲染: 计算采样窗口(前, 后),
    实际绘制间隔: 绘制间隔,
  };
}

const 启动性能 = (页: Page) =>
  页.evaluate(() => {
    const 导航 = performance.getEntriesByType("navigation")[0] as
      | PerformanceNavigationTiming
      | undefined;
    const 资源 = performance.getEntriesByType("resource") as PerformanceResourceTiming[];
    const 页面字节 =
      (导航?.decodedBodySize ?? 0) + 资源.reduce((总, 项) => 总 + (项.decodedBodySize || 0), 0);
    const 传输字节 =
      (导航?.transferSize ?? 0) + 资源.reduce((总, 项) => 总 + (项.transferSize || 0), 0);
    const 首帧 = performance
      .getEntriesByType("paint")
      .find((项) => 项.name === "first-contentful-paint");
    return {
      domContentLoaded毫秒: 导航 ? 导航.domContentLoadedEventEnd - 导航.startTime : null,
      资源条目数: 资源.length,
      解码字节: 页面字节,
      传输字节,
      首次内容绘制毫秒: 首帧 ? 首帧.startTime : null,
    };
  });

async function 跑一局(引擎: 引擎, 视口: (typeof 视口组)[number]) {
  const 页 = await 浏览器.newPage({
    viewport: { width: 视口.宽, height: 视口.高 },
    deviceScaleFactor: 视口.像素比,
  });
  try {
    页.on("pageerror", (错) => 页面错误.push(`${视口.标签}-${引擎}: ${错.message}`));
    页.on("console", (项) => {
      if (项.type() === "error") 页面错误.push(`${视口.标签}-${引擎}: ${项.text()}`);
    });
    // 两版同一初始设置：默认玩家设置（背景动态开、音乐 0、音效 80）。不写存档特例，保持真实默认。
    const 开始毫秒 = Date.now();
    await 页.goto(`${地址(引擎)}/?perf-debug`, { waitUntil: "domcontentloaded", timeout: 30000 });
    const 桥类型 = 引擎 === "three" ? "__three版__" : "__GAMEMAKER_TEST__";
    await 页.waitForFunction((键) => Reflect.has(window, 键), 桥类型, { timeout: 20000 });
    await 页.waitForFunction(
      (引擎) =>
        引擎 === "three"
          ? Boolean(window.__three版__?.读取统计)
          : Boolean(Reflect.get(window, "__GAMEMAKER_TEST__")?.性能),
      引擎,
      { timeout: 20000 },
    );
    const 启动 = await 启动性能(页);
    const 就绪毫秒 = Date.now() - 开始毫秒;
    await 页.waitForTimeout(800);

    // A 主界面菜单态
    const 菜单 = await 采样场景(页, 引擎, 3000);
    const 菜单统计 = await 读引擎统计(页, 引擎);

    // B 旅行商店（重 UI）
    await 点(页, 引擎, 引擎 === "three" ? "商店" : "menu.shop");
    await 页.waitForTimeout(600);
    const 商店 = await 采样场景(页, 引擎, 4000);
    const 商店统计 = await 读引擎统计(页, 引擎);

    // C 对局：同一脚本每 500ms 硬降一次，跑 10s
    await 页.reload({ waitUntil: "domcontentloaded" });
    await 页.waitForFunction((键) => Reflect.has(window, 键), 桥类型, { timeout: 20000 });
    await 页.waitForTimeout(600);
    await 点(页, 引擎, 引擎 === "three" ? "开始游戏" : "menu.start");
    await 点(页, 引擎, 引擎 === "three" ? "开始:马拉松" : "mode.马拉松");
    await 页.waitForFunction(() => Boolean(window.__再消一行测试__), null, { timeout: 20000 });
    await 页.evaluate(() => window.__再消一行测试__?.设置序列(["T", "I", "O", "S", "Z", "J", "L"]));
    await 页.waitForTimeout(500);
    const 对局 = await 采样场景(页, 引擎, 10000, () =>
      页.evaluate(() => {
        const 桥 = window.__再消一行测试__;
        if (!桥) throw new Error("对局桥缺失");
        let 次数 = 0;
        const 一拍 = () => {
          桥.准备四行消除(false, true);
          桥.硬降();
          次数++;
          if (次数 >= 21) clearInterval(Reflect.get(window, "__性能驱动"));
          Reflect.set(window, "__硬降次数", 次数);
        };
        一拍();
        Reflect.set(window, "__性能驱动", setInterval(一拍, 500));
      }),
    );
    const 驱动结果 = await 页.evaluate(() => {
      const 句柄 = Reflect.get(window, "__性能驱动");
      if (句柄) clearInterval(句柄 as ReturnType<typeof setInterval>);
      return {
        次数: (Reflect.get(window, "__硬降次数") as number) ?? 0,
        阶段: window.__再消一行测试__?.读取状态()?.阶段 ?? null,
      };
    });
    const 列表 = 驱动结果.次数;
    const 对局统计 = await 读引擎统计(页, 引擎);

    assert.equal(驱动结果.次数, 21, "压力场景操作次数必须一致");
    assert.equal(驱动结果.阶段, "进行中", "压力场景必须保持对局进行中");
    console.log(`已跑 ${视口.标签} ${引擎}`);
    return {
      启动,
      就绪毫秒,
      菜单,
      菜单统计,
      商店,
      商店统计,
      对局,
      对局统计,
      硬降次数: 列表,
      结束阶段: 驱动结果.阶段,
    };
  } finally {
    await 页.context().close();
  }
}

function 仓库指纹(路径: string) {
  const 读 = (...参数: string[]) =>
    execFileSync("git", ["-C", 路径, ...参数], { encoding: "utf8" });
  return {
    HEAD: 读("rev-parse", "HEAD").trim(),
    改动SHA256: createHash("sha256").update(读("diff", "HEAD")).digest("hex"),
    状态: 读("status", "--porcelain=v1", "-uall"),
  };
}
const 元数据 = {
  浏览器: 浏览器.version(),
  系统: platform() + " " + release(),
  CPU: cpus()[0]?.model,
  Bun: Bun.version,
  时间: new Date().toISOString(),
  轮次,
  并发: 1,
  脚本SHA256: createHash("sha256")
    .update(await readFile(import.meta.filename))
    .digest("hex"),
  游戏: 仓库指纹(process.cwd()),
  GM: 仓库指纹(resolve("../../projects/GameMaker-v2")),
  参数: { 三地址, 对照地址, 仅, 诊断: "perf-debug", 视口组, 硬降间隔: 500, 硬降上限: 21 },
};
try {
  for (const 视口 of 视口组) {
    for (let 轮 = 1; 轮 <= 轮次; 轮++) {
      const 顺序: 引擎[] = 轮 % 2 ? ["three", "phaser"] : ["phaser", "three"];
      for (const 引擎 of 顺序) {
        try {
          const 结果 = await 跑一局(引擎, 视口);
          记录.push({ 视口: 视口.标签, 引擎, 轮次: 轮, 成功: true, ...结果 });
        } catch (错误) {
          记录.push({ 视口: 视口.标签, 引擎, 轮次: 轮, 成功: false, 错误: String(错误) });
        }
      }
    }
  }
} finally {
  await 浏览器.close();
  await writeFile(
    join(输出, "性能对照.json"),
    JSON.stringify(
      {
        环境: "Chromium模拟视口，不是真机；同机同诊断配置，串行交错采样",
        元数据,
        页面错误,
        记录,
      },
      null,
      2,
    ),
  );
}
const 汇总 = [];
for (const 视口 of 视口组) {
  for (const 引擎 of ["three", "phaser"] as const) {
    const 成功组 = 记录.filter((项) => 项.视口 === 视口.标签 && 项.引擎 === 引擎 && 项.成功);
    for (const 场景 of ["菜单", "商店", "对局"] as const) {
      const 取值 = (项: Record<string, unknown>) =>
        项[场景] as Awaited<ReturnType<typeof 采样场景>>;
      汇总.push({
        视口: 视口.标签,
        引擎,
        场景,
        CPU毫秒: 汇总数值(成功组.map((项) => 取值(项).CPU毫秒)),
        实际渲染FPS: 汇总数值(成功组.map((项) => 取值(项).实际渲染.FPS)),
        JS堆字节: 汇总数值(成功组.map((项) => 取值(项).JS堆字节)),
      });
    }
  }
}
await writeFile(join(输出, "汇总.json"), JSON.stringify(汇总, null, 2));
assert.equal(页面错误.length, 0, "页面错误必须为空");
assert.equal(
  记录.filter((项) => 项.成功).length,
  视口组.length * 轮次 * 2,
  "有效样本不足，查看原始记录",
);
console.log("性能原始记录与汇总写出", 输出);
