import { expect, test } from "bun:test";
import { 相邻风景, 风景浏览列表, 风景说明, 默认风景 } from "../../../代码/界面/风景浏览";
import { 获取文案 } from "../../../代码/语言/文案";

const 简中 = 获取文案("简体中文");
import { 主题列表, 默认主题 } from "../../../代码/项目配置/主题目录";

test("风景列表就是四套主题并可循环左右切换", () => {
  const 全部 = 风景浏览列表();
  expect(全部).toEqual(主题列表);
  expect(全部).toHaveLength(4);
  expect(相邻风景("极光原野", -1)).toBe(全部[全部.length - 1]!);
  expect(相邻风景("极光原野", 1)).toBe(全部[1]!);
  expect(相邻风景("立体晶格", 1)).toBe(全部[0]!);
});

test("风景说明取主题名与主题说明", () => {
  expect(风景说明("砖机液晶", 简中).标题).toBe("砖机液晶");
  expect(风景说明("砖机液晶", 简中).副题).toContain("四色液晶");
  expect(风景说明("立体晶格", 简中).副题).toContain("晶格");
});

test("纯享入口落在玩家当前主题，未知主题回落默认", () => {
  expect(默认风景("街机彩砖")).toBe("街机彩砖");
  expect(默认风景(默认主题)).toBe(默认主题);
  expect(默认风景("不存在的主题")).toBe(默认主题);
});
