import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { basename, join } from "node:path";
import { chromium } from "playwright";

const 根 = join(import.meta.dir, "../..");
const 输出 = join(根, "reports/界面修整");
await mkdir(输出, { recursive: true });
const 服务 = Bun.serve({
  hostname: "127.0.0.1",
  port: 0,
  async fetch(请求) {
    const 路径 = new URL(请求.url).pathname.slice(1) || "index.html";
    if (basename(路径) !== 路径) return new Response("Not Found", { status: 404 });
    const 文件 = Bun.file(join(根, "产物", 路径));
    return (await 文件.exists()) ? new Response(文件) : new Response("Not Found", { status: 404 });
  },
});
const 浏览器 = await chromium.launch({ channel: "chrome" });
try {
  const 页 = await 浏览器.newPage({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
    hasTouch: true,
    isMobile: true,
  });
  await 页.addInitScript(() => {
    // 以老存档保留全部基础背景，保证背景行有足够卡片可横向拖动；新档只解锁云海山岚与极光原野。
    localStorage.setItem(
      "旅行版:基础背景保留",
      JSON.stringify(["晨光海岸", "云海山岚", "极光原野", "霓虹天际"]),
    );
    window.__音频连接__ = new WeakMap();
    window.__循环声源__ = [];
    window.__音乐声源__ = [];
    const 起音 = OscillatorNode.prototype.start;
    OscillatorNode.prototype.start = function (...参数) {
      window.__音乐声源__.push(this);
      return 起音.apply(this, 参数);
    };
    const 连接 = AudioNode.prototype.connect;
    Object.defineProperty(AudioNode.prototype, "connect", {
      value: function (this: AudioNode, ...参数: unknown[]) {
        const 目标 = 参数[0];
        if (目标 instanceof AudioNode) window.__音频连接__.set(this, 目标);
        return Reflect.apply(连接, this, 参数);
      },
    });
    const 启动 = AudioBufferSourceNode.prototype.start;
    const 停止 = AudioBufferSourceNode.prototype.stop;
    window.__氛围采样__ = { 启动: 0, 停止: 0 };
    AudioBufferSourceNode.prototype.start = function (...参数) {
      if (this.loop) {
        window.__氛围采样__.启动++;
        window.__循环声源__.push(this);
      }
      return 启动.apply(this, 参数);
    };
    AudioBufferSourceNode.prototype.stop = function (...参数) {
      if (this.loop) window.__氛围采样__.停止++;
      return 停止.apply(this, 参数);
    };
  });
  const 错误: string[] = [];
  页.on("pageerror", (e) => 错误.push(e.message));
  const 快照 = () => 页.evaluate(() => window.__GAMEMAKER_TEST__?.getSnapshot());
  async function 点击(名称: string) {
    await 页.waitForFunction(
      (n) =>
        window.__GAMEMAKER_TEST__
          ?.getSnapshot()
          .interactives.some((x) => x.name === n && x.visible && x.enabled),
      名称,
    );
    const 框 = (await 快照())?.interactives.find(
      (x) => x.name === 名称 && x.visible && x.enabled,
    )?.bounds;
    assert.ok(框, 名称);
    assert.ok(
      框.x >= 0 && 框.y >= 0 && 框.x + 框.width <= 391 && 框.y + 框.height <= 845,
      `${名称}完整可见`,
    );
    await 页.touchscreen.tap(框.x + 框.width / 2, 框.y + 框.height / 2);
    await 页.waitForTimeout(250);
    return 框;
  }
  await 页.goto(服务.url.href);
  await 页.waitForFunction(() => window.__GAMEMAKER_TEST__?.getSnapshot().sceneId === "开始菜单");
  await 页.waitForTimeout(300);
  await 页.screenshot({ path: join(输出, "菜单.png") });
  await 页.evaluate(() =>
    localStorage.setItem(
      "旅行版:收藏",
      JSON.stringify({
        版本: 1,
        数据: {
          金币: 120,
          累计获得: 120,
          已购: ["成都熊猫.界面样式"],
          已结算: [],
          已领成就: [],
          最近首局日期: "",
        },
      }),
    ),
  );
  await 点击("menu.settings");
  assert.equal(await 页.evaluate(() => window.__氛围采样__.启动), 0, "默认不启动循环环境声");
  assert.ok(!(await 快照())?.interactives.some((x) => x.name === "settings.shop"));
  assert.equal(
    await 页.evaluate(
      () => JSON.parse(localStorage.getItem("再消一行:设置") ?? "{}").背景音效音量 ?? 0,
    ),
    0,
  );
  assert.equal(
    await 页.evaluate(() => window.__再消一行音乐__?.().曲目),
    null,
    "新玩家音乐默认关闭",
  );
  const 音乐框 = (await 快照())?.interactives.find(
    (x) => x.name === "settings.music-volume.slider",
  )?.bounds;
  assert.ok(音乐框);
  await 页.mouse.click(音乐框.x + 音乐框.width * 0.7, 音乐框.y + 音乐框.height / 2);
  await 页.waitForTimeout(350);
  assert.equal(
    await 页.evaluate(() => window.__再消一行音乐__?.().曲目),
    "再消一行.菜单",
    "调高音乐即播放菜单曲",
  );
  assert.ok(
    await 页.evaluate(() =>
      window.__音乐声源__.some((声源) => {
        let 节点: AudioNode | undefined = 声源;
        while (节点) {
          if (节点 instanceof GainNode && 节点.gain.value <= 0) return false;
          if (节点 instanceof AudioDestinationNode) return true;
          节点 = window.__音频连接__.get(节点);
        }
        return false;
      }),
    ),
    "音乐振荡器经过非零总线连接真实输出",
  );
  await 页.mouse.click(音乐框.x, 音乐框.y + 音乐框.height / 2);
  await 页.waitForTimeout(200);
  assert.equal(await 页.evaluate(() => window.__再消一行音乐__?.().曲目), null, "音乐归零停止曲目");
  const 框 = (await 快照())?.interactives.find(
    (x) => x.name === "settings.ambient-volume.slider",
  )?.bounds;
  assert.ok(框, "背景音效滑块存在");
  await 页.mouse.move(框.x + 框.width * 0.1, 框.y + 框.height / 2);
  await 页.mouse.down();
  await 页.mouse.move(框.x + 框.width * 0.75, 框.y + 框.height / 2, { steps: 8 });
  await 页.mouse.up();
  assert.ok(
    await 页.evaluate(
      () => JSON.parse(localStorage.getItem("再消一行:设置") ?? "{}").背景音效音量 >= 70,
    ),
  );
  assert.ok(
    await 页.evaluate(() => window.__氛围采样__.启动 > window.__氛围采样__.停止),
    "调高背景音效后真实启动循环声源",
  );
  const 音效框 = (await 快照())?.interactives.find(
    (x) => x.name === "settings.sfx-volume.slider",
  )?.bounds;
  assert.ok(音效框);
  await 页.mouse.click(音效框.x, 音效框.y + 音效框.height / 2);
  await 页.waitForTimeout(300);
  assert.equal(
    await 页.evaluate(
      () => JSON.parse(localStorage.getItem("gamemaker:settings") ?? "{}").音效音量,
    ),
    0,
  );
  assert.ok(
    await 页.evaluate(() => {
      let 节点: AudioNode | undefined = window.__循环声源__.at(-1);
      let 到达输出 = false;
      while (节点) {
        if (节点 instanceof GainNode && 节点.gain.value <= 0) return false;
        if (节点 instanceof AudioDestinationNode) 到达输出 = true;
        节点 = window.__音频连接__.get(节点);
      }
      return 到达输出 && window.__氛围采样__.启动 > window.__氛围采样__.停止;
    }),
    "普通音效为0时，氛围仍通过非零独立输出发声",
  );
  await 页.screenshot({ path: join(输出, "设置.png") });
  await 页.mouse.move(260, 620);
  await 页.mouse.wheel(0, 600);
  await 页.waitForTimeout(200);
  await 页.screenshot({ path: join(输出, "设置外观.png") });
  const 会话 = await 页.context().newCDPSession(页);
  for (const [分类, 卡名] of [
    ["style", "settings.style.gilded-night"],
    ["background", "settings.background.晨光海岸"],
    ["blocks", "settings.blocks.默认"],
  ]) {
    const 卡框 = (await 快照())?.interactives.find((x) => x.name === 卡名)?.bounds;
    assert.ok(卡框, 分类);
    const x = Math.max(120, 卡框.x + 48),
      y = 卡框.y + 40;
    assert.ok(y > 80 && y < 760, `${分类}在列表可视范围`);
    const 方向 = 卡框.x < 0 ? 1 : -1;
    const 其他卡片 = (await 快照())?.interactives
      .filter(
        (x) =>
          [
            "settings.style.gilded-night",
            "settings.background.晨光海岸",
            "settings.blocks.默认",
          ].includes(x.name) && x.name !== 卡名,
      )
      .flatMap((x) => (x.bounds ? [{ name: x.name, x: x.bounds.x, y: x.bounds.y }] : []));
    const 旧设置 = await 页.evaluate(() => localStorage.getItem("再消一行:设置"));
    await 会话.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x, y, id: 1 }],
    });
    for (let i = 1; i <= 8; i++) {
      await 会话.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ x: x + 方向 * i * 8, y: y + (i > 3 ? (i - 3) * 16 : 0), id: 1 }],
      });
      await 页.waitForTimeout(20);
    }
    await 会话.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    for (const 其他 of 其他卡片 ?? []) {
      const 新位置 = (await 快照())?.interactives.find((x) => x.name === 其他.name)?.bounds;
      assert.ok(
        新位置 && Math.abs(新位置.x - 其他.x) < 1 && Math.abs(新位置.y - 其他.y) < 1,
        `${分类}拖到相邻行时不带动${其他.name}`,
      );
    }
    const 新框 = (await 快照())?.interactives.find((x) => x.name === 卡名)?.bounds;
    await 页.screenshot({ path: join(输出, `拖动-${分类}.png`) });
    assert.ok(新框 && Math.abs(新框.x - 卡框.x) > 20, `${分类}从卡片上横拖有效`);
    assert.equal(
      await 页.evaluate(() => localStorage.getItem("再消一行:设置")),
      旧设置,
      "拖动不误选",
    );
    // 本行横向惯性还在滑行时，下一次比较会把它的位移误判成相邻行被带动。
    await 页.waitForTimeout(700);
  }
  const 竖拖前 = (await 快照())?.interactives.find(
    (x) => x.name === "settings.background.晨光海岸",
  )?.bounds;
  assert.ok(竖拖前);
  await 会话.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: 170, y: 470, id: 1 }],
  });
  for (let i = 1; i <= 6; i++) {
    await 会话.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: 170, y: 470 + i * 8, id: 1 }],
    });
    await 页.waitForTimeout(20);
  }
  await 会话.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  const 竖拖后 = (await 快照())?.interactives.find(
    (x) => x.name === "settings.background.晨光海岸",
  )?.bounds;
  assert.ok(竖拖后 && 竖拖后.y > 竖拖前.y + 20, "卡片上竖拖仍能滚动设置页");
  await 点击("settings.defaults");
  assert.equal(
    await 页.evaluate(() => JSON.parse(localStorage.getItem("再消一行:设置") ?? "{}").背景音效音量),
    0,
  );
  assert.equal(
    await 页.evaluate(() => window.__氛围采样__.启动 - window.__氛围采样__.停止),
    0,
    "恢复默认后停止全部循环声源",
  );
  await 点击("settings.done");
  await 点击("menu.shop");
  const 退出 = (await 快照())?.interactives.find((x) => x.name === "shop.close")?.bounds;
  const 纯享 = (await 快照())?.interactives.find((x) => x.name === "shop.preview")?.bounds;
  assert.ok(退出 && 纯享 && 退出.y > 790 && 纯享.y > 400 && 纯享.y < 退出.y);
  await 页.screenshot({ path: join(输出, "商店.png") });
  await 点击("shop.place.丽江雪山");
  await 页.screenshot({ path: join(输出, "商店切换.png") });
  await 点击("shop.preview");
  await 点击("shop.preview.back");
  await 点击("shop.close");
  assert.equal((await 快照())?.sceneId, "开始菜单");
  for (const 样式 of ["暖纸古典", "青蓝未来", "夜空鎏金"]) {
    await 页.evaluate(
      (样式值) =>
        localStorage.setItem(
          "gamemaker:settings",
          JSON.stringify({
            ...JSON.parse(localStorage.getItem("gamemaker:settings") ?? "{}"),
            样式: 样式值,
            语言: "English",
          }),
        ),
      样式,
    );
    await 页.reload();
    await 页.waitForFunction(() => window.__GAMEMAKER_TEST__?.getSnapshot().sceneId === "开始菜单");
    await 页.waitForTimeout(300);
    assert.ok(
      JSON.stringify(
        await 页.evaluate(() => window.__GAMEMAKER_TEST__?.getSnapshot("完整")),
      ).includes("One More Line"),
      "英文标题已翻译",
    );
    await 页.screenshot({ path: join(输出, `英文-${样式}.png`) });
  }
  assert.deepEqual(错误, []);
  console.log(
    `390×844 界面修整验收通过：设置保存/恢复、环境声源开关、商店布局/纯享/退出，无页面错误。截图：${输出}`,
  );
} finally {
  await 浏览器.close();
  服务.stop();
}

declare global {
  interface Window {
    __音频连接__: WeakMap<AudioNode, AudioNode>;
    __循环声源__: AudioBufferSourceNode[];
    __音乐声源__: OscillatorNode[];
    __氛围采样__: { 启动: number; 停止: number };
  }
}
