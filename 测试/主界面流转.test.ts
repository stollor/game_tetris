import { expect, test } from "bun:test";
import { 生成主界面流转块 } from "../代码/界面/主界面流转";
import { 规划界面流转 } from "../框架/界面/流转";
import type { 文字样式 } from "../框架/界面/绘制/协议";
import { 计算主界面布局 } from "../组件/霓虹街机/主界面布局";

function 测量(文案: string, 样式: 文字样式): { 宽: number; 高: number } {
  return { 宽: Array.from(文案).length * 样式.字号, 高: 样式.字号 };
}

const 文字 = { 英文: false, 游戏名称: "再消一行" };

test("菜单和模式选择的金币停住，游戏标题只做位移和变形", () => {
  const 菜单 = 生成主界面流转块({
    布局: 计算主界面布局(390, 844, "菜单"),
    文字,
    金币: 120,
    测量,
  });
  const 模式 = 生成主界面流转块({
    布局: 计算主界面布局(390, 844, "模式选择"),
    文字,
    金币: 120,
    测量,
  });
  const 菜单标题 = 菜单.find((块) => 块.身份 === "游戏标题");
  const 模式标题 = 模式.find((块) => 块.身份 === "游戏标题");
  expect(模式标题?.矩形.高).toBeLessThan(菜单标题?.矩形.高 ?? 0);
  expect(模式标题?.矩形.上).toBeLessThan(菜单标题?.矩形.上 ?? 0);
  const 画面 = 规划界面流转(菜单, 模式, 0.5);
  expect(画面.filter((项) => 项.身份 === "金币")).toHaveLength(1);
  expect(画面.filter((项) => 项.身份 === "游戏标题")).toHaveLength(1);
  const 金币 = 画面.find((项) => 项.身份 === "金币");
  expect(金币).toMatchObject({ 透明度: 1 });
  expect(金币?.当前).toEqual(菜单.find((块) => 块.身份 === "金币")?.矩形);
  const 标题 = 画面.find((项) => 项.身份 === "游戏标题");
  expect(标题).toMatchObject({ 来源: "出发", 透明度: 1 });
  expect(标题?.当前.高).toBeCloseTo(((菜单标题?.矩形.高 ?? 0) + (模式标题?.矩形.高 ?? 0)) / 2);
  expect(标题?.当前.上).toBeGreaterThan(模式标题?.矩形.上 ?? 0);
  expect(标题?.当前.上).toBeLessThan(菜单标题?.矩形.上 ?? 0);
  const 选择 = 画面.find((项) => 项.身份 === "选择模式");
  expect(选择).toMatchObject({ 来源: "到达", 透明度: 0.5 });
  expect(画面.find((项) => 项.身份 === "开始游戏")?.透明度).toBe(0.5);
});

test("进入纯享时菜单标题和金币按离开处理，不和风景共用身份", () => {
  const 菜单 = 生成主界面流转块({
    布局: 计算主界面布局(390, 844, "菜单"),
    文字,
    金币: 20,
    测量,
  });
  const 纯享 = 生成主界面流转块({
    布局: 计算主界面布局(390, 844, "纯享"),
    文字,
    金币: 20,
    测量,
  });
  expect(纯享.map((块) => 块.身份)).toEqual(["纯享"]);
  const 画面 = 规划界面流转(菜单, 纯享, 0.5, { 宽: 390, 高: 844 });
  const 标题 = 画面.find((项) => 项.身份 === "游戏标题");
  expect(标题?.透明度).toBe(0.5);
  expect((标题?.当前.左 ?? 0) + (标题?.当前.宽 ?? 0) / 2).toBeCloseTo(
    (标题?.静止.左 ?? 0) + (标题?.静止.宽 ?? 0) / 2,
  );
  expect((标题?.当前.上 ?? 0) + (标题?.当前.高 ?? 0) / 2).toBeCloseTo(
    (标题?.静止.上 ?? 0) + (标题?.静止.高 ?? 0) / 2,
  );
  expect(标题?.当前.高).toBeLessThan(标题?.静止.高 ?? 0);
  const 金币 = 画面.find((项) => 项.身份 === "金币");
  expect(金币?.透明度).toBe(0.5);
  expect(金币?.当前.上).toBeLessThan(金币?.静止.上 ?? 0);
  expect(画面.find((项) => 项.身份 === "纯享")).toMatchObject({ 来源: "到达", 透明度: 0.5 });
});
