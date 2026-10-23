import { 更新游戏设置, type 游戏设置, 获取游戏设置 } from "../../设置/游戏设置";
import type { 设置服务 } from "../接口/服务";

/** 设置服务直接复用游戏现有设置模块；变更事件由框架设置层派发，这里只转订阅。 */
export function 创建设置服务(): 设置服务 {
  return {
    读取: () => 获取游戏设置(),
    更新: (变化) => 更新游戏设置(变化),
    订阅: (回调) => {
      const 监听 = (事件: Event) => {
        const 详情 = (事件 as CustomEvent<游戏设置>).detail;
        回调(详情 ?? 获取游戏设置());
      };
      window.addEventListener("gamemaker:settings-change", 监听);
      return () => window.removeEventListener("gamemaker:settings-change", 监听);
    },
  };
}
