import { mkdir } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import { chromium } from "playwright";

/**
 * 文字 DPI 最小实验：把「同一字号、同一文案」用不同光栅像素比 / 四边形对齐方式
 * 画进 390 逻辑宽度下 DPR1 的渲染编排，再与 DOM canvas 2D 参考（1x 直绘、2x 降采样、
 * 8x 超采样）逐行对照，用来定位 DPR1 小字发虚/缺笔画是光栅分辨率还是合批定位造成的。
 * Chromium 模拟视口，由同目录分析脚本做像素统计。
 */
const 输出 = resolve(process.argv[2] ?? ".gamemaker/报告/视觉返工/文字DPI复核/最小实验");
await mkdir(输出, { recursive: true });
// 入口脚本属于运行缓存，不落进 reports；相对路径按仓库根生成。
const 入口目录 = resolve(".gamemaker/文字DPI最小实验");
await mkdir(入口目录, { recursive: true });
const 入口 = join(入口目录, "入口.ts");
const 前缀 = relative(入口目录, resolve(".")).replaceAll("\\", "/") + "/";

const 实验源码 = `
import { 创建渲染编排 } from "${前缀}.gamemaker/依赖/框架/世界/渲染编排";
import { 图元合批 } from "${前缀}.gamemaker/依赖/框架/界面/图元合批";
import { 创建文字图集 } from "${前缀}.gamemaker/依赖/框架/界面/文字图集";

const 字体 = '"Segoe UI", "Microsoft YaHei", sans-serif';
const 字号 = 13;
const 文案 = "触屏功能提示音效云存档语言";
const 行高 = 40;

const 画布区 = document.getElementById("gl");
const 参考区 = document.getElementById("ref");
if (!(画布区 instanceof HTMLElement) || !(参考区 instanceof HTMLCanvasElement))
  throw new Error("缺少实验画布");

const 渲染 = 创建渲染编排({
  容器: 画布区,
  逻辑宽: 900,
  逻辑高: 280,
  像素比: 1,
  清屏色: 0x16303a,
  保留绘制缓冲: true,
  最大帧率: 0,
  按需渲染: false,
});
const 合批 = new 图元合批();
渲染.场景.add(合批.提交());

type 变体 = { 名: string; 光栅比: number; 小数偏移: number; 对齐像素?: number };
const 变体表: 变体[] = [
  { 名: "A-1x-小数位置", 光栅比: 1, 小数偏移: 0.42 },
  { 名: "B-1x-整数位置", 光栅比: 1, 小数偏移: 0 },
  { 名: "C-2x-小数位置", 光栅比: 2, 小数偏移: 0.42 },
  { 名: "D-2x-整数位置", 光栅比: 2, 小数偏移: 0 },
  { 名: "E-3x-整数位置", 光栅比: 3, 小数偏移: 0 },
  { 名: "F-2x对齐-整数位置", 光栅比: 2, 小数偏移: 0, 对齐像素: 2 },
];
const 行信息: { 名: string; x: number; y: number }[] = [];
变体表.forEach((变体, 序号) => {
  const 图集 = 创建文字图集({
    字体,
    字号,
    字重: "normal",
    像素比: 变体.光栅比,
    对齐像素: 变体.对齐像素 ?? 1,
    页面边长: 1024,
  });
  const 纹理序号 = 合批.注册纹理("实验" + 序号, 图集.读取纹理());
  const 左 = 10 + 变体.小数偏移;
  const 上 = 8 + 序号 * 行高 + 变体.小数偏移;
  合批.设置图层(0);
  for (const 行 of 图集.排版(文案, 9999).行) {
    for (const 项 of 行.字形) {
      if (项.字形.宽 <= 0 || 项.字形.高 <= 0) continue;
      let 形左 = 左 + 项.左 + 项.字形.左偏移;
      let 形上 = 上 + 项.字形.上偏移;
      if (变体.小数偏移 === 0) {
        形左 = Math.round(形左);
        形上 = Math.round(形上);
      }
      合批.添加({
        左: 形左,
        上: 形上,
        宽: 项.字形.宽,
        高: 项.字形.高,
        紫外线: 项.字形.紫外线,
        颜色: [1, 1, 1, 1],
        纹理: 纹理序号,
      });
    }
  }
  行信息.push({ 名: 变体.名, x: 左, y: 上 });
});
合批.提交();
渲染.渲染();

if (参考区.getContext("2d") === null) throw new Error("缺少 2D 上下文");
const 上下文 = 参考区.getContext("2d");
if (!上下文) throw new Error("缺少 2D 上下文");
上下文.fillStyle = "#16303a";
上下文.fillRect(0, 0, 参考区.width, 参考区.height);
const 画参考 = (名称: string, 行号: number, 缩放: number) => {
  const 临时 = document.createElement("canvas");
  临时.width = 900 * 缩放;
  临时.height = 行高 * 缩放;
  const 临时上下文 = 临时.getContext("2d");
  if (!临时上下文) throw new Error("缺少临时上下文");
  临时上下文.fillStyle = "#16303a";
  临时上下文.fillRect(0, 0, 临时.width, 临时.height);
  临时上下文.font = 字号 * 缩放 + "px " + 字体;
  临时上下文.textBaseline = "alphabetic";
  临时上下文.fillStyle = "#ffffff";
  临时上下文.fillText(文案, 10 * 缩放, Math.round(字号 * 缩放 * 1.0));
  上下文.drawImage(临时, 0, 8 + 行号 * 行高, 900, 行高);
  行信息.push({ 名: 名称, x: 10, y: 8 + 行号 * 行高 });
};
画参考("参考1-1x直绘", 5, 1);
画参考("参考2-2x降采样", 6, 2);
画参考("参考3-8x超采样", 7, 8);


// —— 像素统计：变体 vs 8x 超采样参考（GT）与 2x 降采样参考（Phaser 同口径）——
type 墨块 = { 值: number[]; 宽: number; 高: number };
const 取像素 = (元素: HTMLCanvasElement) => {
  const 临时 = document.createElement("canvas");
  临时.width = 元素.width;
  临时.height = 元素.height;
  const 统计上下文 = 临时.getContext("2d");
  if (!统计上下文) throw new Error("缺少统计上下文");
  统计上下文.drawImage(元素, 0, 0);
  return 统计上下文.getImageData(0, 0, 元素.width, 元素.height);
};
const 游戏画布 = document.querySelector("#gl canvas");
if (!(游戏画布 instanceof HTMLCanvasElement)) throw new Error("缺少 WebGL 画布");
const 变体像素 = 取像素(游戏画布);
const 参考像素 = 取像素(参考区);
const 背景亮度 = 0.2126 * 0x16 + 0.7152 * 0x30 + 0.0722 * 0x3a;
const 读墨 = (数据: Uint8ClampedArray, 宽: number, x: number, y: number) => {
  const 偏移 = (y * 宽 + x) * 4;
  const 亮度 = 0.2126 * 数据[偏移] + 0.7152 * 数据[偏移 + 1] + 0.0722 * 数据[偏移 + 2];
  return Math.min(1, Math.max(0, (亮度 - 背景亮度) / (255 - 背景亮度)));
};
const 取墨块 = (数据: ImageData, 左: number, 上: number): 墨块 => {
  const 宽 = 620;
  const 高 = 34;
  const 值: number[] = [];
  for (let 行 = 0; 行 < 高; 行++)
    for (let 列 = 0; 列 < 宽; 列++)
      值.push(读墨(数据.data, 数据.width, Math.max(0, 左) + 列, 上 + 行));
  return { 值, 宽, 高 };
};
const 相关与位移 = (甲: 墨块, 乙: 墨块) => {
  let 最优 = -Infinity;
  let 最优纵 = 0;
  let 最优横 = 0;
  for (let 纵 = -4; 纵 <= 4; 纵++)
    for (let 横 = -4; 横 <= 4; 横++) {
      let 积 = 0;
      let 甲方 = 0;
      let 乙方 = 0;
      for (let y = 4; y < 甲.高 - 4; y++)
        for (let x = 4; x < 甲.宽 - 4; x++) {
          const 甲值 = 甲.值[y * 甲.宽 + x] ?? 0;
          const 乙值 = 乙.值[(y + 纵) * 乙.宽 + (x + 横)] ?? 0;
          积 += 甲值 * 乙值;
          甲方 += 甲值 * 甲值;
          乙方 += 乙值 * 乙值;
        }
      const 相关 = 积 / (Math.sqrt(甲方 * 乙方) + 1e-9);
      if (相关 > 最优) {
        最优 = 相关;
        最优纵 = 纵;
        最优横 = 横;
      }
    }
  return { 相关: 最优, 纵: 最优纵, 横: 最优横 };
};
const 像素指标 = (甲: 墨块, 乙: 墨块) => {
  const { 相关, 纵, 横 } = 相关与位移(甲, 乙);
  let 甲和 = 0;
  let 乙和 = 0;
  let 断笔 = 0;
  let 强墨 = 0;
  let 半灰 = 0;
  let 有效 = 0;
  for (let y = 4; y < 甲.高 - 4; y++)
    for (let x = 4; x < 甲.宽 - 4; x++) {
      const 甲值 = 甲.值[y * 甲.宽 + x] ?? 0;
      const 乙值 = 乙.值[(y + 纵) * 乙.宽 + (x + 横)] ?? 0;
      甲和 += 甲值;
      乙和 += 乙值;
      if (乙值 > 0.7 && 甲值 < 0.25) 断笔++;
      if (乙值 > 0.7) 强墨++;
      if (甲值 > 0.1) 有效++;
      if (甲值 > 0.2 && 甲值 < 0.6) 半灰++;
    }
  return {
    相关: 相关,
    墨量比: 甲和 / (乙和 + 1e-9),
    断笔率: 断笔 / Math.max(1, 强墨),
    半灰比: 半灰 / Math.max(1, 有效),
  };
};
const 参考块 = (名称: string, 数据: ImageData) => {
  const 行 = 行信息.find((项) => 项.名 === 名称);
  if (!行) throw new Error("缺少参考行 " + 名称);
  return 取墨块(数据, 行.x - 2, Math.round(行.y) + 2);
};
const 超采样 = 参考块("参考3-8x超采样", 参考像素);
const 降采样 = 参考块("参考2-2x降采样", 参考像素);
const 指标 = 变体表.map((变体, 序号) => {
  const 块 = 取墨块(变体像素, 8, 8 + 序号 * 行高 + 2);
  return Object.assign({ 名称: 变体.名 }, 像素指标(块, 超采样), {
    与2x相关: 相关与位移(块, 降采样).相关,
  });
});
const 参考自检 = ["参考1-1x直绘", "参考2-2x降采样"].map((名称) => {
  const 块 = 参考块(名称, 参考像素);
  return Object.assign({ 名称 }, 像素指标(块, 超采样));
});

Object.assign(window, { 实验: { 行信息, 行高, 字号, 文案, 指标, 参考自检 } });
`;

