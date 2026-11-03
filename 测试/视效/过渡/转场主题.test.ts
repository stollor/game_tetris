import { describe, expect, test } from "bun:test";
import type { 图形对象 } from "../../../.gamemaker/依赖/框架/界面/绘制/协议";
import { type 游戏设置, 默认设置 } from "../../../代码/设置/游戏设置";
import { 主题列表, type 主题名 } from "../../../代码/项目配置/主题目录";
import { 解析游戏主题 } from "../../../资源/主题/主题组合";
import { 设置预览主题, 设置预览主题读取 } from "../../../资源/主题/配色/主题读取";
import { 入场参数 } from "../../../资源/视效/过渡/入场参数";
import { 读取幕色 } from "../../../资源/视效/过渡/转场主题/幕色";
import {
  单帧砖块预算,
  接缝砖块,
  砌入进度,
  砖块尺寸,
  砖块布局,
  砖块色号,
  砖块颜色,
  砖缝,
  落砖偏移,
  行延迟,
} from "../../../资源/视效/过渡/转场主题/彩砖";
import {
  列错峰,
  合拢齿格,
  液晶档数,
  液晶画法,
  行错峰,
  量化覆盖度,
} from "../../../资源/视效/过渡/转场主题/液晶";
import { 转场画法表 } from "../../../资源/视效/过渡/转场主题/画法表";
import { 收拢加速, 棱线端点, 棱线集合 } from "../../../资源/视效/过渡/转场主题/立体";
import type { 转场主题 } from "../../../资源/视效/过渡/转场主题/类型";
import { 糖浆厚度, 裱花圆心, 软糖回弹, 软糖幕轮廓 } from "../../../资源/视效/过渡/转场主题/糖果";
import { 解析转场风格, 读取转场风格 } from "../../../资源/视效/过渡/转场主题/风格";

/** 五套主题的转场风格承诺：改主题或改判据必须同步这里。 */
const 期望风格: Record<主题名, 转场主题> = {
  极光原野: "极光",
  砖机液晶: "液晶",
  街机彩砖: "彩砖",
  立体晶格: "立体",
  糖果超甜: "糖果",
};

const 风格全集: readonly 转场主题[] = ["极光", "液晶", "彩砖", "立体", "糖果"];

/** 假图形对象：只记录调用与参数，用来验证主题画法不抛错、不出 NaN、真的画了东西。 */
function 记录画图() {
  const 调用: { 方法: string; 参数: unknown[] }[] = [];
  const 图 = new Proxy({} as 图形对象, {
    get(_目标, 键) {
      if (typeof 键 !== "string") return undefined;
      return (...参数: unknown[]) => {
        调用.push({ 方法: 键, 参数 });
        return 图;
      };
    },
  });
  return { 图, 调用 };
}

const 尺寸 = { 宽: 390, 高: 844 };
const 闭合缝 = {
  顶: 尺寸.高 / 2 - 入场参数.运动.线高 / 2,
  底: 尺寸.高 / 2 + 入场参数.运动.线高 / 2,
};
const 打开缝 = { 顶: 0, 底: 尺寸.高 };

describe("转场主题风格", () => {
  test("五套主题各自解析到约定的转场风格", () => {
    expect(Object.keys(期望风格).sort()).toEqual([...主题列表].sort());
    for (const 名称 of 主题列表)
      expect(解析转场风格(解析游戏主题(默认设置, 名称))).toBe(期望风格[名称]);
  });

  test("画法表覆盖全部风格，且每种画法都有幕面与接缝", () => {
    expect(Object.keys(转场画法表).sort()).toEqual([...风格全集].sort());
    for (const 风格 of 风格全集) {
      const 画法 = 转场画法表[风格];
      expect(typeof 画法.绘制幕面).toBe("function");
      expect(typeof 画法.绘制接缝).toBe("function");
    }
  });

  test("读取当前风格跟随玩家主题，也跟随商店整页试穿", () => {
    const 设置 = (名称: 主题名): 游戏设置 => ({ ...默认设置, 主题选择: 名称 });
    try {
      设置预览主题读取(() => 设置("砖机液晶"));
      expect(读取转场风格()).toBe("液晶");
      设置预览主题读取(() => 设置("糖果超甜"));
      expect(读取转场风格()).toBe("糖果");
      设置预览主题("立体晶格");
      expect(读取转场风格()).toBe("立体");
    } finally {
      设置预览主题(undefined);
      设置预览主题读取();
    }
  });
});

