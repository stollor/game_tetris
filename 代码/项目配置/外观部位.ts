import type { 主题名 } from "./主题目录";
export const 外观部位列表 = [
  "静态背景",
  "动态背景",
  "界面样式",
  "方块外观",
  "音效套装",
  "音乐",
] as const;
export type 外观部位 = (typeof 外观部位列表)[number];
export const 部位原价: Record<外观部位, number> = {
  静态背景: 80,
  动态背景: 180,
  界面样式: 140,
  方块外观: 120,
  音效套装: 100,
  音乐: 160,
};
export const 套装折扣 = 0.72;
export function 外观编号(主题: 主题名, 部位: 外观部位): string {
  return 主题 + "." + 部位;
}
export function 是外观部位(值: unknown): 值 is 外观部位 {
  return 外观部位列表.some((项) => 项 === 值);
}
/** 分部位穿戴只覆盖对应槽位，其余保持当前装备。 */
export const 部位槽位: Record<外观部位, readonly string[]> = {
  静态背景: ["静态背景"],
  动态背景: ["动态背景"],
  界面样式: ["界面配色", "控件外观", "界面表现", "字体", "仪表纹样", "仪表表现"],
  方块外观: ["方块外观", "棋盘表现", "视觉特效"],
  音效套装: ["音效套装"],
  音乐: ["背景音乐"],
};

export type 外观搭配 = Partial<Record<外观部位, 主题名>>;
export function 读取部位主题(
  设置: { 主题选择: 主题名; 外观搭配?: 外观搭配 },
  部位: 外观部位,
): 主题名 {
  return 设置.外观搭配?.[部位] ?? 设置.主题选择;
}
