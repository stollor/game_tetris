import { 读取霓虹调色板, 霓虹界面主题 } from "../../../组件/霓虹街机/调色板";
import { 项目界面资源 } from "../../../组件/预览/组件目录";
import { 获取游戏设置 } from "../../配置/再消一行设置";
import type { 主题服务, 游戏主题, 设置服务 } from "../接口/服务";
import { 创建游戏主题 } from "./游戏主题";

/**
 * Three 版主题模块入口：
 * - `创建主题服务()` 供启动层注入应用服务，设置变化（样式/旅行样式/方块外观）时通知订阅者；
 * - `创建游戏主题(设置)` 直接按设置换算主题，页面重建时也可用；
 * - 背景/方块/旅行皮肤绘制供页面与对局共用。
 */

export {
  绘制方块形状,
  绘制方块格,
  读取方块外观方案,
  读取方块配色,
} from "./方块";
export {
  绘制旅行纹样,
  绘制旅行缩略,
  读取全部旅行皮肤,
  读取旅行皮肤,
} from "./旅行皮肤";
export { 创建游戏主题 } from "./游戏主题";
export { 主题对比字色, 主题提亮, 主题转界面配色 } from "./界面配色";
export {
  绘制顶栏衬底,
  type 背景外观,
  读取背景外观,
  读取背景标签,
} from "./背景";

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

  const 接收界面预览 = (事件: MessageEvent) => {
    let 来源: URL;
    try {
      来源 = new URL(事件.origin);
    } catch {
      return;
    }
    if (
      事件.source !== window.parent ||
      来源.protocol !== "http:" ||
      !["127.0.0.1", "localhost"].includes(来源.hostname)
    )
      return;
    const 数据 = 事件.data;
    if (!数据 || typeof 数据 !== "object" || !("类型" in 数据)) return;
    if (数据.类型 === "gm-ui-themes-read") {
      const 主题 = 霓虹界面主题.map((名称) => {
        const 配色 = 读取霓虹调色板(名称);
        return {
          名称,
          背景: `#${配色.背景.toString(16).padStart(6, "0")}`,
          面板: 配色.面板底字符串,
          描边: `#${配色.面板描边.toString(16).padStart(6, "0")}`,
          强调: 配色.强调色,
          正文: 配色.正文,
        };
      });
      window.parent.postMessage(
        { 类型: "gm-ui-themes", 主题, 当前: 当前.名称, 资源: 项目界面资源 },
        事件.origin,
      );
      return;
    }
    if (数据.类型 !== "gm-ui-theme-preview") return;
    if (数据.样式 === null) 预览样式 = undefined;
    else if (typeof 数据.样式 === "string") {
      const 找到 = 霓虹界面主题.find((名称) => 名称 === 数据.样式);
      if (!找到) return;
      预览样式 = 找到;
    } else return;
    刷新();
  };

  let 解绑设置: (() => void) | null = null;
  if (设置服务) 解绑设置 = 设置服务.订阅(() => 刷新());
  else if (typeof window !== "undefined")
    window.addEventListener("gamemaker:settings-change", 刷新);
  if (typeof window !== "undefined") window.addEventListener("message", 接收界面预览);

  return {
    读取: () => 当前,
    订阅: (回调) => {
      订阅者.add(回调);
      return () => {
        订阅者.delete(回调);
        if (订阅者.size === 0 && 解绑设置 && 设置服务) {
          解绑设置();
          解绑设置 = null;
        }
      };
    },
  };
}
