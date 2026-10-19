import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const 地址 = process.argv[2] ?? "http://localhost:3220";
const 输出 = "测试/视觉快照/架构接入";
await mkdir(输出, { recursive: true });
const 浏览器 = await chromium.launch({ headless: true });
const 错误: string[] = [];
try {
  for (const [宽, 高] of [
    [1440, 900],
    [430, 860],
    [375, 667],
    [844, 390],
  ]) {
    const 页面 = await 浏览器.newPage({ viewport: { width: 宽, height: 高 } });
    页面.on("pageerror", (e) => 错误.push(e.message));
    await 页面.goto(地址);
    await 页面.waitForFunction(
      () => window.__GAMEMAKER_TEST__?.getSnapshot().sceneId === "开始菜单",
    );
    const 点击 = async (名称: string) => {
      const 快照 = await 页面.evaluate(() => window.__GAMEMAKER_TEST__?.getSnapshot());
      const 项 = 快照?.interactives.find((v) => v.name === 名称 && v.visible);
      const 框 = await 页面.locator("canvas").first().boundingBox();
      if (!快照 || !项?.bounds || !框) throw new Error(`未找到 ${名称}`);
      const b = 项.bounds;
      if (b.x < 0 || b.y < 0 || b.x + b.width > 快照.width + 1 || b.y + b.height > 快照.height + 1)
        throw new Error(`${名称} 越出视口`);
      await 页面.mouse.click(
        框.x + ((b.x + b.width / 2) * 框.width) / 快照.width,
        框.y + ((b.y + b.height / 2) * 框.height) / 快照.height,
      );
    };
    await 页面.screenshot({ path: `${输出}/${宽}x${高}-首页.png` });
    await 点击("menu.start");
    await 页面.screenshot({ path: `${输出}/${宽}x${高}-模式.png` });
    for (const 名称 of ["mode.马拉松", "mode.冲刺", "mode.极限", "mode.每日挑战", "mode.back"]) {
      const 快照 = await 页面.evaluate(() => window.__GAMEMAKER_TEST__?.getSnapshot());
      const 项 = 快照?.interactives.find((v) => v.name === 名称 && v.visible);
      const b = 项?.bounds;
      if (
        !快照 ||
        !b ||
        b.x < 0 ||
        b.y < 0 ||
        b.x + b.width > 快照.width + 1 ||
        b.y + b.height > 快照.height + 1
      )
        throw new Error(`${宽}x${高} ${名称} 未完整显示`);
    }
    await 页面.evaluate(() => localStorage.setItem("neon-pulse:best:马拉松", "{broken"));
    await 点击("mode.马拉松");
    await 页面.waitForFunction(() => Boolean(window.__再消一行测试__));
    await 页面.screenshot({ path: `${输出}/${宽}x${高}-对局.png` });
    await 页面.evaluate(() => window.__再消一行测试__?.准备结算(true));
    const 原文 = await 页面.evaluate(() => localStorage.getItem("neon-pulse:best:马拉松"));
    if (原文 !== "{broken") throw new Error("损坏纪录被覆盖");
    const 徽标 = await 页面.evaluate(() => window.__再消一行测试__?.读取界面().结算徽标.文本);
    if (徽标?.includes("纪录刷新")) throw new Error("保护失败时错误宣称刷新纪录");
    console.log(`通过：${宽}×${高} 菜单完整可点击，真实结算保护损坏纪录`);
    await 页面.close();
  }
  if (错误.length) throw new Error(错误.join("\n"));
  console.log("通过：无浏览器运行错误");
} finally {
  await 浏览器.close();
}
