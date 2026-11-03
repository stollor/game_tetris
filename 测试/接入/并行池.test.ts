import { describe, expect, test } from "bun:test";
import { 并行池, 解析并发, 默认并发数 } from "./并行池";

describe("并行池", () => {
  test("并发上限生效，同时最多跑指定数量", async () => {
    let 进行中 = 0;
    let 峰值 = 0;
    const 完成顺序: number[] = [];
    await 并行池([1, 2, 3, 4, 5, 6], 3, async (序号) => {
      进行中++;
      峰值 = Math.max(峰值, 进行中);
      await Bun.sleep(5);
      完成顺序.push(序号);
      进行中--;
    });
    expect(峰值).toBe(3);
    expect(完成顺序.length).toBe(6);
  });

  test("结果按输入顺序返回，与完成顺序无关", async () => {
    const 结果 = await 并行池([30, 5, 20, 1], 4, async (毫秒) => {
      await Bun.sleep(毫秒);
      return 毫秒;
    });
    expect(结果).toEqual([30, 5, 20, 1]);
  });

  test("并发超过任务数或小于 1 时仍安全", async () => {
    expect(await 并行池([1, 2], 99, async (项) => 项 * 2)).toEqual([2, 4]);
    expect(await 并行池([1], 0, async (项) => 项)).toEqual([1]);
    expect(await 并行池([], 4, async () => 0)).toEqual([]);
  });

  test("任务抛错会中断并行池并向上抛", async () => {
    await expect(
      并行池([1, 2, 3], 3, async (序号) => {
        if (序号 === 2) throw new Error("任务失败");
        return 序号;
      }),
    ).rejects.toThrow("任务失败");
  });
});

describe("解析并发", () => {
  test("命令行优先于环境变量，非法值回落到默认", () => {
    const 旧值 = process.env.GM_TEST_并发;
    try {
      process.env.GM_TEST_并发 = "2";
      expect(解析并发(["--并发=3"], 8)).toBe(3);
      expect(解析并发([], 8)).toBe(2);
      delete process.env.GM_TEST_并发;
      expect(解析并发([], 8)).toBe(默认并发数);
      expect(解析并发(["--并发=0"], 8)).toBe(默认并发数);
      expect(解析并发(["--并发=abc"], 8)).toBe(默认并发数);
    } finally {
      if (旧值 === undefined) delete process.env.GM_TEST_并发;
      else process.env.GM_TEST_并发 = 旧值;
    }
  });

  test("夹在 1..任务数：轮次少于默认并发时不会起多余工人", () => {
    expect(解析并发([], 1)).toBe(1);
    expect(解析并发(["--并发=8"], 4)).toBe(4);
    // 小于 1 的并发视为非法，回落默认值（再由任务数夹住）。
    expect(解析并发(["--并发=0.5"], 4)).toBe(默认并发数);
  });
});
