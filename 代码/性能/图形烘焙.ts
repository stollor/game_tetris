import Phaser from "phaser";
import {
  判断九宫,
  判断纯色极简,
  合适页边,
  图章最大边,
  图章最小边,
  图集间隙,
  新建页空间,
  选择入集页,
  type 页空间,
} from "./图集尺寸";
import { 观察场景对象 } from "./场景对象";
import { 引用纹理, 获取纹理预算 } from "./纹理缓存";

/**
 * Graphics 自动烘焙：Phaser 每帧都会把 Graphics 的矢量命令重新细分成三角形，静态面板/按钮/棋盘
 * 也不例外，这是低端机主线程的最大开销。这里在不改调用方的前提下：
 * - 命令未变化的 Graphics（连续两帧相同）在帧间（POST_STEP，渲染前）画进一张纹理，之后以单个贴图渲染；
 * - 共享页按 256/512/1024 分档，小块进小页、页满才升档；中间重复的底板收成一张九宫格小图；
 * - 准入判据集中在 烘焙 一处并逐项计数：超页、动态层、九宫、不可烘焙、纯色/极简、预算不足、页满退化；
 * - 纯色/极简（填充色 + 至多两块填充矩形）直接原生绘制，不建纹理不入集；
 * - 每次都变化的动态层直接绘制，避免按需渲染下先画离屏纹理再贴回屏幕的额外一遍；
 * - 命令一变（clear/追加）立即回退到原生渲染，下一次稳定后再烘焙，视觉与原生一致。
 */

type 图形 = Phaser.GameObjects.Graphics & {
  __版本?: number;
  __上帧签名?: string;
  __烘焙?: 烘焙记录;
  __烘焙中?: boolean;
  __禁止烘焙?: boolean;
  /** 已判定为原生绘制（纯色/极简、命令不可解析）时的签名，命令不变就不再重复判定。 */
  __跳过签名?: string;
  /** 上一次因预算不足放弃烘焙时的签名，避免同一份命令每帧重复计数。 */
  __预算不足签名?: string;
  __替身?: 替身项[];
  renderWebGL: (
    renderer: Phaser.Renderer.WebGL.WebGLRenderer,
    src: 图形,
    camera: Phaser.Renderer.WebGL.DrawingContext,
    parentMatrix?: Phaser.GameObjects.Components.TransformMatrix,
  ) => void;
  _renderSteps?: 图形["renderWebGL"][];
};

/** 用若干预烘焙贴图代替 Graphics 渲染（位置相对 Graphics 本地坐标），动画只改位置不重绘。 */
export interface 替身项 {
  贴图: Phaser.GameObjects.Image;
  x: number;
  y: number;
  透明度: number;
}

interface 烘焙记录 {
  签名: string;
  纹理: Phaser.Textures.DynamicTexture;
  键: string;
  帧: string;
  /** 图集页中的区域；独立纹理时为 undefined。 */
  页?: 图集页;
  区: { x: number; y: number; 宽: number; 高: number };
  /** 已占用的容量；内容尺寸变小或略变时原地复用，动画层不再每帧换纹理。 */
  容: { 宽: number; 高: number };
  贴图: Phaser.GameObjects.Image | Phaser.GameObjects.NineSlice;
  左: number;
  顶: number;
  右: number;
  底: number;
  比: number;
  /** 九宫格底板。同一键的按钮、色块共用这一张小图，宽度和高度在绘制时拉开。 */
  九宫?: Phaser.GameObjects.NineSlice;
  九宫键?: string;
  九宫边?: number;
}

/**
 * 烘焙图集：所有小块烘焙共享少数几张大纹理。
 * - 每新建一张 DynamicTexture 都要创建帧缓冲（checkFramebufferStatus 极慢），重建界面时会卡顿；
 * - 共享纹理的贴图可以合批，商店/设置这类几十个卡片的界面绘制调用大幅减少。
 * 页内用货架分配，释放的区域进入空闲表复用；一页全部释放时整页重置。
 * 页按 256/512/1024 分档，每档页数上限见 图集尺寸.ts 的 图集页档表。
 */
interface 图集页 {
  纹理: Phaser.Textures.DynamicTexture;
  键: string;
  边: number;
  空间: 页空间;
  在用: number;
  释放引用?: () => void;
}
const 间隙 = 图集间隙;
const 图集: 图集页[] = [];

/** 页档页数统计：创建/移除页时同步，供性能观测看各档开页情况。 */
function 调整页档计数(边: number, 增量: number): void {
  if (边 === 256) 烘焙统计.图集页256 += 增量;
  else if (边 === 512) 烘焙统计.图集页512 += 增量;
  else if (边 === 1024) 烘焙统计.图集页1024 += 增量;
}

type 分配结论 =
  | { 类型: "入集"; 页: 图集页; x: number; y: number }
  | { 类型: "超页" }
  | { 类型: "页满" }
  | { 类型: "预算不足" };

