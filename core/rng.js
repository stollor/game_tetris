/**
 * NEON PULSE — 随机器（framework §6.3）
 * 每日挑战种子：s = "daily-" + YYYY-MM-DD（UTC）→ FNV-1a 32 位 → mulberry32 → 7-bag Fisher–Yates。
 * 本 PRNG 只用于出块序列（含开局首袋），与粒子 / UI 等视觉随机完全隔离。
 */
(function (global) {
  'use strict';

  /* ---------- FNV-1a 32 位哈希（逐字节，纯 ASCII 输入） ---------- */
  function fnv1a32(str, offset, prime) {
    let hash = (offset >>> 0) || 0x811C9DC5;
    const p = (prime >>> 0) || 0x01000193;
    for (let i = 0; i < str.length; i++) {
      const byte = str.charCodeAt(i) & 0xff; // ASCII，UTF-8 逐字节处理
      hash = (hash ^ byte) >>> 0;
      // 32 位无符号乘法（mod 2^32），用 16 位拆分避免 JS 浮点精度丢失
      hash = (Math.imul(hash, p) >>> 0);
    }
    return hash >>> 0;
  }

  /* ---------- mulberry32（跨端逐字节一致的强制约定，见 §6.3） ---------- */
  function mulberry32(seed) {
    let t = seed >>> 0; // 状态变量 t 初值 = seed，跨取数持久保存
    return function next() {
      t = (t + 0x6D2B79F5) >>> 0;
      let r = Math.imul(t ^ (t >>> 15), t | 1) >>> 0;
      r = (r ^ ((r + Math.imul(r ^ (r >>> 7), r | 61)) >>> 0)) >>> 0;
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296; // [0,1)
    };
  }

  /* ---------- 7-bag：每袋以 [I,O,T,S,Z,J,L] 做 Fisher–Yates ---------- */
  const BAG_ORDER = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];

  function makeBagger(rand) {
    let queue = [];
    function fill() {
      const bag = BAG_ORDER.slice();
      for (let i = bag.length - 1; i >= 1; i--) {
        const j = Math.floor(rand() * (i + 1));
        const tmp = bag[i]; bag[i] = bag[j]; bag[j] = tmp;
      }
      queue = queue.concat(bag);
    }
    return {
      next() {
        if (queue.length === 0) fill();
        return queue.shift();
      },
      peek(n) { // Next 预览 ×5
        while (queue.length < n) fill();
        return queue.slice(0, n);
      },
    };
  }

  /* ---------- 种子入口 ---------- */
  function utcDateString(date) {
    const d = date || new Date();
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  /** 每日挑战：固定种子出块序列（任何端逐字节一致） */
  function createDailyBagger() {
    const dateStr = utcDateString();
    const s = 'daily-' + dateStr;
    const seed = fnv1a32(s, 0x811C9DC5, 0x01000193);
    return { bagger: makeBagger(mulberry32(seed)), seed, dateStr };
  }

  /** 普通模式：随机种子（仅出块序列使用） */
  function createRandomBagger() {
    const seed = (Math.random() * 0xffffffff) >>> 0;
    return { bagger: makeBagger(mulberry32(seed)), seed, dateStr: null };
  }

  /** 独立视觉随机（粒子/UI），绝不触碰出块 PRNG */
  function createVisualRand() {
    let s = 0x9e3779b9;
    return function () {
      s = (s + 0x6D2B79F5) >>> 0;
      let r = Math.imul(s ^ (s >>> 15), s | 1) >>> 0;
      r = (r ^ ((r + Math.imul(r ^ (r >>> 7), r | 61)) >>> 0)) >>> 0;
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }

  global.NP = global.NP || {};
  global.NP.rng = {
    fnv1a32, mulberry32, makeBagger,
    createDailyBagger, createRandomBagger, createVisualRand,
    utcDateString,
  };
})(window);
