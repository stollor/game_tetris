import type { 图形对象, 文字样式, 文字项 } from "../../框架Three/界面/绘制/协议";
import { 绘制旅行图标 } from "../../组件/霓虹街机/图标";
import { 绘制霓虹玻璃 } from "../../组件/霓虹街机/底板";
import { 读取霓虹文字样式 } from "../../组件/霓虹街机/文字样式";

/**
 * 金币条的引擎无关配方：半透明底板保证浅色/深色风景上都能读，避开右上角平台按钮。
 * Phaser 版 `金币条.ts` 的 布置金币条 与 Three 主界面共用同一份几何、绘制与文字项；
 * 本文件不 import Phaser 运行时，Three 页面可直接引用。
 */

/** 金币条绝对几何：左/上是左上角，其余字段都是画布绝对坐标。 */
export interface 金币条布局 {
  左: number;
  上: number;
  宽: number;
  高: number;
  文字X: number;
  文字Y: number;
  图标X: number;
  图标Y: number;
  图标尺寸: number;
}

function 余额文字(n: number): string {
  return n >= 10000 ? `${(n / 10000).toFixed(n >= 100000 ? 0 : 1)}万` : n.toLocaleString();
}

/** 与重构前 `布置金币条` 逐字一致的尺寸算法：高 34，宽随余额文案长度增长。 */
export function 计算金币条(左: number, 上: number, 金币: number): 金币条布局 {
  const 文案 = 余额文字(金币);
  const 高 = 34;
  const 宽 = Math.max(100, 42 + 文案.length * 9);
  return {
    左,
    上,
    宽,
    高,
    文字X: 左 + 34,
    文字Y: 上 + 高 / 2,
    图标X: 左 + 18,
    图标Y: 上 + 高 / 2,
    图标尺寸: 18,
  };
}

/** 金币条底板（绝对坐标）：半透明玻璃底板。 */
export function 绘制金币条底板(绘图: 图形对象, 布局: 金币条布局): void {
  绘制霓虹玻璃(绘图, 布局.左, 布局.上, 布局.宽, 布局.高, { 透明度: 0.66, 圆角: 10 });
}

/** 金币条图标：程序化方块币图标按 18/32 缩放绘制。 */
export function 绘制金币条图标(绘图: 图形对象, 布局: 金币条布局): void {
  绘图.save();
  绘图.translateCanvas(布局.图标X - 布局.图标尺寸 / 2, 布局.图标Y - 布局.图标尺寸 / 2);
  绘图.scaleCanvas(布局.图标尺寸 / 32);
  绘制旅行图标(绘图, "方块币");
  绘图.restore();
}

/** 完整金币条（底板 + 图标），供 Three 版与预览直接调用。 */
export function 绘制金币条(绘图: 图形对象, 布局: 金币条布局): void {
  绘制金币条底板(绘图, 布局);
  绘制金币条图标(绘图, 布局);
}

/** 金币余额文字项：走「金币」角色 token，与 Phaser 原生的 15px 粗体描边样式一致。 */
export function 生成金币条文字项(布局: 金币条布局, 金币: number): 文字项[] {
  const 样式: 文字样式 = 读取霓虹文字样式("金币");
  return [
    {
      文案: 余额文字(金币),
      样式,
      锚点: "左中",
      x: 布局.文字X,
      y: 布局.文字Y,
    },
  ];
}
