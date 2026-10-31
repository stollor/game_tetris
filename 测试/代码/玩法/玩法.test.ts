import { describe, expect, test } from "bun:test";
import {
  IK,
  JL,
  下落一步,
  type 再消一行状态,
  切换暂停,
  创建新局,
  创建模式随机源,
  可以放置,
  固定方块,
  type 方块类型,
  旋转方块,
  是否使用马拉松结算重开锁,
  暂存换块,
  更新时钟,
  每日方块序列,
  每日种子,
  硬降,
  移动方块,
  读取格子,
  软降一步,
  锁定方块,
} from "../../../代码/玩法/再消一行";
import { 新对局编号 } from "../../../代码/玩法/对局编号";
import { 选择演示落点 } from "../../../代码/玩法/演示落子";
import { 获取技巧反馈 } from "../../../代码/界面/技巧反馈";
import { 获取文案 } from "../../../代码/语言/文案";
import { 模式配置 } from "../../../代码/项目配置/模式";

// ── 原 玩法.test.ts ──
describe("玩法", () => {
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
});

// ── 原 消行事件.test.ts ──
describe("消行事件", () => {
  test("四行特效快照保留实际行与每格颜色，重开不继承事件", () => {
    const s = 创建新局(() => 0, ["I", "O"]);
    s.当前方块.格子 = [-1, 0, 1, 2].map((行) => ({ 列2: 8, 行2: 行 * 2 }));
    for (const row of s.棋盘.slice(-4)) row.fill("J")[4] = null;
    硬降(s, () => 0);
    expect(s.消行数).toBe(4);
    expect(s.消行事件?.行).toEqual([16, 17, 18, 19]);
    expect(s.消行事件?.格子).toHaveLength(40);
    expect(s.消行事件?.格子.filter(([, , t]) => t === "I")).toHaveLength(4);
    expect(s.棋盘.every((r) => r.every((v) => v === null))).toBe(true);
    expect(创建新局(() => 0).消行事件).toBeUndefined();
  });
});

