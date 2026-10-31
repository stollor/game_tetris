import {
  AmbientLight,
  BufferGeometry,
  Color,
  DirectionalLight,
  DoubleSide,
  DynamicDrawUsage,
  Float32BufferAttribute,
  Group,
  InstancedMesh,
  LineBasicMaterial,
  LineSegments,
  Matrix4,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  type ShaderMaterial,
  Vector4,
} from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { 立体规范 } from "../../主题/立体/立体规范";
import type { 方块类型 } from "../../代码/玩法/再消一行";
import type { 渲染前置上下文 } from "../../框架/世界/渲染编排";
import type { 棋盘输入 } from "../../预制体/对局/棋盘配方";
import type { 特效状态 } from "../特效/对局特效";
import { 计算房间取景 } from "./取景";
import { 建房间装置, 建辉光材质 } from "./房间装置";
import { 转颜色向量 } from "./直通颜色";

const 最大实例 = 220;
const 矩阵 = new Matrix4();
const 色 = new Color();
const 视口缓存 = new Vector4();
const 房间 = 立体规范.房间;
const 块规 = 立体规范.块;

export interface 透视对局快照 {
  列: number;
  行: number;
  棋盘: { 左: number; 上: number; 宽: number; 高: number };
  格子: (方块类型 | null)[][];
  当前格子: readonly [number, number][];
  当前类型: 方块类型;
  影子: readonly [number, number][];
  落点影透明度: number;
  跳过当前方块?: boolean;
  消行行: readonly number[];
  消行进度: number;
  锁定格子: readonly [number, number][];
  锁定透明度: number;
}

/**
 * 房间的一帧几何参数：由取景纯函数算出，渲染层不再自行推断。
 * 背墙格宽不变，口沿向两侧展开，为内壁和金属装置保留空间。
 */
interface 房间尺寸 {
  宽: number;
  高: number;
  开口宽: number;
  /** 开口到背墙的进深。 */
  进深: number;
}

interface 房间体 {
  根节点: Scene;
  实体: InstancedMesh;
  幽灵: InstancedMesh;
  尺寸: 房间尺寸;
}

let 快照: 透视对局快照 | null = null;
let 相机: PerspectiveCamera | null = null;
let 房间体实例: 房间体 | null = null;
let 房间键 = "";
let 取景键 = "";

export function 提交透视对局(输入: 棋盘输入, 特效: 特效状态 | null): void {
  快照 = {
    列: 输入.棋盘.列,
    行: 输入.棋盘.行,
    棋盘: {
      左: 输入.棋盘.左 + 输入.偏移X,
      上: 输入.棋盘.上 + 输入.偏移Y,
      宽: 输入.棋盘.宽,
      高: 输入.棋盘.高,
    },
    格子: 输入.格子,
    当前格子: 输入.当前格子,
    当前类型: 输入.当前类型,
    影子: 输入.影子,
    落点影透明度: 输入.落点影透明度,
    跳过当前方块: 输入.跳过当前方块,
    消行行: 特效?.消行?.行 ?? [],
    消行进度: 特效?.消行 ? Math.min(1, 特效.消行.经过秒 / 特效.消行.时长秒) : 0,
    锁定格子: 特效?.锁定?.格子 ?? [],
    锁定透明度: 特效?.锁定 ? Math.max(0, 1 - 特效.锁定.经过秒 / 特效.锁定.时长秒) : 0,
  };
}

export function 清空透视棋盘(): void {
  快照 = null;
  释放场景();
}

export function 读取透视棋盘快照(): 透视对局快照 | null {
  return 快照;
}

/** 对局退出或切回平面后应为 false，供跨主题验收核对 GPU 场景已释放。 */
export function 读取透视棋盘占用(): boolean {
  return 快照 !== null || 房间体实例 !== null;
}

function 直通色(十六进制: number): Color {
  return new Color().setRGB(...转颜色向量(十六进制));
}

function 直通光(
  十六进制: number,
  强度: number,
  方向: readonly [number, number, number],
  距离: number,
): DirectionalLight {
  const 光 = new DirectionalLight();
  光.color.copy(直通色(十六进制));
  光.intensity = 强度;
  const 长 = Math.hypot(方向[0], 方向[1], 方向[2]) || 1;
  光.position.set((方向[0] / 长) * 距离, (方向[1] / 长) * 距离, (方向[2] / 长) * 距离);
  return 光;
}

function 格心X(列: number, 列数: number): number {
  return 列 - (列数 - 1) / 2;
}

function 格心Y(行: number, 行数: number): number {
  return (行数 - 1) / 2 - 行;
}

