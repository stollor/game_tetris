import { expect, test } from "bun:test";
import { Texture } from "three";
import { 创建画笔, type 资源层 } from "../代码/three版/画笔/index";
import { Three图形 } from "../代码/three版/画笔/Three图形";
import { 创建文字服务, type 文字图集接口 } from "../代码/three版/画笔/文字服务";
import type {
  三角形状,
  四边形状,
  图元写入接口,
  紫外线矩形,
  顶点颜色,
} from "../框架Three/界面/图元合批";
import type { 文字样式, 点, 矩形 } from "../组件/绘制/图形对象";
import { 混合模式 } from "../组件/绘制/图形对象";

/**
 * Three 画笔规则测试：用记录型假合批断言「配方指令 → 三角形/颜色/UV/变换」，
 * 用假文字图集断言按 (字体,字号,字重) 懒烘焙、描边/阴影副本数与锚点/折行/字距，
 * 用假资源层断言图集帧/散图的 UV 与透明度接线。Bun 里没有 canvas/WebGL，所以不实例化真实图集。
 */

const 白块: 紫外线矩形 = { u: 0.1, v: 0.1, 宽: 0.2, 高: 0.2 };
const 白块中心U = 0.2;
const 白块中心V = 0.2;

interface 纯色记录 {
  左: number;
  上: number;
  宽: number;
  高: number;
  颜色: 顶点颜色;
  混合: "普通" | "叠加" | undefined;
}

function 记录合批() {
  const 纯色: 纯色记录[] = [];
  const 三角形: 三角形状[] = [];
  const 四边形: 四边形状[] = [];
  const 注册纹理: string[] = [];
  const 设置纯色: { 纹理?: number; 紫外线: 紫外线矩形 }[] = [];
  const 清空图层: number[] = [];
  const 状态 = { 图层: 0, 下一个纹理: 0 };
  const 合批 = {
    添加: (形: 四边形状) => {
      四边形.push(形);
      return true;
    },
    添加四边形: (形: 四边形状) => {
      四边形.push(形);
      return true;
    },
    添加三角形: (形: 三角形状) => {
      三角形.push(形);
      return true;
    },
    添加纯色: (
      左: number,
      上: number,
      宽: number,
      高: number,
      颜色: 顶点颜色,
      混合?: "普通" | "叠加",
    ) => {
      纯色.push({ 左, 上, 宽, 高, 颜色, 混合 });
      return true;
    },
    注册纹理: (键: string) => {
      注册纹理.push(键);
      return 状态.下一个纹理++;
    },
    读取图层: () => 状态.图层,
    清空图层: (图层: number) => {
      清空图层.push(图层);
      return 1;
    },
    设置纯色: (图案: { 纹理?: number; 紫外线: 紫外线矩形 }) => {
      设置纯色.push(图案);
    },
  };
  return { 纯色, 三角形, 四边形, 注册纹理, 设置纯色, 清空图层, 状态, 合批 };
}

function 创建图形() {
  const 记录 = 记录合批();
  const 图形 = new Three图形({
    合批: 记录.合批,
    纯色紫外线: 白块,
    纯色纹理序号: 3,
  });
  return { 图形, ...记录 };
}

function 三角形总面积(三角形: 三角形状[]): number {
  let 合计 = 0;
  for (const 形 of 三角形) {
    const [甲, 乙, 丙] = 形.顶点;
    合计 += Math.abs((乙.x - 甲.x) * (丙.y - 甲.y) - (乙.y - 甲.y) * (丙.x - 甲.x)) / 2;
  }
  return 合计;
}

