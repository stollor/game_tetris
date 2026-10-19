import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";
import { 每日方块序列 } from "../../代码/玩法/再消一行";

interface 对局测试接口 {
  设置序列: (序列: string[]) => void;
  准备单行消除: () => void;
  读取状态: () => {
    阶段: string;
    分数: number;
    有效用时: number;
    消行数: number;
    当前方块: string;
    下一个方块: string;
    当前格子: [number, number][];
    当前朝向: number;
    朝向: number;
  };
}

interface 快照测试接口 {
  getSnapshot: () => {
    sceneId: string;
    width: number;
    height: number;
    interactives: {
      name: string;
      bounds: { x: number; y: number; width: number; height: number } | null;
    }[];
  };
}

function 断言(条件: boolean, 说明: string): void {
  if (!条件) throw new Error(`验收失败：${说明}`);
  console.log(`通过：${说明}`);
}

const 地址 = process.argv[2] ?? "http://localhost:3000";
const 浏览器 = await chromium.launch({ headless: true });
const 页面 = await 浏览器.newPage({ viewport: { width: 960, height: 640 } });
const 页面错误: string[] = [];
页面.on("pageerror", (错误) => 页面错误.push(错误.message));
页面.on("console", (消息) => {
  if (消息.type() === "error") 页面错误.push(消息.text());
});

