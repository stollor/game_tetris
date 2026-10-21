import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import type Phaser from "phaser";
import { chromium, type Page } from "playwright";
import type {} from "../../代码/three版/启动";
import type {} from "../../代码/场景/对局/对局";

// Chromium 模拟视口；以独立浏览器上下文隔离玩家存档，串行采集避免失焦干扰。
const 输出 = resolve(process.argv[2] ?? "reports/视觉返工/复刻对照");
// 端口可覆盖：复核脚本在不打扰在跑服务时可另起 3010 验收。
const 端口 = {
  three: Number(process.env.THREE_PORT ?? 3000),
  phaser: Number(process.env.PHASER_PORT ?? 3220),
};
const 基线 = process.argv.includes("--基线");
const 仅手机 = process.argv.includes("--仅手机");
const 指定组合 = process.argv.find((项) => 项.startsWith("--仅="))?.slice("--仅=".length);
const 候选组合 = 仅手机
  ? [
      [390, 844, 1],
      [390, 844, 2],
      [390, 844, 3],
    ]
  : [
      [390, 844, 1],
      [390, 844, 2],
      [390, 844, 3],
      [430, 860, 1],
      [430, 860, 2],
      [1280, 720, 1],
      [1280, 720, 2],
    ];
const 组合 = 指定组合
  ? 候选组合.filter(([宽, 高, 倍率]) => 指定组合.split(",").includes(`${宽}x${高}@${倍率}`))
  : 候选组合;
assert.ok(组合.length > 0, "--仅 没有匹配的视口，示例：--仅=390x844@1,1280x720@1");
await mkdir(输出, { recursive: true });
const 浏览器 = await chromium.launch({ channel: "chrome" });
const 记录: object[] = [];
const 错误: string[] = [];

async function 点击(页: Page, 引擎: string, 名称: string) {
  const 框 = await 页.evaluate(
    ({ 引擎, 名称 }) => {
      if (引擎 === "three") {
        const 项 = window.__three版__
          ?.读取界面()
          .按钮.find((项) => 项.名称 === 名称 && 项.可用 !== false);
        if (项) return { x: 项.左, y: 项.上, width: 项.宽, height: 项.高 };
      } else {
        const 快照 = window.__GAMEMAKER_TEST__?.getSnapshot();
        const 框 = 快照?.interactives.find(
          (项) => 项.name === 名称 && 项.visible && 项.enabled,
        )?.bounds;
        const 画布 = document.querySelector("canvas")?.getBoundingClientRect();
        if (快照 && 框 && 画布)
          return {
            x: 画布.x + (框.x / 快照.width) * 画布.width,
            y: 画布.y + (框.y / 快照.height) * 画布.height,
            width: (框.width / 快照.width) * 画布.width,
            height: (框.height / 快照.height) * 画布.height,
          };
      }
      return null;
    },
    { 引擎, 名称 },
  );
  assert.ok(框, `${引擎} 缺少 ${名称}`);
  const 视口 = 页.viewportSize();
  assert.ok(视口);
  if (!基线)
    assert.ok(
      框.x >= -1 &&
        框.y >= -1 &&
        框.x + 框.width <= 视口.width + 1 &&
        框.y + 框.height <= 视口.height + 1,
      `${引擎} ${名称} 越界 ${JSON.stringify(框)}`,
    );
  const 缩放X = 基线 && 引擎 === "three" ? 视口.width / 390 : 1;
  const 缩放Y = 基线 && 引擎 === "three" ? 视口.height / 844 : 1;
  await 页.mouse.click((框.x + 框.width / 2) * 缩放X, (框.y + 框.height / 2) * 缩放Y);
  await 页.waitForTimeout(160);
}

