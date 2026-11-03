import { describe, expect, test } from "bun:test";
import { 创建转场服务 } from "../../../代码/应用/服务/转场";
import { 计算对局布局 } from "../../../代码/页面/布局/对局布局";
import {
  type 侧栏转场,
  侧栏转场时长,
  更新侧栏转场,
  读取侧栏转场帧,
} from "../../../资源/视效/过渡/侧栏转场";
import {
  入场参数,
  准备起始时刻,
  对局入场时长,
  棋盘展开时长,
  模式退场时长,
  计算入场节拍,
  计算分组入场姿态,
  计算网格入场透明度,
} from "../../../资源/视效/过渡/入场演出";

/** 侧栏转场：队列首块飞到棋盘、暂存交换两块，进度不改变玩法状态。 */
describe("侧栏转场", () => {
  const 布局 = 计算对局布局(390, 844, { 模式: "马拉松", 阶段: "进行中" });
  const 转场: 侧栏转场 = {
    类型: "出块",
    经过秒: 0,
    移出: "L",
    原格子: [
      [3, 1],
      [3, 2],
      [4, 2],
      [5, 2],
    ],
    暂存: null,
    队列: ["O", "S", "I"],
  };

  test("真实队列首块从预览飞至棋盘生成区，时间结束清理", () => {
    const 初 = 读取侧栏转场帧(转场, 布局);
    const 中 = 读取侧栏转场帧({ ...转场, 经过秒: 侧栏转场时长 / 2 }, 布局);
    const 末 = 读取侧栏转场帧({ ...转场, 经过秒: 侧栏转场时长 }, 布局);
    expect(初.飞块[0]?.类型).toBe("O");
    expect(初.飞块[0]?.x).toBeGreaterThan(布局.棋盘.左 + 布局.棋盘.宽);
    expect(末.飞块[0]?.x).toBe(布局.棋盘中心X);
    expect(中.飞块[0]?.y).toBeLessThan(初.飞块[0]?.y ?? 0);
    expect(末.飞块[0]?.格).toBe(布局.格子大小);
    expect(更新侧栏转场(转场, 0)?.经过秒).toBe(0);
    expect(更新侧栏转场(转场, 侧栏转场时长)).toBeNull();
  });

  test("非空暂存是两块交换，不消费队列；空暂存消费首块", () => {
    const 交换 = 读取侧栏转场帧({ ...转场, 类型: "暂存", 暂存: "T" }, 布局);
    expect(交换.出队).toBe(false);
    expect(交换.飞块.map((块) => 块.类型)).toEqual(["L", "T"]);
    const 空槽 = 读取侧栏转场帧({ ...转场, 类型: "暂存" }, 布局);
    expect(空槽.出队).toBe(true);
    expect(空槽.飞块.map((块) => 块.类型)).toEqual(["O", "L"]);
    const 完 = 读取侧栏转场帧({ ...转场, 类型: "暂存", 暂存: "T", 经过秒: 侧栏转场时长 }, 布局);
    expect(完.飞块[0]?.x).toBe((布局.侧栏?.暂存.左 ?? 0) + (布局.侧栏?.暂存.宽 ?? 0) / 2);
    expect(完.飞块[1]?.x).toBe(布局.棋盘中心X);
  });
});

