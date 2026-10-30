import { 派生霓虹文字样式 } from "../../../主题/文字/文字样式";
import type { 文字项 } from "../../../框架/界面/绘制/协议";

export interface 分组标题布局 {
  左: number;
  上: number;
  宽: number;
  /** 分隔线相对标题左端的 y。 */
  分隔线Y: number;
}

/** 分组标题文字项（强调色、左中锚点）。 */
export function 生成分组标题文字项(布局: 分组标题布局, 标题: string, 强调色: number): 文字项 {
  return {
    文案: 标题,
    样式: 派生霓虹文字样式("正文", { 字号: 13, 颜色: 强调色, 对齐: "左" }),
    锚点: "左中",
    x: 布局.左,
    y: 布局.上 + 16,
  };
}
