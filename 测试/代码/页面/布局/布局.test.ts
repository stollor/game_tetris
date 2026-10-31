import { describe, expect, test } from "bun:test";
import { 计算重排视口 } from "../../../../.gamemaker/依赖/框架/界面/正交相机";
import { 计算对局仪表 } from "../../../../代码/界面/对局仪表";
import { 计算商店布局, 计算商店确认布局 } from "../../../../代码/页面/布局/商店布局";
import { 计算信息栏内部, 计算对局布局 } from "../../../../代码/页面/布局/对局布局";
import { 主题列表 } from "../../../../代码/项目配置/主题目录";
import { 计算下拉展开区域 } from "../../../../资源/预制体/基础/输入与选择/页面控件";

// ── 原 商店布局.test.ts ──
describe("商店布局", () => {
  test("手机商店：主题卡排、主按钮、纯享/退出与预览区尺寸稳定", () => {
    const 页面 = 计算商店布局(390, 844);
    expect(页面.主题卡).toHaveLength(主题列表.length);
    expect(页面.副题Y - 页面.标题Y).toBe(40);
    expect(页面.消息Y - 页面.副题Y).toBe(20);
    expect(页面.预览.上).toBeGreaterThan(页面.消息Y);
    expect(页面.预览.上 + 页面.预览.高).toBeLessThan(页面.主题卡[0]!.上);
    // 四张主题卡一横排，等宽等距。
    const 卡宽 = 页面.主题卡[0]!.宽;
    for (const [序号, 卡] of 页面.主题卡.entries()) {
      expect(卡.宽).toBeCloseTo(卡宽, 5);
      if (序号 > 0) {
        const 前 = 页面.主题卡[序号 - 1]!;
        expect(卡.左 - (前.左 + 前.宽)).toBeCloseTo(页面.卡间距, 5);
      }
    }
  });

  test("四档尺寸的主题卡、主按钮、纯享、退出与预览均在屏幕内", () => {
    for (const [宽, 高] of [
      [390, 844],
      [430, 860],
      [1280, 720],
      [844, 390],
    ]) {
      const 页 = 计算商店布局(宽, 高);
      for (const 区 of [...页.主题卡, 页.主按钮, 页.退出, 页.纯享, 页.预览]) {
        expect(区.左).toBeGreaterThanOrEqual(0);
        expect(区.上).toBeGreaterThanOrEqual(0);
        expect(区.左 + 区.宽).toBeLessThanOrEqual(宽);
        expect(区.上 + 区.高).toBeLessThanOrEqual(高);
      }
      // 预览在主题卡上方不重叠；主按钮在主题卡下面，纯享/退出在最底一排。
      expect(页.预览.上 + 页.预览.高).toBeLessThanOrEqual(页.主题卡[0]!.上);
      expect(页.主按钮.上).toBeGreaterThan(页.主题卡[0]!.上 + 页.主题卡[0]!.高);
      expect(页.退出.上 + 页.退出.高).toBeLessThanOrEqual(高);
      expect(页.纯享.上 + 页.纯享.高).toBeLessThanOrEqual(高);
    }
  });

  test("确认纸页：面板居中，确认/取消/关闭都在面板内", () => {
    const 确认 = 计算商店确认布局(390, 844);
    expect(确认.面板.左).toBeGreaterThan(0);
    expect(确认.面板.上).toBeGreaterThan(0);
    for (const 区 of [确认.确认, 确认.取消, 确认.关闭]) {
      expect(区.左).toBeGreaterThanOrEqual(确认.面板.左);
      expect(区.上).toBeGreaterThanOrEqual(确认.面板.上);
      expect(区.左 + 区.宽).toBeLessThanOrEqual(确认.面板.左 + 确认.面板.宽);
      expect(区.上 + 区.高).toBeLessThanOrEqual(确认.面板.上 + 确认.面板.高);
    }
    expect(确认.确认.上).toBeLessThan(确认.取消.上);
  });

  test("语言菜单向上展开，选项命中框完全位于共享面板内", () => {
    const 当前 = { 左: 100, 上: 400, 宽: 180, 高: 36 };
    const 展开 = 计算下拉展开区域(当前, 2);
    expect(展开.选项.map((项) => 项.上)).toEqual([326, 362]);
    for (const 项 of 展开.选项) {
      expect(项.上).toBeGreaterThan(展开.面板.上);
      expect(项.上 + 项.高).toBeLessThan(当前.上 + 当前.高);
    }
  });
});