describe("入场演出", () => {
  const 时 = 入场参数.时间;
  const 组 = ["棋盘", "顶栏", "侧栏", "操作区"] as const;

  test("总时长仍是 1.06 秒收束 + 1.34 秒展开", () => {
    expect(模式退场时长).toBe(1.06);
    expect(对局入场时长).toBe(1.34);
    expect(模式退场时长 + 对局入场时长).toBeCloseTo(2.4, 10);
    // 揭示在 Ready 之前结束，Ready/Go 才有干净的底。
    expect(棋盘展开时长).toBe(时.揭示止);
    expect(棋展时值()).toBe(0.62);
    expect(准备起始时刻).toBe(时.Ready起);
    expect(时.Ready起).toBeGreaterThan(时.揭示止);
  });

  function 棋展时值(): number {
    return 棋盘展开时长;
  }

  test("负时间归零，节拍按 揭示→Ready→Go→完成 推进", () => {
    expect(计算入场节拍(-1)).toEqual(计算入场节拍(0));
    expect(计算入场节拍(0).节拍).toBe("揭示");
    expect(计算入场节拍(时.揭示止).节拍).toBe("揭示");
    expect(计算入场节拍(时.Ready起 - 0.001).节拍).toBe("揭示");
    expect(计算入场节拍(时.Ready起).节拍).toBe("Ready");
    expect(计算入场节拍(时.Ready止 - 0.001).节拍).toBe("Ready");
    expect(计算入场节拍(时.Ready止).节拍).toBe("Go");
    expect(计算入场节拍(时.Go止 - 0.001).节拍).toBe("Go");
    expect(计算入场节拍(时.Go止).节拍).toBe("完成");
    expect(计算入场节拍(时.Go止 - 0.001).完成).toBe(false);
    expect(计算入场节拍(时.Go止).完成).toBe(true);
    const 序 = ["揭示", "Ready", "Go", "完成"];
    let 前序 = 0;
    for (let 毫秒 = 0; 毫秒 <= 对局入场时长 * 1000; 毫秒 += 10) {
      const 当前 = 序.indexOf(计算入场节拍(毫秒 / 1000).节拍);
      expect(当前).toBeGreaterThanOrEqual(前序);
      if (当前 > 前序) expect(当前 - 前序).toBe(1);
      前序 = 当前;
    }
  });

  test("揭示进度单调、0.62 秒到 1、不越界", () => {
    expect(计算入场节拍(0).揭示进度).toBe(0);
    expect(计算入场节拍(时.揭示止).揭示进度).toBe(1);
    expect(计算入场节拍(时.揭示止 + 1).揭示进度).toBe(1);
    let 前 = 0;
    for (let 毫秒 = 0; 毫秒 <= 对局入场时长 * 1000; 毫秒 += 5) {
      const 当前 = 计算入场节拍(毫秒 / 1000).揭示进度;
      expect(当前).toBeGreaterThanOrEqual(前 - 1e-9);
      expect(当前).toBeLessThanOrEqual(1);
      前 = 当前;
    }
  });

  test("四组错峰落位，0.60 秒全部归位", () => {
    expect(计算分组入场姿态(-1, "棋盘")).toEqual(计算分组入场姿态(0, "棋盘"));
    for (const 名称 of 组) {
      const p = 计算分组入场姿态(时.落位止, 名称);
      expect(p.完成).toBe(true);
      expect(p.透明度).toBe(1);
      expect(p.偏移X).toBe(0);
      expect(p.偏移Y).toBe(0);
      expect(p.缩放Y).toBe(1);
    }
    // 最晚落位的是操作区：它差 1 毫秒都不算完成，其余组早已完成。
    expect(计算分组入场姿态(时.落位止 - 0.001, "操作区").完成).toBe(false);
    expect(计算分组入场姿态(时.落位止, "操作区").完成).toBe(true);
    expect(计算分组入场姿态(0, "棋盘").透明度).toBe(1);
    expect(计算分组入场姿态(0, "顶栏").偏移Y).toBeLessThan(0);
    expect(计算分组入场姿态(0, "侧栏").偏移X).toBeGreaterThan(0);
    expect(计算分组入场姿态(0, "操作区").偏移Y).toBeGreaterThan(0);
    expect(计算网格入场透明度(0)).toBe(0);
    expect(计算网格入场透明度(时.落位止)).toBe(1);
  });
});

describe("转场服务", () => {
  const 记录进入: string[] = [];
  const 创建 = () => {
    记录进入.length = 0;
    return 创建转场服务({ 进入对局: (模式) => 记录进入.push(模式) });
  };
  const 原卡 = { 左: 24, 上: 596, 宽: 342, 高: 96 };

  test("收束结束先切到展开 0 秒，再通知进入对局", () => {
    const 转场 = 创建();
    转场.开始收束("冲刺", 原卡);
    expect(转场.读取()).toEqual({ 模式: "冲刺", 阶段: "收束", 秒: 0, 原卡 });
    expect(转场.读取入场秒()).toBeNull();
    转场.更新(0.5);
    expect(转场.读取()?.秒).toBeCloseTo(0.5, 10);
    expect(记录进入).toEqual([]);
    转场.更新(0.56);
    expect(转场.读取()?.阶段).toBe("展开");
    expect(转场.读取()?.秒).toBeCloseTo(0, 10);
    expect(转场.读取()?.原卡).toBeNull();
    expect(转场.读取入场秒()).toBeCloseTo(0, 10);
    expect(记录进入).toEqual(["冲刺"]);
    // 进入对局只通知一次：继续推进不再重复切页。
    转场.更新(0.4);
    expect(记录进入).toEqual(["冲刺"]);
    expect(转场.读取()?.秒).toBeCloseTo(0.4, 10);
  });

  test("展开 1.34 秒后清空，订阅收到结束通知", () => {
    const 转场 = 创建();
    const 通知: (string | null)[] = [];
    转场.订阅((演出) => 通知.push(演出 ? `${演出.阶段}:${演出.秒.toFixed(2)}` : null));
    转场.开始收束("极限", 原卡);
    转场.更新(模式退场时长);
    转场.更新(对局入场时长 - 0.01);
    expect(转场.读取()).not.toBeNull();
    转场.更新(0.02);
    expect(转场.读取()).toBeNull();
    expect(转场.读取入场秒()).toBeNull();
    expect(通知.at(-1)).toBeNull();
    expect(通知.length).toBeGreaterThan(3);
  });

  test("取消订阅后不再通知，重置立即清空", () => {
    const 转场 = 创建();
    let 次数 = 0;
    const 退订 = 转场.订阅(() => {
      次数++;
    });
    转场.开始收束("每日挑战", 原卡);
    const 已有 = 次数;
    退订();
    转场.更新(0.2);
    expect(次数).toBe(已有);
    转场.重置();
    expect(转场.读取()).toBeNull();
  });

  test("开始展开用于没有收束的入口，无效秒不推进", () => {
    const 转场 = 创建();
    转场.开始展开("马拉松");
    expect(转场.读取()).toEqual({ 模式: "马拉松", 阶段: "展开", 秒: 0, 原卡: null });
    expect(转场.读取入场秒()).toBe(0);
    转场.更新(Number.NaN);
    转场.更新(-1);
    expect(转场.读取()?.秒).toBe(0);
    转场.更新(0.25);
    expect(转场.读取()?.秒).toBeCloseTo(0.25, 10);
    转场.重置();
    expect(转场.读取()).toBeNull();
    expect(记录进入).toEqual([]);
  });
});
