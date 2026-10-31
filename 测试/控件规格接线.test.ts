import { expect, test } from "bun:test";
import { join, resolve } from "node:path";
import { 解析游戏主题 } from "../主题/主题组合";
import { 立体主题名 } from "../主题/立体/立体规范";
import { 设置预览主题读取 } from "../主题/配色/主题读取";
import { 默认设置 } from "../代码/设置/游戏设置";
import { 获取文案 } from "../代码/语言/文案";
import { 绘制对局设置, 计算对局设置布局 } from "../代码/页面/对局/设置面板";
import { 计算对局布局 } from "../代码/页面/布局/对局布局";
import { 配置控件规格 } from "../框架/样式/控件规格";
import type { 图形对象, 矩形 } from "../框架/界面/绘制/协议";
import { 绘制霓虹玻璃 } from "../预制体/基础/面板/霓虹玻璃";
import { 生成常规按钮内容, 绘制常规按钮, 绘制常规按钮图标 } from "../预制体/基础/按钮/按钮配方";
import { 绘制列表行 } from "../预制体/基础/输入与选择/页面控件";
import { 生成操作键轮廓, 绘制图标角键, 绘制操作键 } from "../预制体/对局/操作键配方";

interface 调用 {
  方法: string;
  参数: unknown[];
}

/** 只记录调用顺序与参数，不加载真实 Canvas/WebGL 后端。 */
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

function 找填充(调用: readonly 调用[], 宽: number, 高: number): 调用 | undefined {
  return 调用.find((项) => 项.方法 === "fillRoundedRect" && 项.参数[2] === 宽 && 项.参数[3] === 高);
}

const 项目根 = resolve(import.meta.dir, "..");
const 列表行矩形: 矩形 = { 左: 24, 上: 72, 宽: 342, 高: 68 };

