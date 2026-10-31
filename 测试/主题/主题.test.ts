import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { 夜空鎏金 } from "../../.gamemaker/依赖/框架/样式/夜空鎏金";
import { 暖纸古典 } from "../../.gamemaker/依赖/框架/样式/暖纸古典";
import { 获取游戏主题 } from "../../.gamemaker/依赖/框架/样式/样式";
import { 青蓝未来 } from "../../.gamemaker/依赖/框架/样式/青蓝未来";
import { 计算颜色对比度 } from "../../.gamemaker/依赖/框架/界面/颜色工具";
import {
  查找默认主题,
  解析主题选择,
  诊断主题组合,
  读取可选主题,
} from "../../.gamemaker/依赖/框架/设置/主题组合";
import { 音乐库 } from "../../代码/框架配置/音乐";
import { type 游戏设置, 默认设置 } from "../../代码/设置/游戏设置";
import { 主题列表, type 主题名, 是主题名, 默认主题 } from "../../代码/项目配置/主题目录";
import {
  主题结果转设置,
  解析游戏主题,
  读取当前主题选择,
  读取有效游戏主题,
  读取游戏主题目录,
  默认主题编号,
} from "../../资源/主题/主题组合";
import { 创建游戏主题 } from "../../资源/主题/游戏主题";
import { 再消一行主题 } from "../../资源/主题/配色/基础配色";
import { 项目根 as 项目根路径 } from "../接入/项目路径";

/** 契约固定的 13 个槽位。 */
const 槽位顺序 = [
  "界面配色",
  "控件外观",
  "静态背景",
  "动态背景",
  "方块外观",
  "音效套装",
  "背景音乐",
  "视觉特效",
  "棋盘表现",
  "界面表现",
  "字体",
  "仪表纹样",
  "仪表表现",
];

/** 四套主题的槽位映射：这是给玩家的最终外观承诺，改主题必须同步这里。 */
const 期望映射: Record<主题名, Record<string, string | null>> = {
  极光原野: {
    界面配色: "极光原野",
    控件外观: "极光原野",
    静态背景: "极光原野",
    动态背景: "极光原野",
    方块外观: "极光原野",
    音效套装: null,
    背景音乐: null,
    视觉特效: "默认",
    棋盘表现: "平面",
    界面表现: "霓虹",
    字体: "默认",
    仪表纹样: "灯条",
    仪表表现: "装置",
  },
  砖机液晶: {
    界面配色: "砖机液晶",
    控件外观: "砖机液晶",
    静态背景: "砖机液晶",
    动态背景: "砖机液晶",
    方块外观: "砖机液晶",
    音效套装: "砖机液晶",
    背景音乐: "砖机液晶",
    视觉特效: "像素",
    棋盘表现: "平面",
    界面表现: "像素",
    字体: "像素",
    仪表纹样: "平涂",
    仪表表现: "像素",
  },
  街机彩砖: {
    界面配色: "街机彩砖",
    控件外观: "街机彩砖",
    静态背景: "街机彩砖",
    动态背景: "街机彩砖",
    方块外观: "街机彩砖",
    音效套装: "街机彩砖",
    背景音乐: "街机彩砖",
    视觉特效: "像素",
    棋盘表现: "平面",
    界面表现: "像素",
    字体: "像素",
    仪表纹样: "平涂",
    仪表表现: "像素",
  },
  立体晶格: {
    // 立体晶格没有独立配色，界面配色沿用极光原野，靠界面表现切立体机架（既有设计）。
    界面配色: "极光原野",
    控件外观: "极光原野",
    静态背景: "立体晶格",
    动态背景: "立体晶格",
    方块外观: "立体晶格",
    音效套装: null,
    背景音乐: null,
    视觉特效: "透视",
    棋盘表现: "透视",
    界面表现: "立体",
    字体: "默认",
    仪表纹样: "灯条",
    仪表表现: "装置",
  },
};

const 槽值 = (结果: ReturnType<typeof 解析游戏主题>) =>
  Object.fromEntries(结果.槽位.map((项) => [项.槽位.编号, 项.资源.值]));

