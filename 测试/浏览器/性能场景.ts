import type { Page } from "playwright";

async function 点击(页: Page, 名称: string) {
  const 点 = await 页.evaluate((名) => {
    const 桥 = window.__GAMEMAKER_TEST__;
    const 快照 = 桥?.getSnapshot();
    const 项 = 快照?.interactives.find((项) => 项.name === 名 && 项.enabled);
    const 布 = document.querySelector("canvas")?.getBoundingClientRect();
    if (!项?.bounds || !布 || !快照) throw new Error("找不到真实按钮：" + 名);
    return {
      x: 布.x + ((项.bounds.x + 项.bounds.width / 2) / 快照.width) * 布.width,
      y: 布.y + ((项.bounds.y + 项.bounds.height / 2) / 快照.height) * 布.height,
    };
  }, 名称);
  await 页.mouse.click(点.x, 点.y);
}
async function 准备(页: Page, 地址: string, 对局 = false) {
  await 页.goto(地址);
  await 页.waitForFunction(() => (window.__GAMEMAKER_TEST__?.getSnapshot().sequence ?? 0) > 0);
  if (对局) {
    await 点击(页, "开始游戏");
    await 点击(页, "开始:马拉松");
    await 页.waitForFunction(
      () =>
        window.__three版__?.读取状态().入场秒 === null &&
        window.__three版__?.读取状态().阶段 === "进行中",
    );
  }
}
async function 验收(页: Page) {
  const 快照 = await 页.evaluate(() => window.__GAMEMAKER_TEST__?.getSnapshot());
  if (!快照?.sequence || 快照.diagnostics.errors.length) throw new Error("游戏标准桥不可用");
}
const 证据 = (页: Page) => 页.evaluate(() => window.__three版__?.读取统计());
export const 性能场景库 = [
  {
    名称: "菜单基准",
    分组: "基础场景",
    准备: (页: Page, 地址: string) => 准备(页, 地址),
    验收,
    证据,
  },
  {
    名称: "对局输入",
    分组: "对局对照",
    准备: (页: Page, 地址: string) => 准备(页, 地址, true),
    验收,
    证据,
    操作: async (页: Page, 秒数: number, 负载?: { 每秒次数: number }) => {
      const 频率 = 负载?.每秒次数 ?? 8;
      const 结束 = Date.now() + 秒数 * 1000;
      let 次数 = 0;
      while (Date.now() < 结束) {
        await 页.keyboard.press(次数++ % 2 ? "ArrowLeft" : "ArrowRight");
        await 页.waitForTimeout(1000 / 频率);
      }
    },
  },
  {
    名称: "商店基准",
    分组: "基础场景",
    准备: async (页: Page, 地址: string) => {
      await 准备(页, 地址);
      await 点击(页, "商店");
      await 页.waitForFunction(
        () =>
          window.__three版__?.读取状态().页面 === "商店" &&
          !window.__three版__?.读取界面().文字?.includes("页面开合:播放中"),
      );
    },
    验收,
    证据,
  },
  {
    名称: "暂停基准",
    分组: "基础场景",
    准备: async (页: Page, 地址: string) => {
      await 准备(页, 地址, true);
      await 点击(页, "暂停");
      await 页.waitForFunction(() => window.__three版__?.读取状态().阶段 === "暂停");
    },
    验收,
    证据,
  },
  {
    名称: "纹理升压释放",
    分组: "资源压力",
    准备: (页: Page, 地址: string) => 准备(页, 地址),
    验收,
    证据,
    操作: async (
      页: Page,
      秒数: number,
      负载?: { 数量倍率: number; 恢复秒数: number },
      记录?: { 阶段(名: string, 操作: () => Promise<void>): Promise<void> },
    ) => {
      const 执行 = async () => {
        const 数量 = Math.min(64, Math.max(1, Math.round(16 * (负载?.数量倍率 ?? 1))));
        await 页.evaluate((数量) => {
          if (!window.__three版__?.设置资源压力) throw new Error("本机压力入口不可用");
          window.__three版__.设置资源压力(数量);
        }, 数量);
        await 页.waitForTimeout(Math.max(1, 秒数 - (负载?.恢复秒数 ?? 1)) * 1000);
      };
      try {
        if (记录) await 记录.阶段("升压", 执行);
        else await 执行();
      } finally {
        await 页.evaluate(() => window.__three版__?.设置资源压力?.(0));
      }
      const 恢复 = () => 页.waitForTimeout((负载?.恢复秒数 ?? 1) * 1000);
      if (记录) await 记录.阶段("释放恢复", 恢复);
      else await 恢复();
    },
  },
];
