import { expect, test } from "bun:test";
import { 迁移基础背景 } from "../代码/存档/基础背景解锁";
import { 地点皮肤表 } from "../代码/框架配置/旅行地点";
import {
  地点浏览列表,
  已解锁风景列表,
  相邻已解锁风景,
  相邻风景,
  风景已解锁,
  风景浏览列表,
  风景说明,
} from "../代码/界面/风景浏览";

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

test("风景列表可循环左右切换", () => {
  const 全部 = 风景浏览列表();
  expect(全部.length).toBeGreaterThan(12);
  expect(全部[0]).toBe("成都熊猫");
  expect(相邻风景("成都熊猫", -1)).toBe(全部[全部.length - 1]);
  expect(相邻风景("成都熊猫", 1)).toBe(全部[1]);
  const 地点 = 地点浏览列表();
  expect(地点).toEqual(地点皮肤表.map((项) => 项.名称));
  expect(相邻风景("拉萨晴空", 1, 地点)).toBe("成都熊猫");
  expect(风景说明("成都熊猫").副题).toContain("熊猫");
  expect(风景说明("晨光海岸").标题).toBe("晨光海岸");
});

test("纯享模式只在已解锁风景间切换，锁住的不可选", () => {
  const s = 假存储();
  迁移基础背景(s);
  const 解锁 = 已解锁风景列表(s);
  expect(解锁).toContain("云海山岚");
  expect(解锁).toContain("极光原野");
  expect(解锁).not.toContain("晨光海岸");
  expect(解锁).not.toContain("霓虹天际");
  expect(解锁).not.toContain("成都熊猫");
  expect(风景已解锁("云海山岚", s)).toBe(true);
  expect(风景已解锁("晨光海岸", s)).toBe(false);
  expect(风景已解锁("成都熊猫", s)).toBe(false);

  // 从默认解锁之一左右切，只能在解锁集合内循环
  expect(相邻已解锁风景("云海山岚", 1, s)).toBe("极光原野");
  expect(相邻已解锁风景("极光原野", 1, s)).toBe("云海山岚");
  expect(相邻已解锁风景("极光原野", -1, s)).toBe("云海山岚");

  // 当前若是锁住的（或旅行地点），先落到第一张已解锁
  expect(相邻已解锁风景("晨光海岸", 1, s)).toBe(解锁[0]!);
  expect(相邻已解锁风景("成都熊猫", -1, s)).toBe(解锁[0]!);
});
