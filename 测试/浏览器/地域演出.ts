import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium, type Page } from "playwright";

const 地址 = process.argv[2] ?? "http://127.0.0.1:3330",
  输出 = "reports/regional-animation";
await mkdir(输出, { recursive: true });
const 浏览器 = await chromium.launch({ channel: "chrome" });
async function 点击(页: Page, 名称: string) {
  await 页.waitForFunction(
    (名称) =>
      window.__GAMEMAKER_TEST__
        ?.getSnapshot()
        .interactives.some((项) => 项.name === 名称 && 项.enabled && 项.visible),
    名称,
  );
  const 框 = await 页.evaluate(
    (名称) =>
      window.__GAMEMAKER_TEST__
        ?.getSnapshot()
        .interactives.find((项) => 项.name === 名称 && 项.enabled && 项.visible)?.bounds,
    名称,
  );
  assert.ok(框);
  await 页.mouse.click(框.x + 框.width / 2, 框.y + 框.height / 2, { delay: 70 });
  await 页.waitForTimeout(210);
}
const 结果: object[] = [];
try {
  const 上下文 = await 浏览器.newContext({
      viewport: { width: 1280, height: 800 },
      recordVideo: { dir: 输出, size: { width: 960, height: 600 } },
    }),
    页 = await 上下文.newPage();
  const 错误: string[] = [];
  页.on("pageerror", (e) => 错误.push(e.message));
  await 页.goto(地址);
  await 页.waitForFunction(() => window.__GAMEMAKER_TEST__?.getSnapshot().sceneId === "开始菜单");
  await 点击(页, "menu.shop");
  for (const [地点, 区域] of [
    ["成都熊猫", [0.6, 0.57, 0.35, 0.35]],
    ["西湖烟雨", [0, 0.72, 1, 0.21]],
    ["敦煌流沙", [0, 0.76, 1, 0.18]],
    ["重庆夜航", [0, 0.51, 1, 0.14]],
  ] as const) {
    for (let i = 0; i < 16; i++) {
      if (
        await 页.evaluate(
          (名称) =>
            window.__GAMEMAKER_TEST__
              ?.getSnapshot()
              .interactives.some((项) => 项.name === 名称 && 项.enabled && 项.visible),
          `shop.place.${地点}`,
        )
      )
        break;
      const 卡 = await 页.evaluate(
        () =>
          window.__GAMEMAKER_TEST__
            ?.getSnapshot()
            .interactives.find((项) => 项.name.startsWith("shop.place.") && 项.visible)?.bounds,
      );
      if (!卡) break;
      await 页.mouse.move(卡.x + 卡.width * 0.85, 卡.y + 卡.height / 2);
      await 页.mouse.down();
      await 页.mouse.move(卡.x + 16, 卡.y + 卡.height / 2, { steps: 8 });
      await 页.mouse.up();
      await 页.waitForTimeout(160);
    }
    await 点击(页, `shop.place.${地点}`);
    await 点击(页, "shop.preview");
    await 页.waitForTimeout(220);
    const [x, y, w, h] = 区域,
      框 = {
        x: Math.floor(x * 1280),
        y: Math.floor(y * 800),
        width: Math.floor(w * 1280),
        height: Math.floor(h * 800),
      };
    const 前 = await 页.screenshot({ clip: 框 });
    await 页.waitForTimeout(1100);
    const 后 = await 页.screenshot({ clip: 框 });
    const 改变 = await 页.evaluate(
      async ({ 前, 后 }) => {
        const 读 = async (数据: string) => {
          const 图 = await createImageBitmap(
            await (await fetch(`data:image/png;base64,${数据}`)).blob(),
          );
          const 布 = new OffscreenCanvas(图.width, 图.height),
            笔 = 布.getContext("2d");
          if (!笔) throw Error("canvas");
          笔.drawImage(图, 0, 0);
          return 笔.getImageData(0, 0, 图.width, 图.height).data;
        };
        const a = await 读(前),
          b = await 读(后);
        let n = 0;
        for (let i = 0; i < a.length; i += 4)
          if (
            Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) >
            35
          )
            n++;
        return n;
      },
      { 前: 前.toString("base64"), 后: 后.toString("base64") },
    );
    assert.ok(改变 > 200, `${地点} 主体区域应有可见运动，实际 ${改变}`);
    await 页.screenshot({ path: `${输出}/${地点}-主体动画.png` });
    await 点击(页, "shop.preview.motion");
    await 页.waitForTimeout(250);
    const 静 = await 页.screenshot({ clip: { x: 0, y: 80, width: 1280, height: 640 } });
    await 页.waitForTimeout(450);
    const 静后 = await 页.screenshot({ clip: { x: 0, y: 80, width: 1280, height: 640 } });
    // 软件WebGL的透明混合偶有1–4级舍入差；检查可见变化，避免把舍入误报为运动。
    const 静态变化 = await 页.evaluate(
      async ({ a, b }) => {
        const 读 = async (s: string) => {
          const 图 = await createImageBitmap(
            await (await fetch(`data:image/png;base64,${s}`)).blob(),
          );
          const 布 = new OffscreenCanvas(图.width, 图.height),
            笔 = 布.getContext("2d");
          if (!笔) throw Error("canvas");
          笔.drawImage(图, 0, 0);
          return 笔.getImageData(0, 0, 图.width, 图.height).data;
        };
        const 前 = await 读(a),
          后 = await 读(b);
        let n = 0;
        for (let i = 0; i < 前.length; i += 4)
          if (
            Math.max(
              Math.abs(前[i] - 后[i]),
              Math.abs(前[i + 1] - 后[i + 1]),
              Math.abs(前[i + 2] - 后[i + 2]),
            ) > 6
          )
            n++;
        return n;
      },
      { a: 静.toString("base64"), b: 静后.toString("base64") },
    );
    assert.equal(静态变化, 0, `${地点} 静态关闭后风景保持不动`);
    结果.push({ 地点, 主体改变像素: 改变, 静态冻结: true });
    await 点击(页, "shop.preview.back");
  }
  assert.deepEqual(错误, []);
  const 视频 = 页.video();
  await 上下文.close();
  if (视频) await 视频.saveAs(`${输出}/地域主体演出.webm`);
  await Bun.write(`${输出}/结果.json`, JSON.stringify(结果, null, 2));
  console.log("通过：熊猫、行舟、驼队与列车主体区域实际运动；四地静态冻结；动画实录已保存。");
} finally {
  await 浏览器.close();
}
