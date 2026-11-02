import {
  AdditiveBlending,
  BoxGeometry,
  Color,
  Group,
  InstancedMesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  PointLight,
  ShaderMaterial,
} from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { 立体规范 } from "../../主题/立体/立体规范";
import { 转颜色向量 } from "./直通颜色";

const 规 = 立体规范.装置;

/**
 * 口沿灯带的实体光源参数（390×844 同机位像素对照标定，见 `测试/浏览器/排查/立体棋盘.ts`）。
 *
 * 灯带原来用 three 的 RectAreaLight，它必然引 `three/addons/lights/RectAreaLightUniformsLib.js`
 * ——一张 64×64 RGBA float 的 LTC BRDF 查找表，base64 后占包体 271KB，比整个 3D 房间的代码还大。
 * 这里的灯带是贴在口沿上的窄长条（灯宽 0.045 × 灯长 2.1），只照亮房间前半段的墙面与近口方块，
 * 用「二次衰减 + 射程≈一个进深」的点光等效：实测左右内壁带亮度差 0.17/−0.17、
 * 顶带 0.40、背墙 1.83、方块堆 1.60、房间静态区 1.65（原面光自身贡献 3.46），
 * 全房间 |Δ| 均值 2.71/p90 6.2，1× 视图无可辨差异。
 *
 * 倍率是「主题里的面光强度 → 点光坎德拉」的换算；射程不设成一个进深时，顶面/地面/远墙
 * 会被一起提亮（实测比原版高 3~4 倍），灯带就变成整间打光。
 *
 * 已知取舍：点光的灯带峰比原版的 RectAreaLight 窄一点（壁带纵向亮度残差 p90 ≈ 12/255），
 * 均值已对齐；1× 视图看不出来，放大会看到 4 段亮带边缘更硬。要完全一致得回到 LTC 面光，
 * 与「包体去掉 271KB」不可兼得。
 *
 * 标定口径：390×844 DPR1、同一固定方块序列与机位，逐区域比较改造前后的亮度差。
 */
const 灯带强度倍率 = 0.7;
const 顶灯强度倍率 = 0.2;
const 灯衰减 = 2;
const 射程比 = 1.04;

/** 局部光晕直接随实例绘制，不增加全屏后处理或第二个渲染器。 */
export function 建辉光材质(颜色: number, 不透明: number, 衰减: number): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: {
      tint: { value: new Color().setRGB(...转颜色向量(颜色)) },
      opacity: { value: 不透明 },
      falloff: { value: 衰减 },
    },
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    vertexShader: `
      varying vec2 vGlowUv;
      varying vec3 vGlowColor;
      void main() {
        vGlowUv = uv;
        vGlowColor = vec3(1.0);
        vec4 point = vec4(position, 1.0);
        #ifdef USE_INSTANCING
          point = instanceMatrix * point;
        #endif
        #ifdef USE_INSTANCING_COLOR
          vGlowColor = instanceColor;
        #endif
        gl_Position = projectionMatrix * modelViewMatrix * point;
      }`,
    fragmentShader: `
      uniform vec3 tint;
      uniform float opacity;
      uniform float falloff;
      varying vec2 vGlowUv;
      varying vec3 vGlowColor;
      void main() {
        vec2 distance = abs(vGlowUv - 0.5) * 2.0;
        float light = pow(max(0.0, 1.0 - distance.x * distance.x), falloff)
                    * pow(max(0.0, 1.0 - distance.y * distance.y), falloff);
        gl_FragColor = vec4(tint * vGlowColor, light * opacity);
      }`,
  });
}

interface 装置件 {
  位置: [number, number, number];
  尺寸: [number, number, number];
  色: number;
  转角?: number;
  侧转角?: number;
}

/**
 * 一条灯带的等效点光：位置与灯芯重合，射程按房间进深收在房间前半段。
 * 进深由取景给出，射程跟着房间尺寸走，不写死世界坐标。
 */
function 建灯带光(色: number, 强度: number, x: number, y: number, 深: number): PointLight {
  const 光 = new PointLight();
  光.intensity = 强度;
  光.distance = 深 * 射程比;
  光.decay = 灯衰减;
  光.color.setRGB(...转颜色向量(色));
  光.position.set(x, y, -规.灯离口);
  return 光;
}

