import { expect, test } from "bun:test";
import { resolve } from "node:path";
import { 应用主题方案, 解析游戏主题, 读取游戏主题目录 } from "../代码/主题/主题组合";
import { 创建游戏主题 } from "../代码/主题/游戏主题";
import { 界面主题 } from "../代码/主题/配色/主题读取";
import { 默认设置 } from "../代码/设置/游戏设置";
import { 诊断主题组合 } from "../框架/设置/主题组合";
import { 读取预览主题解析 } from "../组件/预览/主题状态";

test("真实配置派生旅行、配色与背景方案，解析全部声明", () => {
  const 目录 = 读取游戏主题目录();
  expect(诊断主题组合(目录)).toEqual([]);
  for (const 项 of 目录.方案) expect(解析游戏主题(默认设置, 项.编号).槽位).toHaveLength(8);
  const 旅行 = 应用主题方案(默认设置, "成都熊猫");
  expect([旅行.背景主题, 旅行.旅行样式, 旅行.方块外观, 旅行.旅行音效, 旅行.旅行音乐]).toEqual(
    Array(5).fill("成都熊猫"),
  );
  expect(创建游戏主题(旅行).名称).toBe("成都熊猫");
  expect(创建游戏主题(旅行).颜色.面板).toBe(
    Number.parseInt(界面主题("成都熊猫").面板.主面板.背景.slice(1), 16),
  );
  expect(
    解析游戏主题(默认设置, "成都熊猫").槽位.find((项) => 项.槽位.编号 === "视觉特效")?.来源,
  ).toBe("默认");
});
test("配色部分覆盖默认回退；旧设置与混搭保留且不改输入", () => {
  const 配色 = 应用主题方案(默认设置, "配色.暖纸古典");
  expect(配色.样式).toBe("暖纸古典");
  expect(配色.背景主题).toBe(默认设置.背景主题);
  expect(配色.旅行音乐).toBeNull();
  const 混搭 = {
    ...默认设置,
    旅行样式: "成都熊猫" as const,
    方块外观: "铬金" as const,
    旅行音乐: "丽江雪山" as const,
    背景动态: false,
  };
  const 原文 = JSON.stringify(混搭);
  const 结果 = 解析游戏主题(混搭);
  expect(结果.槽位.find((项) => 项.槽位.编号 === "方块外观")?.资源.值).toBe("铬金");
  expect(结果.槽位.find((项) => 项.槽位.编号 === "背景音乐")?.资源.值).toBe("丽江雪山");
  expect(结果.槽位.find((项) => 项.槽位.编号 === "动态背景")?.资源.值).toBeNull();
  expect(JSON.stringify(混搭)).toBe(原文);
  const 预览 = 读取预览主题解析(
    { 资源主题: "成都熊猫" },
    { ...应用主题方案(默认设置, "成都熊猫"), 旅行音乐: "丽江雪山" },
  );
  expect(预览.方案).toBe("成都熊猫");
  expect(预览.槽位.find((项) => 项.槽位.编号 === "背景音乐")?.来源).toBe("局部");
  expect(预览.槽位.find((项) => 项.槽位.编号 === "背景音乐")?.资源.值).toBe("丽江雪山");
});

test("真实设置入口仍校验所有权，整套和单项穿戴持久化到旧字段", () => {
  const 执行 = Bun.spawnSync(
    [
      process.execPath,
      "-e",
      `
    import assert from 'node:assert/strict';
    const data = new Map();
    globalThis.localStorage = {get length(){return data.size}, getItem:k=>data.get(k)??null, setItem:(k,v)=>data.set(k,String(v)), removeItem:k=>data.delete(k), clear:()=>data.clear(), key:i=>[...data.keys()][i]??null};
    globalThis.window = new EventTarget();
    const {获取游戏设置,穿戴旅行外观}=await import('./代码/设置/游戏设置.ts');
    const {旅行收藏}=await import('./代码/存档/旅行收藏.ts');
    assert.equal(穿戴旅行外观('成都熊猫','整套'),false);
    const 收藏=new 旅行收藏(localStorage);
    assert(收藏.增加测试金币(10000).成功);
    assert(收藏.购买('成都熊猫','整套').成功);
    assert(穿戴旅行外观('成都熊猫','整套'));
    const 整套=获取游戏设置();
    for(const k of ['背景主题','旅行样式','方块外观','旅行音效','旅行音乐'])assert.equal(整套[k],'成都熊猫');
    assert(收藏.购买('丽江雪山','音乐').成功);
    assert(穿戴旅行外观('丽江雪山','音乐'));
    assert.equal(获取游戏设置().旅行音乐,'丽江雪山');
    assert.equal(获取游戏设置().背景主题,'成都熊猫');
    assert.equal(JSON.parse(localStorage.getItem('再消一行:设置')).旅行音乐,'丽江雪山');
  `,
    ],
    { cwd: resolve(import.meta.dir, ".."), stdout: "pipe", stderr: "pipe" },
  );
  expect(new TextDecoder().decode(执行.stderr)).toBe("");
  expect(执行.exitCode).toBe(0);
});
