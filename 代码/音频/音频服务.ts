import { 释放曲谱缓冲 } from "../../.gamemaker/依赖/框架/音频/曲谱缓冲";
import { type 程序音频环境, 释放程序声部 } from "../../.gamemaker/依赖/框架/音频/程序音频";
import { 演奏曲谱 } from "../../.gamemaker/依赖/框架/音频/音乐编排";
import type { 音效谱 } from "../../.gamemaker/依赖/框架/音频/音效目录";
import { 演奏音效 } from "../../.gamemaker/依赖/框架/音频/音效编排";
import { 创建节流音效 } from "../../.gamemaker/依赖/框架/音频/音效节流";
import { 读取有效游戏主题 } from "../../资源/主题/主题组合";
import { 是像素主题 } from "../../资源/主题/像素/像素风格";
import type { 设置服务, 音频服务 } from "../应用/接口/服务";
import { 音乐库 } from "../框架配置/音乐";
import { 应用像素音效, 消行谱, 连击谱, 音效库 } from "../框架配置/音效";
import type { 游戏设置 } from "../设置/游戏设置";

/** 主题槽位里的当前值：四个槽位取值口径统一从这里读，页面不再自己找。 */
function 槽位值(设置: 游戏设置, 槽位: string): unknown {
  return 读取有效游戏主题(设置).槽位.find((项) => 项.槽位.编号 === 槽位)?.资源.值 ?? null;
}

const 已知音乐编号 = new Set(音乐库.map((项) => 项.id));

/**
 * 场景音乐：主题的「背景音乐」槽位给了真实曲目就用主题曲，否则回落到场景自带音乐。
 * 像素主题额外提供自己的主题曲（`<主题>.主题`）。
 */
export function 读取主题音乐编号(设置: 游戏设置, 场景: string | null): string | null {
  if (!场景) return null;
  const 值 = 槽位值(设置, "背景音乐");
  if (typeof 值 !== "string") return 场景;
  if (是像素主题(值)) {
    const 主题曲 = `${值}.主题`;
    return 已知音乐编号.has(主题曲) ? 主题曲 : 场景;
  }
  return 已知音乐编号.has(值) ? 值 : 场景;
}

/** 音效套装：像素主题用像素音效谱，其余主题用默认谱（不再有人工装备音效）。 */
export function 读取主题音效谱(设置: 游戏设置, 谱: 音效谱): 音效谱 {
  const 值 = 槽位值(设置, "音效套装");
  return 是像素主题(值) ? 应用像素音效(谱) : 谱;
}

/**
 * Three 版音频：只做 WebAudio 上下文/总线/音量/静音与主题音乐调度；
 * 合成谱与曲谱展开直接复用 Three .gamemaker/依赖/框架/音频/中的通用模块（程序音频/音乐编排/音效编排/音效节流），
 * 谱数据只 import 代码/框架配置/ 的三份表，不复制。
 * 浏览器要求用户手势后才能出声：启动层在首次 pointerdown/keydown 调 解锁()。
 */

