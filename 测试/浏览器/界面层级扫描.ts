import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { chromium, type Page } from "playwright";

/**
 * 界面层级扫描：读每页节点树的「名称 → 绘制带」，断言分层语义没被性能优化打穿。
 *
 * 背景：1.2.0 的节点自动分带把弹窗遮罩分到交互带(2)，内容文字在主体带(1)，设置页出现
 * 「文字被黑罩压暗」；商店购买纸页与部位卡文字同带不同纹理，合批按纹理排序把交换了顺序。
 * 状态断言全过，只有肉眼看截图才发现——所以这里直接断言带号，把语义写成可复跑的规则。
 *
 * 规则：
 *  A. 页面级遮罩必须在该页所有内容节点之下（设置:遮罩、关闭对局设置:遮罩）；
 *     弹窗级遮罩必须压住页面内容、且不高于纸页（交易遮罩）。
 *  B. 浮层组（购买确认纸页、对局内设置浮层）的最低带必须严格高于该页内容/卡片/按钮/文字的最高带。
 *  C. 商店部位名称文字带不得低于部位卡底板带。
 *  附：同带风险——浮层组与遮罩/内容同带时，同带内顺序由节点顺序/纹理排序决定（消不掉，只标注）。
 *
 * 用法：bun 测试/浏览器/界面层级扫描.ts [地址]
 * 产物：.gamemaker/报告/机制排查/层级违规.md（违规明细 + 每页节点带 + 同带风险）
 */

type 节点带 = { 名称: string; 带: number; 可见: boolean };

interface 层级客户端 {
  读取节点带(): 节点带[];
  读取状态(): { 场景栈?: string[] };
  进入素材场景(场景: string, 宽?: number, 高?: number, 主题?: string): void;
  设置暂停(暂停: boolean): void;
  准备结算(完赛?: boolean): void;
}

interface 快照 {
  sceneId?: string;
  interactives?: {
    name: string;
    enabled: boolean;
    bounds?: { x: number; y: number; width: number; height: number };
  }[];
}

interface 违规 {
  页面: string;
  规则: string;
  严重度: "高" | "中" | "提示";
  节点: string;
  实际带: number;
  期望: string;
  依据: string;
}

interface 同带风险 {
  页面: string;
  带: number;
  节点: string[];
  说明: string;
}

const 参数 = process.argv.slice(2);
const 地址 = 参数.find((项) => !项.startsWith("--")) ?? "http://127.0.0.1:3000";
const 报告目录 = resolve(".gamemaker/报告/机制排查");
await mkdir(报告目录, { recursive: true });

const 视口 = { 宽: 390, 高: 844, 设备像素比: 1 };
const 页面记录: {
  页名: string;
  页面编号: string;
  场景栈: string[];
  节点: 节点带[];
  备注: string;
}[] = [];
const 违规: 违规[] = [];
const 同带: 同带风险[] = [];
const 跳过: string[] = [];
const 页面错误: string[] = [];

const 记违规 = (项: 违规) => 违规.push(项);

const 桥读取 = (页: Page, 动作: "节点带" | "快照" | "场景栈"): Promise<unknown> =>
  页.evaluate(
    (参) => {
      const 桥 = (window as unknown as { __再消一行测试__: 层级客户端 }).__再消一行测试__;
      if (参.动作 === "节点带") return 桥?.读取节点带?.() ?? [];
      if (参.动作 === "快照") return window.__GAMEMAKER_TEST__?.getSnapshot?.() ?? null;
      const 状态 = 桥?.读取状态?.() as { 场景栈?: string[] } | undefined;
      return 状态?.场景栈 ?? [];
    },
    { 动作 },
  );

const 读取节点 = async (页: Page): Promise<节点带[]> => (await 桥读取(页, "节点带")) as 节点带[];
const 读取场景栈 = async (页: Page): Promise<string[]> => (await 桥读取(页, "场景栈")) as string[];
const 读取页面编号 = async (页: Page): Promise<string> =>
  ((await 桥读取(页, "快照")) as 快照 | null)?.sceneId ?? "";

async function 进入场景(页: Page, 场景: string, 主题 = "极光原野"): Promise<string | null> {
  return 页.evaluate(
    (参) => {
      const 桥 = (window as unknown as { __再消一行测试__: 层级客户端 }).__再消一行测试__;
      try {
        桥.进入素材场景(参.场景, 390, 844, 参.主题);
        return null;
      } catch (错误) {
        return String(错误);
      }
    },
    { 场景, 主题 },
  );
}