try {
  const 响应 = await 页面.goto(地址, { waitUntil: "domcontentloaded" });
  断言(响应?.ok() === true, "页面以 HTTP 200 启动");
  await mkdir("reports/core-gameplay", { recursive: true });
  await 页面.waitForFunction(() =>
    Boolean((window as unknown as { __GAMEMAKER_TEST__?: 快照测试接口 }).__GAMEMAKER_TEST__),
  );
  await 页面.waitForFunction(
    () =>
      (window as unknown as { __GAMEMAKER_TEST__?: 快照测试接口 }).__GAMEMAKER_TEST__?.getSnapshot()
        .sceneId === "开始菜单",
  );
  const 点击测试对象 = async (名称: string) => {
    const 快照 = await 页面.evaluate(() =>
      (
        window as unknown as { __GAMEMAKER_TEST__?: 快照测试接口 }
      ).__GAMEMAKER_TEST__?.getSnapshot(),
    );
    const 项目 = 快照?.interactives.find((对象) => 对象.name === 名称);
    const 画布框 = await 页面.locator("canvas").first().boundingBox();
    断言(Boolean(项目?.bounds && 画布框 && 快照), `可定位菜单按钮 ${名称}`);
    if (!项目?.bounds || !画布框 || !快照) throw new Error(`找不到菜单按钮 ${名称}`);
    await 页面.mouse.click(
      画布框.x + ((项目.bounds.x + 项目.bounds.width / 2) / 快照.width) * 画布框.width,
      画布框.y + ((项目.bounds.y + 项目.bounds.height / 2) / 快照.height) * 画布框.height,
    );
  };
  await 点击测试对象("menu.start");
  await 页面.waitForTimeout(100);
  await 点击测试对象("mode.马拉松");
  await 页面.waitForFunction(() => {
    const 测试窗 = window as unknown as { __再消一行测试__?: 对局测试接口 };
    return Boolean(测试窗.__再消一行测试__);
  });

  const 读取对局 = async () =>
    await 页面.evaluate(() => {
      const 测试窗 = window as unknown as { __再消一行测试__?: 对局测试接口 };
      return 测试窗.__再消一行测试__?.读取状态();
    });

  await 页面.evaluate(() => {
    const 测试窗 = window as unknown as { __再消一行测试__?: 对局测试接口 };
    测试窗.__再消一行测试__?.设置序列(["T", "I", "O", "S"]);
  });
  const 初始 = await 读取对局();
  断言(初始?.当前方块 === "T", "固定序列可重现当前方块");
  await 页面.keyboard.press("z");
  断言((await 读取对局())?.当前朝向 === 2, "默认开启 Z 键 180°旋转");
  await 页面.keyboard.press("z");
  断言((await 读取对局())?.当前朝向 === 0, "再次按 Z 可转回原朝向");

  await 页面.keyboard.press("ArrowLeft");
  const 左移后 = await 读取对局();
  断言(
    Boolean(
      左移后?.当前格子.every(
        ([列, 行], 索引) =>
          列 === (初始?.当前格子[索引]?.[0] ?? 列) - 1 && 行 === 初始?.当前格子[索引]?.[1],
      ),
    ),
    "左方向键即时移动一格",
  );

  const 横移开始 = (await 读取对局())?.有效用时 ?? 0;
  await 页面.keyboard.down("ArrowRight");
  // Phaser 的平滑 delta 与墙钟时间不同；等待实际对局时间覆盖 DAS + ARR。
  await 页面.waitForFunction(
    (开始) => (window.__再消一行测试__?.读取状态().有效用时 ?? 0) >= 开始 + 350,
    横移开始,
    { timeout: 3000 },
  );
  await 页面.keyboard.up("ArrowRight");
  const 连续横移后 = await 读取对局();
  const 最左格列 = 连续横移后?.当前格子[0]?.[0] ?? -100;
  const 初始最左格列 = 初始?.当前格子[0]?.[0] ?? 0;
  断言(
    最左格列 >= 初始最左格列 + 2,
    `按住方向键先等待 DAS，再按 ARR 连续移动（原位 ${初始最左格列}，现位 ${最左格列}）`,
  );

  await 页面.keyboard.press("ArrowUp");
  const 旋转后 = await 读取对局();
  断言(旋转后?.当前朝向 === 3, `上方向键按默认左转旋转（实际朝向 ${旋转后?.当前朝向}）`);

  await 页面.keyboard.down("ArrowDown");
  await 页面.waitForTimeout(240);
  await 页面.keyboard.up("ArrowDown");
  const 软降后 = await 读取对局();
  断言(
    Boolean(
      软降后?.当前格子.some(
        ([列, 行]) => 行 > (旋转后?.当前格子.find(([旧列]) => 旧列 === 列)?.[1] ?? 行),
      ),
    ),
    "按住下方向键会按节奏软降",
  );

  await 页面.keyboard.press("p");
  const 暂停时 = await 读取对局();
  await 页面.waitForTimeout(900);
  const 暂停后等待 = await 读取对局();
  断言(暂停时?.阶段 === "暂停", "P 键切换到暂停状态");
  断言(
    JSON.stringify(暂停时?.当前格子) === JSON.stringify(暂停后等待?.当前格子),
    "暂停期间方块位置冻结",
  );
  await 页面.screenshot({ path: "reports/core-gameplay/暂停.png", fullPage: true });
  await 页面.keyboard.press("Escape");
  断言((await 读取对局())?.阶段 === "进行中", "Esc 键恢复对局");

  await 页面.evaluate(() => {
    const 测试窗 = window as unknown as { __再消一行测试__?: 对局测试接口 };
    测试窗.__再消一行测试__?.准备单行消除();
  });
  await 页面.waitForTimeout(100);
  await 页面.keyboard.press("Space");
  const 消行后 = await 读取对局();
  断言(消行后?.消行数 === 1 && 消行后.分数 === 1140, "单行完美清场、硬降得分与升级前等级结算正确");

  await 页面.evaluate(() => {
    const 测试窗 = window as unknown as { __再消一行测试__?: 对局测试接口 };
    测试窗.__再消一行测试__?.设置序列(Array.from({ length: 30 }, () => "O"));
  });
  for (let 次数 = 0; 次数 < 15; 次数 += 1) {
    if ((await 读取对局())?.阶段 === "结束") break;
    await 页面.keyboard.press("Space");
    await 页面.waitForTimeout(70);
  }
  断言((await 读取对局())?.阶段 === "结束", "堆叠至出生碰撞后进入游戏结束");
  await 页面.screenshot({ path: "reports/core-gameplay/结束.png", fullPage: true });

  const 快照 = await 页面.evaluate(() => {
    const 测试窗 = window as unknown as { __GAMEMAKER_TEST__?: 快照测试接口 };
    return 测试窗.__GAMEMAKER_TEST__?.getSnapshot();
  });
  const 重开项 = 快照?.interactives.find((项目) => 项目.name === "restart");
  const 画布 = await 页面.locator("canvas").first().boundingBox();
  断言(Boolean(重开项?.bounds && 画布), "结束画面提供可交互的重新开始按钮");
  if (!重开项?.bounds || !画布 || !快照) throw new Error("找不到重新开始按钮坐标");
  await 页面.waitForTimeout(3100);
  await 页面.mouse.click(
    画布.x + ((重开项.bounds.x + 重开项.bounds.width / 2) / 快照.width) * 画布.width,
    画布.y + ((重开项.bounds.y + 重开项.bounds.height / 2) / 快照.height) * 画布.height,
  );
  await 页面.waitForTimeout(120);
  const 重开后 = await 读取对局();
  断言(
    重开后?.阶段 === "进行中" && 重开后.分数 === 0 && 重开后.消行数 === 0,
    "点击重新开始重置整局状态",
  );
  await 页面.screenshot({ path: "reports/core-gameplay/重新开始.png", fullPage: true });

  // —— 回归：重开后的对局结束时同样写入最佳纪录（结束已存档 必须随重开复位）——
  await 页面.evaluate(() => localStorage.removeItem("neon-pulse:best:马拉松"));
  await 页面.evaluate(() => {
    const 测试窗 = window as unknown as { __再消一行测试__?: 对局测试接口 };
    测试窗.__再消一行测试__?.设置序列(Array.from({ length: 30 }, () => "O"));
  });
  for (let 次数 = 0; 次数 < 15; 次数 += 1) {
    if ((await 读取对局())?.阶段 === "结束") break;
    await 页面.keyboard.press("Space");
    await 页面.waitForTimeout(70);
  }
  const 重开局成绩 = await 读取对局();
  断言(重开局成绩?.阶段 === "结束", "重开后的对局也能堆叠至结束");
  const 最佳纪录 = await 页面.evaluate(
    () =>
      JSON.parse(localStorage.getItem("neon-pulse:best:马拉松") ?? "null") as {
        分数?: number;
      } | null,
  );
  断言(
    (重开局成绩?.分数 ?? 0) > 0 && 最佳纪录?.分数 === 重开局成绩?.分数,
    `重开后的对局结束同样写入最佳纪录（本局 ${重开局成绩?.分数}，纪录 ${最佳纪录?.分数}）`,
  );

  // —— 回归：结算 3 秒锁在后续对局依旧生效 ——
  // 用新结算和固定系统时间验证边界，避免浏览器调度延迟先耗尽 3 秒。
  const 结算测试时刻 = Date.now();
  await 页面.evaluate((时刻) => {
    const 测试窗 = window as unknown as { __验收原时间__?: () => number };
    测试窗.__验收原时间__ = Date.now;
    Date.now = () => 时刻;
  }, 结算测试时刻);
  await 页面.evaluate(() => window.__再消一行测试__?.准备结算(false));
  await 点击测试对象("restart");
  await 页面.waitForTimeout(120);
  断言((await 读取对局())?.阶段 === "结束", "结算 3 秒内的重新开始被忽略");
  await 页面.evaluate((时刻) => {
    Date.now = () => 时刻;
  }, 结算测试时刻 + 2999);
  await 点击测试对象("restart");
  断言((await 读取对局())?.阶段 === "结束", "结算 2999ms 仍不可重开");
  await 页面.evaluate((时刻) => {
    Date.now = () => 时刻;
  }, 结算测试时刻 + 3001);
  await 页面.waitForTimeout(120);
  await 点击测试对象("restart");
  await 页面.waitForTimeout(120);
  断言((await 读取对局())?.阶段 === "进行中", "结算 3 秒后可显式重开");
  await 页面.evaluate(() => {
    const 测试窗 = window as unknown as { __验收原时间__?: () => number };
    Date.now = 测试窗.__验收原时间__ ?? Date.now;
    delete 测试窗.__验收原时间__;
  });

  // —— 回归：每日挑战同日重开序列不变（每次重开都回到当日种子）——
  await 点击测试对象("game.leave");
  await 页面.waitForFunction(() => {
    const 快照窗 = window as unknown as { __GAMEMAKER_TEST__?: 快照测试接口 };
    return 快照窗.__GAMEMAKER_TEST__?.getSnapshot().sceneId === "开始菜单";
  });
  const 返回菜单快照 = await 页面.evaluate(() => {
    const 快照窗 = window as unknown as { __GAMEMAKER_TEST__?: 快照测试接口 };
    return 快照窗.__GAMEMAKER_TEST__?.getSnapshot();
  });
  断言(
    Boolean(
      返回菜单快照?.interactives.some((项目) => 项目.name === "menu.start") &&
        !返回菜单快照.interactives.some((项目) => 项目.name.startsWith("mode.")),
    ),
    "离开对局后主菜单恢复首屏",
  );
  await 点击测试对象("menu.start");
  await 页面.waitForTimeout(120);
  await 点击测试对象("mode.每日挑战");
  await 页面.waitForFunction(() => {
    const 测试窗 = window as unknown as { __再消一行测试__?: 对局测试接口 };
    return Boolean(测试窗.__再消一行测试__);
  });
  const 日期 = new Date().toISOString().slice(0, 10);
  const 当日序列 = 每日方块序列(日期, 14);
  const 读取序列 = async (): Promise<string[]> => {
    const 状态 = await 读取对局();
    return [状态?.当前方块 ?? "", 状态?.下一个方块 ?? ""];
  };
  断言(
    (await 读取序列()).join(",") === 当日序列.slice(0, 2).join(","),
    "每日挑战使用当日固定种子序列",
  );
  for (let 轮次 = 1; 轮次 <= 2; 轮次 += 1) {
    await 页面.keyboard.press("p");
    await 页面.waitForTimeout(150);
    await 点击测试对象("game.pause.restart");
    await 页面.waitForTimeout(150);
    断言(
      (await 读取序列()).join(",") === 当日序列.slice(0, 2).join(","),
      `每日挑战第 ${轮次} 次重开后方块序列与开局一致`,
    );
  }
  await 页面.screenshot({ path: "reports/core-gameplay/每日重开.png", fullPage: true });

  await 页面.waitForTimeout(850);
  断言(页面错误.length === 0, "浏览器控制台与页面无运行时错误");
} finally {
  await 浏览器.close();
}