/** 方块中心：背面贴背墙留一点缝，整块朝镜头伸出。 */
function 方块中心Z(尺寸: 房间尺寸): number {
  return -尺寸.进深 + 块规.离墙 + 块规.进深 / 2;
}

function 写入实例(
  网格: InstancedMesh,
  序号: number,
  列: number,
  行: number,
  列数: number,
  行数: number,
  类型: 方块类型,
  尺寸: 房间尺寸,
  缩放: number,
  提亮: number,
): void {
  矩阵.makeScale(缩放, 缩放, 缩放);
  矩阵.setPosition(格心X(列, 列数), 格心Y(行, 行数), 方块中心Z(尺寸));
  网格.setMatrixAt(序号, 矩阵);
  const 原 = 转颜色向量(立体规范.方块[类型]);
  const t = Math.max(0, Math.min(1, 提亮));
  色.setRGB(原[0] + (1 - 原[0]) * t, 原[1] + (1 - 原[1]) * t, 原[2] + (1 - 原[2]) * t);
  网格.setColorAt(序号, 色);
}

type 顶点 = [number, number, number];

/**
 * 用四个顶点拼一块四边形。房间的侧壁与顶底面都是梯形，不能用 PlaneGeometry。
 * 用 DoubleSide：房间只从内部看，双面能让绕序失误时也保持可见，
 * Three 会在背面片元自动翻转法线，光照不受影响。
 */
function 建四边形(甲: 顶点, 乙: 顶点, 丙: 顶点, 丁: 顶点, 材质: MeshStandardMaterial): Mesh {
  const 几何 = new BufferGeometry();
  // 甲-乙-丙 与 甲-丙-丁 两个三角形。
  几何.setAttribute(
    "position",
    new Float32BufferAttribute([...甲, ...乙, ...丙, ...甲, ...丙, ...丁], 3),
  );
  几何.computeVertexNormals();
  const 面 = new Mesh(几何, 材质);
  面.receiveShadow = true;
  return 面;
}

function 壁材质(颜色: number, 粗糙: number, 金属: number): MeshStandardMaterial {
  const 材质 = new MeshStandardMaterial({
    color: 直通色(颜色),
    roughness: 粗糙,
    metalness: 金属,
    emissive: 直通色(颜色),
    emissiveIntensity: 立体规范.光.壁自发光,
    side: DoubleSide,
  });
  return 材质;
}

/**
 * 房间五个面：背墙 + 左右侧壁 + 地面 + 顶面。
 * 每个面都是独立平面，且只朝房间内部——用 BoxGeometry 当壳时朝向相机的正面
 * 也会被当成内表面画出来，正好盖住井口，井内全黑。
 */
function 建房间面(尺寸: 房间尺寸): Group {
  const 组 = new Group();
  const 半宽 = 尺寸.宽 / 2;
  const 口半宽 = 尺寸.开口宽 / 2;
  const 半高 = 尺寸.高 / 2;
  const 深 = 尺寸.进深;

  // 背墙：网格所在平面，正对相机。
  const 背材 = new MeshStandardMaterial({
    color: 直通色(房间.背墙),
    roughness: 1,
    metalness: 0,
    emissive: 直通色(房间.背墙),
    emissiveIntensity: 房间.背墙底光,
  });
  const 背 = new Mesh(new PlaneGeometry(尺寸.宽, 尺寸.高), 背材);
  背.position.set(0, 0, -深);
  背.receiveShadow = true;
  组.add(背);

  const 壁材 = 壁材质(房间.侧壁, 房间.侧壁粗糙, 0);
  const 地材 = 壁材质(房间.地面, 房间.地面粗糙, 房间.地面金属);
  const 顶材 = 壁材质(房间.顶面, 1, 0);

  // 左右侧壁：背墙竖边 → 开口竖边。
  for (const 横 of [-1, 1]) {
    组.add(
      建四边形(
        [横 * 半宽, -半高, -深],
        [横 * 半宽, 半高, -深],
        [横 * 口半宽, 半高, 0],
        [横 * 口半宽, -半高, 0],
        壁材,
      ),
    );
  }
  // 地面与顶面：背墙横边 → 开口横边。
  组.add(
    建四边形(
      [-半宽, -半高, -深],
      [半宽, -半高, -深],
      [口半宽, -半高, 0],
      [-口半宽, -半高, 0],
      地材,
    ),
    建四边形([-半宽, 半高, -深], [半宽, 半高, -深], [口半宽, 半高, 0], [-口半宽, 半高, 0], 顶材),
  );
  return 组;
}

