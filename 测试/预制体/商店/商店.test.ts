import { afterEach, describe, expect, test } from "bun:test";
import type { 图形对象 } from "../../../.gamemaker/依赖/框架/界面/绘制/协议";
import { 计算颜色对比度 } from "../../../.gamemaker/依赖/框架/界面/颜色工具";
import { 主题列表, type 主题名 } from "../../../代码/项目配置/主题目录";
import { 解析方块外观 } from "../../../资源/主题/外观/方块外观";
import { 游戏外观 } from "../../../资源/主题/外观/游戏外观";
import { 设置预览主题 } from "../../../资源/主题/配色/主题读取";
import { 绘制主题缩略 } from "../../../资源/预制体/商店/主题缩略";
import type { 商店外观 } from "../../../资源/预制体/商店/商店外观";
import { 解析商店外观 } from "../../../资源/预制体/商店/商店外观";

/**
 * 商店主题适配：四套主题在商店里必须是各自的材质语言，而不是共用极光原野的玻璃与纸页。
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
  test("四套主题各有自己的风格，不共用极光原野的霓虹外观", () => {
    const 期望: Record<主题名, 商店外观["风格"]> = {
      极光原野: "霓虹",
      砖机液晶: "像素",
      街机彩砖: "像素",
      立体晶格: "立体",
    };
    for (const 名称 of 主题列表) expect(取外观(名称).风格).toBe(期望[名称]);
    // 像素两套虽然同一风格，色盘必须不同：液晶是浅底墨字，彩砖是深底奶油字。
    const 液晶 = 取外观("砖机液晶");
    const 彩砖 = 取外观("街机彩砖");
    expect(液晶.纸页.填充).not.toBe(彩砖.纸页.填充);
    expect(液晶.卡片.填充).not.toBe(彩砖.卡片.填充);
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

describe("主题缩略", () => {
  test("四套主题都画出自己那一格方块的颜色，不是只有背景", () => {
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

  test("尺寸非法时安全返回", () => {
    const 记录 = 创建记录图形();
    绘制主题缩略(记录.图形, 0, 66, "极光原野");
    绘制主题缩略(记录.图形, 88, -1, "极光原野");
    expect(记录.调用).toHaveLength(0);
  });
});