describe("转场幕色", () => {
  test("四模式幕色互不相同，且不让幕布发白", () => {
    const 模式色 = [0x00e5ff, 0xffee58, 0xff2d9b, 0x00e676];
    const 幕色 = 模式色.map(读取幕色);
    expect(new Set(幕色.map((色) => 色.内)).size).toBe(4);
    for (const 色 of 幕色)
      for (const 值 of [色.外, 色.内])
        expect(Math.max((值 >> 16) & 255, (值 >> 8) & 255, 值 & 255)).toBeLessThan(200);
  });
});

describe("转场画法冒烟", () => {
  const 情形 = [
    { 名称: "全开", 缝: 打开缝, 覆盖度: 0 },
    { 名称: "半合", 缝: { 顶: 211, 底: 633 }, 覆盖度: 0.5 },
    { 名称: "闭合", 缝: 闭合缝, 覆盖度: 1 },
  ] as const;

  for (const 风格 of 风格全集) {
    test(`${风格}：幕面/接缝/节拍底纹可绘制且参数有限`, () => {
      const 画法 = 转场画法表[风格];
      for (const 项 of 情形) {
        const { 图, 调用 } = 记录画图();
        画法.绘制幕面(图, {
          宽: 尺寸.宽,
          高: 尺寸.高,
          缝: 项.缝,
          覆盖度: 项.覆盖度,
          模式色: 0x00e5ff,
          边线: 项.覆盖度,
        });
        if (项.覆盖度 > 0) expect(调用.length).toBeGreaterThan(0);
        for (const { 参数 } of 调用)
          for (const 值 of 参数) if (typeof 值 === "number") expect(Number.isFinite(值)).toBe(true);
      }
      for (const 强度 of [0, 1]) {
        const { 图, 调用 } = 记录画图();
        画法.绘制接缝(图, { 宽: 尺寸.宽, 高: 尺寸.高, 模式色: 0xff2d9b, 强度 });
        expect(调用.length).toBeGreaterThan(0);
        for (const { 参数 } of 调用)
          for (const 值 of 参数) if (typeof 值 === "number") expect(Number.isFinite(值)).toBe(true);
      }
      const { 图: 节拍图 } = 记录画图();
      画法.绘制节拍底纹?.(节拍图, { 宽: 尺寸.宽, 高: 尺寸.高, 模式色: 0x00e676, 显: 0.6 });
    });
  }
});

