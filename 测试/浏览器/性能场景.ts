import type Phaser from "phaser";
import type { Page } from "playwright";
import { 每日方块序列 } from "../../代码/玩法/再消一行";
import { 点击测试交互, 等待测试场景 } from "../../框架/开发/浏览器测试操作";
import { 准备页面 } from "./性能准备";
import { 性能实验场景 } from "./性能实验";
import { 准备自动游玩, 完赛后重开, 执行自动游玩, 自动游玩证据, 验收自动游玩 } from "./方块自动游玩";

type 现场 = Phaser.Scene & { 状态: { 阶段: string }; 模式: string };

async function 准备对局(页面: Page, 地址: string, 模式: string, 动态: boolean, 暂停 = false) {
  await 准备页面(页面, 地址, 动态);
  await 点击测试交互(页面, "menu.start");
  await 页面.waitForFunction(
    (模式) =>
      window.__GAMEMAKER_TEST__
        ?.getSnapshot("概要")
        .interactives.some((项) => 项.name === `mode.${模式}` && 项.enabled && 项.visible),
    模式,
  );
  await 点击测试交互(页面, `mode.${模式}`);
  await 等待测试场景(页面, "再消一行对局");
  await 页面.evaluate(
    (序列) => window.__再消一行测试__?.设置序列(序列),
    每日方块序列("2026-10-18", 200),
  );
  if (暂停) await 页面.keyboard.press("p");
}

async function 验收对局(页面: Page, 模式: string, 阶段 = "进行中") {
  const 状态 = await 页面.evaluate(() => {
    const s = window.__游戏__.scene.getScene("再消一行对局") as 现场;
    return { 模式: s.模式, 阶段: s.状态.阶段, 可见: document.visibilityState };
  });
  if (状态.模式 !== 模式 || 状态.阶段 !== 阶段 || 状态.可见 !== "visible")
    throw new Error(`采样场景失效：${JSON.stringify(状态)}`);
}

async function 操作对局(页面: Page, 秒数: number) {
  const 次数 = Math.min(6, Math.max(1, Math.floor(秒数 / 2)));
  for (let i = 0; i < 次数; i++) {
    await 页面.keyboard.press(i % 2 === 0 ? "ArrowLeft" : "ArrowRight");
    await 页面.keyboard.press("x");
    await 页面.waitForTimeout(250);
    await 页面.keyboard.press("Space");
    await 页面.waitForTimeout(Math.max(0, (秒数 * 1000) / 次数 - 400));
  }
}

export const 性能场景库 = [
  ...性能实验场景,
  {
    名称: "菜单动态",
    准备: (页: Page, 地址: string) => 准备页面(页, 地址, true),
    验收: async (页: Page) => {
      if (!(await 页.evaluate(() => window.__游戏__?.scene.isActive("开始菜单"))))
        throw new Error("未在菜单");
    },
  },
  {
    名称: "纯享动态",
    准备: async (页: Page, 地址: string) => {
      await 准备页面(页, 地址, true);
      await 点击测试交互(页, "menu.scenery");
    },
    验收: async (页: Page) => {
      const 有效 = await 页.evaluate(() => {
        const 菜单 = window.__游戏__.scene.getScene("开始菜单") as Phaser.Scene & {
          纯享背景: boolean;
        };
        return 菜单.scene.isActive() && 菜单.纯享背景 && document.visibilityState === "visible";
      });
      if (!有效) throw new Error("未在纯享模式");
    },
  },
  ...(
    [
      ["马拉松动态", "马拉松", true],
      ["冲刺动态", "冲刺", true],
      ["马拉松静态", "马拉松", false],
    ] as const
  ).map(([名称, 模式, 动态]) => ({
    名称,
    准备: (页: Page, 地址: string) => 准备对局(页, 地址, 模式, 动态),
    操作: 操作对局,
    验收: (页: Page) => 验收对局(页, 模式),
  })),
  {
    名称: "静态暂停",
    准备: (页: Page, 地址: string) => 准备对局(页, 地址, "马拉松", false, true),
    验收: (页: Page) => 验收对局(页, "马拉松", "暂停"),
  },
  ...(["马拉松", "冲刺"] as const).map((模式) => ({
    名称: 模式 === "冲刺" ? "冲刺40行完赛" : "马拉松自动游玩",
    说明:
      模式 === "冲刺"
        ? "固定七袋序列，从空棋盘真实操作完成40行，每块核对棋盘。"
        : "固定七袋序列真实操作35块，逐块核对消行与棋盘。",
    准备: async (页: Page, 地址: string) => {
      await 准备页面(页, 地址, true);
      await 准备自动游玩(页, 模式);
    },
    操作: 执行自动游玩,
    验收: 验收自动游玩,
    证据: 自动游玩证据,
  })),
  {
    名称: "冲刺完赛重开",
    说明: "空棋盘完成40行、显示结算，再真实点击重开；全流程采样。",
    准备: async (页: Page, 地址: string) => {
      await 准备页面(页, 地址, true);
      await 准备自动游玩(页, "冲刺");
    },
    操作: async (页: Page, 秒数: number) => {
      await 执行自动游玩(页, 秒数 * 0.85);
      await 完赛后重开(页);
    },
    验收: 验收自动游玩,
    证据: 自动游玩证据,
  },
];
