import type {
  三角顶点,
  图元合批,
  混合方式,
  紫外线矩形,
  顶点颜色,
} from "../../../框架Three/界面/图元合批";
import type { 图形对象, 点 } from "../../../组件/绘制/图形对象";
import { 三角化多边形 } from "./三角化";

/** 图形对象真正需要的合批能力：只写图元、登记白块纹理、清当前图层，便于规则测试用记录替身。 */
export type 图形合批接口 = Pick<
  图元合批,
  "添加" | "添加四边形" | "添加三角形" | "添加纯色" | "注册纹理" | "读取图层" | "清空图层"
>;

export interface Three图形选项 {
  合批: 图形合批接口;
  /** 文字图集纯白块紫外线。 */
  纯色紫外线: 紫外线矩形;
  /** 纯白块所在纹理序号。 */
  纯色纹理序号: number;
}

interface 矩阵 {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
}

interface 纯色填充 {
  类型: "纯色";
  颜色: 顶点颜色;
}

interface 渐变填充 {
  类型: "渐变";
  左上: 顶点颜色;
  右上: 顶点颜色;
  左下: 顶点颜色;
  右下: 顶点颜色;
}

type 填充样式 = 纯色填充 | 渐变填充;

interface 描边样式 {
  线宽: number;
  颜色: 顶点颜色;
}

interface 图形状态 {
  填充: 填充样式 | null;
  描边: 描边样式 | null;
  /** 全局透明度，乘进当前颜色 alpha。 */
  透明度: number;
  混合: 混合方式;
  矩阵: 矩阵;
}

interface 子路径 {
  点集: 点[];
  闭合: boolean;
}

const 单位矩阵: 矩阵 = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
const 圆周率 = Math.PI;
const 圆段数 = 32;
const 连接段数 = 8;
const 容差 = 1e-9;

function 初始状态(): 图形状态 {
  return {
    填充: null,
    描边: null,
    透明度: 1,
    混合: "普通",
    矩阵: { ...单位矩阵 },
  };
}

function 复制状态(状态: 图形状态): 图形状态 {
  return {
    填充: 状态.填充 ? { ...状态.填充 } : null,
    描边: 状态.描边 ? { ...状态.描边 } : null,
    透明度: 状态.透明度,
    混合: 状态.混合,
    矩阵: { ...状态.矩阵 },
  };
}

function 矩阵乘(左: 矩阵, 右: 矩阵): 矩阵 {
  return {
    a: 左.a * 右.a + 左.c * 右.b,
    b: 左.b * 右.a + 左.d * 右.b,
    c: 左.a * 右.c + 左.c * 右.d,
    d: 左.b * 右.c + 左.d * 右.d,
    e: 左.a * 右.e + 左.c * 右.f + 左.e,
    f: 左.b * 右.e + 左.d * 右.f + 左.f,
  };
}

function 变换点(矩阵: 矩阵, x: number, y: number): 点 {
  return { x: 矩阵.a * x + 矩阵.c * y + 矩阵.e, y: 矩阵.b * x + 矩阵.d * y + 矩阵.f };
}

function 限制01(值: number, 名称: string): number {
  if (!Number.isFinite(值)) throw new Error(`${名称}必须是有限数值`);
  return Math.min(1, Math.max(0, 值));
}

/** 0xRRGGBB + alpha → 0..1 四元组（渲染器 LinearSRGB 直通口径）。 */
function 颜色向量(颜色: number, 透明度: number): 顶点颜色 {
  return [((颜色 >> 16) & 0xff) / 255, ((颜色 >> 8) & 0xff) / 255, (颜色 & 0xff) / 255, 透明度];
}

function 乘透明度(颜色: 顶点颜色, 透明度: number): 顶点颜色 {
  return [颜色[0], 颜色[1], 颜色[2], 颜色[3] * 透明度];
}

