import { expect, test } from "bun:test";
import { 成就定义 } from "../代码/成就/再消一行成就";
import type { 三角形状, 四边形状 } from "../框架/界面/图元合批";
import { Three图形, type 图形合批接口 } from "../框架/界面/绘制/图形";
import { 成就图标编号列表, 绘制成就图标 } from "../组件/基础/成就图标";

test("全部成就有图标，12种图形不同且在徽章边界内", () => {
  expect([...成就图标编号列表].sort()).toEqual(成就定义.map((x) => x.编号).sort());
  expect(new Set(成就图标编号列表).size).toBe(成就定义.length);
  const 指纹 = new Set<string>();
  for (const 编号 of 成就图标编号列表) {
    const 顶点: { x: number; y: number }[] = [];
    const 添加 = (形: 四边形状) => {
      顶点.push({ x: 形.左, y: 形.上 }, { x: 形.左 + 形.宽, y: 形.上 + 形.高 });
      return true;
    };
    const 合批: 图形合批接口 = {
      添加,
      添加四边形: 添加,
      添加三角形: (形: 三角形状) => {
        顶点.push(...形.顶点);
        return true;
      },
      添加纯色: (左, 上, 宽, 高) => 添加({ 左, 上, 宽, 高 }),
      注册纹理: () => 0,
      读取图层: () => 0,
      清空图层: () => 0,
    };
    const 图形 = new Three图形({ 合批, 纯色纹理序号: 0, 纯色紫外线: { u: 0, v: 0, 宽: 1, 高: 1 } });
    图形.setAlpha(0.6);
    绘制成就图标(图形, 编号, 0xffe7a8);
    expect(顶点.length).toBeGreaterThan(0);
    expect(
      顶点.every(
        (p) =>
          Number.isFinite(p.x) &&
          Number.isFinite(p.y) &&
          p.x >= 0 &&
          p.y >= 0 &&
          p.x <= 32 &&
          p.y <= 32,
      ),
    ).toBe(true);
    expect(图形.读取透明度()).toBe(0.6);
    expect(图形.读取矩阵()).toEqual({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 });
    指纹.add(JSON.stringify(顶点.map((p) => [p.x, p.y])));
  }
  expect(指纹.size).toBe(12);
});
