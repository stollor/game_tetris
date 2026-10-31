import { 发布Tap探针, 探测Tap能力 } from "../../.gamemaker/依赖/框架/平台/TapTap/宿主探测";
import { 拉取云存档 } from "./云存档";
import { 更新云同步状态 } from "./云存档状态";
import { 记录分析事件 } from "./分析";
import { 刷新Tap用户身份 } from "./用户身份";
import { Tap应用 } from "./配置";

/** 等待有超时的云拉取后再创建设置/成就服务，避免常驻内存覆盖较新的云档。 */
export async function 启动平台能力(): Promise<void> {
  const 探测 = 发布Tap探针(探测Tap能力());
  window.__GAME_PLATFORM__ = { ClientID: Tap应用.ClientID, 应用编号: Tap应用.应用编号, 探测 };
  记录分析事件("session_start", { 在Tap容器: 探测.在Tap容器, 有云存档: 探测.有云存档 });
  if (探测.在Tap容器) void 刷新Tap用户身份().catch(() => {});
  const 结果 = await 拉取云存档();
  记录分析事件("cloud_sync", { 方向: 结果.方向 ?? "跳过", 完成: 结果.完成 });
  if (window.__GAME_PLATFORM__) window.__GAME_PLATFORM__.云拉取 = 结果;
  if (!探测.有云存档) 更新云同步状态({ 状态: "无能力", 原因: "当前环境无云存档能力" });
}