function 双线性(
  左上: 顶点颜色,
  右上: 顶点颜色,
  左下: 顶点颜色,
  右下: 顶点颜色,
  tx: number,
  上: number,
): 顶点颜色 {
  const 上排: 顶点颜色 = [
    左上[0] + (右上[0] - 左上[0]) * tx,
    左上[1] + (右上[1] - 左上[1]) * tx,
    左上[2] + (右上[2] - 左上[2]) * tx,
    左上[3] + (右上[3] - 左上[3]) * tx,
  ];
  const 下排: 顶点颜色 = [
    左下[0] + (右下[0] - 左下[0]) * tx,
    左下[1] + (右下[1] - 左下[1]) * tx,
    左下[2] + (右下[2] - 左下[2]) * tx,
    左下[3] + (右下[3] - 左下[3]) * tx,
  ];
  return [
    上排[0] + (下排[0] - 上排[0]) * 上,
    上排[1] + (下排[1] - 上排[1]) * 上,
    上排[2] + (下排[2] - 上排[2]) * 上,
    上排[3] + (下排[3] - 上排[3]) * 上,
  ];
}

/** 圆弧采样点（含起点与终点）。0° 指向 +x；y 向下坐标系里角度增大视觉按顺时针转。 */
function 圆弧点(
  圆心X: number,
  圆心Y: number,
  半径X: number,
  半径Y: number,
  起始角: number,
  结束角: number,
  段数: number,
): 点[] {
  const 结果: 点[] = [];
  for (let 序号 = 0; 序号 <= 段数; 序号++) {
    const 角 = 起始角 + ((结束角 - 起始角) * 序号) / 段数;
    结果.push({
      x: 圆心X + Math.cos(角) * 半径X,
      y: 圆心Y + Math.sin(角) * 半径Y,
    });
  }
  return 结果;
}

function 圆角矩形点集(左: number, 上: number, 宽: number, 高: number, 半径: number): 点[] {
  if (宽 <= 0 || 高 <= 0) return [];
  const 圆角 = Math.max(0, Math.min(半径, Math.min(宽, 高) / 2));
  if (圆角 <= 容差) {
    return [
      { x: 左, y: 上 },
      { x: 左 + 宽, y: 上 },
      { x: 左 + 宽, y: 上 + 高 },
      { x: 左, y: 上 + 高 },
    ];
  }
  const 每角段数 = Math.max(2, Math.min(8, Math.ceil(圆角 / 4)));
  const 点集: 点[] = [];
  const 推入 = (列表: readonly 点[]) => {
    for (const 项 of 列表) {
      const 前 = 点集.at(-1);
      if (前 && Math.abs(前.x - 项.x) < 容差 && Math.abs(前.y - 项.y) < 容差) continue;
      点集.push({ x: 项.x, y: 项.y });
    }
  };
  const 右 = 左 + 宽;
  const 下 = 上 + 高;
  // 每个角的圆弧都保留起止点：止点/起点正是相邻直边的端点，跳过会在角上切掉一小块。
  推入([{ x: 左 + 圆角, y: 上 }]);
  推入(圆弧点(右 - 圆角, 上 + 圆角, 圆角, 圆角, -圆周率 / 2, 0, 每角段数));
  推入(圆弧点(右 - 圆角, 下 - 圆角, 圆角, 圆角, 0, 圆周率 / 2, 每角段数));
  推入(圆弧点(左 + 圆角, 下 - 圆角, 圆角, 圆角, 圆周率 / 2, 圆周率, 每角段数));
  推入(圆弧点(左 + 圆角, 上 + 圆角, 圆角, 圆角, 圆周率, 圆周率 * 1.5, 每角段数));
  return 点集;
}

/**
 * `图形对象` 的 Three 后端：把立即模式绘制指令写进 `图元合批`。
 *
 * - 纯色图元复用文字图集白块 UV + 顶点色 tint，不额外开纹理；
 * - 圆/椭圆/圆角/任意多边形用折线近似后 ear-clipping 三角化（凹多边形也不会填出轮廓）；
 * - 描边把每段折线扩成四边形并补圆角连接/端点，线宽随画布缩放；
 * - 四角渐变用网格三角形逐顶点插值（矩形四角精确、路径按包围盒双线性同语义）；
 * - `save/restore` 保存矩阵、填充/描边样式、透明度与混合；`translateCanvas/rotateCanvas/
 *   scaleCanvas` 影响之后的所有图元和路径；
 * - alpha 乘进当前填充/描边透明度；混合 0=普通、1=叠加，与 Phaser 数值语义一致。
 */
