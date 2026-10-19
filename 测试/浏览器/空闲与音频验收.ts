import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import type Phaser from "phaser";
import { chromium } from "playwright";
import type {} from "../../代码/场景/对局/对局";
import { 读取测试快照 } from "../../框架/开发/浏览器测试操作";
import { 计算画布点击位置 } from "../../框架/开发/画布点击";

declare global {
  interface Window {
    __音频验收__: {
      上下文: AudioContext[];
      循环: Set<AudioBufferSourceNode>;
      空闲循环: Set<AudioBufferSourceNode>;
      输出: Set<AudioNode>;
      音符: number;
      读取音频?: NonNullable<Window["__再消一行测试__"]>["读取音频"];
    };
  }
}

const 地址 = process.argv[2] ?? "http://127.0.0.1:3221";
const 输出 = "reports/power-audit";
await mkdir(输出, { recursive: true });
const 浏览器 = await chromium.launch({ channel: "chrome" });
const 页 = await 浏览器.newPage({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 1,
  isMobile: true,
  hasTouch: true,
});
const 错误: string[] = [];
页.on("pageerror", (e) => {
  错误.push(e.message);
  console.error(e.message);
});

async function 点击(名称: string) {
  const 快照 = await 读取测试快照(页);
  const 按钮 = 快照.interactives.find((项) => 项.name === 名称 && 项.visible && 项.enabled);
  const 画布 = await 页.locator("canvas").first().boundingBox();
  assert.ok(按钮 && 画布, 名称);
  const 坐标 = 计算画布点击位置(按钮, 画布, { 宽度: 快照.width, 高度: 快照.height });
  await 页.touchscreen.tap(坐标.x, 坐标.y);
}

async function 数帧(毫秒 = 1200) {
  return 页.evaluate(async (毫秒) => {
    let 更新 = 0,
      渲染 = 0;
    const u = () => {
        更新++;
      },
      r = () => {
        渲染++;
      };
    const 游戏 = window.__游戏__;
    游戏.events.on("poststep", u).on("postrender", r);
    await new Promise((f) => setTimeout(f, 毫秒));
    游戏.events.off("poststep", u).off("postrender", r);
    return { 更新, 渲染 };
  }, 毫秒);
}

async function 音量(键: "music" | "ambient", 值: number) {
  await 页.evaluate(
    ({ 键, 值 }) => {
      const 根 = window.__游戏__.scene.getScene("设置界面");
      const 找 = (
        列表: Phaser.GameObjects.GameObject[],
      ): Phaser.GameObjects.GameObject | undefined => {
        for (const x of 列表) {
          if (x.name === `settings.${键}-volume.slider`) return x;
          if (x.type === "Container") {
            const 子 = 找((x as Phaser.GameObjects.Container).list);
            if (子) return 子;
          }
        }
      };
      const 滑块 = 找(根.children.list);
      if (!滑块) throw new Error("未找到实际音量滑块");
      滑块.emit("commit", 值);
    },
    { 键, 值 },
  );
}

async function 电平() {
  return 页.evaluate(async () => {
    const 数据 = window.__音频验收__;
    const ctx = 数据.上下文[0];
    if (!ctx) throw new Error("没有音频上下文");
    const 分析 = ctx.createAnalyser();
    for (const n of 数据.输出) n.connect(分析);
    const 样本 = new Float32Array(分析.fftSize);
    let 峰 = 0;
    for (let i = 0; i < 20; i++) {
      await new Promise((f) => setTimeout(f, 50));
      分析.getFloatTimeDomainData(样本);
      for (const x of 样本) 峰 = Math.max(峰, Math.abs(x));
    }
    for (const n of 数据.输出) {
      try {
        n.disconnect(分析);
      } catch {}
    }
    分析.disconnect();
    return 峰;
  });
}

