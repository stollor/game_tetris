import { expect, test } from "bun:test";
import { Texture } from "three";
import { 方块外观方案表 } from "../主题/外观/方块外观";
import type { 三角形状, 四边形状, 紫外线矩形 } from "../框架/界面/图元合批";
import { 图元合批 } from "../框架/界面/图元合批";
import { 创建界面配色, 矩形相交 } from "../框架/界面/控件/工具";
import { 按钮, type 按钮阶段 } from "../框架/界面/控件/按钮";
import type { 文字服务 as 控件文字服务, 矩形, 绘制环境 } from "../框架/界面/控件/类型";
import { 轻提示队列 } from "../框架/界面/控件/轻提示";
import type { 文字图集选项 } from "../框架/界面/文字图集";
import { 创建文字服务, type 文字图集接口 } from "../框架/界面/文字服务";
import { 创建画笔, type 画笔, type 画笔合批接口, type 资源层 } from "../框架/界面/绘制/画笔";
import { 成就图标编号列表 } from "../组件/基础/图标/成就图标";
import { 计算霓虹结算布局 } from "../组件/结算/结算台配方";
import { type 结算飘字外观, 绘制结算操作, 绘制结算演出, 绘制结算飘字 } from "../视效/特效/结算演出";

const 白块: 紫外线矩形 = { u: 0, v: 0, 宽: 0.1, 高: 0.1 };

interface 文本记录 {
  文本: string;
  字号: number;
  左: number;
  上: number;
  宽: number;
  颜色?: readonly [number, number, number, number];
}

interface 图元记录 {
  四边形: 四边形状[];
  三角形: 三角形状[];
}

interface 裁剪状态 {
  栈: 矩形[];
  要求: boolean;
  未裁剪: number;
}

function 空资源层(): 资源层 {
  return {
    读取帧: () => undefined,
    读取页纹理: () => undefined,
    读取散图: () => undefined,
    读取统计: () => ({ 图集数: 0, 页数: 0, 帧数: 0, 纹理字节: 0, 散图数: 0 }),
    销毁: () => undefined,
  };
}

/** 最小文字图集：只记录文字项并写一块文字四边形，不依赖 canvas。 */
function 假图集工厂(文本记录: 文本记录[]) {
  return (选项: 文字图集选项): 文字图集接口 => {
    const 纹理 = new Texture();
    const 测量 = (文本: string) => Array.from(文本).length * 选项.字号;
    const 页面边长 = 选项.页面边长 ?? 1024;
    return {
      注册: () => undefined,
      读取纹理: () => 纹理,
      读取纯色紫外线: () => 白块,
      读取行高: () => 选项.字号,
      测量,
      排版: (文本, 最大宽度) => ({
        行: [{ 文本, 宽: 测量(文本), 字形: [] }],
        宽: Math.min(测量(文本), 最大宽度),
        高: 选项.字号,
      }),
      绘制: (合批, 文本, 绘制选项) => {
        const 宽 = 测量(文本);
        文本记录.push({
          文本,
          字号: 选项.字号,
          左: 绘制选项.左,
          上: 绘制选项.上,
          宽,
          颜色: 绘制选项.颜色,
        });
        合批.添加({
          左: 绘制选项.左,
          上: 绘制选项.上,
          宽,
          高: 选项.字号,
          紫外线: 白块,
          颜色: 绘制选项.颜色,
          纹理: 绘制选项.纹理序号,
        });
        return { 行: [], 宽: 0, 高: 0 };
      },
      读取统计: () => ({ 页数: 1, 字形数: 0, 页面边长, 纹理字节: 页面边长 ** 2 * 4 }),
      销毁: () => undefined,
    };
  };
}

/** 控件只读文字服务：轻提示用它测量/截断，真正绘制交给画笔钩子。 */
function 创建控件文字服务(): 控件文字服务 {
  return {
    测量: (文本) => Array.from(文本).length * 14,
    读取行高: () => 14,
    排版: () => ({ 宽: 0, 高: 14, 行数: 1 }),
    折行: (文本) => [文本],
    绘制: () => ({ 宽: 0, 高: 14, 行数: 1 }),
    读取纯色紫外线: () => 白块,
  };
}

