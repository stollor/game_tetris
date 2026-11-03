import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "playwright";

/**
 * 一次性排查工具：把两张同尺寸截图按矩形裁切、整数放大并上下拼成对照图。
 * 用法：bun 测试/浏览器/排查/截图对照.ts <甲.png> <乙.png> <输出.png> [左,上,宽,高] [放大]
 */
const [甲路径, 乙路径, 输出路径, 矩形参数, 放大参数] = process.argv.slice(2);
if (!甲路径 || !乙路径 || !输出路径) throw new Error("缺少参数");
const [左, 上, 宽, 高] = (矩形参数 ?? "0,0,390,844").split(",").map(Number);
const 放大 = Number(放大参数 ?? 2);
const 甲 = (await readFile(resolve(甲路径))).toString("base64");
const 乙 = (await readFile(resolve(乙路径))).toString("base64");

const 浏览器 = await chromium.launch({ channel: "chrome" });
try {
  const 页 = await 浏览器.newPage({ viewport: { width: 宽 * 放大, height: 高 * 放大 * 2 + 8 } });
  await 页.setContent("<body style='margin:0;background:#000'></body>");
  const 数据 = await 页.evaluate(
    async (参数) => {
      const 载入 = (基: string) =>
        new Promise<HTMLImageElement>((完成) => {
          const 图 = new Image();
          图.onload = () => 完成(图);
          图.src = `data:image/png;base64,${基}`;
        });
      const 图甲 = await 载入(参数.甲);
      const 图乙 = await 载入(参数.乙);
      const 画布 = document.createElement("canvas");
      画布.width = 参数.宽 * 参数.放大;
      画布.height = 参数.高 * 参数.放大 * 2 + 8;
      const 上下文 = 画布.getContext("2d");
      if (!上下文) throw new Error("缺少上下文");
      上下文.imageSmoothingEnabled = false;
      上下文.fillStyle = "#000";
      上下文.fillRect(0, 0, 画布.width, 画布.height);
      上下文.drawImage(
        图甲,
        参数.左,
        参数.上,
        参数.宽,
        参数.高,
        0,
        0,
        参数.宽 * 参数.放大,
        参数.高 * 参数.放大,
      );
      上下文.drawImage(
        图乙,
        参数.左,
        参数.上,
        参数.宽,
        参数.高,
        0,
        参数.高 * 参数.放大 + 8,
        参数.宽 * 参数.放大,
        参数.高 * 参数.放大,
      );
      return 画布.toDataURL("image/png").split(",")[1] ?? "";
    },
    { 甲, 乙, 左, 上, 宽, 高, 放大 },
  );
  await writeFile(resolve(输出路径), Buffer.from(数据, "base64"));
  console.log(`对照图：${输出路径}`);
} finally {
  await 浏览器.close();
}
