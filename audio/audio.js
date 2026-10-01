/**
 * NEON PULSE — 音频引擎（04-audio-fx/docs/01-audio-design.md）
 * - 总线：master → (BGM | SFX→(SFX-UI | SFX-Game))，默认音量见 config/audio.js
 * - BGM 主曲 8 分层 stems：预缩放契约（增益 1.0 求和 = 全量混音），引擎只做增减/淡化
 * - 变速：playbackRate = BPM(等级)/128（简单变速，允许升调 ≤5.6 半音，8 stems 同步同倍率）；
 *   切换对齐下一拍点后在 rateRampMs（300ms）内分步线性渐变（framework §7.6，禁止瞬间跳变爆音）
 * - 踩拍吸附：消行/硬降音效 ±50ms 内吸附到 1/4 拍网格（只调音频时刻，不影响判定/输入）
 * - 暂停 = AudioContext.suspend() + 暂停所有 BGM 元素：节拍时钟 / BGM 同帧冻结（§8.4）
 * 时间源：ctx.currentTime（音频时钟），随暂停冻结。
 */
(function (global) {
  'use strict';

  const ACfg = () => global.NP_CONFIG.audio;
  const BCfg = () => global.NP_CONFIG.balance.bpm;   // BPM/踩拍参数在 balance（§7.6 唯一来源）

  const state = {
    ctx: null,
    master: null, bgmBus: null, sfxBus: null, sfxUiBus: null, sfxGameBus: null,
    elCache: {},          // url -> HTMLAudioElement（单例，BGM 用）
    sfxPools: {},         // name -> [elements]
    sfxLast: {},          // name -> 上次播放时刻（节流）
    stems: {},            // name -> { el, gain }
    stemProfile: 'verse',
    gameBgmMode: null,    // 'stems' | 'track:<id>' | null
    trackGain: null,      // 解锁曲等单文件 BGM 的增益节点
    heartbeatGain: null,
    heartbeatOn: false,
    beatPos: 0,           // 拍位置（随音频时钟推进）
    bpm: 128,
    rate: 1,              // 当前 BGM playbackRate（= BPM/128；渐变期间为中间值）
    muted: false,
    volumes: { master: 1, bgm: 0.75, sfx: 0.85, sfxUi: 0.7, sfxGame: 0.9 },
    lastSnapMs: 0,
    suspended: false,     // 暂停意图标记：冻结期间 unlock 等不得解冻（§8.4 时间静止）
    ready: false,
  };

  /* ==================== 初始化 ==================== */
  function init() {
    if (state.ready) return;
    const AC = global.AudioContext || global.webkitAudioContext;
    try {
      state.ctx = new AC({ latencyHint: 'interactive' });
      const ctx = state.ctx;
      state.master = ctx.createGain();
      // 主总线软限幅（压限器）：多个 0.88 档音效/消行叠加瞬间峰值可达 ~1.6，
      // 不加限幅会在 DAC 处硬削波（音频设定 §2「不削波」）。压限器延迟可忽略。
      state.limiter = ctx.createDynamicsCompressor();
      state.limiter.threshold.value = -3;   // 超过 -3dBFS 开始压
      state.limiter.knee.value = 6;
      state.limiter.ratio.value = 12;
      state.limiter.attack.value = 0.0015;
      state.limiter.release.value = 0.18;
      // 软削波安全网（WaveShaper）：压限器存在瞬态穿透（attack 窗口），
      // 多音效叠加瞬时峰值仍可能 >1.0；软削波曲线在 ≤0.7 线性透明、
      // 0.7 以上渐近逼近 1.0，保证输出永不硬削波（音频设定 §2「不削波」）。
      state.shaper = ctx.createWaveShaper();
      const N = 2048, curve = new Float32Array(N);
      for (let i = 0; i < N; i++) {
        const x = (i / (N - 1)) * 2 - 1;
        const a = Math.abs(x);
        const y = a <= 0.7 ? a : 0.7 + 0.3 * Math.tanh((a - 0.7) / 0.3);
        curve[i] = x < 0 ? -y : y;
      }
      state.shaper.curve = curve;
      state.shaper.oversample = '2x';
      state.master.connect(state.limiter);
      state.limiter.connect(state.shaper);
      state.shaper.connect(ctx.destination);
      state.bgmBus = ctx.createGain();
      state.bgmBus.connect(state.master);
      state.sfxBus = ctx.createGain();
      state.sfxBus.connect(state.master);
      state.sfxUiBus = ctx.createGain();
      state.sfxUiBus.connect(state.sfxBus);
      state.sfxGameBus = ctx.createGain();
      state.sfxGameBus.connect(state.sfxBus);
      applyVolumes();
    } catch (e) {
      console.warn('[audio] Web Audio 不可用，降级为纯元素播放', e);
      state.ctx = null;
    }
    // 预建 SFX 池（≤ maxInstances 实例，同名重复触发允许叠加）
    const sfxCfg = ACfg().sfx;
    for (const name of Object.keys(sfxCfg)) {
      const max = sfxCfg[name].maxInstances || 2;
      const pool = [];
      for (let i = 0; i < max; i++) {
        const el = new Audio(`assets/audio/sfx/${name}.mp3`);
        el.preload = 'auto';
        pool.push({ el, gain: connectElement(el, 'sfx', sfxCfg[name].bus) });
      }
      state.sfxPools[name] = { pool, idx: 0 };
    }
    state.ready = true;
  }

  /** 元素接入总线（返回增益节点；无 Web Audio 时返回 null）
   * file:// 协议下必须降级：媒体元素被 CORS 污染，经 WebAudio 输出会被强制静音
   * （play() 成功但听不到任何声音）。此时不劫持元素，走直放 + el.volume 增益等效。 */
  function connectElement(el, kind, sub) {
    el._npKind = kind;
    el._npSub = sub;
    el._npVol = el._npVol ?? 1;
    if (!state.ctx || location.protocol === 'file:') return null;
    try {
      const src = state.ctx.createMediaElementSource(el);
      const gain = state.ctx.createGain();
      src.connect(gain);
      if (kind === 'sfx') {
        gain.connect(sub === 'ui' ? state.sfxUiBus : sub === 'game' ? state.sfxGameBus : state.sfxBus);
      } else {
        gain.connect(state.bgmBus);
      }
      return gain;
    } catch (e) {
      return null;
    }
  }

  /** 直放模式下的等效增益：el.volume = 总线音量 × 曲目增益 */
  function elVolumeFor(el) {
    const v = state.volumes;
    const kindVol = el._npKind === 'sfx' ? v.sfx * (el._npSub === 'ui' ? v.sfxUi : el._npSub === 'game' ? v.sfxGame : 1) : v.bgm;
    return Math.max(0, Math.min(1, (state.muted ? 0 : 1) * v.master * kindVol * (el._npVol ?? 1)));
  }

  /** 设置增益：有 WebAudio 节点走节点；否则直放模式用 el.volume 等效 */
  function setElGain(el, gain, value) {
    el._npVol = value;
    if (gain) gain.gain.value = value;
    else el.volume = elVolumeFor(el);
  }

  /** 增益渐变：有节点走 audioParam ramp；直放模式用定时器步进（同一元素只允许一条渐变在途） */
  function rampElGain(el, gain, target, ms) {
    if (el && el._npRampTimer) { clearInterval(el._npRampTimer); el._npRampTimer = null; }
    if (gain && state.ctx) {
      const t = state.ctx.currentTime;
      gain.gain.cancelScheduledValues(t);
      gain.gain.setValueAtTime(gain.gain.value, t);
      gain.gain.linearRampToValueAtTime(target, t + (ms || 400) / 1000);
      return;
    }
    const from = el._npVol ?? 1;
    const steps = 8;
    let i = 0;
    el._npRampTimer = setInterval(() => {
      i++;
      setElGain(el, null, from + (target - from) * (i / steps));
      if (i >= steps) { clearInterval(el._npRampTimer); el._npRampTimer = null; }
    }, Math.max(10, (ms || 400) / steps));
  }

  /**
   * 取消元素上未决的「淡出后暂停」定时器与直放渐变定时器。
   * 快速重开 / 复用同一缓存元素重新开层前必须先取消：否则旧淡出链路的 setTimeout
   * 会在新曲播放后 ~340ms 把它误暂停（重开后对局 BGM 全程死亡），
   * 旧渐变 interval 会把刚开层的音量踩回 0（file:// 直放竞态）。
   */
  function cancelPendingFade(el) {
    if (!el) return;
    if (el._npStopTimer) { clearTimeout(el._npStopTimer); el._npStopTimer = null; }
    if (el._npRampTimer) { clearInterval(el._npRampTimer); el._npRampTimer = null; }
  }

  /** 音量/静音变更后重算所有直放元素的音量 */
  function refreshElVolumes() {
    for (const p of Object.values(state.sfxPools)) for (const item of p.pool) if (!item.gain) item.el.volume = elVolumeFor(item.el);
    for (const el of Object.values(state.elCache)) if (!el._npGain) el.volume = elVolumeFor(el);
    for (const s of Object.values(state.stems)) if (!s.gain) s.el.volume = elVolumeFor(s.el);
    if (state.trackGain?.el && !state.trackGain.el._npGain) state.trackGain.el.volume = elVolumeFor(state.trackGain.el);
  }

  function applyVolumes() {
    const v = state.volumes;
    const set = (node, val) => { if (node) node.gain.value = state.muted ? 0 : val; };
    set(state.master, v.master);
    set(state.bgmBus, v.bgm);
    set(state.sfxBus, v.sfx);
    set(state.sfxUiBus, v.sfxUi);
    set(state.sfxGameBus, v.sfxGame);
    refreshElVolumes();   // 直放模式（file://）下元素音量等效重算
  }

  function setVolume(name, val) {
    state.volumes[name] = val;
    applyVolumes();
  }
  function setMuted(m) { state.muted = m; applyVolumes(); }

  /** 用户手势解锁（Chrome 自动播放策略）；暂停冻结期间不得解冻（§8.4 时间静止） */
  function unlock() {
    if (state.suspended) return;
    if (state.ctx && state.ctx.state === 'suspended') state.ctx.resume();
  }

  /* ==================== 时钟（音频时钟；暂停 = 冻结） ==================== */
  function now() {
    return state.ctx ? state.ctx.currentTime : performance.now() / 1000;
  }
  async function suspend() {
    if (!state.ctx) return;
    state.suspended = true;                 // 同步置标，避免同事件内 unlock 竞态解冻
    pauseAllElements(true);
    try { await state.ctx.suspend(); } catch (e) { /* ignore */ }
  }
  async function resume() {
    state.suspended = false;
    if (!state.ctx) { pauseAllElements(false); return; }
    try { await state.ctx.resume(); } catch (e) { /* ignore */ }
    pauseAllElements(false);
  }
  function pauseAllElements(pause) {
    // 只冻结 BGM 元素（stems / 曲目）；SFX 允许自然衰减，不回卷（音频设定 §7）
    const all = [];
    for (const k of Object.keys(state.elCache)) all.push(state.elCache[k]);
    for (const k of Object.keys(state.stems)) all.push(state.stems[k].el);
    for (const el of all) {
      if (pause) { if (!el.paused) { el.dataset.keep = '1'; el.pause(); } }
      else if (el.dataset.keep === '1') {
        el.dataset.keep = '';
        cancelPendingFade(el);                 // 恢复的是「暂停前就在播」的曲子，旧淡出定时器不得再误停
        el.play().catch(() => {});
      }
    }
  }

  /* ==================== 节拍时钟（§7.6） ==================== */
  /* BPM 变速任务：rateJob 等待下一拍点，rateRamp 执行 300ms 分步渐变（音频设定 §5.3 规则 3） */
  let rateJob = null;    // { atBeat, targetBpm, targetRate }
  let rateRamp = null;   // { from, to, t0 }

  function updateBeat(dtMs) {
    if (dtMs > 0) state.beatPos += (state.bpm / 60) * (dtMs / 1000);
    stepRateJob();
  }

  /**
   * BPM 变速任务推进（由 updateBeat 驱动；暂停时主循环不调用 updateBeat → 任务自动顺延）：
   * 1) 对齐下一拍点：beatPos 跨过下一整拍才切换（framework §7.6）
   * 2) 300ms 分步线性渐变：逐帧微调 playbackRate，禁止瞬间跳变爆音（音频设定 §5.3）
   * 渐变进度取音频时钟，暂停时钟冻结 → 渐变同样冻结，恢复后从冻结值原样继续。
   */
  function stepRateJob() {
    if (rateRamp) {
      const ms = BCfg().rateRampMs || 300;
      const k = Math.max(0, Math.min(1, (now() - rateRamp.t0) / (ms / 1000)));
      applyRate(rateRamp.from + (rateRamp.to - rateRamp.from) * k);
      if (k >= 1) rateRamp = null;
    }
    if (rateJob && state.beatPos >= rateJob.atBeat - 1e-9) {
      const b = BCfg();
      rateRamp = { from: state.rate, to: rateJob.targetRate, t0: now() };
      state.bpm = rateJob.targetBpm;
      // 等级段分层同时在拍点切换（400ms 淡化，见 layerFadeMs）
      if (state.gameBgmMode === 'stems') {
        const p = profileForLevel(currentLevel);
        if (p !== state.stemProfile) applyStemProfile(p, b.layerFadeMs);
      }
      rateJob = null;
    }
  }

  function setBpm(bpm) {
    state.bpm = bpm;
    state.rate = bpm / BCfg().base;
    rateJob = null; rateRamp = null;   // 新节拍基准：丢弃未完成的变速任务
  }
  function beatInfo() {
    const grid = 15 / state.bpm;                       // 1/4 拍网格（秒）
    const t = state.beatPos;
    return {
      bpm: state.bpm,
      beat: t,
      bar: Math.floor(t / 4) % 8,
      onDownbeat: (t % 4) < (state.bpm / 60) * 0.0167 * 2,
      gridSec: grid,
    };
  }

  /**
   * 踩拍吸附：原始触发时刻与最近 1/4 拍网格距离 ≤50ms 时吸附到网格点播放。
   * 只调整音频播放时刻，不影响判定与输入响应。
   */
  function snappedDelayMs() {
    const grid = 15 / state.bpm;
    const t = state.beatPos;
    const dev = (Math.round(t / grid) * grid - t) * 1000;   // ms，可正可负
    state.lastSnapMs = dev;
    return Math.abs(dev) <= BCfg().snapThresholdMs && dev > 0 ? dev : 0;
  }

  /* ==================== SFX ==================== */
  function playSfx(name, opts) {
    init();   // 自愈：保证 SFX 池与总线就绪（即使首个音效早于首次手势）
    opts = opts || {};
    const cfg = ACfg().sfx[name];
    const poolInfo = state.sfxPools[name];
    if (!cfg || !poolInfo) return;
    const t = now();
    if (cfg.throttleMs && state.sfxLast[name] && (t - state.sfxLast[name]) * 1000 < cfg.throttleMs) return;
    state.sfxLast[name] = t;

    let delay = opts.delayMs || 0;
    if (cfg.snap && !opts.noSnap) delay += snappedDelayMs();

    const play = () => {
      const { pool } = poolInfo;
      let item = pool[poolInfo.idx];
      poolInfo.idx = (poolInfo.idx + 1) % pool.length;
      try {
        item.el.currentTime = 0;
        item.el.playbackRate = opts.semitone ? Math.pow(2, opts.semitone / 12) : 1;
        if (item.gain && opts.volume != null) item.gain.gain.value = opts.volume;
        else if (!item.gain) { item.el._npVol = opts.volume ?? 1; item.el.volume = elVolumeFor(item.el); }
        item.el.play().catch(() => {});
      } catch (e) { /* ignore */ }
    };
    if (delay > 0) setTimeout(play, delay);
    else play();
  }

  /* ==================== BGM ==================== */
  function getLoopEl(url, loop) {
    if (!state.elCache[url]) {
      const el = new Audio(url);
      el.preload = 'auto';
      el.loop = loop !== false;
      state.elCache[url] = el;
    }
    return state.elCache[url];
  }

  /** 主曲 8 分层 stems（对局 BGM） */
  function startStems() {
    init();   // 自愈：即使 BGM 早于首次手势/未 init 启动，也保证总线与降级路径就绪
    const cfg = ACfg();
    stopGameBgm();
    state.gameBgmMode = 'stems';
    for (const name of Object.keys(cfg.stems)) {
      const el = getLoopEl(cfg.stems[name], true);
      cancelPendingFade(el);   // 快速重开：作废旧淡出链路的暂停/渐变定时器，本层立即重生
      const gain = el._npGain || connectElement(el, 'bgm');
      el._npGain = gain;
      if (gain) gain.gain.value = 0;
      else setElGain(el, null, 0);   // 直放模式：初始静音，由 applyStemProfile 开层
      state.rate = state.bpm / BCfg().base;
      el.playbackRate = state.rate;
      el.currentTime = 0;
      el.play().catch(() => {});
      state.stems[name] = { el, gain };
    }
    applyStemProfile(profileForLevel(currentLevel), 0.4);
  }

  let currentLevel = 1;
  function profileForLevel(level) {
    const sw = ACfg().stemLevelSwitch;
    if (level >= sw.highFromLevel) return 'high';
    if (level >= sw.chorusFromLevel) return 'chorus';
    return 'verse';
  }

  /** 等级段分层：400ms 淡化（切换时机对齐下一小节第 1 拍由主循环调用） */
  function applyStemProfile(profile, fadeMs) {
    const gains = ACfg().stemProfiles[profile];
    // 注意：守卫只看 gains，不得依赖 state.ctx——
    // 直放模式（file:// 或 ctx 未就绪）必须走 el.volume 降级分支，
    // 否则 stems 增益永远停在 0 = BGM 静音（“play 成功但无声”）。
    if (!gains) return;
    state.stemProfile = profile;
    for (const name of Object.keys(state.stems)) {
      const { el, gain } = state.stems[name];
      const target = gains[name] || 0;
      if (gain) {
        const t = state.ctx.currentTime;
        gain.gain.cancelScheduledValues(t);
        gain.gain.setValueAtTime(gain.gain.value, t);
        gain.gain.linearRampToValueAtTime(target, t + (fadeMs || 400) / 1000);
      } else {
        rampElGain(el, null, target, fadeMs || 400);   // 直放模式降级
      }
    }
  }

  /** BPM 变速：playbackRate = BPM/128（简单变速，8 stems 同步同倍率）；渐变期间逐帧分步调用 */
  function applyRate(rate) {
    state.rate = rate;
    for (const name of Object.keys(state.stems)) {
      state.stems[name].el.playbackRate = rate;
    }
    if (state.trackGain && state.trackGain.el) state.trackGain.el.playbackRate = rate;
  }

  /**
   * 等级变化：分层 + 变速（framework §7.6 / 音频设定 §5.3）
   * - 切换对齐下一拍点：beatPos 跨过下一整拍才生效（暂停期间自动顺延，不丢任务）
   * - playbackRate 在 rateRampMs（300ms）内分步线性渐变，禁止瞬间跳变爆音
   */
  function onLevel(level) {
    currentLevel = level;
    const b = BCfg();
    const targetBpm = Math.min(b.base + b.stepPerLevel * (level - 1), b.capValue);
    rateJob = {
      atBeat: Math.ceil(state.beatPos - 1e-9),   // 下一拍点（1 拍 = 60/BPM 秒）
      targetBpm,
      targetRate: targetBpm / b.base,
    };
  }

  /** 单文件曲目（菜单 / 结算 / 解锁曲），300ms 交叉淡化 */
  function playTrack(url, volume, loop) {
    init();   // 自愈：与 startStems 同理，防止降级分支缺总线/时序不齐
    const el = getLoopEl(url, loop !== false);
    cancelPendingFade(el);   // 复用元素重新开层（菜单/结算曲重播）同样不得被旧淡出定时器误停
    const gain = el._npGain || connectElement(el, 'bgm');
    el._npGain = gain;
    if (gain && state.ctx) {
      const t = state.ctx.currentTime;
      gain.gain.cancelScheduledValues(t);
      gain.gain.setValueAtTime(gain.gain.value, t);
      gain.gain.linearRampToValueAtTime(volume, t + ACfg().bgmCrossfadeMs / 1000);
    } else if (el.volume != null) {
      setElGain(el, null, volume);   // 直放模式：等效增益（含总线音量）
    }
    el.currentTime = el.currentTime || 0;
    el.play().catch(() => {});
    return el;
  }

  function fadeOutEl(el, ms) {
    if (!el) return;
    cancelPendingFade(el);                 // 以本次淡出为准，旧的暂停/渐变定时器全部作废
    const dur = ms || 300;
    if (el._npGain && state.ctx) {
      const t = state.ctx.currentTime;
      el._npGain.gain.cancelScheduledValues(t);
      el._npGain.gain.setValueAtTime(el._npGain.gain.value, t);
      el._npGain.gain.linearRampToValueAtTime(0, t + dur / 1000);
    } else {
      rampElGain(el, null, 0, dur);   // 直放模式淡出
    }
    // 淡出完成后暂停；句柄挂在元素上，复用元素重开时由 cancelPendingFade 取消
    el._npStopTimer = setTimeout(() => { el._npStopTimer = null; el.pause(); }, dur + 40);
  }

  function stopGameBgm() {
    rateJob = null; rateRamp = null;   // 丢弃变速任务，避免旧任务作用到下一首 BGM
    for (const name of Object.keys(state.stems)) fadeOutEl(state.stems[name].el, 300);
    state.stems = {};
    if (state.trackGain && state.trackGain.el) { fadeOutEl(state.trackGain.el, 300); state.trackGain = null; }
    state.gameBgmMode = null;
    setHeartbeat(false);
  }

  function startGameBgm(musicId) {
    stopGameBgm();
    const cfg = ACfg();
    const isMain = !musicId || musicId === 'main';
    const url = isMain ? null : (cfg.tracks[musicId] || cfg.tracks.alt_neon_rain);
    // 对局 BGM 是唯一节拍来源（framework §7.6 / §9）：进入对局必须停掉菜单/结算曲，禁止叠加播放
    fadeOutAllExcept(isMain ? Object.keys(cfg.stems).map((n) => cfg.stems[n]) : [url]);
    if (isMain) {
      startStems();
    } else {
      const el = playTrack(url, 0.85, true);
      state.rate = state.bpm / BCfg().base;
      el.playbackRate = state.rate;
      state.trackGain = { el };
      state.gameBgmMode = 'track:' + musicId;
    }
  }

  function startMenuBgm() {
    stopGameBgm();
    fadeOutAllExcept([ACfg().tracks.menu]);
    playTrack(ACfg().tracks.menu, ACfg().menuVolume, true);
  }
  function startResultBgm() {
    stopGameBgm();
    fadeOutAllExcept([ACfg().tracks.result]);
    playTrack(ACfg().tracks.result, ACfg().resultVolume, true);
  }
  function fadeOutAllExcept(keepUrls) {
    // 停掉所有正在播放的 BGM 元素（keepUrls 除外）：菜单/结算/解锁曲与对局 BGM 互斥（§9）
    const keep = new Set(keepUrls || []);
    for (const url of Object.keys(state.elCache)) {
      if (keep.has(url)) continue;
      const el = state.elCache[url];
      if (el && !el.paused) fadeOutEl(el, 300);
    }
  }

  /* ==================== 危险心跳低频层（§8.2） ==================== */
  function setHeartbeat(on) {
    const cfg = ACfg();
    if (on === state.heartbeatOn) return;
    state.heartbeatOn = on;
    const el = getLoopEl(cfg.tracks.heartbeat, true);
    cancelPendingFade(el);
    const gain = el._npGain || connectElement(el, 'bgm');
    el._npGain = gain;
    if (on) {
      el.play().catch(() => {});
      if (gain && state.ctx) {
        const t = state.ctx.currentTime;
        gain.gain.cancelScheduledValues(t);
        gain.gain.setValueAtTime(gain.gain.value, t);
        gain.gain.linearRampToValueAtTime(cfg.heartbeat.volume, t + cfg.heartbeat.fadeInMs / 1000);
      } else {
        // 直放模式（file://）：用 el.volume 等效淡入，否则心跳层静音或音量失控
        rampElGain(el, null, cfg.heartbeat.volume, cfg.heartbeat.fadeInMs);
      }
    } else {
      if (gain && state.ctx) {
        const t = state.ctx.currentTime;
        gain.gain.cancelScheduledValues(t);
        gain.gain.setValueAtTime(gain.gain.value, t);
        gain.gain.linearRampToValueAtTime(0, t + cfg.heartbeat.fadeOutMs / 1000);
        el._npStopTimer = setTimeout(() => { el._npStopTimer = null; el.pause(); }, cfg.heartbeat.fadeOutMs + 60);
      } else {
        el.pause();
      }
    }
  }

  global.NP = global.NP || {};
  global.NP.audio = {
    init, unlock, now, suspend, resume,
    setVolume, setMuted,
    updateBeat, setBpm, beatInfo, snappedDelayMs,
    playSfx,
    startGameBgm, stopGameBgm, startMenuBgm, startResultBgm,
    applyStemProfile, applyRate, onLevel, setHeartbeat,
    state,
  };
})(window);
