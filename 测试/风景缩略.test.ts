import { expect, mock, test } from "bun:test";
import type Phaser from "phaser";

// 绘制本身依赖 Phaser 运行时；这里只验证烘焙与缓存策略。
mock.module("../代码/视觉/霓虹背景", () => ({ 绘制霓虹背景: () => {} }));
const { 布置烘焙底图, 获取风景缩略 } = await import("../代码/视觉/风景缩略");

function 链式(): unknown {
  const 自身: unknown = new Proxy(() => {}, {
    get: (_目标, 键) => (键 === "then" ? undefined : () => 自身),
    apply: () => 自身,
  });
  return 自身;
}

function 假场景() {
  const 纹理 = new Set<string>();
  let 烘焙次数 = 0;
  const 监听 = new Map<object, () => void>();
  const 场景 = {
    cameras: { main: { zoom: 2 } },
    textures: {
      exists: (键: string) => 纹理.has(键),
      remove: (键: string) => 纹理.delete(键),
      addDynamicTexture: (键: string) => {
        纹理.add(键);
        烘焙次数++;
        return { draw: () => {}, render: () => {} };
      },
    },
    make: { graphics: () => 链式(), container: () => 链式() },
    add: {
      image: (_x: number, _y: number, 键: string) => {
        const 图 = {
          texture: { key: 键 },
          setOrigin: () => 图,
          setDisplaySize: () => 图,
          setDepth: () => 图,
          once: (_事件: string, 回调: () => void) => 监听.set(图, 回调),
          destroy: () => 监听.get(图)?.(),
        };
        return 图;
      },
    },
  };
  (场景 as { sys?: unknown }).sys = { textures: 场景.textures };
  return { 场景: 场景 as unknown as Phaser.Scene, 纹理, 烘焙次数: () => 烘焙次数 };
}

test("缩略图按地点/尺寸/像素比烘焙一次并复用", () => {
  const { 场景, 烘焙次数 } = 假场景();
  const 键 = 获取风景缩略(场景, "成都熊猫", 88, 70);
  expect(键).toBe("风景缩略.成都熊猫.1.88x70@2");
  expect(获取风景缩略(场景, "成都熊猫", 88, 70)).toBe(键);
  expect(烘焙次数()).toBe(1);
  获取风景缩略(场景, "丽江雪山", 88, 70);
  expect(烘焙次数()).toBe(2);
});

test("整屏底图无人引用即释放纹理，同尺寸重排不重烘", () => {
  const { 场景, 纹理, 烘焙次数 } = 假场景();
  const 图1 = 布置烘焙底图(场景, undefined, 390, 844, "云海山岚", true);
  const 图2 = 布置烘焙底图(场景, 图1, 390, 844, "云海山岚", true);
  expect(烘焙次数()).toBe(1);
  expect(纹理.size).toBe(1);
  图2.destroy();
  expect(纹理.size).toBe(0);
});
