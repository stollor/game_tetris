import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import type Phaser from "phaser";
import { chromium } from "playwright";
import type { 落块特效 } from "../../代码/视觉/落块特效";
import { 准备页面 } from "./性能准备";
import { 准备自动游玩 } from "./方块自动游玩";

const 地址 = process.argv[2] ?? "http://127.0.0.1:3222";
const 标签 = process.argv[3] ?? "优化后";
const 输出 = "reports/performance-optimization";
await mkdir(输出, { recursive: true });
const 浏览器 = await chromium.launch({ channel: "chrome", headless: true });
const 页 = await 浏览器.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
const 错误: string[] = [];
页.on("pageerror", (错) => 错误.push(错.message));
try {
  await 准备页面(页, 地址, false, { 音效: 0 });
  await 准备自动游玩(页, "冲刺");
  const 计时 = await 页.evaluate(async () => {
    const 开始 = window.__再消一行测试__?.读取状态().有效用时;
    const 文本 = new Set<string>();
    for (let i = 0; i < 100; i++) {
      文本.add(window.__再消一行测试__?.读取界面().模式文字.文本 ?? "");
      await new Promise((完成) => setTimeout(完成, 10));
    }
    return { 开始, 结束: window.__再消一行测试__?.读取状态().有效用时, 文本数: 文本.size };
  });
  assert.ok(计时.结束 !== undefined && 计时.开始 !== undefined && 计时.结束 > 计时.开始);
  if (标签 === "优化后") assert.ok(计时.文本数 >= 15 && 计时.文本数 <= 28, JSON.stringify(计时));
  await 页.keyboard.press("Escape");
  const 暂停 = await 页.evaluate(() => ({
    状态: window.__再消一行测试__?.读取状态(),
    文字: window.__再消一行测试__?.读取界面().模式文字.文本,
  }));
  assert.equal(暂停.状态?.阶段, "暂停");
  assert.equal(暂停.文字, `40L · ${((暂停.状态?.有效用时 ?? 0) / 1000).toFixed(2)}s`);
  await 页.keyboard.press("Escape");
  await 页.keyboard.press("Space");
  await 页.waitForTimeout(60);
  const 真实落块 = await 页.evaluate(() => {
    const 游戏 = window.__游戏__;
    if (!游戏) throw new Error("缺少游戏实例");
    游戏.isPaused = true;
    游戏.loop.sleep();
    return window.__再消一行测试__?.读取界面().落块特效;
  });
  assert.equal(真实落块?.硬降拖尾, true);
  await 页.screenshot({ path: `${输出}/${标签}-真实落块.png` });
  const 特效 = await 页.evaluate(() => {
    const 游戏 = window.__游戏__;
    if (!游戏) throw new Error("缺少游戏实例");
    const 场景 = 游戏.scene.getScene("再消一行对局");
    const 寻找 = (
      列表: Phaser.GameObjects.GameObject[],
    ): Phaser.GameObjects.GameObject | undefined => {
      for (const 项 of 列表) {
        if (项.name === "board.lock-drop-effects") return 项;
        const 子项 = (项 as Phaser.GameObjects.Container).list;
        if (Array.isArray(子项)) {
          const 匹配 = 寻找(子项);
          if (匹配) return 匹配;
        }
      }
    };
    const 效果 = 寻找(场景.children.list) as 落块特效 | undefined;
    if (!效果) throw new Error("缺少真实落块特效");
    游戏.isPaused = true;
    游戏.loop.sleep();
    效果.清空();
    效果.硬降(
      [
        [3, 0],
        [4, 0],
        [5, 0],
        [6, 0],
      ],
      19,
      "I",
    );
    const 初 = 效果.快照();
    const 子项 = (效果 as Phaser.GameObjects.Container).list;
    const 采样 = () =>
      Array.isArray(子项)
        ? 子项.map((项) => {
            const 对象 = 项 as Phaser.GameObjects.Image & Phaser.GameObjects.Graphics;
            return {
              类型: 对象.type,
              键: 对象.texture?.key ?? "",
              命令: 对象.commandBuffer?.length ?? 0,
              缩放Y: 对象.scaleY,
            };
          })
        : [];
    const 前 = 采样();
    效果.更新(60);
    const 后 = 采样();
    const 几何未重建 =
      前.length === 后.length &&
      前.every((项, 序号) => {
        const 对照 = 后[序号];
        return 项.类型 === 对照?.类型 && 项.键 === 对照.键 && 项.命令 === 对照.命令;
      });
    const 有内容 = 前.some(
      (项) => 项.命令 > 0 || (项.类型 === "Image" && 项.键 !== "" && 项.键 !== "__DEFAULT"),
    );
    const 缩放变化 = 前.some((项, 序号) => 项.缩放Y !== 后[序号]?.缩放Y);
    const 前命令 = 前.map((项) => 项.命令);
    const 后命令 = 后.map((项) => 项.命令);
    const 中 = 效果.快照();
    游戏.renderer.preRender();
    游戏.scene.render(游戏.renderer);
    游戏.renderer.postRender();
    return { 初, 中, 子项数: 前.length, 前命令, 后命令, 几何未重建, 有内容, 缩放变化 };
  });
  assert.equal(特效.初.硬降拖尾, true);
  assert.equal(特效.中.硬降拖尾, true);
  if (标签 === "优化后") {
    assert.equal(特效.子项数, 5);
    assert.ok(特效.有内容);
    assert.ok(特效.缩放变化);
    assert.deepEqual(特效.后命令, 特效.前命令);
    assert.equal(特效.几何未重建, true);
  }
  await 页.screenshot({ path: `${输出}/${标签}-拖尾.png` });
  const 生命周期 = await 页.evaluate(() => {
    const 游戏 = window.__游戏__;
    if (!游戏) throw new Error("缺少游戏实例");
    const 场景 = 游戏.scene.getScene("再消一行对局");
    const 效果 = 场景.children.list
      .flatMap((项) => (项 as Phaser.GameObjects.Container).list ?? [])
      .find((项) => 项.name === "board.lock-drop-effects") as 落块特效 | undefined;
    if (!效果) throw new Error("缺少落块效果");
    效果.更新(180);
    const 拖尾已结束 = !效果.快照().硬降拖尾;
    效果.锁定({
      序号: 1,
      格子: [
        [4, 19],
        [5, 19],
      ],
      类型: "O",
      行数: 0,
      T旋: "无",
      全清: false,
      连击: 0,
      连续高难: false,
      得分: 0,
    });
    效果.更新(75);
    const 闪光仍在 = 效果.快照().锁定闪光;
    效果.设置格子(25);
    效果.更新(75);
    const 闪光已结束 = !效果.快照().锁定闪光;
    效果.硬降(
      [
        [4, 0],
        [5, 0],
      ],
      10,
      "O",
    );
    效果.清空();
    const 清空 = 效果.快照();
    效果.更新(16);
    const 闲置 = 效果.快照();
    return { 拖尾已结束, 闪光仍在, 闪光已结束, 清空, 闲置 };
  });
  assert.ok(生命周期.拖尾已结束 && 生命周期.闪光仍在 && 生命周期.闪光已结束);
  assert.deepEqual(生命周期.清空, { 硬降拖尾: false, 锁定闪光: false });
  assert.deepEqual(生命周期.闲置, 生命周期.清空);
  assert.deepEqual(错误, []);
  await writeFile(
    `${输出}/${标签}-页面验收.json`,
    JSON.stringify({ 地址, 计时, 暂停, 真实落块, 特效, 生命周期, 错误 }, null, 2),
  );
  console.log(
    JSON.stringify({ 标签, 计时, 暂停精度: true, 几何复用: 特效.前命令.length === 5, 错误 }),
  );
} finally {
  await 浏览器.close();
}