// ── 基础配色 ──
describe("界面主题", () => {
  test("三套项目主题同步框架控件，保留通用主题，并保持正文与按钮可读", () => {
    for (const [名称, 原主题] of [
      ["夜空鎏金", 夜空鎏金],
      ["暖纸古典", 暖纸古典],
      ["极光原野", 青蓝未来],
    ] as const) {
      const 主题 = 再消一行主题[名称];
      expect(获取游戏主题(名称)).toBe(主题);
      expect(主题).not.toBe(原主题);
      expect(主题.页面.背景).not.toBe(原主题.页面.背景);
      for (const 文字 of [主题.文字.主要, 主题.文字.次要, 主题.文字.弱化, 主题.文字.强调]) {
        expect(计算颜色对比度(文字, 主题.面板.主面板.背景)).toBeGreaterThanOrEqual(4.5);
      }
      // 禁用态按 WCAG 属于非活动控件的例外，不要求 4.5；保留 2.0 下限，避免文字彻底看不清。
      for (const 类别 of [主题.按钮.主要, 主题.按钮.次要]) {
        for (const 状态 of [类别.默认, 类别.移入, 类别.点击])
          expect(计算颜色对比度(状态.文字, 状态.背景)).toBeGreaterThanOrEqual(4.5);
        expect(计算颜色对比度(类别.禁用.文字, 类别.禁用.背景)).toBeGreaterThanOrEqual(2);
      }
    }
  });

  test("Three 界面预览使用真实配色但不改游戏设置", () => {
    const 设置 = { ...默认设置 };
    const 预览 = 创建游戏主题(设置, "暖纸古典");

    expect(预览.名称).toBe("暖纸古典");
    expect(预览.颜色.底色).toBe(0xe5c98f);
    expect(设置).toEqual(默认设置);
  });
});

