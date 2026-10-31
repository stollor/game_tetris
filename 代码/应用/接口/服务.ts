import type { 对局纪录 } from "../../存档/对局纪录";
import type { 对局奖励输入, 收藏存档, 收藏结果 } from "../../存档/收藏";
import type { 加载排行榜结果, 排行榜周期 } from "../../平台/排行榜";
import type { 再消一行状态, 方块类型, 游戏模式 } from "../../玩法/再消一行";
import type { 游戏设置 } from "../../设置/游戏设置";
import type { 游戏文案 } from "../../语言/类型";
import type { 主题名 } from "../../项目配置/主题目录";
import type { 外观部位 } from "../../项目配置/外观部位";

/**
 * 《再消一行》Three 版的应用服务契约：页面只依赖这里的接口，不直接 import 存档/平台细节。
 * 实现放 代码/应用/服务/，启动时创建一份注入所有页面。
 */

/** 跨页面语义色与方块颜色，实现位于资源/主题/。 */
export interface 游戏主题 {
  名称: string;
  深色: boolean;
  颜色: {
    底色: number;
    面板: number;
    浮层: number;
    描边: number;
    主字: number;
    次字: number;
    暗字: number;
    强调: number;
    成功: number;
    警告: number;
    危险: number;
  };
  方块: Record<方块类型, number>;
}

export interface 设置服务 {
  读取(): 游戏设置;
  更新(变化: Partial<游戏设置>): 游戏设置;
  订阅(回调: (设置: 游戏设置) => void): () => void;
}

export interface 语言服务 {
  读取(): 游戏文案;
  是否英文(): boolean;
  设置(语言: 游戏设置["语言"]): void;
}

export interface 纪录服务 {
  读取(模式: 游戏模式, 日期?: string): 对局纪录 | null;
  /** 保存并返回是否刷新纪录（冲刺按有效用时、其余按分数）。 */
  保存(模式: 游戏模式, 纪录: 对局纪录, 日期?: string): boolean;
}

/** 金币与外观所有权：商店可买整套或单个部位，成就与对局只发金币。 */
export interface 金币服务 {
  读取(): 收藏存档;
  增加(数量: number): 收藏结果;
  购买(主题: 主题名, 部位: 外观部位 | "整套"): 收藏结果;
  /** 兼容旧调用方：等同购买整套。 */
  购买主题(主题: 主题名): 收藏结果;
  领取成就(已解锁: readonly string[]): 收藏结果;
  结算对局(输入: 对局奖励输入): 收藏结果;
  订阅(回调: () => void): () => void;
}

export interface 成就定义项 {
  编号: string;
  目标: number;
}

export interface 成就服务 {
  读取保存成功(): boolean;
  全部定义(): readonly 成就定义项[];
  /** 返回本次新解锁的成就编号。 */
  记录落块(状态: 再消一行状态): string[];
  /** 通用推进/累加（冲刺完赛、极限完赛等结算成就用）；返回是否本次新解锁。 */
  推进(编号: string, 次数?: number): boolean;
  读取已解锁(): string[];
  读取进度(编号: string): number;
  订阅(回调: () => void): () => void;
}

export type 音效编号 = string;

export interface 音频服务 {
  设置暂停(暂停: boolean): void;
  播放音乐(编号: string, 试听?: boolean): void;
  停止音乐(): void;
  播放音效(编号: 音效编号): void;
  播放消行(消行数: number, 连击: number, 试听主题?: 主题名): void;
  设置音量(): void;
  /** 用户手势后解锁音频上下文（启动层在首次 pointerdown/keydown 调用）。 */
  解锁(): void;
  /** 只读实际设置与播放器状态，验收用它核对静音与上下文。 */
  读取状态(): {
    背景音乐: boolean;
    音乐音量: number;
    音效音量: number;
    上下文: string;
    当前音乐: string | null;
    暂停: boolean;
  };
  停止全部(): void;
}

export interface 平台服务 {
  是否可用(): boolean;
  提交分数(模式: 游戏模式, 分数: number, 用时毫秒?: number | null, 完赛?: boolean): Promise<void>;
  加载排行榜(模式: 游戏模式, 周期: 排行榜周期): Promise<加载排行榜结果>;
  解锁成就(本地编号: string): Promise<void>;
}

export interface 主题服务 {
  读取(): 游戏主题;
  订阅(回调: (主题: 游戏主题) => void): () => void;
  销毁?(): void;
}

export interface 内存快照 {
  已用MB: number | null;
  总额MB: number | null;
}

export interface 应用服务 {
  设置: 设置服务;
  语言: 语言服务;
  纪录: 纪录服务;
  金币: 金币服务;
  成就: 成就服务;
  音频: 音频服务;
  平台: 平台服务;
  主题: 主题服务;
  内存(): 内存快照;
  /** UTC 日期 YYYY-MM-DD：每日挑战种子与纪录键共用。 */
  当日日期(): string;
}

/** 一局结束后的结算输入：结算页据此显示并写纪录/金币/成就。 */
export interface 对局结果 {
  模式: 游戏模式;
  分数: number;
  消行数: number;
  等级: number;
  最长连击: number;
  /** 有效用时毫秒；马拉松/每日挑战为 null。 */
  用时毫秒: number | null;
  完赛: boolean;
  /** UTC 日期 YYYY-MM-DD，每日挑战按它取纪录。 */
  日期: string;
}