await Bun.write(入口, 实验源码);
const 构建 = await Bun.build({ entrypoints: [入口], target: "browser" });
if (!构建.success) throw new Error(构建.logs.map(String).join("\n"));
const 脚本 = await 构建.outputs[0]?.text();
if (!脚本) throw new Error("构建产物为空");

const 浏览器 = await chromium.launch({ channel: "chrome" });
try {
  const 页面 = await 浏览器.newPage({
    viewport: { width: 940, height: 700 },
    deviceScaleFactor: 1,
  });
  await 页面.setContent(
    '<body style="margin:0;background:#0a0e1d">' +
      '<div id="gl" style="width:900px;height:280px"></div>' +
      '<canvas id="ref" width="900" height="440" style="display:block;width:900px;height:440px"></canvas>' +
      "</body>",
  );
  await 页面.addScriptTag({ content: 脚本 });
  await 页面.waitForFunction(() => Reflect.get(window, "实验") !== undefined);
  const 画布元素 = await 页面.$("#gl canvas");
  const 参考元素 = await 页面.$("#ref");
  if (!画布元素 || !参考元素) throw new Error("缺少截图元素");
  await 画布元素.screenshot({ path: join(输出, "three变体.png") });
  await 参考元素.screenshot({ path: join(输出, "参考.png") });
  const 信息 = await 页面.evaluate(() => Reflect.get(window, "实验"));
  await Bun.write(join(输出, "行信息.json"), JSON.stringify(信息, null, 2));
  console.log("已输出", 输出);
} finally {
  await 浏览器.close();
}
