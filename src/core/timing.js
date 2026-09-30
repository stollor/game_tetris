/**
 * NEON PULSE — 主循环帧时钟（framework §8.4：暂停 = 时间静止）
 * 游戏时间唯一来源 = 音频时钟（暂停 = AudioContext.suspend 冻结 → 一切时钟停走）。
 * 但音频时钟有量化粒度（约 2.7–10ms 才推进一次），高刷新率（120/144Hz）下
 * 会出现「音频增量 = 0」的帧。若把这些帧统一兜底成 1/60 秒，
 * 游戏速度会随刷新率漂移（120Hz≈2×、144Hz≈2.4×）——因此：
 *   · 音频增量 (0, 0.25s] → 原样使用（Σdt 与墙钟一致，平均速度恒定）；
 *   · 音频增量 ≤ 0（时钟未推进 / 已冻结）→ 0：该帧时间不走，等时钟推进再补上，
 *     不虚增时间（冻结即时间静止，正合 §8.4）；
 *   · 音频增量 > 0.25s（休眠 / 切后台大跳）→ 1/60 保护，不吃掉大段游戏时间。
 */
(function (global) {
  'use strict';

  /**
   * 把「音频时钟增量」换算成本帧游戏时间（秒）。
   * @param {number} audioDtSec 音频时钟增量（秒）
   * @returns {number} 本帧游戏时间（秒），永不为负 / NaN
   */
  function frameDtSec(audioDtSec) {
    if (!(audioDtSec > 0)) return 0;              // 量化零增量 / 冻结 / 异常值：本帧时间不走
    return audioDtSec > 0.25 ? 1 / 60 : audioDtSec;
  }

  global.NP = global.NP || {};
  global.NP.timing = { frameDtSec };
})(window);