export class Three图形 implements 图形对象 {
  private readonly 合批: 图形合批接口;
  private readonly 纯色纹理序号: number;
  private readonly 纯色U: number;
  private readonly 纯色V: number;
  private 状态: 图形状态 = 初始状态();
  private 状态栈: 图形状态[] = [];
  private 路径: 子路径[] = [];
  private 当前子路径: 子路径 | null = null;

  constructor(选项: Three图形选项) {
    this.合批 = 选项.合批;
    this.纯色纹理序号 = 选项.纯色纹理序号;
    this.纯色U = 选项.纯色紫外线.u + 选项.纯色紫外线.宽 / 2;
    this.纯色V = 选项.纯色紫外线.v + 选项.纯色紫外线.高 / 2;
  }

  // —— 样式 ——

  fillStyle(颜色: number, 透明度 = 1): this {
    this.状态.填充 = {
      类型: "纯色",
      颜色: 颜色向量(颜色, 限制01(透明度, "填充透明度")),
    };
    return this;
  }

  lineStyle(线宽: number, 颜色: number, 透明度 = 1): this {
    if (!Number.isFinite(线宽) || 线宽 < 0) throw new Error("线宽必须是非负数");
    this.状态.描边 = {
      线宽,
      颜色: 颜色向量(颜色, 限制01(透明度, "描边透明度")),
    };
    return this;
  }

  fillGradientStyle(
    左上: number,
    右上: number,
    左下: number,
    右下: number,
    透明度左上 = 1,
    透明度右上 = 1,
    透明度左下 = 1,
    透明度右下 = 1,
  ): this {
    this.状态.填充 = {
      类型: "渐变",
      左上: 颜色向量(左上, 限制01(透明度左上, "渐变透明度")),
      右上: 颜色向量(右上, 限制01(透明度右上, "渐变透明度")),
      左下: 颜色向量(左下, 限制01(透明度左下, "渐变透明度")),
      右下: 颜色向量(右下, 限制01(透明度右下, "渐变透明度")),
    };
    return this;
  }

  setAlpha(透明度: number): this {
    this.状态.透明度 = 限制01(透明度, "透明度");
    return this;
  }

  setBlendMode(模式: number): this {
    if (模式 === 0) this.状态.混合 = "普通";
    else if (模式 === 1) this.状态.混合 = "叠加";
    else throw new Error(`不支持的混合模式：${模式}（只支持 0=普通、1=叠加）`);
    return this;
  }

  save(): this {
    this.状态栈.push(复制状态(this.状态));
    return this;
  }

  restore(): this {
    const 上一 = this.状态栈.pop();
    if (上一) this.状态 = 上一;
    return this;
  }

  translateCanvas(x: number, y: number): this {
    this.状态.矩阵 = 矩阵乘(this.状态.矩阵, { a: 1, b: 0, c: 0, d: 1, e: x, f: y });
    return this;
  }

  rotateCanvas(弧度: number): this {
    const 余弦 = Math.cos(弧度);
    const 正弦 = Math.sin(弧度);
    this.状态.矩阵 = 矩阵乘(this.状态.矩阵, {
      a: 余弦,
      b: 正弦,
      c: -正弦,
      d: 余弦,
      e: 0,
      f: 0,
    });
    return this;
  }

  scaleCanvas(x: number, y = x): this {
    this.状态.矩阵 = 矩阵乘(this.状态.矩阵, { a: x, b: 0, c: 0, d: y, e: 0, f: 0 });
    return this;
  }

  // —— 立即绘制 ——