/** 口沿、内轨、壁肋与灯带共用格宽单位；全部静态合批。 */
export function 建房间装置(宽: number, 高: number, 深: number, 开口宽 = 宽): Group {
  const 组 = new Group();
  const 金属: 装置件[] = [];
  const 灯: 装置件[] = [];
  const 辉光: 装置件[] = [];
  const 半宽 = 宽 / 2;
  const 口半宽 = 开口宽 / 2;
  const 半高 = 高 / 2;
  const 框X = 口半宽 - 规.框宽 / 2;
  const 框Y = 半高 - 规.框宽 / 2;
  const 背Z = -深 + 立体规范.房间.格线抬升 * 2;
  for (const 向 of [-1, 1]) {
    金属.push(
      {
        位置: [向 * (口半宽 - 规.框边宽), 0, 规.框厚 / 2],
        尺寸: [规.框边宽, 高, 规.框边宽],
        色: 规.框边色,
      },
      {
        位置: [0, 向 * (半高 - 规.框边宽), 规.框厚 / 2],
        尺寸: [开口宽, 规.框边宽, 规.框边宽],
        色: 规.框边色,
      },
      { 位置: [向 * 框X, 0, 0], 尺寸: [规.框宽, 高, 规.框厚], 色: 规.框色 },
      { 位置: [0, 向 * 框Y, 0], 尺寸: [开口宽, 规.框宽, 规.框厚], 色: 规.框色 },
      {
        位置: [向 * (口半宽 - 规.框宽), 0, 规.框厚 / 2],
        尺寸: [规.内轨宽, 高 - 规.切角长, 规.内轨宽],
        色: 规.框高光,
      },
      {
        位置: [0, 向 * (半高 - 规.框宽), 规.框厚 / 2],
        尺寸: [开口宽 - 规.切角长, 规.内轨宽, 规.内轨宽],
        色: 规.框高光,
      },
    );
    灯.push({
      位置: [向 * (半宽 - 规.内轨宽), 0, 背Z],
      尺寸: [规.内轨宽, 高, 规.内轨宽],
      色: 规.内轨色,
    });
    for (const 比 of 规.灯段位置) {
      const x = 向 * (口半宽 - 规.框宽 - 规.灯离口);
      const y = 比 * 半高;
      金属.push({
        位置: [x, y, -规.框厚],
        尺寸: [规.框宽, 规.灯长 + 规.框宽, 规.框厚],
        色: 规.框暗色,
      });
      for (const 端 of [-1, 1]) {
        金属.push({
          位置: [向 * 框X, y + (端 * (规.灯长 + 规.框宽)) / 2, 规.框厚 / 2],
          尺寸: [规.框宽, 规.框厚, 规.框厚],
          色: 规.框高光,
        });
      }
      灯.push({ 位置: [x, y, -规.灯离口], 尺寸: [规.灯宽, 规.灯长, 规.灯宽], 色: 规.灯芯 });
      const 光规 = 立体规范.光.灯带;
      组.add(建灯带光(规.灯色, 光规.强度 * 灯带强度倍率, x - 向 * 光规.内移, y, 深));
      辉光.push({ 位置: [x, y, 规.框厚], 尺寸: [规.辉光宽, 规.灯长 + 规.辉光宽, 1], 色: 规.灯色 });
    }
    for (const 比 of 规.顶灯位置) {
      灯.push({
        位置: [比 * 宽, 向 * (半高 - 规.框宽), 规.框厚 / 2],
        尺寸: [规.顶灯长, 规.灯宽, 规.灯宽],
        色: 规.灯芯,
      });
      辉光.push({
        位置: [比 * 宽, 向 * (半高 - 规.框宽), 规.框厚],
        尺寸: [规.顶灯长 + 规.辉光宽, 规.辉光宽, 1],
        色: 规.灯色,
      });
      if (向 > 0) {
        const 顶规 = 立体规范.光.顶灯;
        组.add(建灯带光(规.灯芯, 顶规.强度 * 顶灯强度倍率, 比 * 宽, 半高 - 顶规.内移, 深));
      }
    }
    // 壁肋接续格线，纵缝落在真实侧壁的不同进深上。
    for (let y = -半高 + 规.壁肋间距; y < 半高; y += 规.壁肋间距) {
      金属.push({
        位置: [向 * ((半宽 + 口半宽) / 2 - 规.壁肋宽), y, -深 / 2],
        尺寸: [规.壁肋宽, 规.壁肋宽, Math.hypot(深, 口半宽 - 半宽)],
        色: 规.壁肋色,
        侧转角: 向 * Math.atan2(口半宽 - 半宽, 深),
      });
    }
    for (const 比 of 规.壁缝深度) {
      金属.push({
        位置: [向 * (口半宽 + (半宽 - 口半宽) * 比 - 规.壁肋宽), 0, -深 * 比],
        尺寸: [规.壁肋宽, 高, 规.壁肋宽],
        色: 规.壁肋色,
      });
    }
    for (const 纵 of [-1, 1]) {
      金属.push({
        位置: [向 * (口半宽 - 规.切角内缩), 纵 * (半高 - 规.切角内缩), 规.框厚 / 2],
        尺寸: [规.护角宽, 规.切角长, 规.框厚],
        色: 规.框高光,
        转角: (-向 * 纵 * Math.PI) / 4,
      });
    }
  }
  组.add(建内壁板(宽, 高, 深, 开口宽));
  const 姿态 = new Object3D();
  const 色 = new Color();
  for (const [件们, 几何, 材质] of [
    [
      金属,
      new BoxGeometry(),
      new MeshStandardMaterial({ roughness: 规.框粗糙, metalness: 规.框金属 }),
    ],
    [灯, new BoxGeometry(), new MeshBasicMaterial()],
    [辉光, new PlaneGeometry(), 建辉光材质(0xffffff, 规.辉光不透明, 规.辉光衰减)],
  ] as const) {
    const 批 = new InstancedMesh(几何, 材质, 件们.length);
    件们.forEach((件, 序) => {
      姿态.position.set(...件.位置);
      姿态.scale.set(...件.尺寸);
      姿态.rotation.set(0, 件.侧转角 ?? 0, 件.转角 ?? 0);
      姿态.updateMatrix();
      批.setMatrixAt(序, 姿态.matrix);
      批.setColorAt(序, 色.setRGB(...转颜色向量(件.色)));
    });
    组.add(批);
  }
  return 组;
}

