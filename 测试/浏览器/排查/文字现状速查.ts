import { mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { chromium } from "playwright";

/**
 * 一次性排查脚本：五主题 × 关键界面截图，用于人工看「文字看不清」。
 * 不是验收：只出图，不做断言。产物 .gamemaker/报告/文字现状速查/。
 */
const 地址 = process.argv[2] ?? "http://127.0.0.1:3010";
const 输出 = resolve(process.argv[3] ?? ".gamemaker/报告/文字现状速查");
const 主题列表 = ["极光原野", "砖机液晶", "街机彩砖", "立体晶格", "糖果超甜"] as const;
const 场景列表 = ["菜单", "设置", "成就", "排行榜", "商店", "模式选择"] as const;
await mkdir(输出, { recursive: true });

type 统计项 = {
  主题: string;
  场景: string;
  页数: number;
  文字KB: number;
  总纹理KB: number;
  绘制调用: number;
  绘制批数: number;
  烘焙字号: number[];
  共享页: string[];
};
const 记录: 统计项[] = [];
const 取统计 = async (页: import("playwright").Page, 主题: string, 场景: string) => {
  const 统计 = await 页.evaluate(() => window.__three版__?.读取统计());
  const 图集 = 统计?.文字图集;
  return {
    主题,
    场景,
    页数: 图集?.页数 ?? 0,
    文字KB: Math.round((图集?.纹理字节 ?? 0) / 1024),
    总纹理KB: Math.round((统计?.渲染.纹理字节 ?? 0) / 1024),
    绘制调用: 统计?.渲染.绘制调用 ?? 0,
    绘制批数: 统计?.合批.绘制批数 ?? 0,
    烘焙字号: [...(图集?.烘焙字号列表 ?? [])],
    共享页: (图集?.页明细 ?? []).map((项) => `${项.宽}x${项.高}/${项.字形数}`),
  };
};

const 浏览器 = await chromium.launch({ channel: "chrome" });
try {
  for (const 主题 of 主题列表) {
    const 上下文 = await 浏览器.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 1,
    });
    const 页 = await 上下文.newPage();
    await 页.goto(地址);
    await 页.waitForFunction(() => window.__three版__ !== undefined, undefined, { timeout: 20000 });
    await 页.waitForTimeout(500);
    for (const 场景 of 场景列表) {
      await 页.evaluate(
        (参数) => window.__再消一行测试__?.进入素材场景(参数.场景, 390, 844, 参数.主题),
        { 场景, 主题 },
      );
      await 页.waitForTimeout(700);
      await 页.screenshot({ path: join(输出, `${主题}-${场景}.png`) });
      记录.push(await 取统计(页, 主题, 场景));
      console.log(`截图 ${主题}/${场景}`);
    }
    // 对局需要一个真实局面，再截暂停面板。
    await 页.evaluate(
      (参数) => window.__再消一行测试__?.进入素材场景("对局", 390, 844, 参数.主题),
      { 主题 },
    );
    await 页.waitForTimeout(800);
    for (let 次 = 0; 次 < 6; 次++) {
      await 页.evaluate(() => window.__再消一行测试__?.硬降());
      await 页.waitForTimeout(80);
    }
    await 页.evaluate(() =>
      window.__再消一行测试__?.快进后期({ 消行数: 40, 分数: 12345, 最长连击: 3, 堆叠行: 8 }),
    );
    await 页.waitForTimeout(500);
    await 页.screenshot({ path: join(输出, `${主题}-对局.png`) });
    记录.push(await 取统计(页, 主题, "对局"));
    console.log(`截图 ${主题}/对局`);
    await 页.evaluate(() => window.__再消一行测试__?.设置暂停(true));
    await 页.waitForTimeout(800);
    await 页.screenshot({ path: join(输出, `${主题}-暂停.png`) });
    记录.push(await 取统计(页, 主题, "暂停"));
    console.log(`截图 ${主题}/暂停`);
    await 页.evaluate(() => window.__再消一行测试__?.设置暂停(false));
    await 页.waitForTimeout(300);
    await 页.evaluate(
      (参数) => window.__再消一行测试__?.进入素材场景("结算成功", 390, 844, 参数.主题),
      { 主题 },
    );
    await 页.waitForTimeout(1200);
    await 页.screenshot({ path: join(输出, `${主题}-结算.png`) });
    记录.push(await 取统计(页, 主题, "结算"));
    console.log(`截图 ${主题}/结算`);
    await 上下文.close();
  }
} finally {
  await 浏览器.close();
}
await Bun.write(join(输出, "统计.json"), JSON.stringify(记录, null, 2));
const 峰值 = 记录.reduce(
  (合计, 当前) => ({
    页数: Math.max(合计.页数, 当前.页数),
    文字KB: Math.max(合计.文字KB, 当前.文字KB),
    总纹理KB: Math.max(合计.总纹理KB, 当前.总纹理KB),
    绘制调用: Math.max(合计.绘制调用, 当前.绘制调用),
  }),
  { 页数: 0, 文字KB: 0, 总纹理KB: 0, 绘制调用: 0 },
);
console.log("峰值:", JSON.stringify(峰值));