async function 等页面(页: Page, 目标: string, 超时毫秒: number): Promise<boolean> {
  const 截止 = Date.now() + 超时毫秒;
  while (Date.now() < 截止) {
    if ((await 读取页面编号(页)) === 目标) return true;
    await 页.waitForTimeout(120);
  }
  return (await 读取页面编号(页)) === 目标;
}

/**
 * 点一个可交互项：页面开合期间界面快照会把按钮标成不可用（防点穿），
 * 所以这里轮询等它可用，而不是读一次没读到就放弃。
 */
async function 点(页: Page, 名称: string, 超时毫秒 = 4000): Promise<boolean> {
  const 截止 = Date.now() + 超时毫秒;
  while (Date.now() < 截止) {
    const 快照 = (await 桥读取(页, "快照")) as 快照 | null;
    const 项 = 快照?.interactives?.find(
      (候选) => 候选.name === 名称 && 候选.enabled && 候选.bounds,
    );
    if (项?.bounds) {
      await 页.mouse.click(项.bounds.x + 项.bounds.width / 2, 项.bounds.y + 项.bounds.height / 2);
      await 页.waitForTimeout(700);
      return true;
    }
    await 页.waitForTimeout(120);
  }
  return false;
}

/** 回根页；被浮层卡住时整页重载，保证下一次导航从干净状态开始。 */
async function 回根(页: Page): Promise<boolean> {
  if ((await 读取页面编号(页)) === "暂停菜单") {
    await 页.evaluate(() =>
      (window as unknown as { __再消一行测试__: 层级客户端 }).__再消一行测试__.设置暂停(false),
    );
    await 页.waitForTimeout(800);
  }
  await 进入场景(页, "主界面");
  if (await 等页面(页, "菜单", 2500)) return true;
  await 页.reload();
  await 页.waitForFunction(() => window.__再消一行测试__ !== undefined, undefined, {
    timeout: 30000,
  });
  await 页.waitForTimeout(1500);
  return (await 读取页面编号(页)) === "菜单";
}

/** 通用断言：按名称前缀分组取带号统计。 */
const 取 = (节点: 节点带[], 谓词: (项: 节点带) => boolean) => 节点.filter(谓词);
const 最高带 = (节点: 节点带[]): number =>
  节点.length ? Math.max(...节点.map((项) => 项.带)) : -1;
const 最低带 = (节点: 节点带[]): number =>
  节点.length ? Math.min(...节点.map((项) => 项.带)) : -1;
const 列出 = (节点: 节点带[]) => 节点.map((项) => `${项.名称}(${项.带})`).join("、");

const 是遮罩 = (项: 节点带) => 项.名称.includes("遮罩");
/** 整页压暗的遮罩：必须垫在本页所有内容之下（设置页）。 */
const 页面级遮罩 = new Set(["设置:遮罩"]);
/** 浮层的遮罩：压住页面内容、垫在浮层之下（对局内设置浮层、商店确认纸页）。 */
const 浮层遮罩 = new Set(["关闭对局设置:遮罩", "交易遮罩"]);

