import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { chromium } from "playwright";

declare global {
  interface Window {
    __图章销毁后?: { 数量: number; 像素数: number; 引用数: number };
    __图章验收?: {
      初始: {
        同一缓存: boolean;
        共用纹理: boolean;
        不同帧: boolean;
        超大独立: boolean;
        在用拒绝移除: boolean;
        统计: Record<string, number>;
      };
      清理(): { 已移除: boolean; 重建: boolean; 满页回退: boolean; 异常已清理: boolean };
    };
  }
}

const 输出 = resolve("reports/stamp-cache");
await mkdir(输出, { recursive: true });
const 临时 = await mkdtemp(join(tmpdir(), "gm-stamp-"));
const 根 = resolve(".");
const 入口 = join(临时, "fixture.ts");
await writeFile(
  入口,
  `
import Phaser from ${JSON.stringify(join(根, "node_modules/phaser/dist/phaser.esm.js"))};
import { 获取烘焙贴图, 烘焙统计 } from ${JSON.stringify(join(根, "代码/性能/图形烘焙.ts"))};
import { 获取纹理预算 } from ${JSON.stringify(join(根, "代码/性能/纹理缓存.ts"))};
import { 创建图像池 } from ${JSON.stringify(join(根, "代码/视觉/图像池.ts"))};
class 场景 extends Phaser.Scene {
 create() {
  const 绘制 = g => g.fillGradientStyle(0xff0000,0x00ff00,0x0000ff,0xffffff,1).fillRect(0,0,40,40);
  this.add.graphics({x:20,y:30}).fillGradientStyle(0xff0000,0x00ff00,0x0000ff,0xffffff,1).fillRect(0,0,40,40);
  const 初 = 获取烘焙贴图(this,"验收.渐变",绘制);
  const 重 = 获取烘焙贴图(this,"验收.渐变",绘制);
  const 绿 = 获取烘焙贴图(this,"验收.绿色",g => g.fillStyle(0x00ff00).fillRect(0,0,40,40));
  const 大 = 获取烘焙贴图(this,"验收.超大",g => g.fillStyle(0xff0000).fillRect(0,0,1100,4));
  if (!初 || !重 || !绿 || !大) throw Error("烘焙失败");
  const 图 = this.add.image(180,30,初.键,初.帧);
  图.setOrigin(-初.左*初.比/图.width,-初.顶*初.比/图.height).setScale(1/初.比);
  const 绿图 = this.add.image(180,100,绿.键,绿.帧);
  绿图.setOrigin(-绿.左*绿.比/绿图.width,-绿.顶*绿.比/绿图.height).setScale(1/绿.比);
  const 预算 = 获取纹理预算(this);
  const 放开 = 预算.引用(初.键);
  const 池=创建图像池(this,this.add.container());
  池.开始();池.放置("验收.池红",g=>g.fillStyle(0xff0000).fillRect(0,0,40,40),20,180);池.结束();
  池.开始();池.放置("验收.池绿",g=>g.fillStyle(0x00ff00).fillRect(0,0,40,40),20,180);池.结束();
  const 初始 = {同一缓存:初===重,共用纹理:初.键===绿.键,不同帧:初.帧!==绿.帧,超大独立:大.键!==初.键,在用拒绝移除:!预算.移除(初.键),统计:{...烘焙统计}};
  Object.assign(window,{__图章验收:{初始,清理:()=>{
   图.destroy();绿图.destroy();放开();池.销毁();
   const 保留=[];
   for(let i=0;i<3;i++) {
    const 贴=获取烘焙贴图(this,"验收.占页"+i,g=>g.fillStyle(0xff0000).fillRect(0,0,900,900));
    if(!贴) throw Error("占页失败");
    保留.push(预算.引用(贴.键));
   }
   const 满=获取烘焙贴图(this,"验收.满页",g=>g.fillStyle(0x00ff00).fillRect(0,0,900,900));
   const 满页回退=!!满&&满.帧===undefined;
   for(const 释放 of 保留) 释放();
   let 异常已清理=false;
   try { 获取烘焙贴图(this,"验收.异常",g=>{g.once("destroy",()=>异常已清理=true);throw Error("故意绘制失败");}); } catch(错) { if(错.message!=="故意绘制失败") throw 错; }
   const 已移除=预算.移除(初.键);
   const 再=获取烘焙贴图(this,"验收.渐变",绘制);
   const 重建=!!再&&再.键!==初.键&&this.textures.get(再.键).has(再.帧);
   const 游戏=this.game;
   游戏.events.once("destroy",()=>Object.assign(window,{__图章销毁后:预算.获取统计()}));
   游戏.destroy(true);
   return {已移除,重建,满页回退,异常已清理};
  }}});
 }
}
new Phaser.Game({type:Phaser.WEBGL,width:390,height:844,backgroundColor:"#000000",scene:场景,audio:{noAudio:true}});
`,
);
const 构建 = await Bun.build({
  entrypoints: [入口],
  target: "browser",
  plugins: [
    {
      name: "phaser",
      setup(构建器) {
        构建器.onResolve({ filter: /^phaser$/ }, () => ({
          path: join(根, "node_modules/phaser/dist/phaser.esm.js"),
        }));
      },
    },
  ],
});
assert.ok(构建.success, 构建.logs.join("\n"));
const 脚本 = await 构建.outputs[0].text();
const 服务 = Bun.serve({
  hostname: "127.0.0.1",
  port: 0,
  fetch: (请求) =>
    new URL(请求.url).pathname === "/fixture.js"
      ? new Response(脚本, { headers: { "Content-Type": "text/javascript; charset=utf-8" } })
      : new Response(
          '<html><body style="margin:0"><script src="/fixture.js"></script></body></html>',
          { headers: { "Content-Type": "text/html; charset=utf-8" } },
        ),
});
const 浏览器 = await chromium.launch({ channel: "chrome" });
try {
  const 页 = await 浏览器.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  const 错误: string[] = [];
  页.on("pageerror", (错) => 错误.push(错.message));
  await 页.goto(服务.url.href);
  await 页
    .waitForFunction(() => "__图章验收" in window, undefined, { timeout: 10000 })
    .catch((错) => {
      throw new Error(`${错}\n${错误.join("\n")}`);
    });
  await 页.waitForTimeout(100);
  const 截图 = await 页.screenshot({ path: join(输出, "渐变与图集.png") });
  const 像素 = await 页.evaluate(async (数据) => {
    const 位图 = await createImageBitmap(
      await (await fetch(`data:image/png;base64,${数据}`)).blob(),
    );
    const 画布 = new OffscreenCanvas(390, 844);
    const 图 = 画布.getContext("2d");
    if (!图) throw Error("缺少绘图上下文");
    图.drawImage(位图, 0, 0);
    let 最大色差 = 0;
    for (const [x, y] of [
      [5, 5],
      [30, 5],
      [5, 30],
      [30, 30],
      [20, 20],
    ]) {
      const 原 = 图.getImageData(20 + x, 30 + y, 1, 1).data;
      const 缓 = 图.getImageData(180 + x, 30 + y, 1, 1).data;
      for (let i = 0; i < 3; i++) 最大色差 = Math.max(最大色差, Math.abs(原[i] - 缓[i]));
    }
    return {
      最大色差,
      绿色: Array.from(图.getImageData(200, 120, 1, 1).data),
      换帧绿色: Array.from(图.getImageData(40, 200, 1, 1).data),
    };
  }, 截图.toString("base64"));
  assert.ok(像素.最大色差 <= 3, JSON.stringify(像素));
  assert.ok(像素.绿色[1] > 240 && 像素.绿色[0] < 5 && 像素.绿色[2] < 5);
  assert.ok(像素.换帧绿色[1] > 240 && 像素.换帧绿色[0] < 5 && 像素.换帧绿色[2] < 5);
  const 结果 = await 页.evaluate(() => {
    const 验收 = window.__图章验收;
    if (!验收) throw Error("缺少图章验收接口");
    return { 初始: 验收.初始, 清理: 验收.清理() };
  });
  for (const 名 of ["同一缓存", "共用纹理", "不同帧", "超大独立", "在用拒绝移除"] as const)
    assert.equal(结果.初始[名], true, 名);
  assert.deepEqual(结果.清理, { 已移除: true, 重建: true, 满页回退: true, 异常已清理: true });
  assert.deepEqual(错误, []);
  await 页.waitForFunction(() => window.__图章销毁后?.数量 === 0);
  const 销毁后 = await 页.evaluate(() => window.__图章销毁后);
  assert.deepEqual(销毁后, { 数量: 0, 像素数: 0, 引用数: 0 });
  await writeFile(join(输出, "结果.json"), JSON.stringify({ 结果, 像素, 错误 }, null, 2));
  console.log(JSON.stringify({ 结果, 像素, 错误 }));
} finally {
  await 浏览器.close();
  服务.stop(true);
  await rm(临时, { recursive: true, force: true });
}
