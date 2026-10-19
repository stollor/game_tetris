import { expect, test } from "bun:test";
import { 基础背景已解锁, 迁移基础背景 } from "../代码/存档/基础背景解锁";
import { 计算目录滚动 } from "../代码/界面/目录滚动";

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

test("新存档只默认解锁云海山岚与极光原野", () => {
  const s = 假存储();
  迁移基础背景(s);
  expect(基础背景已解锁("云海山岚", s, 0)).toBe(true);
  expect(基础背景已解锁("极光原野", s, 0)).toBe(true);
  expect(基础背景已解锁("晨光海岸", s, 0)).toBe(false);
  expect(基础背景已解锁("霓虹天际", s, 0)).toBe(false);
  expect(基础背景已解锁("晨光海岸", s, 3)).toBe(true);
  expect(基础背景已解锁("霓虹天际", s, 5)).toBe(false);
  expect(基础背景已解锁("霓虹天际", s, 6)).toBe(true);
});

test("已有存档的玩家保留全部基础背景，迁移只执行一次", () => {
  const s = 假存储({ "再消一行:设置": "{}" });
  迁移基础背景(s);
  expect(基础背景已解锁("晨光海岸", s, 0)).toBe(true);
  expect(基础背景已解锁("霓虹天际", s, 0)).toBe(true);
  const 新 = 假存储();
  迁移基础背景(新);
  新.setItem("再消一行:设置", "{}");
  迁移基础背景(新);
  expect(基础背景已解锁("晨光海岸", 新, 0)).toBe(false);
});

test("商店目录选中项可见时不滚动，越界时只最小滚入", () => {
  expect(计算目录滚动(300, 400, 96, 360)).toBe(300);
  expect(计算目录滚动(300, 100, 96, 360)).toBe(92);
  expect(计算目录滚动(0, 600, 96, 360)).toBe(344);
  expect(计算目录滚动(50, 0, 96, 360)).toBe(0);
});