/** 按页档选页：现有页优先、档内页满才升档；装不下时把原因交给调用方计数。 */
function 分配区域(场景: Phaser.Scene, 宽: number, 高: number): 分配结论 {
  const 纹理表 = 场景.textures;
  const 预算 = 获取纹理预算(场景);
  const 候选 = 图集.filter((页) => 纹理表.exists(页.键));
  const 选择 = 选择入集页(
    候选.map((页) => ({ 边: 页.边, 空间: 页.空间 })),
    宽,
    高,
  );
  if (选择.类型 === "不入集") return { 类型: 选择.原因 };
  if (选择.类型 === "现有页") {
    const 页 = 候选[选择.页序];
    if (!页) return { 类型: "页满" };
    页.空间 = 选择.空间;
    if (页.在用 === 0) 页.释放引用 = 预算.引用(页.键);
    页.在用++;
    return { 类型: "入集", 页, x: 选择.位.x, y: 选择.位.y };
  }
  const 边 = 选择.空间.边;
  if (!预算.腾出空间(边 * 边)) return { 类型: "预算不足" };
  const 键 = `图形烘焙.图集.${++序号}`;
  const 纹理 = 纹理表.addDynamicTexture(键, 边, 边);
  if (!纹理) return { 类型: "预算不足" };
  const 页: 图集页 = { 纹理, 键, 边, 空间: 选择.空间, 在用: 0 };
  图集.push(页);
  try {
    预算.登记(键, 边 * 边, () => {
      const 位置 = 图集.indexOf(页);
      if (位置 >= 0) 图集.splice(位置, 1);
      烘焙统计.图集页 = 图集.length;
      if (位置 >= 0) 调整页档计数(页.边, -1);
      if (纹理表.exists(键)) 纹理表.remove(键);
    });
  } catch (错误) {
    const 位置 = 图集.indexOf(页);
    if (位置 >= 0) 图集.splice(位置, 1);
    if (纹理表.exists(键)) 纹理表.remove(键);
    throw 错误;
  }
  页.释放引用 = 预算.引用(键);
  烘焙统计.图集页 = 图集.length;
  调整页档计数(边, 1);
  页.在用++;
  return { 类型: "入集", 页, x: 选择.位.x, y: 选择.位.y };
}

const 命令 = {
  ARC: 0,
  FILL_RECT: 3,
  LINE_TO: 4,
  MOVE_TO: 5,
  LINE_STYLE: 6,
  FILL_STYLE: 7,
  FILL_TRIANGLE: 10,
  STROKE_TRIANGLE: 11,
  SAVE: 14,
  RESTORE: 15,
  TRANSLATE: 16,
  SCALE: 17,
  ROTATE: 18,
  GRADIENT_FILL_STYLE: 21,
  GRADIENT_LINE_STYLE: 22,
} as const;

const 最大边 = 4096;
const 最大面积 = 2600 * 2600;
let 序号 = 0;
const 已安装 = new WeakSet<Phaser.Game>();
const 候选 = new Set<图形>();
/**
 * 烘焙与准入统计。准入判据在 烘焙 一处判定，每个拒绝原因都有独立计数器；
 * 名称保持不变的部分由既有浏览器验收脚本读取。
 */
export const 烘焙统计 = {
  烘焙次数: 0,
  贴图渲染: 0,
  原生渲染: 0,
  独立纹理: 0,
  图集页: 0,
  图集页256: 0,
  图集页512: 0,
  图集页1024: 0,
  图章命中: 0,
  图章未命中: 0,
  图章图集创建: 0,
  图章独立创建: 0,
  /** 明确标记为动态层、每帧变化而不烘焙的 Graphics 数。 */
  跳过动态层: 0,
  /** 命令只含填充色 + 至多两块矩形，改为原生绘制。 */
  跳过纯色: 0,
  /** 命令无法解析（合并独立采样的不可烘焙情形）走原生绘制；本项目无 NEAREST 像素画来源。 */
  跳过不可烘焙: 0,
  /** 单帧超过准入上限，退化为独立纹理。 */
  跳过超页: 0,
  /** 所有页档都放不下，退化为独立纹理。 */
  页满退化: 0,
  /** 预算腾不出空间，本次不烘焙（保留重试）。 */
  跳过预算不足: 0,
  /** 九宫识别命中并装上九宫格贴图。 */
  九宫命中: 0,
};

function 签名(g: 图形): string {
  return `${g.__版本 ?? 0}:${g.commandBuffer.length}:${世界缩放(g) * (Math.abs(g.scaleX) || 1)}`;
}

/** 解析命令求局部包围盒（含变换与线宽）。无法识别的命令返回 null（不烘焙）。 */
export function 计算命令边界(
  命令表: readonly number[],
): { 左: number; 顶: number; 右: number; 底: number } | null {
  let a = 1,
    b = 0,
    c = 0,
    d = 1,
    tx = 0,
    ty = 0;
  const 栈: number[][] = [];
  let 线宽 = 0,
    最大线宽 = 0;
  let 左 = Infinity,
    顶 = Infinity,
    右 = -Infinity,
    底 = -Infinity;
  const 点 = (x: number, y: number, 半径 = 0) => {
    const wx = a * x + c * y + tx,
      wy = b * x + d * y + ty;
    const r = 半径 * Math.max(Math.hypot(a, b), Math.hypot(c, d));
    if (wx - r < 左) 左 = wx - r;
    if (wy - r < 顶) 顶 = wy - r;
    if (wx + r > 右) 右 = wx + r;
    if (wy + r > 底) 底 = wy + r;
  };
  for (let i = 0; i < 命令表.length; i++) {
    const 码 = 命令表[i];
    switch (码) {
      case 1:
      case 2:
      case 8:
      case 9:
        break;
      case 命令.ARC:
        点(命令表[i + 1], 命令表[i + 2], 命令表[i + 3]);
        i += 7;
        break;
      case 命令.FILL_RECT:
        点(命令表[i + 1], 命令表[i + 2]);
        点(命令表[i + 1] + 命令表[i + 3], 命令表[i + 2] + 命令表[i + 4]);
        i += 4;
        break;
      case 命令.LINE_TO:
      case 命令.MOVE_TO:
        点(命令表[i + 1], 命令表[i + 2]);
        i += 2;
        break;
      case 命令.LINE_STYLE:
        线宽 = 命令表[i + 1];
        最大线宽 = Math.max(最大线宽, 线宽 * Math.max(Math.hypot(a, b), Math.hypot(c, d)));
        i += 3;
        break;
      case 命令.FILL_STYLE:
        i += 2;
        break;
      case 命令.FILL_TRIANGLE:
      case 命令.STROKE_TRIANGLE:
        点(命令表[i + 1], 命令表[i + 2]);
        点(命令表[i + 3], 命令表[i + 4]);
        点(命令表[i + 5], 命令表[i + 6]);
        i += 6;
        break;
      case 命令.SAVE:
        栈.push([a, b, c, d, tx, ty]);
        break;
      case 命令.RESTORE: {
        const 旧 = 栈.pop();
        if (旧) [a, b, c, d, tx, ty] = 旧;
        break;
      }
      case 命令.TRANSLATE: {
        const x = 命令表[i + 1],
          y = 命令表[i + 2];
        tx += a * x + c * y;
        ty += b * x + d * y;
        i += 2;
        break;
      }
      case 命令.SCALE: {
        const x = 命令表[i + 1],
          y = 命令表[i + 2];
        a *= x;
        b *= x;
        c *= y;
        d *= y;
        i += 2;
        break;
      }
      case 命令.ROTATE: {
        const r = 命令表[i + 1],
          cos = Math.cos(r),
          sin = Math.sin(r);
        const na = a * cos + c * sin,
          nb = b * cos + d * sin,
          nc = -a * sin + c * cos,
          nd = -b * sin + d * cos;
        a = na;
        b = nb;
        c = nc;
        d = nd;
        i += 1;
        break;
      }
      case 命令.GRADIENT_FILL_STYLE:
        i += 8;
        break;
      case 命令.GRADIENT_LINE_STYLE:
        i += 6;
        break;
      default:
        return null;
    }
  }
  if (!Number.isFinite(左)) return null;
  const 边 = 最大线宽 / 2 + 2;
  return { 左: 左 - 边, 顶: 顶 - 边, 右: 右 + 边, 底: 底 + 边 };
}