/** 规则 A：页面级遮罩垫底；浮层遮罩压内容、垫浮层。 */
function 检查遮罩(页名: string, 节点: 节点带[]) {
  const 可见 = 节点.filter((项) => 项.可见);
  for (const 遮罩 of 可见.filter(是遮罩)) {
    if (页面级遮罩.has(遮罩.名称)) {
      const 内容 = 可见.filter((项) => !是遮罩(项));
      const 最低内容带 = 最低带(内容);
      if (!(遮罩.带 < 最低内容带))
        记违规({
          页面: 页名,
          规则: "A 页面级遮罩垫底",
          严重度: "高",
          节点: 遮罩.名称,
          实际带: 遮罩.带,
          期望: `< 该页内容最低带 ${最低内容带}`,
          依据: "整页遮罩在内容之上会压暗/盖住文字（1.2.0 设置页就是这个症状）",
        });
    } else if (浮层遮罩.has(遮罩.名称)) {
      // 浮层组：本页的浮层节点（不含遮罩本身）；页面内容：其余可见节点。
      const 浮层组 = 可见.filter((项) => !是遮罩(项) && 是浮层节点(项.名称));
      const 内容 = 可见.filter((项) => !是遮罩(项) && !是浮层节点(项.名称));
      const 内容最高带 = 最高带(内容);
      const 浮层最低带 = 最低带(浮层组);
      if (!(遮罩.带 >= 内容最高带))
        记违规({
          页面: 页名,
          规则: "A 浮层遮罩压住页面内容",
          严重度: "高",
          节点: 遮罩.名称,
          实际带: 遮罩.带,
          期望: `>= 页面内容最高带 ${内容最高带}`,
          依据: "浮层遮罩要压住整页（含卡片与文字），否则浮层背后有亮块",
        });
      // 浮层成员逐个核对：落进遮罩及以下 = 这一项会被浮层遮罩盖住（例如开关消失）。
      const 压在遮罩下 = 浮层组.filter((项) => 项.带 <= 遮罩.带);
      if (压在遮罩下.length)
        记违规({
          页面: 页名,
          规则: "A 浮层成员压在遮罩之下",
          严重度: "高",
          节点: 列出(压在遮罩下),
          实际带: 最低带(压在遮罩下),
          期望: `> 浮层遮罩带 ${遮罩.带}（同组其余成员在带 ${列出(浮层组.filter((项) => 项.带 > 遮罩.带))}）`,
          依据: "浮层内部控件必须整体浮在遮罩之上，否则该控件被压暗/看不见",
        });
      if (遮罩.带 === 浮层最低带)
        同带.push({
          页面: 页名,
          带: 遮罩.带,
          节点: [遮罩.名称, ...浮层组.map((项) => 项.名称)],
          说明: "遮罩与浮层同带：带内绘制顺序由节点顺序与纹理合批决定，不是硬保证",
        });
    } else {
      记违规({
        页面: 页名,
        规则: "A 遮罩未分类",
        严重度: "提示",
        节点: 遮罩.名称,
        实际带: 遮罩.带,
        期望: "归入页面级（整页垫底）或浮层遮罩（压内容、垫浮层）",
        依据: "扫描器需要知道遮罩语义才能断言，未登记的遮罩先标出来",
      });
    }
  }
}

/**
 * 浮层节点判定：按节点语义，不按「名字里带关键词」。
 *
 * 名字里带「对局设置」的既有浮层（对局设置:面板 / 对局设置:文字N），
 * 也有打开浮层的触发按钮（名字就叫「对局设置」，带 2 的普通按钮）；
 * 「继续 / 重新开始 / 返回主菜单 / 继续」同理是页面自己的按钮，不是浮层。
 * 这里只认冒号前缀（`对局设置:`）、明确的遮罩名与浮层内部控件名。
 */
const 是浮层节点 = (名称: string): boolean =>
  ["交易遮罩", "交易面板", "确认交易", "取消交易", "关闭交易", "关闭对局设置:遮罩"].includes(
    名称,
  ) ||
  名称.startsWith("对局设置:") ||
  ["网格", "落点影透明度"].includes(名称);

/** 规则 B：浮层组最低带必须严格高于该页内容（卡片/按钮/文字）的最高带。 */
function 检查浮层组(页名: string, 组名: string, 节点: 节点带[]) {
  const 可见 = 节点.filter((项) => 项.可见);
  const 可见组 = 可见.filter((项) => 是浮层节点(项.名称) && !是遮罩(项));
  const 可见内容 = 可见.filter((项) => !是浮层节点(项.名称));
  if (!可见组.length) {
    跳过.push(`${页名}：${组名}未展开/不可见，跳过该组断言`);
    return;
  }
  const 组最低带 = 最低带(可见组);
  const 内容最高带 = 最高带(可见内容);
  if (!(组最低带 > 内容最高带))
    记违规({
      页面: 页名,
      规则: `B ${组名}压住内容`,
      严重度: "高",
      节点: 列出(可见组),
      实际带: 组最低带,
      期望: `> 内容最高带 ${内容最高带}（内容：${列出(可见内容)}）`,
      依据: `${组名}是浮层，必须在卡片/按钮/文字之上；同带或更低会被内容穿透/压暗`,
    });
}

