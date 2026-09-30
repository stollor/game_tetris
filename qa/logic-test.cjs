/**
 * NEON PULSE — 无头逻辑验证（Node 直接运行： node qa/logic-test.cjs）
 * 针对评审意见做回归验证：
 *   ① startGame() 必须统一解冻音频时钟（resume + lastNow 同步）——静态断言；
 *      附带：帧时钟不得随刷新率漂移（高刷屏量化零增量帧不虚增时间）；
 *   ② 软降计分「+1/格、只统计额外下落格数（§7.1 C 唯一口径）」——数值仿真断言；
 *   ③ UI 层消费事件后不分发玩法层 / 暂停层模态判定 / Sprint 破纪录反馈；
 *   ④ 音频 BGM 回归（双协议）：快速重开对局 BGM 存活（§7.6）、对局中仅对局 BGM 在播（§9）、
 *      踩拍吸附 snappedDelayMs（§7.6）——可控定时器 + FakeAudio/FakeAudioContext 驱动真实 src/audio/audio.js。
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.join(__dirname, '..');

/* ---------- 载入游戏代码（window 全局模拟） ---------- */
global.window = global;
for (const f of [
  'config/balance.js',
  'core/rng.js',
  'core/srs.js',
  'core/timing.js',
  'core/game.js',
]) {
  vm.runInThisContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), { filename: f });
}

let pass = 0, fail = 0;
function check(name, ok, detail) {
  if (ok) { pass++; console.log('  ✔ ' + name); }
  else { fail++; console.log('  ✘ ' + name + (detail ? '  → ' + detail : '')); }
}

const BAL = global.NP_CONFIG.balance;
const { Game } = global.NP.game;

const MODE = {
  id: 'marathon', scoreType: 'score', goalLines: null, timeLimitMs: null, clearLevel: 15,
};

/** 把当前方块压到最低点（使其贴地） */
function dropToGround(game) {
  while (game.canPlace(game.active, 0, 1)) game.active.py += 1;
}

/**
 * 运行一件方块：从出块起按 60fps 推进到「贴地帧」为止（不触发锁定延迟结算之外的行为）。
 * 统计：F=总下落格数、S=软降得分、t=空中累计秒数。
 */
function runPieceToGround(level, framesCap) {
  const game = new Game(MODE, { bestScore: 0, bestTimeMs: 0 });
  game.level = level;
  game.cfg = Object.assign({}, BAL, { feel: Object.assign({}, BAL.feel, { lockDelayMs: 1e9 }) });
  game.softHeld = true;

  let F = 0, S = 0, tSec = 0, frames = 0;
  const dtMs = 1000 / 60;
  while (frames++ < framesCap) {
    const y0 = game.active ? game.active.py : 0;
    const s0 = game.score;
    game.update(dtMs);
    if (!game.active || game.phase !== 'falling') break;
    F += game.active.py - y0;
    S += game.score - s0;
    tSec += dtMs / 1000;
    if (game.grounded()) break;      // 贴地即结束统计（贴地后额度作废是预期行为）
  }
  return { game, F, S, tSec };
}

