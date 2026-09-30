/**
 * NEON PULSE — 启动与场景流转（framework §2.3 / §8.4 / 02-design-ppt P.27 场景流转图）
 * 主循环：逻辑与渲染解耦，dt 取自音频时钟（暂停 = AudioContext.suspend 冻结 → 一切时钟停走；
 * 帧时钟换算见 src/core/timing.js：量化零增量帧不虚增时间，防高刷屏速度漂移）。
 * 破纪录：≤300ms 全屏特效 + 画中画慢镜头回放（最后 3 秒环形缓冲），全程非阻塞。
 */
(function (global) {
  'use strict';

  const $ = (id) => document.getElementById(id);

  const state = {
    scene: 'menu',           // menu | modes | settings | help | unlocks | game | result
    game: null,
    modeId: null,
    paused: false,
    resuming: false,
    resumeTimer: 0,          // 恢复倒计时的 interval id（场景切换时必须清掉）
    lastNow: 0,
    fps: 60,
    fpsAcc: 0, fpsCount: 0,
    snapshots: [],
    snapAcc: 0,
    lastBar: -1,
    lastJudge: '—',
    replayModalTimer: 0,
  };

  /* ==================== 场景流转 ==================== */
  function startGame(modeId) {
    const mode = global.NP_CONFIG.modes.find((m) => m.id === modeId);
    if (!mode) return;
    // §8.4「恢复瞬间统一解冻、原样继续」：从暂停菜单「重新开始」或快速重开确认进入新局时，
    // pauseGame()/onAction('restart') 已执行 audio.suspend() —— 必须在新局开始前统一解冻，
    // 否则：① 新局全程静音；② 渲染/特效用冻结的音频时钟永不推进；③ dt 退化为固定 1/60，
    // 游戏速度随刷新率漂移、elapsedMs 与墙钟脱钩。
    global.NP.audio.resume();
    state.lastNow = global.NP.audio.now();      // 同步时钟，防止解冻瞬间 dt 跳变
    state.modeId = modeId;
    const settings = global.NP.ui.getSettings();
    const save = global.NP.ui.getSave();

    // 破纪录基准（开局锁定）：分数型 = 历史最佳分；Sprint = 历史最佳有效用时
    let bestScore = 0, bestTimeMs = 0;
    if (modeId === 'daily') {
      bestScore = save.dailyBests[global.NP.rng.utcDateString()] || 0;
    } else if (mode.scoreType === 'time') {
      bestTimeMs = save.records.sprint.timeMs || 0;
    } else {
      bestScore = (save.records[modeId] && save.records[modeId].score) || 0;
    }

    state.game = new global.NP.game.Game(mode, { bestScore, bestTimeMs });
    state.game.activeSpawnAt = global.NP.audio.now();
    state.game.onEvent = handleGameEvent;
    state.scene = 'game';
    state.paused = false;
    state.snapshots = [];
    cancelResumeCountdown();
    global.NP.ui.hideAll();                    // 含 #screen-pause / #screen-restart 等 overlay，防止遮罩残留
    global.NP.audio.setBpm(global.NP.game.bpmOf(state.game.level));
    global.NP.audio.startGameBgm(settings.music);
    global.NP.input.setEnabled(true);
    if (global.NP.touch && global.NP.touch.setGameActive) global.NP.touch.setGameActive(true);   // 触控层显隐（§8.5）
  }

  /**
   * 退出对局到菜单层（进行中的局一律作废：不产生成绩、Sprint 不产生用时）。
   *   'screen-menu'  → 主菜单（结算页 Esc「打开菜单」口径，§2.3）
   *   'screen-modes' → 模式选择页（暂停菜单 / 结算页「返回模式选择」按钮：
   *                    按钮文案 + 场景流转图 P.27「换模式需主动返回模式选择页」）
   */
  function quitTo(target) {
    if (state.game && state.game.phase !== 'over') {
      state.game.onEvent = () => {};
      state.game.requestQuit();
    }
    state.game = null;
    state.scene = 'menu';
    state.paused = false;
    cancelResumeCountdown();
    if (global.NP.touch && global.NP.touch.setGameActive) global.NP.touch.setGameActive(false);  // 清触控层按住态
    global.NP.ui.hideResult();                  // 清结算页 3 秒锁定期定时器，防残留
    global.NP.ui.hideAll();                     // 同样一并隐藏暂停/重开 overlay，防止遮罩残留
    if (target === 'screen-modes') global.NP.ui.renderModeCards();   // 刷新模式卡片上的最佳成绩
    global.NP.ui.showScreen(target);
    global.NP.audio.resume();
    global.NP.audio.startMenuBgm();
  }

  function quitToMenu() { quitTo('screen-menu'); }
  function quitToModes() { quitTo('screen-modes'); }

  function retry() {
    global.NP.ui.hideResult();
    startGame(state.modeId);
  }

  /* ==================== 对局事件 → 反馈 / 音频 ==================== */
  function handleGameEvent(name, d) {
    const A = global.NP.audio;
    const R = global.NP.render;
    const game = state.game;
    const T = global.NP.t;

    switch (name) {
      case 'spawn':
        game.activeSpawnAt = A.now();
        A.playSfx('piece-spawn');
        break;

      case 'move':
        A.playSfx('piece-move');
        break;
      case 'moveFail':
        A.playSfx('piece-rotate-fail');
        break;

      case 'rotate':
        if (d.success) A.playSfx(d.deg === 180 ? 'piece-rotate-180' : 'piece-rotate');
        else A.playSfx('piece-rotate-fail');
        break;

      case 'softdrop':
        A.playSfx('piece-softdrop-tick');   // 限流 ≥30ms（配置）；20G 段不会触发
        break;

      case 'harddrop': {
        A.playSfx('piece-hard-drop');        // 踩拍吸附对象
        const cells = global.NP.srs.cellsOf(game.active.type, game.active.rot, game.active.px, game.active.py);
        R.fx.dropTrail(cells, skinColor(game.active.type));
        break;
      }

      case 'hold':
        A.playSfx('hold-swap');
        break;

      case 'lock':
        onLock(d);
        break;

      case 'levelup':
        A.playSfx('level-up');
        A.onLevel(d.level);
        R.fx.levelPulse();
        R.fx.caption(T('toast.levelUp', { n: d.level }), { size: 64, color: 'grad', dur: 0.8 });
        break;

      case 'danger':
        A.setHeartbeat(d.on);
        A.playSfx(d.on ? 'danger-warn' : 'danger-clear');
        break;

      case 'cleared':
        R.fx.caption(T('toast.cleared'), { size: 56, color: '#00E676', dur: 1.2 });
        global.NP.ui.toast(T('toast.cleared'));
        break;

      case 'record':
        R.fx.recordBurst();                  // ≤300ms 全屏特效（非阻塞叠加层）
        A.playSfx('new-record');
        R.fx.caption(T('record.caption'), { size: 84, color: '#FFD54F', glow: '#FFD54F', dur: 0.9 });
        if (global.NP.ui.getSettings().pip) {
          R.fx.setReplay(state.snapshots.slice());
          R.fx.startReplay();
        }
        break;

      case 'runend':
        onRunEnd(d);
        break;
    }
  }

  function skinColor(type) {
    return global.NP.render.state.skinColors[type] || '#fff';
  }

  /** 锁定事件：消行反馈 / Combo / B2B / T-Spin / PC（§8.2 反馈分级表唯一阈值） */
  function onLock(d) {
    const A = global.NP.audio;
    const R = global.NP.render;
    const game = state.game;
    const T = global.NP.t;
    const cfg = global.NP_CONFIG.balance.feedback;
    // 事件字段归一：缺省 tspin / lines 一律按「非 T-Spin / 0 行」处理，
    // undefined 不得命中 `!== 'none'` 技巧分支（Lock Out 也会发 lock 事件）
    const tspin = d.tspin || 'none';
    const lines = d.lines || 0;

    // 锁定闪（硬降只播 hard-drop，不叠播 lock 音）
    R.fx.lockFlash(d.cells, d.label ? skinColor(game.active ? game.active.type : 'I') : '#fff');
    if (!d.hardDrop) A.playSfx('piece-lock');

    if (lines > 0) {
      // 消行音效（踩拍吸附）+ 消行动画（白闪 / 碎块 / 光条 / 震屏）
      A.playSfx('line-clear-' + Math.min(4, lines));
      const rows = d.rows.map((idx) => idx - 2);   // 内部索引 → 场地行号（可为 -2/-1）
      R.fx.lineClear(rows, [], lines, tspin);
      spawnShards((d.cellTypes || []).filter(([, r]) => d.rows.includes(r + 2)));

      const shakeMap = { 1: cfg.shake.line1, 2: cfg.shake.line2, 3: cfg.shake.line3, 4: cfg.shake.line4 };
      const [amp, ms] = shakeMap[Math.min(4, lines)] || cfg.shake.line1;
      R.fx.shake(amp, ms, true);
      if (tspin !== 'none' && lines >= 2) R.fx.shake(cfg.shake.tspin[0], cfg.shake.tspin[1]);

      // 技巧字幕
      if (tspin === 'full') {
        A.playSfx('tspin');
        R.fx.caption(T('tspin.caption'), { size: 56, color: '#7C4DFF', glow: '#7C4DFF', y: 0.34, dur: 0.8 });
      } else if (tspin === 'mini') {
        A.playSfx('tspin-mini');
        R.fx.caption(T('tspinMini.caption'), { size: 44, color: '#7C4DFF', glow: '#7C4DFF', y: 0.34, dur: 0.8 });
      }
      const bigLabel = { tetris: 'tetris.caption', triple: 'triple.caption', double: 'double.caption', single: 'single.caption' }[d.label];
      if (bigLabel) {
        R.fx.caption(T(bigLabel), { size: lines === 4 ? 76 : 48, color: 'grad', y: 0.28, dur: 0.8 });
      }

      // Perfect Clear
      if (d.pc) {
        A.playSfx('perfect-clear');
        R.fx.caption(T('pc.caption'), { size: 84, color: '#FFD54F', glow: '#FFD54F', y: 0.2, dur: 1.2 });
      }

      // Combo 字幕 / 音效 / 色环（分级表：≥2 弹字幕、≥4 大号 + 逐级升调、≥5 全屏色环）
      const n = d.combo;
      if (n >= 2) {
        const size = n >= 4
          ? Math.min(cfg.comboCaption.max, cfg.comboCaption.big + (n - 4) * cfg.comboCaption.step)
          : cfg.comboCaption.mid;
        R.fx.caption(`${T('combo.caption')} ×${n}`, { size, color: 'grad', y: 0.42, dur: 0.7 });
        const cs = global.NP_CONFIG.audio.comboSfx[n];
        if (cs) {
          A.playSfx(cs.name, { semitone: cs.semitone });
        } else {
          // n ≥7 唯一口径（音频设定 §4）：semitone = n − 7（playbackRate = 2^((n−7)/12)），
          // 封顶 +12 半音，n = 19 起不再升
          const hi = global.NP_CONFIG.audio.comboHigh;
          const semi = Math.min(hi.capSemitone, (n - hi.startCombo) * hi.stepPerCombo);
          A.playSfx(hi.name, { semitone: semi });
        }
        if (n >= 5) {
          R.fx.comboRing();
          A.playSfx('combo-ring');
        }
      }

      // B2B 字幕 / 音效
      if (d.b2bEvent === 'on') {
        A.playSfx('b2b-on');
        R.fx.caption(`${T('b2b.caption')} ×1`, { size: 32, color: '#FFD54F', glow: '#FFD54F', y: 0.36, dur: 0.3 });
      } else if (d.b2bEvent === 'continue') {
        A.playSfx('b2b-continue');
        R.fx.caption(`${T('b2b.caption')} ×${d.b2b + 1}`, { size: 32, color: '#FFD54F', glow: '#FFD54F', y: 0.36, dur: 0.3 });
      }

      // 分数浮标
      if (d.gain > 0) R.fx.floatScore('+' + d.gain, d.pc ? '#FFD54F' : '#EAF2FF');
    } else if (tspin !== 'none') {
      // 0 行 T-Spin / Mini：落块奖励 + 技巧反馈
      A.playSfx(tspin === 'full' ? 'tspin' : 'tspin-mini');
      R.fx.caption(tspin === 'full' ? T('tspin.caption') : T('tspinMini.caption'),
        { size: 40, color: '#7C4DFF', glow: '#7C4DFF', y: 0.34, dur: 0.7 });
    }

    // 调试面板（DoD §11.4）
    const dbg = R.getDebug();
    if (dbg) {
      dbg.lastJudge = d.label || (tspin !== 'none' ? 'tspin-' + tspin : 'none');
      dbg.kick = game.active ? game.active.lastKick : '—';
      dbg.snapMs = A.state.lastSnapMs;
    }
  }

  /** 消行碎块粒子（particle_shard，按块色 tint + 旋转 + 轻微重力） */
  function spawnShards(cellTypes) {
    const F = global.NP.render.LAY.field;
    const list = [];
    for (const [c, row, type] of cellTypes) {
      const count = 1 + Math.floor(Math.random() * 2);
      for (let i = 0; i < count; i++) {
        list.push({
          kind: 'shard',
          color: skinColor(type),
          x: F.x + c * F.cell + F.cell / 2,
          y: F.y + row * F.cell + F.cell / 2,
          vx: (Math.random() * 2 - 1) * 1.6,
          vy: (Math.random() * -1.2 - 0.4),
          gravity: 0.02,
          rot: (Math.random() * 6 - 3),
          size: 22 + Math.random() * 12,
          t0: global.NP.audio.now(),
          life: 0.25 + Math.random() * 0.35,
        });
      }
    }
    global.NP.render.fx.particles(list);
  }

  /* ==================== 结束 / 结算 ==================== */
  function onRunEnd(result) {
    const A = global.NP.audio;
    if (result.reason === 'goal') A.playSfx('sprint-finish');
    else if (result.reason === 'timeout') A.playSfx('ultra-end');
    else A.playSfx('game-over');

    // 记录 / 解锁
    global.NP.ui.recordRun(result);
    const newly = global.NP.ui.assessUnlocks(result);

    setTimeout(() => {
      state.scene = 'result';
      if (global.NP.touch && global.NP.touch.setGameActive) global.NP.touch.setGameActive(false);
      global.NP.ui.hideOverlays();              // 防御性再清一次 overlay，杜绝遮罩残留污染结算页
      global.NP.ui.showResult(result);
      A.startResultBgm();
      for (const u of newly) {
        A.playSfx('unlock');
        const U = global.NP_CONFIG.unlock;
        let nameKey = u.id;
        if (u.type === 'skin') nameKey = (U.skins.find((x) => x.id === u.id) || {}).nameKey;
        else if (u.type === 'bg') nameKey = (U.backgrounds.find((x) => x.id === u.id) || {}).nameKey;
        else if (u.type === 'music') nameKey = (U.musics.find((x) => x.id === u.id) || {}).nameKey;
        else if (u.type === 'title') nameKey = (U.titles.find((x) => x.id === u.id) || {}).nameKey;
        global.NP.ui.toast(global.NP.t('toast.unlock', { name: global.NP.t(nameKey) }));
      }
    }, result.reason === 'goal' || result.reason === 'timeout' ? 900 : 600);
  }

  /* ==================== 暂停（时间静止，§8.4） ==================== */
  /** 取消进行中的 3/2/1 恢复倒计时（场景切换时必须清掉，防残留定时器解冻错误场景） */
  function cancelResumeCountdown() {
    clearInterval(state.resumeTimer);
    state.resumeTimer = 0;
    state.resuming = false;
    $('resume-countdown').classList.add('hidden');
  }

  function pauseGame() {
    if (state.scene !== 'game' || state.paused || state.resuming) return;
    // 结束→结算的 600–900ms 间隙（phase 已 over）禁止打开暂停遮罩：
    // 否则遮罩残留 + 音频 suspend 会污染结算页 / 下一局
    if (!state.game || state.game.phase === 'over') return;
    state.paused = true;
    global.NP.audio.playSfx('ui-pause-in');
    global.NP.audio.suspend();                  // 冻结音频时钟 = 冻结一切游戏时钟
    $('screen-pause').classList.remove('hidden');
  }

  function resumeGame() {
    if (!state.paused || state.resuming) return;   // 倒计时进行中不重复启动
    $('screen-pause').classList.add('hidden');
    const settings = global.NP.ui.getSettings();
    if (!settings.resumeCountdown) {
      doResume();
      return;
    }
    // 3/2/1 倒计时：期间一切时钟仍冻结，结束瞬间统一解冻
    state.resuming = true;
    const cd = $('resume-countdown');
    cd.classList.remove('hidden');
    let n = 3;
    cd.textContent = n;
    global.NP.audio.playSfx('ui-count-beep');
    state.resumeTimer = setInterval(() => {
      n -= 1;
      if (n > 0) {
        cd.textContent = n;
        global.NP.audio.playSfx('ui-count-beep');
      } else {
        cancelResumeCountdown();
        doResume();
      }
    }, 1000);
  }

  function doResume() {
    global.NP.audio.resume();
    global.NP.audio.playSfx('ui-count-go');
    state.paused = false;
    state.lastNow = global.NP.audio.now();      // 防止恢复瞬间 dt 跳变
  }

  /* ==================== 输入动作分发 ==================== */
  function onAction(name, down) {
    const A = global.NP.audio;
    const game = state.game;

    if (name === 'mute' && down) {
      const s = global.NP.ui.getSettings();
      s.muted = !s.muted;
      A.setMuted(s.muted);
      return;
    }
    if (name === 'pause' && down) {
      if (state.scene !== 'game') return;
      // 任意模态层（设置/模式/帮助/成就/结算/快速重开确认）打开时暂停键一律吞掉，
      // 交给 UI 层处理，避免同一按键穿透模态层双重触发；
      // 唯一例外：暂停菜单 / 恢复倒计时本身就是暂停键的开关态，再按一次 = 继续游戏（§8.4）。
      if (modalOpen() && !pauseLayerOpen()) return;
      if (state.paused) resumeGame();
      else pauseGame();
      return;
    }
    // 【关键】按住型动作（左右移动/软降）的“松手”必须无条件送达游戏输入层：
    // 消行动画 / 暂停 / 结束阶段吞掉 key up 会让 DAS 方向或软降残留，出现“幽灵移动”。
    // 仅 key down 才受阶段/暂停过滤。
    const holdable = name === 'moveLeft' || name === 'moveRight' || name === 'softDrop';
    if (!down && holdable) {
      if (game) game.setHeld(name, false);
      return;
    }

    if (state.scene !== 'game' || state.paused || !game || game.phase === 'over') return;

    // 消行动画期间：离散动作进缓冲队列（§8.2 输入缓冲）
    const discrete = ['rotateCW', 'rotateCCW', 'rotate180', 'hardDrop', 'hold'];
    if (game.phase === 'clearing') {
      if (down && discrete.includes(name)) game.bufferAction(name);
      return;
    }

    if (holdable) {
      game.setHeld(name, true);
      return;
    }
    if (!down) return;
    if (name === 'rotateCW') game.rotate(1);
    else if (name === 'rotateCCW') game.rotate(-1);
    else if (name === 'rotate180') game.rotate(2);
    else if (name === 'hardDrop') game.hardDrop();
    else if (name === 'hold') game.hold();
    else if (name === 'restart') {
      // 快速重开：默认先弹确认（§8.4）；确认期间对局冻结
      if (global.NP.ui.getSettings().restartConfirm) {
        state.paused = true;
        A.suspend();
        $('screen-restart').classList.remove('hidden');
      } else {
        startGame(state.modeId);
      }
    }
  }

  /**
   * 是否有模态层打开（暂停键等动作不得穿透，一律交给 UI 层）。
   * 必须含 screen-pause / resume-countdown：从「暂停→设置」按 Esc 返回暂停层后，
   * 若不把暂停层计入模态判定，同一 Esc 会被误判为无模态而 resumeGame()，
   * 「返回」就变成了“退出暂停并继续游戏”。
   */
  function modalOpen() {
    return ['screen-modes', 'screen-settings', 'screen-help', 'screen-unlocks', 'screen-result',
      'screen-restart', 'screen-pause', 'resume-countdown']
      .some((id) => !$(id).classList.contains('hidden'));
  }

  /** 暂停层（暂停菜单 / 恢复倒计时）：暂停键在其上保持开关语义，不算吞键 */
  function pauseLayerOpen() {
    return ['screen-pause', 'resume-countdown'].some((id) => !$(id).classList.contains('hidden'));
  }

  /**
   * 菜单层键盘（Esc 返回、结算页空格/回车重开）。
   * 返回 true = 事件已由 UI 层消费，输入层不得再把同一 keydown 分发给玩法层（见 src/ui/input.js）。
   */
  function onUiKey(e) {
    const A = global.NP.audio;
    if (e.code === 'KeyM' && !e.repeat) return false;   // 静音由 onAction 处理，不在此消费
    if (state.scene === 'result') {
      // 结算页：键盘整体归 UI 层。确认键 retry() 已切入新局，
      // 同一事件若继续分发会立刻 hardDrop / pause 新局（街机预设 Enter = 暂停）。
      if (e.code === 'Escape' && !e.repeat) {
        e.preventDefault();
        // §2.3「仅 Esc 打开菜单」= 回主菜单；
        // 「返回模式选择」按钮另有专用路径 quitToModes（按钮文案 + P.27 口径）
        quitToMenu();
      } else if ((e.code === 'Space' || e.code === 'Enter') && !e.repeat) {
        e.preventDefault();
        if (global.NP.ui.canRetry()) {
          A.playSfx('ui-confirm');
          retry();
        } else {
          A.playSfx('ui-error');                  // 锁定期按键：只播 error（防误触）
        }
      }
      return true;
    }
    if (e.code === 'Escape' && !e.repeat) {
      const screens = {
        'screen-modes': 'screen-menu', 'screen-settings': null, 'screen-help': 'screen-menu',
        'screen-unlocks': 'screen-menu',
      };
      const cur = ['screen-modes', 'screen-settings', 'screen-help', 'screen-unlocks'].find((id) => !$(id).classList.contains('hidden'));
      if (cur) {
        e.preventDefault();
        A.playSfx('ui-cancel');
        if (cur === 'screen-settings') {
          // 从对局暂停进入设置 → 回暂停菜单；从菜单进入 → 回主菜单
          if (state.scene === 'game' && state.paused) {
            $('screen-pause').classList.remove('hidden');
            $('screen-settings').classList.add('hidden');
          } else {
            global.NP.ui.showScreen('screen-menu');
          }
        } else {
          global.NP.ui.showScreen(screens[cur] || 'screen-menu');
        }
        return true;                            // 同一 Esc 已用于「返回」，不得再当暂停键分发
      }
    }
    return false;
  }

  /* ==================== 主循环 ==================== */
  function loop() {
    const A = global.NP.audio;
    const now = A.now();
    // 帧时钟（src/core/timing.js）：音频时钟增量 → 本帧游戏时间。
    // 量化零增量帧计 0（不虚增时间，防高刷屏速度漂移）；冻结 = 时间静止（§8.4）。
    const dtSec = global.NP.timing.frameDtSec(now - state.lastNow);
    state.lastNow = now;

    // FPS 统计（调试面板 / 掉帧降粒子）
    state.fpsAcc += dtSec; state.fpsCount++;
    if (state.fpsAcc >= 0.5) {
      state.fps = state.fpsCount / state.fpsAcc;
      state.fpsAcc = 0; state.fpsCount = 0;
      global.NP.render.state.fps = state.fps;
      if (state.fps < 55) {
        // 持续掉帧：粒子预算减半（渲染层自然衰减）
        const p = global.NP.render.state.particles;
        if (p.length > 100) p.splice(0, Math.floor(p.length / 2));
      }
    }

    const playing = state.scene === 'game' && !state.paused && state.game;
    const dtMs = playing ? dtSec * 1000 : 0;

    if (playing) {
      A.updateBeat(dtMs);
      state.game.update(dtMs);

      // 每小节第 1 拍：背景脉冲（§7.6 用途 2）
      const bar = Math.floor(A.state.beatPos / 4);
      if (bar !== state.lastBar) {
        state.lastBar = bar;
        global.NP.render.fx.beatPulse();
      }

      // 破纪录回放环形缓冲：最后 3 秒（100ms 一帧快照，不落盘）
      state.snapAcc += dtMs;
      if (state.snapAcc >= 100) {
        state.snapAcc = 0;
        const g = state.game;
        if (g.active && g.phase === 'falling') {
          state.snapshots.push({
            grid: g.grid.map((row) => row.slice()),
            cells: global.NP.srs.cellsOf(g.active.type, g.active.rot, g.active.px, g.active.py),
            type: g.active.type,
          });
          const keep = Math.ceil(global.NP_CONFIG.balance.feedback.pipSeconds * 10);
          while (state.snapshots.length > keep) state.snapshots.shift();
        }
      }
    }

    // §8.4 暂停 = 时间静止（冻结而非清零）：暂停（含失焦自动暂停 / 恢复倒计时 / 重开确认）
    // 期间以 dt=0 渲染 —— 背景数据流粒子 / 城市流（bgOffset）、震屏等按 dt 推进的视觉时钟全部冻结；
    // 其余叠加层用音频时钟（NP.audio.now()），已由 audio.suspend() 同帧冻结
    const frozen = state.scene === 'game' && state.paused;
    global.NP.render.frame(state.game, frozen ? 0 : (playing ? dtSec : 1 / 60));
    requestAnimationFrame(loop);
  }

  /* ==================== 启动 ==================== */
  function boot() {
    const canvas = $('game-canvas');
    global.NP.render.init(canvas);

    // 等比缩放舞台（横屏 1920×1080 / 竖屏 9:16=1080×1920，§9：移动端竖屏优先，场地上部居中、操作区底部）
    const fit = () => {
      const portrait = window.innerHeight > window.innerWidth;
      const stageW = portrait ? 1080 : 1920;
      const stageH = portrait ? 1920 : 1080;
      const s = Math.min(window.innerWidth / stageW, window.innerHeight / stageH);
      const stage = $('stage');
      stage.style.width = stageW + 'px';
      stage.style.height = stageH + 'px';
      stage.style.marginLeft = (-stageW / 2) + 'px';
      stage.style.marginTop = (-stageH / 2) + 'px';
      stage.style.transform = `scale(${s})`;
      document.body.classList.toggle('portrait', portrait);
      global.NP.render.setLayout(portrait ? 'portrait' : 'landscape');
      // 触控目标 ≥ 44×44 真实 CSS px（§8.5 / DoD 10）：舞台缩放后按 44/s 补偿；
      // 小屏手机上换算到 CSS px 恰好 44px，大屏不低于 88px
      const tpx = Math.ceil(Math.max(88, 44 / s));
      document.documentElement.style.setProperty('--tpx', tpx + 'px');
      if (global.NP.touch && global.NP.touch.syncMetrics) global.NP.touch.syncMetrics();
    };
    window.addEventListener('resize', fit);
    window.addEventListener('orientationchange', fit);
    fit();

    global.NP.input.init({ onAction, onUiKey });
    global.NP.ui.init({
      startMode: (modeId) => startGame(modeId),
      resumeGame,
      restartGame: () => {
        $('screen-restart').classList.add('hidden');
        $('screen-pause').classList.add('hidden');
        global.NP.ui.hideResult();
        startGame(state.modeId);
      },
      quitToMenu,
      quitToModes,          // 「返回模式选择」按钮专用：落到 screen-modes（P.27）
      retry,
      watchReplay: () => watchReplayModal(),
      closeSettings: () => {
        if (state.scene === 'game' && state.paused) {
          $('screen-settings').classList.add('hidden');
          $('screen-pause').classList.remove('hidden');
        } else {
          global.NP.ui.showScreen('screen-menu');
        }
      },
    });

    // 触控输入（framework §8.5）：手势 + 虚拟按键区 + 顶部暂停入口，
    // 全部走与键盘/手柄同一 onAction 动作接口（不走两套逻辑，§8.5）
    if (global.NP.touch && global.NP.touch.init) {
      global.NP.touch.init({
        onAction,
        surface: $('game-canvas'),
        pad: $('touch-pad'),
        pauseBtn: $('btn-touch-pause'),
      });
      const ts = global.NP.ui.getSettings();
      global.NP.touch.setPadVisible(ts.touchPad !== false);
      global.NP.touch.setPadOpacity(ts.touchPadOpacity != null ? ts.touchPadOpacity : 0.85);
    }

    // 首次用户手势解锁音频
    const unlockAudio = () => {
      global.NP.audio.init();
      global.NP.audio.unlock();
      if (state.scene === 'menu') global.NP.audio.startMenuBgm();
    };
    window.addEventListener('pointerdown', unlockAudio, { once: true });
    window.addEventListener('keydown', unlockAudio, { once: true });

    // 失焦自动暂停（Alt-Tab / 切标签 / 最小化，§8.4）
    const autoPause = () => {
      if (global.NP.ui.getSettings().autoPause && state.scene === 'game' && !state.paused) pauseGame();
    };
    window.addEventListener('blur', autoPause);
    document.addEventListener('visibilitychange', () => { if (document.hidden) autoPause(); });

    // F3 调试面板
    window.addEventListener('keydown', (e) => {
      if (e.code === 'F3') {
        e.preventDefault();
        const cur = global.NP.render.state.debug;
        global.NP.render.setDebug(!cur);
        if (!cur) global.NP.render.state.debug = { lastJudge: state.lastJudge, kick: '—', snapMs: 0 };
      }
    });

    state.lastNow = global.NP.audio.now();
    requestAnimationFrame(loop);
  }

  /** 结算页「回看最后 3 秒」：小窗慢镜头（画中画关闭时的替代入口） */
  function watchReplayModal() {
    const canvas = $('replay-canvas');
    const ctx = canvas.getContext('2d');
    const frames = state.snapshots;
    if (!frames.length) return;
    const t0 = performance.now();
    const draw = () => {
      const t = (performance.now() - t0) / 1000;
      const idx = Math.min(frames.length - 1, Math.floor(t * 0.5 * 10));
      const snap = frames[idx];
      ctx.fillStyle = '#0B0E1A';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      const cell = 22;
      const x0 = (canvas.width - 10 * cell) / 2, y0 = 40;
      for (let r = 0; r < 20; r++) {
        for (let c = 0; c < 10; c++) {
          const v = snap.grid[r + 2][c];
          if (!v) continue;
          ctx.fillStyle = global.NP.render.state.skinColors[v] || '#fff';
          ctx.fillRect(x0 + c * cell, y0 + r * cell, cell - 1, cell - 1);
        }
      }
      for (const [c, r] of snap.cells) {
        if (r < 0) continue;
        ctx.fillStyle = global.NP.render.state.skinColors[snap.type] || '#fff';
        ctx.fillRect(x0 + c * cell, y0 + r * cell, cell - 1, cell - 1);
      }
      if (t < 6) requestAnimationFrame(draw);
    };
    draw();
  }

  // 供调试面板 / QA 压测访问内部状态（不影响玩法）
  global.NP.app = state;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window);
