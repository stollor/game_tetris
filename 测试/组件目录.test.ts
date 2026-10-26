import { expect, test } from "bun:test";
import { access } from "node:fs/promises";
import { 成就定义 } from "../代码/成就/再消一行成就";
import { 项目界面资源 } from "../组件/资源目录";

test("资源目录仍列出游戏真实的套件、配色、组件、按钮和图标", () => {
  expect(new Set(项目界面资源.map((项) => 项.分类))).toEqual(
    new Set(["套件", "配色", "组件", "按钮", "图标"]),
  );
  expect(new Set(项目界面资源.map((项) => 项.编号)).size).toBe(项目界面资源.length);
  expect(项目界面资源.filter((项) => 项.分类 === "图标").map((项) => 项.名称)).toEqual([
    "关闭",
    "方块币",
    "风景",
    "设置",
    "成就",
    "商店",
    "排行",
    ...成就定义.map((项) => 项.名称),
  ]);
});

test("主题预览索引中的源码位置均真实存在", async () => {
  for (const 项 of 项目界面资源) await access(new URL(`../${项.源码}`, import.meta.url));
});

test("独立预览保留适配入口，组件不再混放在风格目录", async () => {
  await access(new URL("../组件/预览/界面资源.ts", import.meta.url));
  await expect(access(new URL("../组件/霓虹街机", import.meta.url))).rejects.toThrow();
});
