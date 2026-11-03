import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "playwright";

/**
 * 一次性排查工具：按矩形统计截图里的主色分布与对比度。
 * 用法：bun 测试/浏览器/排查/区域取色.ts <图.png> "<左,上,宽,高>" [...更多矩形]
 * 输出每个矩形的前 4 种颜色占比、最亮/最暗，以及「主色 vs 次主色」的 WCAG 对比度。
 */
const [图路径, ...矩形参数] = process.argv.slice(2);
if (!图路径) throw new Error("缺少图片路径");
const 矩形列表 = 矩形参数.map(
  (项) => 项.split(",").map(Number) as [number, number, number, number],
);
const 数据 = (await readFile(resolve(图路径))).toString("base64");

const 浏览器 = await chromium.launch({ channel: "chrome" });
try {
  const 页 = await 浏览器.newPage();
  await 页.setContent("<body></body>");
  const 结果 = await 页.evaluate(
    async (参数) => {
      const 图 = await new Promise<HTMLImageElement>((完成) => {
        const 元素 = new Image();
        元素.onload = () => 完成(元素);
        元素.src = `data:image/png;base64,${参数.数据}`;
      });
      const 画布 = document.createElement("canvas");
      画布.width = 图.width;
      画布.height = 图.height;
      const 上下文 = 画布.getContext("2d");
      if (!上下文) throw new Error("缺少上下文");
      上下文.drawImage(图, 0, 0);
      const 线性 = (值: number) => {
        const 归一 = 值 / 255;
        return 归一 <= 0.04045 ? 归一 / 12.92 : ((归一 + 0.055) / 1.055) ** 2.4;
      };
      const 亮度 = (颜色: [number, number, number]) =>
        0.2126 * 线性(颜色[0]) + 0.7152 * 线性(颜色[1]) + 0.0722 * 线性(颜色[2]);
      const 对比度 = (甲: [number, number, number], 乙: [number, number, number]) => {
        const 甲亮 = 亮度(甲);
        const 乙亮 = 亮度(乙);
        return (Math.max(甲亮, 乙亮) + 0.05) / (Math.min(甲亮, 乙亮) + 0.05);
      };
      const 十六 = (颜色: [number, number, number]) =>
        `#${颜色.map((值) => Math.round(值).toString(16).padStart(2, "0")).join("")}`;
      return 参数.矩形列表.map(([左, 上, 宽, 高]) => {
        const 像素 = 上下文.getImageData(左, 上, 宽, 高).data;
        const 计数 = new Map<string, { 色: [number, number, number]; 数: number }>();
        for (let 偏移 = 0; 偏移 < 像素.length; 偏移 += 4) {
          const 色: [number, number, number] = [
            像素[偏移] ?? 0,
            像素[偏移 + 1] ?? 0,
            像素[偏移 + 2] ?? 0,
          ];
          const 键 = 色.join(",");
          const 旧 = 计数.get(键);
          if (旧) 旧.数 += 1;
          else 计数.set(键, { 色, 数: 1 });
        }
        const 总计 = 宽 * 高;
        const 排行 = [...计数.values()].sort((甲, 乙) => 乙.数 - 甲.数).slice(0, 4);
        const 主 = 排行[0];
        const 次 = 排行[1];
        return {
          矩形: `${左},${上},${宽},${高}`,
          主色: 主 ? `${十六(主.色)} ${((主.数 / 总计) * 100).toFixed(0)}%` : "-",
          次色: 次 ? `${十六(次.色)} ${((次.数 / 总计) * 100).toFixed(0)}%` : "-",
          对比度: 主 && 次 ? 对比度(主.色, 次.色).toFixed(2) : "-",
          排行: 排行.map((项) => `${十六(项.色)}:${((项.数 / 总计) * 100).toFixed(1)}%`),
        };
      });
    },
    { 数据, 矩形列表 },
  );
  console.log(JSON.stringify(结果, null, 2));
} finally {
  await 浏览器.close();
}
