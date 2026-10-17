/** TapTap 开放能力公开配置。Client Token 等密钥不得写入本文件或仓库。 */
export const Tap应用 = {
  /** 开发者后台 Client ID（公开标识，可进包）。 */
  ClientID: "ps0g5bb9grmqohjh2z",
  开发者编号: 363566,
  应用编号: 977300,
} as const;

/**
 * 排行榜周期。
 * Tap 控制台里每个榜单只配置一种重置周期（日/周/月/永久）。
 * 要在客户端同时展示「日 / 周 / 月 / 总」，需为同一模式各建一张对应周期的榜，并把 ID 填进下表。
 * periodToken 只用于查询「同一张榜」的历史周期实例，不能把一张永久榜切成日榜。
 */
export type 排行榜周期 = "日" | "周" | "月" | "总";

export const 排行榜周期顺序: readonly 排行榜周期[] = ["日", "周", "月", "总"];

export const 排行榜周期标签 = {
  日: { 中文: "日榜", 英文: "Daily" },
  周: { 中文: "周榜", 英文: "Weekly" },
  月: { 中文: "月榜", 英文: "Monthly" },
  总: { 中文: "总榜", 英文: "All-time" },
} as const;

/** 模式 × 周期 → 后台排行榜 ID；空字符串表示尚未在控制台创建该周期榜。 */
export const 排行榜编号按周期 = {
  马拉松: {
    日: "",
    周: "",
    月: "",
    总: "np8kxqoitnd91u3zs8",
  },
  冲刺: {
    日: "",
    周: "",
    月: "",
    总: "goxljcidqfnlfynjbu",
  },
  极限: {
    日: "",
    周: "",
    月: "",
    总: "bcbtf3vycr5ff16je0",
  },
  每日挑战: {
    日: "",
    周: "",
    月: "",
    总: "la22thsyes0hz9kd9s",
  },
} as const;

/** 兼容旧代码：默认取总榜 ID（提交成绩也优先写总榜）。 */
export const 排行榜编号 = {
  马拉松: 排行榜编号按周期.马拉松.总,
  冲刺: 排行榜编号按周期.冲刺.总,
  极限: 排行榜编号按周期.极限.总,
  每日挑战: 排行榜编号按周期.每日挑战.总,
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
