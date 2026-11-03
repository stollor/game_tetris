import { describe, expect, test } from "bun:test";
import { 界面层清单 } from "../../代码/应用/界面层配置";
import { 动画层名, 动画层页名 } from "../../代码/页面/层/动画层";

/**
 * 层序是转场能否盖住货币层的硬约束：动画层必须在页面/货币/提示之上，
 * 且不参与命中（否则转场期间点击会被空层吃掉）。
 */
describe("界面层序", () => {
  test("默认四层之后是最上层动画层", () => {
    const 名称 = 界面层清单.map((项) => 项.名称);
    expect(名称).toEqual(["背景", "页面", "货币", "提示", 动画层名]);
    expect(名称.indexOf(动画层名)).toBe(名称.length - 1);
    expect(名称.indexOf(动画层名)).toBeGreaterThan(名称.indexOf("货币"));
    expect(名称.indexOf(动画层名)).toBeGreaterThan(名称.indexOf("提示"));
  });

  test("动画层不参与命中，页面名与层名分开", () => {
    const 动画层 = 界面层清单.find((项) => 项.名称 === 动画层名);
    expect(动画层?.命中).toBeFalsy();
    expect(动画层页名).not.toBe(动画层名);
  });
});