// ── 主题组合 ──
describe("主题组合", () => {
  test("目录只有四套完整主题，槽位固定 13 个且没有脱离主题的资源", () => {
    const 目录 = 读取游戏主题目录();
    expect(诊断主题组合(目录)).toEqual([]);
    expect(目录.主题.map((项) => 项.编号)).toEqual([...主题列表]);
    expect(目录.槽位.map((项) => 项.编号)).toEqual(槽位顺序);
    for (const 槽 of 目录.槽位) expect(槽.契约).toBe(`${槽.编号}.v1`);
    // 恰好一个默认主题，且覆盖全部槽位。
    expect(目录.主题.filter((项) => 项.默认).map((项) => 项.编号)).toEqual([默认主题编号]);
    const 默认 = 查找默认主题(目录);
    expect(默认?.编号).toBe(默认主题);
    expect(默认?.维度.flatMap((项) => 项.槽位).sort()).toEqual([...槽位顺序].sort());
    expect(默认主题编号).toBe(默认主题);
    // 每套主题只有「整套」一个维度，维度里只有一个同名选项，不再提供单项混搭。
    for (const 主题 of 目录.主题) {
      expect(是主题名(主题.编号)).toBe(true);
      if (!是主题名(主题.编号)) continue;
      expect(主题.维度).toHaveLength(1);
      expect(主题.维度[0]?.编号).toBe("整套");
      expect(主题.维度[0]?.选项.map((项) => 项.编号)).toEqual([主题.编号]);
      expect(主题.维度[0]?.选项[0]?.覆盖).toEqual(
        Object.fromEntries(
          Object.entries(期望映射[主题.编号]).map(([槽, 值]) => [
            槽,
            值 === null ? `${槽}.默认` : `${槽}.${值}`,
          ]),
        ),
      );
    }
    // 同一目录被反复读取时复用缓存。
    expect(读取游戏主题目录()).toBe(目录);
  });

  test("四套主题的槽位映射与契约一致，来源都是主题而不是游离默认", () => {
    for (const 名称 of 主题列表) {
      const 结果 = 解析游戏主题(默认设置, 名称);
      expect(结果.主题).toBe(名称);
      expect(结果.槽位.map((项) => 项.槽位.编号)).toEqual(槽位顺序);
      expect(槽值(结果)).toEqual(期望映射[名称]);
      for (const 项 of 结果.槽位) expect(项.来源).toBe("主题");
    }
  });

  test("主题结果写回设置：主题选择、框架样式与动态开关", () => {
    for (const 名称 of 主题列表) {
      const 设置 = 主题结果转设置(默认设置, 解析游戏主题(默认设置, 名称));
      expect(设置.主题选择).toBe(名称);
      // 立体晶格沿用极光原野配色，其余主题的样式就是主题名。
      expect(设置.样式).toBe(名称 === "立体晶格" ? "极光原野" : 名称);
      expect(设置.背景动态).toBe(true);
    }
    expect(读取当前主题选择(默认设置)).toBe(默认主题编号);
    for (const 名称 of 主题列表) {
      expect(读取当前主题选择({ ...默认设置, 主题选择: 名称 })).toBe(名称);
    }
  });

  test("关闭动态层只局部覆盖动态背景，主题选择不丢", () => {
    for (const 名称 of 主题列表) {
      const 设置: 游戏设置 = { ...默认设置, 主题选择: 名称, 背景动态: false };
      const 结果 = 解析游戏主题(设置);
      expect(结果.主题).toBe(名称);
      const 动态 = 结果.槽位.find((项) => 项.槽位.编号 === "动态背景");
      expect(动态?.资源.值).toBeNull();
      expect(动态?.来源).toBe("局部");
      for (const 项 of 结果.槽位.filter((项) => 项.槽位.编号 !== "动态背景"))
        expect(项.来源).toBe("主题");
      const 回写 = 主题结果转设置(设置, 结果);
      expect(回写.主题选择).toBe(名称);
      expect(回写.背景动态).toBe(false);
    }
  });

  test("四套主题各自登记真实源码，资源文件都存在于工程里", () => {
    const 目录 = 读取游戏主题目录();
    for (const 资源 of 目录.资源) {
      expect(资源.源码.length).toBeGreaterThan(0);
      for (const 源 of 资源.源码)
        expect(existsSync(join(项目根路径, 源.路径)), `${资源.编号} → ${源.路径}`).toBe(true);
    }
    // 像素与立体的背景/界面表现指向各自专属配方，不共用极光原野内置风景。
    const 源 = (编号: string) => 目录.资源.find((项) => 项.编号 === 编号)?.源码[0];
    expect(源("静态背景.街机彩砖")).toMatchObject({
      路径: "资源/视效/背景/街机彩砖背景.ts",
      导出: "绘制街机彩砖背景",
    });
    expect(源("静态背景.砖机液晶")).toMatchObject({
      路径: "资源/视效/背景/像素背景.ts",
      导出: "绘制像素背景",
    });
    for (const 槽 of ["静态背景", "动态背景"])
      expect(源(`${槽}.立体晶格`)?.路径).toBe("资源/视效/背景/立体晶格背景.ts");
    expect(源("界面表现.立体")?.导出).toBe("是立体风格");
    expect(源("界面表现.像素")?.导出).toBe("是像素风格");
  });

  test("每套主题的试听曲目都在音乐库里有真实条目", () => {
    const 已知 = new Set(音乐库.map((项) => 项.id));
    for (const 主题 of 读取游戏主题目录().主题) {
      const 试听 = 主题.维度[0]?.选项[0]?.试听;
      expect(试听?.类型).toBe("音乐");
      expect(试听?.条目?.length).toBeGreaterThan(0);
      for (const id of 试听?.条目 ?? []) expect(已知.has(id), id).toBe(true);
    }
  });

  test("读取可选主题就是四套主题，未知主题与未知选项被拒绝", () => {
    const 目录 = 读取游戏主题目录();
    expect(读取可选主题(目录).map((项) => 项.编号)).toEqual([...主题列表]);
    expect(可选主题不含旧外观()).toBe(true);
    for (const 串 of ["@整套=极光原野", "极光原野@整套", "极光原野@整套=极光原野;整套=砖机液晶"]) {
      expect(() => 解析主题选择(串)).toThrow();
    }
    expect(() => 解析游戏主题(默认设置, "成都熊猫")).toThrow("未知主题");
    expect(() => 解析游戏主题(默认设置, `${默认主题编号}@整套=不存在`)).toThrow("未知主题选项");
  });

  test("相同设置复用解析结果，换主题后重新解析", () => {
    const 甲 = 读取有效游戏主题({ ...默认设置, 主题选择: "砖机液晶" });
    expect(读取有效游戏主题({ ...默认设置, 主题选择: "砖机液晶" })).toBe(甲);
    const 乙 = 读取有效游戏主题({ ...默认设置, 主题选择: "街机彩砖" });
    expect(乙).not.toBe(甲);
    expect(乙.主题).toBe("街机彩砖");
    expect(读取有效游戏主题({ ...默认设置, 主题选择: "砖机液晶" })).not.toBe(乙);
  });

  function 可选主题不含旧外观(): boolean {
    const 可选 = 读取可选主题(读取游戏主题目录()).map((项) => 项.编号);
    for (const 旧 of ["成都熊猫", "晨光海岸", "云海山岚", "霓虹天际", "待分类"])
      if (可选.includes(旧)) return false;
    return true;
  }
});

