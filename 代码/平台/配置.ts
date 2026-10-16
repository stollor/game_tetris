/** TapTap 开放能力公开配置。Client Token 等密钥不得写入本文件或仓库。 */
export const Tap应用 = {
  /** 开发者后台 Client ID（公开标识，可进包）。 */
  ClientID: "ps0g5bb9grmqohjh2z",
  开发者编号: 363566,
  应用编号: 977300,
} as const;

/** 后台「游戏排行」创建后填入；空字符串表示尚未配置，提交会被跳过。 */
export const 排行榜编号 = {
  马拉松: "np8kxqoitnd91u3zs8",
  冲刺: "goxljcidqfnlfynjbu",
  极限: "bcbtf3vycr5ff16je0",
  每日挑战: "la22thsyes0hz9kd9s",
} as const;

/**
 * 本地成就编号 → 开发者中心平台成就 ID。
 * 值留空则不同步到平台；后台创建后填入真实 ID。
 */
export const 平台成就映射: Readonly<Record<string, string>> = {
  "first-lock": "FIRST_LOCK",
  "first-clear": "FIRST_CLEAR",
  tetris: "TETRIS",
  spin: "SPIN",
  combo: "COMBO",
  b2b: "B2B",
  perfect: "PERFECT",
  hold: "HOLD",
  lines: "LINES",
  level: "LEVEL",
  sprint: "SPRINT",
  ultra: "ULTRA",
};

/** 云存档槽位名（不可含空格/中文）。 */
export const 云存档槽名 = "slot_travel_v1";

export const 分析开关 = {
  /** 浏览器直连 TapDB REST 可能遇 CORS；默认关闭，仅打本地探针。 */
  启用TapDB上报: false,
} as const;