/**
 * 背墙网格与玩法逐格对齐；侧壁结构由装置的壁肋呈现，避免密集亮线抢走方块。
 */
function 建房间线(尺寸: 房间尺寸, 列: number, 行: number): LineSegments {
  const 半宽 = 尺寸.宽 / 2;
  const 半高 = 尺寸.高 / 2;
  const 背Z = -尺寸.进深;
  /**
   * 网格往内缩一丝再抬离背墙：k=0 与 k=列 两条边界线正好压在侧壁上，
   * 深度相同时会被墙面抢走像素——实测左右边界线都不见，只剩 9 条竖线。
   * 内缩量远小于格宽，画面上看不出偏移。
   */
  const 内缩 = 房间.格线抬升;
  const 墙宽 = 尺寸.宽 - 内缩 * 2;
  const 墙高 = 尺寸.高 - 内缩 * 2;
  const 墙面Z = 背Z + 内缩;
  const 细: number[] = [];
  const 粗: number[] = [];

  // 背墙网格：与玩法行列严格一致。
  for (let k = 0; k <= 列; k += 1) {
    const x = (k / 列 - 0.5) * 墙宽;
    const 目标 = k % 5 === 0 ? 粗 : 细;
    目标.push(x, -半高 + 内缩, 墙面Z, x, 半高 - 内缩, 墙面Z);
  }
  for (let k = 0; k <= 行; k += 1) {
    const y = (k / 行 - 0.5) * 墙高;
    const 目标 = k % 5 === 0 ? 粗 : 细;
    目标.push(-半宽 + 内缩, y, 墙面Z, 半宽 - 内缩, y, 墙面Z);
  }

  const 位置: number[] = [];
  const 颜色: number[] = [];
  const 细色 = 转颜色向量(房间.格线);
  const 粗色 = 转颜色向量(房间.棱);
  for (const 值 of 细) {
    位置.push(值);
    颜色.push(细色[0], 细色[1], 细色[2]);
  }
  for (const 值 of 粗) {
    位置.push(值);
    颜色.push(粗色[0], 粗色[1], 粗色[2]);
  }
  // 四条内棱：从开口四角连到背墙四角，是「房间向里延伸」最直接的线。
  for (const 横 of [-1, 1])
    for (const 纵 of [-1, 1]) {
      位置.push(横 * 半宽, 纵 * 半高, 背Z, (横 * 尺寸.开口宽) / 2, 纵 * 半高, 0);
      颜色.push(粗色[0], 粗色[1], 粗色[2]);
    }

  const 几何 = new BufferGeometry();
  几何.setAttribute("position", new Float32BufferAttribute(位置, 3));
  几何.setAttribute("color", new Float32BufferAttribute(颜色, 3));
  const 材质 = new LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 房间.格线不透明,
    depthWrite: false,
  });
  return new LineSegments(几何, 材质);
}

/** 真实厚度与等半径倒角，不压扁单位立方体上的法线和倒角。 */
export function 建方块几何(): RoundedBoxGeometry {
  return new RoundedBoxGeometry(1, 1, 块规.进深, 块规.圆角分段, 块规.圆角);
}

/** 面与面的明暗由几何法线、真实灯光和阴影决定。 */
function 建方块材质(): MeshPhysicalMaterial {
  return new MeshPhysicalMaterial({
    roughness: 块规.粗糙度,
    metalness: 块规.金属度,
    clearcoat: 块规.清漆,
    clearcoatRoughness: 块规.清漆粗糙,
  });
}

