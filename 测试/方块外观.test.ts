import { expect, test } from "bun:test";
import { 方块外观方案表, 解析方块外观 } from "../代码/配置/方块外观";

test("四套方块外观保留七种识别色和独立质感，旧设置及非法值回退默认宝石", () => {
  expect(方块外观方案表.slice(0, 4).map((项) => 项.名称)).toEqual(["默认", "柔瓷", "铬金", "像素"]);
  expect(new Set(方块外观方案表.map((项) => 项.质感)).size).toBe(4);
  for (const 方案 of 方块外观方案表) {
    expect(Object.keys(方案.颜色).sort()).toEqual(["I", "J", "L", "O", "S", "T", "Z"]);
    expect(new Set(Object.values(方案.颜色)).size).toBe(7);
    for (const 色 of Object.values(方案.颜色))
      expect(Number.isInteger(色) && 色 >= 0 && 色 <= 0xffffff).toBe(true);
    expect(解析方块外观(方案.名称)).toBe(方案);
  }
  expect(解析方块外观(undefined).名称).toBe("默认");
  expect(解析方块外观("损坏").名称).toBe("默认");
});
