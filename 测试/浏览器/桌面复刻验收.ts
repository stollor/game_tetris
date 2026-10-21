import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { chromium, type Page } from "playwright";
import type {} from "../../代码/three版/启动";
import type {} from "../../代码/场景/对局/对局";

/**
 * 桌面复刻验收：以 1280×720 为基准视口，用**同一套玩家操作路径**（主界面角钮/模式卡开覆盖页，
 * 而不是直接切场景）分别采集 Phaser 与 Three 的九个页面，逐像素比较并给出「显著差异占比」。
 *
 * 判据（默认）：每页每 DPR 的显著差异像素占比 ≤ 5%（即复刻度 ≥ 95%）。
 * 差异定义与 `reports/视觉返工/对照.ts` 一致：任一通道差 > 8 计为显著差异像素。
 *
 * 用法：
 *   bun 测试/浏览器/桌面复刻验收.ts [输出目录] [--DPR=1,2] [--门槛=5]
 * 证据：<输出目录>/<DPR>-<页面>-phaser|three.png、<DPR>-对照-<页面>.png、<DPR>-差异-<页面>.png、结果.json
 * 环境：Chromium 模拟视口，不是真机验收。
 */

const 输出 = resolve(process.argv[2] ?? "reports/视觉返工/桌面复刻");
const 门槛参数 = process.argv.find((项) => 项.startsWith("--门槛="));
const 门槛 = Number(门槛参数?.split("=")[1] ?? 5);
const DPR参数 = process.argv.find((项) => 项.startsWith("--DPR="));
const DPR列表 = (DPR参数?.split("=")[1] ?? "1,2")
  .split(",")
  .map((项) => Number(项))
  .filter((项) => Number.isFinite(项) && 项 > 0);
const 三地址 =
  process.argv.find((项) => 项.startsWith("--three="))?.split("=")[1] ?? "http://127.0.0.1:3000";
const 对照地址 =
  process.argv.find((项) => 项.startsWith("--phaser="))?.split("=")[1] ?? "http://127.0.0.1:3220";
const 宽 = 1280;
const 高 = 720;
await mkdir(输出, { recursive: true });

const 页面表 = [
  { 键: "A-主界面", 动作: "初始" },
  { 键: "B-模式选择", 动作: "开始游戏" },
  { 键: "C-对局", 动作: "开始:马拉松" },
  { 键: "D-暂停", 动作: "暂停" },
  { 键: "E-结算", 动作: "结算" },
  { 键: "F-设置", 动作: "设置" },
  { 键: "G-成就", 动作: "成就" },
  { 键: "H-排行榜", 动作: "排行榜" },
  { 键: "I-商店", 动作: "商店" },
] as const;

type 引擎 = "phaser" | "three";
type 截图 = { 引擎: 引擎; 页面: string; DPR: number; 数据: Buffer };

const 浏览器 = await chromium.launch({ channel: "chrome" });
const 错误: string[] = [];
const 截图表: 截图[] = [];
const 记录: {
  DPR: number;
  页面: string;
  平均通道差: number;
  显著差异占比: number;
  通过: boolean;
}[] = [];

/** 按名称点真实按钮：Three 走界面快照，Phaser 走测试桥交互坐标。 */
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
  const 视口 = 页.viewportSize();
  assert.ok(视口);
  if (引擎 === "three")
    assert.ok(
      框.x >= -1 &&
        框.y >= -1 &&
        框.x + 框.width <= 视口.width + 1 &&
        框.y + 框.height <= 视口.height + 1,
      `three ${名称} 越界 ${JSON.stringify(框)}`,
    );
  await 页.mouse.click(框.x + 框.width / 2, 框.y + 框.height / 2);
  await 页.waitForTimeout(160);
}