test("纯色轴对齐矩形走白块四边形，alpha 乘算，混合模式映射叠加", () => {
  const { 图形, 纯色 } = 创建图形();
  图形.fillStyle(0xff8000, 0.5).setAlpha(0.5).fillRect(10, 20, 100, 50);
  expect(纯色.length).toBe(1);
  const 矩形记录 = 纯色[0];
  if (!矩形记录) throw new Error("应写入纯色矩形");
  expect(矩形记录).toMatchObject({ 左: 10, 上: 20, 宽: 100, 高: 50 });
  expect(矩形记录.颜色[0]).toBeCloseTo(1);
  expect(矩形记录.颜色[1]).toBeCloseTo(128 / 255);
  expect(矩形记录.颜色[2]).toBeCloseTo(0);
  expect(矩形记录.颜色[3]).toBeCloseTo(0.25);

  图形.setBlendMode(混合模式.叠加).fillRect(0, 0, 10, 10);
  expect(纯色[1]?.混合).toBe("叠加");
  图形.setBlendMode(混合模式.普通).fillRect(0, 0, 10, 10);
  expect(纯色[2]?.混合).toBe("普通");
  expect(() => 图形.setBlendMode(9)).toThrow(/混合模式/);
  // 宽高非正时不写图元。
  图形.fillRect(0, 0, 0, 10);
  expect(纯色.length).toBe(3);
});

test("变换栈影响后续图元，save/restore 还原矩阵", () => {
  const { 图形, 纯色, 三角形 } = 创建图形();
  图形.fillStyle(0xffffff).translateCanvas(5, 7).fillRect(0, 0, 10, 10);
  expect(纯色[0]).toMatchObject({ 左: 5, 上: 7, 宽: 10, 高: 10 });

  图形.save().translateCanvas(100, 200).scaleCanvas(2).fillRect(1, 2, 3, 4);
  expect(纯色[1]).toMatchObject({ 左: 107, 上: 211, 宽: 6, 高: 8 });
  图形.restore().fillRect(0, 0, 10, 10);
  expect(纯色[2]).toMatchObject({ 左: 5, 上: 7, 宽: 10, 高: 10 });

  // 旋转后的矩形不能再走轴对齐快捷路径，必须折成三角形。
  三角形.length = 0;
  图形.rotateCanvas(Math.PI / 2).fillRect(0, 0, 10, 10);
  expect(纯色.length).toBe(3);
  expect(三角形.length).toBe(2);
  const 位置 = new Set(
    三角形.flatMap((形) => 形.顶点.map((项) => `${项.x.toFixed(3)},${项.y.toFixed(3)}`)),
  );
  // rotate(90°) 后 (x,y) → (-y,x)，平移 (5,7) 仍在：四角落在旋转后的位置。
  expect(位置.has("5.000,7.000")).toBe(true);
  expect(位置.has("-5.000,17.000")).toBe(true);

  // restore 空栈不抛错。
  图形.restore();
});

test("圆/椭圆/圆角矩形折线近似，凹多边形 ear-clipping 不填出轮廓", () => {
  const { 图形, 三角形 } = 创建图形();
  图形.fillStyle(0x00e5ff).fillCircle(0, 0, 10);
  expect(三角形.length).toBe(30);
  expect(三角形[0]?.顶点[0]?.u).toBeCloseTo(白块中心U);
  expect(三角形[0]?.顶点[0]?.v).toBeCloseTo(白块中心V);
  expect(三角形[0]?.纹理).toBe(3);

  三角形.length = 0;
  图形.fillEllipse(0, 0, 40, 20);
  expect(三角形.length).toBe(30);

  三角形.length = 0;
  图形.fillRoundedRect(0, 0, 100, 40, 10);
  expect(三角形.length).toBe(14);
  // 圆角矩形面积 = 矩形面积 − 4 个圆角缺口；折线近似后每个角有约 14/4 的额外切角。
  expect(三角形总面积(三角形)).toBeCloseTo(3900, 0);

  // L 形凹多边形：面积必须等于 30×10 + 10×20 = 500，且三角形顶点全部来自轮廓点。
  三角形.length = 0;
  const L形: 点[] = [
    { x: 0, y: 0 },
    { x: 30, y: 0 },
    { x: 30, y: 10 },
    { x: 10, y: 10 },
    { x: 10, y: 30 },
    { x: 0, y: 30 },
  ];
  图形.fillPoints(L形);
  expect(三角形总面积(三角形)).toBeCloseTo(500);
  expect(三角形.length).toBe(4);
  const 轮廓 = new Set(L形.map((项) => `${项.x},${项.y}`));
  for (const 形 of 三角形) for (const 项 of 形.顶点) expect(轮廓.has(`${项.x},${项.y}`)).toBe(true);
});