  fillRect(x: number, y: number, 宽: number, 高: number): this {
    if (宽 <= 0 || 高 <= 0 || !this.状态.填充) return this;
    const 填充 = this.状态.填充;
    if (填充.类型 === "渐变") {
      this.绘制渐变矩形(x, y, 宽, 高, 填充);
      return this;
    }
    if (this.是轴对齐矩阵()) {
      this.绘制纯色轴对齐矩形(x, y, 宽, 高, 乘透明度(填充.颜色, this.状态.透明度));
      return this;
    }
    this.填充世界多边形(
      [
        { x, y },
        { x: x + 宽, y },
        { x: x + 宽, y: y + 高 },
        { x, y: y + 高 },
      ],
      null,
    );
    return this;
  }

  fillRoundedRect(x: number, y: number, 宽: number, 高: number, 圆角: number): this {
    const 点集 = 圆角矩形点集(x, y, 宽, 高, 圆角);
    if (点集.length >= 3) this.填充世界多边形(点集, null);
    return this;
  }

  strokeRect(x: number, y: number, 宽: number, 高: number): this {
    if (宽 <= 0 || 高 <= 0) return this;
    this.描边世界折线(
      [
        { x, y },
        { x: x + 宽, y },
        { x: x + 宽, y: y + 高 },
        { x, y: y + 高 },
      ],
      true,
    );
    return this;
  }

  strokeRoundedRect(x: number, y: number, 宽: number, 高: number, 圆角: number): this {
    const 点集 = 圆角矩形点集(x, y, 宽, 高, 圆角);
    if (点集.length >= 2) this.描边世界折线(点集, true);
    return this;
  }

  fillCircle(x: number, y: number, 半径: number): this {
    return this.fillEllipse(x, y, 半径 * 2, 半径 * 2);
  }

  strokeCircle(x: number, y: number, 半径: number): this {
    return this.strokeEllipse(x, y, 半径 * 2, 半径 * 2);
  }

  fillEllipse(x: number, y: number, 宽: number, 高: number): this {
    if (宽 <= 0 || 高 <= 0) return this;
    this.填充世界多边形(圆弧点(x, y, 宽 / 2, 高 / 2, 0, 圆周率 * 2, 圆段数).slice(0, -1), null);
    return this;
  }

  strokeEllipse(x: number, y: number, 宽: number, 高: number): this {
    if (宽 <= 0 || 高 <= 0) return this;
    this.描边世界折线(圆弧点(x, y, 宽 / 2, 高 / 2, 0, 圆周率 * 2, 圆段数).slice(0, -1), true);
    return this;
  }

  fillTriangle(x1: number, y1: number, x2: number, y2: number, x3: number, y3: number): this {
    this.填充世界多边形(
      [
        { x: x1, y: y1 },
        { x: x2, y: y2 },
        { x: x3, y: y3 },
      ],
      null,
    );
    return this;
  }

  strokeTriangle(x1: number, y1: number, x2: number, y2: number, x3: number, y3: number): this {
    this.描边世界折线(
      [
        { x: x1, y: y1 },
        { x: x2, y: y2 },
        { x: x3, y: y3 },
      ],
      true,
    );
    return this;
  }

  lineBetween(x1: number, y1: number, x2: number, y2: number): this {
    this.描边世界折线(
      [
        { x: x1, y: y1 },
        { x: x2, y: y2 },
      ],
      false,
    );
    return this;
  }

  fillPoints(点集: readonly 点[], _闭合 = false): this {
    if (点集.length < 3) return this;
    this.填充世界多边形(点集, null);
    return this;
  }

  strokePoints(点集: readonly 点[], 闭合 = false): this {
    if (点集.length < 2) return this;
    this.描边世界折线(点集, 闭合);
    return this;
  }

  // —— 路径 ——

  beginPath(): this {
    this.路径 = [];
    this.当前子路径 = null;
    return this;
  }

  moveTo(x: number, y: number): this {
    const 子路径: 子路径 = { 点集: [{ x, y }], 闭合: false };
    this.路径.push(子路径);
    this.当前子路径 = 子路径;
    return this;
  }

  lineTo(x: number, y: number): this {
    if (!this.当前子路径) return this.moveTo(x, y);
    this.当前子路径.点集.push({ x, y });
    return this;
  }

  closePath(): this {
    if (this.当前子路径) this.当前子路径.闭合 = true;
    this.当前子路径 = null;
    return this;
  }

