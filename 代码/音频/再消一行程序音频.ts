import { type 程序音频环境, 释放程序输出 } from "../../框架/音频/程序音频";
import type { 音效谱 } from "../../框架/音频/音效目录";
import { 演奏音效 } from "../../框架/音频/音效编排";
import {
  停止游戏背景音乐,
  播放游戏背景音乐,
  注册程序音效,
  注册音乐库,
  注册音效库,
  获取程序音频环境,
} from "../../框架/音频/音频";
import { 场景氛围表, type 氛围主题 } from "../框架配置/场景氛围";
import { 查找地点 } from "../框架配置/旅行地点";
import { 生成旅行音效谱 } from "../框架配置/旅行音效";
import { 音乐库 } from "../框架配置/音乐";
import { 消行谱, 连击谱, 音效库 } from "../框架配置/音效";
import { 获取游戏设置 } from "../配置/再消一行设置";

declare global {
  interface Window {
    __再消一行音乐__?: () => { 曲目: string | null; 试听: string | null };
  }
}

type 音效名称 =
  | "四行"
  | "暂存"
  | "技巧"
  | "连击"
  | "全清"
  | "开始"
  | "移动"
  | "旋转"
  | "软降"
  | "硬降"
  | "锁定"
  | "消行"
  | "暂停"
  | "继续"
  | "结束"
  | "胜利"
  | "返回";
type 音乐场景 = "菜单" | "对局";

const 音效列表: 音效名称[] = [
  "四行",
  "暂存",
  "技巧",
  "连击",
  "全清",
  "开始",
  "移动",
  "旋转",
  "软降",
  "硬降",
  "锁定",
  "消行",
  "暂停",
  "继续",
  "结束",
  "胜利",
  "返回",
];

/** 合成谱按名称索引；消行与连击在播放时按参数重建，见下方说明。 */
const 静态谱 = new Map<string, 音效谱>();
for (const 项 of 音效库) if (项.类型 === "合成") 静态谱.set(项.名称, 项.谱);

const 最近音效 = new Map<音效名称, number>();

/** 渲染单个音效；消行与连击把消行数代入谱，其余用登记的代表谱。 */
export function 播放合成音效(环境: 程序音频环境, 名称: 音效名称, 消行数 = 1): void {
  const 谱 = 名称 === "消行" ? 消行谱(消行数) : 名称 === "连击" ? 连击谱(消行数) : 静态谱.get(名称);
  const 地点 = 查找地点(获取游戏设置().旅行音效);
  if (谱) 演奏音效(环境, 地点 ? 生成旅行音效谱(谱, 地点) : 谱);
}

// 先统一登记静态谱，供看板与目录读取；再按名称注册带节流的动态覆盖，覆盖同名 id：
// 移动/软降限频 45ms、其余 25ms，保持迁移前的去重行为。
注册音效库(音效库);
for (const 名称 of 音效列表) {
  注册程序音效<number>(`再消一行.${名称}`, (环境, 消行数) => {
    const 现在 = 环境.上下文.currentTime;
    const 上次 = 最近音效.get(名称) ?? -1;
    if (现在 - 上次 < (名称 === "移动" || 名称 === "软降" ? 0.045 : 0.025)) return;
    最近音效.set(名称, 现在);
    播放合成音效(环境, 名称, 消行数);
  });
}

注册音乐库(音乐库);

let 当前曲目: string | null = null;
let 当前场景: 音乐场景 = "菜单";
let 音乐暂停 = false;
let 页面有焦点 = typeof document !== "undefined" && document.hasFocus();
let 播放中曲目: string | null = null;
let 试听曲目: string | null = null;
let 试听计时: ReturnType<typeof setTimeout> | undefined;

function 同步音乐(): void {
  const 设置 = 获取游戏设置();
  const 目标 =
    音乐暂停 || document.hidden || !页面有焦点 || !设置.背景音乐 || 设置.音乐音量 <= 0
      ? null
      : (试听曲目 ?? 当前曲目);
  if (目标 === 播放中曲目) return;
  播放中曲目 = 目标;
  if (目标) 播放游戏背景音乐(目标);
  else 停止游戏背景音乐();
}

export function 停止旅行音乐试听(): void {
  clearTimeout(试听计时);
  试听曲目 = null;
  同步音乐();
}

export function 试听旅行音乐(名称: string): void {
  clearTimeout(试听计时);
  试听曲目 = `旅行.${名称}`;
  同步音乐();
  试听计时 = setTimeout(停止旅行音乐试听, 18000);
}

/** 播放菜单或对局背景曲，并记住当前曲目供暂停后恢复。 */
export function 播放再消一行音乐(场景: 音乐场景): void {
  音乐暂停 = false;
  当前场景 = 场景;
  当前曲目 = 获取游戏设置().旅行音乐 ? `旅行.${获取游戏设置().旅行音乐}` : `再消一行.${场景}`;
  clearTimeout(试听计时);
  试听曲目 = null;
  同步音乐();
}

