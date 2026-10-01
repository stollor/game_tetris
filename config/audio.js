/**
 * NEON PULSE — 音频配置（04-audio-fx/docs/01-audio-design.md §2/§3/§4/§5，唯一口径）
 * 总线：BGM 0.75 / SFX 0.85（SFX-UI 0.7、SFX-Game 0.9 子总线）/ 主音量。
 * 预缩放契约：stems 增益 1.0 求和 = 全量混音；引擎只做增减/淡化，不整体再乘增益。
 */
window.NP_CONFIG = window.NP_CONFIG || {};
window.NP_CONFIG.audio = {
  bus: { master: 1.0, bgm: 0.75, sfx: 0.85, sfxUi: 0.7, sfxGame: 0.9 },
  bgmCrossfadeMs: 300,
  duckOnRecord: false,          // 压闪默认关（避免吃掉踩拍感）

  /* ---------- SFX 清单（42 个）：bus = ui | game | mixed ---------- */
  sfx: {
    'ui-hover':          { bus: 'ui',   maxInstances: 2 },
    'ui-move':           { bus: 'ui',   maxInstances: 2 },
    'ui-confirm':        { bus: 'ui',   maxInstances: 2 },
    'ui-cancel':         { bus: 'ui',   maxInstances: 2 },
    'ui-error':          { bus: 'ui',   maxInstances: 2 },
    'ui-count-beep':     { bus: 'ui',   maxInstances: 2 },
    'ui-count-go':       { bus: 'ui',   maxInstances: 2 },
    'ui-pause-in':       { bus: 'ui',   maxInstances: 2 },
    'ui-pause-out':      { bus: 'ui',   maxInstances: 2 },
    'ui-result-tick':    { bus: 'ui',   maxInstances: 1, throttleMs: 60 },
    'piece-move':        { bus: 'game', maxInstances: 4, throttleMs: 33 },
    'piece-rotate':      { bus: 'game', maxInstances: 4 },
    'piece-rotate-180':  { bus: 'game', maxInstances: 4 },
    'piece-rotate-fail': { bus: 'game', maxInstances: 2, throttleMs: 80 },
    'piece-softdrop-tick': { bus: 'game', maxInstances: 2, throttleMs: 30 },
    'piece-hard-drop':   { bus: 'game', maxInstances: 4, snap: true },
    'piece-lock':        { bus: 'game', maxInstances: 4 },
    'piece-spawn':       { bus: 'game', maxInstances: 2 },
    'hold-swap':         { bus: 'game', maxInstances: 2 },
    'line-clear-1':      { bus: 'game', maxInstances: 2, snap: true },
    'line-clear-2':      { bus: 'game', maxInstances: 2, snap: true },
    'line-clear-3':      { bus: 'game', maxInstances: 2, snap: true },
    'line-clear-4':      { bus: 'game', maxInstances: 2, snap: true },
    'combo-hit':         { bus: 'game', maxInstances: 3 },
    'combo-rise-1':      { bus: 'game', maxInstances: 3 },
    'combo-rise-2':      { bus: 'game', maxInstances: 3 },
    'combo-rise-3':      { bus: 'game', maxInstances: 3 },
    'combo-rise-4':      { bus: 'game', maxInstances: 3 },
    'combo-ring':        { bus: 'game', maxInstances: 3 },
    'tspin':             { bus: 'game', maxInstances: 2 },
    'tspin-mini':        { bus: 'game', maxInstances: 2 },
    'perfect-clear':     { bus: 'game', maxInstances: 1 },
    'b2b-on':            { bus: 'game', maxInstances: 2 },
    'b2b-continue':      { bus: 'game', maxInstances: 2 },
    'level-up':          { bus: 'game', maxInstances: 2 },
    'danger-warn':       { bus: 'game', maxInstances: 1, throttleMs: 2000 },
    'danger-clear':      { bus: 'game', maxInstances: 1, throttleMs: 2000 },
    'new-record':        { bus: 'game', maxInstances: 1 },
    'game-over':         { bus: 'game', maxInstances: 1 },
    'sprint-finish':     { bus: 'game', maxInstances: 1 },
    'ultra-end':         { bus: 'game', maxInstances: 1 },
    'unlock':            { bus: 'mixed', maxInstances: 1 },
  },

  /* ---------- Combo 升调表（§4，唯一口径） ---------- */
  comboSfx: {
    2: { name: 'combo-hit', semitone: 0 },
    3: { name: 'combo-hit', semitone: 0 },
    4: { name: 'combo-rise-1', semitone: 2 },
    5: { name: 'combo-rise-2', semitone: 4 },
    6: { name: 'combo-rise-3', semitone: 6 },
    // n ≥7：combo-rise-4 + playbackRate = 2^((n−7)/12)，封顶 +12 半音（n=19 起）
  },
  /* n ≥7 唯一口径（§4）：semitone = (n − startCombo) × stepPerCombo = n − 7（每级 +1 半音），
     capSemitone 封顶 +12 半音，n = 19 起不再升（防刺耳） */
  comboHigh: { name: 'combo-rise-4', startCombo: 7, stepPerCombo: 1, capSemitone: 12 },

  /* ---------- BGM 主曲 8 分层 stems（128 BPM、15.000s 无缝） ---------- */
  stems: {
    kick:  'assets/audio/music/bgm_main_stem_kick.mp3',
    snare: 'assets/audio/music/bgm_main_stem_snare.mp3',
    hat:   'assets/audio/music/bgm_main_stem_hat.mp3',
    perc:  'assets/audio/music/bgm_main_stem_perc.mp3',
    bass:  'assets/audio/music/bgm_main_stem_bass.mp3',
    arp:   'assets/audio/music/bgm_main_stem_arp.mp3',
    pad:   'assets/audio/music/bgm_main_stem_pad.mp3',
    lead:  'assets/audio/music/bgm_main_stem_lead.mp3',
  },
  /* 等级段分层增益（§5.2）：1–5 主歌 / 6–10 副歌 / 11+ 高速 */
  stemProfiles: {
    verse:   { kick: 0.55, hat: 1, bass: 1, pad: 1, snare: 0, arp: 0, lead: 0, perc: 0 },
    chorus:  { kick: 1, hat: 1, bass: 1, pad: 1, snare: 1, arp: 1, lead: 1, perc: 0 },
    high:    { kick: 1, hat: 1, bass: 1, pad: 0.8, snare: 1, arp: 1, lead: 0.8, perc: 1 },
  },
  stemLevelSwitch: { chorusFromLevel: 6, highFromLevel: 11 },

  /* ---------- 其他曲目 ---------- */
  tracks: {
    menu:       'assets/audio/music/bgm_menu.mp3',          // 100 BPM 循环
    result:     'assets/audio/music/bgm_result.mp3',        // 90 BPM 循环
    heartbeat:  'assets/audio/music/bgm_layer_heartbeat.mp3', // 危险心跳低频层
    alt_neon_rain: 'assets/audio/music/bgm_alt_neon_rain.mp3',
    alt_eclipse:   'assets/audio/music/bgm_alt_eclipse.mp3',
  },
  heartbeat: { fadeInMs: 2000, fadeOutMs: 1000, volume: 0.45 },
  resultVolume: 0.8,
  menuVolume: 0.85,
};