  arc(x: number, y: number, 半径: number, 起始角: number, 结束角: number, 逆时针 = false): this {
    if (半径 <= 0) return this;
    let 总量 = 结束角 - 起始角;
    if (!逆时针) {
      while (总量 < 0) 总量 += 圆周率 * 2;
    } else {
      while (总量 > 0) 总量 -= 圆周率 * 2;
    }
    const 段数 = Math.max(2, Math.ceil(Math.abs(总量) / (圆周率 / 16)));
    const 采样 = 圆弧点(x, y, 半径, 半径, 起始角, 起始角 + 总量, 段数);
    const 起点 = 采样[0];
    if (!起点) return this;
    if (!this.当前子路径) this.moveTo(起点.x, 起点.y);
    else this.lineTo(起点.x, 起点.y);
    for (const 项 of 采样.slice(1)) this.lineTo(项.x, 项.y);
    return this;
  }

  fillPath(): this {
    for (const 子路径 of this.路径) {
      if (子路径.点集.length >= 3) this.填充世界多边形(子路径.点集, null);
    }
    return this;
  }

  strokePath(): this {
    for (const 子路径 of this.路径) {
      if (子路径.点集.length >= 2) this.描边世界折线(子路径.点集, 子路径.闭合);
    }
    return this;
  }

  clear(): this {
    // Phaser 的 clear() 是清掉该图层已记录内容；这里只清当前图层，不能清掉下层页面。
    this.合批.清空图层(this.合批.读取图层());
    this.路径 = [];
    this.当前子路径 = null;
    return this;
  }

  // —— 供画笔读取 / 启动层重置 ——

  读取透明度(): number {
    return this.状态.透明度;
  }

  读取混合方式(): 混合方式 {
    return this.状态.混合;
  }

  读取矩阵(): 矩阵 {
    return { ...this.状态.矩阵 };
  }

  /** 启动层每帧每页渲染前调用：把 alpha/混合/变换/路径恢复默认，避免上页状态漏到下页。 */
  重置(): void {
    this.状态 = 初始状态();
    this.状态栈 = [];
    this.路径 = [];
    this.当前子路径 = null;
  }

  // —— 内部：图元写入 ——

  private 当前描边颜色(): 顶点颜色 | null {
    const 描边 = this.状态.描边;
    if (!描边 || 描边.线宽 <= 0) return null;
    return 乘透明度(描边.颜色, this.状态.透明度);
  }

  private 是轴对齐矩阵(): boolean {
    const 矩阵 = this.状态.矩阵;
    return Math.abs(矩阵.b) < 1e-9 && Math.abs(矩阵.c) < 1e-9;
  }

  private 绘制纯色轴对齐矩形(x: number, y: number, 宽: number, 高: number, 颜色: 顶点颜色): void {
    const 矩阵 = this.状态.矩阵;
    if (Math.abs(矩阵.a) < 容差 || Math.abs(矩阵.d) < 容差) return;
    const 角一 = 变换点(矩阵, x, y);
    const 角二 = 变换点(矩阵, x + 宽, y + 高);
    const 左 = Math.min(角一.x, 角二.x);
    const 上 = Math.min(角一.y, 角二.y);
    const 宽世界 = Math.abs(角二.x - 角一.x);
    const 高世界 = Math.abs(角二.y - 角一.y);
    this.合批.添加纯色(左, 上, 宽世界, 高世界, 颜色, this.状态.混合);
  }

