import { afterEach, describe, expect, test } from "bun:test";
import type { 图形对象 } from "../../../.gamemaker/依赖/框架/界面/绘制/协议";
import { 混色, 计算颜色对比度 } from "../../../.gamemaker/依赖/框架/界面/颜色工具";
import { 计算商店布局 } from "../../../代码/页面/布局/商店布局";
import { 主题列表, type 主题名 } from "../../../代码/项目配置/主题目录";
import { 解析方块外观 } from "../../../资源/主题/外观/方块外观";
import { 游戏外观 } from "../../../资源/主题/外观/游戏外观";
import { 糖果规范 } from "../../../资源/主题/糖果/糖果规范";
import { 设置预览主题 } from "../../../资源/主题/配色/主题读取";
import { 主题卡常量, 计算主题卡排布 } from "../../../资源/预制体/商店/主题卡配方";
import { 绘制主题缩略 } from "../../../资源/预制体/商店/主题缩略";
import type { 商店外观 } from "../../../资源/预制体/商店/商店外观";
import { 解析商店外观 } from "../../../资源/预制体/商店/商店外观";
import {
  生成商店部位名称文字项,
  绘制商店坞区底板,
  绘制商店目录名牌,
  绘制商店目录封条,
  绘制商店目录底板,
  绘制商店目录缩略边,
  绘制商店部位已拥有对勾,
  绘制商店部位已拥有蒙层,
  绘制商店部位底板,
  绘制商店部位选中描边,
  绘制商店部位预览底板,
  绘制收藏按钮底板,
  绘制收藏纸页,
  计算商店目录名牌,
  计算商店目录名称位置,
} from "../../../资源/预制体/商店/商店配方";

/**
 * 商店主题适配：五套主题在商店里必须是各自的材质语言，而不是共用极光原野的玻璃与纸页。
 * 判据是「语义色齐全 + 文字与底板对比度达标」，风格归属由外观表自身给出。
 */

const 色串 = (值: number): string => `#${值.toString(16).padStart(6, "0")}`;
const 对比 = (前景: string, 背景: string): number => 计算颜色对比度(前景, 背景) ?? 0;

function 取外观(名称: 主题名): 商店外观 {
  设置预览主题(名称);
  return 解析商店外观();
}

afterEach(() => 设置预览主题());

