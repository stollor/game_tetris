import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { chromium } from "playwright";
import type { 矩形 } from "../../.gamemaker/依赖/框架/界面/绘制/协议";
import type {} from "../../代码/应用/启动";
import type { 界面按钮快照 } from "../../代码/应用/接口/上下文";

/**
 * 商店主题适配验收（390×844 DPR1，只截当前视口）。
 *
 * 判据分两层：
 * 1. 取图：四套主题在商店里各截「方块陈列 / 界面示意 / 交易纸页」，人工看风格是否成立；
 * 2. 取色：坞区托底、单件按钮、目录缩略图必须取自当前浏览主题自己的规范，
 *    防止回退成「所有主题都用极光原野的玻璃与纸页」。
 *
 * 期望色的出处：极光=基础配色.极光原野.面板.主面板.背景 / 收藏色.墨；
 * 砖机液晶=像素四色.远(坞区)、底(纸)、街机彩砖=像素色盘.远(坞区)、纸(纸)、
 * 立体晶格=立体规范.界面.板（金属板受光面）。改配色要同步改这里的期望值。
 */

const 地址 = process.argv[2] ?? "http://127.0.0.1:3000";
const 输出 = resolve(".gamemaker/报告/商店主题");
await mkdir(输出, { recursive: true });

const 期望: Record<string, { 坞区: number | null; 按钮: number }> = {
  极光原野: { 坞区: 0x102b4d, 按钮: 0x28433f },
  砖机液晶: { 坞区: 0x306230, 按钮: 0x9bbc0f },
  街机彩砖: { 坞区: 0x0e1220, 按钮: 0x243044 },
  // 立体金属板的坞区被受光面提亮，不比精确值；按钮面板是未提亮的 板 色。
  立体晶格: { 坞区: null, 按钮: 0x163a58 },
};
const 液晶底 = 0x9bbc0f;
const 极光坞区 = 0x102b4d;
const 主题顺序 = ["极光原野", "砖机液晶", "街机彩砖", "立体晶格"] as const;

type 像素 = { r: number; g: number; b: number };
const 色 = (值: number): 像素 => ({ r: (值 >> 16) & 0xff, g: (值 >> 8) & 0xff, b: 值 & 0xff });
const 同色 = (实际: 像素, 期望值: number) =>
  Math.abs(实际.r - 色(期望值).r) <= 1 &&
  Math.abs(实际.g - 色(期望值).g) <= 1 &&
  Math.abs(实际.b - 色(期望值).b) <= 1;
function 取样值(表: Record<string, 像素>, 键: string): 像素 {
  const 值 = 表[键];
  if (!值) throw new Error(`截图里没有采到 ${键}`);
  return 值;
}
const 十六 = (值: 像素) =>
  `#${[值.r, 值.g, 值.b].map((项) => 项.toString(16).padStart(2, "0")).join("")}`;

const 浏览器 = await chromium.launch({ channel: "chrome" });
const 页 = await (
  await 浏览器.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 })
).newPage();
const 页面错误: string[] = [];
页.on("pageerror", (错) => 页面错误.push(错.message));
页.on("console", (消) => {
  if (消.type() === "error" && !消.text().includes("/control?project=")) 页面错误.push(消.text());
});

