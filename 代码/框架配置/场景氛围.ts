import type { 音效条目, 音效谱 } from "../../.gamemaker/依赖/框架/音频/音效目录";
import { 主题列表, type 主题名 } from "../项目配置/主题目录";

/** 氛围与整套主题同名：页面按当前主题选择氛围。 */
export type 氛围主题 = 主题名;

export interface 氛围循环 {
  频率: number;
  音量: number;
  滤波: BiquadFilterType;
}

export interface 氛围点缀 {
  间隔秒: number;
  谱: 音效谱;
}

export interface 氛围配方 {
  说明: string;
  循环: readonly 氛围循环[];
  点缀?: 氛围点缀;
}

function 噪(时长: number, 音量: number, 频率: number, 滤波: BiquadFilterType, 延迟 = 0) {
  return { 时长, 音量, 频率, 滤波, 延迟 };
}

function 音(频率: number, 时长: number, 音量: number, 波形: OscillatorType = "sine", 延迟 = 0) {
  return { 起频: 频率, 时长, 音量, 波形, 延迟 };
}

/** 极夜空气的细响：唯一的风景环境声，像素与立体主题沿用同一份。 */
const 极夜氛围: 氛围配方 = {
  说明: "极夜空气的细响",
  循环: [{ 频率: 1400, 音量: 0.024, 滤波: "bandpass" }],
  点缀: { 间隔秒: 9.2, 谱: { 音符: [音(1760, 0.8, 0.016, "sine")] } },
};

/** 四套主题的环境声：只有极光原野有风景底噪，其余主题沿用，不另造音色。 */
export const 场景氛围表: Record<氛围主题, 氛围配方> = {
  极光原野: 极夜氛围,
  砖机液晶: 极夜氛围,
  街机彩砖: 极夜氛围,
  立体晶格: 极夜氛围,
};

export const 场景氛围库: 音效条目[] = 主题列表.map((主题) => ({
  id: `再消一行.氛围.${主题}`,
  名称: `${主题}氛围`,
  用途: ["主菜单"],
  说明: 场景氛围表[主题].说明,
  类型: "合成" as const,
  谱: {
    噪声: 场景氛围表[主题].循环.map((层) => 噪(2.4, 层.音量, 层.频率, 层.滤波)),
    音符: 场景氛围表[主题].点缀?.谱.音符,
  },
}));