const 九宫表 = new Map<string, { 引用: number }>();

function 释放九宫(g: 图形, 记录: 烘焙记录): void {
  记录.九宫?.destroy();
  const 键 = 记录.九宫键;
  if (!键) return;
  const 底 = 九宫表.get(键);
  if (!底) return;
  底.引用 -= 1;
  if (底.引用 > 0) return;
  九宫表.delete(键);
  if (g.scene?.textures.exists(键)) g.scene.textures.remove(键);
}

function 释放(g: 图形): void {
  const 记录 = g.__烘焙;
  if (!记录) return;
  g.__烘焙 = undefined;
  if (记录.九宫键) {
    释放九宫(g, 记录);
    return;
  }
  记录.贴图.destroy();
  const 页 = 记录.页;
  if (页) {
    if (记录.纹理.has(记录.帧)) 记录.纹理.remove(记录.帧);
    页.在用--;
    if (页.在用 <= 0) {
      页.在用 = 0;
      页.释放引用?.();
      页.释放引用 = undefined;
      页.空间 = 新建页空间(页.边);
    } else {
      页.空间.空闲.push({
        x: 记录.区.x,
        y: 记录.区.y,
        宽: 记录.容.宽 + 间隙,
        高: 记录.容.高 + 间隙,
      });
    }
    return;
  }
  if (g.scene) 获取纹理预算(g.scene).移除(记录.键);
}

function 摆放九宫(片: Phaser.GameObjects.NineSlice, src: 图形, 记录: 烘焙记录): void {
  const 余弦 = Math.cos(src.rotation);
  const 正弦 = Math.sin(src.rotation);
  const 本地X = (记录.左 + 记录.右) / 2;
  const 本地Y = (记录.顶 + 记录.底) / 2;
  片.setPosition(
    src.x + (本地X * 余弦 - 本地Y * 正弦) * src.scaleX,
    src.y + (本地X * 正弦 + 本地Y * 余弦) * src.scaleY,
  );
  片.setScale(src.scaleX / 记录.比, src.scaleY / 记录.比);
  片.rotation = src.rotation;
  片.alpha = src.alpha;
  片.setScrollFactor(src.scrollFactorX, src.scrollFactorY);
}

function 读取区域(
  纹理: Phaser.Textures.DynamicTexture,
  x: number,
  y: number,
  宽: number,
  高: number,
): Uint8ClampedArray | null {
  if (宽 < 1 || 高 < 1) return null;
  const 动态 = 纹理 as Phaser.Textures.DynamicTexture & {
    drawingContext?: { framebuffer?: object } | null;
    renderer?: {
      gl: WebGLRenderingContext;
      glWrapper: { updateBindingsFramebuffer(状态: { bindings: { framebuffer: object } }): void };
    };
  };
  const 上下文 = 动态.drawingContext;
  const 渲染器 = 动态.renderer;
  if (!上下文?.framebuffer || !渲染器) return null;
  try {
    渲染器.glWrapper.updateBindingsFramebuffer({ bindings: { framebuffer: 上下文.framebuffer } });
    const gl = 渲染器.gl;
    const 原始 = new Uint8Array(宽 * 高 * 4);
    gl.readPixels(x, 纹理.height - y - 高, 宽, 高, gl.RGBA, gl.UNSIGNED_BYTE, 原始);
    const 输出 = new Uint8ClampedArray(宽 * 高 * 4);
    for (let 行 = 0; 行 < 高; 行 += 1) {
      const 源行 = (高 - 行 - 1) * 宽 * 4;
      for (let 列 = 0; 列 < 宽; 列 += 1) {
        const 源 = 源行 + 列 * 4;
        const 目标 = (行 * 宽 + 列) * 4;
        const 透明 = 原始[源 + 3] ?? 0;
        const 还原 = 透明 === 0 || 透明 === 255 ? 1 : 255 / 透明;
        输出[目标] = Math.min(255, Math.round((原始[源] ?? 0) * 还原));
        输出[目标 + 1] = Math.min(255, Math.round((原始[源 + 1] ?? 0) * 还原));
        输出[目标 + 2] = Math.min(255, Math.round((原始[源 + 2] ?? 0) * 还原));
        输出[目标 + 3] = 透明;
      }
    }
    return 输出;
  } catch {
    return null;
  }
}

