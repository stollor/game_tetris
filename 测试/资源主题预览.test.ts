import { expect, test } from "bun:test";
import { 界面资源样品 } from "../预制体/预览/界面资源";

test("独立样品的主题槽位由同一输入接管，保留有效的形状及播放输入", () => {
  const 背景 = 界面资源样品.find((项) => 项.编号 === "game-background");
  const 方块 = 界面资源样品.find((项) => 项.编号 === "block-shape");
  expect(背景?.状态.map((项) => 项.键)).toEqual(["资源主题", "播放", "时间"]);
  expect(方块?.状态.some((项) => 项.键 === "资源主题")).toBe(true);
  expect(方块?.状态.some((项) => 项.键 === "外观")).toBe(false);
  expect(方块?.状态.some((项) => 项.键 === "形状")).toBe(true);
});