  private 绘制渐变矩形(x: number, y: number, 宽: number, 高: number, 填充: 渐变填充): void {
    const 矩阵 = this.状态.矩阵;
    // 双线性渐变用 6×6 分段已足够平滑；再细分只会成倍增加三角形，背景整屏渐变会被容量顶满。
    const 分段X = Math.max(2, Math.min(6, Math.ceil(宽 / 64)));
    const 分段Y = Math.max(2, Math.min(6, Math.ceil(高 / 64)));
    for (let 行 = 0; 行 < 分段Y; 行++) {
      for (let 列 = 0; 列 < 分段X; 列++) {
        const t左 = 列 / 分段X;
        const t右 = (列 + 1) / 分段X;
        const t上 = 行 / 分段Y;
        const t下 = (行 + 1) / 分段Y;
        const 局部左上 = { x: x + 宽 * t左, y: y + 高 * t上 };
        const 局部右上 = { x: x + 宽 * t右, y: y + 高 * t上 };
        const 局部右下 = { x: x + 宽 * t右, y: y + 高 * t下 };
        const 局部左下 = { x: x + 宽 * t左, y: y + 高 * t下 };
        const 世界左上 = 变换点(矩阵, 局部左上.x, 局部左上.y);
        const 世界右上 = 变换点(矩阵, 局部右上.x, 局部右上.y);
        const 世界右下 = 变换点(矩阵, 局部右下.x, 局部右下.y);
        const 世界左下 = 变换点(矩阵, 局部左下.x, 局部左下.y);
        const 色左上 = 乘透明度(
          双线性(填充.左上, 填充.右上, 填充.左下, 填充.右下, t左, t上),
          this.状态.透明度,
        );
        const 色右上 = 乘透明度(
          双线性(填充.左上, 填充.右上, 填充.左下, 填充.右下, t右, t上),
          this.状态.透明度,
        );
        const 色右下 = 乘透明度(
          双线性(填充.左上, 填充.右上, 填充.左下, 填充.右下, t右, t下),
          this.状态.透明度,
        );
        const 色左下 = 乘透明度(
          双线性(填充.左上, 填充.右上, 填充.左下, 填充.右下, t左, t下),
          this.状态.透明度,
        );
        this.添加三角色三角形([世界左上, 世界右上, 世界右下], [色左上, 色右上, 色右下]);
        this.添加三角色三角形([世界左上, 世界右下, 世界左下], [色左上, 色右下, 色左下]);
      }
    }
  }

  /** 填充世界坐标多边形；传入渐变时按包围盒双线性取每顶点颜色。 */
  private 填充世界多边形(局部点集: readonly 点[], 填充: 渐变填充 | null): void {
    const 样式 = 填充 ?? this.状态.填充;
    if (!样式) return;
    const 矩阵 = this.状态.矩阵;
    const 世界点 = 局部点集.map((项) => 变换点(矩阵, 项.x, 项.y));
    const 三角形 = 三角化多边形(世界点);
    if (三角形.length === 0) return;
    if (样式.类型 === "纯色") {
      const 颜色 = 乘透明度(样式.颜色, this.状态.透明度);
      for (const 项 of 三角形) this.添加纯色三角形(项, 颜色);
      return;
    }
    let 最小X = Number.POSITIVE_INFINITY;
    let 最小Y = Number.POSITIVE_INFINITY;
    let 最大X = Number.NEGATIVE_INFINITY;
    let 最大Y = Number.NEGATIVE_INFINITY;
    for (const 项 of 世界点) {
      最小X = Math.min(最小X, 项.x);
      最小Y = Math.min(最小Y, 项.y);
      最大X = Math.max(最大X, 项.x);
      最大Y = Math.max(最大Y, 项.y);
    }
    const 宽 = 最大X - 最小X;
    const 高 = 最大Y - 最小Y;
    for (const 项 of 三角形) {
      const 颜色列表 = 项.map((顶点) =>
        乘透明度(
          双线性(
            样式.左上,
            样式.右上,
            样式.左下,
            样式.右下,
            宽 > 0 ? (顶点.x - 最小X) / 宽 : 0,
            高 > 0 ? (顶点.y - 最小Y) / 高 : 0,
          ),
          this.状态.透明度,
        ),
      );
      this.添加三角色三角形(项, [
        颜色列表[0] ?? 样式.左上,
        颜色列表[1] ?? 样式.左上,
        颜色列表[2] ?? 样式.左上,
      ]);
    }
  }

