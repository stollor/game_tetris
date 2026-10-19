/** biome-ignore-all lint/style/noNonNullAssertion: 本地测试桥存在已通过 waitForFunction 验证。 */
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";

const 输出 = "测试/视觉快照/落块体验";
await mkdir(输出, { recursive: true });
const 音频构建 = await Bun.build({
  entrypoints: ["代码/音频/再消一行程序音频.ts"],
  target: "browser",
});
if (!音频构建.success) throw new Error(String(音频构建.logs));
const 音频脚本 = await 音频构建.outputs[0]!.text();
const browser = await chromium.launch();
const 错误: string[] = [];
const 结果: unknown[] = [];
function check(ok: unknown, 名: string): asserts ok {
  if (!ok) throw new Error(名);
  console.log(`通过：${名}`);
}
try {
  for (const [width, height] of [
    [1280, 720],
    [375, 667],
    [844, 390],
  ] as const) {
    const page = await browser.newPage({
      viewport: { width: width!, height: height! },
      recordVideo: { dir: 输出 },
    });
    page.on("pageerror", (e) => 错误.push(e.message));
    await page.addInitScript(() => {
      localStorage.setItem(
        "gamemaker:settings",
        JSON.stringify({ 样式: "夜空鎏金", 音效音量: 0.8, 音乐音量: 0, 语言: "简体中文" }),
      );
      const 原创建 = AudioContext.prototype.createOscillator;
      (window as unknown as { 发声音符: number }).发声音符 = 0;
      AudioContext.prototype.createOscillator = function () {
        (window as unknown as { 发声音符: number }).发声音符++;
        return 原创建.call(this);
      };
    });
    await page.goto(process.argv[2] ?? "http://localhost:3220");
    await page.waitForFunction(
      () => window.__GAMEMAKER_TEST__?.getSnapshot().sceneId === "开始菜单",
    );
    const click = async (name: string) => {
      const b = await page.evaluate(
        (name) =>
          window.__GAMEMAKER_TEST__
            ?.getSnapshot()
            .interactives.find((o) => o.name === name && o.visible)?.bounds,
        name,
      );
      check(b, name);
      await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
    };
    const ui = () => page.evaluate(() => window.__再消一行测试__!.读取界面());
    const state = () => page.evaluate(() => window.__再消一行测试__!.读取状态());
    const shot = (名: string) => page.screenshot({ path: `${输出}/${width}x${height}-${名}.png` });
    await click("menu.start");
    await click("mode.马拉松");
    await page.waitForFunction(() => Boolean(window.__再消一行测试__));
    await page.evaluate(() => window.__再消一行测试__!.设置序列(["T", "I", "O", "J"]));
    await page.keyboard.press("ArrowUp");
    check((await state()).当前朝向 === 3 && (await state()).暂存方块 === null, "短按 ↑ 只旋转");
    await page.keyboard.down("ArrowUp");
    await page.waitForFunction(() => window.__再消一行测试__!.读取状态().暂存方块 === "T");
    check((await state()).当前方块 === "I", "长按 ↑ 暂存");
    await page.keyboard.press("Space");
    await page.waitForTimeout(650);
    check(
      (await state()).当前方块 === "O" && !(await state()).本块已暂存,
      "按住 ↑ 跨落块不再次触发",
    );
    await page.keyboard.up("ArrowUp");
    if (width === 375) {
      await page.evaluate(() => window.__再消一行测试__!.设置序列(["T", "I", "O"]));
      const b = await page.evaluate(
        () =>
          window
            .__GAMEMAKER_TEST__!.getSnapshot()
            .interactives.find((o) => o.name === "touch.rotate")!.bounds,
      );
      check(b, "手机 ↑ 按钮存在");
      await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
      await page.mouse.down();
      await page.waitForFunction(() => window.__再消一行测试__!.读取状态().暂存方块 === "T");
      await page.mouse.up();
      check((await state()).当前方块 === "I", "手机长按 ↑ 同样暂存");
    }
    await page.evaluate(() => window.__再消一行测试__!.设置序列(["T", "I", "O"]));
    await page.keyboard.down("ArrowUp");
    await page.keyboard.press("p");
    await page.waitForTimeout(600);
    await page.keyboard.up("ArrowUp");
    await page.keyboard.press("p");
    check((await state()).暂存方块 === null, "暂停取消长按计时");
    await page.evaluate(() => window.__再消一行测试__!.设置序列(["I", "O"]));
    await page.keyboard.press("Space");
    await shot("柔光拖尾");
    // 首次四行保留一格，明确排除全清/连击音效替代的假阳性。
    await page.evaluate(() => {
      window.__再消一行测试__!.准备四行消除(false, true);
      (window as unknown as { 发声音符: number }).发声音符 = 0;
    });
    const 初 = await page.evaluate(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { code: "Space" }));
      window.dispatchEvent(new KeyboardEvent("keyup", { code: "Space" }));
      return window.__再消一行测试__!.读取界面();
    });
    check(
      初.技巧反馈.includes("四连消") && !初.技巧反馈.includes("完美清场"),
      "首次四行未全清的真实棋盘",
    );
    check(初.音效事件.at(-1)?.名称 === "再消一行.四行", "首次四行独立音效实际派发");
    check(
      await page.evaluate(() => {
        const 数量 = (window as unknown as { 发声音符: number }).发声音符;
        return 数量 >= 1 && 数量 <= 32;
      }),
      "四行奖励复用常驻声部，不再按音符新建振荡器",
    );
    check(
      初.消行特效?.碎片数 === 0 && 初.消行特效?.四行庆祝 === true && 初.震屏?.强度 === 7 && Math.abs(初.震屏?.y) >= 6,
      "四行光带庆祝与真实镜头位移",
    );
    await shot("四行冲击");
    const 帧: (typeof 初.震屏)[] = [初.震屏];
    for (const 名 of ["震屏衰减", "金色扫光"]) {
      await page.waitForTimeout(90);
      帧.push((await ui()).震屏);
      await shot(名);
    }
    check(
      帧.some((e) => e && e.y !== 初.震屏?.y),
      "镜头在后续帧持续震动",
    );
    await page.evaluate(() => window.__再消一行测试__!.准备四行消除());
    await page.evaluate(() => {
      for (const code of ["Space", "KeyP"]) {
        window.dispatchEvent(new KeyboardEvent("keydown", { code }));
        window.dispatchEvent(new KeyboardEvent("keyup", { code }));
      }
    });
    const 暂停 = await ui();
    check((暂停.震屏?.剩余 ?? 0) > 0 && 暂停.消行特效?.活跃, "暂停发生在效果活跃期间");
    await page.waitForTimeout(250);
    check(
      (await ui()).震屏?.剩余 === 暂停.震屏?.剩余 &&
        (await ui()).消行特效?.时间 === 暂停.消行特效?.时间,
      "暂停冻结震屏和消行计时",
    );
    await page.keyboard.press("p");
    await page.waitForFunction(() => window.__再消一行测试__!.读取界面().震屏?.剩余 === 0);
    const 结束 = await ui();
    check(结束.震屏?.x === 0 && 结束.震屏.y === 0, "震屏结束归零");
    await page.evaluate(() => window.__再消一行测试__!.准备四行消除());
    await page.keyboard.press("Space");
    const 全清 = await ui();
    check(
      全清.音效事件.slice(-3).some((e) => e.名称 === "再消一行.四行") &&
        全清.音效事件.at(-1)?.名称 === "再消一行.全清",
      "四行全清保留两层奖励",
    );
    await shot("四行全清");
    await page.evaluate(() => window.__再消一行测试__!.设置序列(["T", "I"]));
    const 清理 = await ui();
    check(
      清理.震屏?.剩余 === 0 &&
        清理.震屏.y === 0 &&
        !清理.消行特效?.活跃 &&
        !清理.落块特效?.硬降拖尾,
      "重开清空镜头和所有效果",
    );
    结果.push({ width, height, 镜头采样: 帧, 初次四行: 初.技巧反馈 });
    if (width === 1280) {
      await page.route("**/audio-probe.js", (route) =>
        route.fulfill({ body: 音频脚本, contentType: "text/javascript" }),
      );
      for (const 名 of ["硬降", "锁定", "消行", "四行"] as const) {
        const 样本 = await page.evaluate(async (名) => {
          const 路径 = "/audio-probe.js";
          const 模块 = await import(路径);
          const ctx = new OfflineAudioContext(1, 44100, 44100);
          const gain = ctx.createGain();
          gain.connect(ctx.destination);
          模块.播放合成音效({ 上下文: ctx, 音效输出: gain, 音乐输出: gain }, 名, 1);
          return Array.from((await ctx.startRendering()).getChannelData(0));
        }, 名);
        const 峰值 = Math.max(...样本.map(Math.abs));
        check(峰值 > 0.01 && 峰值 < 0.95, `${名} 实际音频非静音且无削波`);
        const wav = Buffer.alloc(44 + 样本.length * 2);
        wav.write("RIFF");
        wav.writeUInt32LE(wav.length - 8, 4);
        wav.write("WAVEfmt ", 8);
        wav.writeUInt32LE(16, 16);
        wav.writeUInt16LE(1, 20);
        wav.writeUInt16LE(1, 22);
        wav.writeUInt32LE(44100, 24);
        wav.writeUInt32LE(88200, 28);
        wav.writeUInt16LE(2, 32);
        wav.writeUInt16LE(16, 34);
        wav.write("data", 36);
        wav.writeUInt32LE(样本.length * 2, 40);
        样本.forEach((s, i) => {
          wav.writeInt16LE(Math.round(s * 32767), 44 + i * 2);
        });
        await writeFile(`${输出}/${名}.wav`, wav);
        结果.push({ 音效: 名, 峰值 });
      }
    }
    await page.close();
  }
  check(错误.length === 0, `无运行错误：${错误.join()}`);
  await writeFile(`${输出}/验收数据.json`, JSON.stringify(结果, null, 2));
} finally {
  await browser.close();
}