test("渐变矩形按网格逐顶点插值，四角颜色精确", () => {
  const { 图形, 三角形 } = 创建图形();
  图形
    .fillGradientStyle(0xff0000, 0xff0000, 0x0000ff, 0x0000ff, 1, 1, 0.5, 0.5)
    .fillRect(0, 0, 100, 100);
  // 100×100 用 2×2 分段（每边 ceil(100/64)=2）→ 8 个三角形，四角颜色仍精确。
  expect(三角形.length).toBe(8);
  const 顶点列表 = 三角形.flatMap((形) => 形.顶点);
  const 左上 = 顶点列表.find((项) => 项.x === 0 && 项.y === 0);
  const 右下 = 顶点列表.find((项) => 项.x === 100 && 项.y === 100);
  expect(左上?.颜色?.[0]).toBeCloseTo(1);
  expect(左上?.颜色?.[2]).toBeCloseTo(0);
  expect(右下?.颜色?.[2]).toBeCloseTo(1);
  expect(右下?.颜色?.[3]).toBeCloseTo(0.5);

  // 路径填充：按包围盒双线性取每顶点色。
  三角形.length = 0;
  图形.fillGradientStyle(0xffffff, 0xffffff, 0xffffff, 0xffffff).fillCircle(0, 0, 20);
  expect(三角形.length).toBe(30);
  expect(三角形[0]?.顶点[0]?.颜色?.[0]).toBeCloseTo(1);
});

test("描边扩成线段四边形并补圆角连接/端点，线宽随画布缩放", () => {
  const { 图形, 三角形 } = 创建图形();
  图形.lineStyle(4, 0xffffff, 0.5).setAlpha(0.5).strokeRect(0, 0, 10, 10);
  // 4 段 × 2 三角形 + 4 个连接圆点 × 8 = 40。
  expect(三角形.length).toBe(40);
  const 颜色 = 三角形[0]?.顶点[0]?.颜色;
  expect(颜色?.[0]).toBeCloseTo(1);
  expect(颜色?.[3]).toBeCloseTo(0.25);

  三角形.length = 0;
  图形.lineBetween(0, 0, 20, 0);
  // 线段 2 + 两个端点圆点 2×8。
  expect(三角形.length).toBe(18);

  // 缩放 2 倍后线宽翻倍：同一线段两侧顶点的间距 = 线宽 × 缩放。
  三角形.length = 0;
  图形.scaleCanvas(2).strokeCircle(0, 0, 10);
  const 第二块 = 三角形[1]?.顶点;
  if (!第二块) throw new Error("描边应写入三角形");
  expect(Math.hypot(第二块[2].x - 第二块[0].x, 第二块[2].y - 第二块[0].y)).toBeCloseTo(8);
});

test("路径 API 累积折线，fillPath 三角化、strokePath 描边，arc 追加圆弧，clear 只清当前图层", () => {
  const { 图形, 三角形 } = 创建图形();
  图形
    .fillStyle(0xffffff)
    .beginPath()
    .moveTo(0, 0)
    .lineTo(20, 0)
    .lineTo(20, 20)
    .lineTo(0, 20)
    .closePath()
    .fillPath();
  expect(三角形.length).toBe(2);
  expect(三角形总面积(三角形)).toBeCloseTo(400);

  三角形.length = 0;
  图形.lineStyle(2, 0xffffff).beginPath().moveTo(0, 0).lineTo(20, 0).strokePath();
  expect(三角形.length).toBeGreaterThan(2);

  三角形.length = 0;
  图形.fillStyle(0xffffff).beginPath().moveTo(0, 0);
  图形.arc(0, 0, 10, 0, Math.PI / 2);
  图形.lineTo(0, 0).closePath().fillPath();
  expect(三角形.length).toBeGreaterThan(4);

  // clear 只清当前图层，交回合批执行。
  const { 图形: 图形二, 清空图层, 状态 } = 创建图形();
  状态.图层 = 2;
  图形二.clear();
  expect(清空图层).toEqual([2]);
});

