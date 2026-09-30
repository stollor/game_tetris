/**
 * NEON PULSE — 数值配置（唯一调参入口）
 * 依据：01-framework/framework.md §5 / §6 / §7 / §8
 * 说明：因需支持 file:// 直接打开（fetch 在 file:// 下被浏览器禁止），
 *       配置以 JS 对象形式外置（内容即 JSON 数据），策划调参只改本目录，不改代码。
 */
window.NP_CONFIG = window.NP_CONFIG || {};
window.NP_CONFIG.balance = {
  /* ---------- 场地（§5.1） ---------- */
  field: {
    cols: 10,
    visibleRows: 20,
    hiddenRows: 2,        // 隐藏缓冲区：行 -2、-1
  },

  /* ---------- 手感参数（§7.4） ---------- */
  feel: {
    dasMs: 133,           // DAS：按住到自动横移延迟
    arrMs: 33,            // ARR：自动横移间隔
    lockDelayMs: 500,     // 锁定延迟
    moveResetLimit: 15,   // Move Reset 上限
    clearAnimMs: 250,     // 消行动画时长（= ARE，动画结束立即出块）
  },

  /* ---------- 速度曲线（§7.3，行/秒）：索引 = 等级-1，19 级起 20G 封顶 ---------- */
  gravityRowsPerSec: [
    0.5, 0.8, 1.2, 1.8, 2.4, 3.0, 4.5, 6.0, 8.0, 10,
    12, 16, 22, 30, 60, 120, 300, 600, 1200,
  ],
  gravityCap: 1200,       // 20G = 1200 行/秒 = 20 格/帧（仅 19 级及以上）

  /* ---------- 软降（§7.4，唯一口径） ---------- */
  softDrop: {
    baseRowsPerSec: 40,   // 1–4 级：40 行/秒（高于重力）
    gravityMul: 20,       // 5–14 级：20 × 当前重力速度
    capRowsPerSec: 1200,  // 15 级及以上：1200 行/秒 = 20G 封顶
  },

  /* ---------- 计分（§7.1） ---------- */
  score: {
    // 表 A：消行基础分（× 等级，进 Combo/B2B 乘区）
    lineBase: {
      single: 100, double: 300, triple: 500, tetris: 800,
      tspinMiniSingle: 200, tspinSingle: 800, tspinDouble: 1200, tspinTriple: 1600,
    },
    // 表 B：0 行落块奖励（× 等级，直接加分不进乘区）
    lockBonus: {
      tspin: 400,       // T-Spin（Full，0 行）
      tspinMini: 100,   // T-Spin Mini（0 行）
    },
    // 表 C：固定加分（不进乘区）
    softDropPerCell: 1,
    hardDropPerCell: 2,
    perfectClear: 1000, // × 等级，乘区之后直接加
  },

  /* ---------- Combo 乘区（§7.2，n 从 1 起；≥10 封顶 3.0） ---------- */
  comboMultiplier: [1.0, 1.2, 1.4, 1.6, 1.8, 2.1, 2.3, 2.5, 2.7, 3.0],
  /* ---------- B2B 乘区（§5.6：自连续第 2 次有效动作起 ×1.5，恒定） ---------- */
  b2bMultiplier: 1.5,

  /* ---------- 等级推进（§6.1）：每消 10 行 +1，结算完成后生效 ---------- */
  linesPerLevel: 10,
  levelPulseMs: 300,      // 升级全屏色彩脉冲时长

  /* ---------- 音乐节拍（§7.6） ---------- */
  bpm: {
    base: 128,            // BPM(等级) = 128 + 4 × (等级 − 1)
    stepPerLevel: 4,
    capLevel: 19,         // 19 级起封顶 200
    capValue: 200,
    snapGridDiv: 4,       // 1/4 拍网格 = 15/BPM 秒
    snapThresholdMs: 50,  // ±50ms 内吸附
    rateRampMs: 300,      // BPM 切换渐变时长（对齐下一拍点）
    layerFadeMs: 400,     // 分层淡入淡出
  },

  /* ---------- 反馈（§8.2 / §8.3） ---------- */
  feedback: {
    // 震屏表（02-animation-design §5）：[幅度px, 时长ms]
    shake: {
      line1: [2, 100], line2: [3, 110], line3: [4.5, 120], line4: [6, 120],
      hardDrop: [1.5, 70], record: [5, 300], tspin: [4, 110],
    },
    shakeReboundPx: 1.5,      // 高档：Tetris 二次回弹
    dangerHeight: 16,         // 危险预警：堆叠高度 ≥16
    dangerClearHeight: 12,    // 解除：<12（滞回区间 12–16 防抖）
    comboCaption: { mid: 48, big: 72, step: 4, max: 120 }, // 字号 @1080p
    recordFxMs: 300,          // 破纪录全屏特效硬上限
    recordCaptionMs: 900,
    pipSeconds: 3,            // 画中画回放：最后 3 秒
    pipSpeed: 0.5,            // 慢镜头 0.5×
    resultLockMs: 3000,       // 结算页防误触锁定期
    particleLimit: 800,       // 粒子上限
  },

  /* ---------- 结算（§2.3） ---------- */
  result: {
    // 分数型：Marathon / Ultra / Daily；时间型：Sprint
    sprintGoalLines: 40,      // Sprint：消 40 行（最高 5 级）
    ultraSeconds: 120,        // Ultra：2 分钟
    marathonClearLevel: 15,   // 通关 = 达到 15 级（= 累计 140 行）
  },

  /* ---------- 每日挑战（§6.3） ---------- */
  daily: {
    seedPrefix: 'daily-',     // s = "daily-" + YYYY-MM-DD（UTC）
    fnvOffset: 0x811C9DC5,
    fnvPrime: 0x01000193,
  },
};
