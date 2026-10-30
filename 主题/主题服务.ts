import type { 主题服务, 游戏主题, 设置服务 } from "../代码/应用/接口/服务";
import { 获取游戏设置 } from "../代码/设置/游戏设置";
import { 创建游戏主题 } from "./游戏主题";
import type { 霓虹界面主题 } from "./配色/调色板";

/**
 * Three 版主题模块入口：
 * - `创建主题服务()` 供启动层注入应用服务，设置变化（样式/旅行样式/方块外观）时通知订阅者；
 * - `创建游戏主题(设置)` 直接按设置换算主题，页面重建时也可用；
 * - 背景/方块/旅行皮肤绘制供页面与对局共用。
 */

export interface 主题服务选项 {
  /** 有设置服务时走它的订阅；没有则监听设置变化事件并读取当前设置。 */
  设置?: 设置服务;
}

export function 创建主题服务(选项: 主题服务选项 = {}): 主题服务 {
  const 设置服务 = 选项.设置;
  let 预览样式: (typeof 霓虹界面主题)[number] | undefined;
  let 当前 = 创建游戏主题(设置服务?.读取() ?? 获取游戏设置());
  const 订阅者 = new Set<(主题: 游戏主题) => void>();

  const 刷新 = () => {
    当前 = 创建游戏主题(设置服务?.读取() ?? 获取游戏设置(), 预览样式);
    for (const 回调 of 订阅者) 回调(当前);
  };

  let 解绑设置: (() => void) | null = null;
  if (设置服务) 解绑设置 = 设置服务.订阅(() => 刷新());
  else if (typeof window !== "undefined")
    window.addEventListener("gamemaker:settings-change", 刷新);
  if (import.meta.env.GM_TEST === "1" && typeof window !== "undefined")
    void import("../测试/接入/主题预览").then(({ 接入主题预览 }) =>
      接入主题预览(
        () => 当前.名称,
        (样式) => {
          预览样式 = 样式;
          刷新();
        },
      ),
    );

  return {
    读取: () => 当前,
    订阅: (回调) => {
      订阅者.add(回调);
      return () => {
        订阅者.delete(回调);
      };
    },
    销毁: () => {
      解绑设置?.();
      解绑设置 = null;
      if (!设置服务 && typeof window !== "undefined")
        window.removeEventListener("gamemaker:settings-change", 刷新);
      订阅者.clear();
    },
  };
}