function 创建演出装配() {
  const 真合批 = new 图元合批({ 纹理: new Texture() });
  const 记录: 图元记录 = { 四边形: [], 三角形: [] };
  const 文本记录: 文本记录[] = [];
  const 裁剪状态: 裁剪状态 = { 栈: [], 要求: false, 未裁剪: 0 };
  const 记录合批: 画笔合批接口 = {
    添加: (形) => {
      if (裁剪状态.要求 && 裁剪状态.栈.length === 0) 裁剪状态.未裁剪++;
      记录.四边形.push(形);
      return 真合批.添加(形);
    },
    添加四边形: (形) => {
      if (裁剪状态.要求 && 裁剪状态.栈.length === 0) 裁剪状态.未裁剪++;
      记录.四边形.push(形);
      return 真合批.添加四边形(形);
    },
    添加三角形: (形) => {
      if (裁剪状态.要求 && 裁剪状态.栈.length === 0) 裁剪状态.未裁剪++;
      记录.三角形.push(形);
      return 真合批.添加三角形(形);
    },
    添加纯色: (左, 上, 宽, 高, 颜色, 混合) => {
      if (裁剪状态.要求 && 裁剪状态.栈.length === 0) 裁剪状态.未裁剪++;
      记录.四边形.push({ 左, 上, 宽, 高, 颜色, 混合 });
      return 真合批.添加纯色(左, 上, 宽, 高, 颜色, 混合);
    },
    注册纹理: (键, 纹理) => 真合批.注册纹理(键, 纹理),
    读取图层: () => 真合批.读取图层(),
    清空图层: (图层) => 真合批.清空图层(图层),
    设置纯色: (图案) => 真合批.设置纯色(图案),
    读取纯色: () => 真合批.读取纯色(),
  };
  const 文字 = 创建文字服务({
    登记纹理: () => () => undefined,
    字体: "sans-serif",
    创建图集: 假图集工厂(文本记录),
  });
  const 画笔 = 创建画笔({ 合批: 记录合批, 文字服务: 文字, 资源层: 空资源层() });
  const 跟踪画笔: 画笔 = {
    ...画笔,
    压入裁剪: (矩形) => {
      裁剪状态.栈.push({ ...矩形 });
      画笔.压入裁剪(矩形);
    },
    弹出裁剪: () => {
      裁剪状态.栈.pop();
      画笔.弹出裁剪();
    },
  };
  const 控件环境: 绘制环境 = {
    合批: 记录合批,
    文字: 创建控件文字服务(),
    配色: 创建界面配色(),
  };
  const 清空记录 = () => {
    记录.四边形.length = 0;
    记录.三角形.length = 0;
    文本记录.length = 0;
    裁剪状态.未裁剪 = 0;
  };
  return { 真合批, 记录, 文本记录, 裁剪状态, 画笔, 跟踪画笔, 控件环境, 清空记录 };
}

function 在矩形内(形: { 左: number; 上: number; 宽: number; 高: number }, 框: 矩形): boolean {
  const 容差 = 1e-6;
  return (
    形.左 >= 框.左 - 容差 &&
    形.上 >= 框.上 - 容差 &&
    形.左 + 形.宽 <= 框.左 + 框.宽 + 容差 &&
    形.上 + 形.高 <= 框.上 + 框.高 + 容差
  );
}

function 点在矩形内(点: { x: number; y: number }, 框: 矩形): boolean {
  const 容差 = 1e-6;
  return (
    点.x >= 框.左 - 容差 &&
    点.y >= 框.上 - 容差 &&
    点.x <= 框.左 + 框.宽 + 容差 &&
    点.y <= 框.上 + 框.高 + 容差
  );
}

function 转按钮矩形(按钮布局: { 中心X: number; 中心Y: number; 宽: number; 高: number }): 矩形 {
  return {
    左: 按钮布局.中心X - 按钮布局.宽 / 2,
    上: 按钮布局.中心Y - 按钮布局.高 / 2,
    宽: 按钮布局.宽,
    高: 按钮布局.高,
  };
}

