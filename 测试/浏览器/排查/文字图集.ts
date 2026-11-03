import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { chromium } from "playwright";
import type { 调试状态, 调试统计 } from "../../../代码/应用/启动";

/**
 * 文字图集排查：真实 canvas 下核对「多字号共享页 + 字号复用」的落点。
 * 只看图集数/页数/纹理字节/页面边长/绘制调用与截图，不做视觉断言；截图必须人工查看。
 * 运行：先在另一个终端 `bun run dev`，再 `bun 测试/浏览器/排查/文字图集.ts <地址>`。
 */

const 地址 = process.argv[2] ?? "http://127.0.0.1:3004";
const DPR = Number(process.argv.find((项) => 项.startsWith("--DPR="))?.split("=")[1] ?? 1);
const 输出 = resolve(".gamemaker/报告/文字图集");
await mkdir(输出, { recursive: true });

type 文字图集统计 = {
  图集数: number;
  页数: number;
  纹理字节: number;
  图集列表: { 键: string; 字号: number; 页数: number; 字形数: number; 页面边长: number }[];
  烘焙字号列表?: number[];
  字号复用?: boolean;
  待确认退役图集数?: number;
  强制退役释放数?: number;
};

type 记录 = {
  步骤: string;
  页面: string;
  文字图集: 文字图集统计;
  绘制调用: number;
  四边形数: number;
};

const 浏览器 = await chromium.launch({ channel: "chrome" });
try {
  const 页 = await 浏览器.newPage({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: DPR,
  });
  const 页面错误: string[] = [];
  页.on("pageerror", (错误) => 页面错误.push(错误.message));
  页.on("console", (消息) => {
    if (消息.type() === "error" && !消息.text().includes("/control?project="))
      页面错误.push(消息.text());
  });
  await 页.goto(地址);
  await 页.waitForFunction(() => window.__three版__ !== undefined, undefined, { timeout: 20000 });
  await 页.waitForTimeout(500);

  const 读取统计 = async (): Promise<调试统计> => {
    const 统计 = await 页.evaluate(() => window.__three版__?.读取统计());
    if (!统计) throw new Error("读取统计失败");
    return 统计;
  };
  const 读取状态 = async (): Promise<调试状态> => {
    const 状态 = await 页.evaluate(() => window.__three版__?.读取状态());
    if (!状态) throw new Error("读取状态失败");
    return 状态;
  };
  const 读取界面 = async () =>
    (await 页.evaluate(() => window.__three版__?.读取界面())) ?? { 按钮: [] };
  const 等待开合 = () =>
    页.waitForFunction(() => window.__three版__?.读取界面开合中?.() === false, undefined, {
      timeout: 8000,
    });
  const 点按钮 = async (候选: readonly string[]): Promise<string | null> => {
    await 等待开合();
    const 界面 = await 读取界面();
    const 按钮 = 界面.按钮.find((项) => 候选.includes(项.名称) && 项.可用 !== false);
    if (!按钮) return null;
    await 页.mouse.click(按钮.左 + 按钮.宽 / 2, 按钮.上 + 按钮.高 / 2);
    await 页.waitForTimeout(320);
    return 按钮.名称;
  };
  const 记录表: 记录[] = [];
  const 记录 = async (步骤: string) => {
    const 统计 = await 读取统计();
    const 状态 = await 读取状态();
    const 图集 = 统计.文字图集;
    记录表.push({
      步骤,
      页面: 状态.页面,
      文字图集: 图集,
      绘制调用: 统计.渲染.绘制调用,
      四边形数: 统计.合批.四边形数,
    });
    console.log(
      `[${步骤}] 页面=${状态.页面} 图集=${图集.图集数} 页=${图集.页数} ` +
        `纹理=${(图集.纹理字节 / 1024).toFixed(0)}KB 边长=${Math.max(...图集.图集列表.map((项) => 项.页面边长), 0)} ` +
        `绘制调用=${统计.渲染.绘制调用} 四边形=${统计.合批.四边形数}`,
    );
  };

  await 记录("主菜单");
  await 页.screenshot({ path: join(输出, "主菜单.png") });

  // 像素主题：像素化字体与常规字体共用同一页，验证像素格不错位。
  const 主题列表 = ["砖机液晶", "街机彩砖", "立体晶格", "极光原野"] as const;
  for (const 主题 of 主题列表) {
    // 素材场景入口会按正式购买路径临时解锁主题，不写存档。
    await 页.evaluate((名) => window.__再消一行测试__?.进入素材场景("商店", 390, 844, 名), 主题);
    await 页.waitForTimeout(600);
    await 记录(`主题：${主题}`);
    await 页.screenshot({ path: join(输出, `主题-${主题}.png`) });
  }
  await 页.evaluate(() => window.__再消一行测试__?.进入素材场景("菜单", 390, 844));
  await 页.waitForTimeout(400);

  for (const 名称 of ["设置", "成就", "排行榜", "商店"]) {
    const 点中 = await 点按钮([名称]);
    if (!点中) {
      console.log(`[跳过] 主菜单没有「${名称}」按钮`);
      continue;
    }
    await 等待开合();
    await 页.waitForTimeout(260);
    await 记录(`覆盖页：${名称}`);
    await 页.screenshot({ path: join(输出, `覆盖页-${名称}.png`) });
    // 逐层返回主菜单。
    for (let 次 = 0; 次 < 3; 次++) {
      if ((await 读取状态()).页面 === "菜单") break;
      if (!(await 点按钮(["返回主菜单", "返回", "关闭"]))) break;
      await 等待开合();
    }
  }

  const 开始 = await 点按钮(["开始游戏", "单人", "马拉松", "经典"]);
  if (开始) {
    await 页.waitForTimeout(600);
    for (let 次 = 0; 次 < 8; 次++) {
      await 页.evaluate(() => window.__再消一行测试__?.硬降());
      await 页.waitForTimeout(120);
    }
    await 记录("对局：马拉松");
    await 页.screenshot({ path: join(输出, "对局-马拉松.png") });
  }

  const 结束统计 = await 读取统计();
  const 图集 = 结束统计.文字图集;
  const 结果 = {
    地址,
    页面错误,
    记录: 记录表,
    最终: 图集,
    烘焙字号: 图集.烘焙字号列表 ?? [],
    每页边长: [...new Set(图集.图集列表.map((项) => 项.页面边长))].sort((甲, 乙) => 甲 - 乙),
  };
  await writeFile(
    join(输出, DPR === 1 ? "结果.json" : `结果-DPR${DPR}.json`),
    JSON.stringify(结果, null, 2),
    "utf8",
  );
  console.log(JSON.stringify(结果.最终, null, 2));

  assert.equal(页面错误.length, 0, `页面报错：${页面错误.join("；")}`);
  assert.ok(图集.页数 >= 1 && 图集.页数 <= 4, `文字图集页数异常：${图集.页数}`);
  // 图集数是「字体 × 字重 × 烘焙档位」的子图集索引，可以多；关键是共享页与页数。
  assert.ok(图集.图集数 <= 24, `文字图集子索引异常：${图集.图集数}`);
  const 共享页 = 图集.页明细 ?? [];
  assert.ok(共享页.length <= 3, `共享文字页过多：${共享页.length}`);
  assert.ok(
    图集.图集列表.every((项) => 项.页面边长 <= 2048),
    "图集页超过 2048",
  );
  assert.ok(
    记录表.every((项) => 项.绘制调用 <= 12),
    "绘制调用超过 12",
  );
} finally {
  await 浏览器.close();
}
