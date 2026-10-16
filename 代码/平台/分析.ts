import "./Tap类型";
import { Tap应用, 分析开关 } from "./配置";

export type 分析事件名 =
  | "session_start"
  | "mode_start"
  | "mode_end"
  | "purchase"
  | "achievement_unlock"
  | "cloud_sync";

const 缓冲: {
  name: 分析事件名;
  properties: Record<string, string | number | boolean>;
  t: number;
}[] = [];

export function 记录分析事件(
  name: 分析事件名,
  properties: Record<string, string | number | boolean> = {},
): void {
  缓冲.push({ name, properties: { ...properties, client_id: Tap应用.ClientID }, t: Date.now() });
  if (typeof window !== "undefined") {
    const 平台 = window.__GAME_PLATFORM__ ?? {};
    平台.最近分析 = 缓冲[缓冲.length - 1];
    平台.分析条数 = 缓冲.length;
    window.__GAME_PLATFORM__ = 平台;
  }
  if (!分析开关.启用TapDB上报) return;
  // TapDB REST 默认关闭：浏览器 CORS / 无 Client Token。开启前需确认上报通道。
}

export function 读取分析缓冲(): readonly (typeof 缓冲)[number][] {
  return 缓冲;
}

export function 清空分析缓冲(): void {
  缓冲.length = 0;
}