// ── 原 消行计分.test.ts ──
describe("消行计分", () => {
  /** 把可见底行按空列表填满，留出缺口给当前方块消行。 */
  function 填底行(状态: 再消一行状态, 空列: readonly number[]): void {
    const 底行 = 状态.棋盘.at(-1);
    if (!底行) throw new Error("缺少底行");
    for (let 列 = 0; 列 < 底行.length; 列++) 底行[列] = 空列.includes(列) ? null : "J";
  }

  /** 自然落地：先手动降到底，再只靠时钟累计锁定延迟，不触发软降标记。 */
  function 自然锁定(状态: 再消一行状态): void {
    while (移动方块(状态, 0, 1, () => 0.5)) {}
    for (let 帧 = 0; 帧 < 6 && !状态.落块事件; 帧++) 更新时钟(状态, 100, () => 0.5);
  }

  describe("消行计分：只有消行才加分", () => {
    test("自然落地无消行，分数保持不变", () => {
      const 状态 = 创建新局(() => 0.5, ["O", "I"], "马拉松");
      自然锁定(状态);
      expect(状态.落块事件).toBeDefined();
      expect(状态.消行数).toBe(0);
      expect(状态.分数).toBe(0);
    });

    test("软降无消行，分数保持不变", () => {
      const 状态 = 创建新局(() => 0.5, ["O", "I"], "马拉松");
      while (软降一步(状态, () => 0.5)) {}
      expect(状态.分数).toBe(0);
      for (let 帧 = 0; 帧 < 6 && !状态.落块事件; 帧++) 更新时钟(状态, 100, () => 0.5);
      expect(状态.落块事件).toBeDefined();
      expect(状态.消行数).toBe(0);
      expect(状态.分数).toBe(0);
    });

    test("长按时钟软降无消行，分数保持不变", () => {
      const 状态 = 创建新局(() => 0.5, ["O", "I"], "马拉松");
      for (let 帧 = 0; 帧 < 60 && !状态.落块事件; 帧++) {
        更新时钟(状态, 100, () => 0.5, true);
      }
      expect(状态.落块事件).toBeDefined();
      expect(状态.消行数).toBe(0);
      expect(状态.分数).toBe(0);
    });

    test("硬降无消行，分数保持不变且仍返回下落距离", () => {
      const 状态 = 创建新局(() => 0.5, ["O", "I"], "马拉松");
      const 距离 = 硬降(状态, () => 0.5);
      expect(距离).toBeGreaterThan(0);
      expect(状态.消行数).toBe(0);
      expect(状态.分数).toBe(0);
    });

    test("产生消行后分数才上升", () => {
      const 状态 = 创建新局(() => 0.5, ["I", "O"], "马拉松");
      填底行(状态, [3, 4, 5, 6]);
      硬降(状态, () => 0.5);
      expect(状态.消行数).toBe(1);
      expect(状态.分数).toBeGreaterThan(0);
    });

    test("零行 T 旋不加分，但仍记录 T 旋识别事件", () => {
      const 状态 = 创建新局(() => 0.5, ["T", "I"], "马拉松");
      // T 朝上落在可见第 18 行，四角被占住三格。
      状态.当前方块 = {
        类型: "T",
        格子: [
          [4, 17],
          [3, 18],
          [4, 18],
          [5, 18],
        ].map(([列, 行]) => ({ 列2: (列 ?? 0) * 2, 行2: (行 ?? 0) * 2 })),
        中心列2: 8,
        中心行2: 36,
        旋转: 0,
      };
      状态.最后旋转 = true;
      const 占地 = [
        [3, 17],
        [5, 17],
        [3, 19],
      ] as const;
      for (const [列, 行] of 占地) {
        const 行数据 = 状态.棋盘[行 + 2];
        if (!行数据) throw new Error("缺少 T 旋角格");
        行数据[列] = "J";
      }
      expect(读取格子(状态.当前方块)).toHaveLength(4);
      锁定方块(状态, () => 0.5);
      expect(状态.消行数).toBe(0);
      expect(状态.分数).toBe(0);
      expect(状态.落块事件?.行数).toBe(0);
      expect(状态.落块事件?.T旋).not.toBe("无");
      expect(状态.落块事件?.得分).toBe(0);
    });

    test("LockOut 不加分即结束", () => {
      const 状态 = 创建新局(() => 0.5, ["O", "I"], "马拉松");
      状态.当前方块.格子 = [
        [3, -2],
        [4, -2],
        [3, -1],
        [4, -1],
      ].map(([列, 行]) => ({ 列2: (列 ?? 0) * 2, 行2: (行 ?? 0) * 2 }));
      锁定方块(状态, () => 0.5);
      expect(状态.阶段).toBe("结束");
      expect(状态.消行数).toBe(0);
      expect(状态.分数).toBe(0);
    });
  });
});