const 浏览器 = await chromium.launch({ channel: "chrome" });
try {
  const 页 = await 浏览器.newPage({
    viewport: { width: 视口.宽, height: 视口.高 },
    deviceScaleFactor: 视口.设备像素比,
  });
  页.on("pageerror", (错误) => 页面错误.push(错误.message));
  await 页.goto(地址);
  await 页.waitForFunction(() => window.__再消一行测试__ !== undefined, undefined, {
    timeout: 30000,
  });
  await 页.waitForTimeout(1800);

  const 采集 = async (页名: string, 备注: string) => {
    const 节点 = await 读取节点(页);
    const 场景栈 = await 读取场景栈(页);
    const 页面编号 = await 读取页面编号(页);
    页面记录.push({ 页名, 页面编号, 场景栈, 节点, 备注 });
    return 节点;
  };

  // —— 1. 设置：页面级遮罩必须垫底 ——
  if (!(await 回根(页)) || (await 进入场景(页, "设置"))) 跳过.push("设置：进入失败");
  else if (await 等页面(页, "设置", 3000)) {
    const 节点 = await 采集("设置", "遮罩垫底 + 内容/控件在遮罩之上");
    检查遮罩("设置", 节点);
  } else 跳过.push("设置：未到达");

  // —— 2. 商店 + 购买确认纸页 ——
  await 回根(页);
  if (!(await 进入场景(页, "商店")) && (await 等页面(页, "商店", 3000))) {
    const 关 = await 采集("商店（未开确认）", "确认层应隐藏");
    检查遮罩("商店（未开确认）", 关);
    await 点(页, "商店部位:静态背景");
    // 部位卡选中的下一步按钮是「购买:地点.部位」或（已拥有时）「穿戴:地点.部位」，
    // 两者点击都会打开购买确认纸页；整套按钮作兜底。
    let 候选: { name: string }[] = [];
    for (let 次 = 0; 次 < 25; 次++) {
      const 快照 = (await 桥读取(页, "快照")) as 快照 | null;
      候选 = (快照?.interactives ?? []).filter(
        (项) => 项.enabled && (项.name.startsWith("购买:") || 项.name.startsWith("穿戴:")),
      );
      if (候选.length) break;
      await 页.waitForTimeout(120);
    }
    for (const 项 of 候选) {
      if (await 点(页, 项.name)) break;
    }
    // 等纸页真的可见：点击到开合动画之间有一小段，不能立刻采节点。
    let 纸页可见 = false;
    for (let 次 = 0; 次 < 12; 次++) {
      const 当前 = await 读取节点(页);
      if (当前.some((项) => 项.名称 === "交易面板" && 项.可见)) {
        纸页可见 = true;
        break;
      }
      await 页.waitForTimeout(200);
    }
    const 节点 = await 采集(
      "商店（购买确认打开）",
      纸页可见 ? "纸页压住部位卡与名称" : "纸页没打开，只核对未开态",
    );
    检查遮罩("商店（购买确认打开）", 节点);
    检查浮层组("商店（购买确认打开）", "购买确认纸页", 节点);
    // 规则 C：商店部位名称文字不得低于部位卡底板（不依赖确认纸页是否打开）。
    const 部位卡 = 取(节点, (项) => 项.名称.startsWith("商店部位:"));
    for (const 名称节点 of 取(节点, (项) => 项.名称.startsWith("商店部位名称:"))) {
      const 部位 = 名称节点.名称.split(":")[1] ?? "";
      const 卡 = 部位卡.find((项) => 项.名称 === `商店部位:${部位}`);
      if (!卡) continue;
      if (名称节点.带 < 卡.带)
        记违规({
          页面: "商店",
          规则: "C 部位名称不低于卡片底板",
          严重度: "高",
          节点: 名称节点.名称,
          实际带: 名称节点.带,
          期望: `>= ${卡.名称} 的带 ${卡.带}`,
          依据: "名称是卡片自己的文字，带更低会被卡片底板盖住",
        });
    }
    if (!纸页可见) 跳过.push("商店：购买确认纸页没有打开（点击后仍隐藏）");
  } else 跳过.push("商店：未到达");

  // —— 3. 暂停菜单 + 对局内设置浮层 ——
  await 回根(页);
  await 进入场景(页, "对局");
  if (await 等页面(页, "对局", 4000)) {
    await 页.waitForTimeout(1200);
    await 页.evaluate(() =>
      (window as unknown as { __再消一行测试__: 层级客户端 }).__再消一行测试__.设置暂停(true),
    );
    if (await 等页面(页, "暂停菜单", 3000)) {
      await 采集("暂停菜单", "暂停面板与按钮；设置浮层此时隐藏");
      // 开合动画期间界面快照会把按钮标不可用，点完还要等浮层真的可见再采节点；
      // 命中偶尔被开合吞掉，重试一次。
      let 已打开 = false;
      for (let 次 = 0; 次 < 2 && !已打开; 次++) {
        if (!(await 点(页, "对局设置"))) break;
        for (let 等 = 0; 等 < 20; 等++) {
          const 当前 = await 读取节点(页);
          if (当前.some((项) => 项.名称 === "对局设置:面板" && 项.可见)) {
            已打开 = true;
            break;
          }
          await 页.waitForTimeout(100);
        }
      }
      const 节点 = await 采集(
        "暂停菜单（对局设置打开）",
        已打开 ? "设置浮层压住暂停按钮与文字" : "浮层没展开，暂停菜单态",
      );
      if (已打开) {
        检查遮罩("暂停菜单（对局设置打开）", 节点);
        检查浮层组("暂停菜单（对局设置打开）", "对局内设置浮层", 节点);
      } else 跳过.push("暂停菜单：点了对局设置但浮层仍隐藏");
    } else 跳过.push("暂停菜单：设置暂停后未到达");
  } else 跳过.push("暂停菜单：对局未到达");

  // —— 4. 结算页 ——
  await 回根(页);
  await 进入场景(页, "对局");
  await 等页面(页, "对局", 4000);
  await 页.waitForTimeout(1200);
  // 已在对局页，素材桥的结算场景才能排进准备结算（跳页途中会被后到的进入重置）。
  await 进入场景(页, "结算失败");
  if (!(await 等页面(页, "结算", 5000))) {
    await 页.evaluate(() =>
      (window as unknown as { __再消一行测试__: 层级客户端 }).__再消一行测试__.准备结算(false),
    );
    await 等页面(页, "结算", 4000);
  }
  if (await 等页面(页, "结算", 500)) {
    const 节点 = await 采集("结算", "结算页是浮在 对局 上的独立页面：跨页层级由场景栈保证");
    // 规则 B 的页面内版本：页内按钮必须高于演出/飘字内容。
    const 按钮 = 取(节点, (项) => ["重新开始", "返回主菜单", "重试奖励"].includes(项.名称));
    const 页内容 = 取(节点, (项) => 项.名称.startsWith("结算:"));
    if (按钮.length && 页内容.length && !(最低带(按钮) > 最高带(页内容)))
      记违规({
        页面: "结算",
        规则: "B 页内按钮压住演出内容",
        严重度: "高",
        节点: 列出(按钮),
        实际带: 最低带(按钮),
        期望: `> 演出/飘字最高带 ${最高带(页内容)}`,
        依据: "结算页内按钮必须在演出底板上方，否则点不到或看不见",
      });
    // 跨页：场景栈里 结算 必须排在 对局 之后。
    const 栈 = await 读取场景栈(页);
    const 对局位 = 栈.indexOf("对局");
    const 结算位 = 栈.indexOf("结算");
    if (!(对局位 >= 0 && 结算位 > 对局位))
      记违规({
        页面: "结算",
        规则: "B 结算浮在对局之上（跨页）",
        严重度: "高",
        节点: `场景栈 ${栈.join(" → ")}`,
        实际带: 结算位,
        期望: "场景栈中 结算 排在 对局 之后",
        依据: "结算与对局是不同页面，绘制带不可跨页比较，层级只能由场景栈保证",
      });
  } else 跳过.push("结算：未到达结算页");

  // —— 5/6/7. 成就、排行榜、纯享 ——
  for (const 场景 of ["成就", "排行榜"] as const) {
    await 回根(页);
    const 错误 = await 进入场景(页, 场景);
    if (错误) {
      跳过.push(`${场景}：${错误}`);
      continue;
    }
    if (await 等页面(页, 场景, 3000)) {
      const 节点 = await 采集(场景, "单页无浮层：只核对遮罩/名称规则");
      检查遮罩(场景, 节点);
    } else 跳过.push(`${场景}：未到达`);
  }

  await 回根(页);
  {
    // 纯享没有素材场景名：主界面点空白处进入（菜单页手势组件的点击行为）。
    await 页.mouse.click(40, 740);
    const 到了 = await 等页面(页, "纯享", 4000);
    if (到了) {
      const 节点 = await 采集("纯享", "无浮层：只核对遮罩/名称规则");
      检查遮罩("纯享", 节点);
    } else {
      await 回根(页);
      await 进入场景(页, "商店");
      await 等页面(页, "商店", 3000);
      const 点击 = await 点(页, "商店:纯享");
      if (点击 && (await 等页面(页, "纯享", 4000))) {
        const 节点 = await 采集("纯享", "从商店入口进入");
        检查遮罩("纯享", 节点);
      } else 跳过.push("纯享：两个入口都没进入");
    }
  }
} finally {
  await 浏览器.close();
}

