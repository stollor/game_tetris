import { expect, test } from "bun:test";
import { resolve } from "node:path";
import {
  主题结果转设置,
  解析游戏主题,
  读取当前主题选择,
  读取游戏主题目录,
  默认主题编号,
} from "../主题/主题组合";
import { 创建游戏主题 } from "../主题/游戏主题";
import { 界面主题 } from "../主题/配色/主题读取";
import { 地点皮肤表 } from "../代码/框架配置/旅行地点";
import { 默认设置 } from "../代码/设置/游戏设置";
import { 查找默认主题, 解析主题选择, 诊断主题组合, 读取可选主题 } from "../框架/设置/主题组合";
import { 读取预览主题解析 } from "../组件/预览/主题状态";

test("每个主题都收纳完整维度，目录里没有脱离主题的零散资源", () => {
  const 目录 = 读取游戏主题目录();
  expect(诊断主题组合(目录)).toEqual([]);
  // 恰好一个默认主题，且覆盖全部槽位。
  expect(目录.主题.filter((项) => 项.默认).map((项) => 项.编号)).toEqual([默认主题编号]);
  const 默认 = 查找默认主题(目录);
  expect(默认?.编号).toBe("极光原野");
  expect(默认?.维度.map((项) => 项.编号)).toEqual([
    "界面表现",
    "字体",
    "配色",
    "背景",
    "方块",
    "棋盘表现",
    "音效",
    "音乐",
    "特效",
    "仪表纹样",
    "仪表表现",
  ]);
  // 每个主题都必须拥有同一套维度，不能只有其中几项。
  for (const 主题 of 目录.主题) {
    expect(主题.维度.map((项) => 项.编号)).toEqual([
      "界面表现",
      "字体",
      "配色",
      "背景",
      "方块",
      "棋盘表现",
      "音效",
      "音乐",
      "特效",
      "仪表纹样",
      "仪表表现",
    ]);
    for (const 维度 of 主题.维度) expect(维度.选项.length).toBeGreaterThan(0);
  }
  for (const 主题 of 目录.主题) {
    const 结果 = 解析游戏主题(默认设置, 主题.编号);
    expect(结果.主题).toBe(主题.编号);
    expect(结果.槽位.length).toBeGreaterThanOrEqual(10);
  }
});

test("默认主题：极光原野配色、背景和方块外观", () => {
  const 结果 = 解析游戏主题(默认设置, 默认主题编号);
  const 值 = (槽: string) => 结果.槽位.find((项) => 项.槽位.编号 === 槽)?.资源.值;
  expect(结果.选项).toMatchObject({
    配色: "极光原野",
    背景: "极光原野",
    方块: "极光原野",
  });
  expect(值("界面配色")).toBe("极光原野");
  expect(值("控件外观")).toBe("极光原野");
  expect(值("静态背景")).toBe("极光原野");
  expect(值("动态背景")).toBe("极光原野");
  expect(值("方块外观")).toBe("极光原野");
  expect(值("仪表纹样")).toBe("灯条");
  expect(值("仪表表现")).toBe("装置");
  expect(值("棋盘表现")).toBe("平面");
  // 视觉特效也归属主题内的特效维度，来源是主题而不是游离默认。
  expect(结果.槽位.find((项) => 项.槽位.编号 === "视觉特效")?.来源).toBe("主题");
  const 条带 = 解析游戏主题(默认设置, `${默认主题编号}@仪表表现=条带`);
  expect(条带.槽位.find((项) => 项.槽位.编号 === "仪表表现")?.资源.值).toBe("条带");
  expect(条带.槽位.find((项) => 项.槽位.编号 === "界面配色")?.资源.值).toBe("极光原野");
  const 平涂 = 解析游戏主题(默认设置, `${默认主题编号}@仪表纹样=平涂`);
  expect(平涂.槽位.find((项) => 项.槽位.编号 === "仪表纹样")?.资源.值).toBe("平涂");
});