/** 壁板保持原墙面端点，仅向内部凸出窄小厚度；缝隙露出原有暗色墙面。 */
function 建内壁板(宽: number, 高: number, 深: number, 开口宽: number): InstancedMesh {
  const 房 = 立体规范.房间;
  const 行数 = Math.ceil(高 / 房.壁板行高);
  const 段深 = 深 / 房.壁板深段;
  const 墙斜 = Math.atan2((开口宽 - 宽) / 2, 深);
  const 几何 = new RoundedBoxGeometry(
    房.壁板厚,
    高 / 行数 - 房.壁板缝,
    段深 - 房.壁板缝,
    1,
    房.壁板倒角,
  );
  const 材质 = new MeshStandardMaterial({ roughness: 房.壁板粗糙, metalness: 房.壁板金属 });
  const 批 = new InstancedMesh(几何, 材质, 行数 * 房.壁板深段 * 2);
  const 姿态 = new Object3D();
  const 色 = new Color();
  let 序 = 0;
  for (const 向 of [-1, 1]) {
    for (let 段 = 0; 段 < 房.壁板深段; 段++) {
      const 比 = (段 + 0.5) / 房.壁板深段;
      const x = 向 * (开口宽 / 2 + ((宽 - 开口宽) / 2) * 比 - 房.壁板内收);
      for (let 行 = 0; 行 < 行数; 行++) {
        姿态.position.set(x, -高 / 2 + ((行 + 0.5) * 高) / 行数, -深 * 比);
        姿态.rotation.set(0, 向 * (墙斜 + 房.壁板折面角 * (1 - 比)), 0);
        姿态.updateMatrix();
        批.setMatrixAt(序, 姿态.matrix);
        批.setColorAt(序, 色.setRGB(...转颜色向量(房.壁板色[段] ?? 房.侧壁)));
        序++;
      }
    }
  }
  批.receiveShadow = true;
  批.name = "分段内壁";
  return 批;
}
