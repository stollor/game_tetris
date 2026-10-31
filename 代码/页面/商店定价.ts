import { 主题列表, type 主题名, 可购主题, 是主题名, 默认主题 } from "../项目配置/主题目录";
import { 外观编号, type 外观部位, 外观部位列表, 套装折扣, 部位原价 } from "../项目配置/外观部位";
export function 已拥有(已购: readonly string[], 主题: 主题名, 部位?: 外观部位): boolean {
  if (主题 === 默认主题) return true;
  return 部位
    ? 已购.includes(外观编号(主题, 部位))
    : 外观部位列表.every((项) => 已拥有(已购, 主题, 项));
}
/** 动态背景包含静态；整套只对尚未购买的部位打72折，向上取整到10。 */
export function 计算报价(主题: 主题名, 部位: 外观部位 | "整套", 已购: readonly string[]): number {
  if (主题 === 默认主题) return 0;
  if (部位 === "整套")
    return (
      Math.ceil(
        (外观部位列表
          .filter((项) => 项 !== "静态背景")
          .reduce((总, 项) => 总 + 计算报价(主题, 项, 已购), 0) *
          套装折扣) /
          10,
      ) * 10
    );
  if (已拥有(已购, 主题, 部位)) return 0;
  return 部位 === "动态背景" && 已拥有(已购, 主题, "静态背景")
    ? 部位原价[部位] - 部位原价.静态背景
    : 部位原价[部位];
}
export function 整套已拥有(已购: readonly string[], 主题: 主题名): boolean {
  return 已拥有(已购, 主题);
}
export function 已购数量(已购: readonly string[], 主题: 主题名): number {
  return 外观部位列表.filter((项) => 已拥有(已购, 主题, 项)).length;
}
export function 商店主题列表(): readonly 主题名[] {
  return 主题列表;
}
export function 在售主题列表(): readonly 主题名[] {
  return 可购主题;
}
export function 是可购主题(值: unknown): 值 is 主题名 {
  return 是主题名(值) && 值 !== 默认主题;
}
