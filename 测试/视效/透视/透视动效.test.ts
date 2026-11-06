import { describe, expect, test } from "bun:test";
import { 计算拖尾残影, 计算消行变形 } from "../../../资源/视效/透视/透视棋盘";

/**
 * 透视主题的消行/下落反馈口径。
 * 井内是 3D 房间，2D 的 绘制消行光带 / 绘制落块拖尾 在这里被跳过，
 * 这两条纯函数就是它的全部动效来源：口径乱了，动画就会变成「整行方块一起被吸走」
 * 或「砸下来毫无反馈」。
 */
describe("透视对局动效", () => {
  test("消行先亮起再收缩到 0，不会停在半空的小方点", () => {
    const 起始 = 计算消行变形(0, 0, 10);
    expect(起始.缩比).toBe(1);
    // 前 30% 只闪白、不缩小
    const 半亮 = 计算消行变形(0.15, 0, 10);
    expect(半亮.缩比).toBe(1);
    expect(半亮.提亮).toBeGreaterThan(起始.提亮);
    // 后段收缩到接近 0，并且越来越亮
    const 末段 = 计算消行变形(1, 0, 10);
    expect(末段.缩比).toBeLessThan(0.001);
    expect(末段.提亮).toBeGreaterThan(0.95);
    // 中段必须真的在缩，而不是瞬间消失
    expect(计算消行变形(0.6, 0, 10).缩比).toBeLessThan(0.95);
    expect(计算消行变形(0.6, 0, 10).缩比).toBeGreaterThan(0.01);
  });

  test("消行按列错峰：左侧先动，右侧后动", () => {
    const 左 = 计算消行变形(0.5, 0, 10);
    const 右 = 计算消行变形(0.5, 9, 10);
    expect(左.缩比).toBeLessThan(右.缩比);
    // 提亮在闪段就饱和了，错峰要看更早的进度
    expect(计算消行变形(0.32, 0, 10).提亮).toBeGreaterThan(计算消行变形(0.32, 9, 10).提亮);
  });

  test("硬降残影有先后次序：先出现的高度更高，且不会一次性全冒出来", () => {
    const 拖尾 = { 列: [{ 列: 3, 底行: 11 }], 类型: "I" as const, 距离: 10, 进度: 0.1 };
    const 早期 = 计算拖尾残影(拖尾, 20);
    // 进度还很早时只应有少量残影，而不是整串一起亮
    expect(早期.length).toBeGreaterThan(0);
    expect(早期.length).toBeLessThan(6);
    // 越早出现的残影，位置越高（行号越小）
    const 行序 = [...早期].sort((甲, 乙) => 甲.行 - 乙.行);
    expect(行序[0]!.行).toBeLessThan(行序[行序.length - 1]!.行);
    // 同一列、都在落点上方、都在井内
    expect(早期.every((项) => 项.列 === 3 && 项.行 < 11 && 项.行 >= 0)).toBe(true);
  });

  test("硬降残影随进度逐级接力：先一个，再补全，最后各自缩小", () => {
    const 拖尾 = { 列: [{ 列: 0, 底行: 12 }], 类型: "O" as const, 距离: 6, 进度: 0 };
    const 起手 = 计算拖尾残影({ ...拖尾, 进度: 0.05 }, 20);
    const 中段 = 计算拖尾残影({ ...拖尾, 进度: 0.4 }, 20);
    // 刚开始只亮最远的一级 → 有先后，而不是一次性三块一起冒出来
    expect(起手).toHaveLength(1);
    expect(中段.length).toBeGreaterThan(起手.length);
    // 收尾时都缩得很小
    const 末段 = 计算拖尾残影({ ...拖尾, 进度: 0.95 }, 20);
    if (末段.length) expect(Math.max(...末段.map((项) => 项.缩放比))).toBeLessThan(0.7);
    // 超出井顶的残影被裁掉
    const 贴顶 = 计算拖尾残影({ 列: [{ 列: 0, 底行: 1 }], 类型: "O", 距离: 7, 进度: 0.3 }, 20);
    expect(贴顶.every((项) => 项.行 >= 0)).toBe(true);
  });
});
