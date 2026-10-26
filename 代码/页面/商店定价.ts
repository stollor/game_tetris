import type { 地点皮肤 } from "../框架配置/旅行地点";
import {
  外观原价,
  外观编号,
  type 外观部位,
  外观部位列表,
  金币奖励配置,
} from "../项目配置/旅行皮肤";

/**
 * 商店定价：与 `代码/存档/旅行收藏.ts` 的报价规则保持一致（单件原价、动态背景抵扣静态、
 * 整套按未购配件合计后 72 折取整到 10）。页面只读金币服务给出的已购列表，不碰存档实现。
 */

export function 已拥有(已购: readonly string[], 地点: 地点皮肤, 部位: 外观部位): boolean {
  return 已购.includes(外观编号(地点.名称, 部位));
}

export function 计算报价(地点: 地点皮肤, 部位: 外观部位 | "整套", 已购: readonly string[]): number {
  const 拥有 = (项: 外观部位) => 已拥有(已购, 地点, 项);
  if (部位 === "整套") {
    const 补齐价 = 外观部位列表
      .filter((项) => 项 !== "静态背景")
      .reduce((合计, 项) => 合计 + 计算报价(地点, 项, 已购), 0);
    return Math.ceil((补齐价 * 金币奖励配置.套装折扣) / 10) * 10;
  }
  if (拥有(部位)) return 0;
  const 原价 = 外观原价(地点, 部位);
  return 部位 === "动态背景" && 拥有("静态背景") ? 原价 - 外观原价(地点, "静态背景") : 原价;
}

/** 整套是否已全部拥有（决定按钮是「购买」还是「穿上整套」）。 */
export function 整套已拥有(已购: readonly string[], 地点: 地点皮肤): boolean {
  return 外观部位列表.every((项) => 已拥有(已购, 地点, 项));
}

/** 已购部位数量（目录卡角标）。 */
export function 已购数量(已购: readonly string[], 地点: 地点皮肤): number {
  return 外观部位列表.filter((项) => 已拥有(已购, 地点, 项)).length;
}

export type { 外观部位 };
