import { describe, expect, test } from "bun:test";
import {
  IK,
  JL,
  下落一步,
  切换暂停,
  创建新局,
  创建模式随机源,
  固定方块,
  type 方块类型,
  旋转方块,
  是否使用马拉松结算重开锁,
  更新时钟,
  每日方块序列,
  每日种子,
  硬降,
  移动方块,
  读取格子,
} from "../代码/玩法/再消一行";
import { 模式配置 } from "../代码/项目配置/模式";

describe("再消一行 MVP 规则", () => {
  test("七种方块按 7-bag 出现，每袋不重复", () => {
    const 状态 = 创建新局(() => 0.25);
    const 出现过: 方块类型[] = [状态.当前方块.类型, 状态.下一个方块];
    for (let 索引 = 0; 索引 < 5; 索引 += 1) {
      硬降(状态, () => 0.25);
      出现过.push(状态.下一个方块);
    }
    expect(new Set(出现过).size).toBe(7);
  });

  test("七种方块出生占格与策划表一致", () => {
    const 类型: 方块类型[] = ["I", "O", "T", "S", "Z", "J", "L"];
    const 出生格: Record<方块类型, [number, number][]> = {
      I: [
        [3, -1],
        [4, -1],
        [5, -1],
        [6, -1],
      ],
      O: [
        [4, -2],
        [5, -2],
        [4, -1],
        [5, -1],
      ],
      T: [
        [4, -2],
        [3, -1],
        [4, -1],
        [5, -1],
      ],
      S: [
        [4, -2],
        [5, -2],
        [3, -1],
        [4, -1],
      ],
      Z: [
        [3, -2],
        [4, -2],
        [4, -1],
        [5, -1],
      ],
      J: [
        [3, -2],
        [3, -1],
        [4, -1],
        [5, -1],
      ],
      L: [
        [5, -2],
        [3, -1],
        [4, -1],
        [5, -1],
      ],
    };
    for (const 方块 of 类型) {
      const 状态 = 创建新局(() => 0, [方块]);
      expect(读取格子(状态.当前方块)).toEqual(出生格[方块]);
    }
  });

  test("墙外移动和被占格的移动失败，原位置不变", () => {
    const 状态 = 创建新局(() => 0, ["O", "I"]);
    for (let 索引 = 0; 索引 < 5; 索引 += 1) 移动方块(状态, -1);
    const 左边位置 = 读取格子(状态.当前方块);
    expect(移动方块(状态, -1)).toBe(false);
    expect(读取格子(状态.当前方块)).toEqual(左边位置);

    const 顶行 = 状态.棋盘[0];
    if (顶行) 顶行[1] = "T";
    expect(移动方块(状态, 1)).toBe(false);
    expect(读取格子(状态.当前方块)).toEqual(左边位置);
  });

  test("旋转按 MVP 试探表工作，O 方块占格不变", () => {
    const 状态 = 创建新局(() => 0, ["T", "O"]);
    expect(移动方块(状态, -1)).toBe(true);
    expect(旋转方块(状态)).toBe(true);
    expect(状态.当前方块.旋转).toBe(1);

    const O状态 = 创建新局(() => 0, ["O", "I"]);
    const 旋转前 = 读取格子(O状态.当前方块);
    expect(旋转方块(O状态)).toBe(true);
    expect(读取格子(O状态.当前方块)).toEqual(旋转前);

    const 受阻状态 = 创建新局(() => 0, ["T", "O"]);
    const 阻挡格 = [
      [4, 0],
      [3, 0],
      [6, -1],
      [5, -2],
    ] as const;
    for (const [列, 行] of 阻挡格) {
      const 棋盘行 = 受阻状态.棋盘[行 + 2];
      if (棋盘行) 棋盘行[列] = "J";
    }
    const 阻挡前位置 = 读取格子(受阻状态.当前方块);
    expect(旋转方块(受阻状态)).toBe(false);
    expect(读取格子(受阻状态.当前方块)).toEqual(阻挡前位置);
  });

  test("180°旋转执行两次四分之一周转且可以往返", () => {
    const 状态 = 创建新局(() => 0, ["T", "I"]);
    const 原格子 = 读取格子(状态.当前方块);
    expect(旋转方块(状态, 1, true)).toBe(true);
    expect(状态.当前方块.旋转).toBe(2);
    expect(读取格子(状态.当前方块)).not.toEqual(原格子);
    expect(旋转方块(状态, 1, true)).toBe(true);
    expect(状态.当前方块.旋转).toBe(0);
    expect(读取格子(状态.当前方块)).toEqual(原格子);
  });

  test("180°受阻时失败且不会借上踢上漂", () => {
    const 状态 = 创建新局(() => 0, ["T", "I"]);
    expect(移动方块(状态, 0, 3)).toBe(true);
    const 原格子 = 读取格子(状态.当前方块);
    const 原顶 = Math.min(...原格子.map(([, y]) => y));
    // 阻挡原地 180° 后的占格；上方留空。旧实现会用 (0,-1) 上踢成功并上漂。
    const 行 = 状态.棋盘[5];
    if (!行) throw new Error("缺少隐藏行棋盘");
    行[4] = "J";

    expect(旋转方块(状态, 1, true)).toBe(false);
    expect(读取格子(状态.当前方块)).toEqual(原格子);
    expect(Math.min(...读取格子(状态.当前方块).map(([, y]) => y))).toBe(原顶);
  });

  test("180°连按不会向上平移", () => {
    const 状态 = 创建新局(() => 0, ["T", "J", "L", "S"]);
    expect(移动方块(状态, 0, 8)).toBe(true);
    const 顶 = () => Math.min(...读取格子(状态.当前方块).map(([, y]) => y));
    const 开局顶 = 顶();
    for (let i = 0; i < 12; i += 1) {
      expect(旋转方块(状态, 1, true)).toBe(true);
      expect(顶()).toBeGreaterThanOrEqual(开局顶);
    }
  });

  test("I/Z/O 的 180° 视为无效半转，占格与朝向编号均不变", () => {
    for (const 类型 of ["I", "Z", "O"] as const) {
      const 状态 = 创建新局(() => 0, [类型, "T"]);
      expect(移动方块(状态, 0, 6)).toBe(true);
      const 原格子 = 读取格子(状态.当前方块);
      const 原旋转 = 状态.当前方块.旋转;
      const 原顶 = Math.min(...原格子.map(([, y]) => y));
      const 原左 = Math.min(...原格子.map(([x]) => x));
      expect(旋转方块(状态, 1, true)).toBe(false);
      expect(读取格子(状态.当前方块)).toEqual(原格子);
      expect(状态.当前方块.旋转).toBe(原旋转);
      expect(Math.min(...读取格子(状态.当前方块).map(([, y]) => y))).toBe(原顶);
      expect(Math.min(...读取格子(状态.当前方块).map(([x]) => x))).toBe(原左);
    }
  });

  test("竖着的 I/Z 半转也不平移", () => {
    for (const 类型 of ["I", "Z"] as const) {
      const 状态 = 创建新局(() => 0, [类型, "T"]);
      expect(移动方块(状态, 0, 6)).toBe(true);
      expect(旋转方块(状态, 1, false)).toBe(true);
      const 原格子 = 读取格子(状态.当前方块);
      const 原旋转 = 状态.当前方块.旋转;
      expect(旋转方块(状态, 1, true)).toBe(false);
      expect(读取格子(状态.当前方块)).toEqual(原格子);
      expect(状态.当前方块.旋转).toBe(原旋转);
    }
  });

  test("硬降固定方块并消行计分", () => {
    const 状态 = 创建新局(() => 0, ["I", "O"]);
    const 底行 = 状态.棋盘[21];
    if (!底行) throw new Error("缺少棋盘底行");
    for (let 列 = 0; 列 < 底行.length; 列 += 1) {
      if (列 < 3 || 列 > 6) 底行[列] = "J";
    }
    expect(硬降(状态, () => 0)).toBeGreaterThan(0);
    expect(状态.消行数).toBe(1);
    expect(状态.分数).toBe(1100);
    expect(状态.棋盘[21]?.every((格子) => 格子 === null)).toBe(true);
  });

  test("每日挑战符合策划案的固定种子与前两袋向量", () => {
    expect(每日种子("2026-01-01")).toBe(0x6775473f);
    expect(每日方块序列("2026-01-01").join(",")).toBe("J,S,L,T,O,Z,I,J,I,Z,T,S,O,L");
    expect(每日种子("2026-01-02")).toBe(0x687548d2);
    expect(每日方块序列("2026-01-02").join(",")).toBe("Z,J,O,I,L,S,T,Z,L,O,T,J,S,I");
  });

  test("SRS 为 JLSTZ 与 I 的八种朝向转向各保留五个有序踢墙候选", () => {
    expect(Object.keys(JL).sort()).toEqual([
      "0>1",
      "0>3",
      "1>0",
      "1>2",
      "2>1",
      "2>3",
      "3>0",
      "3>2",
    ]);
    expect(Object.keys(IK).sort()).toEqual([
      "0>1",
      "0>3",
      "1>0",
      "1>2",
      "2>1",
      "2>3",
      "3>0",
      "3>2",
    ]);
    for (const table of [JL, IK]) {
      for (const candidates of Object.values(table)) expect(candidates).toHaveLength(5);
    }
  });

  test("Sprint 第 40 行立即完赛，按旧等级结算且不生成额外方块", () => {
    const 状态 = 创建新局(() => 0, ["I", "O", "T"], "冲刺");
    状态.消行数 = 39;
    状态.等级 = 4;
    const 底行 = 状态.棋盘[21];
    if (!底行) throw new Error("缺少棋盘底行");
    for (let 列 = 0; 列 < 10; 列 += 1) if (列 < 3 || 列 > 6) 底行[列] = "J";
    硬降(状态, () => 0);
    expect(状态.阶段).toBe("结束");
    expect(状态.完赛).toBe(true);
    expect(状态.消行数).toBe(40);
    expect(状态.等级).toBe(5);
    expect(状态.当前方块.类型).toBe("I");
  });

  test("练习模式消行后等级保持 1，也不记马拉松目标", () => {
    const 状态 = 创建新局(() => 0, ["I", "O", "T"], "练习");
    状态.消行数 = 模式配置.马拉松目标行数 - 1;
    const 底行 = 状态.棋盘[21];
    if (!底行) throw new Error("缺少棋盘底行");
    for (let 列 = 0; 列 < 10; 列 += 1) if (列 < 3 || 列 > 6) 底行[列] = "J";
    硬降(状态, () => 0);
    expect(状态.阶段).toBe("进行中");
    expect(状态.消行数).toBe(模式配置.马拉松目标行数);
    expect(状态.等级).toBe(1);
    expect(状态.目标达成).toBe(false);
  });

  test("Ultra 到时限即时结束，暂停期间倒计时冻结", () => {
    const 状态 = 创建新局(() => 0, ["T", "O"], "极限");
    切换暂停(状态);
    更新时钟(状态, 1000);
    expect(状态.剩余时间).toBe(120_000);
    切换暂停(状态);
    for (let 索引 = 0; 索引 < 120; 索引 += 1) 更新时钟(状态, 1000);
    expect(状态.剩余时间).toBe(0);
    expect(状态.阶段).toBe("结束");
  });

  test("500ms 锁定延迟与第 16 次触地操作固定", () => {
    const 状态 = 创建新局(() => 0, ["I", "O"], "马拉松");
    while (移动方块(状态, 0, 1)) {}
    更新时钟(状态, 499, () => 0);
    expect(状态.当前方块.类型).toBe("I");
    更新时钟(状态, 1, () => 0);
    expect(状态.当前方块.类型).toBe("O");

    const 重置状态 = 创建新局(() => 0, ["I", "O"], "马拉松");
    while (移动方块(重置状态, 0, 1)) {}
    重置状态.锁定毫秒 = 450;
    for (let 索引 = 0; 索引 < 15; 索引 += 1) {
      expect(移动方块(重置状态, 索引 % 2 === 0 ? -1 : 1)).toBe(true);
      expect(重置状态.锁定毫秒).toBe(0);
    }
    expect(重置状态.当前方块.类型).toBe("I");
    expect(重置状态.锁定重置).toBe(15);
    expect(移动方块(重置状态, 1)).toBe(true);
    expect(重置状态.当前方块.类型).toBe("O");
    expect(重置状态.棋盘.flat().filter((格) => 格 === "I")).toHaveLength(4);
  });

  test("普通下落受阻后立即固定，暂停期间下落不推进", () => {
    const 状态 = 创建新局(() => 0, ["O", "I"]);
    expect(下落一步(状态, () => 0)).toBe(true);
    切换暂停(状态);
    const 原位置 = 读取格子(状态.当前方块);
    expect(下落一步(状态, () => 0)).toBe(false);
    expect(读取格子(状态.当前方块)).toEqual(原位置);
    切换暂停(状态);
    expect(状态.阶段).toBe("进行中");
  });

  test("新方块出生碰撞后进入结束状态，玩法输入不再改变棋盘", () => {
    const 状态 = 创建新局(() => 0, ["I", "O"]);
    const 顶行 = 状态.棋盘[0];
    if (顶行) 顶行[4] = "T";
    硬降(状态, () => 0);
    expect(状态.阶段).toBe("结束");
    const 棋盘结束时 = structuredClone(状态.棋盘);
    expect(移动方块(状态, -1)).toBe(false);
    expect(旋转方块(状态)).toBe(false);
    expect(状态.棋盘).toEqual(棋盘结束时);
    固定方块(状态, () => 0);
    expect(状态.棋盘).toEqual(棋盘结束时);
  });
});

