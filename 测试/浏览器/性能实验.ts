import type { Page } from "playwright";
import { 准备页面 } from "./性能准备";
import {
  准备自动游玩,
  type 性能阶段记录,
  执行多局游玩,
  执行持续游玩,
  自动游玩证据,
} from "./方块自动游玩";

interface 负载参数 {
  数量倍率: number;
  每秒次数: number;
  恢复秒数: number;
}
const 默认: 负载参数 = { 数量倍率: 1, 每秒次数: 2, 恢复秒数: 2 };
const 记录 = new WeakMap<Page, object>();
const 对照基线 = "对照·完整对局";
type 音频状态 = ReturnType<NonNullable<Window["__再消一行测试__"]>["读取音频"]>;
const 音频准备 = new WeakMap<Page, 音频状态>();
const 计划落块 = new WeakMap<Page, number>();
const 对照 = [
  { 名称: 对照基线 },
  { 名称: "对照·关闭动态背景", 背景: false },
  { 名称: "对照·关闭落块特效", 禁用: "落块特效" },
  { 名称: "对照·关闭消行特效", 禁用: "消行特效" },
  { 名称: "对照·关闭音效", 音效: 0 },
  { 名称: "对照·关闭音乐", 音乐: 0 },
  { 名称: "对照·关闭环境声", 环境: 0 },
  { 名称: "对照·全部静音", 音乐: 0, 音效: 0, 环境: 0 },
  { 名称: "对照·关闭计时文字", 禁用: "计时文字" },
  {
    名称: "对照·完全简化",
    背景: false,
    禁用: "落块特效,消行特效,计时文字",
    音乐: 0,
    音效: 0,
    环境: 0,
  },
];
const 对照场景 = 对照.map((项) => ({
  名称: 项.名称,
  分组: "对局对照",
  基线: 对照基线,
  说明: "固定每秒落块频率，真实消行；完赛后同页重开。每项仅改变对应功能。基线音乐与环境声为 15，音效为 80；写 0 时不启动对应播放。",
  准备: async (页: Page, 地址: string) => {
    const url = new URL(地址);
    if (项.禁用) url.searchParams.set("gm-disable", 项.禁用);
    await 准备页面(页, url.href, 项.背景 ?? true, {
      音乐: 项.音乐 ?? 15,
      音效: 项.音效 ?? 80,
      环境: 项.环境 ?? 15,
    });
    await 准备自动游玩(页, "冲刺");
  },
  操作: async (页: Page, 秒数: number, 参数?: 负载参数) => {
    const 配置 = 参数 ?? 默认;
    计划落块.set(页, Math.ceil(秒数 * 配置.每秒次数));
    await 执行持续游玩(页, 秒数, 配置.每秒次数);
  },
  验收: async (页: Page, 阶段?: "准备" | "完成") => {
    const 状态 = await 页.evaluate(() => ({
      状态: window.__再消一行测试__?.读取状态(),
      可见: document.visibilityState,
    }));
    if (!状态.状态 || 状态.可见 !== "visible" || 状态.状态.阶段 === "暂停")
      throw new Error("对照未处于真实可见对局");
    const 音频 = await 页.evaluate(() => window.__再消一行测试__?.读取音频());
    if (!音频) throw new Error("缺少运行时音频证据，请加载最新构建");
    const 音乐 = 项.音乐 ?? 15,
      音效 = 项.音效 ?? 80,
      环境 = 项.环境 ?? 15;
    if (
      音频.游戏.音乐音量 !== 音乐 ||
      音频.游戏.音效音量 !== 音效 ||
      音频.游戏.背景音效音量 !== 环境 ||
      音频.框架.音乐音量 !== 音乐 ||
      音频.框架.音效音量 !== 音效 ||
      音频.框架.背景音乐 !== 音乐 > 0
    )
      throw new Error(`请求音量与运行时不一致：${JSON.stringify(音频)}`);
    if (音乐 === 0 && 音频.框架.当前背景音乐 !== null) throw new Error("静音音乐仍登记播放");
    if (音乐 > 0 && (!音频.框架.当前背景音乐 || 音频.框架.上下文 !== "running"))
      throw new Error("音乐请求未进入运行中的音频环境");
    if (阶段 === "准备") 音频准备.set(页, 音频);
    if (阶段 === "完成") {
      const 证据 = await 自动游玩证据(页);
      if (!证据.累计落块) throw new Error("没有持续执行真实落块");
      if (证据.累计落块 !== 计划落块.get(页))
        throw new Error(
          `实际落块${证据.累计落块}与计划${计划落块.get(页)}不符，不能作为相同负载对照`,
        );
      const 前 = 音频准备.get(页);
      if (!前) throw new Error("缺少采样前音频条件");
      const 调用 = 音频.框架.音效调用 - 前.框架.音效调用;
      if (音效 === 0 && 调用 !== 0) throw new Error("静音窗口仍调用音效播放器");
      if (音效 > 0 && 调用 <= 0) throw new Error("有声窗口未调用音效播放器");
    }
  },
  证据: async (页: Page) => ({
    ...(await 自动游玩证据(页)),
    禁用: 项.禁用 ?? "",
    背景: 项.背景 ?? true,
    音量: { 音乐: 项.音乐 ?? 15, 音效: 项.音效 ?? 80, 环境: 项.环境 ?? 15 },
    实际音频: {
      准备: 音频准备.get(页),
      完成: await 页.evaluate(() => window.__再消一行测试__?.读取音频()),
    },
    计划落块: 计划落块.get(页),
  }),
}));
const 资源 = [
  { 编号: "drop", 名称: "落块特效", 档位: [0, 1, 10, 50] },
  { 编号: "clear", 名称: "消行特效", 档位: [0, 1, 10, 50] },
  { 编号: "block", 名称: "方块单元", 档位: [0, 100, 1000, 10000] },
  { 编号: "sfx", 名称: "合成音效", 档位: [0, 1, 4, 16] },
  { 编号: "music", 名称: "程序音乐", 档位: [0, 1, 2, 4] },
];
const 压力场景 = 资源.flatMap((资源) =>
  资源.档位.map((数量) => ({
    名称: `压力·${资源.名称}·${数量}`,
    分组: "资源压力",
    基线: `压力·${资源.名称}·0`,
    说明: `真实${资源.名称}，档位${数量}×数量倍率；频率独立于时长。包含末尾恢复期；方块共享贴图，音乐按并发曲谱数。`,
    准备: async (页: Page, 地址: string) => {
      await 页.addInitScript(() => {
        localStorage.setItem(
          "再消一行:设置",
          JSON.stringify({ 背景音乐: true, 音乐音量: 15, 音效音量: 80, 背景音效音量: 0 }),
        );
        localStorage.setItem(
          "gamemaker:settings",
          JSON.stringify({ 背景音乐: true, 音乐音量: 15, 音效音量: 80 }),
        );
      });
      const url = new URL(地址);
      url.searchParams.set("gm-stress", "1");
      await 页.goto(url.href);
      await 页.waitForFunction(() => Boolean(window.__GAMEMAKER_TEST__?.压力));
      await 页.locator("canvas").click({ position: { x: 10, y: 10 } });
      await 页.evaluate(
        (资源) => window.__GAMEMAKER_TEST__?.压力?.开始({ 资源, 数量: 0, 每秒次数: 0 }),
        资源.编号,
      );
    },
    操作: async (页: Page, 秒数: number, 参数?: 负载参数) => {
      const 配置 = 参数 ?? 默认;
      const 恢复 = 配置.恢复秒数;
      if (恢复 >= 秒数) throw new Error("恢复秒数需小于每轮秒数");
      const 目标 = 数量 * 配置.数量倍率;
      await 页.evaluate((配置) => window.__GAMEMAKER_TEST__?.压力?.开始(配置), {
        资源: 资源.编号,
        数量: 目标,
        每秒次数: 配置.每秒次数,
      });
      await 页.waitForTimeout((秒数 - 恢复) * 1000);
      const 峰 = await 页.evaluate(() => window.__GAMEMAKER_TEST__?.压力?.读取());
      if (峰?.数量 !== 目标 || (目标 > 0 && 峰.更新帧 === 0)) throw new Error("请求压力未真正运行");
      await 页.evaluate(() => window.__GAMEMAKER_TEST__?.压力?.停止());
      await 页.waitForTimeout(恢复 * 1000);
      const 末 = await 页.evaluate(() => window.__GAMEMAKER_TEST__?.压力?.读取());
      记录.set(页, {
        资源: 资源.编号,
        档位: 数量,
        倍率: 配置.数量倍率,
        恢复秒数: 恢复,
        负载末: 峰,
        恢复末: 末,
      });
    },
    验收: async (页: Page, 阶段?: "准备" | "完成") => {
      const 状态 = await 页.evaluate(() => window.__GAMEMAKER_TEST__?.压力?.读取());
      if (!状态) throw new Error("压力接口缺失");
      if (阶段 === "完成" && (!状态.已停止 || 状态.数量 !== 0)) throw new Error("压力实例未清理");
    },
    证据: async (页: Page) => 记录.get(页),
  })),
);
async function 验收多局检查点(页: Page) {
  const 状态 = await 页.evaluate(() => ({
    状态: window.__再消一行测试__?.读取状态(),
    音频: window.__再消一行测试__?.读取音频(),
    可见: document.visibilityState,
  }));
  if (
    状态.状态?.阶段 !== "进行中" ||
    状态.状态.棋盘.some((行) => 行.some((格) => 格 !== null)) ||
    状态.状态.消行数 !== 0 ||
    状态.状态.分数 !== 0 ||
    状态.可见 !== "visible"
  )
    throw new Error("多局检查没有处于可见的新局检查点");
  const 声 = 状态.音频;
  if (
    声?.游戏.音乐音量 !== 15 ||
    声.游戏.音效音量 !== 80 ||
    声.游戏.背景音效音量 !== 15 ||
    声.框架.音乐音量 !== 15 ||
    声.框架.音效音量 !== 80 ||
    !声.框架.背景音乐 ||
    声.框架.上下文 !== "running"
  )
    throw new Error("多局检查实际音量或音频环境不符");
}
const 多局场景 = {
  名称: "冲刺三局资源检查",
  分组: "多局检查",
  说明: "同页三次真实40行完赛重开，按8次/秒计划落块，每局恢复1秒后记录相同状态资源。",
  准备: async (页: Page, 地址: string) => {
    await 准备页面(页, 地址, true, { 音乐: 15, 音效: 80, 环境: 15 });
    await 准备自动游玩(页, "冲刺");
  },
  操作: async (页: Page, _秒数: number, _参数?: 负载参数, 阶段记录?: 性能阶段记录) => {
    await 执行多局游玩(页, 3, 8, 1, 阶段记录);
  },
  验收: async (页: Page, 阶段?: "准备" | "完成") => {
    await 验收多局检查点(页);
    if (阶段 === "完成") {
      const 证据 = await 自动游玩证据(页);
      if (
        证据.重开数 !== 3 ||
        证据.累计完赛 !== 3 ||
        !证据.计划落块 ||
        证据.累计落块 !== 证据.计划落块 * 3
      )
        throw new Error("多局检查未完整完成三局真实操作");
    }
  },
  证据: async (页: Page) => ({
    ...(await 自动游玩证据(页)),
    局数: 3,
    恢复秒数: 1,
    实际音频: await 页.evaluate(() => window.__再消一行测试__?.读取音频()),
    空棋盘: await 页.evaluate(() =>
      window.__再消一行测试__?.读取状态().棋盘.every((行) => 行.every((格) => 格 === null)),
    ),
  }),
};
interface 长测记录 {
  批次: number;
  累计落块: number;
  累计完赛: number;
  实际操作秒数: number;
}
const 长测证据 = new WeakMap<Page, 长测记录>();
const 长测场景 = {
  名称: "冲刺长时多局",
  分组: "长时检查",
  说明: "同页连续三局一批，每批恢复后比较空棋盘资源；至少运行指定时长，保留整批收尾的实际时长。",
  准备: 多局场景.准备,
  操作: async (页: Page, 秒数: number, _参数?: 负载参数, 阶段记录?: 性能阶段记录) => {
    if (!阶段记录) throw new Error("长测需要阶段采集接口");
    const 证据: 长测记录 = { 批次: 0, 累计落块: 0, 累计完赛: 0, 实际操作秒数: 0 };
    长测证据.set(页, 证据);
    const 起 = performance.now();
    while (performance.now() - 起 < 秒数 * 1000) {
      if (证据.批次 >= 90) throw new Error("长测最多90批，请降低测试时长；不能丢弃后续检查点");
      await 阶段记录.阶段(`第${证据.批次 + 1}批三局`, async () => {
        await 执行多局游玩(页, 3, 8, 1);
        const 本批 = await 自动游玩证据(页);
        if (本批.累计完赛 !== 3 || !本批.计划落块 || 本批.累计落块 !== 本批.计划落块 * 3)
          throw new Error("长测本批真实操作不足");
        证据.批次++;
        证据.累计落块 += 本批.累计落块;
        证据.累计完赛 += 本批.累计完赛;
      });
      await 阶段记录.阶段("同状态恢复", async () => {
        await 页.waitForTimeout(1000);
        await 验收多局检查点(页);
      });
      证据.实际操作秒数 = (performance.now() - 起) / 1000;
    }
    if (证据.实际操作秒数 < 秒数) throw new Error("长测未覆盖请求时长");
  },
  验收: async (页: Page, 阶段?: "准备" | "完成") => {
    await 验收多局检查点(页);
    if (阶段 === "完成") {
      const 长测 = 长测证据.get(页);
      const 本批 = await 自动游玩证据(页);
      if (
        !长测 ||
        长测.批次 < 1 ||
        长测.累计完赛 !== 长测.批次 * 3 ||
        本批.重开数 !== 长测.累计完赛 ||
        !本批.计划落块 ||
        长测.累计落块 !== 长测.累计完赛 * 本批.计划落块
      )
        throw new Error("长测累计操作量不符");
    }
  },
  证据: async (页: Page) => ({
    ...(await 多局场景.证据(页)),
    每批局数: 3,
    局数: 长测证据.get(页)?.累计完赛,
    累计落块: 长测证据.get(页)?.累计落块,
    累计完赛: 长测证据.get(页)?.累计完赛,
    长测: 长测证据.get(页),
  }),
};
export const 性能实验场景 = [...对照场景, ...压力场景, 多局场景, 长测场景];