test("390x844 结算布局：统计行、提示区与两个按钮互不重叠且在视口内", () => {
  const 宽 = 390;
  const 高 = 844;
  const 定位 = 计算霓虹结算布局(宽, 高);
  const 比例 = 定位.几何.比例;
  const 统计行: 矩形 = {
    左: 定位.左 + 18 * 比例,
    上: 定位.几何.顶 + 267 * 比例,
    宽: 定位.几何.宽 - 36 * 比例,
    高: 73 * 比例,
  };
  const 重开 = 转按钮矩形(定位.重开);
  const 菜单 = 转按钮矩形(定位.菜单);
  const 区域: 矩形[] = [统计行, 定位.金币区, 定位.提示区, 重开, 菜单];

  for (const 矩形 of 区域) {
    expect(矩形.左).toBeGreaterThanOrEqual(0);
    expect(矩形.上).toBeGreaterThanOrEqual(0);
    expect(矩形.左 + 矩形.宽).toBeLessThanOrEqual(宽 + 1e-6);
    expect(矩形.上 + 矩形.高).toBeLessThanOrEqual(高 + 1e-6);
  }
  for (let 甲 = 0; 甲 < 区域.length; 甲++)
    for (let 乙 = 甲 + 1; 乙 < 区域.length; 乙++) {
      const 左 = 区域[甲];
      const 右 = 区域[乙];
      if (!左 || !右) continue;
      expect(矩形相交(左, 右)).toBe(false);
    }

  // 常驻收益与短暂提示分开，提示消失不改变操作区位置。
  expect(统计行.上 + 统计行.高).toBeLessThan(定位.金币区.上);
  expect(定位.金币区.上 + 定位.金币区.高).toBeLessThan(定位.提示区.上);
  expect(定位.提示区.上 + 定位.提示区.高).toBeLessThanOrEqual(重开.上);
  expect(重开.上 + 重开.高).toBeLessThan(菜单.上);
});

test("结算演出：正常/省电与四个时间点都是有限图元，绘图状态完整恢复", () => {
  const 装配 = 创建演出装配();
  const 标题 = "游戏结束";
  const 模式 = "冲刺";
  const 分数 = 12345;
  const 统计 = [
    { 标签: "消行", 数值: "42" },
    { 标签: "等级", 数值: "8" },
    { 标签: "连击", 数值: "7" },
  ];
  const 期望文本 = [
    模式,
    标题,
    分数.toLocaleString(),
    "消行",
    "42",
    "等级",
    "8",
    "连击",
    "7",
    "本局获得",
  ];

  for (const 省电 of [false, true])
    for (const 经过毫秒 of [0, 500, 1200, 5000, 12000]) {
      装配.真合批.清空();
      装配.清空记录();
      装配.画笔.重置();
      绘制结算演出(装配.画笔, {
        宽: 390,
        高: 844,
        标题,
        模式,
        新纪录: "",
        分数,
        金币: 95,
        金币标签: "本局获得",
        统计,
        方块方案: 方块外观方案表[0],
        经过毫秒,
        省电,
      });

      expect(装配.记录.四边形.length + 装配.记录.三角形.length).toBeGreaterThan(0);
      for (const 形 of 装配.记录.四边形)
        expect([形.左, 形.上, 形.宽, 形.高].every(Number.isFinite)).toBe(true);
      for (const 形 of 装配.记录.三角形)
        for (const 顶点 of 形.顶点)
          expect(Number.isFinite(顶点.x) && Number.isFinite(顶点.y)).toBe(true);
      expect(装配.真合批.读取统计().丢弃数).toBe(0);

      expect(装配.文本记录.slice(0, -1).map((项) => 项.文本)).toEqual(期望文本);
      if (经过毫秒 >= 5000) {
        expect(装配.文本记录.at(-1)?.文本).toBe("+95");
        expect(装配.文本记录.at(-1)?.颜色?.[3]).toBe(1);
        expect(装配.文本记录.find((项) => 项.文本 === 分数.toLocaleString())?.颜色?.[3]).toBe(1);
      }

      // 再画一个已知矩形：矩阵若泄漏会偏移，alpha 若泄漏会体现在顶点色上。
      装配.清空记录();
      装配.画笔.图形.fillStyle(0xffffff, 1).fillRect(1, 2, 3, 4);
      const 末 = 装配.记录.四边形.at(-1);
      expect(末).toMatchObject({ 左: 1, 上: 2, 宽: 3, 高: 4 });
      expect(末?.颜色?.[3]).toBe(1);
    }
});

