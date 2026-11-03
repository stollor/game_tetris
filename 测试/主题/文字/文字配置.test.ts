import { expect, test } from "bun:test";
import { Texture } from "three";
import type { 文字图集选项 } from "../../../.gamemaker/依赖/框架/界面/文字图集";
import { 创建文字服务, type 文字图集接口 } from "../../../.gamemaker/依赖/框架/界面/文字服务";
import { 文字光栅口径 } from "../../../资源/主题/文字/文字配置";

/** 验收机与目标平台是 DPR1 手机：字形必须按显示字号 1:1 光栅，任何缩放都会让小字发虚。 */
const 常用字号 = [
  10, 11, 12, 13, 14, 15, 16, 18, 20, 21, 22, 24, 26, 28, 29, 30, 32, 34, 36, 38, 40,
];

function 假图集工厂() {
  return (选项: 文字图集选项): 文字图集接口 => ({
    注册: () => undefined,
    读取纹理: () => new Texture(),
    读取纯色紫外线: () => ({ u: 0, v: 0, 宽: 0.01, 高: 0.01 }),
    读取行高: () => 选项.字号,
    测量: (文本: string) => Array.from(文本).length * 选项.字号,
    排版: (文本: string, 最大宽度: number) => ({
      行: [{ 文本, 宽: Math.min(Array.from(文本).length * 选项.字号, 最大宽度), 字形: [] }],
      宽: Math.min(Array.from(文本).length * 选项.字号, 最大宽度),
      高: 选项.字号,
      行数: 1,
    }),
    绘制: () => ({ 行: [], 宽: 0, 高: 0 }),
    读取统计: () => ({ 页数: 1, 字形数: 0, 页面边长: 64, 纹理字节: 64 * 64 * 4 }),
    销毁: () => undefined,
  });
}

test("文字光栅口径：不分档烘焙、不做字号复用", () => {
  expect(文字光栅口径.分档烘焙).toBe(false);
  expect(文字光栅口径.字号复用).toBe(false);
});

test("文字服务按显示字号烘焙，常用字号不会被量化或缩小", () => {
  const 文字 = 创建文字服务({
    登记纹理: () => () => undefined,
    字体: "sans-serif",
    ...文字光栅口径,
    创建图集: 假图集工厂(),
  });
  for (const 字号 of 常用字号) {
    expect({ 请求: 字号, 烘焙: 文字.读取烘焙字号?.(字号) }).toEqual({ 请求: 字号, 烘焙: 字号 });
  }
});

test("同字号不同主题的字体栈共用一套字号决策", () => {
  const 像素文字 = 创建文字服务({
    登记纹理: () => () => undefined,
    字体: '"Noto Sans SC", "Microsoft YaHei", sans-serif',
    像素化字体: ['"Noto Sans SC", "Microsoft YaHei", sans-serif'],
    ...文字光栅口径,
    创建图集: 假图集工厂(),
  });
  // 像素主题靠二值化出硬边像素字，缩放采样会把点阵糊掉，所以更不能复用大字号。
  for (const 字号 of 常用字号) expect(像素文字.读取烘焙字号?.(字号)).toBe(字号);
});
