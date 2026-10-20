import { 旅行日期 } from "../../存档/旅行收藏";
import { 创建主题服务 as 创建共享主题服务 } from "../主题/index";
import type { 主题服务, 应用服务, 设置服务 } from "../接口/服务";
import { 创建音频服务 } from "../音频";
import { 创建平台服务 } from "./平台";
import { 创建成就服务 } from "./成就";
import { 创建纪录服务 } from "./纪录";
import { 创建设置服务 } from "./设置";
import { 创建语言服务 } from "./语言";
import { 创建金币服务 } from "./金币";

/**
 * 应用服务工厂：启动时构造一次，注入所有页面。
 * 主题由 主题/index.ts 的共享主题服务提供（按 代码/配置/界面主题.ts 换算），
 * 也可由调用方注入自定义实现覆盖。
 */
export function 创建应用服务(
  选项: { 主题?: 主题服务; 主题工厂?: (设置: 设置服务) => 主题服务; 存储?: Storage } = {},
): 应用服务 {
  const 存储 = 选项.存储 ?? localStorage;
  const 设置 = 创建设置服务();
  const 主题 = 选项.主题 ?? 选项.主题工厂?.(设置) ?? 创建共享主题服务({ 设置 });
  return {
    设置,
    语言: 创建语言服务(设置),
    纪录: 创建纪录服务(存储),
    金币: 创建金币服务(存储),
    成就: 创建成就服务(),
    音频: 创建音频服务(设置),
    平台: 创建平台服务(),
    主题,
    内存: () => 读取内存(),
    当日日期: () => 旅行日期(),
  };
}

interface 带内存的Performance extends Performance {
  memory?: { usedJSHeapSize: number; totalJSHeapSize: number };
}

function 读取内存() {
  const 内存 = (performance as 带内存的Performance).memory;
  if (!内存) return { 已用MB: null, 总额MB: null };
  return {
    已用MB: Number((内存.usedJSHeapSize / 1048576).toFixed(2)),
    总额MB: Number((内存.totalJSHeapSize / 1048576).toFixed(2)),
  };
}