test("极光原野与待分类按真实外观分组", () => {
  const 目录 = 读取游戏主题目录();
  const 默认 = 查找默认主题(目录);
  const 待分类 = 目录.主题.find((项) => 项.编号 === "待分类");
  const 列表 = (主题: typeof 默认, 维度: string) =>
    主题?.维度.find((项) => 项.编号 === 维度)?.选项.filter((项) => !项.隐藏) ?? [];
  expect(列表(默认, "配色").map((项) => 项.名称)).toEqual(["极光原野"]);
  expect(列表(默认, "方块").map((项) => 项.名称)).toEqual(["极光原野"]);
  expect(列表(默认, "背景").map((项) => 项.名称)).toContain("极光原野");
  expect(列表(待分类, "配色").map((项) => 项.编号)).toEqual(["夜空鎏金", "暖纸古典"]);
  expect(列表(待分类, "背景").map((项) => 项.编号)).toEqual(
    expect.arrayContaining(["晨光海岸", "云海山岚", "霓虹天际"]),
  );
  expect(列表(待分类, "方块").map((项) => 项.编号)).toEqual(
    expect.arrayContaining(["柔瓷", "铬金", "像素"]),
  );
  expect(列表(待分类, "方块").map((项) => 项.编号)).not.toContain("砖机液晶");
  expect(列表(待分类, "方块").map((项) => 项.编号)).not.toContain("街机彩砖");
  expect(列表(待分类, "方块").map((项) => 项.编号)).not.toContain("立体晶格");
  expect(解析游戏主题(默认设置, "极光原野@配色=暖纸古典;方块=像素").选项.配色).toBe("暖纸古典");
  const 暖纸 = 解析游戏主题(默认设置, "待分类@配色=暖纸古典;方块=像素");
  expect(暖纸.槽位.find((项) => 项.槽位.编号 === "界面配色")?.资源.值).toBe("暖纸古典");
  expect(暖纸.槽位.find((项) => 项.槽位.编号 === "方块外观")?.资源.值).toBe("像素");
  const 默认音效 = 列表(默认, "音效")[0].试听?.条目 ?? [];
  expect(默认音效).toContain("再消一行.移动");
  expect(默认音效).not.toContain("旅行.成都熊猫.移动");
  expect(列表(默认, "音乐")[0].试听?.条目).toEqual(["再消一行.菜单", "再消一行.对局"]);
});

test("主题选择串可往返，非法串和未知选项被拒绝", () => {
  expect(解析主题选择("极光原野")).toEqual({ 主题: "极光原野", 选项: {} });
  expect(解析主题选择("极光原野@配色=暖纸古典;方块=像素")).toEqual({
    主题: "极光原野",
    选项: { 配色: "暖纸古典", 方块: "像素" },
  });
  expect(读取当前主题选择(默认设置)).toBe(默认主题编号);
  for (const 串 of ["@配色=暖纸古典", "极光原野@配色", "极光原野@配色=A;配色=B"]) {
    expect(() => 解析主题选择(串)).toThrow();
  }
  expect(() => 解析游戏主题(默认设置, `${默认主题编号}@配色=不存在`)).toThrow("未知主题选项");
  expect(() => 解析游戏主题(默认设置, "不存在的主题")).toThrow("未知主题");
});

test("旅行主题自带全套维度，应用后设置与配色一致", () => {
  const 旅行 = 主题结果转设置(默认设置, 解析游戏主题(默认设置, "成都熊猫"));
  expect([旅行.背景主题, 旅行.旅行样式, 旅行.方块外观, 旅行.旅行音效, 旅行.旅行音乐]).toEqual(
    Array(5).fill("成都熊猫"),
  );
  expect(创建游戏主题(旅行).名称).toBe("成都熊猫");
  expect(创建游戏主题(旅行).颜色.面板).toBe(
    Number.parseInt(界面主题("成都熊猫").面板.主面板.背景.slice(1), 16),
  );
});

