import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { chromium } from "playwright";
import { 地点皮肤表 } from "../../代码/框架配置/旅行地点";
import type { 播放程序噪声, 播放程序音符 } from "../../框架/音频/程序音频";
import type { 音乐条目 } from "../../框架/音频/音乐目录";
import type { 展开曲谱 } from "../../框架/音频/音乐编排";
import type { 音效条目 } from "../../框架/音频/音效目录";
import type { 演奏音效 } from "../../框架/音频/音效编排";

interface 审查模块 {
  音乐库: 音乐条目[];
  音效库: 音效条目[];
  演奏音效: typeof 演奏音效;
  展开曲谱: typeof 展开曲谱;
  播放程序音符: typeof 播放程序音符;
  播放程序噪声: typeof 播放程序噪声;
}
const 根 = join(import.meta.dir, "../.."),
  输出 = join(根, "reports/travel-audio"),
  入口 = join(根, ".gamemaker/旅行音频审查入口.ts");
await mkdir(输出, { recursive: true });
await Bun.write(
  入口,
  `export { 音乐库 } from "../代码/框架配置/音乐"; export { 音效库 } from "../代码/框架配置/音效"; export { 演奏音效 } from "../框架/音频/音效编排"; export { 展开曲谱 } from "../框架/音频/音乐编排"; export { 播放程序音符, 播放程序噪声 } from "../框架/音频/程序音频";`,
);
const 构建 = await Bun.build({ entrypoints: [入口], target: "browser" });
assert.ok(构建.success, String(构建.logs));
const 服务 = Bun.serve({
  hostname: "127.0.0.1",
  port: 0,
  fetch(请求) {
    return new URL(请求.url).pathname === "/probe.js"
      ? new Response(构建.outputs[0], { headers: { "Content-Type": "text/javascript" } })
      : new Response("<!doctype html><title>旅行音频验收</title>", {
          headers: { "Content-Type": "text/html" },
        });
  },
});
const 浏览器 = await chromium.launch({ channel: "chrome" });
const 数据 = [];
try {
  const 页 = await 浏览器.newPage();
  await 页.goto(服务.url.href);
  for (const 地点 of 地点皮肤表) {
    const 采样 = await 页.evaluate(async (名称) => {
      const 路径 = "/probe.js";
      const 模块: 审查模块 = await import(路径);
      const 曲目 = 模块.音乐库.find((项) => 项.id === `旅行.${名称}`);
      if (曲目?.类型 !== "曲谱") throw new Error("曲目缺失");
      const 时长 = (曲目.曲谱.每和弦秒 ?? 4) * 曲目.曲谱.和弦进行.length + 4;
      const 上下文 = new OfflineAudioContext(1, Math.ceil(时长 * 22050), 22050),
        总线 = 上下文.createGain();
      总线.connect(上下文.destination);
      const 环境 = { 上下文, 音乐输出: 总线, 音效输出: 总线 };
      const 乐段 = 模块.展开曲谱(曲目.曲谱);
      for (const 音 of 乐段.音符) 模块.播放程序音符(环境, { ...音, 声道: "音乐" });
      for (const 噪 of 乐段.噪声) 模块.播放程序噪声(环境, { ...噪, 声道: "音乐" });
      const 缓冲 = await 上下文.startRendering();
      const 音乐 = Array.from(缓冲.getChannelData(0));
      const 音效 = [];
      for (const 项 of 模块.音效库.filter((项) => 项.id.startsWith(`旅行.${名称}.`))) {
        if (项.类型 !== "合成") throw new Error("音效格式错误");
        const ctx = new OfflineAudioContext(1, 33075, 22050),
          gain = ctx.createGain();
        gain.connect(ctx.destination);
        模块.演奏音效({ 上下文: ctx, 音乐输出: gain, 音效输出: gain }, 项.谱);
        const 输出 = await ctx.startRendering(),
          样本 = Array.from(输出.getChannelData(0));
        let 峰值 = 0,
          能量 = 0;
        for (const 值 of 样本) {
          峰值 = Math.max(峰值, Math.abs(值));
          能量 += 值 * 值;
        }
        音效.push({
          名称: 项.名称,
          峰值,
          均方根: Math.sqrt(能量 / 样本.length),
          样本: 项.id.endsWith(".消行") ? 样本 : [],
        });
      }
      let 峰值 = 0,
        能量 = 0;
      for (const 值 of 音乐) {
        峰值 = Math.max(峰值, Math.abs(值));
        能量 += 值 * 值;
      }
      return { 名称, 时长, 峰值, 均方根: Math.sqrt(能量 / 音乐.length), 音乐, 音效 };
    }, 地点.名称);
    assert.ok(采样.峰值 > 0.005 && 采样.峰值 < 0.98, `${地点.名称} 音乐非静音且无削波`);
    assert.equal(采样.音效.length, 17);
    for (const 音 of 采样.音效)
      assert.ok(音.峰值 > 0.003 && 音.峰值 < 0.98, `${音.名称} 非静音且无削波`);
    const 写声音 = async (名称: string, 样本: number[]) => {
      const wav = Buffer.alloc(44 + 样本.length * 2);
      wav.write("RIFF");
      wav.writeUInt32LE(wav.length - 8, 4);
      wav.write("WAVEfmt ", 8);
      wav.writeUInt32LE(16, 16);
      wav.writeUInt16LE(1, 20);
      wav.writeUInt16LE(1, 22);
      wav.writeUInt32LE(22050, 24);
      wav.writeUInt32LE(44100, 28);
      wav.writeUInt16LE(2, 32);
      wav.writeUInt16LE(16, 34);
      wav.write("data", 36);
      wav.writeUInt32LE(样本.length * 2, 40);
      样本.forEach((值, i) => {
        wav.writeInt16LE(Math.round(值 * 32767), 44 + i * 2);
      });
      await Bun.write(join(输出, `${名称}.wav`), wav);
    };
    await 写声音(`${地点.名称}-音乐`, 采样.音乐);
    for (const 音 of 采样.音效) if (音.样本.length) await 写声音(音.名称, 音.样本);
    数据.push({
      名称: 地点.名称,
      时长: 采样.时长,
      音乐峰值: 采样.峰值,
      音乐均方根: 采样.均方根,
      音效: 采样.音效.map(({ 名称, 峰值, 均方根 }) => ({ 名称, 峰值, 均方根 })),
    });
  }
  await Bun.write(join(输出, "采样结果.json"), JSON.stringify(数据, null, 2));
  console.log(
    "12首旅行音乐、204项音效真实Web Audio离线采样通过：非静音、无削波，音乐和消行试听文件已输出。",
  );
} finally {
  await 浏览器.close();
  服务.stop(true);
}
