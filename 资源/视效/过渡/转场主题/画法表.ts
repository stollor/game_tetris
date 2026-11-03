import { 彩砖画法 } from "./彩砖";
import { 极光画法 } from "./极光";
import { 液晶画法 } from "./液晶";
import { 立体画法 } from "./立体";
import type { 转场主题, 转场画法 } from "./类型";
import { 糖果画法 } from "./糖果";

/** 五套主题各自的转场画法；键必须覆盖 `转场主题` 全集，缺一套编译期就报错。 */
export const 转场画法表: Record<转场主题, 转场画法> = {
  极光: 极光画法,
  液晶: 液晶画法,
  彩砖: 彩砖画法,
  立体: 立体画法,
  糖果: 糖果画法,
};
