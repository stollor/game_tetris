import { expect, test } from "bun:test";
import { 校验界面资源目录 } from "../框架Three/开发/界面资源协议";
import { 界面主题目录, 界面资源样品 } from "../组件/预览/界面资源";
import { 项目界面资源 } from "../组件/预览/组件目录";

test("看板目录登记游戏真实的套件、配色、组件、按钮和图标", () => {
  expect(new Set(项目界面资源.map((项) => 项.分类))).toEqual(
    new Set(["套件", "配色", "组件", "按钮", "图标"]),
  );
  expect(new Set(项目界面资源.map((项) => 项.编号)).size).toBe(项目界面资源.length);
  expect(项目界面资源.filter((项) => 项.分类 === "图标").map((项) => 项.名称)).toEqual([
    "关闭",
    "方块币",
    "风景",
    "设置",
    "成就",
    "商店",
    "排行",
  ]);
  expect(项目界面资源.every((项) => 项.源码.startsWith("组件/"))).toBe(true);
});

test("独立Three目录按实际职责分层，主题与配色分别登记", () => {
  校验界面资源目录(界面资源样品);
  expect(界面资源样品).toHaveLength(28);
  expect(界面资源样品.every((项) => typeof 项.绘制 === "function")).toBe(true);
  for (const [分类, 数量] of [
    ["按钮", 4],
    ["图标", 5],
    ["组件", 5],
    ["样式", 2],
    ["配色", 1],
    ["套件", 2],
    ["布局", 1],
    ["应用", 4],
    ["特效", 4],
  ] as const)
    expect(界面资源样品.filter((项) => 项.分类 === 分类)).toHaveLength(数量);
  expect(
    界面资源样品.find((项) => 项.编号 === "palette")?.状态.find((项) => 项.键 === "配色")?.选项,
  ).toHaveLength(15);
  const 方块单元 = 界面资源样品.find((项) => 项.编号 === "block-unit");
  expect(方块单元?.状态.find((项) => 项.键 === "外观")?.选项).toHaveLength(16);
  expect(方块单元?.陈列状态).toBe("外观");
  expect(方块单元?.高).toBeLessThanOrEqual(160);
  expect(方块单元?.资产?.说明).toContain("同结构复用");
  expect(方块单元?.资产?.说明).toContain("一个中性白色基元");
  expect(方块单元?.资产?.说明).toContain("非线性调色");
  expect(方块单元?.资产?.帧).toBeUndefined();
  expect(界面主题目录).toHaveLength(1);
  expect(界面主题目录[0].名称).toBe("霓虹街机");
  expect(界面主题目录[0].配色方案).toHaveLength(15);
  expect(界面资源样品.some((项) => 项.状态.some((字段) => 字段.键 === "主题"))).toBe(false);
  for (const 项 of 界面资源样品.filter((项) => 项.成员))
    expect(项.成员?.every((编号) => 界面资源样品.some((成员) => 成员.编号 === 编号))).toBe(true);
});
test("图标每个用途一组且无重复，按钮按结构家族保留变体与自然交互", () => {
  const 图标 = 界面资源样品.filter((项) => 项.分类 === "图标");
  expect(图标.map((项) => 项.名称)).toEqual(["导航", "系统", "成长", "收藏", "交易"]);
  const 帧 = 图标.flatMap((项) => 项.资产?.帧 ?? []).map((项) => 项.名称);
  expect(帧).toHaveLength(7);
  expect(new Set(帧).size).toBe(7);
  const 按钮 = 界面资源样品.filter((项) => 项.分类 === "按钮");
  expect(按钮.map((项) => 项.编号)).toEqual([
    "button-menu",
    "button-paper",
    "button-landscape",
    "button-operation",
  ]);
  expect(按钮.every((项) => 项.资产 && 项.绘制资产)).toBe(true);
  expect(
    按钮.every(
      (项) => !项.状态.some((字段) => 字段.选项.includes("悬停") || 字段.选项.includes("按下")),
    ),
  ).toBe(true);
  expect(按钮[0].状态.find((字段) => 字段.键 === "变体")?.选项).toEqual([
    "主要",
    "次要",
    "普通",
    "覆盖页",
  ]);
});
test("样式布局不冒充组件或图集，特效使用真实配方且没有图片调用", () => {
  for (const 编号 of ["text-style", "travel-pattern", "main-layout", "palette"])
    expect(界面资源样品.find((项) => 项.编号 === 编号)?.资产).toBeUndefined();
  expect(界面资源样品.find((项) => 项.编号 === "text-style")?.分类).toBe("样式");
  expect(界面资源样品.find((项) => 项.编号 === "main-layout")?.分类).toBe("布局");
  expect(界面资源样品.some((项) => 项.编号 === "side-panel")).toBe(false);
  expect(界面资源样品.find((项) => 项.编号 === "panel")?.资产?.可拉伸).toBe(true);
  for (const 项 of 界面资源样品.filter((项) => 项.分类 === "特效")) {
    expect(项.绘制帧).toBeDefined();
    expect(项.图片引用).toEqual([]);
    expect(项.源码.some((源) => 源.路径 === "代码/视觉/特效配方.ts")).toBe(true);
  }
});