describe("每日挑战重开语义", () => {
  test("每日挑战继承马拉松结算后的 3 秒显式重开锁", () => {
    expect(是否使用马拉松结算重开锁("马拉松")).toBe(true);
    expect(是否使用马拉松结算重开锁("每日挑战")).toBe(true);
    expect(是否使用马拉松结算重开锁("冲刺")).toBe(false);
    expect(是否使用马拉松结算重开锁("极限")).toBe(false);
    expect(是否使用马拉松结算重开锁("练习")).toBe(true);
  });

  test("每局重新取随机源后，同日重开方块序列与开局完全一致", () => {
    const 日期 = "2026-01-01";
    const 收集序列 = (状态: ReturnType<typeof 创建新局>): string[] => [
      状态.当前方块.类型,
      状态.下一个方块,
      ...状态.后续方块,
    ];
    const 源一 = 创建模式随机源("每日挑战", 日期);
    const 第一局 = 创建新局(源一, [], "每日挑战");
    const 开局序列 = 收集序列(第一局);
    // 玩掉第一局，消耗旧随机源状态
    for (let 索引 = 0; 索引 < 20; 索引 += 1) 硬降(第一局, 源一);
    // 重开 = 每局重新取随机源，序列必须回到开局
    for (let 轮次 = 0; 轮次 < 3; 轮次 += 1) {
      const 重开局 = 创建新局(创建模式随机源("每日挑战", 日期), [], "每日挑战");
      expect(收集序列(重开局)).toEqual(开局序列);
    }
    expect(开局序列.slice(0, 4)).toEqual(每日方块序列(日期, 4));
  });

  test("非每日模式使用游戏随机源，不锁序列", () => {
    expect(创建模式随机源("马拉松", "2026-01-01")).toBe(Math.random);
    expect(创建模式随机源("冲刺", "2026-01-01")).toBe(Math.random);
    expect(创建模式随机源("极限", "2026-01-01")).toBe(Math.random);
  });
});