function 颜色接近(像素: Uint8ClampedArray): boolean {
  if (像素.length < 4) return false;
  const 红 = 像素[0] ?? 0;
  const 绿 = 像素[1] ?? 0;
  const 蓝 = 像素[2] ?? 0;
  const 透 = 像素[3] ?? 0;
  for (let i = 0; i < 像素.length; i += 16) {
    if (
      Math.abs((像素[i] ?? 0) - 红) > 18 ||
      Math.abs((像素[i + 1] ?? 0) - 绿) > 18 ||
      Math.abs((像素[i + 2] ?? 0) - 蓝) > 18 ||
      Math.abs((像素[i + 3] ?? 0) - 透) > 18
    )
      return false;
  }
  return true;
}

function 写入(
  目标: Uint8ClampedArray,
  目标宽: number,
  源: Uint8ClampedArray,
  源宽: number,
  源高: number,
  目标X: number,
  目标Y: number,
): void {
  for (let 行 = 0; 行 < 源高; 行 += 1) {
    for (let 列 = 0; 列 < 源宽; 列 += 1) {
      const 来 = (行 * 源宽 + 列) * 4;
      const 去 = ((目标Y + 行) * 目标宽 + 目标X + 列) * 4;
      目标[去] = 源[来] ?? 0;
      目标[去 + 1] = 源[来 + 1] ?? 0;
      目标[去 + 2] = 源[来 + 2] ?? 0;
      目标[去 + 3] = 源[来 + 3] ?? 0;
    }
  }
}

/** 中间颜色一致时，只留下四角和中间色，不同尺寸的底板共用这一张。 */
function 确保九宫纹理(
  场景: Phaser.Scene,
  g: 图形,
  边界: { 左: number; 顶: number; 右: number; 底: number },
  比: number,
  宽: number,
  高: number,
  键: string,
  边像素: number,
): boolean {
  if (场景.textures.exists(键)) return true;
  const 草稿键 = "__图形烘焙草稿";
  if (场景.textures.exists(草稿键)) 场景.textures.remove(草稿键);
  const 草稿 = 场景.textures.addDynamicTexture(草稿键, 宽, 高);
  if (!草稿) return false;
  const 原 = {
    x: g.x,
    y: g.y,
    sx: g.scaleX,
    sy: g.scaleY,
    r: g.rotation,
    a: g.alpha,
    v: g.visible,
    bm: g.blendMode,
  };
  g.__烘焙中 = true;
  g.x = -边界.左 * 比;
  g.y = -边界.顶 * 比;
  g.setScale(比, 比);
  g.rotation = 0;
  g.alpha = 1;
  g.visible = true;
  g.blendMode = Phaser.BlendModes.NORMAL;
  let 成功 = false;
  try {
    草稿.draw(g);
    草稿.render();
    const 中行 = 读取区域(草稿, 边像素, Math.floor(高 / 2), 宽 - 边像素 * 2, 1);
    const 中列 = 读取区域(草稿, Math.floor(宽 / 2), 边像素, 1, 高 - 边像素 * 2);
    const 中心 = 读取区域(草稿, Math.floor(宽 / 2), Math.floor(高 / 2), 1, 1);
    if (!中行 || !中列 || !中心 || !颜色接近(中行) || !颜色接近(中列)) return false;
    const 左上 = 读取区域(草稿, 0, 0, 边像素, 边像素);
    const 右上 = 读取区域(草稿, 宽 - 边像素, 0, 边像素, 边像素);
    const 左下 = 读取区域(草稿, 0, 高 - 边像素, 边像素, 边像素);
    const 右下 = 读取区域(草稿, 宽 - 边像素, 高 - 边像素, 边像素, 边像素);
    if (!左上 || !右上 || !左下 || !右下) return false;
    const 有颜色 = (像素: Uint8ClampedArray) => {
      for (let i = 3; i < 像素.length; i += 4) if ((像素[i] ?? 0) > 8) return true;
      return false;
    };
    if (!有颜色(中心) && !有颜色(左上) && !有颜色(右下)) return false;
    const 纹理边 = 边像素 * 2 + 2;
    const 画布 = document.createElement("canvas");
    画布.width = 纹理边;
    画布.height = 纹理边;
    const 上下文 = 画布.getContext("2d");
    if (!上下文) return false;
    const 图像 = 上下文.createImageData(纹理边, 纹理边);
    const 红 = 中心[0] ?? 0;
    const 绿 = 中心[1] ?? 0;
    const 蓝 = 中心[2] ?? 0;
    const 透 = 中心[3] ?? 0;
    for (let i = 0; i < 图像.data.length; i += 4) {
      图像.data[i] = 红;
      图像.data[i + 1] = 绿;
      图像.data[i + 2] = 蓝;
      图像.data[i + 3] = 透;
    }
    const 右起 = 边像素 + 2;
    写入(图像.data, 纹理边, 左上, 边像素, 边像素, 0, 0);
    写入(图像.data, 纹理边, 右上, 边像素, 边像素, 右起, 0);
    写入(图像.data, 纹理边, 左下, 边像素, 边像素, 0, 右起);
    写入(图像.data, 纹理边, 右下, 边像素, 边像素, 右起, 右起);
    上下文.putImageData(图像, 0, 0);
    if (!场景.textures.addCanvas(键, 画布)) return false;
    成功 = true;
    return true;
  } finally {
    g.x = 原.x;
    g.y = 原.y;
    g.setScale(原.sx, 原.sy);
    g.rotation = 原.r;
    g.alpha = 原.a;
    g.visible = 原.v;
    g.blendMode = 原.bm;
    g.__烘焙中 = false;
    if (场景.textures.exists(草稿键)) 场景.textures.remove(草稿键);
    if (!成功 && 场景.textures.exists(键)) 场景.textures.remove(键);
  }
}

