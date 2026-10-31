import { expect, test } from "bun:test";
import { 主题列表 } from "../../../代码/项目配置/主题目录";
import { type 游戏设置, 默认设置 } from "../../../代码/设置/游戏设置";
import { 读取方块外观方案, 方块外观方案表, 解析方块外观 } from "../../../资源/主题/外观/方块外观";
import { 砖机液晶规范, 街机彩砖规范 } from "../../../资源/主题/像素/像素规范";
import { 立体规范 } from "../../../资源/主题/立体/立体规范";

test("四套方块外观跟随主题名单，各有七种识别色与独立质感", () => {
  expect(方块外观方案表.map((项) => 项.名称)).toEqual([...主题列表]);
  expect(new Set(方块外观方案表.map((项) => 项.质感))).toEqual(new Set(["宝石", "像素"]));
  for (const 方案 of 方块外观方案表) {
    expect(Object.keys(方案.颜色).sort()).toEqual(["I", "J", "L", "O", "S", "T", "Z"]);
    expect(new Set(Object.values(方案.颜色)).size).toBe(7);
    for (const 色 of Object.values(方案.颜色))
      expect(Number.isInteger(色) && 色 >= 0 && 色 <= 0xffffff).toBe(true);
    expect(解析方块外观(方案.名称)).toBe(方案);
  }
  expect(解析方块外观(undefined).名称).toBe("极光原野");
  expect(解析方块外观("损坏").名称).toBe("极光原野");
});

test("像素与立体主题的方块颜色直接取自身规范，不另存一份色值", () => {
  expect(解析方块外观("砖机液晶").颜色).toEqual(砖机液晶规范.方块);
  expect(解析方块外观("街机彩砖").颜色).toEqual(街机彩砖规范.方块);
  expect(解析方块外观("立体晶格").颜色).toEqual(立体规范.方块);
  expect(new Set(Object.values(街机彩砖规范.方块)).size).toBe(7);
});

test("读取方块外观方案按整套主题选择取方案", () => {
  for (const 名称 of 主题列表) {
    const 设置: 游戏设置 = { ...默认设置, 主题选择: 名称 };
    expect(读取方块外观方案(设置).名称).toBe(名称);
  }
});