function 确保房间(列: number, 行: number): 房间体 {
  const 宽高比 = (列 + 房间.口沿外扩横格 * 2) / (行 + 房间.口沿外扩纵格 * 2);
  const 键 = `${列}x${行}`;
  if (房间体实例 && 房间键 === 键) return 房间体实例;
  释放场景();
  // 尺寸全部由取景纯函数给出：横截面=网格，开口贴满视口，进深由后墙占比反推。
  const 取景 = 计算房间取景({
    列,
    行,
    视野: 立体规范.镜头.视野,
    宽高比,
    后墙占比: 房间.后墙占比高,
  });
  const 尺寸: 房间尺寸 = {
    宽: 列,
    高: 行,
    开口宽: 取景.开口宽,
    进深: 取景.进深,
  };

  const 场景 = new Scene();
  场景.background = null;
  相机 = new PerspectiveCamera(立体规范.镜头.视野, 0.5, 立体规范.镜头.近, 立体规范.镜头.远);

  const 光 = 立体规范.光;
  const 环境 = new AmbientLight();
  环境.color.copy(直通色(光.环境));
  环境.intensity = 光.环境强度;
  const 光距 = 取景.背墙距离 * 1.6;
  // 斜上方主光形成块间投影，低强度补光只保留暗面的可读性。
  const 面光们 = Object.values(光.面光).map((配方) => 直通光(配方.色, 配方.强度, 配方.向, 光距));
  // 背墙那盏光负责投影：方块在背墙上的软影是「方块在房间里」的直接证据。
  const 主光 = 面光们[0] as DirectionalLight;
  主光.castShadow = true;
  主光.shadow.mapSize.set(立体规范.阴影.贴图, 立体规范.阴影.贴图);
  const 影范围 = Math.max(列, 行) * 0.7;
  主光.shadow.camera.left = -影范围;
  主光.shadow.camera.right = 影范围;
  主光.shadow.camera.top = 影范围;
  主光.shadow.camera.bottom = -影范围;
  主光.shadow.camera.near = 0.5;
  主光.shadow.camera.far = 光距 * 2.5;
  主光.shadow.bias = 立体规范.阴影.偏置;
  主光.shadow.normalBias = 立体规范.阴影.法线偏置;
  主光.shadow.radius = 立体规范.阴影.半径;
  主光.target.position.set(0, 0, -尺寸.进深);
  场景.add(环境, ...面光们, 主光.target);

  场景.add(建房间面(尺寸), 建房间线(尺寸, 列, 行), 建房间装置(列, 行, 尺寸.进深, 尺寸.开口宽));

  const 几何 = 建方块几何();
  const 实体 = new InstancedMesh(几何, 建方块材质(), 最大实例);
  实体.instanceMatrix.setUsage(DynamicDrawUsage);
  实体.count = 0;
  实体.castShadow = true;
  实体.receiveShadow = true;
  实体.frustumCulled = false;

  const 幽灵 = new InstancedMesh(new PlaneGeometry(), 建幽灵材质(), 最大实例);
  幽灵.instanceMatrix.setUsage(DynamicDrawUsage);
  幽灵.count = 0;
  幽灵.frustumCulled = false;
  幽灵.renderOrder = 3;

  场景.add(实体, 幽灵);

  房间体实例 = { 根节点: 场景, 实体, 幽灵, 尺寸 };
  房间键 = 键;
  取景键 = "";
  return 房间体实例;
}

function 释放场景(): void {
  if (!房间体实例) return;
  const 旧 = 房间体实例;
  旧.根节点.traverse((物) => {
    const 网格 = 物 as Mesh;
    if (物 instanceof InstancedMesh) 物.dispose();
    if (物 instanceof DirectionalLight) 物.shadow.dispose();
    网格.geometry?.dispose();
    const 材质 = 网格.material;
    if (Array.isArray(材质)) for (const 项 of 材质) 项.dispose();
    else if (材质) 材质.dispose();
  });
  房间体实例 = null;
  房间键 = "";
  取景键 = "";
  相机 = null;
}

function 同步(尺寸: 房间尺寸): void {
  if (!快照 || !房间体实例) return;
  const { 实体, 幽灵 } = 房间体实例;
  const 列数 = 快照.列;
  const 行数 = 快照.行;
  const 消行 = new Set(快照.消行行);
  const 锁定 = new Set(快照.锁定格子.map(([列, 行]) => `${列},${行}`));
  let 数 = 0;
  for (let 行 = 0; 行 < 行数; 行 += 1) {
    const 数据 = 快照.格子[行 + 2];
    if (!数据) continue;
    for (let 列 = 0; 列 < 列数; 列 += 1) {
      const 类型 = 数据[列];
      if (!类型) continue;
      const 正在消 = 消行.has(行);
      if (正在消 && 快照.消行进度 >= 0.92) continue;
      const 缩 = 块规.缩 * (正在消 ? Math.max(0.08, 1 - 快照.消行进度) : 1);
      const 提亮 = 正在消
        ? 0.35 + 快照.消行进度 * 0.5
        : 锁定.has(`${列},${行}`)
          ? 快照.锁定透明度 * 0.7
          : 0;
      写入实例(实体, 数, 列, 行, 列数, 行数, 类型, 尺寸, 缩, 提亮);
      数 += 1;
      if (数 >= 最大实例) break;
    }
    if (数 >= 最大实例) break;
  }
  if (!快照.跳过当前方块) {
    for (const [列, 行] of 快照.当前格子) {
      if (行 < 0 || 行 >= 行数 || 数 >= 最大实例) continue;
      写入实例(实体, 数, 列, 行, 列数, 行数, 快照.当前类型, 尺寸, 块规.缩, 0);
      数 += 1;
    }
  }
  实体.count = 数;
  实体.instanceMatrix.needsUpdate = true;
  if (实体.instanceColor) 实体.instanceColor.needsUpdate = true;

  let 幽灵数 = 0;
  for (const [列, 行] of 快照.影子) {
    if (行 < 0 || 行 >= 行数 || 快照.格子[行 + 2]?.[列] || 幽灵数 >= 最大实例) continue;
    写入实例(幽灵, 幽灵数, 列, 行, 列数, 行数, 快照.当前类型, 尺寸, 块规.缩, 0);
    幽灵数 += 1;
  }
  幽灵.count = 幽灵数;
  幽灵.instanceMatrix.needsUpdate = true;
  if (幽灵.instanceColor) 幽灵.instanceColor.needsUpdate = true;
  const 幽灵材质 = 幽灵.material as ShaderMaterial;
  const 透明 = 幽灵材质.uniforms.opacity;
  if (透明) 透明.value = Math.max(0, Math.min(1, 快照.落点影透明度 / 100)) * 立体规范.幽灵.不透明比;
}