test("metadata 只登记源码与状态，真实配方由准备资源惰性加载", async () => {
  const 构建 = await Bun.build({
    entrypoints: [join(项目根, "预制体/预览/控件规格样品.ts")],
    target: "bun",
    metafile: true,
    // 当前 bun-types 的 BuildConfig 尚未声明 write；运行时仅在内存里取模块图。
    ...({ write: false } as { write: false }),
  });
  expect(构建.success).toBe(true);
  const 入口 = Object.entries(构建.metafile?.inputs ?? {}).find(([路径]) =>
    路径.endsWith("预制体/预览/控件规格样品.ts"),
  )?.[1];
  expect(入口).toBeDefined();
  const 静态导入 = (入口?.imports ?? [])
    .filter((项) => 项.kind === "import-statement")
    .map((项) => 项.path);
  expect(静态导入).toEqual(["预制体/预览/主题状态.ts"]);
  const 动态导入 = new Set(
    (入口?.imports ?? []).filter((项) => 项.kind === "dynamic-import").map((项) => 项.path),
  );
  for (const 路径 of [
    "预制体/基础/面板/霓虹玻璃.ts",
    "预制体/基础/输入与选择/页面控件.ts",
    "代码/页面/对局/设置面板.ts",
    "代码/语言/文案.ts",
    "代码/成就/再消一行成就.ts",
    "主题/配色/主题读取.ts",
    "预制体/对局/操作键配方.ts",
    "预制体/对局/对局仪表.ts",
    "代码/页面/布局/对局布局.ts",
  ])
    expect(动态导入.has(路径)).toBe(true);

  const 模块 = await import("../预制体/预览/控件规格样品");
  const 样品 = 模块.控件规格样品;
  expect(样品.map((项) => 项.编号)).toEqual([
    "spec-panel",
    "spec-dialog",
    "spec-list",
    "spec-corner-key",
    "spec-meter",
  ]);
  const 分组 = Object.fromEntries(
    样品.map((项) => [项.编号, 项.控件规格 && { ...项.控件规格, 字段: [...项.控件规格.字段] }]),
  );
  expect(分组["spec-panel"]?.分组).toBe("面板");
  expect(分组["spec-dialog"]?.分组).toBe("弹层");
  expect(new Set(分组["spec-dialog"]?.字段)).toEqual(
    new Set(["圆角", "描边宽", "面板透明度", "描边透明度", "遮罩透明度"]),
  );
  expect(分组["spec-list"]?.分组).toBe("列表项");
  expect(new Set(分组["spec-list"]?.字段)).toEqual(
    new Set(["圆角", "描边宽", "面板透明度", "描边透明度"]),
  );
  expect(分组["spec-corner-key"]?.分组).toBe("角键");
  expect(new Set(分组["spec-corner-key"]?.字段)).toEqual(
    new Set(["切角", "描边宽", "面透明度", "描边透明度", "下沉", "厚度"]),
  );
  expect(分组["spec-meter"]?.分组).toBe("仪表");
  expect(new Set(分组["spec-meter"]?.字段)).toEqual(
    new Set(["主切角", "副切角", "描边宽", "面透明度", "描边透明度"]),
  );
  expect(样品.some((项) => 项.控件规格?.分组 === "输入框")).toBe(false);
  for (const 项 of 样品) {
    expect(项.状态[0]?.键).toBe("资源主题");
    expect(typeof 项.准备资源).toBe("function");
    expect(项.源码[0]).toEqual(
      项.编号 === "spec-meter"
        ? { 路径: "预制体/对局/对局仪表.ts", 导出: "绘制对局仪表" }
        : { 路径: "预制体/预览/控件规格样品.ts", 导出: "控件规格样品" },
    );
  }
  const { 界面资源样品 } = await import("../预制体/预览/界面资源");
  const 按钮 = 界面资源样品.find((项) => 项.编号 === "neon-button");
  expect(按钮?.名称).toBe("常规按钮");
  expect(按钮?.控件规格?.分组).toBe("按钮");
  expect(new Set(按钮?.控件规格?.字段)).toEqual(
    new Set(["圆角", "描边宽", "面板透明度", "描边透明度", "图标间距", "下沉"]),
  );
  expect(按钮?.状态.find((项) => 项.键 === "图标")?.默认).toBe("是");
  expect(按钮?.源码.some((项) => 项.路径 === "预制体/基础/按钮/按钮配方.ts")).toBe(true);
  const 操作键 = 界面资源样品.find((项) => 项.编号 === "key-face");
  expect(操作键?.名称).toBe("操作键");
  expect(操作键?.控件规格?.分组).toBe("操作键");
  expect(new Set(操作键?.控件规格?.字段)).toEqual(
    new Set(["切角", "描边宽", "面透明度", "描边透明度", "下沉", "厚度", "托盘外扩", "托盘切角"]),
  );
  expect(
    样品
      .find((项) => 项.编号 === "spec-panel")
      ?.源码.some((项) => 项.路径 === "预制体/基础/面板/霓虹玻璃.ts"),
  ).toBe(true);
  expect(
    样品
      .find((项) => 项.编号 === "spec-dialog")
      ?.源码.some((项) => 项.路径 === "代码/页面/对局/设置面板.ts"),
  ).toBe(true);
  expect(
    样品
      .find((项) => 项.编号 === "spec-list")
      ?.源码.some((项) => 项.路径 === "预制体/基础/输入与选择/页面控件.ts"),
  ).toBe(true);
});

