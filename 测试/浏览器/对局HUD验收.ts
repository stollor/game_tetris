import { chromium } from "playwright";

function 断言(条件: boolean, 说明: string): void {
  if (!条件) throw new Error(`对局 HUD 验收失败：${说明}`);
  console.log(`通过：${说明}`);
}

const 地址 = process.argv[2] ?? "http://localhost:3000";
const 浏览器 = await chromium.launch({ headless: true });
const 页面 = await 浏览器.newPage({ viewport: { width: 960, height: 640 } });

try {
  const 响应 = await 页面.goto(地址, { waitUntil: "domcontentloaded" });
  断言(响应?.ok() === true, "游戏页面正常打开");
  const 点击对象 = async (名称: string) => {
    const 快照 = await 页面.evaluate(() => window.__GAMEMAKER_TEST__?.getSnapshot());
    const 项目 = 快照?.interactives.find((对象) => 对象.name === 名称);
    const 画布 = await 页面.locator("canvas").first().boundingBox();
    断言(Boolean(快照 && 项目?.bounds && 画布), `可以定位 ${名称}`);
    if (!快照 || !项目?.bounds || !画布) throw new Error(`找不到 ${名称}`);
    await 页面.mouse.click(
      画布.x + ((项目.bounds.x + 项目.bounds.width / 2) / 快照.width) * 画布.width,
      画布.y + ((项目.bounds.y + 项目.bounds.height / 2) / 快照.height) * 画布.height,
    );
  };
  const 开始模式 = async (模式: string) => {
    await 页面.waitForFunction(
      () => window.__GAMEMAKER_TEST__?.getSnapshot().sceneId === "开始菜单",
    );
    await 点击对象("menu.start");
    await 点击对象(`mode.${模式}`);
    await 页面.waitForFunction(() => Boolean(window.__再消一行测试__));
  };
  const 读取界面 = () => 页面.evaluate(() => window.__再消一行测试__?.读取界面());

  // 从实际游戏设置存储加载关闭状态，再走真实主菜单进入对局。
  await 页面.evaluate(() =>
    localStorage.setItem("gamemaker:settings", JSON.stringify({ 旋转180: false })),
  );
  await 页面.reload({ waitUntil: "domcontentloaded" });
  await 开始模式("冲刺");
  let 界面 = await 读取界面();
  断言(
    Boolean(
      界面?.模式文字.可见 && /40L|40/.test(界面.模式文字.文本) && /s/.test(界面.模式文字.文本),
    ),
    "Sprint 对局内显示目标和有效计时",
  );
  断言(
    Boolean(界面?.操作说明.some((说明) => 说明.可见 && /disabled|关闭/.test(说明.文本))),
    "180°关闭时局内提示同步更新",
  );
  断言(Boolean(界面?.快速移动提示.可见), "局内显示快速移动提示");
  const 朝向 = await 页面.evaluate(() => window.__再消一行测试__?.读取状态().当前朝向);
  await 页面.keyboard.press("z");
  断言(
    (await 页面.evaluate(() => window.__再消一行测试__?.读取状态().当前朝向)) === 朝向,
    "180°关闭后 Z 键不会旋转方块",
  );

  await 页面.evaluate(() => window.__再消一行测试__?.准备结算(true));
  界面 = await 读取界面();
  断言(
    Boolean(
      界面?.结算徽标.可见 &&
        /complete|完成/.test(界面.结算徽标.文本) &&
        /record|纪录/.test(界面.结算徽标.文本),
    ),
    "Sprint 结算显示完赛和破纪录状态",
  );
  const Sprint字段 =
    界面?.结算统计
      .filter((项) => 项.可见)
      .map((项) => 项.标签)
      .join(" ") ?? "";
  断言(
    /Time|用时/.test(Sprint字段) && /Best|最佳/.test(Sprint字段) && /Lines|行/.test(Sprint字段),
    "Sprint 结算显示用时、消行和历史最佳",
  );
  断言(/New record|新纪录/.test(界面?.结算徽标.文本 ?? ""), "Sprint 首次完赛反馈新纪录");

  await 页面.reload({ waitUntil: "domcontentloaded" });
  await 开始模式("极限");
  界面 = await 读取界面();
  断言(
    Boolean(界面?.模式文字.可见 && /120|120s/.test(界面.模式文字.文本)),
    "Ultra 对局内显示倒计时",
  );
  await 页面.evaluate(() => localStorage.removeItem("neon-pulse:best:极限"));
  await 页面.evaluate(() => window.__再消一行测试__?.准备结算(false));
  界面 = await 读取界面();
  const Ultra字段 =
    界面?.结算统计
      .filter((项) => 项.可见)
      .map((项) => 项.标签)
      .join(" ") ?? "";
  断言(
    Boolean(界面?.结算徽标.可见 && /New record|新纪录/.test(界面.结算徽标.文本)),
    "Ultra 结算显示破纪录反馈",
  );
  断言(
    /Time|用时/.test(Ultra字段) && /Best|最佳/.test(Ultra字段) && /Level|等级/.test(Ultra字段),
    "Ultra 结算显示有效用时、历史最佳、等级和消行",
  );

  await 页面.reload({ waitUntil: "domcontentloaded" });
  await 开始模式("马拉松");
  await 页面.evaluate(() => window.__再消一行测试__?.准备目标达成());
  await 页面.keyboard.press("Space");
  await 页面.waitForFunction(() => window.__再消一行测试__?.读取状态().消行数 === 140);
  界面 = await 读取界面();
  断言(
    Boolean(界面?.目标达成提示.可见 && /Goal reached|目标达成/.test(界面.目标达成提示.文本)),
    "真实消除第 140 行后出现目标达成提示",
  );
  断言(界面?.模式文字.可见 === false, "马拉松不会在棋盘上方重复显示模式标题");

  await 页面.reload({ waitUntil: "domcontentloaded" });
  await 页面.setViewportSize({ width: 430, height: 860 });
  await 开始模式("每日挑战");
  界面 = await 读取界面();
  const 今日 = new Date().toISOString().slice(0, 10);
  断言(
    Boolean(界面?.模式文字.可见 && 界面.模式文字.文本.includes(今日)),
    "每日挑战对局内显示当日日期",
  );
  断言(
    (界面?.手机侧栏纪录间距 ?? 0) >= 50,
    `手机竖屏预览栏与最佳纪录留有间距（${界面?.手机侧栏纪录间距 ?? 0}px）`,
  );
} finally {
  await 浏览器.close();
}
