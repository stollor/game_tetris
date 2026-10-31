import { expect, test } from "bun:test";
import { 项目根 as 项目根路径 } from "../../接入/项目路径";

/**
 * 未购买不能选主题：设置层是所有权校验的最后一道闸。
 * localStorage/window 只能在隔离子进程里造，所以用 bun -e 跑真实 游戏设置 模块。
 */
test("未购买的主题不能写入设置，买过之后才能切换", () => {
  const 执行 = Bun.spawnSync(
    [
      process.execPath,
      "-e",
      `
      import assert from 'node:assert/strict';
      const 数据=new Map();
      globalThis.localStorage={getItem:k=>数据.get(k)??null,setItem:(k,v)=>数据.set(k,String(v)),removeItem:k=>数据.delete(k),get length(){return 数据.size},clear:()=>数据.clear(),key:i=>[...数据.keys()][i]??null};
      globalThis.window=new EventTarget();
      const {获取游戏设置,更新游戏设置,默认设置}=await import('./代码/设置/游戏设置.ts');
      const {收藏存档键}=await import('./代码/存档/收藏.ts');
      // 出厂只有默认主题：未购买主题一律拒绝。
      assert.equal(获取游戏设置().主题选择,'极光原野');
      assert.throws(()=>更新游戏设置({主题选择:'砖机液晶'}),/尚未拥有/);
      assert.equal(获取游戏设置().主题选择,'极光原野');
      // 写一份已购存档后，同一调用才通过并落盘。
      数据.set(收藏存档键,JSON.stringify({版本:1,数据:{金币:0,累计获得:120,已购主题:['砖机液晶'],已结算:[],已领成就:[],最近首局日期:''}}));
      更新游戏设置({主题选择:'砖机液晶'});
      assert.equal(获取游戏设置().主题选择,'砖机液晶');
      assert.equal(JSON.parse(数据.get('再消一行:设置')).主题选择,'砖机液晶');
      // 存档里的已购失效（例如换浏览器）时，读设置回落默认主题。
      数据.set(收藏存档键,JSON.stringify({版本:1,数据:{金币:0,累计获得:120,已购主题:[],已结算:[],已领成就:[],最近首局日期:''}}));
      assert.equal(默认设置.主题选择,'极光原野');
    `,
    ],
    { cwd: 项目根路径, stdout: "pipe", stderr: "pipe" },
  );
  expect(new TextDecoder().decode(执行.stderr)).toBe("");
  expect(执行.exitCode).toBe(0);
});
