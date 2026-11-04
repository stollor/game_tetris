import { 释放曲谱缓冲 } from "../../.gamemaker/依赖/框架/音频/曲谱缓冲";
import { type 程序音频环境, 释放程序声部 } from "../../.gamemaker/依赖/框架/音频/程序音频";
import { 创建音乐播放器, type 音乐播放器 } from "../../.gamemaker/依赖/框架/音频/音乐播放";
import type { 音效谱 } from "../../.gamemaker/依赖/框架/音频/音效目录";
import { 演奏音效 } from "../../.gamemaker/依赖/框架/音频/音效编排";
import { 创建节流音效 } from "../../.gamemaker/依赖/框架/音频/音效节流";
import { 读取有效游戏主题 } from "../../资源/主题/主题组合";
import type { 设置服务, 音频服务 } from "../应用/接口/服务";
import { 音乐库 } from "../框架配置/音乐";
import { 应用像素音效, 应用糖果音效, 消行谱, 连击谱, 音效库 } from "../框架配置/音效";
import type { 游戏设置 } from "../设置/游戏设置";
import { type 主题名, 是主题名 } from "../项目配置/主题目录";

/** 主题槽位里的当前值：四个槽位取值口径统一从这里读，页面不再自己找。 */
function 槽位值(设置: 游戏设置, 槽位: string): unknown {
  return 读取有效游戏主题(设置).槽位.find((项) => 项.槽位.编号 === 槽位)?.资源.值 ?? null;
}

const 已知音乐编号 = new Set(音乐库.map((项) => 项.id));
/** 分层音乐回到这一档：切曲目、失焦、静音都重置，不把上一首的强度带过来。 */
const 初始音乐强度 = 0;
/** 资源路径按页面地址解析，与项目模板里文件型音乐的口径一致。 */
const 解析资源地址 = (资源: string) => new URL(资源, location.href).href;

/** 主题自带的主题曲：音乐库编号以 `<主题>.` 开头的第一首；没有就是 null。 */
export function 读取主题曲(主题: 主题名): string | null {
  const 前缀 = `${主题}.`;
  return 音乐库.find((项) => 项.id.startsWith(前缀))?.id ?? null;
}

/**
 * 场景音乐：主题「背景音乐」槽位点到的那套主题有自己的曲目就用主题曲，
 * 否则回落到场景自带音乐（菜单/对局各一首）。
 */
export function 读取主题音乐编号(设置: 游戏设置, 场景: string | null, 试听 = false): string | null {
  if (!场景 || 试听) return 场景;
  const 值 = 槽位值(设置, "背景音乐");
  if (typeof 值 !== "string") return 场景;
  if (是主题名(值)) {
    const 主题曲 = 读取主题曲(值);
    if (主题曲) return 主题曲;
  }
  return 已知音乐编号.has(值) ? 值 : 场景;
}

/** 音效套装的音色换算表：没有列出的槽位沿用默认合成谱。 */
const 音效套装表: Record<string, (谱: 音效谱) => 音效谱> = {
  砖机液晶: 应用像素音效,
  街机彩砖: 应用像素音效,
  糖果超甜: 应用糖果音效,
};

/** 音效套装：按槽位（或商店试听主题）把默认谱换成该主题的音色。 */
export function 读取主题音效谱(设置: 游戏设置, 谱: 音效谱, 试听主题?: 主题名): 音效谱 {
  const 值 = 试听主题 ?? 槽位值(设置, "音效套装");
  const 套装 = typeof 值 === "string" ? 音效套装表[值] : undefined;
  return 套装 ? 套装(谱) : 谱;
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
  let 当前播放器: 音乐播放器 | null = null;
  let 当前音乐编号: string | null = null;
  let 音乐强度 = 初始音乐强度;
  let 已销毁 = false,
    场景暂停 = false,
    已解锁 = false;
  let 场景音乐: string | null = null;
  let 正在试听 = false;
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
    当前播放器?.停止();
    当前播放器 = null;
    当前音乐编号 = null;
    音乐强度 = 初始音乐强度;
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
    const 编号 = 读取主题音乐编号(值, 场景音乐, 正在试听);
    const 条目 = 编号 ? 解析音乐(编号) : undefined;
    if (!值.背景音乐 || 值.音乐音量 <= 0 || !条目) {
      停止当前音乐();
      return;
    }
    // 播放器报错（例如自动播放被拒）时允许下一次同步重建，而不是卡在错误状态。
    if (当前音乐编号 === 条目.id && 当前播放器 && 当前播放器.读取状态().状态 !== "错误") return;
    停止当前音乐();
    const 当前 = 确保环境();
    if (!当前) return;
    当前播放器 = 创建音乐播放器(当前, 条目, { 资源地址: 解析资源地址, 初强度: 音乐强度 });
    当前音乐编号 = 条目.id;
    void 当前播放器.播放();
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
    播放音乐: (编号, 试听 = false) => {
      正在试听 = 试听;
      场景音乐 = 编号;
      同步播放();
    },
    停止音乐: () => {
      场景音乐 = null;
      停止当前音乐();
    },
    设置音乐强度: (值) => {
      if (!Number.isFinite(值) || 值 < 0 || 值 > 100) throw new Error("音乐强度必须为0–100");
      音乐强度 = 值;
      当前播放器?.设置强度(值);
    },
    播放音效: (编号) => {
      // 解锁只需一次：之后每次播放都走 同步播放 会新建设置快照 + 主题解析 + 音乐查找，
      // 后期落块/旋转每秒十几次，属于纯浪费。
      if (!已解锁) 解锁();
      节流.播放(编号, "手动");
    },
    播放消行: (消行数, 连击, 试听主题) => {
      if (!可以播放()) return;
      const 当前 = 确保环境();
      if (!当前) return;
      // 同一次播放只取一份设置快照：音效谱与音量必须按同一时刻的口径。
      const 当前设置 = 设置.读取();
      if (当前设置.音效音量 <= 0) return;
      演奏音效(当前, 读取主题音效谱(当前设置, 消行谱(消行数), 试听主题));
      if (连击 >= 2) 演奏音效(当前, 读取主题音效谱(当前设置, 连击谱(连击), 试听主题));
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
        音乐强度,
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
