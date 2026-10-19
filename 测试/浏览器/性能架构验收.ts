import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";
import { 创建Phaser构建插件 } from "../../运行/Phaser构建";

const 输出 = "reports/performance-iteration";
await mkdir(输出, { recursive: true });
const 入口 = `${输出}/架构样本.ts`;
await writeFile(
  入口,
  `
import Phaser from "phaser";
import {安装图形烘焙, 获取烘焙贴图, 引用烘焙贴图} from "../../代码/性能/图形烘焙";
import {安装按需渲染, 标记重绘, 渲染统计} from "../../代码/性能/按需渲染";
import {获取纹理预算} from "../../代码/性能/纹理缓存";
const 原清空 = Phaser.GameObjects.Graphics.prototype.clear;
const 原文字 = Phaser.GameObjects.Text.prototype.updateText;
const 原渲染 = Reflect.get(Phaser.GameObjects.Graphics.prototype, 'renderWebGL');
let 游戏, 场景, 图, 图形;
function 创建() {
  游戏 = new Phaser.Game({type:Phaser.WEBGL,width:390,height:844,audio:{noAudio:true},
    scene:{create(){场景=this; 图形=this.add.graphics().fillStyle(0xffffff).fillRect(0,0,80,80);
      const 容器=this.add.container();setTimeout(()=>容器.add(this.make.graphics({},false).fillStyle(0xffffff).fillRect(5,5,20,20)),50);
      const 圆=this.add.circle(30,30,10,0xffffff);setTimeout(()=>圆.destroy(),100);
      图=this.add.image(100,100,'__WHITE').setDisplaySize(30,30);}}});
  安装图形烘焙(游戏); 安装按需渲染(游戏);
}
Object.assign(window,{验收:{创建,读取:()=>({场景:!!场景?.sys?.isActive(),
  原型未变:原清空===Phaser.GameObjects.Graphics.prototype.clear && 原文字===Phaser.GameObjects.Text.prototype.updateText && 原渲染===Reflect.get(Phaser.GameObjects.Graphics.prototype,'renderWebGL'),
  实例绑定:Object.hasOwn(图形,'clear') && Object.hasOwn(图形,'renderWebGL'),
  后添绑定:场景?.children?.list.filter(n=>n.type==='Container').every(n=>n.list.length>0 && Object.hasOwn(n.list[0],'renderWebGL')),
  渲染:渲染统计.渲染,预算:场景?.sys?.isActive()?获取纹理预算(场景).获取统计():null}),
  改变:(项)=>{if(项==='位置')图.x+=10;if(项==='透明度')图.alpha=.5;if(项==='可见')图.visible=false;},
  刷新:标记重绘,
  缓存:()=>{
    const 首=获取烘焙贴图(场景,'在用测试',g=>g.fillStyle(0xffffff).fillRect(0,0,2000,600));
    const 保留=new Phaser.GameObjects.Image(场景,0,0,首.键);引用烘焙贴图(保留);
    const 键=[];
    for(let i=0;i<36;i++)键.push(获取烘焙贴图(场景,'循环'+i,g=>g.fillStyle(i).fillRect(0,0,2000+i,600))?.键);
    const 结果={统计:获取纹理预算(场景).获取统计(),在用存在:场景.textures.exists(首.键),淘汰:!场景.textures.exists(键[0])};
    保留.destroy();return 结果;
  },
  销毁:()=>new Promise(resolve=>{const 预算=获取纹理预算(场景);游戏.events.once('destroy',()=>queueMicrotask(()=>resolve(预算.获取统计())));游戏.destroy(true);游戏.loop.wake();})
}});创建();`,
);
const 构建 = await Bun.build({
  entrypoints: [入口],
  target: "browser",
  plugins: [创建Phaser构建插件()],
});
assert.ok(构建.success, String(构建.logs));
const 脚本 = await 构建.outputs[0].text();
const 服务 = Bun.serve({
  hostname: "127.0.0.1",
  port: 0,
  fetch: (请求) =>
    new URL(请求.url).pathname === "/app.js"
      ? new Response(脚本, { headers: { "Content-Type": "text/javascript" } })
      : new Response('<!doctype html><script type="module" src="/app.js"></script>', {
          headers: { "Content-Type": "text/html" },
        }),
});
const 浏览器 = await chromium.launch({ channel: "chrome" });
const 页 = await 浏览器.newPage({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
});
const 错误: string[] = [];
页.on("pageerror", (错) => 错误.push(错.message));
// 此入口是测试夹具，不向正式游戏增加调试API。
type 接口 = {
  创建(): void;
  读取(): {
    场景: boolean;
    原型未变: boolean;
    实例绑定: boolean;
    后添绑定: boolean;
    渲染: number;
    预算: { 数量: number };
  };
  改变(项: string): void;
  刷新(): void;
  缓存(): { 统计: { 像素数: number; 数量: number }; 在用存在: boolean; 淘汰: boolean };
  销毁(): Promise<{ 像素数: number; 数量: number; 引用数: number }>;
};
declare global {
  interface Window {
    验收: 接口;
  }
}
const 结果 = [];
try {
  await 页.goto(服务.url.href);
  for (let 轮 = 0; 轮 < 2; 轮++) {
    await 页.waitForFunction(() => window.验收?.读取().场景);
    await 页.waitForTimeout(450);
    const 初始 = await 页.evaluate(() => window.验收.读取());
    assert.ok(初始.原型未变 && 初始.实例绑定, "原型保持原样，实例实际接入");
    assert.ok(初始.后添绑定, "容器后添加的离屏对象也绑定实例");
    assert.ok(初始.预算.数量 > 0, "实际渲染步骤走入静态烘焙");
    for (const 项 of ["位置", "透明度", "可见"]) {
      await 页.evaluate(() => window.验收.刷新());
      await 页.waitForTimeout(130);
      const 前 = await 页.evaluate(() => window.验收.读取().渲染);
      await 页.evaluate((项) => window.验收.改变(项), 项);
      await 页.waitForTimeout(150);
      assert.ok(
        (await 页.evaluate(() => window.验收.读取().渲染)) > 前,
        `${项}变化无需等待500ms保底`,
      );
    }
    const 缓存 = await 页.evaluate(() => window.验收.缓存());
    assert.ok(缓存.统计.像素数 <= 24 * 1024 * 1024 && 缓存.统计.数量 <= 160);
    assert.ok(缓存.在用存在 && 缓存.淘汰, "真实纹理循环淘汰且在用受保护");
    const 销毁 = await 页.evaluate(() => window.验收.销毁());
    assert.deepEqual(销毁, { 数量: 0, 像素数: 0, 引用数: 0 });
    结果.push({ 轮, 初始, 缓存, 销毁 });
    if (轮 === 0) await 页.evaluate(() => window.验收.创建());
  }
  assert.deepEqual(错误, []);
  await writeFile(`${输出}/架构验收.json`, JSON.stringify({ 结果, 错误 }, null, 2));
  console.log(JSON.stringify(结果));
} finally {
  await 浏览器.close();
  服务.stop(true);
}
