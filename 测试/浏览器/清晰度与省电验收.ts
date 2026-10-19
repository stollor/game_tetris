import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import type Phaser from "phaser";
import { chromium, type Page } from "playwright";
import type {} from "../../代码/场景/对局/对局";

declare global {
  interface Window {
    __游戏__: Phaser.Game;
    __烘焙统计__: { 烘焙次数: number };
  }
}

const 地址 = process.argv[2] ?? "http://127.0.0.1:3221";
const 输出 = "reports/mobile-power";
await mkdir(输出, { recursive: true });
const 浏览器 = await chromium.launch({ channel: "chrome" });
const 错误: string[] = [];
const 结果 = [];
async function 点击(页: Page, 名称: string): Promise<void> {
  await 页.waitForFunction(
    (名) =>
      window.__GAMEMAKER_TEST__
        ?.getSnapshot()
        .interactives.some((项) => 项.name === 名 && 项.visible && 项.enabled),
    名称,
  );
  const 框 = await 页.evaluate(
    (名) =>
      window.__GAMEMAKER_TEST__
        ?.getSnapshot()
        .interactives.find((项) => 项.name === 名 && 项.visible && 项.enabled)?.bounds,
    名称,
  );
  assert.ok(框, 名称);
  const 画布 = await 页.locator("canvas").boundingBox();
  assert.ok(画布);
  const 尺寸 = await 页.evaluate(() => ({
    宽: window.__游戏__.canvas.width,
    高: window.__游戏__.canvas.height,
  }));
  await 页.touchscreen.tap(
    画布.x + ((框.x + 框.width / 2) * 画布.width) / 尺寸.宽,
    画布.y + ((框.y + 框.height / 2) * 画布.height) / 尺寸.高,
  );
}
async function 读取状态(页: Page) {
  return 页.evaluate(() => {
    const 接口 = window.__再消一行测试__;
    if (!接口) throw new Error("未进入对局");
    return 接口.读取状态();
  });
}
try {
  // 默认手机视口；DPR 3 专门复现高像素比手机的清晰度问题。
  for (const [像素比, 省电, 动态] of [
    [1, false, true],
    [3, false, true],
    [3, true, true],
    [3, true, false],
  ] as const) {
    console.log({ 像素比, 省电, 动态 });
    const 页 = await 浏览器.newPage({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 像素比,
      isMobile: true,
      hasTouch: true,
    });
    页.on("pageerror", (错) => 错误.push(错.message));
    await 页.addInitScript(
      ({ 省电, 动态 }) => {
        localStorage.setItem(
          "再消一行:设置",
          JSON.stringify({ 省电模式: 省电 ? "开" : "关", 背景动态: 动态 }),
        );
      },
      { 省电, 动态 },
    );
    await 页.goto(`${地址}/?perf-debug`);
    await 页.waitForFunction(() => window.__GAMEMAKER_TEST__?.getSnapshot().sceneId === "开始菜单");
    await 页.waitForTimeout(400);
    await 点击(页, "menu.start");
    await 页.waitForTimeout(450);
    await 点击(页, "mode.马拉松");
    await 页.waitForFunction(() => Boolean(window.__再消一行测试__));
    await 页.evaluate(() => window.__再消一行测试__?.设置序列(["T", "I", "O", "J"]));
    const 初始 = await 读取状态(页);
    await 点击(页, "touch.left");
    const 移动后 = await 读取状态(页);
    assert.ok(移动后.当前格子[0][0] < 初始.当前格子[0][0], "触屏左移实际改变方块");
    await 点击(页, "touch.rotate");
    assert.notEqual((await 读取状态(页)).当前朝向, 初始.当前朝向, "触屏旋转");
    await 页.keyboard.press("Space");
    await 页.waitForTimeout(100);
    assert.equal((await 读取状态(页)).当前方块, "I", "硬降切换下一块");
    await 页.keyboard.press("p");
    const 暂停 = await 读取状态(页);
    await 页.waitForTimeout(700);
    assert.deepEqual((await 读取状态(页)).当前格子, 暂停.当前格子, "暂停不推进方块");
    await 页.keyboard.press("p");
    await 页.waitForTimeout(1400);
    assert.equal((await 读取状态(页)).阶段, "进行中");
    const 清晰度 = await 页.evaluate(() => {
      const 游戏 = window.__游戏__;
      const 场景 = 游戏.scene.getScene("再消一行对局");
      const 缓存: { 比: number; 需要: number }[] = [];
      const 扫描 = (对象: Phaser.GameObjects.GameObject): void => {
        const 图 = 对象 as Phaser.GameObjects.Graphics & { __烘焙?: { 比: number } };
        if (图.__烘焙) {
          const 矩阵 = 图.getWorldTransformMatrix();
          缓存.push({
            比: 图.__烘焙.比,
            需要:
              Math.max(Math.hypot(矩阵.a, 矩阵.b), Math.hypot(矩阵.c, 矩阵.d)) *
              场景.cameras.main.zoom,
          });
        }
        if (对象.type === "Container")
          for (const 子 of (对象 as Phaser.GameObjects.Container).list) 扫描(子);
      };
      场景.children.list.forEach(扫描);
      return { 宽: 游戏.canvas.width, 高: 游戏.canvas.height, 限帧: 游戏.loop.fpsLimit, 缓存 };
    });
    assert.equal(清晰度.宽, 390 * 像素比);
    assert.equal(清晰度.高, 844 * 像素比);
    assert.equal(清晰度.限帧, 省电 ? 30 : 60);
    assert.ok(清晰度.缓存.length > 10);
    assert.ok(
      清晰度.缓存.every((项) => 项.比 >= 项.需要 - 0.01),
      "烘焙纹理覆盖实际显示精度",
    );
    if (像素比 === 3 && !省电) {
      await 页.evaluate(() => {
        window.__游戏__.scene
          .getScene("再消一行对局")
          .add.graphics()
          .setName("验收.烘焙清晰度")
          .fillStyle(0xffffff)
          .fillRect(0, 0, 10, 10);
      });
      await 页.waitForFunction(() => {
        const 图 = window.__游戏__.scene
          .getScene("再消一行对局")
          .children.getByName("验收.烘焙清晰度") as Phaser.GameObjects.Graphics & {
          __烘焙?: { 比: number };
        };
        return 图.__烘焙?.比 === 3;
      });
      await 页.evaluate(() => {
        const 图 = window.__游戏__.scene
          .getScene("再消一行对局")
          .children.getByName("验收.烘焙清晰度") as Phaser.GameObjects.Graphics;
        图.setScale(1.25);
      });
      await 页.waitForFunction(() => {
        const 图 = window.__游戏__.scene
          .getScene("再消一行对局")
          .children.getByName("验收.烘焙清晰度") as Phaser.GameObjects.Graphics & {
          __烘焙?: { 比: number; 左: number };
        };
        const 缓存 = 图.__烘焙;
        return (
          缓存?.比 === 3.75 && Math.abs(缓存.左 * 缓存.比 - Math.round(缓存.左 * 缓存.比)) < 0.001
        );
      });
      await 页.evaluate(() =>
        window.__游戏__.scene
          .getScene("再消一行对局")
          .children.getByName("验收.烘焙清晰度")
          ?.destroy(),
      );
    }
    await 页.screenshot({
      path: `${输出}/dpr${像素比}-${省电 ? "省电" : "标准"}-${动态 ? "动态" : "静态"}.png`,
    });
    await 页.evaluate(() => window.__再消一行测试__?.准备四行消除(false, true));
    await 页.keyboard.press("Space");
    assert.equal((await 读取状态(页)).消行数, 4, "限帧下实际四行消除");
    const 消除界面 = await 页.evaluate(() => window.__再消一行测试__?.读取界面());
    assert.equal(消除界面?.消行特效?.活跃, true, "四行特效正常播放");
    await 页.waitForTimeout(1100);
    assert.equal(
      (await 页.evaluate(() => window.__再消一行测试__?.读取界面()))?.消行特效?.活跃,
      false,
      "四行特效如期结束",
    );
    // 在无开发桥的地址测量正式路径，避免快照扫描计入游戏开销。
    await 页.route("http://one-more-line.local/**", (路由) =>
      路由.continue({ url: 路由.request().url().replace("http://one-more-line.local", 地址) }),
    );
    await 页.goto("http://one-more-line.local/?perf-debug");
    await 页.waitForFunction(() => window.__游戏__?.scene.isActive("开始菜单"));
    await 页.evaluate(() => {
      const 游戏 = window.__游戏__;
      游戏.scene.stop("开始菜单");
      游戏.scene.start("再消一行对局", { 模式: "马拉松" });
    });
    await 页.waitForTimeout(1800);
    const 采样 = await 页.evaluate(async () => {
      const 游戏 = window.__游戏__;
      let 更新 = 0;
      let 渲染 = 0;
      let 逻辑毫秒 = 0;
      const 数更新 = (_时间: number, 间隔: number) => {
        更新++;
        逻辑毫秒 += 间隔;
      };
      const 数渲染 = () => 渲染++;
      游戏.events.on("poststep", 数更新);
      游戏.events.on("prerender", 数渲染);
      const 初 = window.__烘焙统计__.烘焙次数;
      const 起 = performance.now();
      await new Promise((完成) => setTimeout(完成, 3000));
      游戏.events.off("poststep", 数更新);
      游戏.events.off("prerender", 数渲染);
      return {
        秒: (performance.now() - 起) / 1000,
        更新,
        渲染,
        逻辑毫秒,
        烘焙: window.__烘焙统计__.烘焙次数 - 初,
      };
    });
    assert.ok(采样.更新 / 采样.秒 <= (省电 ? 33 : 63), "高刷屏仍受帧率上限约束");
    assert.ok(Math.abs(采样.逻辑毫秒 / 1000 - 采样.秒) < 0.15, "限帧后游戏时钟与真实时间一致");
    assert.ok(采样.渲染 < 采样.更新 * 0.6, "无操作时跳过无变化帧");
    if (!动态) assert.ok(采样.渲染 <= 12 && 采样.烘焙 <= 12, "静态背景不持续重绘或烘焙");
    结果.push({ 像素比, 省电, 动态, 清晰度, 采样 });
    await 页.close();
  }
  assert.deepEqual(错误, []);
  await writeFile(
    `${输出}/验收.json`,
    JSON.stringify({ 环境: "Chrome 手机模拟 390×844，非真机功耗", 结果, 错误 }, null, 2),
  );
  console.log(
    JSON.stringify(
      结果.map(({ 像素比, 省电, 动态, 采样 }) => ({ 像素比, 省电, 动态, 采样 })),
      null,
      2,
    ),
  );
} finally {
  await 浏览器.close();
}