// —— 输出 ——
const 排序 = (项: 违规) => ({ 高: 0, 中: 1, 提示: 2 })[项.严重度];
const 已排序 = [...违规].sort((甲, 乙) => 排序(甲) - 排序(乙));
for (const 项 of 已排序)
  console.log(
    `[${项.严重度}] ${项.页面}｜${项.规则}｜${项.节点}｜带 ${项.实际带}｜期望 ${项.期望}`,
  );
for (const 项 of 页面记录)
  console.log(`\n## ${项.页名}（页面 ${项.页面编号}，栈 ${项.场景栈.join(" → ")}）\n${项.备注}`);

const 行 = [
  "# 界面层级违规",
  "",
  `- 地址：${地址}｜视口 ${视口.宽}×${视口.高} @${视口.设备像素比}x`,
  `- 时间：${new Date().toISOString()}`,
  `- 违规 ${违规.length} 条｜同带风险 ${同带.length} 条｜跳过 ${跳过.length} 项｜页面错误 ${页面错误.length} 个`,
  "",
  "规则：A 页面级遮罩垫底 / 弹窗级遮罩压内容不压纸页；B 浮层组最低带严格高于内容最高带；C 部位名称不低于卡片底板。",
  "",
  "## 违规（按严重度）",
  "",
];
if (!已排序.length) 行.push("- 无");
for (const 项 of 已排序)
  行.push(
    `### [${项.严重度}] ${项.页面} · ${项.规则}`,
    "",
    `- 节点：${项.节点}`,
    `- 实际带：${项.实际带}`,
    `- 期望：${项.期望}`,
    `- 依据：${项.依据}`,
    "",
  );
