import { expect, test } from "bun:test";
import { 项目根 as 项目根路径 } from "../接入/项目路径";

test("真实设置读取配置表完整主题；已有玩家偏好保留且预览目录绑定真实字段", () => {
  for (const 情况 of ["新玩家", "玩家偏好", "保存的项目默认"]) {
    const 已有 = 情况 === "玩家偏好";
    const 执行 = Bun.spawnSync(
      [
        process.execPath,
        "-e",
        `
      import assert from 'node:assert/strict';
      import {mock} from 'bun:test';
      import {resolve} from 'node:path';
      const 配置=await Bun.file('./配置/配置表.json').json();
      const 表=配置.表.find(x=>x.id==='presentation');
      assert(表,'配置表缺少正式主题字段');
      表.值.默认主题='成都熊猫';
      mock.module(resolve('./配置/配置表.json'),()=>({default:配置}));
      const 数据=new Map(${已有 ? `[['gamemaker:settings',JSON.stringify({样式:'暖纸古典',音效音量:25})],['再消一行:设置',JSON.stringify({背景主题:'极光原野',方块外观:'极光原野',显示网格:false})]]` : 情况 === "保存的项目默认" ? `[['再消一行:设置',JSON.stringify({旅行样式:'成都熊猫',旅行音乐:'成都熊猫',旅行音效:'成都熊猫',背景主题:'成都熊猫',方块外观:'成都熊猫'})]]` : "[]"});
      globalThis.localStorage={getItem:k=>数据.get(k)??null,setItem:(k,v)=>数据.set(k,String(v)),removeItem:k=>数据.delete(k)};
      const {获取游戏设置,读取项目默认设置}=await import('./代码/设置/游戏设置.ts');
      const {读取游戏主题目录}=await import('./资源/主题/主题组合.ts');
      const 默认=读取项目默认设置();
      for(const 键 of ['背景主题','方块外观','旅行样式','旅行音乐','旅行音效']) assert.equal(默认[键],'成都熊猫');
      const 设置=获取游戏设置();
      ${已有 ? `assert.equal(设置.样式,'暖纸古典');assert.equal(设置.音效音量,25);assert.equal(设置.背景主题,'极光原野');assert.equal(设置.方块外观,'极光原野');assert.equal(设置.显示网格,false);` : `for(const 键 of ['背景主题','方块外观','旅行样式','旅行音乐','旅行音效']) assert.equal(设置[键],'成都熊猫');assert.equal(数据.has("gamemaker:settings"),false);`}
      assert.deepEqual(读取游戏主题目录().游戏应用,{表:'presentation',字段:'默认主题'});
      globalThis.window=new EventTarget();
      const {更新游戏设置}=await import('./代码/设置/游戏设置.ts');
      更新游戏设置({音效音量:37,语言:'English'});
      assert.equal(获取游戏设置().音效音量,37);
      assert.equal(获取游戏设置().语言,'English');
    `,
      ],
      { cwd: 项目根路径, stdout: "pipe", stderr: "pipe" },
    );
    expect(new TextDecoder().decode(执行.stderr)).toBe("");
    expect(执行.exitCode).toBe(0);
  }
});
