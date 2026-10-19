import Phaser from "phaser";
import { 观察场景对象 } from "./场景对象";
import { 引用纹理, 获取纹理预算 } from "./纹理缓存";

/**
 * Graphics 自动烘焙：Phaser 每帧都会把 Graphics 的矢量命令重新细分成三角形，静态面板/按钮/棋盘
 * 也不例外，这是低端机主线程的最大开销。这里在不改调用方的前提下：
 * - 命令未变化的 Graphics（连续两帧相同）在帧间（POST_STEP，渲染前）画进一张纹理，之后以单个贴图渲染；
 * - 每次都变化的动态层直接绘制，避免按需渲染下先画离屏纹理再贴回屏幕的额外一遍；
 * - 命令一变（clear/追加）立即回退到原生渲染，下一次稳定后再烘焙，视觉与原生一致。
 */

type 图形 = Phaser.GameObjects.Graphics & {
  __版本?: number;
  __上帧签名?: string;
  __烘焙?: 烘焙记录;
  __烘焙中?: boolean;
  __禁止烘焙?: boolean;
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
  贴图: Phaser.GameObjects.Image;
  左: number;
  顶: number;
  比: number;
}

/**
 * 烘焙图集：所有小块烘焙共享少数几张大纹理。
 * - 每新建一张 DynamicTexture 都要创建帧缓冲（checkFramebufferStatus 极慢），重建界面时会卡顿；
 * - 共享纹理的贴图可以合批，商店/设置这类几十个卡片的界面绘制调用大幅减少。
 * 页内用货架分配，释放的区域进入空闲表复用；一页全部释放时整页重置。
 */
interface 图集页 {
  纹理: Phaser.Textures.DynamicTexture;
  键: string;
  货架: { y: number; 高: number; x: number }[];
  已用高: number;
  空闲: { x: number; y: number; 宽: number; 高: number }[];
  在用: number;
  释放引用?: () => void;
}
const 页边 = 2048;
const 最多页 = 3;
const 间隙 = 2;
const 图集: 图集页[] = [];

