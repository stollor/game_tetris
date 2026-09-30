/**
 * NEON PULSE — 四模式配置（framework §2.1）
 * 成绩口径：分数型 = 总分；时间型（Sprint）= 有效用时（墙钟 − 暂停累计）
 */
window.NP_CONFIG = window.NP_CONFIG || {};
window.NP_CONFIG.modes = [
  {
    id: 'marathon',
    nameKey: 'mode.marathon.name',
    descKey: 'mode.marathon.desc',
    scoreType: 'score',           // 分数型
    goalLines: null,              // 无固定目标行
    clearLevel: 15,               // 达到 15 级（140 行）= 通关，之后无尽
    endless: true,
    timeLimitMs: null,
  },
  {
    id: 'sprint',
    nameKey: 'mode.sprint.name',
    descKey: 'mode.sprint.desc',
    scoreType: 'time',            // 时间型：有效用时
    goalLines: 40,                // 消 40 行即结束
    clearLevel: null,
    endless: false,
    timeLimitMs: null,
  },
  {
    id: 'ultra',
    nameKey: 'mode.ultra.name',
    descKey: 'mode.ultra.desc',
    scoreType: 'score',
    goalLines: null,
    clearLevel: null,
    endless: true,                // 等级不封顶，19 级起 20G
    timeLimitMs: 120000,          // 2 分钟
  },
  {
    id: 'daily',
    nameKey: 'mode.daily.name',
    descKey: 'mode.daily.desc',
    scoreType: 'score',
    goalLines: null,
    clearLevel: 15,
    endless: true,
    timeLimitMs: null,
    daily: true,                  // 固定种子，UTC 日
  },
];
