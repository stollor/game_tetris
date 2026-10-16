import { afterEach, expect, test } from "bun:test";
import { 适配场景视口 } from "../框架/界面/响应式视口";
import { 计算画布像素比, 设置画布像素比 } from "../框架/界面/画布像素比";

function 假场景(宽: number, 高: number) {
  const 镜头 = { zoom: 1, scroll: [0, 0] as [number, number] };
  return {
    镜头,
    scale: { width: 宽, height: 高 },
    cameras: {
      main: {
        setZoom: (z: number) => {
          镜头.zoom = z;
        },
        setOrigin: () => {},
        setScroll: (x: number, y: number) => {
          镜头.scroll = [x, y];
        },
      },
    },
  };
}

afterEach(() => 设置画布像素比(1));

test("画布像素比：未设上限保持 1，设上限后按 DPR 封顶", () => {
  expect(计算画布像素比(3, undefined)).toBe(1);
  expect(计算画布像素比(3.5, 3)).toBe(3);
  expect(计算画布像素比(2, 3)).toBe(2);
  expect(计算画布像素比(0.8, 3)).toBe(1);
  expect(计算画布像素比(undefined, 3)).toBe(1);
});

test("高清画布下视口逻辑尺寸仍为 CSS 像素", () => {
  const 普通 = 适配场景视口(假场景(390, 844), 1440, 900);
  设置画布像素比(3);
  const 高清 = 假场景(1170, 2532);
  const 结果 = 适配场景视口(高清, 1440, 900);
  expect(结果).toEqual({ 宽: 普通.宽, 高: 普通.高, 比例: 3 });
  expect(高清.镜头.zoom).toBe(3);
});

test("高清画布下大屏放大倍率与旧行为一致", () => {
  const 旧 = 适配场景视口(假场景(2880, 1800), 1440, 900);
  设置画布像素比(2);
  const 新 = 适配场景视口(假场景(5760, 3600), 1440, 900);
  expect(新.宽).toBe(旧.宽);
  expect(新.比例).toBe(旧.比例 * 2);
});