test("按钮圆角、描边宽、透明度和下沉改变正式按钮记录", () => {
  设置预览主题读取(() => 默认设置);
  try {
    配置控件规格({
      按钮: {
        圆角: 3,
        描边宽: 5,
        面板透明度: 0.52,
        描边透明度: 0.41,
        图标间距: 18,
        下沉: 6,
        变体: { 普通: { 圆角: 4, 描边宽: 6 } },
      },
    });
    const 甲 = 创建记录图形();
    绘制常规按钮(甲.图形, 100, 80, 200, 50, { 变体: "普通" });
    const 甲主 = 找填充(甲.调用, 200, 50);
    expect(甲主?.参数[1]).toBe(55);
    expect(甲主?.参数[4]).toBe(4);
    expect(
      甲.调用.some((项) => 项.方法 === "lineStyle" && 项.参数[0] === 6 && 项.参数[2] === 0.41),
    ).toBe(true);
    expect(甲.调用.some((项) => 项.方法 === "fillStyle" && 项.参数[1] === 0.52)).toBe(true);
    const 甲按下 = 创建记录图形();
    绘制常规按钮(甲按下.图形, 100, 80, 200, 50, { 变体: "普通", 按下: true });
    expect(找填充(甲按下.调用, 200, 50)?.参数[1]).toBe(61);

    const 甲内容 = 生成常规按钮内容(
      100,
      80,
      "开始游戏",
      { 变体: "普通", 图标: "风景", 按下: true },
      { 宽: 60, 高: 16 },
    );
    expect(甲内容.图标?.中心X).toBe(100 - (60 + 18) / 2);
    expect(甲内容.图标?.中心Y).toBe(86);
    expect(甲内容.文字项?.x).toBe(100 + (22 + 18) / 2);
    expect(甲内容.文字项?.y).toBe(86);
    const 图标 = 甲内容.图标;
    expect(图标).toBeDefined();
    if (!图标) throw new Error("按钮图文配方缺少图标");
    const 图标记录 = 创建记录图形();
    绘制常规按钮图标(图标记录.图形, 图标);
    const 图标位移 = 图标记录.调用.find((项) => 项.方法 === "translateCanvas");
    expect(图标位移?.参数[0]).toBe(图标.中心X - 图标.尺寸 / 2);
    expect(图标位移?.参数[1]).toBe(图标.中心Y - 图标.尺寸 / 2);

    配置控件规格({
      按钮: {
        圆角: 7,
        描边宽: 2,
        面板透明度: 0.7,
        描边透明度: 0.3,
        图标间距: 4,
        下沉: 0,
        变体: { 普通: { 圆角: 8, 描边宽: 2 } },
      },
    });
    const 乙 = 创建记录图形();
    绘制常规按钮(乙.图形, 100, 80, 200, 50, { 变体: "普通" });
    const 乙主 = 找填充(乙.调用, 200, 50);
    expect(乙主?.参数[1]).toBe(55);
    expect(乙主?.参数[4]).toBe(8);
    expect(
      乙.调用.some((项) => 项.方法 === "lineStyle" && 项.参数[0] === 2 && 项.参数[2] === 0.3),
    ).toBe(true);
    expect(乙.调用.some((项) => 项.方法 === "fillStyle" && 项.参数[1] === 0.7)).toBe(true);
    const 乙内容 = 生成常规按钮内容(
      100,
      80,
      "开始游戏",
      { 变体: "普通", 图标: "风景", 按下: true },
      { 宽: 60, 高: 16 },
    );
    expect(乙内容.图标?.中心X).toBe(100 - (60 + 4) / 2);
    expect(乙内容.图标?.中心X).not.toBe(甲内容.图标?.中心X);
    expect(乙内容.文字项?.x).toBe(100 + (22 + 4) / 2);
    expect(乙内容.图标?.中心Y).toBe(80);
    expect(乙内容.文字项?.y).toBe(80);
  } finally {
    配置控件规格({});
    设置预览主题读取();
  }
});

test("面板规格接线到正式玻璃面板记录，显式选项仍优先", () => {
  设置预览主题读取(() => 默认设置);
  try {
    配置控件规格({
      面板: { 圆角: 5, 描边宽: 3, 面板透明度: 0.42, 描边透明度: 0.36 },
    });
    const 记录 = 创建记录图形();
    绘制霓虹玻璃(记录.图形, 20, 30, 300, 180);
    const 主 = 找填充(记录.调用, 300, 180);
    expect(主?.参数[4]).toBe(5);
    expect(记录.调用.some((项) => 项.方法 === "fillStyle" && 项.参数[1] === 0.42)).toBe(true);
    expect(
      记录.调用.some((项) => 项.方法 === "lineStyle" && 项.参数[0] === 3 && 项.参数[2] === 0.36),
    ).toBe(true);

    const 显式 = 创建记录图形();
    绘制霓虹玻璃(显式.图形, 20, 30, 300, 180, { 圆角: 2, 描边宽: 1 });
    expect(找填充(显式.调用, 300, 180)?.参数[4]).toBe(2);
    expect(
      显式.调用.some((项) => 项.方法 === "lineStyle" && 项.参数[0] === 1 && 项.参数[2] === 0.36),
    ).toBe(true);
    配置控件规格({ 面板: { 圆角: 0 } });
    const 直角 = 创建记录图形();
    绘制霓虹玻璃(直角.图形, 20, 30, 300, 180);
    expect(找填充(直角.调用, 300, 180)?.参数[4]).toBe(0);
  } finally {
    配置控件规格({});
    设置预览主题读取();
  }
});

