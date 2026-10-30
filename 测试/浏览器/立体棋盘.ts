import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { chromium } from "playwright";
import { 立体规范 } from "../../主题/立体/立体规范";
import type {} from "../../代码/应用/启动";
import { type 再消一行状态, 读取格子 } from "../../代码/玩法/再消一行";
import { 计算对局布局 } from "../../代码/页面/布局/对局布局";
import { 计算房间取景 } from "../../视效/透视/取景";

/** 真实 Chrome 手机模拟：视觉像素、触屏按钮、消行与跨主题资源释放。 */
const 地址 = process.argv[2] ?? "http://127.0.0.1:3000";
const 输出 = resolve("reports/立体棋盘");
await mkdir(输出, { recursive: true });
const 布局 = 计算对局布局(390, 844, { 模式: "马拉松", 阶段: "进行中" });
const 房规 = 立体规范.房间;
const 格 = 布局.格子大小;
const 口 = {
  左: 布局.棋盘.左 - 格 * 房规.口沿外扩横格,
  上: 布局.棋盘.上 - 格 * 房规.口沿外扩纵格,
  宽: 布局.棋盘.宽 + 格 * 房规.口沿外扩横格 * 2,
  高: 布局.棋盘.高 + 格 * 房规.口沿外扩纵格 * 2,
};
const 背高 = 口.高 * 房规.后墙占比高;
const 背宽 = (背高 * 布局.棋盘.列) / 布局.棋盘.行;
const 背 = {
  左: 口.左 + (口.宽 - 背宽) / 2,
  上: 口.上 + (口.高 - 背高) / 2,
  宽: 背宽,
  高: 背高,
};
assert.deepEqual(口, { 左: 5, 上: 158.5, 宽: 268, 高: 525 }, "保持已确认的口沿布局");
assert.deepEqual(背, { 左: 20.875, 上: 184.75, 宽: 236.25, 高: 472.5 }, "保持棋盘投影映射");
const 浏览器 = await chromium.launch({ channel: "chrome" });
const 页 = await 浏览器.newPage({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 1,
  hasTouch: true,
});
const 错误: string[] = [];
页.on("pageerror", (错) => 错误.push(错.message));
页.on("console", (消息) => {
  if (消息.type() === "error") 错误.push(消息.text());
});
async function 点击(名称: string) {
  await 页.waitForFunction(
    (名) => window.__three版__?.读取界面().按钮.some((键) => 键.名称 === 名 && 键.可用 !== false),
    名称,
  );
  const 键 = await 页.evaluate(
    (名) => window.__three版__?.读取界面().按钮.find((项) => 项.名称 === 名),
    名称,
  );
  assert(键, `找不到 ${名称}`);
  await 页.touchscreen.tap(键.左 + 键.宽 / 2, 键.上 + 键.高 / 2);
}
const 状态 = () => 页.evaluate(() => window.__three版__?.读取状态());
const 截图 = (名: string) => 页.screenshot({ path: join(输出, `${名}.png`) });
try {
  await 页.goto(地址);
  await 页.waitForFunction(() => !!window.__three版__);
  await 页.evaluate(() =>
    window.__three版__?.更新设置({
      主题选择: "立体晶格",
      显示网格: true,
      音效音量: 0,
      音乐音量: 0,
    }),
  );
  await 点击("开始游戏");
  await 点击("开始:马拉松");
  await 页.waitForFunction(() => window.__three版__?.读取界面().文字?.includes("入场:完成"));
  // 固定序列只用于搭建可复跑局面；横移、落地和软降仍经正式操作入口。
  await 页.evaluate(() =>
    window.__再消一行测试__?.设置序列([
      "O",
      "T",
      "I",
      "J",
      "Z",
      "S",
      "L",
      "O",
      "T",
      "I",
      "J",
      "Z",
      "S",
      "Z",
    ]),
  );
  for (const 横移 of [-4, -1, 2, 4, -3, 1, 3, -4, -1, 2, 4, -3, 1]) {
    await 页.evaluate((横) => {
      for (let 次 = 0; 次 < Math.abs(横); 次++) window.__three版__?.操作(横 < 0 ? "左移" : "右移");
      window.__再消一行测试__?.硬降();
    }, 横移);
    await 页.waitForTimeout(30);
  }
  await 页.keyboard.down("ArrowDown");
  await 页.waitForTimeout(120);
  await 页.keyboard.up("ArrowDown");
  await 页.waitForFunction(() => window.__再消一行测试__?.读取特效()?.锁定 === null);
  await 页.waitForTimeout(700);
  await 页.waitForFunction(() => window.__three版__?.读取状态().提示.成就 === null);
  const 原始 = (await 页.evaluate(() => window.__three版__?.读取原始状态())) as 再消一行状态;
  assert(原始?.当前方块, "缺少真实当前方块");
  const 当前格 = 读取格子(原始.当前方块);
  const 取景 = 计算房间取景({
    列: 10,
    行: 20,
    视野: 立体规范.镜头.视野,
    宽高比: 口.宽 / 口.高,
    后墙占比: 房规.后墙占比高,
  });
  const 块 = 立体规范.块;
  const 中心Z = -取景.进深 + 块.离墙 + 块.进深 / 2;
  const 投影 = (x: number, y: number, z: number) => {
    const 倍 = 取景.背墙距离 / (取景.位置[2] - z);
    return {
      x: 口.左 + 口.宽 / 2 + ((x * 背.宽) / 10) * 倍,
      y: 口.上 + 口.高 / 2 - ((y * 背.高) / 20) * 倍,
    };
  };
  const 面采样 = 当前格
    .filter(([列, 行]) => 行 >= 0 && !当前格.some(([x, y]) => x === 列 && y === 行 + 1))
    .map(([列, 行]) => ({
      正面: 投影(列 - 4.5, 9.5 - 行, 中心Z + (块.进深 * 块.缩) / 2),
      底面: 投影(列 - 4.5, 9.5 - 行 - 块.缩 / 2, 中心Z),
    }));
  const 图 = await 截图("对局");
  const 像素 = await 页.evaluate(
    async ({ 数据, 口, 背, 列, 行, 面采样 }) => {
      const 字节 = Uint8Array.from(atob(数据), (字) => 字.charCodeAt(0));
      const 位图 = await createImageBitmap(new Blob([字节], { type: "image/png" }));
      const 布 = document.createElement("canvas");
      布.width = 位图.width;
      布.height = 位图.height;
      const 绘 = 布.getContext("2d");
      if (!绘) throw new Error("缺少像素读取上下文");
      绘.drawImage(位图, 0, 0);
      const px = 绘.getImageData(0, 0, 布.width, 布.height).data;
      const 色 = (x: number, y: number) => {
        const i = (Math.round(y) * 布.width + Math.round(x)) * 4;
        return [px[i] ?? 0, px[i + 1] ?? 0, px[i + 2] ?? 0];
      };
      const 亮 = (x: number, y: number) => {
        const c = 色(x, y);
        return (c[0] ?? 0) * 0.2126 + (c[1] ?? 0) * 0.7152 + (c[2] ?? 0) * 0.0722;
      };
      const 分位 = (值: number[], p: number) =>
        值.sort((a, b) => a - b)[Math.floor((值.length - 1) * p)] ?? 0;
      const 格宽 = 背.宽 / 列;
      const 格高 = 背.高 / 行;
      const 格线对比: number[] = [];
      const 格线亮: number[] = [];
      for (let k = 1; k < 列; k++) {
        const 线: number[] = [];
        const 底: number[] = [];
        for (const r of [0.5, 1.5, 2.5]) {
          const y = 背.上 + r * 格高;
          const x = 背.左 + k * 格宽;
          线.push(Math.max(亮(x - 1, y), 亮(x, y), 亮(x + 1, y)));
          底.push(亮(x - 格宽 / 2, y));
        }
        const 线亮 = 分位(线, 0.5);
        格线亮.push(线亮);
        格线对比.push(线亮 / Math.max(1, 分位(底, 0.5)));
      }
      const 灯: number[] = [];
      const 方块: number[] = [];
      for (let y = Math.ceil(口.上); y < 口.上 + 口.高; y++) {
        for (let x = Math.ceil(口.左); x < 口.左 + 口.宽; x++) {
          const [r = 0, g = 0, b = 0] = 色(x, y);
          const 侧沿 =
            x < 背.左 - 2 || x > 背.左 + 背.宽 + 2 || y < 背.上 - 2 || y > 背.上 + 背.高 + 2;
          if (侧沿 && g > 120 && b > 160 && b > r * 1.15) 灯.push(亮(x, y));
          if (
            !侧沿 &&
            y > 背.上 + 背.高 * 0.5 &&
            Math.max(r, g, b) > 100 &&
            Math.max(r, g, b) - Math.min(r, g, b) > 60
          )
            方块.push(亮(x, y));
        }
      }
      位图.close();
      return {
        同色方块面亮度: 面采样.map((面) => ({
          正面: 亮(面.正面.x, 面.正面.y),
          底面: 亮(面.底面.x, 面.底面.y),
        })),
        格线对比,
        格线亮度: 分位(格线亮, 0.5),
        灯芯像素: 灯.length,
        灯芯亮度: 分位(灯, 0.5),
        方块像素: 方块.length,
        方块暗面: 分位(方块, 0.25),
        方块亮面: 分位(方块, 0.9),
      };
    },
    { 数据: 图.toString("base64"), 口, 背, 列: 布局.棋盘.列, 行: 布局.棋盘.行, 面采样 },
  );
  assert(
    像素.格线对比.every((值) => 值 > 1.35),
    `格线缺失：${像素.格线对比}`,
  );
  assert(像素.灯芯像素 > 150, `灯芯不足：${像素.灯芯像素}`);
  assert(像素.灯芯亮度 > 像素.格线亮度 * 2.5, "网格抢过灯带");
  assert(像素.方块像素 > 2000, "彩色方块缺失");
  assert(像素.方块亮面 > 像素.方块暗面 * 1.3, "方块明暗层次不足");
  assert(像素.同色方块面亮度.length > 0, "缺少实体方块面采样");
  assert(
    像素.同色方块面亮度.every((面) => 面.底面 > 5 && 面.正面 > 面.底面 * 1.25),
    `同色方块缺少受光差异：${JSON.stringify(像素.同色方块面亮度)}`,
  );
  assert((口.高 - 背.高) / 口.高 / 2 < 0.07, "顶底占位过大");
  assert.equal((await 状态())?.阶段, "进行中");
  await 页.evaluate(() => window.__three版__?.开始绘制采样());
  await 页.waitForTimeout(1200);
  const 绘制采样 = await 页.evaluate(() => window.__three版__?.结束绘制采样());
  const 对局统计 = await 页.evaluate(() => window.__three版__?.读取统计());
  const 操作前 = 对局统计?.对局统计.操作次数 ?? 0;
  await 点击("左移");
  await 点击("右移");
  await 点击("左转");
  await 点击("右转");
  assert(
    ((await 页.evaluate(() => window.__three版__?.读取统计().对局统计.操作次数)) ?? 0) >=
      操作前 + 4,
  );
  await 点击("暂存操作");
  assert.equal((await 状态())?.本块已暂存, true);
  await 点击("暂停");
  await 页.waitForFunction(() => window.__three版__?.读取状态().阶段 === "暂停");
  const 暂停用时 = (await 状态())?.有效用时;
  await 页.waitForTimeout(150);
  assert.equal((await 状态())?.有效用时, 暂停用时);
  await 截图("暂停");
  await 点击("对局设置");
  assert.equal((await 状态())?.对局设置打开, true);
  await 截图("设置");
  await 页.touchscreen.tap(195, 80);
  await 页.waitForFunction(() => window.__three版__?.读取状态().对局设置打开 === false);
  await 点击("继续");
  await 页.waitForFunction(() => window.__three版__?.读取状态().阶段 === "进行中");
  await 页.evaluate(() => window.__再消一行测试__?.准备单行消除());
  const 消行前 = (await 状态())?.消行数 ?? 0;
  await 页.keyboard.press("Space");
  await 页.waitForFunction((前) => (window.__three版__?.读取状态().消行数 ?? 0) === 前 + 1, 消行前);
  await 页.waitForFunction(() => window.__再消一行测试__?.读取特效()?.消行 === null);
  await 截图("消行后");
  await 页.evaluate(() => window.__three版__?.更新设置({ 主题选择: "极光原野" }));
  await 页.waitForFunction(() => window.__three版__?.读取统计().透视棋盘 === false);
  await 截图("切回平面");
  await 页.evaluate(() => window.__three版__?.更新设置({ 主题选择: "立体晶格" }));
  await 页.waitForFunction(() => window.__three版__?.读取统计().透视棋盘 === true);
  await 点击("暂停");
  await 点击("返回主菜单");
  await 页.waitForFunction(() => window.__three版__?.读取状态().页面 === "菜单");
  assert.equal(await 页.evaluate(() => window.__three版__?.读取统计().透视棋盘), false);
  assert.deepEqual(错误, []);
  const 结果 = {
    通过: true,
    地址,
    范围: "Chrome 手机模拟 390×844 DPR1，非真机",
    口,
    背,
    像素,
    绘制采样,
    渲染: 对局统计?.渲染,
    交互: [
      "移动旋转",
      "暂存",
      "暂停冻结计时",
      "对局设置",
      "恢复",
      "单行消除",
      "平面/立体切换",
      "退出释放",
    ],
    错误,
  };
  await writeFile(join(输出, "结果.json"), JSON.stringify(结果, null, 2));
  console.log(JSON.stringify(结果, null, 2));
} catch (错) {
  await 截图("失败现场");
  await writeFile(
    join(输出, "失败现场.json"),
    JSON.stringify({ 错误, 状态: await 状态() }, null, 2),
  );
  throw 错;
} finally {
  await 浏览器.close();
}
