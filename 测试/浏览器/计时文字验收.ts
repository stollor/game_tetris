import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import type Phaser from "phaser";
import { chromium } from "playwright";
import { 准备页面 } from "./性能准备";
import { 准备自动游玩, 执行自动游玩, 验收自动游玩 } from "./方块自动游玩";

type 对局现场 = Phaser.Scene & {
  模式文字: Phaser.GameObjects.BitmapText;
  状态: { 有效用时: number; 阶段: string };
};
const 输出 = "reports/timer-text";
await mkdir(输出, { recursive: true });
const 浏览器 = await chromium.launch({ channel: "chrome" });
const 页 = await 浏览器.newPage({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 1,
  isMobile: true,
  hasTouch: true,
});
const 错误: string[] = [];
页.on("pageerror", (错) => 错误.push(错.message));
try {
  await 准备页面(页, process.env.GAME_URL ?? "http://127.0.0.1:3221", false);
  await 准备自动游玩(页, "冲刺");
  const 类型 = await 页.evaluate(() => {
    const 场景 = window.__游戏__.scene.getScene("再消一行对局") as 对局现场;
    return 场景.模式文字.type;
  });
  assert.equal(类型, "BitmapText");
  await 页.waitForFunction(() => {
    const 场景 = window.__游戏__.scene.getScene("再消一行对局") as 对局现场;
    return /^40L · \d+\.\d[05]s$/.test(场景.模式文字.text);
  });
  await 页.screenshot({ path: `${输出}/冲刺计时.png` });
  await 页.keyboard.press("p");
  const 暂停 = await 页.evaluate(() => {
    const 场景 = window.__游戏__.scene.getScene("再消一行对局") as 对局现场;
    return { 阶段: 场景.状态.阶段, 用时: 场景.状态.有效用时, 文本: 场景.模式文字.text };
  });
  assert.equal(暂停.阶段, "暂停");
  assert.equal(暂停.文本, `40L · ${(暂停.用时 / 1000).toFixed(2)}s`);
  await 页.waitForTimeout(250);
  assert.equal(
    await 页.evaluate(
      () => (window.__游戏__.scene.getScene("再消一行对局") as 对局现场).模式文字.text,
    ),
    暂停.文本,
  );
  const 更新 = await 页.evaluate(() => {
    const 游戏 = window.__游戏__;
    const 场景 = 游戏.scene.getScene("再消一行对局") as 对局现场;
    const 文字 = 场景.模式文字;
    const 渲染器 = 游戏.renderer as Phaser.Renderer.WebGL.WebGLRenderer;
    const gl = 渲染器.gl;
    const 原上传 = gl.texImage2D;
    let 上传 = 0;
    gl.texImage2D = new Proxy(原上传, {
      apply(方法, 接收者, 参数) {
        上传++;
        return Reflect.apply(方法, 接收者, 参数);
      },
    });
    try {
      for (let i = 0; i < 1000; i++) 文字.setText(`40L · ${(i * 0.05).toFixed(2)}s`);
      const 最长 = "40L · 12345.67s";
      文字.setText(最长);
      const 无缺字 = [...最长].every((字符) => Boolean(文字.fontData.chars[字符.charCodeAt(0)]));
      文字.setText(暂停文本(场景.状态.有效用时));
      return { 上传, 无缺字, 贴图数: 游戏.textures.getTextureKeys().length };
    } finally {
      gl.texImage2D = 原上传;
    }
    function 暂停文本(用时: number) {
      return `40L · ${(用时 / 1000).toFixed(2)}s`;
    }
  });
  assert.equal(更新.上传, 0, "计时内容变化不上传文字纹理");
  assert.equal(更新.无缺字, true);
  await 页.keyboard.press("p");
  await 执行自动游玩(页, 15);
  await 验收自动游玩(页, "完成");
  const 完成 = await 页.evaluate(() => {
    const 场景 = window.__游戏__.scene.getScene("再消一行对局") as 对局现场;
    return { 阶段: 场景.状态.阶段, 用时: 场景.状态.有效用时, 文本: 场景.模式文字.text };
  });
  assert.equal(完成.阶段, "结束");
  assert.equal(完成.文本, `40L · ${(完成.用时 / 1000).toFixed(2)}s`);
  await 页.screenshot({ path: `${输出}/完赛计时.png` });
  assert.deepEqual(错误, []);
  await writeFile(`${输出}/结果.json`, JSON.stringify({ 类型, 暂停, 更新, 完成, 错误 }, null, 2));
  console.log("计时图集、1000次更新零上传、暂停/结束精度、真实40行完赛通过");
} finally {
  await 浏览器.close();
}
