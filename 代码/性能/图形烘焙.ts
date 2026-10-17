import Phaser from "phaser";

/**
 * Graphics 自动烘焙：Phaser 每帧都会把 Graphics 的矢量命令重新细分成三角形，静态面板/按钮/棋盘
 * 也不例外，这是低端机主线程的最大开销。这里在不改调用方的前提下：
 * - 命令未变化的 Graphics（连续两帧相同）在帧间（POST_STEP，渲染前）画进一张纹理，之后以单个贴图渲染；
 * - 标记为「总是烘焙」的动画层（动态背景）每次重绘都直接烘焙，渲染只贴图，从不逐帧细分；
 * - 命令一变（clear/追加）立即回退到原生渲染，下一次稳定后再烘焙，视觉与原生一致。
 */

type 图形 = Phaser.GameObjects.Graphics & {
  __版本?: number;
  __上帧签名?: string;
  __烘焙?: 烘焙记录;
  __烘焙中?: boolean;
  __总是烘焙?: boolean;
  __禁止烘焙?: boolean;
};

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
}
const 页边 = 2048;
const 最多页 = 3;
const 间隙 = 2;
const 图集: 图集页[] = [];

function 分配区域(
  纹理表: Phaser.Textures.TextureManager,
  宽: number,
  高: number,
): { 页: 图集页; x: number; y: number } | null {
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
      页.在用++;
      return { 页, ...位 };
    }
  }
  if (图集.length >= 最多页) return null;
  const 键 = `图形烘焙.图集.${图集.length}`;
  const 纹理 = 纹理表.addDynamicTexture(键, 页边, 页边);
  if (!纹理) return null;
  const 页: 图集页 = { 纹理, 键, 货架: [], 已用高: 0, 空闲: [], 在用: 0 };
  图集.push(页);
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
let 已安装 = false;
const 候选 = new Set<图形>();
export const 烘焙统计 = { 烘焙次数: 0, 贴图渲染: 0, 原生渲染: 0, 独立纹理: 0, 图集页: 0 };

function 签名(g: 图形): string {
  return `${g.__版本 ?? 0}:${g.commandBuffer.length}`;
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
      页.货架 = [];
      页.已用高 = 0;
      页.空闲 = [];
    } else {
      页.空闲.push({ x: 记录.区.x, y: 记录.区.y, 宽: 记录.容.宽 + 间隙, 高: 记录.容.高 + 间隙 });
    }
    return;
  }
  if (g.scene?.sys?.textures?.exists(记录.键)) g.scene.sys.textures.remove(记录.键);
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
    const 位 = 分配区域(纹理表, 容宽, 容高);
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
      const 新纹理 = 纹理表.addDynamicTexture(键, 容宽, 容高);
      if (!新纹理) return;
      纹理 = 新纹理;
    }
    纹理.add(帧, 0, 区.x, 区.y, 宽, 高);
    const 贴图 = 场景.make.image(
      { key: 键, frame: 帧 } as Phaser.Types.GameObjects.Sprite.SpriteConfig,
      false,
    );
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

/** 标记一个 Graphics 为动画层：每次内容变化都直接烘焙，渲染从不逐帧细分。 */
export function 设为烘焙动画层(g: Phaser.GameObjects.Graphics): void {
  (g as 图形).__总是烘焙 = true;
}

/** 安装补丁（全局一次）并挂到游戏的帧间事件上。 */
export function 安装图形烘焙(游戏: Phaser.Game): void {
  if (!已安装) {
    已安装 = true;
    const 原型 = Phaser.GameObjects.Graphics.prototype as unknown as {
      clear: (this: 图形) => 图形;
      renderWebGL: (renderer: unknown, src: 图形, ctx: unknown, parentMatrix?: unknown) => void;
      preDestroy: (this: 图形) => void;
    };
    const 原清空 = 原型.clear;
    原型.clear = function (this: 图形) {
      this.__版本 = (this.__版本 ?? 0) + 1;
      return 原清空.call(this);
    };
    const 原渲染 = 原型.renderWebGL;
    原型.renderWebGL = function (renderer, src, ctx, parentMatrix) {
      if (src.__烘焙中) return 原渲染.call(this, renderer, src, ctx, parentMatrix);
      候选.add(src);
      const 记录 = src.__烘焙;
      const 现签名 = 签名(src);
      if (记录 && (记录.签名 === 现签名 || src.__总是烘焙)) {
        const 图 = 记录.贴图;
        图.setPosition(src.x, src.y);
        图.setScale(src.scaleX / 记录.比, src.scaleY / 记录.比);
        图.rotation = src.rotation;
        图.setOrigin((-记录.左 * 记录.比) / 记录.区.宽, (-记录.顶 * 记录.比) / 记录.区.高);
        图.alpha = src.alpha;
        图.blendMode = src.blendMode;
        图.setScrollFactor(src.scrollFactorX, src.scrollFactorY);
        烘焙统计.贴图渲染++;
        (图 as unknown as { renderWebGL: typeof 原渲染 }).renderWebGL(
          renderer,
          图 as never,
          ctx,
          parentMatrix,
        );
        return;
      }
      烘焙统计.原生渲染++;
      return 原渲染.call(this, renderer, src, ctx, parentMatrix);
    };
    const 原销毁 = 原型.preDestroy;
    原型.preDestroy = function (this: 图形) {
      释放(this);
      候选.delete(this);
      原销毁?.call(this);
    };
  }
  游戏.events.on(Phaser.Core.Events.POST_STEP, () => {
    for (const g of 候选) {
      if (!g.active || !g.scene) {
        候选.delete(g);
        continue;
      }
      if (g.__禁止烘焙 || !g.commandBuffer.length) continue;
      const 现 = 签名(g);
      if (g.__烘焙?.签名 === 现) continue;
      if (g.__总是烘焙 || g.__上帧签名 === 现) 烘焙(g);
      g.__上帧签名 = 现;
    }
  });
}