export function 创建音频服务(设置: 设置服务): 音频服务 {
  let 上下文: AudioContext | null = null;
  let 环境: 程序音频环境 | null = null;
  let 音乐输出: GainNode | null = null;
  let 音效输出: GainNode | null = null;
  let 停止音乐: (() => void) | null = null;
  let 当前音乐编号: string | null = null;
  let 已销毁 = false,
    场景暂停 = false,
    已解锁 = false;
  let 场景音乐: string | null = null;
  const 宿主活跃 = () =>
    !已销毁 && (typeof document === "undefined" || (!document.hidden && document.hasFocus()));

  const 可以播放 = () => 宿主活跃() && !场景暂停;

  const 确保环境 = (): 程序音频环境 | null => {
    if (已销毁) return null;
    if (环境) return 环境;
    if (typeof AudioContext === "undefined") return null;
    上下文 = new AudioContext();
    音乐输出 = 上下文.createGain();
    音效输出 = 上下文.createGain();
    音乐输出.connect(上下文.destination);
    音效输出.connect(上下文.destination);
    环境 = { 上下文, 音乐输出, 音效输出 };
    应用音量();
    return 环境;
  };

  const 应用音量 = () => {
    const 设置值 = 设置.读取();
    const 音乐系数 = 设置值.背景音乐 ? Math.max(0, Math.min(1, 设置值.音乐音量 / 100)) : 0;
    const 音效系数 = Math.max(0, Math.min(1, 设置值.音效音量 / 100));
    if (音乐输出) 音乐输出.gain.value = 音乐系数 * 0.9;
    if (音效输出) 音效输出.gain.value = 音效系数;
  };

  const 解析音效 = (编号: string) =>
    音效库.find((项) => 项.id === 编号 || 项.id === `再消一行.${编号}` || 项.名称 === 编号);

  const 直接播放音效 = (编号: string): boolean => {
    if (!宿主活跃()) return false;
    const 当前 = 确保环境();
    if (!当前) return false;
    const 条目 = 解析音效(编号);
    if (条目?.类型 !== "合成") return false;
    演奏音效(
      当前,
      条目.id.startsWith("再消一行.") ? 读取主题音效谱(设置.读取(), 条目.谱) : 条目.谱,
    );
    return true;
  };

  // 手动通道节流：落块/移动这类高频操作不叠音；消行走 播放消行，不经过这里。
  const 节流 = 创建节流音效({
    前缀: "",
    手动间隔毫秒: 45,
    播放: (编号) => {
      直接播放音效(编号);
    },
    解锁: () => {
      void 上下文?.resume();
    },
  });

  const 解析音乐 = (编号: string) =>
    音乐库.find((项) => 项.id === 编号 || 项.id === `再消一行.${编号}` || 项.名称 === 编号);

  const 停止当前音乐 = () => {
    停止音乐?.();
    停止音乐 = null;
    当前音乐编号 = null;
  };

  const 同步播放 = () => {
    应用音量();
    if (!可以播放() || !已解锁) {
      停止当前音乐();
      if (!宿主活跃() && 上下文?.state === "running") void 上下文.suspend().catch(() => {});
      return;
    }
    if (上下文?.state === "suspended") void 上下文.resume().catch(() => {});
    const 值 = 设置.读取();
    const 编号 = 读取主题音乐编号(值, 场景音乐);
    const 条目 = 编号 ? 解析音乐(编号) : undefined;
    if (!值.背景音乐 || 值.音乐音量 <= 0 || 条目?.类型 !== "曲谱") 停止当前音乐();
    else if (当前音乐编号 !== 条目.id) {
      停止当前音乐();
      const 当前 = 确保环境();
      if (当前) {
        停止音乐 = 演奏曲谱(当前, 条目.曲谱);
        当前音乐编号 = 条目.id;
      }
    }
  };
  const 取消设置 = 设置.订阅(() => {
    同步播放();
  });

  const 解锁 = () => {
    if (已销毁) return;
    已解锁 = true;
    确保环境();
    if (宿主活跃()) 节流.解锁();
    同步播放();
  };

  const 解锁一次 = () => {
    解锁();
    window.removeEventListener("pointerdown", 解锁一次);
    window.removeEventListener("keydown", 解锁一次);
  };
  if (typeof window !== "undefined") {
    window.addEventListener("pointerdown", 解锁一次);
    window.addEventListener("keydown", 解锁一次);
    window.addEventListener("blur", 同步播放);
    window.addEventListener("focus", 同步播放);
    document.addEventListener("visibilitychange", 同步播放);
  }

  return {
    解锁,
    设置暂停: (暂停) => {
      场景暂停 = 暂停;
      同步播放();
    },
    播放音乐: (编号) => {
      场景音乐 = 编号;
      同步播放();
    },
    停止音乐: () => {
      场景音乐 = null;
      停止当前音乐();
    },
    播放音效: (编号) => {
      解锁();
      节流.播放(编号, "手动");
    },
    播放消行: (消行数, 连击) => {
      if (!可以播放()) return;
      const 当前 = 确保环境();
      if (!当前) return;
      if (设置.读取().音效音量 <= 0) return;
      演奏音效(当前, 读取主题音效谱(设置.读取(), 消行谱(消行数)));
      if (连击 >= 2) 演奏音效(当前, 读取主题音效谱(设置.读取(), 连击谱(连击)));
    },
    设置音量: 应用音量,
    读取状态: () => {
      const 设置值 = 设置.读取();
      return {
        背景音乐: 设置值.背景音乐,
        音乐音量: 设置值.音乐音量,
        音效音量: 设置值.音效音量,
        上下文: 上下文?.state ?? "未创建",
        当前音乐: 当前音乐编号,
        暂停: !可以播放(),
      };
    },
    停止全部: () => {
      if (已销毁) return;
      已销毁 = true;
      取消设置();
      if (typeof window !== "undefined") {
        window.removeEventListener("pointerdown", 解锁一次);
        window.removeEventListener("keydown", 解锁一次);
        window.removeEventListener("blur", 同步播放);
        window.removeEventListener("focus", 同步播放);
        document.removeEventListener("visibilitychange", 同步播放);
      }
      停止当前音乐();
      if (上下文) {
        释放程序声部(上下文);
        释放曲谱缓冲(上下文);
      }
      节流.清理();
      音乐输出?.disconnect();
      音效输出?.disconnect();
      if (上下文) void 上下文.close().catch(() => {});
      环境 = null;
    },
  };
}
