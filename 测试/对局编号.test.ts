import { expect, test } from "bun:test";
import { 新对局编号 } from "../代码/场景/对局/对局编号";

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