行.push("## 违规页面清单", "");
const 按页 = new Map<string, 违规[]>();
for (const 项 of 已排序) 按页.set(项.页面, [...(按页.get(项.页面) ?? []), 项]);
if (!按页.size) 行.push("- 无");
for (const [页名, 项] of 按页)
  行.push(
    `- **${页名}**：${项.length} 条（${[...new Set(项.map((一条) => 一条.规则))].join("、")}）${项.some((一条) => 一条.严重度 === "高") ? "｜有高危" : ""}`,
  );
行.push("", "## 同带风险", "");
if (!同带.length) 行.push("- 无");
for (const 项 of 同带) 行.push(`- ${项.页面}｜带 ${项.带}｜${项.节点.join("、")}：${项.说明}`);
行.push("", "## 跳过", "");
if (!跳过.length) 行.push("- 无");
for (const 项 of 跳过) 行.push(`- ${项}`);
if (页面错误.length) {
  行.push("", "## 页面错误", "");
  for (const 项 of 页面错误) 行.push(`- ${项}`);
}
行.push("", "## 每页节点带", "");
for (const 记录 of 页面记录) {
  行.push(
    `### ${记录.页名}（页面 ${记录.页面编号}）`,
    "",
    `- 场景栈：${记录.场景栈.join(" → ")}`,
    `- 备注：${记录.备注}`,
    "",
  );
  const 按带 = new Map<number, string[]>();
  for (const 项 of 记录.节点) {
    const 列 = 按带.get(项.带) ?? [];
    列.push(`${项.可见 ? "" : "(隐)"}${项.名称}`);
    按带.set(项.带, 列);
  }
  for (const 带 of [...按带.keys()].sort((甲, 乙) => 甲 - 乙))
    行.push(`- 带 ${带}：${(按带.get(带) ?? []).join("、")}`);
  行.push("");
}
await writeFile(join(报告目录, "层级违规.md"), `${行.join("\n")}\n`, "utf8");

console.log(
  `\n违规 ${违规.length} 条（高危 ${违规.filter((项) => 项.严重度 === "高").length}）｜同带风险 ${同带.length} 条｜跳过 ${跳过.length} 项`,
);
console.log(`报告：${join(报告目录, "层级违规.md")}`);