function 装上九宫(
  g: 图形,
  场景: Phaser.Scene,
  边界: { 左: number; 顶: number; 右: number; 底: number },
  比: number,
  宽: number,
  高: number,
  规格: { 边: number; 键: string },
): boolean {
  const 边像素 = Math.max(4, Math.ceil(规格.边 * 比));
  if (宽 <= 边像素 * 2 + 2 || 高 <= 边像素 * 2 + 2) return false;
  const 键 = `${规格.键}@${比.toFixed(3)}`;
  const 现 = g.__烘焙;
  if (现?.九宫 && 现.九宫键 === 键) {
    现.九宫.setSlices(宽, 高, 边像素, 边像素, 边像素, 边像素);
    现.区 = { x: 0, y: 0, 宽, 高 };
    现.容 = { 宽, 高 };
    现.左 = 边界.左;
    现.顶 = 边界.顶;
    现.右 = 边界.右;
    现.底 = 边界.底;
    现.比 = 比;
    现.九宫边 = 边像素;
    现.签名 = 签名(g);
    return true;
  }
  if (!确保九宫纹理(场景, g, 边界, 比, 宽, 高, 键, 边像素)) return false;
  释放(g);
  const 片 = new Phaser.GameObjects.NineSlice(
    场景,
    0,
    0,
    键,
    undefined,
    宽,
    高,
    边像素,
    边像素,
    边像素,
    边像素,
  );
  const 底 = 九宫表.get(键) ?? { 引用: 0 };
  底.引用 += 1;
  九宫表.set(键, 底);
  const 纹理 = 场景.textures.get(键);
  g.__烘焙 = {
    签名: 签名(g),
    纹理: 纹理 as Phaser.Textures.DynamicTexture,
    键,
    帧: "__BASE",
    区: { x: 0, y: 0, 宽, 高 },
    容: { 宽, 高 },
    贴图: 片,
    左: 边界.左,
    顶: 边界.顶,
    右: 边界.右,
    底: 边界.底,
    比,
    九宫: 片,
    九宫键: 键,
    九宫边: 边像素,
  };
  烘焙统计.烘焙次数++;
  return true;
}

function 世界缩放(g: 图形): number {
  const m = g.getWorldTransformMatrix();
  const 缩放 = Math.max(Math.hypot(m.a, m.b), Math.hypot(m.c, m.d));
  const 镜头 = g.scene?.cameras?.main?.zoom ?? 1;
  // 世界矩阵不含镜头；按「本体缩放 × 镜头缩放」烘焙，贴图像素与屏幕像素一致。
  return Math.max(0.25, (缩放 / Math.max(1e-6, Math.abs(g.scaleX) || 1)) * 镜头);
}

/** 预算不足只记一次：命令不变时继续每帧重试，但不重复累加计数。 */
function 记录预算不足(g: 图形, 现签名: string): void {
  if (g.__预算不足签名 === 现签名) return;
  g.__预算不足签名 = 现签名;
  烘焙统计.跳过预算不足++;
}

/**
 * 准入判据集中在这里，每次拒绝都进 烘焙统计：
 * 纯色/极简、命令不可解析 → 原生绘制；九宫命中 → 九宫小图；
 * 其余按页档入集，超页或页满 → 独立纹理；预算不足 → 本次不烘焙、下帧重试。
 */