// ── 原 旋转踢墙.test.ts ──
describe("旋转踢墙", () => {
  const 类型列表: 方块类型[] = ["I", "O", "T", "S", "Z", "J", "L"];
  function 中场(类型: 方块类型) {
    const 状态 = 创建新局(() => 0.5, [类型]);
    for (let i = 0; i < 9; i++) 移动方块(状态, 0, 1);
    return 状态;
  }
  const 排序 = (格子: [number, number][]) => 格子.map(([x, y]) => `${x},${y}`).sort();

  test("左右旋转互为逆操作，形状与朝向不能各转各的", () => {
    for (const 类型 of 类型列表)
      for (const 方向 of [-1, 1] as const) {
        const 状态 = 中场(类型);
        const 原格子 = 排序(读取格子(状态.当前方块));
        expect(旋转方块(状态, 方向)).toBe(true);
        expect(旋转方块(状态, 方向 === 1 ? -1 : 1)).toBe(true);
        expect(状态.当前方块.旋转).toBe(0);
        expect(排序(读取格子(状态.当前方块))).toEqual(原格子);
      }
  });

  test("七种方块在两侧墙的四个朝向都可左右转，结果不越界", () => {
    for (const 类型 of 类型列表)
      for (const 方向 of [-1, 1] as const)
        for (const 墙 of [-1, 1] as const)
          for (let 朝向 = 0; 朝向 < 4; 朝向++) {
            const 状态 = 中场(类型);
            for (let i = 0; i < 朝向; i++) 旋转方块(状态, 1);
            while (移动方块(状态, 墙)) {}
            expect(旋转方块(状态, 方向)).toBe(true);
            expect(可以放置(状态, 状态.当前方块)).toBe(true);
          }
  });

  test("右墙旁邻块阻挡时，T/J/L 左转能使用正确的踢墙候选", () => {
    for (const 类型 of ["T", "J", "L"] as const) {
      const 状态 = 中场(类型);
      while (移动方块(状态, 1)) {}
      const 行 = 状态.棋盘[11];
      if (!行) throw new Error("缺少测试行");
      行[8] = "O";
      expect(旋转方块(状态, -1)).toBe(true);
      expect(状态.当前方块.旋转).toBe(3);
      expect(状态.最后踢墙编号).toBeGreaterThan(0);
      expect(可以放置(状态, 状态.当前方块)).toBe(true);
      expect(行[8]).toBe("O");
    }
  });

  test("所有踢墙候选都被阻挡时拒绝旋转且不改当前方块", () => {
    const 状态 = 中场("T");
    const 原 = structuredClone(状态.当前方块);
    const 占格 = new Set(读取格子(原).map(([x, y]) => `${x},${y}`));
    for (let y = 3; y <= 12; y++)
      for (let x = 0; x < 10; x++) {
        const 行 = 状态.棋盘[y + 2];
        if (行 && !占格.has(`${x},${y}`)) 行[x] = "O";
      }
    expect(旋转方块(状态, -1)).toBe(false);
    expect(状态.当前方块).toEqual(原);
  });
});

// ── 原 暂存技巧.test.ts ──
describe("暂存技巧", () => {
  test("暂存首次消费一个预告，重复操作无效；落块后交换不消费预告", () => {
    const s = 创建新局(() => 0, ["T", "I", "O", "J", "L"]);
    expect(暂存换块(s, () => 0)).toBe(true);
    expect([s.暂存方块, s.当前方块.类型, s.下一个方块]).toEqual(["T", "I", "O"]);
    const 原 = structuredClone(s);
    expect(暂存换块(s)).toBe(false);
    expect(s).toEqual(原);
    硬降(s, () => 0);
    expect(s.本块已暂存).toBe(false);
    const 队列 = [s.下一个方块, ...s.后续方块, ...s.袋子];
    s.最后旋转 = true;
    s.锁定毫秒 = 300;
    expect(暂存换块(s)).toBe(true);
    expect([s.暂存方块, s.当前方块.类型, s.当前方块.旋转]).toEqual(["O", "T", 0]);
    expect([s.下一个方块, ...s.后续方块, ...s.袋子]).toEqual(队列);
    expect(s.最后旋转).toBe(false);
    expect(s.锁定毫秒).toBe(0);
  });
  test("暂停与结束不能暂存，换入出生碰撞会结束，新局清空暂存", () => {
    const s = 创建新局(() => 0, ["T", "I"]);
    s.阶段 = "暂停";
    expect(暂存换块(s)).toBe(false);
    s.阶段 = "结束";
    expect(暂存换块(s)).toBe(false);
    s.阶段 = "进行中";
    s.棋盘[1]?.fill("J");
    expect(暂存换块(s)).toBe(true);
    expect(String(s.阶段)).toBe("结束");
    expect(创建新局().暂存方块).toBeNull();
  });
  function 四行(s: 再消一行状态) {
    s.当前方块.类型 = "I";
    s.当前方块.格子 = [-1, 0, 1, 2].map((行) => ({ 列2: 8, 行2: 行 * 2 }));
    for (const row of s.棋盘.slice(-4)) row.fill("J")[4] = null;
    硬降(s, () => 0);
  }
  test("连续四行与完美清场来自真实结算，反馈只显示实际奖励", () => {
    const s = 创建新局(() => 0, ["I", "I", "I"]);
    四行(s);
    expect(s.落块事件?.全清).toBe(true);
    expect(s.落块事件?.连续高难).toBe(false);
    expect(s.落块事件?.行数).toBe(4);
    const 分数 = s.分数;
    四行(s);
    const e = s.落块事件;
    expect(e?.序号).toBe(2);
    expect(e?.连击).toBe(2);
    expect(e?.连续高难).toBe(true);
    expect(e?.得分).toBe(s.分数 - 分数);
    if (!e) throw new Error("缺少真实落块事件");
    const 文案 = 获取技巧反馈(e, 获取文案("简体中文"));
    expect(文案).toContain("完美清场");
    expect(文案).toContain("四连消");
    expect(文案).toContain("连击 ×2");
    expect(文案).toContain("背靠背");
  });
  test("零行 T-Spin 也有技巧反馈，普通零行不弹奖励", () => {
    const e = {
      序号: 1,
      格子: [],
      类型: "T" as const,
      行数: 0,
      T旋: "完整" as const,
      全清: false,
      连击: 0,
      连续高难: false,
      得分: 400,
    };
    expect(获取技巧反馈(e, 获取文案("English"))).toContain("T-SPIN");
    expect(获取技巧反馈({ ...e, T旋: "无", 得分: 0 }, 获取文案("简体中文"))).toBe("");
  });
});