const 界面 = () => 页.evaluate(() => window.__three版__?.读取界面());
const 文字快照 = async () => (await 界面())?.文字 ?? [];
async function 按钮(名称片段: string): Promise<界面按钮快照> {
  await 页
    .waitForFunction(
      (片段) => window.__three版__?.读取界面().按钮.some((键) => 键.名称.includes(片段)),
      名称片段,
      { timeout: 8000 },
    )
    .catch(() => {
      throw new Error(`未找到按钮 ${名称片段}`);
    });
  const 键 = (await 界面())?.按钮.find((项) => 项.名称.includes(名称片段));
  if (!键) throw new Error(`未找到按钮 ${名称片段}`);
  return 键;
}
async function 点(片段: string) {
  const 键 = await 按钮(片段);
  await 页.mouse.click(键.左 + 键.宽 / 2, 键.上 + 键.高 / 2);
  await 页.waitForTimeout(340);
}
/** 目录卡被横向裁剪视口夹住，贴边时把点击点夹回可视区。 */
async function 点目录卡(名称: string) {
  const 键 = await 按钮(`商店地点:${名称}`);
  const 左 = Math.max(键.左 + 2, 20);
  const 右 = Math.min(键.左 + 键.宽 - 2, 370);
  await 页.mouse.click((左 + 右) / 2, 键.上 + 键.高 / 2);
  await 页.waitForTimeout(340);
  const 地点 = (await 文字快照()).find((项) => 项.startsWith("地点:"));
  assert.equal(地点, `地点:${名称}`, `切换主题失败：期望 ${名称}，实际 ${地点}`);
}
const 等落位 = () =>
  页.waitForFunction(() => !window.__three版__?.读取界面().文字?.includes("页面开合:播放中"), {
    timeout: 8000,
  });

/** 区域统计：平均亮度（0~1）与明显亮点像素数，用来判断缩略图「能不能看出东西」。 */
export interface 区域统计 {
  平均亮度: number;
  亮点数: number;
}

/** 截当前视口，并在页内解回像素：点集取色、区域集取亮度分布。 */
async function 截图并采样(
  名称: string,
  点集: Record<string, [number, number]>,
  区域集: Record<string, 矩形> = {},
): Promise<{ 点: Record<string, 像素>; 区域: Record<string, 区域统计> }> {
  const 路径 = join(输出, `${名称}.png`);
  const 缓冲 = await 页.screenshot({ path: 路径 });
  const 结果 = await 页.evaluate(
    async ({ 基址, 点集, 区域集 }) => {
      const 图 = new Image();
      图.src = 基址;
      await 图.decode();
      const 画 = document.createElement("canvas");
      画.width = 图.naturalWidth;
      画.height = 图.naturalHeight;
      const 上 = 画.getContext("2d");
      if (!上) throw new Error("无 2d 上下文");
      上.drawImage(图, 0, 0);
      const 点: Record<string, { r: number; g: number; b: number }> = {};
      for (const [键, [x, y]] of Object.entries(点集)) {
        const 数据 = 上.getImageData(x, y, 1, 1).data as unknown as number[];
        const [r, g, b] = 数据;
        点[键] = { r: r ?? 0, g: g ?? 0, b: b ?? 0 };
      }
      const 区域: Record<string, { 平均亮度: number; 亮点数: number }> = {};
      for (const [键, 区] of Object.entries(区域集)) {
        const 数据 = 上.getImageData(区.左, 区.上, 区.宽, 区.高).data as unknown as number[];
        let 合计 = 0;
        let 亮点数 = 0;
        for (let i = 0; i < 数据.length; i += 4) {
          const 亮 =
            ((数据[i] ?? 0) * 0.2126 + (数据[i + 1] ?? 0) * 0.7152 + (数据[i + 2] ?? 0) * 0.0722) /
            255;
          合计 += 亮;
          if (亮 > 0.3) 亮点数 += 1;
        }
        区域[键] = { 平均亮度: 合计 / Math.max(1, 数据.length / 4), 亮点数 };
      }
      return { 点, 区域 };
    },
    {
      基址: `data:image/png;base64,${缓冲.toString("base64")}`,
      点集,
      区域集,
    },
  );
  return 结果;
}

