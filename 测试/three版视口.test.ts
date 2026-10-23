import { expect, test } from "bun:test";
import { 计算对局布局 } from "../代码/视觉/对局布局";
import { 计算重排视口 } from "../框架/界面/正交相机";

test("Three响应视口与共享三态布局一起生效", () => {
  for (const 视口 of [
    { 宽: 390, 高: 844 },
    { 宽: 430, 高: 860 },
    { 宽: 1280, 高: 720 },
  ]) {
    const 尺寸 = 计算重排视口(视口, { 宽: 1440, 高: 900 });
    for (const 屏幕适配 of ["自动", "手机竖屏", "电脑横屏"] as const) {
      const 布局 = 计算对局布局(尺寸.宽, 尺寸.高, { 屏幕适配, 模式: "马拉松", 阶段: "进行中" });
      expect(布局.视口宽).toBe(视口.宽);
      expect(布局.视口高).toBe(视口.高);
      expect(布局.竖屏).toBe(
        屏幕适配 === "手机竖屏" ||
          (屏幕适配 === "自动" && 视口.高 > 视口.宽 * 1.05 && 视口.宽 < 1100),
      );
      expect(布局.棋盘.左).toBeGreaterThanOrEqual(0);
      expect(布局.棋盘.上).toBeGreaterThanOrEqual(0);
    }
  }
});
