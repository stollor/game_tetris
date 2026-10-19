import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { 性能实验场景 } from "./性能实验";

const 输出 = resolve("reports/audio-conditions");
await mkdir(输出, { recursive: true });
const 浏览器 = await chromium.launch({ channel: "chrome", headless: true });
try {
  const 页 = await 浏览器.newPage({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
  });
  const 错误: string[] = [];
  页.on("pageerror", (错) => 错误.push(错.message));
  const 场景 = 性能实验场景.find((项) => 项.名称 === "对照·全部静音");
  assert.ok(场景);
  await 场景.准备(页, process.env.GAME_URL ?? "http://127.0.0.1:3221");
  await 场景.验收(页, "准备");
  await 场景.操作(页, 2, { 每秒次数: 8, 数量倍率: 1, 恢复秒数: 0 });
  await 场景.验收(页, "完成");
  const 证据 = await 场景.证据(页);
  // 注入错误读数，确认验收会拒绝条件失效，而不是只把请求值抄进报告。
  await 页.evaluate(() => {
    const 接口 = window.__再消一行测试__;
    if (!接口) throw new Error("测试接口缺失");
    const 原读取 = 接口.读取音频;
    接口.读取音频 = () => {
      const 状态 = 原读取();
      return { ...状态, 框架: { ...状态.框架, 音效音量: 80 } };
    };
  });
  await assert.rejects(() => 场景.验收(页, "完成"), /请求音量与运行时不一致/);
  assert.deepEqual(错误, []);
  await writeFile(
    resolve(输出, "验收.json"),
    JSON.stringify({ 证据, 错误, 错误条件已拒绝: true }, null, 2),
  );
  console.log("通过：全部静音真实落块无音效调用；注入生效值不匹配时验收失败。");
} finally {
  await 浏览器.close();
}