try {
  await 页.addInitScript(() => {
    localStorage.setItem(
      "再消一行:设置",
      JSON.stringify({ 背景动态: false, 省电模式: "自动", 背景音效音量: 0 }),
    );
    const 数据 = {
      上下文: [] as AudioContext[],
      循环: new Set<AudioBufferSourceNode>(),
      空闲循环: new Set<AudioBufferSourceNode>(),
      输出: new Set<AudioNode>(),
      音符: 0,
    };
    window.__音频验收__ = 数据;
    const 原上下文 = window.AudioContext;
    window.AudioContext = class extends 原上下文 {
      constructor(选项?: AudioContextOptions) {
        super(选项);
        数据.上下文.push(this);
      }
      createGain() {
        const 节点 = super.createGain();
        数据.输出.add(节点);
        return 节点;
      }
    };
    const 原开始 = AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start = function (...参数) {
      if (this.loop) {
        数据.循环.add(this);
        this.addEventListener("ended", () => 数据.循环.delete(this));
      }
      return 原开始.apply(this, 参数);
    };
    const 原停止 = AudioBufferSourceNode.prototype.stop;
    AudioBufferSourceNode.prototype.stop = function (...参数) {
      数据.循环.delete(this);
      return 原停止.apply(this, 参数);
    };
    const 原音符 = OscillatorNode.prototype.start;
    OscillatorNode.prototype.start = function (...参数) {
      数据.音符++;
      return 原音符.apply(this, 参数);
    };
  });
  await 页.goto(`${地址}/?perf-debug`);
  await 页.waitForFunction(() => window.__GAMEMAKER_TEST__?.getSnapshot().sceneId === "开始菜单");
  console.log("菜单已启动");
  await 页.waitForTimeout(1800);
  const 菜单 = await 数帧();
  assert.ok(菜单.更新 <= 15, "菜单实际循环已休眠降频");
  const 重绘请求 = await 页.evaluate(async () => {
    const 游戏 = window.__游戏__;
    let 次数 = 0;
    const 计数 = () => {
      次数++;
    };
    游戏.events.on("poststep", 计数);
    // 框架的滚动惯性通过这个事件维持更新，不能在松手200ms后进入慢速节拍。
    const 请求 = setInterval(() => 游戏.events.emit("请求重绘"), 25);
    await new Promise((完成) => setTimeout(完成, 700));
    clearInterval(请求);
    游戏.events.off("poststep", 计数);
    return 次数;
  });
  assert.ok(重绘请求 > 25, "持续重绘请求保持高频更新");
  assert.equal(
    await 页.evaluate(() => window.__音频验收__.上下文.length),
    1,
    "静音菜单仅有 Phaser 的上下文",
  );
  await 点击("menu.start");
  await 页.waitForTimeout(500);
  await 点击("mode.马拉松");
  await 页.waitForFunction(() => Boolean(window.__再消一行测试__));
  console.log("已进入对局");
  await 页.evaluate(() => {
    window.__音频验收__.读取音频 = window.__再消一行测试__?.读取音频;
  });
  await 页.waitForTimeout(1200);
  const 玩法 = await 数帧();
  assert.ok(玩法.更新 > 45, "玩法恢复高频更新");
  assert.equal(
    await 页.evaluate(() => window.__音频验收__.上下文.length),
    1,
    "真实触摸和程序音效复用 Phaser 上下文",
  );
  assert.ok(await 页.evaluate(() => window.__音频验收__.音符 > 0), "真实操作已生成音符");
  await 页.keyboard.press("p");
  await 页.waitForTimeout(1500);
  const 暂停 = await 数帧();
  assert.ok(暂停.更新 <= 15 && 暂停.渲染 <= 4, "暂停不空转或持续重画");
  await 页.evaluate(() => {
    const s = window.__游戏__.scene.getScene("再消一行对局");
    s.tweens.add({
      targets: s.add.image(-50, -50, "__WHITE"),
      alpha: 0,
      duration: 500,
      paused: true,
    });
  });
  const 暂停补间 = await 数帧();
  assert.ok(暂停补间.渲染 <= 4, "暂停的补间不算活动动画");
  const 格子 = await 页.evaluate(() => window.__再消一行测试__?.读取状态().当前格子);
  await 页.keyboard.press("p");
  await 页.keyboard.press("ArrowLeft");
  const 移后 = await 页.evaluate(() => window.__再消一行测试__?.读取状态().当前格子);
  assert.notDeepEqual(移后, 格子, "休眠后立即响应按键");
  await 页.screenshot({ path: `${输出}/对局.png` });
  await 页.evaluate(() => {
    window.__游戏__.scene.stop("再消一行对局");
    window.__游戏__.scene.start("开始菜单");
  });
  await 页.waitForTimeout(1500);
  const 返回菜单 = await 数帧();
  assert.ok(返回菜单.更新 <= 15, "离开对局后清理高频标记");
  await 点击("menu.settings");
  await 页.waitForFunction(() => window.__GAMEMAKER_TEST__?.getSnapshot().sceneId === "设置界面");
  console.log("已进入设置");
  await 音量("music", 45);
  await 页.waitForFunction(
    () =>
      [...window.__音频验收__.循环].some(
        (源) => 源.context === window.__音频验收__.上下文[0] && (源.buffer?.duration ?? 0) > 1,
      ),
    undefined,
    { timeout: 10000 },
  );
  console.log(
    "音乐准备",
    await 页.evaluate(() => ({
      曲目: window.__再消一行音乐__?.(),
      实际: window.__音频验收__.读取音频?.(),
      循环: [...window.__音频验收__.循环].map((源) => ({
        离线: 源.context instanceof OfflineAudioContext,
        状态: 源.context.state,
        时长: 源.buffer?.duration,
      })),
    })),
  );
  const 音乐电平 = await 电平();
  assert.ok(音乐电平 > 0.0001, "音量提高后实际有音乐波形");
  console.log("音乐电平", 音乐电平);
  await 音量("music", 0);
  await 页.waitForTimeout(300);
  const 静音电平 = await 电平();
  assert.ok(静音电平 < 0.0001, "音乐归零后实际静音");
  await 页.evaluate(() => {
    // 音效复用池保留关闭音门的噪声源；环境声需与这些既有源区分。
    window.__音频验收__.空闲循环 = new Set(window.__音频验收__.循环);
  });
  await 音量("ambient", 45);
  console.log("已开启环境声");
  await 页.waitForFunction(() =>
    [...window.__音频验收__.循环].some((源) => !window.__音频验收__.空闲循环.has(源)),
  );
  const 环境电平 = await 电平();
  assert.ok(环境电平 > 0.0001, "环境声实际发声");
  await 页.evaluate(() => window.dispatchEvent(new Event("blur")));
  console.log("已失焦");
  await 页.waitForFunction(() =>
    [...window.__音频验收__.循环].every((源) => window.__音频验收__.空闲循环.has(源)),
  );
  await 页.evaluate(() => window.dispatchEvent(new Event("focus")));
  console.log("已恢复焦点");
  await 页.waitForFunction(() =>
    [...window.__音频验收__.循环].some((源) => !window.__音频验收__.空闲循环.has(源)),
  );
  await 音量("ambient", 0);
  await 页.waitForFunction(() =>
    [...window.__音频验收__.循环].every((源) => window.__音频验收__.空闲循环.has(源)),
  );
  const 读取声部 = () =>
    页.evaluate(() => {
      const 采集 = window.__GAMEMAKER_TEST__?.性能;
      if (!采集) throw new Error("缺少音频资源采集");
      return 采集
        .读取()
        .专项.filter((项) => 项.名称 === "程序声部在用" || 项.名称 === "程序声部空闲");
    });
  await 页.evaluate(() => window.__GAMEMAKER_TEST__?.性能?.开始());
  const 声部基线 = await 读取声部();
  const 切换回收 = [];
  for (let 次 = 0; 次 < 2; 次++) {
    const 前音符 = await 页.evaluate(() => window.__音频验收__.音符);
    await 音量("ambient", 45);
    // 等真实9.2秒环境点缀，覆盖其专属输出声部池，不能只检查风声循环。
    await 页.waitForFunction((前) => window.__音频验收__.音符 > 前, 前音符);
    await 音量("ambient", 0);
    await 页.waitForTimeout(1100);
    const 回收后 = await 读取声部();
    切换回收.push(回收后);
  }
  await writeFile(`${输出}/环境点缀回收.json`, JSON.stringify({ 声部基线, 切换回收 }, null, 2));
  for (const 回收后 of 切换回收) assert.deepEqual(回收后, 声部基线, "环境点缀关闭后释放专属声部池");
  await 页.evaluate(() => window.__GAMEMAKER_TEST__?.性能?.停止());
  await 页.evaluate(() => window.__游戏__.events.emit("hidden"));
  const 隐藏 = await 数帧();
  assert.equal(隐藏.更新, 0, "Phaser 隐藏事件停止空闲定时器");
  await 页.evaluate(() => window.__游戏__.events.emit("visible"));
  await 页.waitForTimeout(1400);
  const 恢复 = await 数帧();
  assert.ok(恢复.更新 > 0 && 恢复.更新 <= 15, "恢复可见后继续空闲节拍");
  assert.equal(
    await 页.evaluate(() => localStorage.getItem("再消一行:实测低端")),
    null,
    "主动空闲降频不误记为低端机",
  );
  assert.deepEqual(错误, []);
  await writeFile(
    `${输出}/交互与音频.json`,
    JSON.stringify(
      {
        菜单,
        重绘请求,
        玩法,
        暂停,
        暂停补间,
        返回菜单,
        隐藏,
        恢复,
        音乐电平,
        静音电平,
        环境电平,
        错误,
      },
      null,
      2,
    ),
  );
  console.log(
    "通过：空闲/玩法节拍、输入唤醒、暂停补间、单音频上下文、音乐及环境声波形、失焦清理和恢复。",
  );
} catch (错误) {
  console.log(
    await 页.evaluate(() => ({
      场景: window.__GAMEMAKER_TEST__?.getSnapshot().sceneId,
      音频: window.__音频验收__?.上下文.map((c) => c.state),
      循环: window.__音频验收__?.循环.size,
      输出: [...window.__音频验收__.输出].map((节点) => ({
        增益: 节点 instanceof GainNode ? 节点.gain.value : null,
        时间: 节点.context.currentTime,
      })),
      缓冲: [...window.__音频验收__.循环].map((源) => ({
        时长: 源.buffer?.duration,
        非零: 源.buffer?.getChannelData(0).some((值) => Math.abs(值) > 0.0001),
      })),
    })),
  );
  await 页.screenshot({ path: `${输出}/失败.png` });
  throw 错误;
} finally {
  await 浏览器.close();
}