describe("砖机液晶转场画法", () => {
  test("合拢进度量化成 8 档，越界与非法值夹到 0", () => {
    expect(液晶档数).toBe(8);
    expect(量化覆盖度(-1)).toBe(0);
    expect(量化覆盖度(0)).toBe(0);
    expect(量化覆盖度(1 / 16)).toBe(0);
    expect(量化覆盖度(1 / 8)).toBe(1 / 8);
    expect(量化覆盖度(0.99)).toBe(0.875);
    expect(量化覆盖度(1)).toBe(1);
    expect(量化覆盖度(3)).toBe(1);
    expect(量化覆盖度(Number.NaN)).toBe(0);
    expect(量化覆盖度(Number.POSITIVE_INFINITY)).toBe(0);
    let 前 = -1;
    for (let 档 = 0; 档 <= 80; 档 += 1) {
      const 值 = 量化覆盖度(档 / 80);
      expect(值).toBeGreaterThanOrEqual(前);
      expect(Math.round(值 * 8)).toBeCloseTo(值 * 8, 10);
      前 = 值;
    }
  });

  test("列/行错峰在同一序号上恒定，负数与小数按整数归一", () => {
    for (let 列 = 0; 列 < 8; 列 += 1) {
      expect(列错峰(列)).toBe(列错峰(列 + 8));
      expect(列错峰(列)).toBe(列错峰(列 + 800));
      expect([0, 1, 2]).toContain(列错峰(列));
      expect(列错峰(列)).toBe(列错峰(列 + 0.9));
      expect(列错峰(-列 - 1)).toBe(列错峰(-列 - 1 - 8));
    }
    for (let 行 = 0; 行 < 6; 行 += 1) {
      expect(行错峰(行)).toBe(行错峰(行 + 6));
      expect([0, 1, 2]).toContain(行错峰(行));
    }
    expect(行错峰(Number.NaN)).toBe(0);
  });

  test("合拢齿格只在 8 个台阶上换形，完全合拢收平为 0", () => {
    for (let 列 = 0; 列 < 12; 列 += 1) {
      expect(合拢齿格(列, 1)).toBe(0);
      for (const 覆盖度 of [0, 0.2, 0.5, 0.75, 0.99])
        expect([0, 1, 2]).toContain(合拢齿格(列, 覆盖度));
    }
    // 同一档内齿形不变：量化后落在同一档的两个覆盖度必须同形。
    expect(合拢齿格(3, 0.2)).toBe(合拢齿格(3, 0.24));
  });

  test("接缝严格落在屏幕中线，接缝带高 8px 且不透明底", () => {
    for (const 高 of [844, 740, 640]) {
      const { 图, 调用 } = 记录画图();
      液晶画法.绘制接缝(图, { 宽: 390, 高, 模式色: 0x00e5ff, 强度: 1 });
      const 中央 = Math.round(高 / 2);
      const 带 = 调用.find(
        (项) => 项.方法 === "fillRect" && 项.参数[1] === 中央 - 4 && 项.参数[3] === 8,
      );
      expect(带).toBeDefined();
    }
  });
});

describe("糖果超甜转场画法", () => {
  test("裱花沿宽度均匀排布，两端各留半颗", () => {
    expect(裱花圆心(0)).toEqual([]);
    expect(裱花圆心(-10)).toEqual([]);
    const 圆心 = 裱花圆心(390);
    expect(圆心).toHaveLength(26);
    expect(圆心[0]).toBeCloseTo(7.5, 6);
    expect(圆心.at(-1)).toBeCloseTo(382.5, 6);
    for (let 序 = 1; 序 < 圆心.length; 序 += 1)
      expect((圆心[序] ?? 0) - (圆心[序 - 1] ?? 0)).toBeCloseTo(15, 6);
  });

  test("软糖回弹只发生在合拢末段，峰值不超过 2px 且贴缝归零", () => {
    expect(软糖回弹(0)).toBe(0);
    expect(软糖回弹(0.62)).toBe(0);
    expect(软糖回弹(1)).toBe(0);
    let 峰 = 0;
    for (let 步 = 0; 步 <= 100; 步 += 1) 峰 = Math.max(峰, 软糖回弹(0.62 + (步 / 100) * 0.38));
    expect(峰).toBeGreaterThan(1);
    expect(峰).toBeLessThan(2);
  });

  test("糖浆厚度随强度 10→13，非法强度按 0", () => {
    expect(糖浆厚度(0)).toBe(10);
    expect(糖浆厚度(1)).toBe(13);
    expect(糖浆厚度(0.5)).toBeCloseTo(11.5, 6);
    expect(糖浆厚度(5)).toBe(13);
    expect(糖浆厚度(Number.NaN)).toBe(10);
  });

  test("软糖幕只在外缘两角圆角，接缝侧是一条直边", () => {
    expect(软糖幕轮廓(0, 400)).toEqual([]);
    const 轮廓 = 软糖幕轮廓(390, 400);
    expect(轮廓).toHaveLength(16);
    const 接缝边 = 轮廓.filter((点) => 点.y === 400);
    expect(接缝边.map((点) => 点.x).sort((甲, 乙) => 甲 - 乙)).toEqual([3, 387]);
    for (const 点 of 轮廓) {
      expect(点.x).toBeGreaterThanOrEqual(0);
      expect(点.x).toBeLessThanOrEqual(390);
      expect(点.y).toBeGreaterThanOrEqual(0);
      expect(点.y).toBeLessThanOrEqual(400);
    }
  });
});

