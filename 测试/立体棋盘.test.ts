import { expect, test } from "bun:test";
import { Box3, InstancedMesh } from "three";
import { 解析游戏主题 } from "../代码/主题/主题组合";
import { 解析方块外观 } from "../代码/主题/外观/方块外观";
import { 立体主题名, 立体规范 } from "../代码/主题/立体/立体规范";
import { 是立体风格, 是透视棋盘 } from "../代码/主题/立体/立体风格";
import { 设置预览主题读取 } from "../代码/主题/配色/主题读取";
import type { 方块类型 } from "../代码/玩法/再消一行";
import { 建房间装置 } from "../代码/视效/透视/房间装置";
import {
  建方块几何,
  提交透视对局,
  清空透视棋盘,
  读取透视棋盘占用,
  读取透视棋盘快照,
} from "../代码/视效/透视/透视棋盘";
import { 默认设置 } from "../代码/设置/游戏设置";
import { 计算对局布局 } from "../代码/页面/布局/对局布局";
import type { 图形对象 } from "../框架/界面/绘制/协议";
import type { 画笔 } from "../框架/界面/绘制/画笔";
import { 绘制玻璃面板基底 } from "../组件/基础/玻璃绘制";
import { 绘制立体机壳 } from "../组件/基础/立体绘制";
import { 绘制对局仪表 } from "../组件/对局/对局仪表";
import { 绘制图标角键 } from "../组件/对局/操作键配方";
import { 绘制棋盘 } from "../组件/对局/棋盘配方";
import { 读取预览主题解析, 读取预览主题设置 } from "../组件/预览/主题状态";

test("立体晶格走透视棋盘，HUD 走金属机架", () => {
  const 结果 = 解析游戏主题(默认设置, 立体主题名);
  const 值 = (槽: string) => 结果.槽位.find((项) => 项.槽位.编号 === 槽)?.资源.值;
  expect(结果.主题).toBe(立体主题名);
  expect(值("棋盘表现")).toBe("透视");
  expect(值("视觉特效")).toBe("透视");
  expect(值("方块外观")).toBe(立体主题名);
  expect(值("界面配色")).toBe("极光原野");
  expect(值("界面表现")).toBe("立体");
  expect(值("仪表表现")).toBe("装置");
  expect(值("仪表纹样")).toBe("灯条");
  expect(new Set(Object.values(立体规范.方块)).size).toBe(7);
  expect(解析方块外观(立体主题名).颜色.T).toBe(立体规范.方块.T);
  expect(解析方块外观(立体主题名).颜色.T).not.toBe(解析方块外观("极光原野").颜色.T);
  const 预览设置 = 读取预览主题设置({ 资源主题: 立体主题名 });
  const 预览 = 读取预览主题解析({ 资源主题: 立体主题名 }, 预览设置);
  expect(预览.槽位.find((项) => 项.槽位.编号 === "棋盘表现")?.资源.值).toBe("透视");
  设置预览主题读取(
    () => 预览设置,
    () => 预览,
  );
  try {
    expect(是透视棋盘()).toBe(true);
    expect(是立体风格()).toBe(true);
  } finally {
    设置预览主题读取();
  }
});

test("透视棋盘跳过 2D 绘制，快照保留已落格", () => {
  const 设置 = { ...默认设置, 主题选择: 立体主题名 };
  设置预览主题读取(
    () => 设置,
    () => 解析游戏主题(设置, 立体主题名),
  );
  try {
    expect(是透视棋盘()).toBe(true);
    const 格子 = Array.from({ length: 22 }, () =>
      Array.from({ length: 10 }, () => null as 方块类型 | null),
    );
    const 行 = 格子[12];
    if (行) 行[4] = "T";
    const 布局 = 计算对局布局(390, 844, { 模式: "马拉松", 阶段: "进行中" });
    const 调用: string[] = [];
    const 图形 = new Proxy({} as 图形对象, {
      get(_目标, 属性) {
        return (..._参数: unknown[]) => {
          调用.push(String(属性));
          return 图形;
        };
      },
    });
    const 输入 = {
      棋盘: 布局.棋盘,
      格子大小: 布局.格子大小,
      偏移X: 0,
      偏移Y: 2,
      方案: 解析方块外观(立体主题名),
      格子,
      当前格子: [[3, 4] as [number, number]],
      当前类型: "I" as const,
      影子: [[3, 18] as [number, number]],
      显示网格: true,
      落点影透明度: 40,
      部分: "全部" as const,
    };
    绘制棋盘(图形, 输入);
    expect(调用).toEqual([]);
    提交透视对局(输入, null);
    const 快照 = 读取透视棋盘快照();
    expect(快照?.棋盘.上).toBe(布局.棋盘.上 + 2);
    expect(快照?.格子[12]?.[4]).toBe("T");
    expect(快照?.当前类型).toBe("I");
    expect(读取透视棋盘占用()).toBe(true);
    清空透视棋盘();
    expect(读取透视棋盘快照()).toBeNull();
    expect(读取透视棋盘占用()).toBe(false);
  } finally {
    设置预览主题读取();
    清空透视棋盘();
  }
});

