import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { chromium, type Page } from "playwright";
import type {} from "../../代码/three版/启动";
import type {} from "../../代码/场景/对局/对局";

/**
 * 双版本性能对照：同一台机器、同一 Chromium、同一玩家路径与同一操作脚本，
 * 分别跑 Three 版与 Phaser 对照版，采样独立于引擎的 rAF 帧间隔 + 各引擎自带统计。
 *
 * 场景（每引擎 × 每个视口）：
 * - 启动：domcontentloaded → 测试桥就绪 → 首帧，记录加载耗时与传输字节；
 * - A 主界面菜单态 3s（静态 UI）；
 * - B 旅行商店 4s（重 UI：风景/牌面/目录/动效）；
 * - C 对局 10s：每 150ms 触发一次真实硬降（两版事件数一致），比较帧间隔/长帧/工作耗时。
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
          x: 画布.x + ((项.x + 项.width / 2) / 快照.width) * 画布.width,
          y: 画布.y + ((项.y + 项.height / 2) / 快照.height) * 画布.height,
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
      JS堆字节:
        (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory
          ?.usedJSHeapSize ?? null,
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

/** CDP Performance 指标：主线程任务总耗时（秒），跨引擎可比。 */
const CDP会话 = new WeakMap<
  Page,
  Awaited<ReturnType<Page["context"]>> extends never ? never : unknown
>();
async function 读CPU(页: Page): Promise<number> {
  const 已建 = CDP会话.get(页) as
    | { send: (方法: string, 参数?: object) => Promise<unknown> }
    | undefined;
  const 会话 =
    已建 ??
    ((await 页.context().newCDPSession(页)) as unknown as {
      send: (方法: string, 参数?: object) => Promise<unknown>;
    });
  if (!已建) {
    await 会话.send("Performance.enable");
    CDP会话.set(页, 会话);
  }
  const 结果 = (await 会话.send("Performance.getMetrics")) as {
    metrics: { name: string; value: number }[];
  };
  const 项 = 结果.metrics.find((项) => 项.name === "TaskDuration");
  return (项?.value ?? 0) * 1000;
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
  await 页.evaluate((引擎) => {
    if (引擎 === "phaser") {
      const 性能 = Reflect.get(window, "__GAMEMAKER_TEST__")?.性能 as
        | { 开始?: () => void }
        | undefined;
      性能?.开始?.();
    }
  }, 引擎);
  await 页.waitForTimeout(800);

  // A 主界面菜单态
  const 菜单CPU前 = await 读CPU(页);
  await 开始采样(页);
  await 页.waitForTimeout(3000);
  const 菜单 = await 结束采样(页);
  const 菜单CPU后 = await 读CPU(页);
  const 菜单统计 = await 读引擎统计(页, 引擎);

  // B 旅行商店（重 UI）
  await 点(页, 引擎, 引擎 === "three" ? "商店" : "menu.shop");
  await 页.waitForTimeout(600);
  const 商店CPU前 = await 读CPU(页);
  await 开始采样(页);
  await 页.waitForTimeout(4000);
  const 商店 = await 结束采样(页);
  const 商店CPU后 = await 读CPU(页);
  const 商店统计 = await 读引擎统计(页, 引擎);

  // C 对局：同一脚本每 150ms 硬降一次，跑 10s
  await 页.reload({ waitUntil: "domcontentloaded" });
  await 页.waitForFunction((键) => Reflect.has(window, 键), 桥类型, { timeout: 20000 });
  await 页.waitForTimeout(600);
  await 点(页, 引擎, 引擎 === "three" ? "开始游戏" : "menu.start");
  await 点(页, 引擎, 引擎 === "three" ? "开始:马拉松" : "mode.马拉松");
  await 页.waitForFunction(() => Boolean(window.__再消一行测试__), null, { timeout: 20000 });
  await 页.evaluate((引擎) => {
    if (引擎 === "phaser") {
      const 性能 = Reflect.get(window, "__GAMEMAKER_TEST__")?.性能 as
        | { 开始?: () => void }
        | undefined;
      性能?.开始?.();
    }
  }, 引擎);
  await 页.evaluate(() => window.__再消一行测试__?.设置序列(["T", "I", "O", "S", "Z", "J", "L"]));
  await 页.waitForTimeout(500);
  const 开始CPU = await 读CPU(页);
  await 开始采样(页);
  await 页.evaluate(() => {
    const 桥 = window.__再消一行测试__;
    if (!桥) throw new Error("对局桥缺失");
    let 次数 = 0;
    const 一拍 = () => {
      桥.准备四行消除(false, true);
      桥.硬降();
      次数++;
      Reflect.set(window, "__硬降次数", 次数);
    };
    一拍();
    Reflect.set(window, "__性能驱动", setInterval(一拍, 500));
  });
  await 页.waitForTimeout(10000);
  const 驱动结果 = await 页.evaluate(() => {
    const 句柄 = Reflect.get(window, "__性能驱动");
    if (句柄) clearInterval(句柄 as ReturnType<typeof setInterval>);
    return {
      次数: (Reflect.get(window, "__硬降次数") as number) ?? 0,
      阶段: window.__再消一行测试__?.读取状态()?.阶段 ?? null,
    };
  });
  const 结束CPU = await 读CPU(页);
  const 列表 = 驱动结果.次数;
  const 对局 = await 结束采样(页);
  const 对局统计 = await 读引擎统计(页, 引擎);

  await 页.close();
  console.log(`已跑 ${视口.标签} ${引擎}`);
  return {
    启动,
    就绪毫秒,
    菜单: { ...菜单, CPU毫秒: 菜单CPU后 - 菜单CPU前 },
    菜单统计,
    商店: { ...商店, CPU毫秒: 商店CPU后 - 商店CPU前 },
    商店统计,
    对局: { ...对局, CPU毫秒: 结束CPU - 开始CPU },
    对局统计,
    硬降次数: 列表,
    结束阶段: 驱动结果.阶段,
  };
}

for (const 视口 of 视口组) {
  for (const 引擎 of ["three", "phaser"] as const) {
    try {
      const 结果 = await 跑一局(引擎, 视口);
      记录.push({ 视口: 视口.标签, 引擎, ...结果 });
    } finally {
      // 每局独立页面，异常也继续下一组；错误汇总在 finally 后写出。
    }
  }
}

await 浏览器.close();
await writeFile(
  join(输出, "性能对照.json"),
  JSON.stringify(
    {
      环境: "Chromium 无头模拟视口，不是真机；两版同机同浏览器、同路径、同操作脚本",
      页面错误,
      记录,
    },
    null,
    2,
  ),
  "utf8",
);
console.log(`页面错误 ${页面错误.length} 条`);
console.log("写出", join(输出, "性能对照.json"));