function 分配区域(
  场景: Phaser.Scene,
  宽: number,
  高: number,
): { 页: 图集页; x: number; y: number } | null {
  const 纹理表 = 场景.textures;
  const 预算 = 获取纹理预算(场景);
  const W = 宽 + 间隙,
    H = 高 + 间隙;
  if (W > 页边 / 2 || H > 页边 / 2) return null;
  const 试页 = (页: 图集页) => {
    for (let i = 0; i < 页.空闲.length; i++) {
      const 区 = 页.空闲[i];
      if (区.宽 >= W && 区.高 >= H && 区.宽 * 区.高 <= W * H * 2.5) {
        页.空闲.splice(i, 1);
        return { x: 区.x, y: 区.y };
      }
    }
    for (const 架 of 页.货架) {
      if (架.高 >= H && 架.高 <= H * 1.6 + 8 && 架.x + W <= 页边) {
        const 位 = { x: 架.x, y: 架.y };
        架.x += W;
        return 位;
      }
    }
    if (页.已用高 + H <= 页边) {
      const 架 = { y: 页.已用高, 高: H, x: W };
      页.货架.push(架);
      页.已用高 += H;
      return { x: 0, y: 架.y };
    }
    return null;
  };
  for (const 页 of 图集) {
    if (!纹理表.exists(页.键)) continue;
    const 位 = 试页(页);
    if (位) {
      if (页.在用 === 0) 页.释放引用 = 预算.引用(页.键);
      页.在用++;
      return { 页, ...位 };
    }
  }
  if (图集.length >= 最多页) return null;
  if (!预算.腾出空间(页边 * 页边)) return null;
  const 键 = `图形烘焙.图集.${++序号}`;
  const 纹理 = 纹理表.addDynamicTexture(键, 页边, 页边);
  if (!纹理) return null;
  const 页: 图集页 = { 纹理, 键, 货架: [], 已用高: 0, 空闲: [], 在用: 0 };
  图集.push(页);
  预算.登记(键, 页边 * 页边, () => {
    图集.splice(图集.indexOf(页), 1);
    烘焙统计.图集页 = 图集.length;
    if (纹理表.exists(键)) 纹理表.remove(键);
  });
  页.释放引用 = 预算.引用(键);
  烘焙统计.图集页 = 图集.length;
  const 位 = 试页(页);
  if (!位) return null;
  页.在用++;
  return { 页, ...位 };
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
export const 烘焙统计 = {
  烘焙次数: 0,
  贴图渲染: 0,
  原生渲染: 0,
  独立纹理: 0,
  图集页: 0,
  图章命中: 0,
  图章未命中: 0,
  图章图集创建: 0,
  图章独立创建: 0,
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

function 释放(g: 图形): void {
  const 记录 = g.__烘焙;
  if (!记录) return;
  g.__烘焙 = undefined;
  记录.贴图.destroy();
  const 页 = 记录.页;
  if (页) {
    if (记录.纹理.has(记录.帧)) 记录.纹理.remove(记录.帧);
    页.在用--;
    if (页.在用 <= 0) {
      页.在用 = 0;
      页.释放引用?.();
      页.释放引用 = undefined;
      页.货架 = [];
      页.已用高 = 0;
      页.空闲 = [];
    } else {
      页.空闲.push({ x: 记录.区.x, y: 记录.区.y, 宽: 记录.容.宽 + 间隙, 高: 记录.容.高 + 间隙 });
    }
    return;
  }
  if (g.scene) 获取纹理预算(g.scene).移除(记录.键);
}

function 世界缩放(g: 图形): number {
  const m = g.getWorldTransformMatrix();
  const 缩放 = Math.max(Math.hypot(m.a, m.b), Math.hypot(m.c, m.d));
  const 镜头 = g.scene?.cameras?.main?.zoom ?? 1;
  // 世界矩阵不含镜头；按「本体缩放 × 镜头缩放」烘焙，贴图像素与屏幕像素一致。
  return Math.max(0.25, (缩放 / Math.max(1e-6, Math.abs(g.scaleX) || 1)) * 镜头);
}

function 烘焙(g: 图形): void {
  const 场景 = g.scene;
  if (!场景?.sys?.textures || !g.active) return;
  const 边界 = 计算命令边界(g.commandBuffer as number[]);
  if (!边界) {
    g.__禁止烘焙 = true;
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
    const 位 = 分配区域(场景, 容宽, 容高);
    let 纹理: Phaser.Textures.DynamicTexture;
    let 键: string;
    const 帧 = `f${++序号}`;
    let 区 = { x: 0, y: 0, 宽, 高 };
    if (位) {
      纹理 = 位.页.纹理;
      键 = 位.页.键;
      区 = { x: 位.x, y: 位.y, 宽, 高 };
    } else {
      烘焙统计.独立纹理++;
      键 = `图形烘焙.${++序号}`;
      const 预算 = 获取纹理预算(场景);
      if (!预算.腾出空间(容宽 * 容高)) return;
      const 新纹理 = 纹理表.addDynamicTexture(键, 容宽, 容高);
      if (!新纹理) return;
      纹理 = 新纹理;
      预算.登记(键, 容宽 * 容高, () => {
        if (纹理表.exists(键)) 纹理表.remove(键);
      });
    }
    纹理.add(帧, 0, 区.x, 区.y, 宽, 高);
    const 贴图 = 场景.make.image(
      { key: 键, frame: 帧 } as Phaser.Types.GameObjects.Sprite.SpriteConfig,
      false,
    );
    if (!位) 引用纹理(场景, 贴图);
    记录 = {
      签名: "",
      纹理,
      键,
      帧,
      页: 位?.页,
      区,
      容: { 宽: 容宽, 高: 容高 },
      贴图,
      左: 0,
      顶: 0,
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
  x: number;
  y: number;
  行高: number;
}
interface 图章环境 {
  缓存: Map<string, 图章贴图>;
  页: 图章页[];
}
const 图章环境表 = new WeakMap<Phaser.Textures.TextureManager, 图章环境>();
const 图章页边 = 1024;

function 分配图章(场景: Phaser.Scene, 环境: 图章环境, 宽: number, 高: number) {
  const 纹理表 = 场景.textures;
  const W = 宽 + 间隙,
    H = 高 + 间隙;
  if (W > 图章页边 || H > 图章页边) return null;
  const 试放 = (页: 图章页) => {
    if (页.x + W > 图章页边) {
      页.y += 页.行高;
      页.x = 0;
      页.行高 = 0;
    }
    if (页.y + H > 图章页边) return null;
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
  if (!预算.腾出空间(图章页边 * 图章页边)) return null;
  const 键 = `图章图集.${++序号}`;
  const 纹理 = 纹理表.addDynamicTexture(键, 图章页边, 图章页边);
  if (!纹理) return null;
  const 页: 图章页 = { 键, 纹理, x: 0, y: 0, 行高: 0 };
  try {
    预算.登记(键, 图章页边 * 图章页边, () => {
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
  (g as 图形).__禁止烘焙 = true;
}

function 绘制贴图(
  图: Phaser.GameObjects.Image,
  renderer: Phaser.Renderer.WebGL.WebGLRenderer,
  camera: Phaser.Renderer.WebGL.DrawingContext,
  parentMatrix?: Phaser.GameObjects.Components.TransformMatrix,
): void {
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
      if (g.__烘焙?.签名 === 现) continue;
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
    图章环境表.delete(游戏.textures);
    已安装.delete(游戏);
  });
}
