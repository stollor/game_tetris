import { 释放曲谱缓冲 } from "../../框架/音频/曲谱缓冲";
import { type 程序音频环境, 释放程序声部, 释放程序输出 } from "../../框架/音频/程序音频";
import { 演奏曲谱 } from "../../框架/音频/音乐编排";
import { 演奏音效 } from "../../框架/音频/音效编排";
import { 创建节流音效 } from "../../框架/音频/音效节流";
import type { 设置服务, 音频服务 } from "../应用/接口/服务";
import { 场景氛围表, type 氛围主题 } from "../框架配置/场景氛围";
import { 应用装备音效 } from "../框架配置/旅行音效";
import { 音乐库 } from "../框架配置/音乐";
import { 消行谱, 连击谱, 音效库 } from "../框架配置/音效";

/**
 * Three 版音频：只做 WebAudio 上下文/总线/音量/静音/氛围调度；
 * 合成谱与曲谱展开直接复用 Three 框架/音频/中的通用模块（程序音频/音乐编排/音效编排/音效节流），
 * 谱数据只 import 代码/框架配置/ 的三份表，不复制。
 * 浏览器要求用户手势后才能出声：启动层在首次 pointerdown/keydown 调 解锁()。
 */

export function 创建音频服务(设置: 设置服务): 音频服务 {
  let 上下文: AudioContext | null = null;
  let 环境: 程序音频环境 | null = null;
  let 音乐输出: GainNode | null = null;
  let 音效输出: GainNode | null = null;
  let 氛围输出: GainNode | null = null;
  let 停止音乐: (() => void) | null = null;
  let 当前音乐编号: string | null = null;
  let 氛围节点: { 停止: () => void } | null = null;
  let 噪声缓冲: AudioBuffer | null = null;
  let 已销毁 = false,
    场景暂停 = false,
    已解锁 = false;
  let 场景音乐: string | null = null,
    当前氛围: string | null = null;
  let 氛围主题: 氛围主题 | null = null;
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
    氛围输出 = 上下文.createGain();
    音乐输出.connect(上下文.destination);
    音效输出.connect(上下文.destination);
    氛围输出.connect(上下文.destination);
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
    if (氛围输出) 氛围输出.gain.value = Math.max(0, Math.min(1, 设置值.背景音效音量 / 100)) * 0.9;
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
      条目.id.startsWith("再消一行.") ? 应用装备音效(条目.谱, 设置.读取().旅行音效) : 条目.谱,
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

  const 停止氛围节点 = () => {
    氛围节点?.停止();
    氛围节点 = null;
    当前氛围 = null;
  };

  const 生成噪声缓冲 = (当前: 程序音频环境): AudioBuffer => {
    if (噪声缓冲) return 噪声缓冲;
    const 采样率 = 当前.上下文.sampleRate;
    const 缓冲 = 当前.上下文.createBuffer(1, 采样率 * 2, 采样率);
    const 数据 = 缓冲.getChannelData(0);
    for (let 下标 = 0; 下标 < 数据.length; 下标++) 数据[下标] = Math.random() * 2 - 1;
    噪声缓冲 = 缓冲;
    return 缓冲;
  };

  const 播放氛围配方 = (主题: 氛围主题) => {
    const 当前 = 确保环境();
    if (!当前) return;
    const 配方 = 场景氛围表[主题];
    if (!配方) return;
    const 音量 = 设置.读取();
    if (!音量.背景音效音量 || 音量.背景音效音量 <= 0) return;
    const 源 = 生成噪声缓冲(当前);
    const 节点列表: { 停止: () => void }[] = [];
    for (const 循环 of 配方.循环) {
      const 声源 = 当前.上下文.createBufferSource();
      声源.buffer = 源;
      声源.loop = true;
      const 滤波 = 当前.上下文.createBiquadFilter();
      滤波.type = 循环.滤波;
      滤波.frequency.value = 循环.频率;
      const 增益 = 当前.上下文.createGain();
      增益.gain.value = 循环.音量;
      声源
        .connect(滤波)
        .connect(增益)
        .connect(氛围输出 ?? 当前.音效输出);
      声源.start();
      节点列表.push({
        停止: () => {
          try {
            声源.stop();
          } catch {
            // 声源可能还没开始。
          }
          声源.disconnect();
          滤波.disconnect();
          释放程序输出(增益);
        },
      });
    }
    let 定时: ReturnType<typeof setInterval> | null = null;
    if (配方.点缀) {
      const 点缀 = 配方.点缀;
      定时 = setInterval(
        () => {
          const 活跃 = 确保环境();
          if (!活跃 || document.hidden) return;
          演奏音效({ ...活跃, 音效输出: 氛围输出 ?? 活跃.音效输出 }, 点缀.谱);
        },
        Math.max(1000, 点缀.间隔秒 * 1000),
      );
    }
    当前氛围 = 主题;
    氛围节点 = {
      停止: () => {
        if (定时) clearInterval(定时);
        for (const 项 of 节点列表) 项.停止();
        节点列表.length = 0;
      },
    };
  };

  const 同步播放 = () => {
    应用音量();
    if (!可以播放() || !已解锁) {
      停止当前音乐();
      停止氛围节点();
      if (!宿主活跃() && 上下文?.state === "running") void 上下文.suspend().catch(() => {});
      return;
    }
    if (上下文?.state === "suspended") void 上下文.resume().catch(() => {});
    const 值 = 设置.读取();
    const 编号 = 场景音乐 && (值.旅行音乐 ? "旅行." + 值.旅行音乐 : 场景音乐);
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
    const 主题 = 氛围主题;
    if (!主题 || 值.背景音效音量 <= 0) 停止氛围节点();
    else if (当前氛围 !== 主题) {
      停止氛围节点();
      播放氛围配方(主题);
    }
  };
  const 取消设置 = 设置.订阅(() => {
    if (氛围主题) 氛围主题 = 设置.读取().背景主题;
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
      演奏音效(当前, 应用装备音效(消行谱(消行数), 设置.读取().旅行音效));
      if (连击 >= 2) 演奏音效(当前, 应用装备音效(连击谱(连击), 设置.读取().旅行音效));
    },
    播放氛围: (主题) => {
      氛围主题 = 主题 && Object.hasOwn(场景氛围表, 主题) ? (主题 as 氛围主题) : null;
      同步播放();
    },
    停止氛围: () => {
      氛围主题 = null;
      停止氛围节点();
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
        当前氛围,
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
      停止氛围节点();
      if (上下文) {
        释放程序声部(上下文);
        释放曲谱缓冲(上下文);
      }
      节流.清理();
      音乐输出?.disconnect();
      音效输出?.disconnect();
      氛围输出?.disconnect();
      if (上下文) void 上下文.close().catch(() => {});
      环境 = null;
      噪声缓冲 = null;
    },
  };
}
