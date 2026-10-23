import { 探测Tap能力, 读取Tap宿主 } from "../../框架Three/平台/TapTap/宿主探测";

export interface 登录结果 {
  完成: boolean;
  原因: string;
  code?: string;
}

/** 引导 Tap 登录；浏览器无宿主时友好失败，不抛错。 */
export function 请求Tap登录(): Promise<登录结果> {
  const 能力 = 探测Tap能力();
  if (!能力.在Tap容器) {
    return Promise.resolve({ 完成: false, 原因: "请在 TapTap App 内打开游戏后再登录" });
  }
  if (!能力.有登录) {
    return Promise.resolve({ 完成: false, 原因: "当前环境不支持登录" });
  }
  const 宿主 = 读取Tap宿主();
  if (!宿主?.login) return Promise.resolve({ 完成: false, 原因: "登录接口不可用" });
  return new Promise((resolve) => {
    try {
      宿主.login!({
        success: (res) => {
          if (res?.code) resolve({ 完成: true, 原因: "已登录", code: res.code });
          else resolve({ 完成: false, 原因: res?.errMsg || "登录未返回凭证" });
        },
        fail: (err) => resolve({ 完成: false, 原因: err?.errMsg || "登录失败" }),
      });
    } catch (e) {
      resolve({ 完成: false, 原因: e instanceof Error ? e.message : String(e) });
    }
  });
}

/** 是否像「未登录」类错误（排行榜/成就常见码）。 */
export function 是未登录错误(代码?: number, 消息?: string): boolean {
  if (代码 === 500102 || 代码 === 500103) return true;
  const t = (消息 ?? "").toLowerCase();
  return (
    t.includes("login") ||
    t.includes("未登录") ||
    t.includes("not login") ||
    t.includes("unauthorized")
  );
}