// ── 设置入口 ──
describe("设置入口", () => {
  test("只接受已拥有主题，并把主题选择与样式写回存档", () => {
    const 执行 = Bun.spawnSync(
      [
        process.execPath,
        "-e",
        `
      import assert from 'node:assert/strict';
      const data = new Map();
      globalThis.localStorage = {get length(){return data.size}, getItem:k=>data.get(k)??null, setItem:(k,v)=>data.set(k,String(v)), removeItem:k=>data.delete(k), clear:()=>data.clear(), key:i=>[...data.keys()][i]??null};
      globalThis.window = new EventTarget();
      const {获取游戏设置,更新游戏设置,默认设置}=await import('./代码/设置/游戏设置.ts');
      const {收藏}=await import('./代码/存档/收藏.ts');
      assert.equal(默认设置.主题选择,'极光原野');
      assert.equal(默认设置.样式,'极光原野');
      assert.throws(()=>更新游戏设置({主题选择:'砖机液晶'}));
      const 档=new 收藏(localStorage);
      assert(档.增加测试金币(10000).成功);
      for (const 名称 of ['砖机液晶','街机彩砖','立体晶格']) assert(档.购买主题(名称).成功);
      const 液晶=更新游戏设置({主题选择:'砖机液晶'});
      assert.equal(液晶.主题选择,'砖机液晶');
      assert.equal(液晶.样式,'砖机液晶');
      const 关=更新游戏设置({背景动态:false});
      assert.equal(关.主题选择,'砖机液晶');
      assert.equal(关.样式,'砖机液晶');
      assert.equal(关.背景动态,false);
      assert.equal(更新游戏设置({背景动态:true}).背景动态,true);
      const 晶格=更新游戏设置({主题选择:'立体晶格'});
      assert.equal(晶格.主题选择,'立体晶格');
      assert.equal(晶格.样式,'极光原野');
      assert.equal(获取游戏设置().主题选择,'立体晶格');
      assert.equal(JSON.parse(localStorage.getItem('再消一行:设置')).主题选择,'立体晶格');
      const 回=更新游戏设置({主题选择:'极光原野'});
      assert.equal(回.主题选择,'极光原野');
      assert.equal(回.样式,'极光原野');
      assert.equal(获取游戏设置().背景动态,true);
    `,
      ],
      { cwd: 项目根路径, stdout: "pipe", stderr: "pipe" },
    );
    expect(new TextDecoder().decode(执行.stderr)).toBe("");
    expect(执行.exitCode).toBe(0);
  });
});