describe("接缝居中", () => {
  /** 矩形类调用的竖直中心；非矩形调用返回 null。 */
  function 竖直中心(方法: string, 参数: unknown[]): number | null {
    if (!["fillRect", "fillRoundedRect", "fillGradientStyle"].includes(方法)) return null;
    const 上 = 参数[1];
    const 高 = 参数[3];
    if (typeof 上 !== "number" || typeof 高 !== "number") return null;
    return 上 + 高 / 2;
  }

  for (const 风格 of 风格全集) {
    test(`${风格}：接缝装饰以屏幕中线为中心`, () => {
      for (const 高 of [844, 740, 640]) {
        const { 图, 调用 } = 记录画图();
        转场画法表[风格].绘制接缝(图, { 宽: 尺寸.宽, 高, 模式色: 0x00e5ff, 强度: 1 });
        const 中央 = 高 / 2;
        const 贴近 = 调用.some(({ 方法, 参数 }) => {
          const 中心 = 竖直中心(方法, 参数);
          return 中心 !== null && Math.abs(中心 - 中央) <= 1;
        });
        expect(贴近).toBe(true);
      }
    });
  }
});

describe("街机彩砖转场画法", () => {
  test("砖块节距保持 2:1 且整屏砖数不超单帧预算", () => {
    const 节距 = 砖块尺寸(390, 844);
    expect(节距).toEqual({ 砖宽: 72, 砖高: 36 });
    expect(节距.砖宽).toBe(节距.砖高 * 2);
    const 上 = 砖块布局(390, 421, 节距);
    const 下 = 砖块布局(390, 844 - 423, 节距);
    const 砖数 = [...上, ...下].reduce((合计, 行) => 合计 + 行.砖.length, 0);
    expect(砖数).toBeGreaterThan(0);
    expect(砖数).toBeLessThanOrEqual(单帧砖块预算);
  });

  test("砖块布局：错缝半块、砖缝恒 2、末行裁到接缝边", () => {
    const 节距 = 砖块尺寸(390, 844);
    const 行列表 = 砖块布局(390, 421, 节距);
    expect(行列表.length).toBe(Math.ceil(421 / 节距.砖高));
    expect(行列表[0]?.上).toBe(0);
    const 首行 = 行列表[0]?.砖[0];
    const 次行 = 行列表[1]?.砖[0];
    expect(首行).toBeDefined();
    expect(次行).toBeDefined();
    expect(Math.abs((次行?.左 ?? 0) - (首行?.左 ?? 0))).toBe(节距.砖宽 / 2);
    for (const 行 of 行列表) {
      for (const 砖 of 行.砖) {
        expect(砖.宽).toBe(节距.砖宽 - 砖缝);
        expect(砖.高).toBeGreaterThan(0);
      }
      expect(行.上 + 行.高).toBeLessThanOrEqual(421);
    }
    const 末行 = 行列表.at(-1);
    expect(末行?.上).toBeDefined();
    expect((末行?.上 ?? 0) + (末行?.高 ?? 0)).toBeLessThanOrEqual(421);
  });

  test("砖色按行成带、相邻列不撞色", () => {
    for (let 行 = 0; 行 < 8; 行 += 1) {
      expect(砖块色号(行, 0)).toBe(砖块色号(行, 1));
      for (let 列 = 0; 列 < 9; 列 += 1) {
        expect(砖块色号(行, 列)).toBeGreaterThanOrEqual(0);
        expect(砖块色号(行, 列)).toBeLessThan(7);
        expect(砖块颜色(行, 列)).not.toBe(砖块颜色(行, 列 + 1));
      }
    }
  });

  test("逐行砌入：延迟封顶、覆盖度 1 时全部落定、落砖偏移归零", () => {
    expect(行延迟(0)).toBe(0);
    expect(行延迟(5)).toBeCloseTo(0.25, 10);
    expect(行延迟(40)).toBe(0.85);
    expect(行延迟(-3)).toBe(0);
    for (let 行 = 0; 行 < 30; 行 += 1) {
      expect(砌入进度(1, 行)).toBe(1);
      expect(砌入进度(0, 行)).toBe(0);
      let 前 = -1;
      for (let 步 = 0; 步 <= 20; 步 += 1) {
        const 值 = 砌入进度(步 / 20, 行);
        expect(值).toBeGreaterThanOrEqual(前 - 1e-9);
        expect(值).toBeGreaterThanOrEqual(0);
        expect(值).toBeLessThanOrEqual(1);
        前 = 值;
      }
    }
    expect(落砖偏移(1)).toBe(0);
    expect(落砖偏移(0)).toBe(-1.5);
    for (let 步 = 0; 步 <= 20; 步 += 1) expect(Math.abs(落砖偏移(步 / 20))).toBeLessThan(2);
  });

  test("接缝是一排铺满整宽、以中线为中心的彩砖", () => {
    for (const 高 of [844, 740, 640]) {
      const 砖列 = 接缝砖块(390, 高);
      expect(砖列.length).toBeGreaterThan(3);
      for (const 砖 of 砖列) {
        expect(砖.上 + 砖.高 / 2).toBeCloseTo(高 / 2, 6);
        expect(砖.宽).toBeGreaterThan(0);
      }
      const 左沿 = Math.min(...砖列.map((砖) => 砖.左));
      const 右沿 = Math.max(...砖列.map((砖) => 砖.左 + 砖.宽));
      expect(左沿).toBeLessThanOrEqual(0);
      expect(右沿).toBeGreaterThanOrEqual(390);
    }
  });
});

