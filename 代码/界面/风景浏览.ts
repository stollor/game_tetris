import { 地点皮肤表, 查找地点 } from "../框架配置/旅行地点";
import type { 背景主题 } from "../配置/俄罗斯方块设置";
import { 背景主题选项 } from "../配置/背景主题";

export function 风景浏览列表(): 背景主题[] {
  return 背景主题选项.map((项) => 项.值);
}

export function 地点浏览列表(): 背景主题[] {
  return 地点皮肤表.map((项) => 项.名称);
}

export function 相邻风景(当前: 背景主题, 方向: -1 | 1, 范围 = 风景浏览列表()): 背景主题 {
  const 起 = Math.max(0, 范围.indexOf(当前));
  return 范围[(起 + 方向 + 范围.length) % 范围.length] ?? 当前;
}

export function 风景说明(主题: 背景主题): { 标题: string; 副题: string } {
  const 地点 = 查找地点(主题);
  if (地点) return { 标题: 地点.名称, 副题: 地点.副题 };
  const 项 = 背景主题选项.find((x) => x.值 === 主题);
  return { 标题: 项?.标签 ?? String(主题), 副题: 项?.描述 ?? "" };
}
