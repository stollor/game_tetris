import { 基础背景已解锁, 是基础背景, 迁移基础背景 } from "../存档/基础背景解锁";
import { 旅行收藏 } from "../存档/旅行收藏";
import { 地点皮肤表, 查找地点 } from "../框架配置/旅行地点";
import type { 背景主题 } from "../配置/再消一行设置";
import { 背景主题选项 } from "../配置/背景主题";

export function 风景浏览列表(): 背景主题[] {
  return 背景主题选项.map((项) => 项.值);
}

export function 地点浏览列表(): 背景主题[] {
  return 地点皮肤表.map((项) => 项.名称);
}

/** 基础背景看成就/默认解锁；旅行地点背景看是否已购静态背景。 */
export function 风景已解锁(主题: 背景主题, 存储: Storage = localStorage): boolean {
  迁移基础背景(存储);
  const 地点 = 查找地点(主题);
  if (地点) return new 旅行收藏(存储).拥有(地点.名称, "静态背景");
  if (是基础背景(主题)) return 基础背景已解锁(主题, 存储);
  return false;
}

/** 纯享/预览可切换的风景：仅已解锁或已购。 */
export function 已解锁风景列表(存储: Storage = localStorage): 背景主题[] {
  return 风景浏览列表().filter((主题) => 风景已解锁(主题, 存储));
}

export function 相邻风景(当前: 背景主题, 方向: -1 | 1, 范围 = 风景浏览列表()): 背景主题 {
  if (!范围.length) return 当前;
  const 起 = 范围.indexOf(当前);
  const 索引 = 起 < 0 ? 0 : 起;
  return 范围[(索引 + 方向 + 范围.length) % 范围.length] ?? 当前;
}

/** 纯享模式专用：只在已解锁列表里循环；当前未解锁时落到第一张已解锁。 */
export function 相邻已解锁风景(
  当前: 背景主题,
  方向: -1 | 1,
  存储: Storage = localStorage,
): 背景主题 {
  const 范围 = 已解锁风景列表(存储);
  if (!范围.length) return 当前;
  if (!范围.includes(当前)) return 范围[0]!;
  return 相邻风景(当前, 方向, 范围);
}

export function 风景说明(主题: 背景主题): { 标题: string; 副题: string } {
  const 地点 = 查找地点(主题);
  if (地点) return { 标题: 地点.名称, 副题: 地点.副题 };
  const 项 = 背景主题选项.find((x) => x.值 === 主题);
  return { 标题: 项?.标签 ?? String(主题), 副题: 项?.描述 ?? "" };
}
