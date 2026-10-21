import { expect, test } from "bun:test";
import { Texture } from "three";
import { 创建画笔, type 资源层 } from "../代码/three版/画笔/index";
import { Three图形 } from "../代码/three版/画笔/Three图形";
import {
  创建文字服务,
  type 文字图集接口,
  计算光栅像素比,
  计算对齐像素,
} from "../代码/three版/画笔/文字服务";
import type {
  三角形状,
  四边形状,
  图元写入接口,
  紫外线矩形,
  顶点颜色,
} from "../框架Three/界面/图元合批";
import type { 文字图集选项 } from "../框架Three/界面/文字图集";
import type { 文字样式, 点, 矩形 } from "../框架Three/界面/绘制/协议";
import { 混合模式 } from "../框架Three/界面/绘制/协议";

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
    读取纯色: () => 设置纯色.at(-1) ?? null,
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

test("描边扩成线段四边形，折点补外侧 bevel，线宽随画布缩放", () => {
  const { 图形, 三角形 } = 创建图形();
  图形.lineStyle(4, 0xffffff, 0.5).setAlpha(0.5).strokeRect(0, 0, 10, 10);
  // 4 段 × 2 三角形 + 4 个折点外侧 bevel × 1 = 12（逐点圆点会让圆角描边膨胀十几倍）。
  expect(三角形.length).toBe(12);
  const 颜色 = 三角形[0]?.顶点[0]?.颜色;
  expect(颜色?.[0]).toBeCloseTo(1);
  expect(颜色?.[3]).toBeCloseTo(0.25);

  三角形.length = 0;
  图形.lineBetween(0, 0, 20, 0);
  // 线段 2 个三角形；端点不再画圆帽（与 Phaser 平头描边一致）。
  expect(三角形.length).toBe(2);

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
  expect(三角形.length).toBeGreaterThanOrEqual(2);

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
  选项: 文字图集选项;
  调用: { 文本: string; 左: number; 上: number; 颜色: 顶点颜色; 纹理序号: number | undefined }[];
  销毁次数: number;
}

function 假图集工厂(记录表: 假图集记录[]) {
  return (选项: 文字图集选项): 文字图集接口 => {
    const 记录: 假图集记录 = {
      字号: 选项.字号,
      字重: 选项.字重 ?? "normal",
      选项,
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
  // 默认画布 1x：文字按 Phaser 同口径的 2x 光栅，并 2 纹理像素对齐，便于整数设备像素映射。
  expect(图集记录[1]?.选项).toMatchObject({
    像素比: 2,
    对齐像素: 2,
    页面边长: 256,
  });
  // DPR1 不再预烘焙整份中文超集，改为按实际字符懒烘焙。
  expect(图集记录[1]?.选项.预烘焙字符集).toBeUndefined();
  expect(登记[1]?.键).toBe("文字/字体A|14|常规|2#1");
  expect(登记[1]?.字节).toBe(256 * 256 * 4);
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

// —— 画笔裁剪：滚动容器自绘内容用（压入可视矩形，图形/文字/图片统一裁剪） ——

test("画笔裁剪：四边形按矩形裁剪并重映射 UV，嵌套取交集，弹出/重置恢复", () => {
  const 记录 = 记录合批();
  const 图集记录: 假图集记录[] = [];
  const 文字 = 创建文字服务({
    登记纹理: () => () => undefined,
    创建图集: 假图集工厂(图集记录),
  });
  const 资源层: 资源层 = {
    读取帧: () => ({ 页: 0, 紫外线: { u: 0, v: 0, 宽: 0.5, 高: 0.5 }, 源宽: 100, 源高: 100 }),
    读取页纹理: () => new Texture(),
    读取散图: () => ({ 纹理: new Texture(), 宽: 100, 高: 100 }),
    读取统计: () => ({ 图集数: 1, 页数: 1, 帧数: 1, 纹理字节: 0, 散图数: 1 }),
    销毁: () => undefined,
  };
  const 画笔 = 创建画笔({ 合批: 记录.合批, 文字服务: 文字, 资源层 });

  // 裁剪一半：方块只保留右半，纹理 UV 跟着重映射。
  画笔.压入裁剪({ 左: 50, 上: 0, 宽: 100, 高: 100 });
  画笔.绘制散图("图标", { 左: 0, 上: 0, 宽: 100, 高: 100 });
  const 裁剪后 = 记录.四边形.at(-1);
  expect(裁剪后).toMatchObject({ 左: 50, 上: 0, 宽: 50, 高: 100 });
  expect(裁剪后?.紫外线).toMatchObject({ u: 0.5, v: 0, 宽: 0.5, 高: 1 });

  // 图形写入同样被裁剪：轴对齐矩形求交（裁剪写入器把纯色块转成裁剪后的四边形）。
  画笔.图形.fillStyle(0xffffff).fillRect(90, 10, 100, 100);
  expect(记录.四边形.at(-1)).toMatchObject({ 左: 90, 上: 10, 宽: 60, 高: 90 });

  // 嵌套裁剪取交集：内层可见区只有 (50..70, 0..60)。
  画笔.压入裁剪({ 左: 0, 上: 0, 宽: 70, 高: 60 });
  画笔.图形.fillRect(0, 0, 100, 100);
  expect(记录.四边形.at(-1)).toMatchObject({ 左: 50, 上: 0, 宽: 20, 高: 60 });
  画笔.弹出裁剪();
  画笔.图形.fillRect(0, 0, 100, 100);
  expect(记录.四边形.at(-1)).toMatchObject({ 左: 50, 上: 0, 宽: 50, 高: 100 });

  // 弹出到栈空恢复整幅；重置也清空裁剪栈。
  画笔.弹出裁剪();
  画笔.图形.fillRect(0, 0, 100, 100);
  expect(记录.纯色.at(-1)).toMatchObject({ 左: 0, 上: 0, 宽: 100, 高: 100 });
  画笔.压入裁剪({ 左: 0, 上: 0, 宽: 10, 高: 10 });
  画笔.重置();
  画笔.图形.fillRect(0, 0, 100, 100);
  expect(记录.纯色.at(-1)).toMatchObject({ 左: 0, 上: 0, 宽: 100, 高: 100 });
});

test("画笔裁剪：三角形逐顶点裁剪后仍保留颜色/UV 插值", () => {
  const 记录 = 记录合批();
  const 图集记录: 假图集记录[] = [];
  const 文字 = 创建文字服务({
    登记纹理: () => () => undefined,
    创建图集: 假图集工厂(图集记录),
  });
  const 资源层: 资源层 = {
    读取帧: () => undefined,
    读取页纹理: () => undefined,
    读取散图: () => undefined,
    读取统计: () => ({ 图集数: 0, 页数: 0, 帧数: 0, 纹理字节: 0, 散图数: 0 }),
    销毁: () => undefined,
  };
  const 画笔 = 创建画笔({ 合批: 记录.合批, 文字服务: 文字, 资源层 });
  画笔.压入裁剪({ 左: 50, 上: 0, 宽: 100, 高: 100 });
  画笔.图形.fillGradientStyle(0xff0000, 0xff0000, 0x0000ff, 0x0000ff).fillRect(0, 0, 100, 100);
  expect(记录.三角形.length).toBeGreaterThan(0);
  // 所有三角形顶点都在裁剪区内，且颜色仍是渐变端点色。
  for (const 形 of 记录.三角形)
    for (const 顶点 of 形.顶点) {
      expect(顶点.x).toBeGreaterThanOrEqual(50 - 1e-6);
      expect(顶点.y).toBeGreaterThanOrEqual(-1e-6);
    }
  const 顶点列表 = 记录.三角形.flatMap((形) => 形.顶点);
  const 左半 = 顶点列表.filter((顶点) => 顶点.x <= 50 + 1e-6);
  expect(左半.length).toBeGreaterThan(0);
  // 渐变在 0..100 上从红插值到蓝（上红下蓝）：裁剪后颜色仍在范围内，
  // 且左边界中点 (50, 50) 的红色分量约 0.5，证明裁剪点做了属性插值。
  for (const 顶点 of 顶点列表) {
    expect(顶点.颜色?.[0]).toBeGreaterThanOrEqual(-1e-6);
    expect(顶点.颜色?.[0]).toBeLessThanOrEqual(1.0001);
    expect(顶点.颜色?.[3]).toBeGreaterThan(0.99);
  }
  const 边界中点 = 顶点列表.find(
    (顶点) => Math.abs(顶点.x - 50) < 0.01 && Math.abs(顶点.y - 50) < 0.01,
  );
  expect(边界中点?.颜色?.[0]).toBeCloseTo(0.5);
  画笔.弹出裁剪();
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
    开始帧: () => undefined,
    结束帧: () => undefined,
    设置像素比: () => undefined,
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

test("高清文字按需光栅并在倍率变化后提交完旧帧再释放", () => {
  const 选项表: 文字图集选项[] = [];
  const 记录: 假图集记录[] = [];
  const 移除: string[] = [];
  const 服务 = 创建文字服务({
    像素比: 3,
    登记纹理: () => () => undefined,
    移除纹理: (键) => 移除.push(键),
    创建图集: (选项) => {
      选项表.push(选项);
      return 假图集工厂(记录)(选项);
    },
  });
  服务.开始帧();
  服务.测量("高清文字", { 字号: 18, 颜色: 0xffffff });
  expect(选项表[1]).toMatchObject({ 像素比: 3, 页面边长: 256 });
  expect(选项表[1]?.预烘焙字符集).toBeUndefined();
  expect(服务.读取统计().图集列表[1]?.键).toEndWith("|3");
  服务.设置像素比(2);
  expect(记录[1]?.销毁次数).toBe(0);
  服务.结束帧();
  expect(记录[1]?.销毁次数).toBe(1);
  expect(移除.length).toBe(1);
  服务.开始帧();
  服务.测量("新倍率", { 字号: 18, 颜色: 0xffffff });
  expect(选项表[2]?.像素比).toBe(2);
  expect(() => 服务.设置像素比(Number.NaN)).toThrow();
  服务.销毁();
});

test("文字光栅像素比对齐 Phaser 最低分辨率 2，DPR1 也按 2x 光栅", () => {
  expect(计算光栅像素比(1)).toBe(2);
  expect(计算光栅像素比(2)).toBe(2);
  expect(计算光栅像素比(3)).toBe(3);
  expect(计算光栅像素比(1.5)).toBe(2);
  expect(计算对齐像素(2, 1)).toBe(2);
  expect(计算对齐像素(2, 2)).toBe(1);
  expect(计算对齐像素(3, 3)).toBe(1);
  expect(计算对齐像素(2, 1.5)).toBe(1);
  expect(() => 计算光栅像素比(0)).toThrow(/像素比/);
});

test("DPR1 文字四边形落在整数设备像素上，DPR2 落在半像素网格上", () => {
  const 环境 = (画布像素比: number) => {
    const 四边形: { 左: number; 上: number; 宽: number; 高: number }[] = [];
    const 选项表: 文字图集选项[] = [];
    const 服务 = 创建文字服务({
      像素比: 画布像素比,
      登记纹理: () => () => undefined,
      创建图集: (选项) => {
        选项表.push(选项);
        const 页面边长 = 选项.页面边长 ?? 1024;
        const 纹理 = new Texture();
        const 测量 = (文本: string) => Array.from(文本).length * 10;
        return {
          注册: () => undefined,
          读取纹理: () => 纹理,
          读取纯色紫外线: () => 白块,
          读取行高: () => 20,
          测量,
          排版: (文本: string) => ({
            行: [{ 文本, 宽: 测量(文本), 字形: [] }],
            宽: 测量(文本),
            高: 20,
          }),
          // 真实图集按字形包围盒写四边形，位置带亚像素偏移；这里模拟 0.4/0.6 的偏移。
          绘制: (合批, 文本, 绘制选项) => {
            for (const _字符 of 文本)
              合批.添加({
                左: 绘制选项.左 + 3.4,
                上: 绘制选项.上 + 2.6,
                宽: 9,
                高: 13,
                纹理: 绘制选项.纹理序号,
              });
            return { 行: [], 宽: 0, 高: 0 };
          },
          读取统计: () => ({
            页数: 1,
            字形数: 0,
            页面边长,
            纹理字节: 页面边长 * 页面边长 * 4,
          }),
          销毁: () => undefined,
        };
      },
    });
    const 合批: 图元写入接口 = {
      添加: (形: 四边形状) => {
        四边形.push({ 左: 形.左, 上: 形.上, 宽: 形.宽, 高: 形.高 });
        return true;
      },
      添加三角形: () => true,
      注册纹理: () => 0,
    };
    const 样式: 文字样式 = { 字号: 14, 颜色: 0xffffff };
    服务.绘制(合批, { 文案: "AB", 样式, 锚点: "左上", x: 10.3, y: 20.7 });
    return { 服务, 四边形, 选项表 };
  };

  const 低清 = 环境(1);
  expect(低清.选项表[1]).toMatchObject({ 像素比: 2, 对齐像素: 2 });
  expect(低清.四边形.length).toBe(2);
  for (const 形 of 低清.四边形) {
    expect(形.左).toBe(Math.round(形.左));
    expect(形.上).toBe(Math.round(形.上));
  }
  低清.服务.销毁();

  const 高清 = 环境(2);
  expect(高清.选项表[1]).toMatchObject({ 像素比: 2, 对齐像素: 1 });
  for (const 形 of 高清.四边形) {
    // DPR2 的设备像素网格是逻辑像素的一半。
    expect(形.左 * 2).toBe(Math.round(形.左 * 2));
    expect(形.上 * 2).toBe(Math.round(形.上 * 2));
  }
  高清.服务.销毁();
});

test("画布倍率变化不改光栅倍率时复用字形图集，改光栅倍率时提交后重建", () => {
  const 记录: 假图集记录[] = [];
  const 服务 = 创建文字服务({
    像素比: 2,
    登记纹理: () => () => undefined,
    创建图集: 假图集工厂(记录),
  });
  服务.开始帧();
  服务.测量("甲", { 字号: 14, 颜色: 0xffffff });
  expect(记录.length).toBe(2);
  // 2x → 1.5x 画布：光栅倍率仍是 2、也不需要整数倍对齐，图集可继续复用。
  服务.设置像素比(1.5);
  服务.结束帧();
  expect(记录[1]?.销毁次数).toBe(0);
  服务.测量("甲", { 字号: 14, 颜色: 0xffffff });
  expect(记录.length).toBe(2);
  // 1.5x → 3x 画布：光栅倍率变 3，旧图集提交后释放、按新倍率重建。
  服务.开始帧();
  服务.测量("甲", { 字号: 14, 颜色: 0xffffff });
  服务.设置像素比(3);
  服务.结束帧();
  expect(记录[1]?.销毁次数).toBe(1);
  服务.测量("甲", { 字号: 14, 颜色: 0xffffff });
  expect(记录.length).toBe(3);
  expect(记录[2]?.选项.像素比).toBe(3);
  服务.销毁();
});

test("文字预算只淘汰本帧未使用的图集，纯色白块和本帧文字受保护", () => {
  const 记录: 假图集记录[] = [];
  const 服务 = 创建文字服务({
    像素比: 2,
    纹理预算字节: 64 ** 2 * 4 + 256 ** 2 * 4 * 2,
    登记纹理: () => () => undefined,
    创建图集: 假图集工厂(记录),
  });
  服务.开始帧();
  服务.测量("甲", { 字号: 14, 颜色: 0xffffff });
  服务.测量("乙", { 字号: 15, 颜色: 0xffffff });
  expect(() => 服务.测量("丙", { 字号: 16, 颜色: 0xffffff })).toThrow(/预算不足/);
  服务.结束帧();
  服务.开始帧();
  服务.测量("丙", { 字号: 16, 颜色: 0xffffff });
  expect(记录[0]?.销毁次数).toBe(0);
  expect(记录[1]?.销毁次数).toBe(1);
  expect(服务.读取统计().图集数).toBe(3);
  服务.销毁();
});

test("文字页扩容保留已见字符和旧帧纹理，提交后才回收旧页", () => {
  const 选项表: 文字图集选项[] = [];
  const 记录: 假图集记录[] = [];
  const 服务 = 创建文字服务({
    像素比: 2,
    登记纹理: () => () => undefined,
    创建图集: (选项) => {
      选项表.push(选项);
      const 图集 = 假图集工厂(记录)(选项);
      const 字符 = new Set(选项.预烘焙字符集 ?? "");
      return {
        ...图集,
        注册: (文本) => {
          for (const 字 of 文本) 字符.add(字);
          if (选项.页面边长 === 256 && 字符.size > 2) throw new Error("页已满");
        },
      };
    },
  });
  服务.开始帧();
  const 样式: 文字样式 = { 字号: 18, 颜色: 0xffffff };
  服务.测量("AB", 样式);
  服务.测量("CDE", 样式);
  expect(选项表[2]).toMatchObject({ 页面边长: 512, 预烘焙字符集: "ABCDE" });
  expect(记录[1]?.销毁次数).toBe(0);
  服务.结束帧();
  expect(记录[1]?.销毁次数).toBe(1);
  expect(记录[2]?.销毁次数).toBe(0);
  服务.销毁();
});