function 烘焙(g: 图形): void {
  const 场景 = g.scene;
  if (!场景?.sys?.textures || !g.active) return;
  const 命令表 = g.commandBuffer as number[];
  const 现签名 = 签名(g);
  if (判断纯色极简(命令表)) {
    烘焙统计.跳过纯色++;
    g.__跳过签名 = 现签名;
    return;
  }
  const 边界 = 计算命令边界(命令表);
  if (!边界) {
    烘焙统计.跳过不可烘焙++;
    g.__跳过签名 = 现签名;
    return;
  }
  let 比 = 世界缩放(g) * (Math.abs(g.scaleX) || 1);
  // 烘焙原点对齐物理像素，避免矢量转贴图时改变采样相位、细边发虚。
  边界.左 = Math.floor(边界.左 * 比) / 比;
  边界.顶 = Math.floor(边界.顶 * 比) / 比;
  let 宽 = Math.ceil((边界.右 - 边界.左) * 比),
    高 = Math.ceil((边界.底 - 边界.顶) * 比);
  if (宽 < 1 || 高 < 1) return;
  const 超 = Math.max(宽 / 最大边, 高 / 最大边, Math.sqrt((宽 * 高) / 最大面积));
  if (超 > 1) {
    比 /= 超;
    宽 = Math.ceil((边界.右 - 边界.左) * 比);
    高 = Math.ceil((边界.底 - 边界.顶) * 比);
  }
  const 规格 = 判断九宫(命令表, 边界.右 - 边界.左, 边界.底 - 边界.顶);
  if (规格 && 装上九宫(g, 场景, 边界, 比, 宽, 高, 规格)) {
    烘焙统计.九宫命中++;
    return;
  }
  if (g.__烘焙?.九宫) 释放(g);
  let 记录 = g.__烘焙;
  if (记录 && 宽 <= 记录.容.宽 && 高 <= 记录.容.高) {
    if (记录.区.宽 !== 宽 || 记录.区.高 !== 高) {
      记录.区 = { x: 记录.区.x, y: 记录.区.y, 宽, 高 };
      if (记录.纹理.has(记录.帧)) 记录.纹理.remove(记录.帧);
      记录.纹理.add(记录.帧, 0, 记录.区.x, 记录.区.y, 宽, 高);
    }
  } else {
    // 动画层尺寸常在小范围波动：按增长后的尺寸留余量，避免反复重新分配
    const 旧容 = 记录?.容;
    const 容宽 = 旧容 ? Math.max(宽, Math.ceil(Math.max(宽, 旧容.宽) * 1.1)) : 宽;
    const 容高 = 旧容 ? Math.max(高, Math.ceil(Math.max(高, 旧容.高) * 1.1)) : 高;
    释放(g);
    const 纹理表 = 场景.sys.textures;
    const 分配 = 分配区域(场景, 容宽, 容高);
    let 纹理: Phaser.Textures.DynamicTexture;
    let 键: string;
    let 页: 图集页 | undefined;
    const 帧 = `f${++序号}`;
    let 区 = { x: 0, y: 0, 宽, 高 };
    if (分配.类型 === "入集") {
      页 = 分配.页;
      纹理 = 页.纹理;
      键 = 页.键;
      区 = { x: 分配.x, y: 分配.y, 宽, 高 };
    } else {
      if (分配.类型 === "预算不足") {
        记录预算不足(g, 现签名);
        return;
      }
      if (分配.类型 === "超页") 烘焙统计.跳过超页++;
      else 烘焙统计.页满退化++;
      键 = `图形烘焙.${++序号}`;
      const 预算 = 获取纹理预算(场景);
      if (!预算.腾出空间(容宽 * 容高)) {
        记录预算不足(g, 现签名);
        return;
      }
      const 新纹理 = 纹理表.addDynamicTexture(键, 容宽, 容高);
      if (!新纹理) {
        记录预算不足(g, 现签名);
        return;
      }
      纹理 = 新纹理;
      try {
        预算.登记(键, 容宽 * 容高, () => {
          if (纹理表.exists(键)) 纹理表.remove(键);
        });
      } catch (错误) {
        if (纹理表.exists(键)) 纹理表.remove(键);
        throw 错误;
      }
      烘焙统计.独立纹理++;
    }
    纹理.add(帧, 0, 区.x, 区.y, 宽, 高);
    const 贴图 = 场景.make.image(
      { key: 键, frame: 帧 } as Phaser.Types.GameObjects.Sprite.SpriteConfig,
      false,
    );
    if (!页) 引用纹理(场景, 贴图);
    记录 = {
      签名: "",
      纹理,
      键,
      帧,
      页,
      区,
      容: { 宽: 容宽, 高: 容高 },
      贴图,
      左: 0,
      顶: 0,
      右: 0,
      底: 0,
      比: 1,
    };
    g.__烘焙 = 记录;
  }
  const 原 = {
    x: g.x,
    y: g.y,
    sx: g.scaleX,
    sy: g.scaleY,
    r: g.rotation,
    a: g.alpha,
    v: g.visible,
    bm: g.blendMode,
  };
  g.__烘焙中 = true;
  g.x = -边界.左 * 比 + 记录.区.x;
  g.y = -边界.顶 * 比 + 记录.区.y;
  g.setScale(比, 比);
  g.rotation = 0;
  g.alpha = 1;
  g.visible = true;
  g.blendMode = Phaser.BlendModes.NORMAL;
  if (记录.页) 记录.纹理.clear(记录.区.x, 记录.区.y, 记录.容.宽 + 间隙, 记录.容.高 + 间隙);
  else 记录.纹理.clear();
  记录.纹理.draw(g);
  记录.纹理.render();
  g.x = 原.x;
  g.y = 原.y;
  g.setScale(原.sx, 原.sy);
  g.rotation = 原.r;
  g.alpha = 原.a;
  g.visible = 原.v;
  g.blendMode = 原.bm;
  g.__烘焙中 = false;
  记录.签名 = 签名(g);
  记录.左 = 边界.左;
  记录.顶 = 边界.顶;
  记录.右 = 边界.右;
  记录.底 = 边界.底;
  记录.比 = 比;
  记录.贴图.setTexture(记录.键, 记录.帧);
  烘焙统计.烘焙次数++;
}

interface 图章贴图 {
  键: string;
  帧?: string;
  左: number;
  顶: number;
  比: number;
}
interface 图章页 {
  键: string;
  纹理: Phaser.Textures.DynamicTexture;
  边: number;
  x: number;
  y: number;
  行高: number;
}
interface 图章环境 {
  缓存: Map<string, 图章贴图>;
  页: 图章页[];
}
const 图章环境表 = new WeakMap<Phaser.Textures.TextureManager, 图章环境>();

function 分配图章(场景: Phaser.Scene, 环境: 图章环境, 宽: number, 高: number) {
  const 纹理表 = 场景.textures;
  const W = 宽 + 间隙,
    H = 高 + 间隙;
  if (W > 图章最大边 || H > 图章最大边) return null;
  const 试放 = (页: 图章页) => {
    if (页.x + W > 页.边) {
      页.y += 页.行高;
      页.x = 0;
      页.行高 = 0;
    }
    if (页.y + H > 页.边) return null;
    const 位 = { 页, x: 页.x, y: 页.y };
    页.x += W;
    页.行高 = Math.max(页.行高, H);
    return 位;
  };
  for (const 页 of 环境.页) {
    const 位 = 试放(页);
    if (位) return 位;
  }
  const 预算 = 获取纹理预算(场景);
  if (环境.页.length >= 3) {
    for (const 页 of [...环境.页]) if (预算.移除(页.键)) break;
    if (环境.页.length >= 3) return null;
  }
  const 边 = 合适页边(W, H, 图章最大边, 图章最小边);
  if (!预算.腾出空间(边 * 边)) return null;
  const 键 = `图章图集.${++序号}`;
  const 纹理 = 纹理表.addDynamicTexture(键, 边, 边);
  if (!纹理) return null;
  const 页: 图章页 = { 键, 纹理, 边, x: 0, y: 0, 行高: 0 };
  try {
    预算.登记(键, 边 * 边, () => {
      const 位置 = 环境.页.indexOf(页);
      if (位置 >= 0) 环境.页.splice(位置, 1);
      for (const [缓存键, 贴图] of 环境.缓存) if (贴图.键 === 键) 环境.缓存.delete(缓存键);
      if (纹理表.exists(键)) 纹理表.remove(键);
    });
  } catch (错误) {
    纹理表.remove(键);
    throw 错误;
  }
  环境.页.push(页);
  烘焙统计.图章图集创建++;
  return 试放(页);
}