test("列表项规格接线到正式列表行，进度线位置不变", () => {
  设置预览主题读取(() => 默认设置);
  try {
    配置控件规格({
      列表项: { 圆角: 6, 描边宽: 4, 面板透明度: 0.33, 描边透明度: 0.44 },
    });
    const 记录 = 创建记录图形();
    绘制列表行(记录.图形, 列表行矩形, 0x112233, 0x445566, undefined, undefined, {
      比例: 0.5,
      轨道色: 0x778899,
      强调色: 0xaabbcc,
    });
    const 主 = 找填充(记录.调用, 342, 68);
    expect(主?.参数[4]).toBe(6);
    expect(记录.调用.some((项) => 项.方法 === "fillStyle" && 项.参数[1] === 0.33)).toBe(true);
    expect(
      记录.调用.some((项) => 项.方法 === "lineStyle" && 项.参数[0] === 4 && 项.参数[2] === 0.44),
    ).toBe(true);
    const 轨道 = 记录.调用.find(
      (项) =>
        项.方法 === "fillRoundedRect" &&
        项.参数[0] === 40 &&
        项.参数[1] === 123 &&
        项.参数[2] === 298 &&
        项.参数[3] === 3,
    );
    expect(轨道).toBeDefined();

    const 显式 = 创建记录图形();
    绘制列表行(显式.图形, 列表行矩形, 0x112233, 0x445566, 0.9, 2);
    expect(找填充(显式.调用, 342, 68)?.参数[4]).toBe(2);
    expect(
      显式.调用.some((项) => 项.方法 === "lineStyle" && 项.参数[0] === 4 && 项.参数[2] === 0.9),
    ).toBe(true);
  } finally {
    配置控件规格({});
    设置预览主题读取();
  }
});

test("弹层规格接线到真实对局设置：遮罩透明度、描边宽与返回文字", () => {
  设置预览主题读取(() => 默认设置);
  try {
    配置控件规格({
      弹层: {
        圆角: 18,
        描边宽: 2.5,
        面板透明度: 0.65,
        描边透明度: 0.55,
        遮罩透明度: 0.31,
      },
    });
    const 记录 = 创建记录图形();
    const 项 = 绘制对局设置(记录.图形, 390, 400, 默认设置, 获取文案("简体中文"));
    const 遮罩序 = 记录.调用.findIndex(
      (项) =>
        项.方法 === "fillRect" &&
        项.参数[0] === 0 &&
        项.参数[1] === 0 &&
        项.参数[2] === 390 &&
        项.参数[3] === 400,
    );
    expect(遮罩序).toBeGreaterThanOrEqual(0);
    const 遮罩填充 = 记录.调用
      .slice(0, 遮罩序)
      .reverse()
      .find((项) => 项.方法 === "fillStyle");
    expect(遮罩填充?.参数[1]).toBe(0.31);
    const 布局 = 计算对局设置布局(390, 400);
    const 主 = 找填充(记录.调用, 布局.面板.宽, 布局.面板.高);
    expect(主?.参数[4]).toBeCloseTo(18 * 布局.比例);
    expect(
      记录.调用.some((项) => 项.方法 === "lineStyle" && 项.参数[0] === 2.5 && 项.参数[2] === 0.55),
    ).toBe(true);
    expect(记录.调用.some((项) => 项.方法 === "fillStyle" && 项.参数[1] === 0.65)).toBe(true);
    expect(项.some((文字) => 文字.文案 === 获取文案("简体中文").返回暂停菜单)).toBe(true);
  } finally {
    配置控件规格({});
    设置预览主题读取();
  }
});

test("操作键与角键规格接线到正式倒角绘制", () => {
  设置预览主题读取(() => 默认设置);
  try {
    配置控件规格({ 角键: { 切角: 5, 描边宽: 3.25, 面透明度: 0.77 }, 操作键: { 切角: 4, 下沉: 7 } });
    const 角 = 创建记录图形();
    绘制图标角键(角.图形, { 左: 10, 上: 20, 宽: 64, 高: 48 }, "暂停");
    expect(角.调用.some((项) => 项.方法 === "lineStyle" && 项.参数[0] === 3.25)).toBe(true);
    expect(角.调用.some((项) => 项.方法 === "fillStyle" && 项.参数[1] === 0.77)).toBe(true);

    const 布局 = 计算对局布局(390, 844, { 模式: "马拉松", 阶段: "进行中" });
    const 键 = 布局.操作区.键.find((项) => 项.名称 === "左转");
    expect(键).toBeDefined();
    if (!键) throw new Error("缺少左转键");
    const 轮廓 = 生成操作键轮廓(键, 0, 0, 60, 50);
    expect(轮廓[0]?.x).toBe(4);
    const 键绘 = 创建记录图形();
    绘制操作键(键绘.图形, 键, true);
    expect(键绘.调用.some((项) => 项.方法 === "translateCanvas" && 项.参数[1] === 7)).toBe(true);
  } finally {
    配置控件规格({});
    设置预览主题读取();
  }
});

