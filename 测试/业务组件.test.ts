import { expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { 读取游戏主题目录 } from "../主题/主题组合";
import { 解析方块外观 } from "../主题/外观/方块外观";
import { 设置预览主题读取 } from "../主题/配色/主题读取";
import type { 方块类型 } from "../代码/玩法/再消一行";
import { 组装模式卡数据 } from "../代码/界面/模式卡数据";
import { 默认设置 } from "../代码/设置/游戏设置";
import { 计算对局布局 } from "../代码/页面/布局/对局布局";
import { 配置控件规格 } from "../框架/样式/控件规格";
import type { 图形对象 } from "../框架/界面/绘制/协议";
import type { 画笔 } from "../框架/界面/绘制/画笔";
import {
  主题槽位 as 仪表主题槽位,
  控件分类 as 仪表分类,
  绘制对局仪表,
} from "../预制体/对局/对局仪表";
import { 控件分类 as 操作键分类 } from "../预制体/对局/操作键配方";
import { 控件分类 as 方块分类, 绘制居中方块 } from "../预制体/对局/方块绘制";
import { 控件分类 as 暂存槽分类, 绘制暂存槽 } from "../预制体/对局/暂存槽";
import { 主题槽位 as 棋盘主题槽位, 控件分类 as 棋盘分类, 绘制棋盘 } from "../预制体/对局/棋盘配方";
import { 控件分类 as 模式卡分类, 绘制模式卡输入 } from "../预制体/模式选择/模式卡配方";

interface 调用 {
  方法: string;
  参数: unknown[];
}

function 创建记录图形() {
  const 调用: 调用[] = [];
  let 图形: 图形对象;
  图形 = new Proxy({} as 图形对象, {
    get(_目标, 属性) {
      if (typeof 属性 !== "string") return undefined;
      return (...参数: unknown[]) => {
        调用.push({ 方法: 属性, 参数 });
        return 图形;
      };
    },
  });
  return { 图形, 调用 };
}

function 创建记录画笔() {
  const { 图形, 调用 } = 创建记录图形();
  const 尺寸 = { 宽: 24, 高: 16 };
  const 笔: 画笔 = {
    图形,
    绘制文字: () => 尺寸,
    测量文字: () => 尺寸,
    绘制纹理帧: () => false,
    绘制散图: () => false,
    读取纯色紫外线: () => ({ u: 0, v: 0, 宽: 1, 高: 1 }),
    重置: () => undefined,
    压入裁剪: () => undefined,
    弹出裁剪: () => undefined,
  };
  return { 笔, 调用 };
}

function 空格子(): (方块类型 | null)[][] {
  return Array.from({ length: 22 }, () => Array.from({ length: 10 }, () => null));
}

const 手机布局 = 计算对局布局(390, 844, { 模式: "马拉松", 阶段: "进行中" });

test("业务组件对外声明分类为业务，供静态发现", () => {
  expect(棋盘分类).toBe("业务");
  expect(方块分类).toBe("业务");
  expect(仪表分类).toBe("业务");
  expect(暂存槽分类).toBe("业务");
  expect(模式卡分类).toBe("业务");
  expect(操作键分类).toBe("业务");
});

test("玩法规则测试不导入皮肤或业务组件", async () => {
  const 文本 = await readFile(join(resolve(import.meta.dir), "玩法.test.ts"), "utf8");
  expect(文本.includes("预制体/")).toBe(false);
  expect(文本.includes("主题/外观")).toBe(false);
});

test("棋盘按传入方案着色，不绑定某一套皮肤", () => {
  设置预览主题读取(() => 默认设置);
  try {
    const 格子 = 空格子();
    const 行 = 格子[12];
    if (行) 行[4] = "T";
    const 画 = (方案名: "柔瓷" | "铬金") => {
      const 记录 = 创建记录图形();
      绘制棋盘(记录.图形, {
        棋盘: 手机布局.棋盘,
        格子大小: 手机布局.格子大小,
        偏移X: 0,
        偏移Y: 0,
        方案: 解析方块外观(方案名),
        格子,
        当前格子: [],
        当前类型: "I",
        影子: [],
        显示网格: false,
        落点影透明度: 40,
        部分: "静态",
      });
      return 记录.调用
        .filter((项) => 项.方法 === "fillStyle" || 项.方法 === "fillGradientStyle")
        .map((项) => 项.参数[0]);
    };
    const 柔瓷色 = 画("柔瓷");
    const 铬金色 = 画("铬金");
    expect(柔瓷色).toContain(解析方块外观("柔瓷").颜色.T);
    expect(柔瓷色).not.toEqual(铬金色);
    expect(解析方块外观("柔瓷").颜色.T).not.toBe(解析方块外观("铬金").颜色.T);
  } finally {
    设置预览主题读取();
  }
});

test("方块居中绘制消费方案输入，换质感改变填充", () => {
  const 区域 = { 左: 10, 上: 20, 宽: 80, 高: 40 };
  const 画 = (方案名: "柔瓷" | "像素") => {
    const 记录 = 创建记录图形();
    绘制居中方块(记录.图形, {
      方案: 解析方块外观(方案名),
      类型: "O",
      区域,
      格: 12,
    });
    return 记录.调用.some((项) => 项.方法 === "fillRoundedRect");
  };
  expect(画("柔瓷")).toBe(true);
  expect(画("像素")).toBe(false);
});

test("HUD 样品可独立改仪表规格，不经过整页对局", () => {
  设置预览主题读取(() => 默认设置);
  try {
    配置控件规格({ 仪表: { 描边宽: 4.5, 面透明度: 0.41 } });
    const 记录 = 创建记录画笔();
    const 输入 = {
      布局: 手机布局,
      模式: "马拉松" as const,
      等级: 3,
      行数: 12,
      计分: { 显示分数: 12800, 目标分数: 12800, 击中: 0, 流光: [] },
      剩余毫秒: 0,
      有效毫秒: 0,
      省电: true,
    };
    绘制对局仪表(记录.笔, 输入, "静态");
    绘制对局仪表(记录.笔, 输入, "动态");
    expect(记录.调用.some((项) => 项.方法 === "lineStyle" && 项.参数[0] === 4.5)).toBe(true);
    expect(记录.调用.some((项) => 项.方法 === "fillStyle" && 项.参数[1] === 0.41)).toBe(true);
    expect(记录.调用.some((项) => 项.方法 === "fillPoints")).toBe(true);
  } finally {
    配置控件规格({});
    设置预览主题读取();
  }
});

function 仪表样品输入(覆盖: Partial<Parameters<typeof 绘制对局仪表>[1]> = {}) {
  return {
    布局: 手机布局,
    模式: "马拉松" as const,
    等级: 3,
    行数: 12,
    计分: { 显示分数: 12800, 目标分数: 12800, 击中: 0, 流光: [] },
    剩余毫秒: 0,
    有效毫秒: 0,
    省电: true,
    ...覆盖,
  };
}

test("条带 HUD 用圆角条，不走装置舱 fillPoints", () => {
  设置预览主题读取(() => 默认设置);
  try {
    const 记录 = 创建记录画笔();
    绘制对局仪表(记录.笔, 仪表样品输入({ 表现: "条带" }), "静态");
    expect(记录.调用.some((项) => 项.方法 === "fillRoundedRect")).toBe(true);
    expect(记录.调用.some((项) => 项.方法 === "strokeRoundedRect")).toBe(true);
    expect(记录.调用.some((项) => 项.方法 === "fillPoints")).toBe(false);
  } finally {
    设置预览主题读取();
  }
});

test("平涂装置不画舱底装饰灯条", () => {
  设置预览主题读取(() => 默认设置);
  try {
    const 灯条 = 创建记录画笔();
    绘制对局仪表(灯条.笔, 仪表样品输入({ 表现: "装置", 纹样: "灯条" }), "静态");
    const 平涂 = 创建记录画笔();
    绘制对局仪表(平涂.笔, 仪表样品输入({ 表现: "装置", 纹样: "平涂" }), "静态");
    const 装饰灯 = (调用: 调用[]) =>
      调用.filter((项) => 项.方法 === "fillRect" && 项.参数[3] === 2);
    expect(装饰灯(灯条.调用).length).toBeGreaterThan(0);
    expect(装饰灯(平涂.调用)).toEqual([]);
  } finally {
    设置预览主题读取();
  }
});

test("主题槽位导出与目录声明一致", () => {
  const 目录 = 读取游戏主题目录();
  const 声明 = (编号: string) => 目录.预制体?.find((项) => 项.编号 === 编号)?.槽位;
  expect(声明("对局仪表")).toEqual(["界面配色", "界面表现", "字体", "仪表纹样", "仪表表现"]);
  expect([...仪表主题槽位]).toEqual(["界面配色", "界面表现", "字体", "仪表纹样", "仪表表现"]);
  expect(声明("棋盘")).toEqual(["界面配色", "界面表现", "方块外观", "棋盘表现"]);
  expect([...棋盘主题槽位]).toEqual(["界面配色", "界面表现", "方块外观", "棋盘表现"]);
});

test("暂存槽只消费布局和队列快照", () => {
  设置预览主题读取(() => 默认设置);
  try {
    const 记录 = 创建记录画笔();
    绘制暂存槽(记录.笔, {
      布局: 手机布局,
      方案: 解析方块外观("极光原野"),
      暂存方块: "T",
      本块已暂存: false,
      下一个: ["I", "O", "L"],
      阶段: "进行中",
      最佳纪录: "12,800",
      暂无纪录: "暂无纪录",
      暂停: false,
      部分: "静态",
    });
    expect(记录.调用.some((项) => 项.方法 === "fillRoundedRect")).toBe(true);
    const 动态 = 创建记录画笔();
    绘制暂存槽(动态.笔, {
      布局: 手机布局,
      方案: 解析方块外观("极光原野"),
      暂存方块: "T",
      本块已暂存: false,
      下一个: ["I", "O", "L"],
      阶段: "进行中",
      最佳纪录: "12,800",
      暂无纪录: "暂无纪录",
      暂停: false,
      部分: "动态",
    });
    expect(动态.调用.some((项) => 项.方法 === "fillRoundedRect" || 项.方法 === "fillRect")).toBe(
      true,
    );
  } finally {
    设置预览主题读取();
  }
});

test("模式卡按输入数据绘制，页面只负责装配文案", () => {
  设置预览主题读取(() => 默认设置);
  try {
    const 数据 = 组装模式卡数据("冲刺", false, null);
    const 记录 = 创建记录图形();
    绘制模式卡输入(记录.图形, {
      布局: { 中心X: 195, 中心Y: 110, 宽: 350, 高: 110 },
      数据,
    });
    expect(数据.装置).toBe("冲刺");
    expect(记录.调用.some((项) => 项.方法 === "strokeRoundedRect")).toBe(true);
    expect(记录.调用.some((项) => 项.方法 === "fillRoundedRect")).toBe(true);
  } finally {
    设置预览主题读取();
  }
});