test("读取可选主题不含待分类，已保存选择仍可解析", () => {
  const 目录 = 读取游戏主题目录();
  const 可选 = 读取可选主题(目录).map((项) => 项.编号);
  expect(可选).toEqual(["砖机液晶", "街机彩砖", "立体晶格", "极光原野"]);
  expect(可选).not.toContain("待分类");
  for (const 地点 of 地点皮肤表) expect(可选).not.toContain(地点.名称);
  const 暖纸 = 解析游戏主题(默认设置, "待分类@配色=暖纸古典");
  expect(暖纸.主题).toBe("待分类");
  expect(暖纸.槽位.find((项) => 项.槽位.编号 === "界面配色")?.资源.值).toBe("暖纸古典");
});

test("旧存档的局部设置仍按槽位解析，且不改输入", () => {
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
  // 预览声明成都熊猫但页面内改过音乐，运行结果如实报告为局部覆盖。
  const 预览 = 读取预览主题解析(
    { 资源主题: "成都熊猫" },
    { ...主题结果转设置(默认设置, 解析游戏主题(默认设置, "成都熊猫")), 旅行音乐: "丽江雪山" },
  );
  expect(预览.主题).toBe("成都熊猫");
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

test("完整主题下只改动态背景不卸载主题选择", () => {
  const 执行 = Bun.spawnSync(
    [
      process.execPath,
      "-e",
      `
    import assert from 'node:assert/strict';
    const data = new Map();
    globalThis.localStorage = {get length(){return data.size}, getItem:k=>data.get(k)??null, setItem:(k,v)=>data.set(k,String(v)), removeItem:k=>data.delete(k), clear:()=>data.clear(), key:i=>[...data.keys()][i]??null};
    globalThis.window = new EventTarget();
    const {获取游戏设置,更新游戏设置}=await import('./代码/设置/游戏设置.ts');
    const 穿上=更新游戏设置({主题选择:'砖机液晶'});
    assert.equal(穿上.主题选择,'砖机液晶');
    assert.equal(穿上.样式,'砖机液晶');
    assert.equal(穿上.方块外观,'砖机液晶');
    const 关=更新游戏设置({背景动态:false});
    assert.equal(关.主题选择,'砖机液晶');
    assert.equal(关.背景动态,false);
    const 开=更新游戏设置({背景动态:true});
    assert.equal(开.主题选择,'砖机液晶');
    assert.equal(开.背景动态,true);
    const 切回=更新游戏设置({主题选择:'极光原野'});
    assert.equal(切回.主题选择,'极光原野');
    assert.equal(切回.样式,'极光原野');
    assert.equal(切回.方块外观,'极光原野');
    assert.equal(更新游戏设置({样式:'暖纸古典'}).主题选择,null);
    assert.equal(获取游戏设置().主题选择,null);
  `,
    ],
    { cwd: resolve(import.meta.dir, ".."), stdout: "pipe", stderr: "pipe" },
  );
  expect(new TextDecoder().decode(执行.stderr)).toBe("");
  expect(执行.exitCode).toBe(0);
});

test("游戏启动时读取并迁移旧配色和方块设置", () => {
  const 执行 = Bun.spawnSync(
    [
      process.execPath,
      "-e",
      `
      import assert from 'node:assert/strict';
      const data = new Map([
        ['gamemaker:settings', JSON.stringify({样式:'青蓝未来', 音效音量:25})],
        ['再消一行:设置', JSON.stringify({方块外观:'默认', 显示网格:false})],
      ]);
      globalThis.localStorage = {getItem:k=>data.get(k)??null, setItem:(k,v)=>data.set(k,String(v)), removeItem:k=>data.delete(k)};
      const {获取游戏设置}=await import('./代码/设置/游戏设置.ts');
      const 设置=获取游戏设置();
      assert.equal(设置.样式,'极光原野');
      assert.equal(设置.方块外观,'极光原野');
      assert.equal(设置.音效音量,25);
      assert.equal(设置.显示网格,false);
      assert.equal(JSON.parse(data.get('gamemaker:settings')).样式,'极光原野');
      assert.equal(JSON.parse(data.get('再消一行:设置')).方块外观,'极光原野');
    `,
    ],
    { cwd: resolve(import.meta.dir, ".."), stdout: "pipe", stderr: "pipe" },
  );
  expect(new TextDecoder().decode(执行.stderr)).toBe("");
  expect(执行.exitCode).toBe(0);
});