test("重置把 alpha/混合/变换/路径恢复到默认，避免上一页状态漏到下一页", () => {
  const { 图形, 纯色 } = 创建图形();
  图形.fillStyle(0xffffff).setAlpha(0.3).setBlendMode(1).translateCanvas(10, 10);
  expect(图形.读取透明度()).toBeCloseTo(0.3);
  expect(图形.读取混合方式()).toBe("叠加");
  图形.重置();
  图形.fillStyle(0xffffff);
  expect(图形.读取透明度()).toBe(1);
  expect(图形.读取混合方式()).toBe("普通");
  expect(图形.读取矩阵()).toEqual({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 });
  图形.fillRect(1, 2, 3, 4);
  expect(纯色.at(-1)).toMatchObject({ 左: 1, 上: 2, 宽: 3, 高: 4 });
});

// —— 文字服务：假图集注入 ——

interface 假图集记录 {
  字号: number;
  字重: string;
  调用: { 文本: string; 左: number; 上: number; 颜色: 顶点颜色; 纹理序号: number | undefined }[];
  销毁次数: number;
}

function 假图集工厂(记录表: 假图集记录[]) {
  return (选项: { 字号: number; 字重?: "normal" | "bold"; 页面边长?: number }): 文字图集接口 => {
    const 记录: 假图集记录 = {
      字号: 选项.字号,
      字重: 选项.字重 ?? "normal",
      调用: [],
      销毁次数: 0,
    };
    记录表.push(记录);
    const 页面边长 = 选项.页面边长 ?? 1024;
    const 纹理 = new Texture();
    return {
      注册: () => undefined,
      读取纹理: () => 纹理,
      读取纯色紫外线: () => 白块,
      读取行高: () => 20,
      测量: (文本: string) => Array.from(文本).length * 10,
      排版: (文本: string) => ({
        行: [{ 文本, 宽: Array.from(文本).length * 10, 字形: [] }],
        宽: Array.from(文本).length * 10,
        高: 20,
      }),
      绘制: (_合批, 文本, 绘制选项) => {
        记录.调用.push({
          文本,
          左: 绘制选项.左,
          上: 绘制选项.上,
          颜色: 绘制选项.颜色 ?? [1, 1, 1, 1],
          纹理序号: 绘制选项.纹理序号,
        });
        return { 行: [], 宽: 0, 高: 0 };
      },
      读取统计: () => ({ 页数: 1, 字形数: 0, 页面边长, 纹理字节: 页面边长 * 页面边长 * 4 }),
      销毁: () => {
        记录.销毁次数++;
      },
    };
  };
}

function 文字测试环境() {
  const 图集记录: 假图集记录[] = [];
  const 登记: { 键: string; 字节: number; 释放次数: number }[] = [];
  const 合批: 图元写入接口 = {
    添加: () => true,
    添加三角形: () => true,
    注册纹理: () => 0,
  };
  const 服务 = 创建文字服务({
    登记纹理: (键, _纹理, 字节) => {
      const 项 = { 键, 字节, 释放次数: 0 };
      登记.push(项);
      return () => {
        项.释放次数++;
      };
    },
    创建图集: 假图集工厂(图集记录),
  });
  return { 服务, 图集记录, 登记, 合批 };
}