  private 描边世界折线(局部点集: readonly 点[], 闭合: boolean): void {
    const 颜色 = this.当前描边颜色();
    const 描边 = this.状态.描边;
    if (!颜色 || !描边 || 描边.线宽 <= 0) return;
    const 矩阵 = this.状态.矩阵;
    const 世界点 = 局部点集.map((项) => 变换点(矩阵, 项.x, 项.y));
    if (世界点.length < 2) return;
    const 缩放 = Math.sqrt(Math.abs(矩阵.a * 矩阵.d - 矩阵.b * 矩阵.c)) || 1;
    const 半宽 = (描边.线宽 * 缩放) / 2;
    if (半宽 <= 0) return;
    const 段列表: [点, 点][] = [];
    for (let 序号 = 0; 序号 < 世界点.length - 1; 序号++) {
      const 甲 = 世界点[序号];
      const 乙 = 世界点[序号 + 1];
      if (甲 && 乙) 段列表.push([甲, 乙]);
    }
    if (闭合) {
      const 首 = 世界点[0];
      const 尾 = 世界点.at(-1);
      if (首 && 尾) 段列表.push([尾, 首]);
    }
    for (const [甲, 乙] of 段列表) this.绘制线段(甲, 乙, 半宽, 颜色);
    const 连接点 = 闭合 ? 世界点 : 世界点;
    for (const 项 of 连接点) this.绘制圆点(项, 半宽, 颜色);
  }

  private 绘制线段(甲: 点, 乙: 点, 半宽: number, 颜色: 顶点颜色): void {
    const dx = 乙.x - 甲.x;
    const dy = 乙.y - 甲.y;
    const 长度 = Math.hypot(dx, dy);
    if (长度 < 容差) return;
    const 法线X = (-dy / 长度) * 半宽;
    const 法线Y = (dx / 长度) * 半宽;
    const 顶点甲一 = { x: 甲.x + 法线X, y: 甲.y + 法线Y };
    const 顶点甲二 = { x: 乙.x + 法线X, y: 乙.y + 法线Y };
    const 顶点乙二 = { x: 乙.x - 法线X, y: 乙.y - 法线Y };
    const 顶点乙一 = { x: 甲.x - 法线X, y: 甲.y - 法线Y };
    this.添加纯色三角形([顶点甲一, 顶点甲二, 顶点乙二], 颜色);
    this.添加纯色三角形([顶点甲一, 顶点乙二, 顶点乙一], 颜色);
  }

  private 绘制圆点(圆心: 点, 半径: number, 颜色: 顶点颜色): void {
    if (半径 < 0.5) return;
    const 采样 = 圆弧点(圆心.x, 圆心.y, 半径, 半径, 0, 圆周率 * 2, 连接段数);
    for (let 序号 = 0; 序号 < 采样.length - 1; 序号++) {
      const 甲 = 采样[序号];
      const 乙 = 采样[序号 + 1];
      if (甲 && 乙) this.添加纯色三角形([圆心, 甲, 乙], 颜色);
    }
  }

  private 添加纯色三角形(顶点: readonly [点, 点, 点], 颜色: 顶点颜色): void {
    this.合批.添加三角形({
      顶点: [
        顶点颜色顶点(顶点[0], this.纯色U, this.纯色V, 颜色),
        顶点颜色顶点(顶点[1], this.纯色U, this.纯色V, 颜色),
        顶点颜色顶点(顶点[2], this.纯色U, this.纯色V, 颜色),
      ],
      混合: this.状态.混合,
      纹理: this.纯色纹理序号,
    });
  }

  private 添加三角色三角形(
    顶点: readonly [点, 点, 点],
    颜色: readonly [顶点颜色, 顶点颜色, 顶点颜色],
  ): void {
    this.合批.添加三角形({
      顶点: [
        顶点颜色顶点(顶点[0], this.纯色U, this.纯色V, 颜色[0]),
        顶点颜色顶点(顶点[1], this.纯色U, this.纯色V, 颜色[1]),
        顶点颜色顶点(顶点[2], this.纯色U, this.纯色V, 颜色[2]),
      ],
      混合: this.状态.混合,
      纹理: this.纯色纹理序号,
    });
  }
}

function 顶点颜色顶点(点: 点, u: number, v: number, 颜色: 顶点颜色): 三角顶点 {
  return { x: 点.x, y: 点.y, u, v, 颜色 };
}