function 建幽灵材质(): ShaderMaterial {
  const 材质 = 建辉光材质(0xffffff, 立体规范.幽灵.不透明比, 1);
  材质.fragmentShader = `
    uniform float opacity;
    varying vec2 vGlowUv;
    varying vec3 vGlowColor;
    void main() {
      vec2 p = abs(vGlowUv - 0.5) * 2.0;
      float edge = max(p.x, p.y);
      float line = smoothstep(${(1 - 立体规范.幽灵.线宽 * 2).toFixed(3)}, 0.99, edge);
      gl_FragColor = vec4(vGlowColor, line * opacity);
    }`;
  return 材质;
}

/**
 * 相机：正对开口、注视背墙中心，只沿 +z 退开。
 * 位置由取景结果给出；视口宽高比变化时重算 aspect，房间几何本身不变形。
 */
function 更新取景(宽高比: number, 列: number, 行: number): void {
  if (!相机) return;
  const 键 = `${宽高比.toFixed(5)}|${列}x${行}`;
  if (取景键 === 键) return;
  const 取景 = 计算房间取景({
    列,
    行,
    视野: 立体规范.镜头.视野,
    宽高比,
    后墙占比: 房间.后墙占比高,
  });
  相机.aspect = 宽高比;
  相机.fov = 立体规范.镜头.视野;
  相机.position.set(取景.位置[0], 取景.位置[1], 取景.位置[2]);
  相机.up.set(0, 1, 0);
  相机.lookAt(取景.目标[0], 取景.目标[1], 取景.目标[2]);
  相机.updateProjectionMatrix();
  取景键 = 键;
}

/**
 * 2D 界面之前画 3D 房间；无快照则不碰渲染器状态。
 *
 * setViewport/setScissor 收 CSS 逻辑像素，渲染器内部会再乘一次 pixelRatio。
 * 传后备缓冲像素会把视口放大一倍并偏出画布，房间只剩左上角可见。
 */
export function 绘制透视棋盘(上下文: 渲染前置上下文): void {
  if (!快照 || 快照.棋盘.宽 <= 0 || 快照.棋盘.高 <= 0) return;
  const 体 = 确保房间(快照.列, 快照.行);
  if (!相机) return;
  同步(体.尺寸);
  const { 渲染器, 逻辑高 } = 上下文;
  const 格 = 快照.棋盘.宽 / 快照.列;
  const 横扩 = 房间.口沿外扩横格 * 格;
  const 纵扩 = 房间.口沿外扩纵格 * 格;
  const 视口宽 = 快照.棋盘.宽 + 横扩 * 2;
  const 视口高 = 快照.棋盘.高 + 纵扩 * 2;
  const 视口左 = 快照.棋盘.左 - 横扩;
  const 视口下 = 逻辑高 - (快照.棋盘.上 + 快照.棋盘.高 + 纵扩);
  if (视口宽 < 1 || 视口高 < 1) return;
  更新取景(视口宽 / 视口高, 快照.列, 快照.行);

  渲染器.getViewport(视口缓存);
  渲染器.setViewport(视口左, 视口下, 视口宽, 视口高);
  渲染器.setScissor(视口左, 视口下, 视口宽, 视口高);
  渲染器.setScissorTest(true);
  渲染器.shadowMap.enabled = true;
  渲染器.render(体.根节点, 相机);
  渲染器.setScissorTest(false);
  渲染器.setViewport(视口缓存.x, 视口缓存.y, 视口缓存.z, 视口缓存.w);
}