test("文字服务按 (字体,字号,字重) 懒建图集并登记纹理预算，基础图集只提供白块", () => {
  const { 服务, 图集记录, 登记, 合批 } = 文字测试环境();
  // 基础图集：64 页、无预烘焙、立即登记。
  expect(图集记录.length).toBe(1);
  expect(图集记录[0]?.字号).toBe(14);
  expect(登记[0]?.键).toBe("文字/基础");
  expect(登记[0]?.字节).toBe(64 * 64 * 4);
  expect(服务.读取基础纹理().纹理).toBeInstanceOf(Texture);
  expect(服务.读取纯色紫外线()).toEqual(白块);

  const 样式: 文字样式 = { 字体: "字体A", 字号: 14, 字重: "常规", 颜色: 0xffffff };
  const 尺寸 = 服务.绘制(合批, { 文案: "再消一行", 样式, 锚点: "左上", x: 10, y: 20 });
  expect(尺寸).toEqual({ 宽: 40, 高: 20 });
  expect(图集记录.length).toBe(2);
  expect(图集记录[1]?.字号).toBe(14);
  expect(图集记录[1]?.字重).toBe("normal");
  expect(登记[1]?.键).toBe("文字/字体A|14|常规");
  expect(登记[1]?.字节).toBe(512 * 512 * 4);
  // 第二次同样式复用图集。
  服务.绘制(合批, { 文案: "玩", 样式, 锚点: "左上", x: 0, y: 0 });
  expect(图集记录.length).toBe(2);
  expect(服务.读取统计()).toMatchObject({ 图集数: 2, 页数: 2 });
  expect(服务.读取统计().图集列表.map((项) => 项.字重)).toEqual(["基础", "常规"]);

  服务.销毁();
  expect(登记.every((项) => 项.释放次数 === 1)).toBe(true);
  expect(图集记录.every((项) => 项.销毁次数 === 1)).toBe(true);
});

test("文字项锚点/折行/字距/描边/阴影都落实成图集绘制调用", () => {
  const { 服务, 图集记录, 合批 } = 文字测试环境();
  const 样式: 文字样式 = { 字号: 14, 颜色: "#ffffff" };
  // 锚点「中中」：宽 30、高 20 → 起点 (100-15, 200-10)。
  服务.绘制(合批, { 文案: "abc", 样式, 锚点: "中中", x: 100, y: 200 });
  const 普通调用 = 图集记录[1]?.调用 ?? [];
  expect(普通调用.length).toBe(1);
  expect(普通调用[0]).toMatchObject({ 文本: "abc", 左: 85, 上: 190 });

  // 折行：最大宽 25（每字 10）→ 3 行，每行一次绘制，行距 20。
  const 调色板 = 图集记录[1];
  if (!调色板) throw new Error("应创建样式图集");
  调色板.调用.length = 0;
  服务.绘制(合批, { 文案: "一二三四五六", 样式, 锚点: "左上", x: 0, y: 0, 最大宽: 25 });
  expect(调色板.调用.map((项) => 项.文本)).toEqual(["一二", "三四", "五六"]);
  expect(调色板.调用.map((项) => 项.上)).toEqual([0, 20, 40]);

  // 字距：逐字绘制，位置 = 起点 + i × (字宽 + 字距)。
  调色板.调用.length = 0;
  服务.绘制(合批, { 文案: "abc", 样式: { ...样式, 字距: 5 }, 锚点: "左上", x: 0, y: 0 });
  expect(调色板.调用.map((项) => 项.文本)).toEqual(["a", "b", "c"]);
  expect(调色板.调用.map((项) => 项.左)).toEqual([0, 15, 30]);

  // 描边：8 方向副本 + 正文；阴影再加一层。
  调色板.调用.length = 0;
  服务.绘制(合批, {
    文案: "A",
    样式: { ...样式, 描边: { 颜色: 0x000000, 粗细: 4 } },
    锚点: "左上",
    x: 0,
    y: 0,
  });
  expect(调色板.调用.length).toBe(9);
  expect(调色板.调用.at(-1)?.颜色[3]).toBeCloseTo(1);

  调色板.调用.length = 0;
  服务.绘制(合批, {
    文案: "A",
    样式: {
      ...样式,
      描边: { 颜色: 0x000000, 粗细: 4 },
      阴影: { 颜色: 0x000000, 模糊: 0, 偏移X: 2, 偏移Y: 3 },
    },
    锚点: "左上",
    x: 0,
    y: 0,
  });
  expect(调色板.调用.length).toBe(10);
  expect(调色板.调用[0]).toMatchObject({ 左: 2, 上: 3 });
  // 测量走同一套字距口径。
  expect(服务.测量("abc", { ...样式, 字距: 5 })).toEqual({ 宽: 40, 高: 20 });
});

