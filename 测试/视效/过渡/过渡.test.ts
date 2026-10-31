import { describe, expect, test } from "bun:test";
import { 计算对局布局 } from "../../../代码/页面/布局/对局布局";
import {
  type 侧栏转场,
  侧栏转场时长,
  更新侧栏转场,
  读取侧栏转场帧,
} from "../../../视效/过渡/侧栏转场";
import {
  入场参数,
  对局入场时长,
  棋盘展开时长,
  模式退场时长,
  计算分组入场姿态,
  计算对局入场姿态,
  计算展开幕缝,
  计算模式入场姿态,
  计算退场进度,
  读取入场幕色,
} from "../../../视效/过渡/入场演出";

// ── 原 侧栏转场.test.ts ──
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

// ── 原 入场演出.test.ts ──
describe("入场演出", () => {
  const 原 = { 左: 30, 上: 550, 宽: 330, 高: 92 };
  const 宽 = 390;
  const 高 = 844;
  const 姿态 = (秒: number) => 计算模式入场姿态(秒, 原, 宽, 高);
  const 组 = ["棋盘", "顶栏", "侧栏", "操作区"] as const;
  const 时 = 入场参数.时间;
  const 线高 = 入场参数.运动.线高;
  const 准备起始 = 时.Ready起;

  describe("2.4 秒非对称入场", () => {
    test("总时长由 1.06 秒退场与 1.34 秒入场组成", () => {
      expect(模式退场时长).toBe(1.06);
      expect(对局入场时长).toBe(1.34);
      expect(棋盘展开时长).toBe(时.落位止);
      expect(棋盘展开时长).toBe(0.6);
      expect(准备起始).toBe(0.44);
      expect(时.Ready止).toBe(0.9);
      const 总时长 = 模式退场时长 + 对局入场时长;
      expect(总时长).toBeCloseTo(2.4, 10);
    });

    test("负时间归零，原位起步，全宽 2px 中心线收束", () => {
      expect(姿态(-1)).toEqual(姿态(0));
      expect(计算对局入场姿态(-10)).toEqual(计算对局入场姿态(0));
      for (const 名称 of 组) {
        expect(计算分组入场姿态(-1, 名称)).toEqual(计算分组入场姿态(0, 名称));
      }
      expect(姿态(0).矩形).toEqual(原);
      expect(计算对局入场姿态(0).展开进度).toBe(0);

      expect(姿态(模式退场时长 - 0.01).完成).toBe(false);
      const 终 = 姿态(模式退场时长);
      expect(终.完成).toBe(true);
      expect(终.矩形.左).toBeCloseTo(0, 3);
      expect(终.矩形.宽).toBeCloseTo(宽, 3);
      expect(线高).toBe(2);
      expect(终.矩形.高).toBeCloseTo(线高, 3);
      expect(终.矩形.上 + 终.矩形.高 / 2).toBeCloseTo(高 / 2, 1);
      expect(终.幕面进度).toBe(1);
      expect(终.幕缝.顶).toBeCloseTo(高 / 2 - 线高 / 2, 1);
      expect(终.幕缝.底).toBeCloseTo(高 / 2 + 线高 / 2, 1);
      expect(终.幕缝.顶).toBeGreaterThanOrEqual(高 / 2 - 1);
      expect(终.幕缝.底).toBeLessThanOrEqual(高 / 2 + 1);
      expect(终.幕缝.顶).toBeLessThan(终.幕缝.底);
    });

    test("阶段按退场→居中→压线→蓄力推进，不越过给定端点", () => {
      const 序 = ["退场", "居中", "压线", "蓄力"];
      const 样本 = Array.from({ length: 105 }, (_, i) => i * 0.01);
      const 阶段列 = 样本.map((秒) => 姿态(秒).阶段);
      expect(阶段列[0]).toBe("退场");
      expect(阶段列.at(-1)).toBe("蓄力");
      expect(new Set(阶段列)).toEqual(new Set(序));
      let 前序 = 0;
      for (const 阶段 of 阶段列) {
        const 当前 = 序.indexOf(阶段);
        expect(当前).toBeGreaterThanOrEqual(前序);
        if (当前 > 前序) expect(当前 - 前序).toBe(1);
        前序 = 当前;
      }
      for (const 秒 of 样本) {
        const p = 姿态(秒);
        for (const 键 of ["居中进度", "压缩进度", "幕面进度"] as const) {
          expect(p[键]).toBeGreaterThanOrEqual(0);
          expect(p[键]).toBeLessThanOrEqual(1);
        }
      }
    });

    test("压缩末段更快，内容随整卡压缩并在后半段单调淡出", () => {
      const 高度 = (秒: number) => 姿态(秒).矩形.高;
      const 跨 = 时.收束止 - 时.收束起;
      const 早期差 = 高度(时.收束起 + 跨 * 0.2) - 高度(时.收束起 + 跨 * 0.35);
      const 末段差 = 高度(时.收束起 + 跨 * 0.75) - 高度(时.收束起 + 跨 * 0.9);
      expect(早期差).toBeGreaterThan(0);
      expect(末段差).toBeGreaterThanOrEqual(0);
      expect(末段差).toBeGreaterThan(早期差);

      expect(姿态(0).内容透明度).toBe(1);

      let 半高处: number | undefined;
      for (let 毫秒 = 0; 毫秒 <= 模式退场时长 * 1000; 毫秒 += 5) {
        const 秒 = 毫秒 / 1000;
        if (姿态(秒).矩形.高 <= 原.高 / 2) {
          半高处 = 秒;
          break;
        }
      }
      expect(半高处).toBeDefined();
      expect(姿态(半高处 as number).内容透明度).toBeGreaterThan(0.6);
      expect(姿态(时.收束止).内容透明度).toBeCloseTo(0, 10);

      let 前 = 姿态(半高处 as number).内容透明度;
      for (let 秒 = 半高处 as number; 秒 <= 时.收束止 + 1e-9; 秒 += 0.005) {
        const 当前 = 姿态(秒).内容透明度;
        expect(当前).toBeLessThanOrEqual(前 + 1e-9);
        前 = 当前;
      }
    });

    test("展开先快后慢，0.60 秒完全展开并接上 Ready 与 Go", () => {
      const 展开 = (秒: number) => 计算对局入场姿态(秒).展开进度;
      expect(展开(0)).toBe(0);
      expect(展开(0.12) - 展开(0)).toBeGreaterThan(展开(0.36) - 展开(0.24));
      expect(展开(棋盘展开时长)).toBe(1);
      expect(展开(准备起始 - 0.001)).toBeLessThan(1);

      let 前 = 0;
      for (let 毫秒 = 0; 毫秒 <= 对局入场时长 * 1000; 毫秒 += 10) {
        const 当前 = 展开(毫秒 / 1000);
        expect(当前).toBeGreaterThanOrEqual(前 - 1e-9);
        expect(当前).toBeLessThanOrEqual(1);
        前 = 当前;
      }

      expect(计算对局入场姿态(准备起始 - 0.01).节拍).toBe("展开");
      expect(计算对局入场姿态(准备起始).节拍).toBe("Ready");
      expect(计算对局入场姿态(时.Ready止 - 0.01).节拍).toBe("Ready");
      expect(计算对局入场姿态(时.Ready止).节拍).toBe("Go");
      expect(计算对局入场姿态(对局入场时长 - 0.01).节拍).toBe("Go");
      expect(计算对局入场姿态(对局入场时长).节拍).toBe("完成");
      expect(计算对局入场姿态(对局入场时长 - 0.01).完成).toBe(false);
      expect(计算对局入场姿态(对局入场时长).完成).toBe(true);
    });

    test("四组错峰起步，0.60 秒全部精确归位", () => {
      expect(准备起始).toBeLessThan(棋盘展开时长);
      const 样本 = [0.04, 0.08, 0.12, 0.16, 0.2, 0.24, 0.28, 0.32, 0.36, 0.4, 0.44, 0.48, 0.52];
      const 有错峰 = 样本.some((秒) => {
        const 键 = 组.map((名称) => {
          const p = 计算分组入场姿态(秒, 名称);
          expect(Number.isFinite(p.偏移X)).toBe(true);
          expect(Number.isFinite(p.偏移Y)).toBe(true);
          return [p.透明度, p.偏移X, p.偏移Y, p.缩放Y].map((值) => 值.toFixed(3)).join("|");
        });
        return new Set(键).size > 1;
      });
      expect(有错峰).toBe(true);

      // Ready 已出现，操作区仍可继续轻落位到棋盘完全展开。
      expect(计算分组入场姿态(准备起始, "操作区").完成).toBe(false);

      for (const 名称 of 组) {
        const p = 计算分组入场姿态(棋盘展开时长, 名称);
        expect(p.完成).toBe(true);
        expect(p.透明度).toBe(1);
        expect(p.偏移X).toBe(0);
        expect(p.偏移Y).toBe(0);
        expect(p.缩放Y).toBe(1);
      }
    });

    test("手机尺寸下中心线与幕缝留在画面内", () => {
      for (const [屏宽, 屏高] of [
        [390, 844],
        [430, 740],
        [320, 640],
      ] as const) {
        const 卡片 = { 左: 30, 上: 屏高 - 190, 宽: 屏宽 - 60, 高: 92 };
        const 终 = 计算模式入场姿态(模式退场时长, 卡片, 屏宽, 屏高);
        expect(终.矩形.上 + 终.矩形.高 / 2).toBeCloseTo(屏高 / 2, 1);
        expect(终.矩形.高).toBeCloseTo(线高, 3);
        expect(终.矩形.左).toBeCloseTo(0, 3);
        expect(终.矩形.宽).toBeCloseTo(屏宽, 3);
        expect(终.矩形.上).toBeGreaterThanOrEqual(0);
        expect(终.矩形.上 + 终.矩形.高).toBeLessThanOrEqual(屏高);
        expect(终.幕缝.顶).toBeCloseTo(屏高 / 2 - 线高 / 2, 1);
        expect(终.幕缝.底).toBeCloseTo(屏高 / 2 + 线高 / 2, 1);
        expect(终.幕缝.顶).toBeGreaterThanOrEqual(屏高 / 2 - 1);
        expect(终.幕缝.底).toBeLessThanOrEqual(屏高 / 2 + 1);

        for (let 毫秒 = 0; 毫秒 <= 模式退场时长 * 1000; 毫秒 += 20) {
          const p = 计算模式入场姿态(毫秒 / 1000, 卡片, 屏宽, 屏高);
          expect(p.幕缝.顶).toBeGreaterThanOrEqual(-0.001);
          expect(p.幕缝.底).toBeLessThanOrEqual(屏高 + 0.001);
          expect(p.幕缝.顶).toBeLessThanOrEqual(p.幕缝.底);
          expect(p.矩形.左).toBeGreaterThanOrEqual(-0.001);
          expect(p.矩形.左 + p.矩形.宽).toBeLessThanOrEqual(屏宽 + 0.001);
        }
      }
    });
  });

  test("错峰在一拍内退尽，收束末帧与展开首帧严格共用接缝", () => {
    expect(计算退场进度(0.08, 0)).toBeGreaterThan(计算退场进度(0.08, 2));
    for (let 距离 = 0; 距离 <= 3; 距离++) expect(计算退场进度(0.24, 距离)).toBe(1);
    for (const 屏高 of [640, 740, 844]) {
      const 终 = 计算模式入场姿态(模式退场时长, 原, 宽, 屏高);
      expect(终.幕缝).toEqual(计算展开幕缝(计算对局入场姿态(0).展开进度, 屏高));
      expect(终.线脉冲).toBeCloseTo(计算对局入场姿态(0).线脉冲, 10);
      expect(计算展开幕缝(1, 屏高)).toEqual({ 顶: 0, 底: 屏高 });
    }
  });

  test("凝聚线在闭合瞬间达峰并跨切页延续释放余辉", () => {
    expect(姿态(时.收束止).线脉冲).toBeCloseTo(1, 10);

    const 余辉 = 入场参数.能量.释放余辉;
    expect(余辉).toBeCloseTo(0.42, 10);
    expect(姿态(模式退场时长).线脉冲).toBeCloseTo(余辉, 10);
    expect(计算对局入场姿态(0).线脉冲).toBeCloseTo(余辉, 10);
    expect(计算对局入场姿态(0.1).线脉冲).toBe(0);
  });

  test("幕布依照四模式染色，避开大面积纯白与过亮颜色", () => {
    const 幕色 = (["马拉松", "冲刺", "极限", "每日挑战"] as const).map(读取入场幕色);
    expect(new Set(幕色.map((色) => 色.内)).size).toBe(4);
    for (const 色 of 幕色) {
      for (const 值 of [色.外, 色.内]) {
        expect(值).not.toBe(0xffffff);
        expect(Math.max((值 >> 16) & 255, (值 >> 8) & 255, 值 & 255)).toBeLessThan(200);
      }
    }
  });
});
