import { 读取霓虹调色板, 霓虹界面主题 } from "../../代码/主题/配色/调色板";
import { 项目界面资源 } from "../../组件/资源目录";

export function 接入主题预览(
  读取当前: () => string,
  设置预览: (样式: (typeof 霓虹界面主题)[number] | undefined) => void,
): void {
  window.addEventListener("message", (事件: MessageEvent) => {
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
        { 类型: "gm-ui-themes", 主题, 当前: 读取当前(), 资源: 项目界面资源 },
        事件.origin,
      );
    } else if (数据.类型 === "gm-ui-theme-preview") {
      if (数据.样式 === null) 设置预览(undefined);
      else {
        const 样式 = 霓虹界面主题.find((名称) => 名称 === 数据.样式);
        if (样式) 设置预览(样式);
      }
    }
  });
}