test("金属口沿、灯芯和柔光各自合批，装置包围盒不超过声明口沿", () => {
  const 开口宽 = 10.3;
  const 装置 = 建房间装置(10, 20, 2.5, 开口宽);
  const 批们 = 装置.children.filter((子): 子 is InstancedMesh => 子 instanceof InstancedMesh);
  expect(批们).toHaveLength(4);
  for (const 子 of 批们) {
    expect(子.count).toBeGreaterThan(0);
    expect(子.instanceColor?.count).toBe(子.count);
  }
  const 界 = new Box3().setFromObject(装置);
  expect(界.min.x).toBeGreaterThan(-开口宽 / 2 - 立体规范.装置.辉光宽);
  expect(界.max.x).toBeLessThan(开口宽 / 2 + 立体规范.装置.辉光宽);
  expect(界.min.z).toBeGreaterThan(-2.5 - 立体规范.装置.壁肋宽);
  expect(界.max.z).toBeLessThan(立体规范.装置.框厚 * 2);
  for (const 子 of 装置.children) {
    if (!(子 instanceof InstancedMesh)) continue;
    子.geometry.dispose();
    if (!Array.isArray(子.material)) 子.material.dispose();
    子.dispose();
  }
});

test("蓝色灯带包含真实面光源，沿两侧灯芯分段照明", () => {
  const 装置 = 建房间装置(10, 20, 2.5, 10.3);
  const 灯 = 装置.getObjectsByProperty("type", "RectAreaLight");
  expect(灯).toHaveLength(立体规范.装置.灯段位置.length * 2 + 立体规范.装置.顶灯位置.length);
  const 墙 = 装置.getObjectByName("分段内壁");
  expect(墙).toBeInstanceOf(InstancedMesh);
  if (!(墙 instanceof InstancedMesh)) throw new Error("缺少实墙");
  墙.geometry.computeBoundingBox();
  const 界 = 墙.geometry.boundingBox;
  expect(界).not.toBeNull();
  expect(界?.max.z).toBeGreaterThan(0.3);
  expect(界?.max.x).toBeGreaterThan(0.04);
  expect(墙.receiveShadow).toBe(true);
});

test("方块保持一格正面，厚度和倒角由真实几何产生", () => {
  const 几何 = 建方块几何();
  几何.computeBoundingBox();
  const 界 = 几何.boundingBox;
  expect(界).not.toBeNull();
  expect((界?.max.x ?? 0) - (界?.min.x ?? 0)).toBeCloseTo(1);
  expect((界?.max.y ?? 0) - (界?.min.y ?? 0)).toBeCloseTo(1);
  expect((界?.max.z ?? 0) - (界?.min.z ?? 0)).toBeGreaterThan(0.75);
  const 法线 = 几何.getAttribute("normal");
  let 侧面数 = 0;
  let 倒角数 = 0;
  for (let 序 = 0; 序 < 法线.count; 序++) {
    if (Math.abs(法线.getZ(序)) < 0.01) 侧面数++;
    if (Math.abs(法线.getX(序)) > 0.2 && Math.abs(法线.getZ(序)) > 0.2) 倒角数++;
  }
  expect(侧面数).toBeGreaterThan(0);
  expect(倒角数).toBeGreaterThan(0);
  几何.dispose();
});

test("立体 HUD 画斜切金属板，不再走圆角玻璃", () => {
  const 设置 = { ...默认设置, 主题选择: 立体主题名 };
  设置预览主题读取(
    () => 设置,
    () => 解析游戏主题(设置, 立体主题名),
  );
  try {
    const 调用: string[] = [];
    let 图形: 图形对象;
    图形 = new Proxy({} as 图形对象, {
      get(_目标, 属性) {
        return (..._参数: unknown[]) => {
          调用.push(String(属性));
          return 图形;
        };
      },
    });
    const 笔: 画笔 = {
      图形,
      绘制文字: () => ({ 宽: 24, 高: 12 }),
      测量文字: () => ({ 宽: 24, 高: 12 }),
      绘制纹理帧: () => false,
      绘制散图: () => false,
      读取纯色紫外线: () => ({ u: 0, v: 0, 宽: 1, 高: 1 }),
      重置: () => undefined,
      压入裁剪: () => undefined,
      弹出裁剪: () => undefined,
    };
    const 布局 = 计算对局布局(390, 844, { 模式: "马拉松", 阶段: "进行中" });
    绘制立体机壳(图形, 390, 844, 布局.棋盘);
    绘制玻璃面板基底(图形, 10, 10, 80, 36);
    绘制图标角键(图形, { 左: 10, 上: 10, 宽: 48, 高: 38 }, "暂停");
    绘制对局仪表(
      笔,
      {
        布局,
        模式: "马拉松",
        等级: 1,
        行数: 2,
        计分: { 显示分数: 200, 目标分数: 200, 击中: 0, 流光: [] },
        剩余毫秒: 0,
        有效毫秒: 0,
        省电: true,
      },
      "静态",
    );
    绘制对局仪表(
      笔,
      {
        布局,
        模式: "马拉松",
        等级: 1,
        行数: 2,
        计分: { 显示分数: 200, 目标分数: 200, 击中: 0, 流光: [] },
        剩余毫秒: 0,
        有效毫秒: 0,
        省电: true,
      },
      "动态",
    );
    expect(调用.filter((项) => 项 === "fillPoints").length).toBeGreaterThan(8);
    expect(调用.includes("fillRoundedRect")).toBe(false);
    expect(调用.filter((项) => 项 === "fillRect").length).toBeGreaterThan(3);
  } finally {
    设置预览主题读取();
  }
});