console.log('【① 重开后状态坏死】startGame() 解冻音频时钟');
{
  const src = fs.readFileSync(path.join(ROOT, 'main.js'), 'utf8');
  const m = src.match(/function startGame\(modeId\) \{([\s\S]*?)\n  \}/);
  check('存在 startGame()', !!m);
  const body = m ? m[1] : '';
  const iResume = body.indexOf('global.NP.audio.resume()');
  const iLast = body.indexOf('state.lastNow = global.NP.audio.now()');
  const iNew = body.indexOf('new global.NP.game.Game');
  check('startGame() 开头调用 audio.resume()', iResume >= 0 && iResume < iNew);
  check('startGame() 同步 state.lastNow = audio.now()', iLast >= 0 && iLast < iNew);
  // 所有进入新局的路径均经 startGame（restartGame / retry / startMode / 快速重开）
  check('restartGame 走 startGame()', /restartGame[\s\S]{0,300}?startGame\(state\.modeId\)/.test(src));
  check('retry 走 startGame()', /function retry\(\) \{[\s\S]{0,120}?startGame\(state\.modeId\)/.test(src));
}

console.log('【① 附带】帧时钟：游戏速度不随刷新率漂移');
{
  const { frameDtSec } = global.NP.timing;
  check('音频增量 0（量化/冻结）→ 本帧时间 0，不兜底 1/60', frameDtSec(0) === 0);
  check('音频增量 6ms → 原样使用', Math.abs(frameDtSec(0.006) - 0.006) < 1e-9);
  check('音频增量 2s（休眠大跳）→ 1/60 保护', Math.abs(frameDtSec(2) - 1 / 60) < 1e-9);
  check('负增量（时钟源切换）→ 0', frameDtSec(-1) === 0);

  // 仿真：165Hz 刷新 + 10ms 量化音频时钟跑 1 秒：Σdt 必须 ≈ 墙钟（旧兜底会≈ 2×）
  const frame = 1 / 165;
  let wall = 0, lastClk = 0, sum = 0;
  for (let i = 0; i < 165; i++) {
    wall += frame;
    const clk = Math.floor(wall / 0.01) * 0.01;     // 量化到 10ms 的音频时钟
    sum += frameDtSec(clk - lastClk);
    lastClk = clk;
  }
  check('165Hz + 10ms 量化时钟：Σdt ≈ 墙钟（无漂移）', Math.abs(sum - 1) < 0.02, `Σdt=${sum.toFixed(3)}s`);

  // 冻结时钟（暂停）：时间静止
  let fsum = 0;
  for (let i = 0; i < 120; i++) fsum += frameDtSec(0);
  check('冻结时钟：Σdt = 0（§8.4 时间静止）', fsum === 0);

  const src = fs.readFileSync(path.join(ROOT, 'main.js'), 'utf8');
  check('主循环使用 NP.timing.frameDtSec', /const dtSec = global\.NP\.timing\.frameDtSec\(/.test(src));
}

console.log('【② 软降计分口径】每 1 格额外下落恰计 +1（无 4 格封顶）');
{
  // —— 高速段（12 级：重力 22 行/秒，软降 20×= 440 行/秒），单帧额外下落 5–20 格 ——
  let worstDelta = Infinity;
  let maxFrameGain = 0;
  for (let i = 0; i < 6; i++) {
    const { game, F, S, tSec } = runPieceToGround(12, 600);
    const g = global.NP.game.gravityRowsPerSec(12);
    // 口径恒等式：软降得分 = 额外下落格数 = 总下落 − 重力本应下落（允许 ±2 累积器误差）
    const expected = F - g * tSec;
    worstDelta = Math.min(worstDelta, S - expected);
    check(
      `12级 第${i + 1}件：F=${F} 格，得分 S=${S}，口径期望≈${expected.toFixed(1)}`,
      F >= 8 && Math.abs(S - expected) <= 2 && S >= F - 2,
      `偏差 ${(S - expected).toFixed(2)}（|偏差|须≤2 且 S≥F−2）`,
    );
    void game;
  }
  // 单帧粒度：高速段空中帧下落 ≥5 格时，得分不得被 4 格封顶
  {
    const game = new Game(MODE, { bestScore: 0, bestTimeMs: 0 });
    game.level = 12;
    game.cfg = Object.assign({}, BAL, { feel: Object.assign({}, BAL.feel, { lockDelayMs: 1e9 }) });
    game.softHeld = true;
    const dtMs = 1000 / 60;
    for (let f = 0; f < 600 && game.active && game.phase === 'falling'; f++) {
      const y0 = game.active.py, s0 = game.score;
      game.update(dtMs);
      if (!game.active || game.phase !== 'falling') break;
      const n = game.active.py - y0, gain = game.score - s0;
      if (n >= 5 && !game.grounded()) maxFrameGain = Math.max(maxFrameGain, gain / n);
      if (game.grounded()) break;
    }
    check('高速空中帧：得分/下落格数 ≥ 0.8（旧 4 格封顶时高速帧远低于 0.5）',
      maxFrameGain >= 0.8, `实测比率 ${maxFrameGain.toFixed(2)}`);
  }

  // —— 低速段（5 级：重力 3 行/秒，软降 20×= 60 行/秒）同样满足口径 ——
  for (let i = 0; i < 3; i++) {
    const { F, S, tSec } = runPieceToGround(5, 2000);
    const g = global.NP.game.gravityRowsPerSec(5);
    const expected = F - g * tSec;
    check(`5级 第${i + 1}件：F=${F} 格，S=${S}，期望≈${expected.toFixed(1)}`,
      Math.abs(S - expected) <= 2 && S >= F - 2, `偏差 ${(S - expected).toFixed(2)}`);
  }
}

console.log('【② 附带】贴地不累积额度（防止去掉封顶后多算）');
{
  const game = new Game(MODE, { bestScore: 0, bestTimeMs: 0 });
  game.level = 12;
  game.cfg = Object.assign({}, BAL, { feel: Object.assign({}, BAL.feel, { lockDelayMs: 1e9 }) });
  game.softHeld = true;
  dropToGround(game);
  const dtMs = 1000 / 60;
  for (let i = 0; i < 60; i++) game.update(dtMs);   // 贴地按住软降 1 秒
  check('贴地 60 帧：不得攒出额度', game.softCredit < 1, `softCredit=${game.softCredit.toFixed(2)}`);
  const s0 = game.score;
  game.active.py -= 4;                              // 抬起 4 格（模拟踢墙/移动后腾空）
  game.update(dtMs);
  const gain = game.score - s0;
  const falls = 4;                                  // 抬起 4 格后单帧最多再下落回原位附近
  check('腾空首帧：得分 ≤ 实际额外下落（不背负贴地期间的虚假额度）',
    gain <= falls + 1 && gain <= 8, `单帧得分 ${gain}`);
}

console.log('【③ 评审回归】UI 层消费事件后不分发玩法层 / 暂停层模态判定 / Sprint 破纪录反馈');
{
  // —— ③-1 输入串台：onUiKey 返回 true（事件已消费）后不得再分发给玩法层 ——
  const handlers = {};
  if (typeof global.navigator === 'undefined') {
    Object.defineProperty(global, 'navigator', { value: {}, configurable: true });
  }
  global.requestAnimationFrame = () => 0;                 // 截断手柄轮询递归
  global.addEventListener = (type, fn) => { handlers[type] = fn; };
  vm.runInThisContext(fs.readFileSync(path.join(ROOT, 'config/input.js'), 'utf8'), { filename: 'config/input.js' });
  vm.runInThisContext(fs.readFileSync(path.join(ROOT, 'ui/input.js'), 'utf8'), { filename: 'ui/input.js' });

  const key = (code, repeat) => handlers.keydown({ code, repeat: !!repeat, preventDefault() {} });

  const acts1 = [];
  global.NP.input.init({
    onAction: (name, down) => acts1.push([name, down]),
    onUiKey: () => true,          // 模拟结算页 onUiKey 处理完 retry() 后返回 true
  });
  key('Space');                   // 默认键位 hardDrop（结算页主按钮/重开键）
  key('Enter');                   // 街机预设 pause
  check('UI 层消费（onUiKey→true）：同一 keydown 不得串台成 hardDrop/pause', acts1.length === 0, JSON.stringify(acts1));

  const acts2 = [];
  let uiCalls = 0;
  global.NP.input.init({
    onAction: (name, down) => acts2.push([name, down]),
    onUiKey: () => { uiCalls++; return false; },
  });
  key('Space');
  check('UI 层未消费：照常分发玩法动作', acts2.length === 1 && acts2[0][0] === 'hardDrop', JSON.stringify(acts2));
  key('Space', true);
  check('系统重复按键（repeat）不重复触发离散动作', acts2.length === 1);
  key('ArrowLeft');
  check('每个 keydown 都先过 UI 层再分发玩法层', uiCalls === 3, `uiCalls=${uiCalls}`);
  handlers.keyup({ code: 'ArrowLeft' });
  check('按住型动作松手仍无条件送达（防幽灵移动）',
    JSON.stringify(acts2[acts2.length - 1]) === JSON.stringify(['moveLeft', false]));

  // —— ③-2 同根因第二处：模态判定必须含暂停层，且 Esc 返回不得穿透为 resume ——
  const mainSrc = fs.readFileSync(path.join(ROOT, 'main.js'), 'utf8');
  check('onUiKey 处理完动作后返回 true（消费标记）', /retry\(\);[\s\S]{0,240}?return true;/.test(mainSrc));
  check('onUiKey 的 Esc 返回分支返回 true（不得再当暂停键分发）',
    /return true;[^\n]*\/\/ 同一 Esc 已用于「返回」，不得再当暂停键分发/.test(mainSrc));
  check('modalOpen 纳入 screen-pause / resume-countdown',
    /function modalOpen\(\)[\s\S]{0,300}?'screen-pause', 'resume-countdown'/.test(mainSrc));
  check('暂停键在暂停层保持开关语义（pauseLayerOpen 例外，不破坏 Esc/暂停键继续游戏）',
    /modalOpen\(\) && !pauseLayerOpen\(\)/.test(mainSrc));

  // —— ③-3 Sprint 破纪录：endRun('goal') 且 result.record 时必须补发 record 事件 ——
  const SPRINT = { id: 'sprint', scoreType: 'time', goalLines: 40, timeLimitMs: null, clearLevel: null };
  const runEnd = (elapsedMs, bestTimeMs, reason) => {
    const g = new Game(SPRINT, { bestScore: 0, bestTimeMs });
    g.elapsedMs = elapsedMs;
    const ev = [];
    g.onEvent = (n, d) => ev.push([n, d]);
    g.endRun(reason);
    return ev;
  };
  const evRec = runEnd(50000, 60000, 'goal');
  const iRec = evRec.findIndex(([n]) => n === 'record');
  const iEnd = evRec.findIndex(([n]) => n === 'runend');
  check('Sprint 破纪录：完赛（endRun(goal)）触发 record 事件，且在 runend 前（进入结算瞬间）',
    iRec >= 0 && iRec < iEnd, JSON.stringify(evRec.map(([n]) => n)));
  check('Sprint record 事件带时间型数据（kind=time / timeMs / best）',
    iRec >= 0 && evRec[iRec][1].kind === 'time' && evRec[iRec][1].timeMs === 50000 && evRec[iRec][1].best === 60000);
  check('Sprint 未破纪录（更慢）不触发 record', !runEnd(70000, 60000, 'goal').some(([n]) => n === 'record'));
  check('Sprint 首次完赛（无历史最佳）= 新纪录', runEnd(90000, 0, 'goal').some(([n]) => n === 'record'));
  check('Sprint 未完赛（topout）不判破纪录、不触发 record', !runEnd(50000, 60000, 'topout').some(([n]) => n === 'record'));
  check('Sprint 中途作废（quit）不触发 record', !runEnd(50000, 60000, 'quit').some(([n]) => n === 'record'));

  // 分数型口径不变：仍在「分数超历史最佳的瞬间」触发（锁定结算第 8 步），endRun 不重复补发
  const MARA = { id: 'marathon', scoreType: 'score', goalLines: null, timeLimitMs: null, clearLevel: 15 };
  {
    const g = new Game(MARA, { bestScore: 100, bestTimeMs: 0 });
    g.score = 200;
    const ev = [];
    g.onEvent = (n, d) => ev.push([n, d]);
    g.endRun('topout');
    check('分数型 endRun 不重复补发 record（触发时机仍是超分瞬间）', !ev.some(([n]) => n === 'record'));
  }
}

console.log('【④】音频 BGM 回归（双协议）：快速重开 BGM 存活 / 对局中菜单·结算曲停止 / 踩拍吸附');
{
  /* ---------- 浏览器音频桩：可控定时器 + FakeAudio 元素 + FakeAudioContext ---------- */
  class FakeAudio {
    constructor(url) {
      this.url = url; this.paused = true; this.currentTime = 0;
      this.volume = 1; this.playbackRate = 1; this.loop = false; this.preload = '';
      this.dataset = {};
    }
    play() { this.paused = false; this.plays = (this.plays || 0) + 1; return { catch() {} }; }
    pause() { this.paused = true; this.pauses = (this.pauses || 0) + 1; }
  }
  class FakeParam {
    constructor(v) { this.value = v; }
    cancelScheduledValues() {}
    setValueAtTime(v) { this.value = v; }
    linearRampToValueAtTime(v) { this.value = v; }
  }
  // 通用音频节点：任意属性访问得到 FakeParam（gain / threshold / knee / …），connect 为空操作
  function fakeNode() {
    const base = { connect() {}, disconnect() {} };
    return new Proxy(base, {
      get(t, k) {
        if (k in t) return t[k];
        t[k] = new FakeParam(0);
        return t[k];
      },
      set(t, k, v) { t[k] = v; return true; },
    });
  }
  class FakeAudioContext {
    constructor() { this.currentTime = 0; this.state = 'running'; this.destination = fakeNode(); }
    createGain() { return fakeNode(); }
    createDynamicsCompressor() { return fakeNode(); }
    createWaveShaper() { return fakeNode(); }
    createMediaElementSource() { return fakeNode(); }
    suspend() { this.state = 'suspended'; return Promise.resolve(); }
    resume() { this.state = 'running'; return Promise.resolve(); }
  }

  // 可控定时器：advance(ms) 按序执行到期回调（确定性复现「340ms 后旧定时器误暂停」类竞态）
  let nowMs = 0, timers = [], timerSeq = 1;
  global.setTimeout = (fn, ms) => {
    const id = timerSeq++;
    timers.push({ id, fn, at: nowMs + (ms || 0), every: 0 });
    return id;
  };
  global.setInterval = (fn, ms) => {
    const id = timerSeq++;
    timers.push({ id, fn, at: nowMs + (ms || 0), every: Math.max(1, ms || 0) });
    return id;
  };
  global.clearTimeout = global.clearInterval = (id) => { timers = timers.filter((t) => t.id !== id); };
  function advance(ms) {
    const target = nowMs + ms;
    for (;;) {
      const due = timers.filter((t) => t.at <= target).sort((a, b) => a.at - b.at)[0];
      if (!due) break;
      nowMs = due.at;
      if (due.every) due.at = nowMs + due.every;
      else timers = timers.filter((t) => t !== due);
      if (global.NP && global.NP.audio && global.NP.audio.state && global.NP.audio.state.ctx) {
        global.NP.audio.state.ctx.currentTime = nowMs / 1000;   // 音频时钟随假时钟走
      }
      due.fn();
    }
    nowMs = target;
    if (global.NP && global.NP.audio && global.NP.audio.state && global.NP.audio.state.ctx) {
      global.NP.audio.state.ctx.currentTime = nowMs / 1000;
    }
  }

  const audioSrc = fs.readFileSync(path.join(ROOT, 'audio/audio.js'), 'utf8');
  vm.runInThisContext(fs.readFileSync(path.join(ROOT, 'config/audio.js'), 'utf8'), { filename: 'config/audio.js' });
  const AC = global.NP_CONFIG.audio;

  /** 双协议各跑一遍同一组用例：http:// 走 WebAudio 总线，file:// 走元素直放降级 */
  for (const proto of ['http:', 'file:']) {
    nowMs = 0; timers = []; timerSeq = 1;
    global.location = { protocol: proto };
    global.Audio = FakeAudio;
    global.AudioContext = FakeAudioContext;
    vm.runInThisContext(audioSrc, { filename: 'audio/audio.js' });   // 每协议一份全新模块态
    const A = global.NP.audio;
    const stemEls = () => Object.entries(A.state.elCache).filter(([u]) => u.includes('bgm_main_stem_'));

    // —— 缺陷回归 ②：快速重开（R→确认）后对局 BGM 必须持续播放，不得被旧淡出定时器误暂停 ——
    A.startGameBgm('main');
    advance(300);                       // 旧淡出「+340ms 暂停」定时器尚未触发时即重开
    A.startGameBgm('main');
    advance(2000);
    const stems = stemEls();
    check(`${proto} 快速重开后 8 条对局 stems 全部持续播放（不被旧淡出定时器误暂停）`,
      stems.length === 8 && stems.every(([, el]) => !el.paused),
      stems.map(([u, el]) => [u.split('/').pop(), el.paused]));
    if (proto === 'file:') {
      // 直放等效音量 = 总线 bgm × 分层增益（verse）：逐条对齐配置，无除旧淡出 ramp 竞态归零
      const verse = AC.stemProfiles.verse;
      const want = stems.map(([u]) => {
        const name = Object.keys(AC.stems).find((n) => AC.stems[n] === u);
        return AC.bus.bgm * (verse[name] || 0);
      });
      check(`${proto} 快速重开后 stems 直放音量 = 总线 × 分层增益（不被旧淡出 ramp 竞态归零）`,
        stems.every(([, el], i) => Math.abs(el.volume - want[i]) < 0.02),
        stems.map(([u, el], i) => [u.split('/').pop(), +el.volume.toFixed(2), +want[i].toFixed(2)]));
    }

    // —— 缺陷回归 ③：进入对局后主菜单 BGM 必须停止（对局 BGM 是唯一节拍来源，§9） ——
    A.startMenuBgm();
    const menuEl = A.state.elCache[AC.tracks.menu];
    advance(500);
    check(`${proto} 菜单曲正常在播（前置）`, !!menuEl && !menuEl.paused);
    A.startGameBgm('main');
    advance(1500);
    check(`${proto} 进入对局后菜单曲停止（不得与对局 BGM 叠加）`, menuEl.paused === true);
    let playing = Object.entries(A.state.elCache).filter(([, el]) => !el.paused).map(([u]) => u.split('/').pop());
    check(`${proto} 对局中 playing 列表仅对局 stems`,
      playing.length === 8 && playing.every((n) => n.startsWith('bgm_main_stem_')), playing);

    // —— 缺陷回归 ③（retry 同理）：结算曲不得带进新局 ——
    A.startResultBgm();
    const resultEl = A.state.elCache[AC.tracks.result];
    advance(300);
    check(`${proto} 结算曲正常在播（前置）`, !resultEl.paused);
    A.startGameBgm('main');      // 结算页「再来一局」
    advance(1500);
    check(`${proto} retry 进入对局后结算曲停止`, resultEl.paused === true);
    playing = Object.entries(A.state.elCache).filter(([, el]) => !el.paused).map(([u]) => u.split('/').pop());
    check(`${proto} retry 后 playing 列表仅对局 stems`,
      playing.length === 8 && playing.every((n) => n.startsWith('bgm_main_stem_')), playing);

    // —— 解锁曲（单文件 BGM）模式：进对局同样不得叠加菜单曲 ——
    A.startMenuBgm();
    advance(200);
    A.startGameBgm('alt_neon_rain');
    advance(1200);
    const altEl = A.state.elCache[AC.tracks.alt_neon_rain];
    check(`${proto} 解锁曲模式：菜单曲停止、解锁曲在播（单曲 BGM 也走互斥）`,
      menuEl.paused === true && !altEl.paused, { menu: menuEl.paused, alt: !altEl.paused });
    A.stopGameBgm();
  }

  // —— §7.6 踩拍吸附 snappedDelayMs（表驱动：1/4 拍网格 15/BPM，±50ms 内吸附、只延迟不回卷） ——
  vm.runInThisContext(audioSrc, { filename: 'audio/audio.js' });
  const A = global.NP.audio;
  const grid = 15 / 128;                       // BPM=128：1/4 拍网格 = 0.1171875s
  const SNAP_ROWS = [
    { beat: 3 * grid, want: 0, label: '恰在网格点 → 不延迟' },
    { beat: 3 * grid - 0.030, want: 30, label: '早 30ms（≤50ms）→ 吸附延迟 30ms' },
    { beat: 3 * grid - 0.002, want: 2, label: '早 2ms → 吸附 2ms' },
    { beat: 3 * grid - 0.060, want: 0, label: '早 60ms（>50ms）→ 按原时刻' },
    { beat: 3 * grid + 0.030, want: 0, label: '已过网格 30ms → 不回卷' },
  ];
  for (const row of SNAP_ROWS) {
    A.state.bpm = 128;
    A.state.beatPos = row.beat;
    const dev = A.snappedDelayMs();
    check(`踩拍吸附：${row.label}（期望 ${row.want}ms）`, Math.abs(dev - row.want) < 0.5, +dev.toFixed(2));
  }
  check('1/4 拍网格 = 15/BPM 秒（§7.6 节拍定义）', Math.abs(A.beatInfo().gridSec - grid) < 1e-9);
}

console.log(`\n结果：${pass} 通过 / ${fail} 失败`);
process.exit(fail ? 1 : 0);