function 启用立体主题() {
  const 设置 = { ...默认设置, 主题选择: 立体主题名 };
  设置预览主题读取(
    () => 设置,
    () => 解析游戏主题(设置, 立体主题名),
  );
}

test("立体晶格按钮参数接到金属板切角、描边和透明度", () => {
  启用立体主题();
  try {
    配置控件规格({
      按钮: { 圆角: 20, 描边宽: 4, 面板透明度: 0.4, 描边透明度: 0.22, 下沉: 8 },
    });
    const 记录 = 创建记录图形();
    绘制常规按钮(记录.图形, 100, 80, 200, 50, { 变体: "普通" });
    const 板点 = 记录.调用.filter((项) => 项.方法 === "fillPoints")[1]?.参数[0] as
      | { x: number }[]
      | undefined;
    expect(板点?.[0]?.x).toBe(20);
    expect(记录.调用.some((项) => 项.方法 === "fillStyle" && 项.参数[1] === 0.4)).toBe(true);
    expect(
      记录.调用.some((项) => 项.方法 === "lineStyle" && 项.参数[0] === 4 && 项.参数[2] === 0.22),
    ).toBe(true);
    const 按下 = 创建记录图形();
    绘制常规按钮(按下.图形, 100, 80, 200, 50, { 变体: "普通", 按下: true });
    const 原点 = 记录.调用.filter((项) => 项.方法 === "fillPoints")[1]?.参数[0] as { y: number }[];
    const 按下点 = 按下.调用.filter((项) => 项.方法 === "fillPoints")[1]?.参数[0] as {
      y: number;
    }[];
    expect(按下点?.[0]?.y).toBe((原点?.[0]?.y ?? 0) + 8);
  } finally {
    配置控件规格({});
    设置预览主题读取();
  }
});

test("立体晶格操作键切角、描边和下沉读控件规格", () => {
  启用立体主题();
  try {
    配置控件规格({
      操作键: { 切角: 4, 描边宽: 3.5, 面透明度: 0.5, 描边透明度: 0.3, 下沉: 7, 厚度: 2 },
      角键: { 描边宽: 2.25, 面透明度: 0.61 },
    });
    const 角 = 创建记录图形();
    绘制图标角键(角.图形, { 左: 10, 上: 20, 宽: 64, 高: 48 }, "暂停");
    expect(角.调用.some((项) => 项.方法 === "lineStyle" && 项.参数[0] === 2.25)).toBe(true);
    expect(角.调用.some((项) => 项.方法 === "fillStyle" && 项.参数[1] === 0.61)).toBe(true);

    const 布局 = 计算对局布局(390, 844, { 模式: "马拉松", 阶段: "进行中" });
    const 键 = 布局.操作区.键.find((项) => 项.名称 === "左转");
    expect(键).toBeDefined();
    if (!键) throw new Error("缺少左转键");
    const 轮廓 = 生成操作键轮廓(键, 0, 0, 60, 50);
    expect(轮廓[0]?.x).toBe(4);
    const 抬起 = 创建记录图形();
    绘制操作键(抬起.图形, 键, false);
    expect(
      抬起.调用.some((项) => 项.方法 === "lineStyle" && 项.参数[0] === 3.5 && 项.参数[2] === 0.3),
    ).toBe(true);
    expect(抬起.调用.some((项) => 项.方法 === "fillStyle" && 项.参数[1] === 0.5)).toBe(true);
    const 键绘 = 创建记录图形();
    绘制操作键(键绘.图形, 键, true);
    expect(键绘.调用.some((项) => 项.方法 === "translateCanvas" && 项.参数[1] === 7)).toBe(true);
  } finally {
    配置控件规格({});
    设置预览主题读取();
  }
});