// ── 原 演示落子.test.ts ──
describe("演示落子", () => {
  function 随机源() {
    let 值 = 123456789;
    return () => {
      值 = (Math.imul(值, 1664525) + 1013904223) >>> 0;
      return 值 / 4294967296;
    };
  }

  function 落一子(
    状态: ReturnType<typeof 创建新局>,
    目标: "成功" | "失败",
    已落: number,
    随机: () => number,
  ) {
    const 选择 = 选择演示落点(状态, 目标, 已落);
    for (let i = 0; i < 选择.旋转次数; i++) 旋转方块(状态, 1, false, 随机);
    const 方向 = 选择.平移 < 0 ? -1 : 1;
    for (let i = 0; i < Math.abs(选择.平移); i++) 移动方块(状态, 方向, 0, 随机);
    硬降(状态, 随机);
  }

  test("演示落子能打完 40 行冲刺", () => {
    const 随机 = 随机源();
    const 状态 = 创建新局(随机, [], "冲刺");
    let 已落 = 0;
    while (状态.阶段 === "进行中" && 已落 < 180) {
      落一子(状态, "成功", 已落, 随机);
      已落 += 1;
    }
    expect(状态.完赛).toBe(true);
    expect(状态.消行数).toBeGreaterThanOrEqual(40);
  });

  test("演示落子按失败打会顶死而不是通关", () => {
    const 随机 = 随机源();
    const 状态 = 创建新局(随机, [], "冲刺");
    let 已落 = 0;
    while (状态.阶段 === "进行中" && 已落 < 80) {
      落一子(状态, "失败", 已落, 随机);
      已落 += 1;
    }
    expect(状态.阶段).toBe("结束");
    expect(状态.完赛).toBe(false);
    expect(已落).toBeGreaterThan(12);
  });
});

// ── 原 对局编号.test.ts ──
describe("对局编号", () => {
  const 编号格式 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

  test("有 randomUUID 时直接使用它", () => {
    const 固定 = { randomUUID: () => "11111111-1111-4111-8111-111111111111" };
    expect(新对局编号(固定)).toBe("11111111-1111-4111-8111-111111111111");
  });

  test("没有 randomUUID 时用 getRandomValues 生成可区分的对局编号", () => {
    const 来源 = {
      getRandomValues(数组: Uint8Array) {
        for (let 下标 = 0; 下标 < 数组.length; 下标++) 数组[下标] = 下标 + 1;
        return 数组;
      },
    };
    const 编号 = 新对局编号(来源);
    expect(编号).toMatch(编号格式);
    expect(编号).not.toBe(新对局编号({ getRandomValues: (数组) => 数组 }));
  });
});
