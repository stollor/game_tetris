import { expect, test } from "bun:test";
import { 格式化仪表时间, 计算对局仪表 } from "../代码/界面/对局仪表";
import { 计算对局布局 } from "../代码/页面/布局/对局布局";
import { 模式配置 } from "../代码/项目配置/模式";
import { 计分反馈, 读取滚动数位 } from "../视效/特效/计分反馈";

test("消行先发光、击中后才给数值动画新目标，不提前跳分", () => {
  const 反馈 = new 计分反馈();
  反馈.加分(120, { 列: 4.5, 行: 19 }, true);
  反馈.更新(0.13);
  expect(反馈.读取().流光).toHaveLength(0);
  expect(反馈.读取().目标分数).toBe(0);
  反馈.更新(0.15);
  expect(反馈.读取().流光[0]?.进度).toBeGreaterThan(0);
  expect(反馈.读取().显示分数).toBe(0);
  反馈.更新(0.2);
  expect(反馈.读取().击中).toBeGreaterThan(0);
  expect(反馈.读取().目标分数).toBe(120);
  expect(反馈.读取().显示分数).toBe(0);
  反馈.更新(1 / 60);
  expect(反馈.读取().显示分数).toBeGreaterThan(0);
  expect(反馈.读取().显示分数).toBeLessThan(120);
  for (let i = 0; i < 120; i++) 反馈.更新(1 / 60);
  expect(反馈.读取().显示分数).toBe(120);
  expect(反馈.活跃()).toBe(false);
});

test("连续加分不丢账、不倒退，重开清掉飞行与滚数", () => {
  const 反馈 = new 计分反馈();
  反馈.加分(40, { 列: 4, 行: 19 }, false);
  反馈.更新(0.1);
  反馈.加分(160, { 列: 4.5, 行: 18 }, true);
  let 上次 = 0;
  for (let i = 0; i < 150; i++) {
    反馈.更新(1 / 60);
    expect(反馈.读取().显示分数).toBeGreaterThanOrEqual(上次);
    上次 = 反馈.读取().显示分数;
  }
  expect(上次).toBe(160);
  反馈.加分(200, { 列: 4.5, 行: 19 }, true);
  反馈.重置();
  expect(反馈.读取()).toEqual({ 显示分数: 0, 目标分数: 0, 击中: 0, 流光: [] });
  expect(反馈.活跃()).toBe(false);
});

test("滚动数位在进位时衔接下一位，整数时全部归位", () => {
  const 进位 = 读取滚动数位(9.5, 2);
  expect(进位.map((位) => 位.数字)).toEqual([0, 9]);
  expect(进位.map((位) => 位.下一个)).toEqual([1, 0]);
  expect(进位.every((位) => 位.进度 > 0 && 位.进度 < 1)).toBe(true);
  expect(读取滚动数位(10, 2).map((位) => 位.数字)).toEqual([1, 0]);
  expect(读取滚动数位(10, 2).every((位) => 位.进度 === 0)).toBe(true);
});

test("各模式仪表使用配置目标，计时按模式映射到侧槽", () => {
  const 布局 = 计算对局布局(390, 844, { 模式: "马拉松", 阶段: "进行中" });
  const 马拉松 = 计算对局仪表(布局, "马拉松");
  const 冲刺 = 计算对局仪表(布局, "冲刺");
  const 极限 = 计算对局仪表(布局, "极限");
  const 每日 = 计算对局仪表(布局, "每日挑战");
  expect(马拉松.分数X).toBe(195);
  expect(马拉松.分数字号).toBeGreaterThan(冲刺.分数字号);
  expect(冲刺.目标行数).toBe(模式配置.冲刺目标行数);
  expect(每日.目标行数).toBe(模式配置.马拉松目标行数);
  expect(冲刺.分数X).toBeGreaterThan(195);
  expect(马拉松.计时栏).toBeNull();
  expect(每日.计时栏).toBeNull();
  expect(冲刺.计时栏).toBe("左");
  expect(极限.计时栏).toBe("右");
  expect(极限.目标行数).toBeNull();
  expect(格式化仪表时间(120000)).toBe("2:00");
  expect(格式化仪表时间(9300, true)).toBe("9.3");
  expect(格式化仪表时间(0, true)).toBe("0.0");
});