/**
 * 框架曲谱没有暂停，只能整体停止。暂停时停止背景音乐，
 * 恢复时重新播放当前曲目，循环从头开始（见 文档/音频接入.md）。
 */
export function 设置再消一行音乐暂停(暂停: boolean): void {
  音乐暂停 = 暂停;
  同步音乐();
}

if (typeof window !== "undefined") {
  window.addEventListener("blur", () => {
    页面有焦点 = false;
    同步音乐();
    同步场景氛围();
  });
  window.addEventListener("focus", () => {
    页面有焦点 = true;
    同步音乐();
    同步场景氛围();
  });
  document.addEventListener("visibilitychange", () => {
    同步音乐();
    同步场景氛围();
  });
  window.addEventListener("gamemaker:settings-change", () => {
    if (!当前曲目 && !试听曲目) return;
    const 曲目 = 获取游戏设置().旅行音乐
      ? `旅行.${获取游戏设置().旅行音乐}`
      : `再消一行.${当前场景}`;
    当前曲目 = 曲目;
    同步音乐();
  });
}

let 当前氛围: 氛围主题 | null = null;
let 氛围停止: (() => void) | undefined;
let 氛围点缀: ReturnType<typeof setInterval> | undefined;

function 循环噪声(
  环境: 程序音频环境,
  频率: number,
  音量: number,
  滤波: BiquadFilterType,
): () => void {
  const { 上下文 } = 环境;
  const 时长 = 3.2;
  const 缓冲 = 上下文.createBuffer(1, Math.floor(上下文.sampleRate * 时长), 上下文.sampleRate);
  const 样本 = 缓冲.getChannelData(0);
  for (let i = 0; i < 样本.length; i++) 样本[i] = Math.random() * 2 - 1;
  const 声源 = 上下文.createBufferSource();
  const 器 = 上下文.createBiquadFilter();
  const 增益 = 上下文.createGain();
  声源.buffer = 缓冲;
  声源.loop = true;
  器.type = 滤波;
  器.frequency.value = 频率;
  增益.gain.value = 音量;
  声源.connect(器).connect(增益).connect(环境.音效输出);
  声源.start();
  return () => {
    try {
      声源.stop();
    } catch {
      /* 已停 */
    }
    声源.disconnect();
    器.disconnect();
    增益.disconnect();
  };
}

function 启动场景氛围(环境: 程序音频环境, 主题: 氛围主题): void {
  if (!主题) return;
  const 比例 = 获取游戏设置().背景音效音量 / 100;
  if (比例 === 0) return;
  const 配方 = 场景氛围表[主题];
  if (!配方) return;
  const 氛围输出 = 环境.上下文.createGain();
  氛围输出.gain.value = 比例;
  氛围输出.connect(环境.上下文.destination);
  环境 = { ...环境, 音效输出: 氛围输出 };
  const 停止项 = 配方.循环.map((层) => 循环噪声(环境, 层.频率, 层.音量, 层.滤波));
  if (配方.点缀) {
    const 点缀 = 配方.点缀;
    const 拍 = () => 演奏音效(环境, 点缀.谱);
    氛围点缀 = setInterval(拍, 点缀.间隔秒 * 1000);
  }
  氛围停止 = () => {
    for (const 停 of 停止项) 停();
    释放程序输出(氛围输出);
    氛围输出.disconnect();
    if (氛围点缀) clearInterval(氛围点缀);
    氛围点缀 = undefined;
  };
}

export function 停止场景氛围(): void {
  氛围停止?.();
  氛围停止 = undefined;
  if (氛围点缀) clearInterval(氛围点缀);
  氛围点缀 = undefined;
  当前氛围 = null;
}

/** 按当前风景循环环境声，使用独立输出，与交互音效、背景音乐分别调节。 */
export function 播放场景氛围(主题: 氛围主题): void {
  if (当前氛围 === 主题 && 氛围停止) return;
  停止场景氛围();
  当前氛围 = 主题;
  if (获取游戏设置().背景音效音量 <= 0 || document.hidden || !页面有焦点) return;
  const 环境 = 获取程序音频环境();
  if (环境) 启动场景氛围(环境, 主题);
}

function 同步场景氛围(): void {
  const 主题 = 当前氛围;
  停止场景氛围();
  if (主题) 播放场景氛围(主题);
}

export function 停止再消一行音乐(): void {
  当前曲目 = null;
  停止旅行音乐试听();
}

if (typeof window !== "undefined") {
  window.addEventListener("gamemaker:settings-change", () => {
    同步场景氛围();
  });
  window.__再消一行音乐__ = () => ({ 曲目: 播放中曲目, 试听: 试听曲目 });
}