test("结算常驻收益包含零值和未保存状态，新纪录爆发后仍有有限图元的真实循环", () => {
  const 装配 = 创建演出装配();
  const 画 = (经过毫秒: number, 金币: number | null, 省电 = false) => {
    装配.真合批.清空();
    装配.清空记录();
    装配.画笔.重置();
    绘制结算演出(装配.画笔, {
      宽: 390,
      高: 844,
      标题: "游戏结束",
      模式: "马拉松",
      新纪录: "新纪录",
      分数: 34510,
      金币,
      金币标签: "本局获得",
      统计: [],
      方块方案: 方块外观方案表[0],
      经过毫秒,
      省电,
    });
    const 数量 = 装配.记录.四边形.length + 装配.记录.三角形.length;
    expect(数量).toBeGreaterThan(0);
    expect(数量).toBeLessThan(3000);
    expect(装配.真合批.读取统计().丢弃数).toBe(0);
    return {
      数量,
      图元: JSON.stringify(装配.记录),
      位置: JSON.stringify({
        四边形: 装配.记录.四边形.map((项) => [项.左, 项.上, 项.宽, 项.高]),
        三角形: 装配.记录.三角形.map((项) => 项.顶点.map((点) => [点.x, 点.y])),
      }),
      文本: 装配.文本记录.map((项) => 项.文本),
    };
  };
  for (const 省电 of [false, true]) {
    for (const 时间 of [0, 150, 800]) 画(时间, 95, 省电);
    expect(画(15000, 0, 省电).文本).toContain("+0");
    expect(画(15000, null, 省电).文本).toContain("—");
  }
  const 入场 = 画(800, 95);
  const 待机甲 = 画(6600, 95);
  const 待机乙 = 画(8200, 95);
  expect(入场.图元).not.toBe(待机甲.图元);
  expect(待机甲.图元).not.toBe(待机乙.图元);
  expect(待机甲.位置).not.toBe(待机乙.位置);
  expect(待机甲.数量).toBe(待机乙.数量);
  expect(待机甲.文本).toEqual(待机乙.文本);
  expect(待机乙.文本).toContain("+95");
});

