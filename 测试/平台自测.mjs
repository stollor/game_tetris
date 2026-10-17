import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const out = "测试/自测截图/平台ux";
await mkdir(out, { recursive: true });
const url = process.argv[2] || "http://127.0.0.1:3001";
const size = { w: 390, h: 844, dpr: 3, name: "390x844" };

async function 点击(页, 名称) {
  await 页.waitForFunction(
    (名称) =>
      window.__GAMEMAKER_TEST__
        ?.getSnapshot("标准")
        .interactives.some((项) => 项.name === 名称 && 项.enabled && 项.visible),
    名称,
    { timeout: 20000 },
  );
  const 数据 = await 页.evaluate((名称) => {
    const 快照 = window.__GAMEMAKER_TEST__?.getSnapshot("标准");
    const 目标 = 快照?.interactives.find((项) => 项.name === 名称 && 项.enabled && 项.visible);
    return 快照 && 目标?.bounds ? { 宽: 快照.width, 高: 快照.height, 框: 目标.bounds } : null;
  }, 名称);
  if (!数据) throw new Error("missing " + 名称);
  const 画布 = await 页.locator("canvas").boundingBox();
  if (!画布) throw new Error("no canvas");
  await 页.mouse.click(
    画布.x + ((数据.框.x + 数据.框.width / 2) * 画布.width) / 数据.宽,
    画布.y + ((数据.框.y + 数据.框.height / 2) * 画布.height) / 数据.高,
  );
  await 页.waitForTimeout(220);
}

const browser = await chromium.launch({ channel: "chrome" });
const report = [];
const check = (ok, msg) => {
  if (!ok) throw new Error(msg);
  report.push("通过：" + msg);
  console.log("通过：" + msg);
};

try {
  const page = await browser.newPage({
    viewport: { width: size.w, height: size.h },
    deviceScaleFactor: size.dpr,
  });
  await page.addInitScript(() => {
    localStorage.setItem(
      "gamemaker:settings",
      JSON.stringify({ 样式: "暖纸古典", 语言: "简体中文" }),
    );
    localStorage.setItem(
      "neon-pulse:achievements",
      JSON.stringify({
        版本: 1,
        数据: {
          "first-lock": { 进度: 1, 解锁时间: Date.now() - 1000 },
          "first-clear": { 进度: 1, 解锁时间: Date.now() - 900 },
        },
      }),
    );
    window.tap = {
      getCloudSaveManager: () => ({
        getArchiveList: ({ success }) => success?.({ saves: [] }),
        createArchive: ({ success }) => success?.(),
        updateArchive: ({ success }) => success?.(),
        getArchiveData: ({ success, targetFilePath }) => success?.({ filePath: targetFilePath }),
      }),
      getFileSystemManager: () => ({
        writeFile: ({ success }) => success?.(),
        readFile: ({ success }) => success?.({ data: "{}" }),
      }),
      getLeaderboardManager: () => ({
        loadLeaderboardScores: ({ callback }) =>
          callback?.onSuccess?.({
            scores: [{ rank: 1, score: 1200, user: { name: "A", openid: "oid-peer" } }],
            leaderboard: { id: "x", period: { display: "", periodToken: "" }, availablePeriods: [] },
          }),
        loadCurrentPlayerLeaderboardScore: ({ callback }) =>
          callback?.onSuccess?.({
            currentUserScore: { rank: 3, score: 800, user: { name: "Me", openid: "oid-self-demo" } },
          }),
        submitScores() {},
        openLeaderboard() {},
      }),
      createAchievementManager: () => ({
        registerListener({ onAchievementSuccess }) {
          this._ok = onAchievementSuccess;
        },
        unlockAchievement({ achievementId, callback }) {
          setTimeout(() => {
            callback?.onAchievementSuccess?.();
            this._ok?.(0, { achievementId });
          }, 30);
        },
      }),
      getUserInfo: ({ success }) => success?.({ userInfo: { nickName: "测号" } }),
      login: ({ success }) => success?.({ code: "mock" }),
      env: { USER_DATA_PATH: "tapfile://usr" },
    };
  });
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForFunction(() => window.__GAMEMAKER_TEST__?.getSnapshot().sceneId === "开始菜单", null, {
    timeout: 90000,
  });
  await page.waitForTimeout(600);

  await 点击(page, "menu.settings");
  await page.waitForFunction(() => window.__GAMEMAKER_TEST__?.getSnapshot().sceneId === "设置界面", null, {
    timeout: 15000,
  });
  await page.waitForTimeout(800);
  const settingsSnap = await page.evaluate(() => window.__GAMEMAKER_TEST__.getSnapshot("标准"));
  check(!settingsSnap.interactives.some((i) => i.name === "settings.close" && i.visible), "无右上角关闭");
  check(!!settingsSnap.interactives.find((i) => i.name === "settings.done" && i.visible), "有完成按钮");
  const cloudText = await page.evaluate(() => {
    const texts = [];
    for (const t of document.querySelectorAll("canvas")) texts.push(t.width);
    return window.__GAME_PLATFORM__?.用户身份?.openid || localStorage.getItem("旅行版:Tap用户") || "";
  });
  // Prefer platform probe; also check status line via game platform after refresh
  await page.waitForFunction(
    () => {
      const raw = localStorage.getItem("旅行版:Tap用户");
      return raw && raw.includes("oid-self-demo");
    },
    null,
    { timeout: 8000 },
  ).catch(() => null);
  const idRaw = await page.evaluate(() => localStorage.getItem("旅行版:Tap用户"));
  check(!!(idRaw && idRaw.includes("oid-self-demo")), "设置页拉到用户 openid");
  await page.screenshot({ path: `${out}/settings-${size.name}.png` });

  await 点击(page, "settings.done");
  await page.waitForFunction(() => window.__GAMEMAKER_TEST__?.getSnapshot().sceneId === "开始菜单", null, {
    timeout: 15000,
  });

  await 点击(page, "menu.achievements");
  await page.waitForFunction(() => window.__GAMEMAKER_TEST__?.getSnapshot().sceneId === "成就界面", null, {
    timeout: 15000,
  });
  await page.waitForFunction(
    () => {
      const raw = localStorage.getItem("旅行版:成就同步");
      return raw && raw.includes("已同步");
    },
    null,
    { timeout: 10000 },
  );
  const ach = await page.evaluate(() => localStorage.getItem("旅行版:成就同步"));
  check(!!(ach && ach.includes("first-lock") && ach.includes("已同步")), "成就补同步并落盘已同步");
  await page.screenshot({ path: `${out}/achievements-${size.name}.png` });

  await 点击(page, "achievements.back");
  await page.waitForFunction(() => window.__GAMEMAKER_TEST__?.getSnapshot().sceneId === "开始菜单", null, {
    timeout: 15000,
  });
  await 点击(page, "menu.start");
  await page.waitForTimeout(400);
  const modes = await page.evaluate(() => window.__GAMEMAKER_TEST__.getSnapshot("标准"));
  const lb = modes.interactives.filter((i) => String(i.name).endsWith(".leaderboard") && i.visible);
  check(lb.length >= 4, "模式卡上有排行榜图标");
  await page.screenshot({ path: `${out}/modes-${size.name}.png` });

  console.log("\n全部通过:\n" + report.join("\n"));
} finally {
  await browser.close();
}
