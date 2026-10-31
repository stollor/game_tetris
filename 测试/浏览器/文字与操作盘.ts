import assert from "node:assert/strict";
import { mkdir, rename, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { type Browser, chromium } from "playwright";
import type { 调试状态, 调试统计 } from "../../代码/应用/启动";
import type { 界面快照, 界面按钮快照 } from "../../代码/应用/接口/上下文";

/**
 * 文字与操作盘采样：390×844 手机视口，DPR1 / DPR2 各开独立 Chromium context。
 * 采集首页、全局设置（含滚动下半段与语言下拉）、成就、商店、模式选择、马拉松对局、
 * 暂停、对局设置、结算；并用真实 mouse 点击验证双击软降的无消行/单行消除计分链路。
 *
 * 这只是 Chromium 模拟视口：不是手机真机。脚本不自动判断像素清晰度或主观可读性，
 * 只保存截图、文字图集几何、画布尺寸与规则断言，截图必须人工查看。
 */
const 地址 = process.argv[2] ?? "http://127.0.0.1:3000";
const 输出 = resolve(".gamemaker/报告/文字与操作盘");
const 视口 = { 宽: 390, 高: 844 } as const;
const 纹理预算字节 = 32 * 1024 * 1024;
const DPR列表 = [1, 2] as const;
const 双击窗口毫秒 = 280;

type 文字图集统计 = {
  图集数: number;
  页数: number;
  纹理字节: number;
  分档烘焙?: boolean;
  烘焙字号列表?: number[];
  分档命中数?: number;
  分档回退数?: number;
};

type 画布几何 = {
  设备宽: number;
  设备高: number;
  CSS宽: number;
  CSS高: number;
  dataset视口宽: string;
  dataset视口高: string;
  设备像素比: number;
};

type 采样记录 = {
  名称: string;
  页面: string;
  场景栈: string[];
  说明: string;
  状态: 调试状态;
  界面: 界面快照;
  画布: 画布几何;
  统计: 调试统计;
  文字图集: 文字图集统计 | null;
};

type 规则记录 = {
  固定序列: string[];
  双击间隔毫秒: number;
  无消行: {
    分数: number;
    消行数: number;
    显示分数: number;
    目标分数: number;
    流光数: number;
    落块数: number;
  };
  单行消除: {
    双击间隔毫秒: number;
    分数: number;
    消行数: number;
    显示分数: number;
    目标分数: number;
    落块数: number;
  };
};

await mkdir(输出, { recursive: true });

const 浏览器 = await chromium.launch({ channel: "chrome" });
const 全部结果: Awaited<ReturnType<typeof 验收一个DPR>>[] = [];
try {
  for (const DPR of DPR列表) 全部结果.push(await 验收一个DPR(浏览器, DPR));
} finally {
  await 浏览器.close();
}

await writeFile(
  join(输出, "结果.json"),
  JSON.stringify(
    {
      地址,
      环境: {
        浏览器: "Playwright + Chromium (channel: chrome)",
        视口: "390×844 CSS 像素，仅当前视口",
        设备像素比: [...DPR列表],
        性质: "Chromium 模拟视口，不是手机真机；不等同于真机验收",
        清晰度判定: "未做像素级或主观清晰度自动判定，必须人工查看截图",
        存档隔离: "每个 DPR 使用独立 browserContext；未调用桥写设置/金币，未写玩家原存档",
      },
      采样: 全部结果,
      结论: {
        规则通过: true,
        几何通过: true,
        文字图集分档烘焙: false,
        需要人工查看截图: true,
        截图采集不能单独证明主观清晰度: true,
      },
      时间: new Date().toISOString(),
    },
    null,
    2,
  ),
);
console.log(
  JSON.stringify(
    {
      通过: true,
      视口: "390×844 Chromium模拟（非真机）",
      DPR: [...DPR列表],
      采样: 全部结果.map((项) => ({
        DPR: 项.DPR,
        截图: 项.采样.length,
        规则: 项.规则,
        视频: 项.视频,
        页面错误: 项.页面错误.length + 项.控制台错误.length,
      })),
      输出,
    },
    null,
    2,
  ),
);

async function 验收一个DPR(浏览器实例: Browser, DPR: number) {
  const 上下文 = await 浏览器实例.newContext({
    viewport: { width: 视口.宽, height: 视口.高 },
    deviceScaleFactor: DPR,
    ...(DPR === 1 ? { recordVideo: { dir: 输出, size: { width: 视口.宽, height: 视口.高 } } } : {}),
  });
  const 页 = await 上下文.newPage();
  const 视频 = DPR === 1 ? 页.video() : null;
  const 页面错误: string[] = [];
  const 控制台错误: string[] = [];
  页.on("pageerror", (错误) => 页面错误.push(错误.message));
  页.on("console", (消息) => {
    if (消息.type() === "error") 控制台错误.push(消息.text());
  });

  const 前缀 = `DPR${DPR}-`;
  const 采样: 采样记录[] = [];
  let 规则: 规则记录 | null = null;

  const 读取状态 = async (): Promise<调试状态> => {
    const 状态 = await 页.evaluate(() => window.__three版__?.读取状态());
    if (!状态) throw new Error("读取状态失败");
    return 状态;
  };
  const 读取界面 = async (): Promise<界面快照> => {
    const 界面 = await 页.evaluate(() => window.__three版__?.读取界面());
    return 界面 ?? { 按钮: [] };
  };
  const 读取统计 = async (): Promise<调试统计> => {
    const 统计 = await 页.evaluate(() => window.__three版__?.读取统计());
    if (!统计) throw new Error("读取统计失败");
    return 统计;
  };
  const 读取画布几何 = async (): Promise<画布几何> =>
    页.evaluate(() => {
      const 画布 = document.querySelector("#游戏容器 canvas");
      if (!(画布 instanceof HTMLCanvasElement)) throw new Error("缺少游戏画布");
      const 矩形 = 画布.getBoundingClientRect();
      return {
        设备宽: 画布.width,
        设备高: 画布.height,
        CSS宽: 矩形.width,
        CSS高: 矩形.height,
        dataset视口宽: 画布.dataset.视口宽 ?? "",
        dataset视口高: 画布.dataset.视口高 ?? "",
        设备像素比: window.devicePixelRatio,
      };
    });

  const 断言无错误 = (名称: string): void => {
    assert.deepEqual(页面错误, [], `${名称} 出现 pageerror：${页面错误.join("；")}`);
    assert.deepEqual(控制台错误, [], `${名称} 出现 console.error：${控制台错误.join("；")}`);
  };

  const 等待状态 = async (
    判断: (状态: 调试状态) => boolean,
    描述: string,
    超时毫秒 = 10000,
  ): Promise<调试状态> => {
    const 开始 = Date.now();
    let 最后: 调试状态 | null = null;
    while (Date.now() - 开始 < 超时毫秒) {
      最后 = await 读取状态();
      if (判断(最后)) return 最后;
      await 页.waitForTimeout(70);
    }
    throw new Error(`等待「${描述}」超时，当前：${JSON.stringify(最后)}`);
  };
  const 等待页面 = (页面: string, 描述 = 页面) =>
    等待状态((状态) => 状态.页面 === 页面, `页面 ${描述}`);
  const 等待界面文字 = async (
    判断: (文字: readonly string[]) => boolean,
    描述: string,
    超时毫秒 = 8000,
  ): Promise<readonly string[]> => {
    const 开始 = Date.now();
    let 最后: readonly string[] = [];
    while (Date.now() - 开始 < 超时毫秒) {
      最后 = (await 读取界面()).文字 ?? [];
      if (判断(最后)) return 最后;
      await 页.waitForTimeout(70);
    }
    throw new Error(`等待「${描述}」超时，当前文字：${最后.join("、")}`);
  };
  const 查找按钮 = async (名称: string, 超时毫秒 = 10000): Promise<界面按钮快照> => {
    const 开始 = Date.now();
    let 最后列表: string[] = [];
    while (Date.now() - 开始 < 超时毫秒) {
      const 界面 = await 读取界面();
      最后列表 = 界面.按钮.map((项) => 项.名称);
      const 按钮 = 界面.按钮.find((项) => 项.名称 === 名称 && 项.可用 !== false);
      if (按钮) return 按钮;
      await 页.waitForTimeout(60);
    }
    throw new Error(`等待按钮「${名称}」超时，现有：${最后列表.join("、")}`);
  };
  const 点击按钮 = async (名称: string): Promise<void> => {
    const 按钮 = await 查找按钮(名称);
    await 页.mouse.click(按钮.左 + 按钮.宽 / 2, 按钮.上 + 按钮.高 / 2);
  };
  const 等两帧提交 = async (): Promise<void> => {
    for (let 帧 = 0; 帧 < 2; 帧++) {
      const 已提交 = await 页.evaluate(async () => {
        const 桥 = window.__GAMEMAKER_TEST__;
        if (!桥) throw new Error("缺少框架测试桥");
        return 桥.waitForRendered(桥.getSnapshot().sequence);
      });
      assert.equal(已提交, true, "采样前必须完成真实画面提交");
    }
  };
  const 断言采样 = (名称: string, 统计: 调试统计, 画布: 画布几何): 文字图集统计 | null => {
    const 图集 = 统计.文字图集 as 文字图集统计 | null;
    assert.equal(统计.设备像素比, DPR, `${名称} window.devicePixelRatio=${统计.设备像素比}`);
    assert.equal(画布.设备像素比, DPR, `${名称} 画布 window.devicePixelRatio 不符`);
    assert.equal(画布.设备宽, 视口.宽 * DPR, `${名称} 画布设备宽=${画布.设备宽}`);
    assert.equal(画布.设备高, 视口.高 * DPR, `${名称} 画布设备高=${画布.设备高}`);
    assert.ok(
      Math.abs(画布.CSS宽 - 视口.宽) <= 0.5,
      `${名称} 画布 CSS 宽=${画布.CSS宽}，应为 ${视口.宽}`,
    );
    assert.ok(
      Math.abs(画布.CSS高 - 视口.高) <= 0.5,
      `${名称} 画布 CSS 高=${画布.CSS高}，应为 ${视口.高}`,
    );
    assert.equal(Math.round(画布.CSS宽 * DPR), 画布.设备宽, `${名称} 画布设备宽与 CSS 宽×DPR 不符`);
    assert.equal(Math.round(画布.CSS高 * DPR), 画布.设备高, `${名称} 画布设备高与 CSS 高×DPR 不符`);
    assert.equal(统计.画布.宽, 画布.设备宽, `${名称} 调试桥画布宽与 DOM 不符`);
    assert.equal(统计.画布.高, 画布.设备高, `${名称} 调试桥画布高与 DOM 不符`);
    assert.equal(Number(统计.画布.视口宽), Math.round(画布.CSS宽), `${名称} dataset 视口宽不符`);
    assert.equal(Number(统计.画布.视口高), Math.round(画布.CSS高), `${名称} dataset 视口高不符`);
    assert.ok(图集, `${名称} 缺少文字图集统计`);
    assert.equal(图集.分档烘焙, false, `${名称} 文字图集分档烘焙应为 false`);
    assert.equal(
      统计.渲染.纹理预算字节,
      纹理预算字节,
      `${名称} 纹理预算=${统计.渲染.纹理预算字节}`,
    );
    assert.ok(
      统计.渲染.纹理峰值字节 <= 纹理预算字节,
      `${名称} 纹理峰值 ${统计.渲染.纹理峰值字节} 超过 32MiB`,
    );
    断言无错误(名称);
    return 图集;
  };
  const 截图 = async (名称: string, 说明: string): Promise<void> => {
    await 等两帧提交();
    const 状态 = await 读取状态();
    const 界面 = await 读取界面();
    const 统计 = await 读取统计();
    const 画布 = await 读取画布几何();
    const 文字图集 = 断言采样(名称, 统计, 画布);
    await 页.screenshot({ path: join(输出, `${前缀}${名称}.png`) });
    采样.push({
      名称,
      页面: 状态.页面,
      场景栈: [...状态.场景栈],
      说明,
      状态,
      界面,
      画布,
      统计,
      文字图集,
    });
  };
  const 滚动设置到底 = async (): Promise<number> => {
    let 上次 = -1;
    for (let 次 = 0; 次 < 12; 次++) {
      await 页.mouse.move(195, 420);
      await 页.mouse.wheel(0, 520);
      await 页.waitForTimeout(180);
      const 文字 = (await 读取界面()).文字 ?? [];
      const 当前 = Number(文字.find((项) => 项.startsWith("滚动:"))?.slice(3) ?? 0);
      if (当前 === 上次) return 当前;
      上次 = 当前;
    }
    throw new Error(`设置页未能滚动到可复现位置，最后滚动=${上次}`);
  };
  const 双击软降 = async (): Promise<number> => {
    const 按钮 = await 查找按钮("软降");
    await 页.mouse.move(按钮.左 + 按钮.宽 / 2, 按钮.上 + 按钮.高 / 2);
    await 页.mouse.down();
    const 首按 = Date.now();
    await 页.mouse.up();
    await 页.waitForTimeout(35);
    await 页.mouse.down();
    const 次按 = Date.now();
    await 页.mouse.up();
    return 次按 - 首按;
  };

  try {
    await 页.goto(地址, { waitUntil: "domcontentloaded" });
    await 页.waitForFunction(() => window.__three版__ !== undefined, undefined, {
      timeout: 20000,
    });
    await 等待状态((状态) => 状态.页面 === "菜单", "菜单");
    await 查找按钮("开始游戏");

    await 截图("01-首页", "主界面菜单态，真实 Chromium 模拟视口");

    // —— 全局设置：上半、语言下拉、滚动后的下半段 ——
    await 点击按钮("设置");
    await 等待页面("设置");
    await 查找按钮("返回主菜单");
    await 截图("02a-全局设置-上半", "设置页顶部常规分组");
    await 点击按钮("语言下拉框");
    await 等待界面文字((文字) => 文字.includes("语言菜单:true"), "语言菜单展开");
    await 截图("02b-全局设置-语言下拉", "语言下拉展开；本采样不要求切换 English");
    const 关闭语言 = await 查找按钮("关闭语言菜单");
    // 关闭热区覆盖全屏，点左上安全区，避开右侧下拉选项。
    await 页.mouse.click(关闭语言.左 + 20, 关闭语言.上 + 80);
    await 等待界面文字((文字) => 文字.includes("语言菜单:false"), "语言菜单关闭");
    const 滚动值 = await 滚动设置到底();
    await 截图("02c-全局设置-下半", `滚动到底部，滚动位置=${滚动值}`);
    await 点击按钮("返回主菜单");
    await 等待页面("菜单");
    await 查找按钮("开始游戏");

    // —— 成就 ——
    await 点击按钮("成就");
    await 等待页面("成就");
    await 查找按钮("返回主菜单");
    await 截图("03-成就", "成就列表页");
    await 点击按钮("返回主菜单");
    await 等待页面("菜单");
    await 查找按钮("开始游戏");

    // —— 商店 ——
    await 点击按钮("商店");
    await 等待页面("商店");
    await 查找按钮("返回主菜单");
    await 截图("04-商店", "商店页");
    await 点击按钮("返回主菜单");
    await 等待页面("菜单");
    await 查找按钮("开始游戏");

    // —— 模式选择 ——
    await 点击按钮("开始游戏");
    await 查找按钮("开始:马拉松");
    await 查找按钮("返回");
    await 截图("05-模式选择", "四模式选择页");

    // —— 马拉松对局：有效用时 600ms 后再采样 ——
    await 点击按钮("开始:马拉松");
    await 等待状态((状态) => 状态.页面 === "对局" && 状态.场景栈.at(-1) === "对局", "马拉松对局");
    await 等待状态((状态) => 状态.有效用时 >= 600, "有效用时≥600ms", 15000);
    await 截图("06-马拉松对局", "马拉松真实有效用时≥600ms");

    // —— 固定序列 O,T,I：双击软降，无消行必须 0 分且无计分流光 ——
    await 页.evaluate(() => window.__再消一行测试__?.设置序列(["O", "T", "I"]));
    await 等两帧提交();
    const 固定前 = await 读取状态();
    assert.equal(固定前.分数, 0, "固定序列开局分数应为 0");
    assert.equal(固定前.消行数, 0, "固定序列开局不应有消行");
    const 无消行间隔 = await 双击软降();
    assert.ok(无消行间隔 < 双击窗口毫秒, `无消行双击间隔 ${无消行间隔}ms 应小于 ${双击窗口毫秒}ms`);
    await 页.waitForFunction(
      () => (window.__three版__?.读取统计().对局统计.落块数 ?? 0) >= 1,
      undefined,
      { timeout: 6000 },
    );
    await 等两帧提交();
    const 无消行状态 = await 读取状态();
    const 无消行统计 = await 读取统计();
    assert.equal(无消行状态.分数, 0, `无消行分数=${无消行状态.分数}`);
    assert.equal(无消行状态.消行数, 0, `无消行消行数=${无消行状态.消行数}`);
    assert.equal(无消行状态.计分反馈.显示分数, 0, "无消行显示分数应为 0");
    assert.equal(无消行状态.计分反馈.目标分数, 0, "无消行目标分数应为 0");
    assert.deepEqual(无消行状态.计分反馈.流光, [], "无消行不应出现计分流光");
    assert.ok(无消行统计.对局统计.落块数 >= 1, "双击软降后应真实落块");

    // —— 准备单行消除：双击软降，最终显示分数必须 1100 ——
    await 页.evaluate(() => window.__再消一行测试__?.准备单行消除());
    await 等两帧提交();
    const 单行前 = await 读取状态();
    assert.equal(单行前.分数, 0, "单行消除 fixture 开局分数应为 0");
    const 单行间隔 = await 双击软降();
    assert.ok(单行间隔 < 双击窗口毫秒, `单行消除双击间隔 ${单行间隔}ms 应小于 ${双击窗口毫秒}ms`);
    await 页.waitForFunction(
      () => {
        const 状态 = window.__three版__?.读取状态();
        return 状态?.分数 === 1100 && 状态.计分反馈.显示分数 === 1100;
      },
      undefined,
      { timeout: 10000 },
    );
    const 单行后 = await 读取状态();
    const 单行统计 = await 读取统计();
    assert.equal(单行后.分数, 1100, `单行消除分数=${单行后.分数}`);
    assert.equal(单行后.消行数, 1, `单行消除消行数=${单行后.消行数}`);
    assert.equal(单行后.计分反馈.目标分数, 1100, "单行消除目标分数应为 1100");
    assert.equal(单行后.计分反馈.显示分数, 1100, "单行消除显示分数应为 1100");
    assert.ok(单行统计.对局统计.落块数 >= 1, "单行消除前应真实落块");
    规则 = {
      固定序列: ["O", "T", "I"],
      双击间隔毫秒: 无消行间隔,
      无消行: {
        分数: 无消行状态.分数,
        消行数: 无消行状态.消行数,
        显示分数: 无消行状态.计分反馈.显示分数,
        目标分数: 无消行状态.计分反馈.目标分数,
        流光数: 无消行状态.计分反馈.流光.length,
        落块数: 无消行统计.对局统计.落块数,
      },
      单行消除: {
        双击间隔毫秒: 单行间隔,
        分数: 单行后.分数,
        消行数: 单行后.消行数,
        显示分数: 单行后.计分反馈.显示分数,
        目标分数: 单行后.计分反馈.目标分数,
        落块数: 单行统计.对局统计.落块数,
      },
    };
    await 截图("07-单行消除计分", "真实双击软降至单行消除，计分反馈最终显示 1100");

    // —— 暂停 → 对局设置 → 返回暂停菜单 → 继续 ——
    await 点击按钮("暂停");
    await 等待状态((状态) => 状态.阶段 === "暂停", "暂停");
    await 截图("08-暂停", "暂停面板");
    await 点击按钮("对局设置");
    await 等待状态((状态) => 状态.对局设置打开 === true, "对局设置打开");
    await 截图("09-对局设置", "暂停中的对局设置面板");
    await 点击按钮("返回暂停菜单");
    await 等待状态((状态) => 状态.对局设置打开 === false, "返回暂停菜单");
    await 点击按钮("继续");
    await 等待状态((状态) => 状态.阶段 === "进行中", "继续对局");

    // —— 结算 fixture：等场景栈包含结算后再采样 ——
    await 页.evaluate(() => window.__再消一行测试__?.准备结算());
    await 等待状态((状态) => 状态.场景栈.includes("结算"), "结算覆盖页", 12000);
    await 截图("10-结算", "准备结算 fixture 触发，场景栈包含结算");

    assert.deepEqual(页面错误, [], `DPR${DPR} 运行中 pageerror：${页面错误.join("；")}`);
    assert.deepEqual(控制台错误, [], `DPR${DPR} 运行中 console.error：${控制台错误.join("；")}`);

    const 结果 = {
      DPR,
      视口: `390×844 CSS，DPR${DPR}`,
      环境: "Chromium 模拟视口，不是手机真机",
      说明: "截图用于人工查看文字清晰度与操作盘布局；脚本只自动断言几何、纹理预算和规则",
      采样,
      规则,
      页面错误,
      控制台错误,
      视频: DPR === 1 ? `DPR1-操作盘.webm` : null,
      时间: new Date().toISOString(),
    };
    await writeFile(join(输出, `DPR${DPR}.json`), JSON.stringify(结果, null, 2));
    return 结果;
  } catch (错误) {
    await 页.screenshot({ path: join(输出, `${前缀}失败现场.png`) }).catch(() => undefined);
    await writeFile(
      join(输出, `${前缀}失败现场.json`),
      JSON.stringify(
        {
          DPR,
          地址,
          错误: 错误 instanceof Error ? 错误.message : String(错误),
          页面错误,
          控制台错误,
          状态: await 读取状态().catch(() => null),
          界面: await 读取界面().catch(() => null),
          统计: await 读取统计().catch(() => null),
        },
        null,
        2,
      ),
    );
    throw 错误;
  } finally {
    await 上下文.close();
    if (视频) {
      const 录制路径 = await 视频.path();
      await rename(录制路径, join(输出, "DPR1-操作盘.webm"));
    }
  }
}
