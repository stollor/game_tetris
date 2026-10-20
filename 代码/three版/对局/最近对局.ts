import type { 最近结算 } from "./结算数据";

/**
 * 最近一次对局的结算明细：对局页结束时写入，结算覆盖页进入时读取。
 * 页面实例由装配层复用，但结算页不持有对局页引用，所以用模块级单例传这一份数据。
 */

let 最近: 最近结算 | null = null;

export function 记录最近结算(结算: 最近结算): void {
  最近 = 结算;
}

export function 读取最近结算(): 最近结算 | null {
  return 最近;
}

/** 结算页重试领奖后更新金币状态。 */
export function 更新最近结算(结算: 最近结算): void {
  if (最近 && 最近.编号 !== 结算.编号) return;
  最近 = 结算;
}

export function 清空最近结算(): void {
  最近 = null;
}