describe("商店外观", () => {
  test("五套主题各有自己的风格，不共用极光原野的霓虹外观", () => {
    const 期望: Record<主题名, 商店外观["风格"]> = {
      极光原野: "霓虹",
      砖机液晶: "像素",
      街机彩砖: "像素",
      立体晶格: "立体",
      糖果超甜: "糖果",
    };
    for (const 名称 of 主题列表) expect(取外观(名称).风格).toBe(期望[名称]);
    // 像素两套虽然同一风格，色盘必须不同：液晶是浅底墨字，彩砖是深底奶油字。
    const 液晶 = 取外观("砖机液晶");
    const 彩砖 = 取外观("街机彩砖");
    expect(液晶.纸页.填充).not.toBe(彩砖.纸页.填充);
    expect(液晶.卡片.填充).not.toBe(彩砖.卡片.填充);
    // 糖果的坞区/纸页/目录三块底板是三种材质，不能糊成同一个颜色。
    const 糖果 = 取外观("糖果超甜");
    expect(糖果.面板.填充).not.toBe(糖果.卡片.填充);
    expect(糖果.卡片.填充).not.toBe(糖果.纸页.填充);
    expect(糖果.纸页.填充).not.toBe(糖果.目录.填充);
  });

  test("像素主题走直角与像素字体，霓虹/立体保留圆角", () => {
    for (const 名称 of ["砖机液晶", "街机彩砖"] as const) {
      const 外观 = 取外观(名称);
      expect(Object.values(外观.圆角).every((值) => 值 === 0)).toBe(true);
      expect(外观.字体).toBe(游戏外观.字体.家族);
    }
    for (const 名称 of ["极光原野", "立体晶格"] as const) {
      const 外观 = 取外观(名称);
      expect(外观.圆角.按钮).toBeGreaterThan(0);
      expect(外观.圆角.纸页).toBeGreaterThan(0);
    }
  });

  test("按钮文字在各自底板上达到正文对比度", () => {
    for (const 名称 of 主题列表) {
      const 外观 = 取外观(名称);
      for (const 角色 of ["主", "次", "淡"] as const) {
        const 配色 = 外观.按钮[角色];
        expect(对比(配色.文字, 色串(配色.填充))).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  test("部位卡、目录卡与交易纸页的文字都读得清", () => {
    for (const 名称 of 主题列表) {
      const 外观 = 取外观(名称);
      expect(对比(外观.文字.部位, 色串(外观.卡片.填充))).toBeGreaterThanOrEqual(4.5);
      expect(对比(外观.文字.目录, 色串(外观.目录.填充))).toBeGreaterThanOrEqual(4.5);
      for (const 角色 of ["标题", "正文", "数值"] as const)
        expect(对比(外观.纸页[角色], 色串(外观.纸页.填充))).toBeGreaterThanOrEqual(4.5);
      // 说明性小字按次要信息处理，仍要高于 3:1。
      expect(对比(外观.纸页.说明, 色串(外观.纸页.填充))).toBeGreaterThanOrEqual(3);
    }
  });

  test("目录卡解封后名称与名牌底仍读得清", () => {
    for (const 名称 of 主题列表) {
      const 外观 = 取外观(名称);
      // 霓虹的名牌底是半透明金色蒙层，实际底色要和卡底混一遍再算对比度。
      const 名牌底 =
        外观.目录.名牌底透明度 < 1
          ? 混色(外观.目录.填充, 外观.目录.名牌底, 外观.目录.名牌底透明度)
          : 外观.目录.名牌底;
      expect(对比(外观.目录.名称点亮, 色串(名牌底))).toBeGreaterThanOrEqual(4.5);
      // 未拥有状态沿用正文色，同样要达标。
      expect(对比(外观.文字.目录, 色串(外观.目录.填充))).toBeGreaterThanOrEqual(4.5);
      // 解封的氛围色不能和卡底撞成一片。
      expect(外观.目录.缩略氛围).not.toBe(外观.目录.填充);
    }
  });

  test("标题与副题在试穿主题下取该主题语义色，不串到极光原野", () => {
    const 极光 = 取外观("极光原野");
    const 液晶 = 取外观("砖机液晶");
    expect(液晶.文字.标题).not.toBe(极光.文字.标题);
    expect(液晶.纸页.填充).not.toBe(极光.纸页.填充);
    expect(液晶.遮罩.颜色).not.toBe(极光.遮罩.颜色);
  });

  test("清空试穿后回到玩家当前主题（默认极光原野）", () => {
    设置预览主题("立体晶格");
    expect(解析商店外观().风格).toBe("立体");
    设置预览主题();
    expect(解析商店外观().风格).toBe("霓虹");
  });
});

/** 记录调用序列的图形替身：缩略图判据看「画了什么颜色」。 */
function 创建记录图形() {
  const 调用: { 方法: string; 参数: unknown[] }[] = [];
  let 图形: 图形对象;
  图形 = new Proxy(
    {},
    {
      get(_目标, 属性) {
        return (...参数: unknown[]) => {
          调用.push({ 方法: String(属性), 参数 });
          return 图形;
        };
      },
    },
  ) as unknown as 图形对象;
  return { 图形, 调用 };
}

describe("目录卡名牌", () => {
  test("名牌嵌在卡内、位于缩略图下方，名称落在名牌里", () => {
    const 卡 = { 左: 16, 上: 0, 宽: 96, 高: 96 };
    const 板 = 计算商店目录名牌(卡);
    expect(板.左).toBeGreaterThan(卡.左);
    expect(板.左 + 板.宽).toBeLessThan(卡.左 + 卡.宽);
    expect(板.上 + 板.高).toBeLessThan(卡.上 + 卡.高 - 2);
    const 名 = 计算商店目录名称位置(卡);
    expect(名.x).toBeGreaterThan(板.左 + 4);
    expect(名.x).toBeLessThan(板.左 + 板.宽 - 40);
    // 文字锚点要在名牌内，且上下留白都不小于 2px（14px 字号，行高按 16 估）。
    expect(名.y).toBeGreaterThan(板.上);
    expect(名.y + 16).toBeLessThan(板.上 + 板.高);
  });
});

describe("糖果商店材质", () => {
  test("糖果风格走糖纸原语：坞区/部位卡/目录卡/纸页/按钮各自落糖果语义色", () => {
    设置预览主题("糖果超甜");
    const 记录 = 创建记录图形();
    const 卡 = { 左: 16, 上: 20, 宽: 96, 高: 96 };
    绘制商店坞区底板(记录.图形, { 左: 0, 上: 500, 宽: 390, 高: 344 });
    绘制商店部位底板(记录.图形, { 左: 16, 上: 500, 宽: 110, 高: 48 }, true);
    绘制商店部位预览底板(记录.图形, { 左: 22, 上: 504, 宽: 40, 高: 38 });
    绘制商店目录底板(记录.图形, 卡, true);
    绘制商店目录封条(记录.图形, { 左: 28, 上: 24, 宽: 72, 高: 5 });
    绘制商店目录缩略边(记录.图形, { 左: 20, 上: 30, 宽: 88, 高: 60 }, true);
    绘制商店目录名牌(记录.图形, 卡, true);
    绘制收藏纸页(记录.图形, 10, 200, 300, 320);
    绘制收藏按钮底板(记录.图形, 195, 700, 358, 44, { 金色: true }, { 悬停: true });
    // 方键（交易纸页的关闭 ×）走马卡龙圆盘，不走胶囊。
    绘制收藏按钮底板(记录.图形, 330, 220, 32, 32, {}, {});
    expect(记录.调用.length).toBeGreaterThan(80);
    const 用到 = (色: number) => 记录.调用.some((调) => 调.参数.some((参) => 参 === 色));
    // 深巧克力坞区、草莓粉目录卡、奶油纸页、金色强调都必须真的落色。
    expect(用到(糖果规范.色.巧克力深)).toBe(true);
    expect(用到(糖果规范.色.粉)).toBe(true);
    expect(用到(糖果规范.色.奶油)).toBe(true);
    expect(用到(糖果规范.色.金)).toBe(true);
    expect(用到(糖果规范.色.草莓深)).toBe(true);
    // 圆盘走 fillCircle，胶囊走 fillRoundedRect：两种按钮形状都出现。
    expect(记录.调用.some((调) => 调.方法 === "fillCircle")).toBe(true);
    expect(记录.调用.some((调) => 调.方法 === "fillRoundedRect")).toBe(true);
    for (const 调 of 记录.调用)
      for (const 参 of 调.参数) if (typeof 参 === "number") expect(Number.isFinite(参)).toBe(true);
  });

  test("两颗购买按钮都画两端糖纸，收窄后接缝容得下两侧扭结", () => {
    设置预览主题("糖果超甜");
    const 页 = 计算商店布局(390, 844);
    // 糖身与糖纸扭结都走 fillPoints：填充点一旦跨进邻居矩形，糖纸就是撞上了。
    const 画购买 = (矩形: { 左: number; 上: number; 宽: number; 高: number }) => {
      const 记录 = 创建记录图形();
      绘制收藏按钮底板(
        记录.图形,
        矩形.左 + 矩形.宽 / 2,
        矩形.上 + 矩形.高 / 2,
        矩形.宽,
        矩形.高,
        {},
      );
      const 点 = 记录.调用
        .filter((调) => 调.方法 === "fillPoints")
        .flatMap((调) => (调.参数[0] as { x: number }[] | undefined) ?? []);
      expect(点.length).toBeGreaterThan(0);
      return 点.map((项) => 项.x);
    };
    const 单件 = 画购买(页.单件);
    const 整套 = 画购买(页.整套);
    // 两颗糖都保留两端「耳朵」：扭结转出胶囊左右沿，不是软糖纽扣。
    expect(Math.min(...单件)).toBeLessThan(页.单件.左);
    expect(Math.max(...单件)).toBeGreaterThan(页.单件.左 + 页.单件.宽);
    expect(Math.max(...整套)).toBeGreaterThan(页.整套.左 + 页.整套.宽);
    // 各自的糖纸收在自己一侧，接缝里不交叉。
    expect(Math.max(...单件)).toBeLessThan(页.整套.左);
    expect(Math.min(...整套)).toBeGreaterThan(页.单件.左 + 页.单件.宽);
  });
});

describe("已拥有部位卡", () => {
  const 卡 = { 左: 16, 上: 512, 宽: 346 / 3, 高: 48 };

  test("部位卡只留名字：价格与「已拥有」字样都不再画在卡上", () => {
    for (const 名称 of 主题列表) {
      const 外观 = 取外观(名称);
      const 未拥有 = 生成商店部位名称文字项(卡, "方块外观", false);
      const 已拥有 = 生成商店部位名称文字项(卡, "方块外观", true);
      expect(未拥有.文案).toBe("方块外观");
      expect(已拥有.文案).toBe("方块外观");
      expect(未拥有.文案).not.toContain("▣");
      expect(未拥有.样式.颜色).toBe(外观.文字.部位);
      // 已拥有时字色退到次要文字，和蒙层一起读作「不用再买」。
      expect(已拥有.样式.颜色).toBe(外观.文字.副题);
    }
  });

  test("五套主题的蒙层与对勾都真的落色，名字和对勾在蒙层上仍读得清", () => {
    for (const 名称 of 主题列表) {
      const 外观 = 取外观(名称);
      const 记录 = 创建记录图形();
      绘制商店部位已拥有蒙层(记录.图形, 卡);
      绘制商店部位已拥有对勾(记录.图形, { 左: 62, 上: 537, 宽: 14, 高: 14 });
      const 用到 = (色: number) => 记录.调用.some((调) => 调.参数.some((参) => 参 === 色));
      expect(用到(外观.卡片.已拥有蒙层), `${名称} 没画已拥有蒙层`).toBe(true);
      expect(用到(外观.卡片.已拥有标记), `${名称} 没画对勾`).toBe(true);
      const 蒙层底 = 混色(外观.卡片.填充, 外观.卡片.已拥有蒙层, 外观.卡片.已拥有蒙层透明度);
      expect(
        对比(外观.文字.副题, 色串(蒙层底)),
        `${名称} 已拥有名字在蒙层上对比度不足`,
      ).toBeGreaterThanOrEqual(3);
      expect(
        对比(色串(外观.卡片.已拥有标记), 色串(蒙层底)),
        `${名称} 对勾在蒙层上对比度不足`,
      ).toBeGreaterThanOrEqual(3);
      for (const 调 of 记录.调用)
        for (const 参 of 调.参数)
          if (typeof 参 === "number") expect(Number.isFinite(参)).toBe(true);
    }
  });

  test("已拥有的选中卡在蒙层之上补选中描边，选中与已拥有两条状态都成立", () => {
    for (const 名称 of 主题列表) {
      const 外观 = 取外观(名称);
      const 记录 = 创建记录图形();
      绘制商店部位选中描边(记录.图形, 卡);
      const 用到 = (色: number) => 记录.调用.some((调) => 调.参数.some((参) => 参 === 色));
      expect(用到(外观.卡片.已拥有标记), `${名称} 没画选中描边`).toBe(true);
      // 像素走实边条，其余走圆角/直角描边。
      expect(
        记录.调用.some(
          (调) =>
            调.方法 === "strokeRoundedRect" || 调.方法 === "strokeRect" || 调.方法 === "fillRect",
        ),
      ).toBe(true);
    }
  });
});

describe("主题卡排布", () => {
  /** 手机 390 宽：面板 358、内容宽 330，列表可用宽 322。 */
  const 手机可用宽 = 330 - 8;

  test("手机上五套主题排成 3+2 两行，卡宽保持标准值不被挤扁", () => {
    const 排布 = 计算主题卡排布(手机可用宽, 主题列表.length);
    expect(排布.列数).toBe(3);
    expect(排布.行数).toBe(2);
    expect(排布.卡宽).toBe(主题卡常量.卡宽);
    // 换行后整块高度 = 两行卡 + 一行间距。
    expect(排布.总高).toBe(2 * 主题卡常量.卡高 + 主题卡常量.间距);
  });

  test("宽屏一排放得下就不换行", () => {
    const 排布 = 计算主题卡排布(712 - 8, 主题列表.length);
    expect(排布.列数).toBe(主题列表.length);
    expect(排布.行数).toBe(1);
    expect(排布.卡宽).toBe(主题卡常量.卡宽);
    expect(排布.总高).toBe(主题卡常量.卡高);
  });

  test("可用宽连一列标准卡都放不下时才收窄，且永不横向溢出", () => {
    const 排布 = 计算主题卡排布(60, 3);
    expect(排布.列数).toBe(1);
    expect(排布.行数).toBe(3);
    expect(排布.卡宽).toBe(60);
    for (const 宽 of [0, 60, 104, 200, 322, 712]) {
      const 结果 = 计算主题卡排布(宽, 5);
      const 整行宽 = 结果.列数 * 结果.卡宽 + (结果.列数 - 1) * 主题卡常量.间距;
      expect(整行宽).toBeLessThanOrEqual(Math.max(宽, 结果.卡宽) + 1e-6);
      expect(结果.行数).toBeGreaterThan(0);
    }
  });
});

describe("主题缩略", () => {
  test("五套主题都画出自己那一格方块的颜色，不是只有背景", () => {
    for (const 名称 of 主题列表) {
      const 记录 = 创建记录图形();
      绘制主题缩略(记录.图形, 88, 66, 名称);
      expect(记录.调用.length).toBeGreaterThan(20);
      const 方块色 = 解析方块外观(名称).颜色.T;
      expect(
        记录.调用.some((调) => 调.方法 === "fillStyle" && 调.参数[0] === 方块色),
        `${名称} 缩略图里没有该主题的方块色`,
      ).toBe(true);
    }
  });

  test("目录卡与部位卡两种尺寸共用同一构图，格子不为零", () => {
    for (const [宽, 高] of [
      [88, 66],
      [36, 34],
    ] as const) {
      const 记录 = 创建记录图形();
      绘制主题缩略(记录.图形, 宽, 高, "立体晶格");
      expect(记录.调用.length).toBeGreaterThan(10);
      for (const 调 of 记录.调用)
        for (const 参 of 调.参数)
          if (typeof 参 === "number") expect(Number.isFinite(参)).toBe(true);
    }
  });

  test("缩略图是静态帧：同一主题两次绘制指令完全一致", () => {
    for (const 名称 of 主题列表) {
      const 甲 = 创建记录图形();
      const 乙 = 创建记录图形();
      绘制主题缩略(甲.图形, 88, 66, 名称);
      绘制主题缩略(乙.图形, 88, 66, 名称);
      expect(甲.调用).toEqual(乙.调用);
    }
  });

  test("糖果缩略底是巧克力 + 粉白条纹篷，不是极光原野的风景", () => {
    const 糖果 = 创建记录图形();
    绘制主题缩略(糖果.图形, 88, 66, "糖果超甜");
    const 极光 = 创建记录图形();
    绘制主题缩略(极光.图形, 88, 66, "极光原野");
    // 巧克力底与草莓粉条纹都必须真的落到画面上（底是渐变，颜色在方法参数里）。
    const 用到色 = (色: number) => 糖果.调用.some((调) => 调.参数.some((参) => 参 === 色));
    expect(用到色(糖果规范.色.巧克力浅)).toBe(true);
    expect(用到色(糖果规范.色.粉)).toBe(true);
    // 与极光原野的缩略底不是同一套指令（有自己的缩略底，不是复用内置风景）。
    expect(糖果.调用).not.toEqual(极光.调用);
  });

  test("尺寸非法时安全返回", () => {
    const 记录 = 创建记录图形();
    绘制主题缩略(记录.图形, 0, 66, "极光原野");
    绘制主题缩略(记录.图形, 88, -1, "极光原野");
    expect(记录.调用).toHaveLength(0);
  });
});
