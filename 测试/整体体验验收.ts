import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const 地址 = process.argv[2] ?? "http://localhost:3220";
const 输出 = "测试/视觉快照/整体优化验收";
await mkdir(输出, { recursive: true });
const 浏览器 = await chromium.launch({ headless: true });
const 错误: string[] = [];
function 断言(ok: unknown, s: string): asserts ok {
  if (!ok) throw new Error(s);
  console.log(`通过：${s}`);
}
try {
  for (const [宽, 高] of [
    [1280, 720],
    [375, 667],
    [430, 860],
    [844, 390],
  ]) {
    const 页面 = await 浏览器.newPage({ viewport: { width: 宽, height: 高 } });
    页面.on("pageerror", (e) => 错误.push(e.message));
    await 页面.goto(地址);
    await 页面.waitForFunction(
      () => window.__GAMEMAKER_TEST__?.getSnapshot().sceneId === "开始菜单",
    );
    const 快照 = () => 页面.evaluate(() => window.__GAMEMAKER_TEST__?.getSnapshot());
    const 点击 = async (name: string) => {
      const snap = await 快照(),
        b = snap?.interactives.find((o) => o.name === name && o.visible)?.bounds;
      const canvas = await 页面.locator("canvas").first().boundingBox();
      断言(snap && b && canvas, `${宽}×${高} 可定位 ${name}`);
      断言(
        b.x >= 0 &&
          b.y >= 0 &&
          b.x + b.width <= snap.width + 1 &&
          b.y + b.height <= snap.height + 1,
        `${name} 完整位于屏幕内`,
      );
      await 页面.mouse.click(
        canvas.x + ((b.x + b.width / 2) * canvas.width) / snap.width,
        canvas.y + ((b.y + b.height / 2) * canvas.height) / snap.height,
      );
    };
    const 状态 = () => 页面.evaluate(() => window.__俄罗斯方块测试__?.读取状态());
    await 页面.screenshot({ path: `${输出}/${宽}x${高}-首页.png` });
    await 点击("menu.settings");
    await 页面.screenshot({ path: `${输出}/${宽}x${高}-设置.png` });
    const volume = (await 快照())?.interactives.find(
      (o) => o.name === "settings.music-volume.slider",
    )?.bounds;
    const cv = await 页面.locator("canvas").first().boundingBox();
    if (!volume || !cv) throw new Error("音量滑块缺失");
    const sx = cv.x + volume.x,
      sy = cv.y + volume.y + volume.height / 2;
    await 页面.mouse.move(sx + volume.width * 0.2, sy);
    await 页面.mouse.down();
    await 页面.mouse.move(sx + volume.width * 0.85, sy, { steps: 12 });
    await 页面.mouse.up();
    const music = await 页面.evaluate(
      () => JSON.parse(localStorage.getItem("gamemaker:settings") ?? "{}").音乐音量,
    );
    断言(music >= 80, "音量滑块可连续拖动到终点，过程中不重建控件");
    await 页面.mouse.move(宽 / 2, 高 / 2);
    await 页面.mouse.wheel(0, 650);
    await 页面.waitForTimeout(100);
    await 页面.screenshot({ path: `${输出}/${宽}x${高}-设置滚动.png` });
    await 点击("settings.done");
    await 点击("menu.start");
    await 页面.screenshot({ path: `${输出}/${宽}x${高}-模式.png` });
    await 点击("mode.马拉松");
    await 页面.waitForFunction(() => Boolean(window.__俄罗斯方块测试__));
    await 页面.screenshot({ path: `${输出}/${宽}x${高}-对局.png` });
    await 页面.keyboard.down("ArrowRight");
    await 页面.evaluate(() => window.dispatchEvent(new Event("blur")));
    断言((await 状态())?.阶段 === "暂停", "失焦会暂停对局");
    await 点击("game.pause.settings");
    await 页面.screenshot({ path: `${输出}/${宽}x${高}-对局设置.png` });
    await 点击("game.settings.rotation180.off");
    await 页面.keyboard.press("Escape");
    断言((await 状态())?.阶段 === "暂停", "Esc 从设置返回暂停菜单，保持暂停");
    await 点击("game.pause.resume");
    if (高 > 宽)
      断言(
        (await 快照())?.interactives.find((o) => o.name === "touch.rotate-right")?.enabled ===
          false,
        "关闭180度时对应手机按钮真正禁用",
      );
    const 原 = await 状态();
    await 页面.waitForTimeout(260);
    const 后 = await 状态();
    断言(原?.当前格子[0]?.[0] === 后?.当前格子[0]?.[0], "恢复后没有残留长按横移");
    await 页面.keyboard.up("ArrowRight");
    await 页面.evaluate(() => window.__俄罗斯方块测试__?.准备单行消除());
    if (高 > 宽) await 点击("touch.hard-drop");
    else await 页面.keyboard.press("Space");
    断言((await 状态())?.消行数 === 1, "键盘或手机硬降执行真实消行");
    const feedback = await 快照();
    断言(
      feedback?.texts.some((s) => s.includes("消除 1 行")),
      "消行反馈显示真实行数",
    );
    await 页面.screenshot({ path: `${输出}/${宽}x${高}-消行.png` });
    await 页面.evaluate(() => window.__俄罗斯方块测试__?.准备结算(true));
    const lock = (await 快照())?.interactives.find((o) => o.name === "restart");
    断言(lock?.enabled === false, "重开等待期间按钮真正禁用");
    await 页面.screenshot({ path: `${输出}/${宽}x${高}-结算.png` });
    await 页面.waitForTimeout(3100);
    断言(
      (await 快照())?.interactives.find((o) => o.name === "restart")?.enabled === true,
      "倒计时结束自动恢复重开按钮",
    );
    await 点击("restart");
    断言((await 状态())?.阶段 === "进行中" && (await 状态())?.分数 === 0, "重开后状态与反馈重置");
    await 页面.close();
  }
  const en = await 浏览器.newPage({ viewport: { width: 430, height: 860 } });
  await en.goto(地址);
  await en.evaluate(() =>
    localStorage.setItem("gamemaker:settings", JSON.stringify({ 语言: "English" })),
  );
  await en.reload();
  await en.waitForFunction(() =>
    window.__GAMEMAKER_TEST__?.getSnapshot().texts.some((s) => s.includes("PLAY")),
  );
  await en.screenshot({ path: `${输出}/430x860-English.png` });
  断言(错误.length === 0, "全程无页面运行错误");
} finally {
  await 浏览器.close();
}