async function 回主界面(页: Page, 引擎: 引擎): Promise<void> {
  if (引擎 === "three") {
    for (let 轮 = 0; 轮 < 4; 轮++) {
      const 界面 = await 页.evaluate(() => window.__three版__?.读取界面());
      if (界面?.按钮.some((项) => 项.名称 === "设置")) return;
      if (界面?.按钮.some((项) => 项.名称 === "返回主菜单")) {
        await 点(页, 引擎, "返回主菜单");
        continue;
      }
      if (界面?.按钮.some((项) => 项.名称 === "返回")) {
        await 点(页, 引擎, "返回");
        continue;
      }
      throw new Error(`three 无法回到主界面：${JSON.stringify(界面?.按钮.map((项) => 项.名称))}`);
    }
    return;
  }
  await 页.evaluate(() => {
    const 游戏 = (window as unknown as { __游戏__?: Phaser.Game }).__游戏__;
    if (!游戏) throw new Error("缺少 Phaser 场景入口");
    for (const 场景 of 游戏.scene.getScenes(false)) 游戏.scene.stop(场景.scene.key);
    游戏.scene.start("开始菜单");
  });
  await 页.waitForTimeout(450);
}

const 采 = async (页: Page, 引擎: 引擎, DPR: number, 页面: string) => {
  await 页.waitForTimeout(350);
  const 数据 = await 页.screenshot();
  截图表.push({ 引擎, 页面, DPR, 数据 });
  await writeFile(join(输出, `${DPR}-${页面}-${引擎}.png`), 数据);
};

for (const DPR of DPR列表) {
  for (const 引擎 of ["phaser", "three"] as const) {
    const 页 = await 浏览器.newPage({
      viewport: { width: 宽, height: 高 },
      deviceScaleFactor: DPR,
    });
    页.on("pageerror", (错) => 错误.push(`${DPR}-${引擎}: ${错.message}`));
    页.on("console", (项) => {
      if (项.type() === "error") 错误.push(`${DPR}-${引擎}: ${项.text()}`);
    });
    await 页.addInitScript(() =>
      localStorage.setItem(
        "再消一行:设置",
        JSON.stringify({ 背景动态: false, 音乐音量: 0, 音效音量: 0 }),
      ),
    );
    await 页.goto(`${引擎 === "three" ? 三地址 : 对照地址}/?perf-debug`, {
      waitUntil: "domcontentloaded",
    });
    await 页.waitForFunction(
      (引擎) => (引擎 === "three" ? !!window.__three版__ : !!window.__GAMEMAKER_TEST__),
      引擎,
      { timeout: 20000 },
    );
    await 页.waitForTimeout(500);

    // A 主界面菜单态
    await 采(页, 引擎, DPR, "A-主界面");
    // B 模式选择
    await 点(页, 引擎, 引擎 === "three" ? "开始游戏" : "menu.start");
    await 采(页, 引擎, DPR, "B-模式选择");
    // C 对局（固定方块序列，走真实开局）
    await 点(页, 引擎, 引擎 === "three" ? "开始:马拉松" : "mode.马拉松");
    await 页.waitForFunction(() => !!window.__再消一行测试__);
    await 页.evaluate(() => window.__再消一行测试__?.设置序列(["T", "I", "O", "S", "Z", "J", "L"]));
    await 采(页, 引擎, DPR, "C-对局");
    // D 暂停
    await 页.evaluate(() => window.__再消一行测试__?.设置暂停(true));
    await 采(页, 引擎, DPR, "D-暂停");
    // E 结算（等金币计数与重开锁动画结束，取稳定帧）
    await 页.evaluate(() => {
      window.__再消一行测试__?.设置暂停(false);
      window.__再消一行测试__?.准备结算(false);
    });
    await 页.waitForTimeout(2800);
    await 采(页, 引擎, DPR, "E-结算");

    // F/G/I：主界面角钮打开的覆盖页（同一玩家路径）
    for (const [动作, 页面, phaser名称] of [
      ["设置", "F-设置", "menu.settings"],
      ["成就", "G-成就", "menu.achievements"],
      ["商店", "I-商店", "menu.shop"],
    ] as const) {
      await 回主界面(页, 引擎);
      await 点(页, 引擎, 引擎 === "three" ? 动作 : phaser名称);
      await 采(页, 引擎, DPR, 页面);
    }
    // H 排行榜：模式卡右上角排行入口
    await 回主界面(页, 引擎);
    await 点(页, 引擎, 引擎 === "three" ? "开始游戏" : "menu.start");
    await 点(页, 引擎, 引擎 === "three" ? "排行榜:马拉松" : "mode.马拉松.leaderboard");
    await 采(页, 引擎, DPR, "H-排行榜");

    await 页.close();
    console.log(`已采集 DPR${DPR} ${引擎}`);
  }
}