// ── 原 three版视口.test.ts ──
describe("three版视口", () => {
  test("Three响应视口与共享三态布局一起生效", () => {
    for (const 视口 of [
      { 宽: 390, 高: 844 },
      { 宽: 430, 高: 860 },
      { 宽: 1280, 高: 720 },
    ]) {
      const 尺寸 = 计算重排视口(视口, { 宽: 390, 高: 844 });
      const 高清 = 计算重排视口({ 宽: 视口.宽 * 3, 高: 视口.高 * 3 }, { 宽: 390, 高: 844 });
      expect(高清.宽).toBeCloseTo(尺寸.宽);
      expect(高清.高).toBeCloseTo(尺寸.高);
      for (const 屏幕适配 of ["自动", "手机竖屏", "电脑横屏"] as const) {
        const 布局 = 计算对局布局(尺寸.宽, 尺寸.高, { 屏幕适配, 模式: "马拉松", 阶段: "进行中" });
        expect(布局.视口宽).toBe(尺寸.宽);
        expect(布局.视口高).toBe(尺寸.高);
        expect(布局.竖屏).toBe(
          屏幕适配 === "手机竖屏" ||
            (屏幕适配 === "自动" && 尺寸.高 > 尺寸.宽 * 1.05 && 尺寸.宽 < 1100),
        );
        expect(布局.棋盘.左).toBeGreaterThanOrEqual(0);
        expect(布局.棋盘.上).toBeGreaterThanOrEqual(0);
        if (布局.竖屏 && 布局.操作区.显示) {
          const 软降 = 布局.操作区.键.find((键) => 键.名称 === "软降");
          const 左移 = 布局.操作区.键.find((键) => 键.名称 === "左移");
          expect(软降 && 左移 && 软降.宽).toBeGreaterThan(左移?.宽 ?? 0);
          for (const 键 of 布局.操作区.键) {
            expect(键.中心Y + 键.高 / 2).toBeLessThanOrEqual(尺寸.高);
            expect(键.中心Y - 键.高 / 2).toBeGreaterThanOrEqual(布局.操作区顶);
          }
        }
      }
    }
  });

  test("手机辅助模块有清楚的间距、首位优先且不压住纪录", () => {
    const 布局 = 计算对局布局(390, 844, { 模式: "马拉松", 阶段: "进行中" });
    const 侧栏 = 布局.侧栏;
    if (!侧栏) throw new Error("缺少手机侧栏");
    expect(侧栏.暂存.上 + 侧栏.暂存.高 + 12).toBeLessThanOrEqual(侧栏.下一个标签.上);
    const [首卡, 次卡] = 侧栏.下一步卡;
    if (!首卡 || !次卡) throw new Error("缺少预览卡");
    expect(首卡.高).toBeGreaterThan(次卡.高);
    let 底 = 侧栏.下一个标签.上 + 18;
    for (const 卡 of 侧栏.下一步卡) {
      expect(卡.上).toBeGreaterThanOrEqual(底 + 6);
      底 = 卡.上 + 卡.高;
    }
    expect(底 + 12).toBeLessThanOrEqual(侧栏.底 - 84);
    expect(侧栏).not.toHaveProperty("硬降");
  });

  test("分数占更宽的中心列，分隔线与列中心对齐", () => {
    const 布局 = 计算对局布局(390, 844, { 模式: "马拉松", 阶段: "进行中" });
    const 内部 = 计算信息栏内部(布局.信息栏);
    expect(内部.列中心[1]).toBe(195);
    expect(内部.列宽[1]).toBeGreaterThan(内部.列宽[0] ?? 0);
    expect(内部.分隔X[0]).toBeLessThan(内部.列中心[1] ?? 0);
    expect(内部.分隔X[1]).toBeGreaterThan(内部.列中心[1] ?? 0);
  });

  test("手机四模式共用棋盘与管道几何，格距整数且 HUD 不压棋盘", () => {
    const 基准 = 计算对局布局(390, 844, { 模式: "马拉松", 阶段: "进行中" });
    const 基准侧栏 = 基准.侧栏;
    if (!基准侧栏) throw new Error("缺少侧栏");
    expect(基准侧栏.宽).toBeLessThan(150);
    expect(基准.格子大小).toBeGreaterThan(20);
    for (const 模式 of ["马拉松", "冲刺", "极限", "每日挑战"] as const) {
      const 布局 = 计算对局布局(390, 844, { 模式, 阶段: "进行中" });
      const 侧栏 = 布局.侧栏;
      if (!侧栏) throw new Error("缺少侧栏");
      expect(布局.棋盘).toEqual(基准.棋盘);
      expect(布局.格子大小).toBe(基准.格子大小);
      expect(侧栏).toEqual(基准侧栏);
      expect(Number.isInteger(布局.格子大小)).toBe(true);
      expect(Number.isInteger(侧栏.预览栏.卡格)).toBe(true);
      expect(布局.棋盘.高).toBe(布局.棋盘.宽 * 2);
      expect(布局.棋盘.左 + 布局.棋盘.宽).toBeLessThan(侧栏.左);
      expect(布局.棋盘.上 + 布局.棋盘.高).toBeLessThan(布局.操作区顶);
      expect(布局.信息栏.中心Y + 布局.信息栏.高 / 2).toBeLessThan(布局.棋盘.上);
      expect(计算对局仪表(布局, 模式).计时栏).toBe(
        模式 === "极限" ? "右" : 模式 === "冲刺" ? "左" : null,
      );
    }
  });
});
