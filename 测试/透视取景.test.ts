import { expect, test } from "bun:test";
import { 立体规范 } from "../主题/立体/立体规范";
import { 计算后墙缩放, 计算房间取景 } from "../视效/透视/取景";
import { 转颜色向量 } from "../视效/透视/直通颜色";

const 列 = 10;
const 行 = 20;
const 视野 = 立体规范.镜头.视野;

function 取景(后墙占比: number = 立体规范.房间.后墙占比高) {
  return 计算房间取景({ 列, 行, 视野, 宽高比: 列 / 行, 后墙占比 });
}

/** 把世界坐标投到视口归一化坐标（±1 为视锥边缘）。 */
function 投影(
  房: ReturnType<typeof 取景>,
  点: [number, number, number],
): { 横向: number; 竖向: number } {
  const 视口单位 = 2 * Math.tan((视野 * Math.PI) / 180 / 2);
  const 深度 = 房.位置[2] - 点[2];
  const 视口高 = 深度 * 视口单位;
  return {
    横向: 点[0] / ((视口高 * (列 / 行)) / 2),
    竖向: 点[1] / (视口高 / 2),
  };
}

test("开口正好贴满视口：屏幕边缘就是房间口沿", () => {
  const 房 = 取景();
  const 竖向 = 投影(房, [0, 行 / 2, 0]);
  const 横向 = 投影(房, [列 / 2, 0, 0]);
  expect(竖向.竖向).toBeCloseTo(1, 6);
  expect(横向.横向).toBeCloseTo(1, 6);
});

test("背墙按声明比例占视口高度", () => {
  for (const 占比 of [0.5, 0.72, 0.8, 0.9]) {
    const 房 = 取景(占比);
    const 竖向 = 投影(房, [0, 行 / 2, -房.进深]);
    expect(Math.abs(竖向.竖向)).toBeCloseTo(占比, 6);
  }
});

test("背墙尺寸等于玩法网格，常规宽高比下口沿同宽", () => {
  const 房 = 取景();
  expect(房.宽).toBe(列);
  expect(房.高).toBe(行);
  expect(房.开口宽).toBe(列);
});

test("后墙占比越大：进深越浅、背墙越近", () => {
  const 大 = 取景(0.9);
  const 小 = 取景(0.5);
  expect(大.进深).toBeLessThan(小.进深);
  expect(大.背墙距离).toBeLessThan(小.背墙距离);
});

test("进深为正，相机在开口外侧、注视背墙中心", () => {
  const 房 = 取景();
  expect(房.进深).toBeGreaterThan(0);
  expect(房.位置[0]).toBe(0);
  expect(房.位置[1]).toBe(0);
  expect(房.位置[2]).toBeGreaterThan(0);
  expect(房.目标[2]).toBeCloseTo(-房.进深, 6);
  expect(房.背墙距离).toBeCloseTo(房.开口距离 + 房.进深, 6);
});

test("相机距离只由行数与视野决定，与视口宽高比无关", () => {
  const 甲 = 计算房间取景({ 列, 行, 视野, 宽高比: 0.3, 后墙占比: 0.8 });
  const 乙 = 计算房间取景({ 列, 行, 视野, 宽高比: 2, 后墙占比: 0.8 });
  expect(甲.开口距离).toBeCloseTo(乙.开口距离, 6);
  expect(甲.进深).toBeCloseTo(乙.进深, 6);
});

test("后墙画面缩放与距离比自洽", () => {
  const 房 = 取景(0.8);
  expect(计算后墙缩放(房.开口距离, 房.背墙距离)).toBeCloseTo(0.8, 6);
});

test("宽口沿只展开内壁，背墙正方格和顶底占比保持不变", () => {
  const 房 = 计算房间取景({ 列, 行, 视野, 宽高比: 0.54, 后墙占比: 0.9 });
  expect(房.开口宽).toBeCloseTo(10.8);
  expect(房.宽).toBe(10);
  expect(房.高).toBe(20);
  expect(计算后墙缩放(房.开口距离, 房.背墙距离)).toBeCloseTo(0.9);
});

test("颜色直通不做 sRGB 转换，十六进制即最终值", () => {
  expect(转颜色向量(0xffffff)).toEqual([1, 1, 1]);
  expect(转颜色向量(0x000000)).toEqual([0, 0, 0]);
  const [r, g, b] = 转颜色向量(0x3cf0ff);
  expect(r).toBeCloseTo(0x3c / 255, 6);
  expect(g).toBeCloseTo(0xf0 / 255, 6);
  expect(b).toBeCloseTo(1, 6);
});
