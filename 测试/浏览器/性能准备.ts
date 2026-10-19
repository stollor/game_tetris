import type { Page } from "playwright";
import { 等待测试场景 } from "../../框架/开发/浏览器测试操作";

/** 0–1 视作比例，其余视作 0–100。游戏和框架都只接受整数音量。 */
function 百分音量(值: number | undefined, 默认: number): number {
  if (typeof 值 !== "number" || !Number.isFinite(值)) return 默认;
  const 百分 = 值 > 0 && 值 <= 1 ? Math.round(值 * 100) : Math.round(值);
  return Math.min(100, Math.max(0, 百分));
}

export async function 准备页面(
  页面: Page,
  地址: string,
  动态: boolean,
  音量: { 音乐?: number; 音效?: number; 环境?: number } = {},
) {
  const 音乐 = 百分音量(音量.音乐, 0);
  const 音效 = 百分音量(音量.音效, 80);
  const 环境 = 百分音量(音量.环境, 0);
  await 页面.addInitScript(
    ({ 动态, 音乐, 音效, 环境 }) => {
      localStorage.setItem(
        "再消一行:设置",
        JSON.stringify({
          背景主题: "极光原野",
          背景动态: 动态,
          省电模式: "关",
          背景音乐: 音乐 > 0,
          音乐音量: 音乐,
          背景音效音量: 环境,
          音效音量: 音效,
        }),
      );
      // 播放入口读的是框架设置。只写游戏存档时，音效会一直停在默认 80。
      localStorage.setItem(
        "gamemaker:settings",
        JSON.stringify({
          背景音乐: 音乐 > 0,
          音乐音量: 音乐,
          音效音量: 音效,
        }),
      );
    },
    { 动态, 音乐, 音效, 环境 },
  );
  const 目标 = new URL(地址);
  目标.searchParams.set("perf-debug", "");
  await 页面.goto(目标.href, { waitUntil: "load" });
  await 页面.waitForFunction(() => window.__游戏__?.scene.isActive("开始菜单"));
  await 等待测试场景(页面, "开始菜单");
  await 页面.waitForTimeout(400);
}