try {
  await 页.goto(地址);
  await 页.waitForFunction(() => window.__three版__ !== undefined, undefined, { timeout: 20000 });
  await 页.waitForTimeout(500);
  await 页.evaluate(() => window.__three版__?.增加金币(99999));
  await 点("商店");
  await 等落位();
  await 页.waitForTimeout(600);

  for (const 名称 of 主题顺序) {
    const 期望色 = 期望[名称];
    assert.ok(期望色, `缺少 ${名称} 的期望色`);
    await 点目录卡(名称);
    await 等落位();
    await 页.waitForTimeout(450);

    // 目录缩略图中心：用按钮矩形算，避免横向滚动偏移带来的硬编码坐标。
    const 目录卡 = await 按钮(`商店地点:${名称}`);
    const 缩略区 = {
      左: Math.round(目录卡.左 + 4),
      上: Math.round(目录卡.上 + 4),
      宽: Math.round(目录卡.宽 - 8),
      高: Math.round(目录卡.高 - 30),
    };
    const 主图 = await 截图并采样(名称, { 坞区: [200, 504], 按钮: [40, 640] }, { 缩略: 缩略区 });
    const 取样 = 主图.点;
    // 主陈列图已存；再补界面示意与交易纸页两张。
    await 点("商店部位:界面样式");
    await 等落位();
    await 截图并采样(`${名称}-界面`, {});
    await 点("商店部位:方块外观");
    await 点("整套");
    await 页.waitForTimeout(220);
    await 截图并采样(`${名称}-交易`, {});
    await 点("取消交易");
    await 点("商店部位:方块外观");

    assert.ok(
      同色(取样值(取样, "按钮"), 期望色.按钮),
      `${名称} 单件按钮应为主题色 ${期望色.按钮.toString(16)}，实际 ${十六(取样值(取样, "按钮"))}`,
    );
    if (期望色.坞区 === null) {
      assert.ok(
        !同色(取样值(取样, "坞区"), 极光坞区),
        `${名称} 坞区仍是极光原野的玻璃底 ${十六(取样值(取样, "坞区"))}`,
      );
    } else {
      assert.ok(
        同色(取样值(取样, "坞区"), 期望色.坞区),
        `${名称} 坞区应为 ${期望色.坞区.toString(16)}，实际 ${十六(取样值(取样, "坞区"))}`,
      );
    }
    // 四张缩略图都得「看得出东西」：不能是一块纯色板或一片黑。
    const 缩略统计 = 主图.区域.缩略;
    assert.ok(缩略统计, `${名称} 未取到缩略图统计`);
    assert.ok(
      缩略统计.亮点数 > 40,
      `${名称} 缩略图没有内容：亮点 ${缩略统计.亮点数} 个，平均亮度 ${缩略统计.平均亮度.toFixed(3)}`,
    );
    // 缩略底按「被浏览主题的名字」画：液晶主题的屏内必须是自己的四色底。
    if (名称 === "砖机液晶") {
      const 屏内: [number, number] = [Math.round(目录卡.左 + 12), Math.round(目录卡.上 + 12)];
      const 取 = await 截图并采样(`${名称}-缩略`, { 屏内 });
      assert.ok(
        同色(取样值(取.点, "屏内"), 液晶底),
        `砖机液晶缩略底应为液晶底，实际 ${十六(取样值(取.点, "屏内"))}`,
      );
    }
    // 立体晶格的缩略图不能是「黑乎乎一块」：厅里的立方要够亮。
    if (名称 === "立体晶格") {
      assert.ok(
        缩略统计.平均亮度 > 0.05,
        `立体晶格缩略图太黑：平均亮度 ${缩略统计.平均亮度.toFixed(3)}`,
      );
      assert.ok(缩略统计.亮点数 > 60, `立体晶格缩略图没有亮点：${缩略统计.亮点数} 个`);
    }
    console.log(`✓ ${名称}`);
  }

  assert.deepEqual(页面错误, [], `页面错误：${页面错误.join("；")}`);
  console.log("OK 商店主题验收通过", JSON.stringify({ 输出 }));
} catch (错) {
  console.log("FAIL", String(错));
  process.exitCode = 1;
} finally {
  await 浏览器.close();
}
