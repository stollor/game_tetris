import { expect, test } from "bun:test";
import { 地点皮肤表 } from "../代码/框架配置/旅行地点";
import { 地点浏览列表, 相邻风景, 风景浏览列表, 风景说明 } from "../代码/界面/风景浏览";

test("风景列表可循环左右切换", () => {
  const 全部 = 风景浏览列表();
  expect(全部.length).toBeGreaterThan(12);
  expect(全部[0]).toBe("成都熊猫");
  expect(相邻风景("成都熊猫", -1)).toBe(全部[全部.length - 1]);
  expect(相邻风景("成都熊猫", 1)).toBe(全部[1]);
  const 地点 = 地点浏览列表();
  expect(地点).toEqual(地点皮肤表.map((项) => 项.名称));
  expect(相邻风景("拉萨晴空", 1, 地点)).toBe("成都熊猫");
  expect(风景说明("成都熊猫").副题).toContain("熊猫");
  expect(风景说明("晨光海岸").标题).toBe("晨光海岸");
});