/**
 * 小图章共用有预算的图集页，超大图保留独立纹理；同键只烘焙一次。
 * 用于“形状不变、只移动”的动画元素（例如云朵）：之后只移动贴图，不再逐帧细分。
 */
export function 获取烘焙贴图(
  场景: Phaser.Scene,
  键: string,
  绘制: (g: Phaser.GameObjects.Graphics) => void,
): 图章贴图 | null {
  if (Phaser.VERSION !== "4.2.1") return null;
  const 比 = 场景.cameras.main.zoom || 1;
  const 全键 = `烘焙贴图.${键}@${比.toFixed(3)}`;
  let 环境 = 图章环境表.get(场景.textures);
  if (!环境) {
    环境 = { 缓存: new Map(), 页: [] };
    图章环境表.set(场景.textures, 环境);
  }
  const 缓存 = 环境.缓存.get(全键);
  if (
    缓存 &&
    场景.textures.exists(缓存.键) &&
    (缓存.帧 === undefined || 场景.textures.get(缓存.键).has(缓存.帧))
  ) {
    烘焙统计.图章命中++;
    return 缓存;
  }
  烘焙统计.图章未命中++;
  const g = 场景.make.graphics({ x: 0, y: 0 }, false) as 图形;
  try {
    g.__禁止烘焙 = true;
    绘制(g);
    const 边界 = 计算命令边界(g.commandBuffer as number[]);
    if (!边界) {
      return null;
    }
    // 图章与普通烘焙一样对齐物理像素，避免方块轮廓在入图集时先被插值一次。
    边界.左 = Math.floor(边界.左 * 比) / 比;
    边界.顶 = Math.floor(边界.顶 * 比) / 比;
    const 宽 = Math.max(1, Math.ceil((边界.右 - 边界.左) * 比));
    const 高 = Math.max(1, Math.ceil((边界.底 - 边界.顶) * 比));
    const 预算 = 获取纹理预算(场景);
    const 位 = 分配图章(场景, 环境, 宽, 高);
    if (位) {
      const 帧 = `图章.${++序号}`;
      位.页.纹理.add(帧, 0, 位.x, 位.y, 宽, 高);
      g.__烘焙中 = true;
      g.setPosition(位.x - 边界.左 * 比, 位.y - 边界.顶 * 比).setScale(比);
      try {
        位.页.纹理.draw(g).render();
      } catch (错误) {
        位.页.纹理.remove(帧);
        throw 错误;
      }
      const 结果 = { 键: 位.页.键, 帧, 左: 边界.左, 顶: 边界.顶, 比 };
      环境.缓存.set(全键, 结果);
      return 结果;
    }
    if (!预算.腾出空间(宽 * 高)) {
      return null;
    }
    const 纹理 = 场景.sys.textures.addDynamicTexture(全键, 宽, 高);
    if (!纹理) {
      return null;
    }
    g.__烘焙中 = true;
    g.setPosition(-边界.左 * 比, -边界.顶 * 比).setScale(比);
    try {
      纹理.draw(g).render();
    } catch (错误) {
      场景.textures.remove(全键);
      throw 错误;
    }
    const 结果 = { 键: 全键, 左: 边界.左, 顶: 边界.顶, 比 };
    烘焙统计.图章独立创建++;
    const 纹理表 = 场景.textures;
    try {
      预算.登记(全键, 宽 * 高, () => {
        环境.缓存.delete(全键);
        if (纹理表.exists(全键)) 纹理表.remove(全键);
      });
    } catch (错误) {
      纹理表.remove(全键);
      throw 错误;
    }
    环境.缓存.set(全键, 结果);
    return 结果;
  } finally {
    g.destroy();
  }
}

const 已引用替身 = new WeakSet<Phaser.GameObjects.Image>();

export function 引用烘焙贴图(图: Phaser.GameObjects.Image): void {
  if (已引用替身.has(图)) return;
  引用纹理(图.scene, 图);
  已引用替身.add(图);
}

/** 设置/清除 Graphics 的替身贴图；旧替身中不再使用的贴图会被销毁。 */
export function 设置替身贴图(g: Phaser.GameObjects.Graphics, 列表?: 替身项[]): void {
  const 图 = g as 图形;
  const 旧 = 图.__替身;
  if (旧 && 旧 !== 列表) for (const 项 of 旧) if (!列表?.includes(项)) 项.贴图.destroy();
  if (列表) for (const 项 of 列表) 引用烘焙贴图(项.贴图);
  图.__替身 = 列表;
}

export function 获取替身贴图(g: Phaser.GameObjects.Graphics): 替身项[] | undefined {
  return (g as 图形).__替身;
}

/** 动态层与整帧一起降频，直接画一次即可；静态层继续复用烘焙。 */
export function 设为动态层(g: Phaser.GameObjects.Graphics): void {
  const 图 = g as 图形;
  if (!图.__禁止烘焙) 烘焙统计.跳过动态层++;
  图.__禁止烘焙 = true;
}