describe("分部位自由搭配", () => {
  test("背景、方块、界面、音效与音乐分别覆盖，缓存和显式整套预览正确", () => {
    const 设置: 游戏设置 = {
      ...默认设置,
      外观搭配: {
        静态背景: "街机彩砖",
        动态背景: "砖机液晶",
        方块外观: "立体晶格",
        界面样式: "砖机液晶",
        音效套装: "街机彩砖",
        音乐: "砖机液晶",
      },
    };
    const 结果 = 读取有效游戏主题(设置);
    const 值 = (槽: string) => 结果.槽位.find((项) => 项.槽位.编号 === 槽)?.资源.值;
    expect(值("静态背景")).toBe("街机彩砖");
    expect(值("动态背景")).toBe("砖机液晶");
    expect(值("方块外观")).toBe("立体晶格");
    expect(值("棋盘表现")).toBe("透视");
    expect(值("界面配色")).toBe("砖机液晶");
    expect(值("音效套装")).toBe("街机彩砖");
    expect(值("背景音乐")).toBe("砖机液晶");
    expect(读取有效游戏主题(设置)).toBe(结果);
    const 换 = 读取有效游戏主题({ ...设置, 外观搭配: { ...设置.外观搭配, 方块外观: "街机彩砖" } });
    expect(换).not.toBe(结果);
    expect(换.槽位.find((项) => 项.槽位.编号 === "静态背景")?.资源.值).toBe("街机彩砖");
    const 预览 = 解析游戏主题(设置, "极光原野");
    expect(预览.槽位.find((项) => 项.槽位.编号 === "方块外观")?.资源.值).toBe("极光原野");
  });
  test("真实设置拒绝未购部位，单件保留其它装备，刷新后保留，穿整套清空搭配", () => {
    const 执行 = Bun.spawnSync(
      [
        "bun",
        "-e",
        String.raw`
    import assert from 'node:assert/strict';
    const 内容=new Map();
    globalThis.localStorage={getItem:k=>内容.get(k)??null,setItem:(k,v)=>内容.set(k,v),removeItem:k=>内容.delete(k)};
    globalThis.window=new EventTarget();
    const {收藏}=await import('./代码/存档/收藏.ts');
    const 模块=await import('./代码/设置/游戏设置.ts');
    const {更新游戏设置,获取游戏设置}=模块;
    assert.throws(()=>更新游戏设置({外观搭配:{方块外观:'砖机液晶'}}),/尚未拥有/);
    const c=new 收藏(localStorage);c.增加测试金币(5000);
    assert.equal(c.购买('砖机液晶','方块外观').成功,true);
    assert.equal(c.购买('街机彩砖','静态背景').成功,true);
    更新游戏设置({外观搭配:{方块外观:'砖机液晶'}});
    更新游戏设置({外观搭配:{...获取游戏设置().外观搭配,静态背景:'街机彩砖'}});
    assert.equal(获取游戏设置().主题选择,'极光原野');
    assert.deepEqual(获取游戏设置().外观搭配,{方块外观:'砖机液晶',静态背景:'街机彩砖'});
    const 刷新=await import('./代码/设置/游戏设置.ts?刷新=搭配');
    assert.deepEqual(刷新.获取游戏设置().外观搭配,获取游戏设置().外观搭配);
    assert.throws(()=>更新游戏设置({主题选择:'砖机液晶'}),/尚未拥有/);
    更新游戏设置({主题选择:'极光原野'});
    assert.deepEqual(获取游戏设置().外观搭配,{});
  `,
      ],
      { cwd: 项目根路径, stdout: "pipe", stderr: "pipe" },
    );
    expect(new TextDecoder().decode(执行.stderr)).toBe("");
    expect(执行.exitCode).toBe(0);
  });
});

test("混搭音频分别读取音乐和音效装备，商店试听不被当前装备覆盖", async () => {
  const { 读取主题音乐编号, 读取主题音效谱 } = await import("../../代码/音频/音频服务");
  const { 消行谱 } = await import("../../代码/框架配置/音效");
  const 设置: 游戏设置 = { ...默认设置, 外观搭配: { 音乐: "街机彩砖", 音效套装: "极光原野" } };
  expect(读取主题音乐编号(设置, "再消一行.菜单")).toBe("街机彩砖.主题");
  expect(读取主题音乐编号(设置, "砖机液晶.主题", true)).toBe("砖机液晶.主题");
  expect(读取主题音乐编号(设置, "再消一行.菜单", true)).toBe("再消一行.菜单");
  const 谱 = 消行谱(1);
  expect(读取主题音效谱(设置, 谱)).toBe(谱);
  expect(读取主题音效谱(设置, 谱, "砖机液晶")).not.toBe(谱);
});
