import { 发布Tap探针, 探测Tap能力 } from "./Tap环境";
import { 拉取云存档 } from "./云存档";
import { 记录分析事件 } from "./分析";
import { Tap应用 } from "./配置";
import "./Tap类型";

/** 启动时探测宿主、挂探针，并在具备云存档时尝试拉取。 */
export function 启动平台能力(): void {
  const 探测 = 发布Tap探针(探测Tap能力());
  if (typeof window !== "undefined") {
    window.__GAME_PLATFORM__ = {
      ClientID: Tap应用.ClientID,
      应用编号: Tap应用.应用编号,
      探测,
    };
  }
  记录分析事件("session_start", {
    在Tap容器: 探测.在Tap容器,
    有云存档: 探测.有云存档,
  });
  if (探测.有云存档) {
    void 拉取云存档()
      .then((结果) => {
        记录分析事件("cloud_sync", { 方向: 结果.方向 ?? "跳过", 完成: 结果.完成 });
        if (typeof window !== "undefined" && window.__GAME_PLATFORM__) {
          window.__GAME_PLATFORM__.云拉取 = 结果;
        }
      })
      .catch((错误) => {
        if (typeof window !== "undefined" && window.__GAME_PLATFORM__) {
          window.__GAME_PLATFORM__.云拉取错误 = String(错误);
        }
      });
  }
}
