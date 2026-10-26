import { describe, expect, test } from "bun:test";
import { 是开合页面, 计算页面开合变换, 页面开合, 页面开合参数 } from "../代码/视效/过渡/页面开合";

describe("三页开合", () => {
  test("仅作用于设置、成就、商店", () => {
    for (const 名称 of ["设置", "成就", "商店"]) expect(是开合页面(名称)).toBe(true);
    for (const 名称 of ["主界面", "对局", "排行榜", "__proto__"])
      expect(是开合页面(名称)).toBe(false);
  });
  test("打开落位与关闭起点精确一致，运动可逆且开关非对称", () => {
    for (const 页面 of ["设置", "成就", "商店"] as const) {
      const 打开尾 = 计算页面开合变换(页面, "打开", 页面开合参数.打开秒, 390, 844);
      const 关闭头 = 计算页面开合变换(页面, "关闭", 0, 390, 844);
      expect(打开尾).toEqual({ x: 0, y: 0, 缩放X: 1, 缩放Y: 1, 透明度: 1 });
      expect(关闭头).toEqual(打开尾);
      expect(计算页面开合变换(页面, "打开", 0, 390, 844)).toEqual(
        计算页面开合变换(页面, "关闭", 页面开合参数.关闭秒, 390, 844),
      );
      const 前半 = 计算页面开合变换(页面, "打开", 0.15, 390, 844);
      expect(前半.透明度).toBeGreaterThan(0.8);
      expect(计算页面开合变换(页面, "关闭", 0.1, 390, 844).透明度).toBeGreaterThan(0.7);
    }
  });
  test("风景只淡入，设置面板随正文同步，尺寸更新使用实时映射", () => {
    const 风景 = 计算页面开合变换("商店", "打开", 0, 390, 844, true);
    expect(风景).toEqual({ x: 0, y: 0, 缩放X: 1, 缩放Y: 1, 透明度: 0 });
    expect(计算页面开合变换("设置", "打开", 0.1, 390, 844, true)).toEqual(
      计算页面开合变换("设置", "打开", 0.1, 390, 844),
    );
    const 大 = 计算页面开合变换("设置", "打开", 0, 430, 900);
    const 小 = 计算页面开合变换("设置", "打开", 0, 390, 844);
    expect(大.x).toBeGreaterThan(小.x);
    expect(大.缩放X).toBeCloseTo(小.缩放X);
  });
  test("只在到点执行一次完成动作，不提前退出，可反复进入", () => {
    const 开合 = new 页面开合();
    let 次数 = 0;
    开合.播放("设置", "关闭", () => 次数++);
    expect(开合.读取变换("商店", 2, 390, 844)).toBeNull();
    开合.更新(0.19);
    expect(次数).toBe(0);
    expect(开合.读取播放中()).toBe(true);
    开合.更新(0.02);
    expect(次数).toBe(1);
    expect(开合.读取变换("设置", 2, 390, 844)).toBeNull();
    expect(开合.更新(1)).toBe(false);
    expect(次数).toBe(1);
    开合.播放("商店", "打开", () => 次数++);
    开合.更新(0.3);
    expect(次数).toBe(2);
    expect(开合.读取播放中()).toBe(false);
  });
});