test("结算飘字：金币/成就上移、超时清空，且图形与文字始终在提示区裁剪内", () => {
  const 装配 = 创建演出装配();
  const 定位 = 计算霓虹结算布局(390, 844);
  const 画 = (队列: 轻提示队列, 外观: 结算飘字外观) => {
    装配.真合批.清空();
    装配.清空记录();
    装配.裁剪状态.要求 = true;
    const 状态 = 绘制结算飘字(装配.跟踪画笔, 装配.控件环境, 队列, 定位, 外观);
    expect(装配.裁剪状态.栈.length).toBe(0);
    expect(装配.裁剪状态.未裁剪).toBe(0);
    return 状态;
  };
  const 断言裁剪内 = () => {
    expect(装配.记录.四边形.length + 装配.记录.三角形.length).toBeGreaterThan(0);
    for (const 形 of 装配.记录.四边形) expect(在矩形内(形, 定位.提示区)).toBe(true);
    for (const 形 of 装配.记录.三角形)
      for (const 顶点 of 形.顶点) expect(点在矩形内(顶点, 定位.提示区)).toBe(true);
    expect(装配.文本记录.length).toBeGreaterThan(0);
  };

  const 金币队列 = new 轻提示队列();
  金币队列.显示("+500", 1.8);
  金币队列.更新(0.5);
  const 金币早 = 画(金币队列, { 类型: "金币", 经过毫秒: 700, 数量: 500, 省电: false });
  expect(金币早).not.toBeNull();
  if (!金币早) throw new Error("金币 飘字 未返回状态");
  断言裁剪内();
  expect(装配.文本记录.some((项) => 项.文本.startsWith("+"))).toBe(true);
  expect(金币早.矩形.上).toBeLessThan(定位.奖励Y);

  金币队列.更新(0.3);
  const 金币晚 = 画(金币队列, { 类型: "金币", 经过毫秒: 700, 数量: 500, 省电: false });
  expect(金币晚).not.toBeNull();
  if (!金币晚) throw new Error("金币 飘字 未返回状态");
  断言裁剪内();
  expect(金币晚.矩形.上).toBeLessThan(金币早.矩形.上);

  // 同一进度下省电模式上移更少，避免动画位移。
  const 普通队列 = new 轻提示队列();
  const 省电队列 = new 轻提示队列();
  普通队列.显示("+500", 1.8);
  省电队列.显示("+500", 1.8);
  普通队列.更新(0.5);
  省电队列.更新(0.5);
  const 普通状态 = 画(普通队列, { 类型: "金币", 经过毫秒: 700, 数量: 500, 省电: false });
  const 省电状态 = 画(省电队列, { 类型: "金币", 经过毫秒: 700, 数量: 500, 省电: true });
  if (!普通状态 || !省电状态) throw new Error("省电对比 飘字 未返回状态");
  expect(省电状态.矩形.上).toBeGreaterThan(普通状态.矩形.上);

  const 成就队列 = new 轻提示队列();
  成就队列.显示("初出茅庐", 1.8);
  成就队列.更新(0.5);
  const 成就早 = 画(成就队列, {
    类型: "成就",
    经过毫秒: 700,
    数量: 0,
    成就图标: 成就图标编号列表[0],
    省电: false,
  });
  expect(成就早).not.toBeNull();
  if (!成就早) throw new Error("成就 飘字 未返回状态");
  断言裁剪内();
  expect(装配.文本记录.some((项) => 项.文本.includes("初出茅庐"))).toBe(true);

  成就队列.更新(0.3);
  const 成就晚 = 画(成就队列, {
    类型: "成就",
    经过毫秒: 700,
    数量: 0,
    成就图标: 成就图标编号列表[0],
    省电: false,
  });
  expect(成就晚).not.toBeNull();
  if (!成就晚) throw new Error("成就 飘字 未返回状态");
  expect(成就晚.矩形.上).toBeLessThan(成就早.矩形.上);

  成就队列.更新(2);
  const 超时 = 画(成就队列, {
    类型: "成就",
    经过毫秒: 700,
    数量: 0,
    成就图标: 成就图标编号列表[0],
    省电: false,
  });
  expect(超时).toBeNull();
  expect(成就队列.读取当前文案()).toBeNull();
  expect(成就队列.读取列表().length).toBe(0);
  expect(装配.记录.四边形.length + 装配.记录.三角形.length).toBe(0);
  expect(装配.文本记录.length).toBe(0);
});

test("结算操作：默认/按下/禁用实际绘制不同，且不改按钮命中区", () => {
  const 装配 = 创建演出装配();
  const 定位 = 计算霓虹结算布局(390, 844);
  const 区域 = 转按钮矩形(定位.重开);
  const 原区域 = { ...区域 };
  const 命中按钮 = new 按钮({ 矩形: 区域 });
  const 签名 = () =>
    JSON.stringify({
      四边形: 装配.记录.四边形,
      三角形: 装配.记录.三角形,
      文本: 装配.文本记录,
    });
  const 签名表 = new Map<按钮阶段, string>();
  for (const 阶段 of ["默认", "按下", "禁用"] as const) {
    装配.真合批.清空();
    装配.清空记录();
    绘制结算操作(装配.画笔, 区域, "再来一局", "重开", 阶段, 1200, false);
    expect(装配.记录.四边形.length + 装配.记录.三角形.length).toBeGreaterThan(0);
    expect(装配.文本记录.length).toBeGreaterThan(0);
    签名表.set(阶段, 签名());
    // 三态视觉都落在原命中矩形内，绘制不改页面保存的命中区。
    for (const 项 of 装配.文本记录)
      expect(在矩形内({ 左: 项.左, 上: 项.上, 宽: 项.宽, 高: 项.字号 }, 区域)).toBe(true);
    expect(区域).toEqual(原区域);
    expect(命中按钮.命中({ x: 区域.左 + 区域.宽 / 2, y: 区域.上 + 区域.高 / 2 })).toBe(命中按钮);
  }
  expect(new Set(签名表.values()).size).toBe(3);
});