try {
  for (const [宽, 高, 像素比] of 组合) {
    assert.ok(宽 && 高 && 像素比);
    for (const 引擎 of ["phaser", "three"]) {
      const 标签 = `${宽}x${高}-DPR${像素比}-${引擎}`;
      const 目录 = join(输出, 标签);
      await mkdir(目录, { recursive: true });
      const 页 = await 浏览器.newPage({
        viewport: { width: 宽, height: 高 },
        deviceScaleFactor: 像素比,
      });
      页.on("pageerror", (错) => 错误.push(`${标签}: ${错.message}`));
      页.on("console", (项) => {
        if (项.type() === "error") 错误.push(`${标签}: ${项.text()}`);
      });
      await 页.addInitScript(() =>
        localStorage.setItem(
          "再消一行:设置",
          JSON.stringify({ 背景动态: false, 音乐音量: 0, 音效音量: 0 }),
        ),
      );
      await 页.goto(`http://127.0.0.1:${引擎 === "three" ? 端口.three : 端口.phaser}/?perf-debug`);
      await 页.waitForFunction(
        (引擎) => (引擎 === "three" ? !!window.__three版__ : !!window.__GAMEMAKER_TEST__),
        引擎,
        { timeout: 20000 },
      );
      const 采集 = async (名称: string) => {
        await 页.waitForTimeout(350);
        const 数据 = await 页.evaluate(
          (引擎) =>
            引擎 === "three"
              ? {
                  状态: window.__three版__?.读取状态(),
                  界面: window.__three版__?.读取界面(),
                  统计: window.__three版__?.读取统计(),
                }
              : { 界面: window.__GAMEMAKER_TEST__?.getSnapshot("完整") },
          引擎,
        );
        if (!基线 && 引擎 === "three" && "统计" in 数据) {
          const 统计 = 数据.统计;
          assert.ok(统计);
          assert.equal(统计.画布.宽, 宽 * 像素比, `${标签} 画布物理宽`);
          assert.equal(统计.画布.高, 高 * 像素比, `${标签} 画布物理高`);
          assert.ok(统计.渲染.纹理峰值字节 <= 32 * 1024 * 1024, `${标签} 纹理峰值超32MB`);
          assert.equal(统计.图元.丢弃数, 0, `${标签} 图元丢弃`);
          // 字形按 max(画布像素比, 2) 光栅：DPR1 也按 2x，与 Phaser 文字最低分辨率同口径。
          const 期望光栅像素比 = Math.max(像素比 ?? 1, 2);
          for (const 图集 of 统计.文字图集.图集列表) {
            if (图集.字重 !== "基础")
              assert.ok(
                图集.键.endsWith(`|${期望光栅像素比}`),
                `${标签} 字形光栅倍率错误 ${图集.键}`,
              );
          }
        }
        await 页.screenshot({ path: join(目录, `${名称}.png`) });
        记录.push({ 标签, 名称, ...数据 });
      };
      await 采集("A-主界面");
      await 点击(页, 引擎, 引擎 === "three" ? "开始游戏" : "menu.start");
      await 采集("B-模式选择");
      if (!基线) {
        await 点击(页, 引擎, 引擎 === "three" ? "开始:马拉松" : "mode.马拉松");
        await 页.waitForFunction(() => !!window.__再消一行测试__);
        await 页.evaluate(() =>
          window.__再消一行测试__?.设置序列(["T", "I", "O", "S", "Z", "J", "L"]),
        );
        await 采集("C-对局");
        await 页.evaluate(() => window.__再消一行测试__?.设置暂停(true));
        await 采集("D-暂停");
        await 页.evaluate(() => {
          window.__再消一行测试__?.设置暂停(false);
          window.__再消一行测试__?.准备结算(false);
        });
        await 页.waitForTimeout(1200);
        await 采集("E-结算");
        if (引擎 === "three") {
          await 点击(页, 引擎, "返回主菜单");
          const 菜单态 = await 页.evaluate(() =>
            window.__three版__?.读取界面().按钮.some((项) => 项.名称 === "开始游戏"),
          );
          if (菜单态) await 点击(页, 引擎, "开始游戏");
        }
      }
      if (引擎 === "phaser") {
        for (const [键, 名称] of [
          ["设置界面", "F-设置"],
          ["成就界面", "G-成就"],
          ["排行榜界面", "H-排行榜"],
          ["旅行商店", "I-商店"],
        ]) {
          await 页.evaluate((键) => {
            const 游戏 = Reflect.get(window, "__游戏__") as Phaser.Game | undefined;
            if (!游戏) throw new Error("缺少Phaser场景入口");
            for (const 场景 of 游戏.scene.getScenes(false)) 游戏.scene.stop(场景.scene.key);
            游戏.scene.start(键);
          }, 键);
          await 采集(名称 ?? "未知");
        }
      } else {
        await 点击(页, 引擎, "返回");
        for (const [页面, 名称] of [
          ["设置", "F-设置"],
          ["成就", "G-成就"],
          ["商店", "I-商店"],
        ]) {
          await 点击(页, 引擎, 页面 ?? "未知");
          await 采集(名称 ?? "未知");
          await 点击(页, 引擎, "返回主菜单");
        }
        await 点击(页, 引擎, "开始游戏");
        await 点击(页, 引擎, "排行榜:马拉松");
        await 采集("H-排行榜");
      }
      await 页.close();
      console.log(`已采集 ${标签}`);
    }
  }
  await writeFile(
    join(输出, "结果.json"),
    JSON.stringify({ 环境: "Chromium模拟视口，不是真机", 基线, 错误, 记录 }, null, 2),
  );
  assert.deepEqual(错误, []);
} finally {
  await 浏览器.close();
}