function 绘制贴图(
  图: Phaser.GameObjects.Image | Phaser.GameObjects.NineSlice,
  renderer: Phaser.Renderer.WebGL.WebGLRenderer,
  camera: Phaser.Renderer.WebGL.DrawingContext,
  parentMatrix?: Phaser.GameObjects.Components.TransformMatrix,
): void {
  if (图 instanceof Phaser.GameObjects.NineSlice) {
    const 渲染 = (
      图 as Phaser.GameObjects.NineSlice & {
        renderWebGL: (
          renderer: Phaser.Renderer.WebGL.WebGLRenderer,
          src: Phaser.GameObjects.NineSlice,
          camera: Phaser.Renderer.WebGL.DrawingContext,
          parentMatrix?: Phaser.GameObjects.Components.TransformMatrix,
        ) => void;
      }
    ).renderWebGL;
    渲染.call(图, renderer, 图, camera, parentMatrix);
    return;
  }
  const 渲染 = (
    图 as Phaser.GameObjects.Image & {
      renderWebGL: (
        renderer: Phaser.Renderer.WebGL.WebGLRenderer,
        src: Phaser.GameObjects.Image,
        camera: Phaser.Renderer.WebGL.DrawingContext,
        parentMatrix?: Phaser.GameObjects.Components.TransformMatrix,
      ) => void;
    }
  ).renderWebGL;
  渲染.call(图, renderer, 图, camera, parentMatrix);
}

/** 只绑定当前游戏中出现的Graphics实例，不改Phaser原型。 */
export function 安装图形烘焙(游戏: Phaser.Game): void {
  // shortcut: 命令与_renderSteps按Phaser4.2.1适配，升级时先复验，其他版本走原生绘制。
  if (Phaser.VERSION !== "4.2.1") return;
  if (已安装.has(游戏)) return;
  已安装.add(游戏);
  const 恢复表 = new Map<图形, () => void>();
  const 注销观察 = 观察场景对象(游戏, (对象) => {
    if (!(对象 instanceof Phaser.GameObjects.Graphics)) return;
    const g = 对象 as 图形;
    const 原清空 = g.clear;
    const 自有清空 = Object.hasOwn(g, "clear");
    const 自有渲染 = Object.hasOwn(g, "renderWebGL");
    g.clear = function () {
      this.__版本 = (this.__版本 ?? 0) + 1;
      return 原清空.call(this);
    };
    const 原渲染 = g.renderWebGL;
    g.renderWebGL = function (renderer, src, ctx, parentMatrix) {
      if (src.__烘焙中) return 原渲染.call(this, renderer, src, ctx, parentMatrix);
      if (src.__替身) {
        for (const 项 of src.__替身) {
          const 图 = 项.贴图;
          图.setPosition(src.x + 项.x * src.scaleX, src.y + 项.y * src.scaleY);
          图.alpha = src.alpha * 项.透明度;
          图.setScrollFactor(src.scrollFactorX, src.scrollFactorY);
          绘制贴图(图, renderer, ctx, parentMatrix);
        }
        return;
      }
      if (src.__禁止烘焙) return 原渲染.call(this, renderer, src, ctx, parentMatrix);
      候选.add(src);
      const 记录 = src.__烘焙;
      const 现签名 = 签名(src);
      if (记录 && 记录.签名 === 现签名) {
        if (记录.九宫) {
          摆放九宫(记录.九宫, src, 记录);
          烘焙统计.贴图渲染++;
          绘制贴图(记录.九宫, renderer, ctx, parentMatrix);
          return;
        }
        const 图 = 记录.贴图;
        图.setPosition(src.x, src.y);
        图.setScale(src.scaleX / 记录.比, src.scaleY / 记录.比);
        图.rotation = src.rotation;
        图.setOrigin((-记录.左 * 记录.比) / 记录.区.宽, (-记录.顶 * 记录.比) / 记录.区.高);
        图.alpha = src.alpha;
        图.blendMode = src.blendMode;
        图.setScrollFactor(src.scrollFactorX, src.scrollFactorY);
        烘焙统计.贴图渲染++;
        绘制贴图(图, renderer, ctx, parentMatrix);
        return;
      }
      烘焙统计.原生渲染++;
      return 原渲染.call(this, renderer, src, ctx, parentMatrix);
    };
    // Phaser 4在构造时缓存渲染函数，实例绑定必须同步这份步骤表。
    const 替换渲染 = g.renderWebGL;
    g._renderSteps = g._renderSteps?.map((步骤) => (步骤 === 原渲染 ? 替换渲染 : 步骤));
    const 恢复 = () => {
      释放(g);
      设置替身贴图(g, undefined);
      候选.delete(g);
      if (自有清空) g.clear = 原清空;
      else Reflect.deleteProperty(g, "clear");
      if (自有渲染) g.renderWebGL = 原渲染;
      else Reflect.deleteProperty(g, "renderWebGL");
      g._renderSteps = g._renderSteps?.map((步骤) => (步骤 === 替换渲染 ? 原渲染 : 步骤));
      恢复表.delete(g);
    };
    恢复表.set(g, 恢复);
    g.once(Phaser.GameObjects.Events.DESTROY, 恢复);
  });
  const 后步 = () => {
    for (const g of 候选) {
      if (!g.active || !g.scene) {
        候选.delete(g);
        continue;
      }
      if (g.__禁止烘焙 || !g.commandBuffer.length) continue;
      const 现 = 签名(g);
      if (g.__烘焙?.签名 === 现 || g.__跳过签名 === 现) continue;
      if (g.__上帧签名 === 现) 烘焙(g);
      g.__上帧签名 = 现;
    }
  };
  游戏.events.on(Phaser.Core.Events.POST_STEP, 后步);
  游戏.events.once(Phaser.Core.Events.DESTROY, () => {
    注销观察();
    游戏.events.off(Phaser.Core.Events.POST_STEP, 后步);
    for (const 恢复 of [...恢复表.values()]) 恢复();
    候选.clear();
    图集.length = 0;
    烘焙统计.图集页 = 0;
    烘焙统计.图集页256 = 0;
    烘焙统计.图集页512 = 0;
    烘焙统计.图集页1024 = 0;
    九宫表.clear();
    图章环境表.delete(游戏.textures);
    已安装.delete(游戏);
  });
}