// —— 逐页像素差异（在浏览器里用 canvas 计算，和 对照.ts 同口径）——
const 比较页 = await 浏览器.newPage({ viewport: { width: 1200, height: 900 } });
try {
  for (const DPR of DPR列表) {
    for (const { 键 } of 页面表) {
      const 甲 = 截图表.find((项) => 项.DPR === DPR && 项.页面 === 键 && 项.引擎 === "phaser");
      const 乙 = 截图表.find((项) => 项.DPR === DPR && 项.页面 === 键 && 项.引擎 === "three");
      assert.ok(甲 && 乙, `${DPR} ${键} 截图缺失`);
      const 差异 = await 比较页.evaluate(
        async ([甲B64, 乙B64]) => {
          const 载图 = (b64: string) =>
            new Promise<HTMLImageElement>((完成) => {
              const 图 = new Image();
              图.onload = () => 完成(图);
              图.src = `data:image/png;base64,${b64}`;
            });
          const [甲图, 乙图] = await Promise.all([载图(甲B64), 载图(乙B64)]);
          const 宽值 = Math.max(甲图.width, 乙图.width);
          const 高值 = Math.max(甲图.height, 乙图.height);
          const 取 = (图: HTMLImageElement) => {
            const 画布 = document.createElement("canvas");
            画布.width = 宽值;
            画布.height = 高值;
            const 上下文 = 画布.getContext("2d");
            if (!上下文) throw new Error("canvas 2d 不可用");
            上下文.drawImage(图, 0, 0);
            return 上下文.getImageData(0, 0, 宽值, 高值).data;
          };
          const 甲数据 = 取(甲图);
          const 乙数据 = 取(乙图);
          let 差和 = 0;
          let 显著数 = 0;
          for (let i = 0; i < 甲数据.length; i += 4) {
            const 差 =
              Math.abs((甲数据[i] ?? 0) - (乙数据[i] ?? 0)) +
              Math.abs((甲数据[i + 1] ?? 0) - (乙数据[i + 1] ?? 0)) +
              Math.abs((甲数据[i + 2] ?? 0) - (乙数据[i + 2] ?? 0));
            差和 += 差 / 3;
            if (差 > 24) 显著数++;
          }
          return {
            平均通道差: 差和 / (宽值 * 高值),
            显著差异占比: 显著数 / (宽值 * 高值),
          };
        },
        [甲.数据.toString("base64"), 乙.数据.toString("base64")] as const,
      );
      const 通过 = 差异.显著差异占比 * 100 <= 门槛;
      记录.push({ DPR, 页面: 键, ...差异, 通过 });
      // 并排对照 + 差异掩码（人眼复核用）
      await 比较页.evaluate(
        async ([甲B64, 乙B64]) => {
          const 载图 = (b64: string) =>
            new Promise<HTMLImageElement>((完成) => {
              const 图 = new Image();
              图.onload = () => 完成(图);
              图.src = `data:image/png;base64,${b64}`;
            });
          const [甲图, 乙图] = await Promise.all([载图(甲B64), 载图(乙B64)]);
          const 画布 = document.createElement("canvas");
          画布.width = 甲图.width + 乙图.width + 12;
          画布.height = Math.max(甲图.height, 乙图.height);
          const 上下文 = 画布.getContext("2d");
          if (!上下文) throw new Error("canvas 2d 不可用");
          上下文.fillStyle = "#111";
          上下文.fillRect(0, 0, 画布.width, 画布.height);
          上下文.drawImage(甲图, 0, 0);
          上下文.drawImage(乙图, 甲图.width + 12, 0);
          Reflect.set(window, "__对照图", 画布.toDataURL("image/png").split(",")[1] ?? "");
          const 掩码 = document.createElement("canvas");
          掩码.width = 甲图.width;
          掩码.height = 甲图.height;
          const 掩码上下文 = 掩码.getContext("2d");
          if (!掩码上下文) throw new Error("canvas 2d 不可用");
          掩码上下文.drawImage(甲图, 0, 0);
          const 甲像素 = 掩码上下文.getImageData(0, 0, 甲图.width, 甲图.height);
          const 乙上下文 = document.createElement("canvas");
          乙上下文.width = 乙图.width;
          乙上下文.height = 乙图.height;
          const 乙画布 = 乙上下文.getContext("2d");
          if (!乙画布) throw new Error("canvas 2d 不可用");
          乙画布.drawImage(乙图, 0, 0);
          const 乙像素 = 乙画布.getImageData(0, 0, 乙图.width, 乙图.height);
          for (let i = 0; i < 甲像素.data.length; i += 4) {
            const 差 =
              Math.abs((甲像素.data[i] ?? 0) - (乙像素.data[i] ?? 0)) +
              Math.abs((甲像素.data[i + 1] ?? 0) - (乙像素.data[i + 1] ?? 0)) +
              Math.abs((甲像素.data[i + 2] ?? 0) - (乙像素.data[i + 2] ?? 0));
            const 标记 = 差 > 24;
            甲像素.data[i] = 标记 ? 255 : 255;
            甲像素.data[i + 1] = 标记 ? 0 : 255;
            甲像素.data[i + 2] = 标记 ? 0 : 255;
            甲像素.data[i + 3] = 255;
          }
          掩码上下文.putImageData(甲像素, 0, 0);
          Reflect.set(window, "__掩码图", 掩码.toDataURL("image/png").split(",")[1] ?? "");
        },
        [甲.数据.toString("base64"), 乙.数据.toString("base64")] as const,
      );
      const 对照图 = await 比较页.evaluate(
        () => Reflect.get(window, "__对照图") as string | undefined,
      );
      const 掩码图 = await 比较页.evaluate(
        () => Reflect.get(window, "__掩码图") as string | undefined,
      );
      if (对照图)
        await writeFile(join(输出, `${DPR}-对照-${键}.png`), Buffer.from(对照图, "base64"));
      if (掩码图)
        await writeFile(join(输出, `${DPR}-差异-${键}.png`), Buffer.from(掩码图, "base64"));
      const 百分比 = (差异.显著差异占比 * 100).toFixed(2);
      console.log(
        `DPR${DPR} ${键}：显著差异 ${百分比}%（复刻度 ${(100 - 差异.显著差异占比 * 100).toFixed(2)}%）平均通道差 ${差异.平均通道差.toFixed(2)}`,
      );
    }
  }
} finally {
  await 比较页.close();
  await 浏览器.close();
  await writeFile(
    join(输出, "结果.json"),
    JSON.stringify(
      {
        环境: "Chromium模拟视口1280×720，不是真机",
        判据: `每页显著差异占比 ≤ ${门槛}%（复刻度 ≥ ${100 - 门槛}%）`,
        页面错误: 错误,
        记录,
      },
      null,
      2,
    ),
    "utf8",
  );
}

const 未通过 = 记录.filter((项) => !项.通过);
if (错误.length) throw new Error(`页面错误 ${错误.length} 条：${错误.slice(0, 3).join(" | ")}`);
if (未通过.length) {
  console.error(
    `未达 ${100 - 门槛}% 复刻：${未通过
      .map((项) => `DPR${项.DPR} ${项.页面} ${(项.显著差异占比 * 100).toFixed(2)}%`)
      .join("、")}`,
  );
  process.exit(1);
}
console.log(`桌面复刻验收通过：每页复刻度 ≥ ${100 - 门槛}%（模拟视口 1280×720）`);