// —— 画笔接线：图集帧 / 散图 / 文字项 ——

test("画笔把图集帧与散图画成图集 UV 四边形，缺资源返回 false", () => {
  const 记录 = 记录合批();
  const 页纹理 = new Texture();
  const 散图纹理 = new Texture();
  const 帧紫外线: 紫外线矩形 = { u: 0.25, v: 0.5, 宽: 0.125, 高: 0.25 };
  const 资源层: 资源层 = {
    读取帧: (图集, 帧) =>
      图集 === "再消一行" && 帧 === "图标/游戏图标.png"
        ? { 页: 0, 紫外线: 帧紫外线, 源宽: 512, 源高: 512 }
        : undefined,
    读取页纹理: (_图集, 页) => (页 === 0 ? 页纹理 : undefined),
    读取散图: (键) => (键 === "图标/游戏图标" ? { 纹理: 散图纹理, 宽: 512, 高: 512 } : undefined),
    读取统计: () => ({ 图集数: 1, 页数: 1, 帧数: 1, 纹理字节: 512 * 512 * 4, 散图数: 1 }),
    销毁: () => undefined,
  };
  const 文字调用: { 透明度?: number; 混合?: string }[] = [];
  const 文字 = {
    绘制: (_合批: unknown, _项: unknown, 选项?: { 透明度?: number; 混合?: string }) => {
      文字调用.push({ 透明度: 选项?.透明度, 混合: 选项?.混合 });
      return { 宽: 10, 高: 20 };
    },
    测量: () => ({ 宽: 10, 高: 20 }),
    读取纯色紫外线: () => 白块,
    读取基础纹理: () => ({ 键: "文字/基础", 纹理: new Texture() }),
    读取统计: () => ({ 图集数: 1, 页数: 1, 纹理字节: 0, 图集列表: [] }),
    销毁: () => undefined,
  };
  const 画笔 = 创建画笔({ 合批: 记录.合批, 文字服务: 文字, 资源层 });
  expect(记录.设置纯色[0]).toMatchObject({ 纹理: 0, 紫外线: 白块 });
  expect(记录.注册纹理).toEqual(["文字/基础"]);

  const 矩形: 矩形 = { 左: 10, 上: 20, 宽: 200, 高: 200 };
  expect(画笔.绘制纹理帧({ 图集: "再消一行", 帧: "图标/游戏图标.png" }, 矩形, 0.5)).toBe(true);
  const 帧记录 = 记录.四边形.at(-1);
  expect(帧记录?.紫外线).toEqual(帧紫外线);
  expect(帧记录?.纹理).toBe(1);
  expect(帧记录?.颜色?.[3]).toBeCloseTo(0.5);
  expect(记录.注册纹理).toEqual(["文字/基础", "图集/再消一行/0"]);

  expect(画笔.绘制散图("图标/游戏图标", 矩形)).toBe(true);
  expect(记录.四边形.at(-1)?.紫外线).toEqual({ u: 0, v: 0, 宽: 1, 高: 1 });
  expect(画笔.绘制散图("不存在", 矩形)).toBe(false);
  expect(画笔.绘制纹理帧({ 图集: "再消一行", 帧: "缺失.png" }, 矩形)).toBe(false);

  // 图形 alpha/混合带进文字与图片。
  画笔.图形.setAlpha(0.5).setBlendMode(1);
  画笔.绘制文字({ 文案: "A", 样式: { 字号: 14, 颜色: 0xffffff }, 锚点: "左上", x: 0, y: 0 });
  expect(文字调用[0]).toEqual({ 透明度: 0.5, 混合: "叠加" });
  expect(画笔.测量文字("abc", { 字号: 14, 颜色: 0xffffff })).toEqual({ 宽: 10, 高: 20 });
});
