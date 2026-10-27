import { expect, test } from "bun:test";
import { 迁移更名前存档 } from "../代码/存档/更名迁移";

function 假存储(初始: Record<string, string> = {}): Storage {
  const m = new Map(Object.entries(初始));
  return {
    get length() {
      return m.size;
    },
    clear: () => m.clear(),
    getItem: (k: string) => m.get(k) ?? null,
    key: (i: number) => [...m.keys()][i] ?? null,
    removeItem: (k: string) => void m.delete(k),
    setItem: (k: string, v: string) => void m.set(k, v),
  };
}

test("旧设置键迁移到新键并删除旧键", () => {
  const s = 假存储({ "俄罗斯方块:设置": '{"显示网格":false}' });
  迁移更名前存档(s);
  expect(s.getItem("再消一行:设置")).toBe('{"显示网格":false}');
  expect(s.getItem("俄罗斯方块:设置")).toBeNull();
});

test("已有新设置键时保留新键，不覆盖", () => {
  const s = 假存储({
    "俄罗斯方块:设置": '{"显示网格":false}',
    "再消一行:设置": '{"显示网格":true}',
  });
  迁移更名前存档(s);
  expect(s.getItem("再消一行:设置")).toBe('{"显示网格":true}');
  expect(s.getItem("俄罗斯方块:设置")).toBe('{"显示网格":false}');
});

test("旧四行成就编号迁移到新编号，其他成就原样保留", () => {
  const s = 假存储({
    "neon-pulse:achievements": JSON.stringify({
      版本: 1,
      数据: {
        tetris: { 进度: 1, 解锁时间: 100 },
        spin: { 进度: 1, 解锁时间: 200 },
      },
    }),
  });
  迁移更名前存档(s);
  const 存档 = JSON.parse(s.getItem("neon-pulse:achievements") ?? "{}");
  expect(存档).toEqual({
    版本: 1,
    数据: {
      "four-lines": { 进度: 1, 解锁时间: 100 },
      spin: { 进度: 1, 解锁时间: 200 },
    },
  });
});

test("新旧四行成就同时存在时取进度较大者并保留先解锁时间", () => {
  const s = 假存储({
    "neon-pulse:achievements": JSON.stringify({
      版本: 1,
      数据: {
        tetris: { 进度: 1, 解锁时间: 100 },
        "four-lines": { 进度: 0, 解锁时间: null },
      },
    }),
  });
  迁移更名前存档(s);
  const 存档 = JSON.parse(s.getItem("neon-pulse:achievements") ?? "{}");
  expect(存档.数据["four-lines"]).toEqual({ 进度: 1, 解锁时间: 100 });
  expect(存档.数据.tetris).toBeUndefined();
});

test("旅行收藏里已领的旧成就编号迁移，余额和购买保留", () => {
  const s = 假存储({
    "旅行版:收藏": JSON.stringify({
      版本: 1,
      数据: {
        金币: 320,
        累计获得: 500,
        已购: [],
        已结算: [],
        已领成就: ["tetris", "first-lock"],
        最近首局日期: "2026-10-18",
      },
    }),
  });
  迁移更名前存档(s);
  const 存档 = JSON.parse(s.getItem("旅行版:收藏") ?? "{}");
  expect(存档.数据).toMatchObject({
    金币: 320,
    已领成就: ["four-lines", "first-lock"],
  });
});

test("重复执行不改变结果", () => {
  const s = 假存储({ "俄罗斯方块:设置": "{}" });
  迁移更名前存档(s);
  迁移更名前存档(s);
  expect(s.getItem("再消一行:设置")).toBe("{}");
  expect(s.getItem("俄罗斯方块:设置")).toBeNull();
});

test("损坏的成就存档原样保留，不覆盖", () => {
  const s = 假存储({ "neon-pulse:achievements": "{坏档" });
  迁移更名前存档(s);
  expect(s.getItem("neon-pulse:achievements")).toBe("{坏档");
});

test("旧主题名称迁移到源名称，保留其他设置且重复执行不变", () => {
  const s = 假存储({
    "gamemaker:settings": JSON.stringify({ 样式: "青蓝未来", 音效音量: 25 }),
    "再消一行:设置": JSON.stringify({ 方块外观: "默认", 显示网格: false }),
  });
  迁移更名前存档(s);
  expect(JSON.parse(s.getItem("gamemaker:settings") ?? "{}")).toEqual({
    样式: "极光原野",
    音效音量: 25,
  });
  expect(JSON.parse(s.getItem("再消一行:设置") ?? "{}")).toEqual({
    方块外观: "极光原野",
    显示网格: false,
  });
  const 原文 = s.getItem("再消一行:设置");
  迁移更名前存档(s);
  expect(s.getItem("再消一行:设置")).toBe(原文);
});