describe("立体晶格转场画法", () => {
  test("收拢加速取 t²：末段推进最快", () => {
    expect(收拢加速(0)).toBe(0);
    expect(收拢加速(0.5)).toBeCloseTo(0.25, 10);
    expect(收拢加速(1)).toBe(1);
    expect(收拢加速(-1)).toBe(0);
    expect(收拢加速(2)).toBe(1);
    expect(收拢加速(Number.NaN)).toBe(0);
    for (let 步 = 0; 步 <= 10; 步 += 1) {
      const t = 步 / 10;
      expect(收拢加速(t)).toBeLessThanOrEqual(t + 1e-9);
    }
  });

  test("棱线端点把幕缝夹在屏幕中线两侧，中心恒为高/2", () => {
    const 正常 = 棱线端点(844, { 顶: 421, 底: 423 });
    expect(正常.中心Y).toBe(422);
    expect(正常.上).toEqual({ 外缘Y: 0, 接缝Y: 421, 高: 421 });
    expect(正常.下).toEqual({ 外缘Y: 844, 接缝Y: 423, 高: 421 });
    const 越界 = 棱线端点(844, { 顶: -50, 底: 2000 });
    expect(越界.中心Y).toBe(422);
    expect(越界.上.接缝Y).toBe(0);
    expect(越界.下.接缝Y).toBe(844);
  });

  test("棱线集合：两片各 9 条、接缝端向中线收、收拢随覆盖度增大", () => {
    const 缝 = { 顶: 421, 底: 423 };
    const 开 = 棱线集合(390, 844, 缝, 0);
    const 合 = 棱线集合(390, 844, 缝, 1);
    expect(开.上).toHaveLength(9);
    expect(开.下).toHaveLength(9);
    expect(开.收拢).toBeCloseTo(0.06, 10);
    expect(合.收拢).toBeCloseTo(0.26, 10);
    for (const [序, 段] of 开.上.entries()) {
      const 中线 = 390 / 2;
      expect(Math.abs(段.接缝.x - 中线)).toBeLessThan(Math.abs(段.外缘.x - 中线) + 1e-9);
      expect(段.接缝.y).toBe(421);
      expect(开.下[序]?.接缝.y).toBe(423);
    }
    expect(棱线集合(0, 844, 缝, 0.5)).toEqual({ 上: [], 下: [], 收拢: 0.06 + 0.2 * 0.25 });
  });
});
