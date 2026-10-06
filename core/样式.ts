import type { 样式选择 } from "./设置";

const 样式强调色: Record<样式选择, string> = {
  夜空鎏金: "#e6b45c",
  暖纸古典: "#9a6b1f",
  青蓝未来: "#4ed5d0",
};

const 样式背景色: Record<样式选择, string> = {
  夜空鎏金: "#0b1220",
  暖纸古典: "#f2ecdd",
  青蓝未来: "#071922",
};

export interface 游戏界面色彩 {
  强调色: string;
  面板: string;
  正文: string;
  次要文字: string;
  轨道: string;
  遮罩: string;
}

export function 应用样式(样式: 样式选择): void {
  document.documentElement.dataset.style = 样式;
}

export function 获取样式强调色(样式: 样式选择): string {
  return 样式强调色[样式];
}

export function 获取样式背景色(样式: 样式选择): string {
  return 样式背景色[样式];
}

export function 获取游戏界面色彩(样式: 样式选择, 浅色主题: boolean): 游戏界面色彩 {
  return {
    强调色: 获取样式强调色(样式),
    面板: 浅色主题 ? "#fbf7ec" : "#182334",
    正文: 浅色主题 ? "#423627" : "#e8edf3",
    次要文字: 浅色主题 ? "#6c6253" : "#8793a2",
    轨道: 浅色主题 ? "#d4ccbb" : "#263548",
    遮罩: "#05080d",
  };
}
