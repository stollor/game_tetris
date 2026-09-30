/**
 * NEON PULSE — UI 层：场景界面、设置、存档（localStorage）、解锁系统、结算页
 * 存档内容：设置 / 解锁 / 最佳成绩 / 累计统计（framework §9 存档口径）
 */
(function (global) {
  'use strict';

  const SAVE_KEY = 'neonpulse.save.v1';
  const $ = (id) => document.getElementById(id);

  /* ==================== 存档 ==================== */
  const defaultSave = () => ({
    version: 1,
    settings: {
      language: 'zh-CN',
      volumes: { master: 1, bgm: 0.75, sfx: 0.85, sfxUi: 0.7, sfxGame: 0.9 },
      muted: false,
      fxLevel: 'mid',
      reducedFlash: false,
      pip: true,
      autoPause: true,
      resumeCountdown: true,
      restartConfirm: true,
      touchPad: true,                 // 虚拟按键区开关（§8.5）
      touchPadOpacity: 0.85,          // 虚拟按键透明度（§8.5）
      skin: 'classic',
      background: 'default',
      music: 'main',
      bindings: null,          // null = 使用 config 默认
    },
    records: {
      marathon: { score: 0 },
      sprint: { timeMs: 0 },
      ultra: { score: 0 },
    },
    dailyBests: {},            // 'YYYY-MM-DD' -> score
    stats: {
      totalLines: 0,
      dailyCompletions: 0,
      marathonBestLevel: 0,
      sprintBestMs: 0,
      bestMaxCombo: 0,
      bestPc: 0,
      bestTspinClears: 0,
    },
    unlocks: {
      skins: ['classic'],
      backgrounds: ['default'],
      musics: ['main'],
      titles: [],
    },
  });

  let save = null;
  function loadSave() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      const def = defaultSave();
      save = Object.assign(def, parsed);
      // 设置项逐层合并：旧存档缺新增键（如触控开关）不得失灵
      save.settings = Object.assign(def.settings, parsed.settings || {});
      save.settings.volumes = Object.assign(def.settings.volumes, (parsed.settings && parsed.settings.volumes) || {});
    } catch (e) {
      save = defaultSave();
    }
    return save;
  }
  function writeSave() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { /* file:// 某些环境禁用 */ }
  }

  /* ==================== i18n ==================== */
  let lang = 'zh-CN';
  function t(key, params) {
    const dict = (global.NP_I18N && global.NP_I18N[lang]) || {};
    let s = dict[key] != null ? dict[key] : (global.NP_I18N['zh-CN'][key] || key);
    if (params) for (const k of Object.keys(params)) s = s.replace('{' + k + '}', params[k]);
    return s;
  }
  function applyI18n() {
    document.querySelectorAll('[data-i18n]').forEach((el) => {
      el.textContent = t(el.getAttribute('data-i18n'));
    });
    document.documentElement.lang = lang;
  }

  const ACTION_LABELS = {
    moveLeft: ['左移', 'Move Left'], moveRight: ['右移', 'Move Right'],
    rotateCW: ['顺时针旋转', 'Rotate CW'], rotateCCW: ['逆时针旋转', 'Rotate CCW'],
    rotate180: ['180° 旋转', 'Rotate 180'], softDrop: ['软降', 'Soft Drop'],
    hardDrop: ['硬降', 'Hard Drop'], hold: ['Hold 暂存', 'Hold'],
    pause: ['暂停', 'Pause'], restart: ['快速重开', 'Quick Restart'], mute: ['静音', 'Mute'],
  };
  const KEY_LABELS = {
    ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓',
    Space: '␣', ShiftLeft: 'L-Shift', ShiftRight: 'R-Shift', ControlLeft: 'L-Ctrl', ControlRight: 'R-Ctrl',
    Escape: 'Esc', Enter: 'Enter', Backspace: 'Bksp',
  };
  const keyLabel = (code) => KEY_LABELS[code] || code.replace(/^Key/, '').replace(/^Digit/, '');

  /* ==================== 屏幕切换 ==================== */
  const SCREENS = ['screen-menu', 'screen-modes', 'screen-settings', 'screen-help', 'screen-unlocks', 'screen-result'];
  // 悬浮 overlay 层（暂停菜单 / 快速重开确认 / 恢复倒计时 / 回放弹窗）：
  // 它们不在 SCREENS 列表里，但任何场景切换都必须一并隐藏，
  // 否则遮罩会永久残留、盖住主菜单/模式选择/结算页/下一局（尤其退出对局回菜单层的路径）
  const OVERLAYS = ['screen-pause', 'screen-restart', 'resume-countdown', 'replay-modal'];
  function hideOverlays() { for (const s of OVERLAYS) $(s).classList.add('hidden'); }
  function showScreen(name) {
    for (const s of SCREENS) $(s).classList.toggle('hidden', s !== name);
    hideOverlays();
  }
  function hideAll() { for (const s of SCREENS) $(s).classList.add('hidden'); hideOverlays(); }

  /* ==================== Toast ==================== */
  let toastTimer = 0;
  function toast(text, ms) {
    const el = $('toast');
    el.textContent = text;
    el.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.add('hidden'), ms || 2600);
  }

  /* ==================== DOM 构建辅助 ==================== */
  /**
   * 安全的元素构建器：全程 textContent 赋值、不拼 HTML 字符串。
   * （本项目所有动态列表一律走 DOM API 构建，杜绝 HTML 解析/注入式写法。）
   */
  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }
  /** 清空容器（纯 DOM API，不走 HTML 字符串解析） */
  function clear(node) {
    node.replaceChildren();
  }

  /* ==================== 模式卡片 ==================== */
  function renderModeCards() {
    const wrap = $('mode-cards');
    clear(wrap);
    for (const mode of global.NP_CONFIG.modes) {
      const card = document.createElement('div');
      card.className = 'mode-card';
      card.dataset.mode = mode.id;
      const best = recordText(mode);
      if (mode.id === 'daily') card.appendChild(el('div', 'badge', 'DAILY'));
      card.appendChild(el('h3', null, t(mode.nameKey)));
      card.appendChild(el('div', 'desc', t(mode.descKey)));
      if (mode.daily) card.appendChild(el('div', 'daily-date', t('mode.dailyDate') + ': ' + global.NP.rng.utcDateString()));
      card.appendChild(el('div', 'best', t('mode.best') + ': ' + best));
      card.addEventListener('mouseenter', () => global.NP.audio.playSfx('ui-hover'));
      card.addEventListener('click', () => {
        global.NP.audio.playSfx('ui-confirm');
        callbacks.startMode && callbacks.startMode(mode.id);
      });
      wrap.appendChild(card);
    }
  }
  function recordText(mode) {
    if (mode.id === 'daily') {
      const d = global.NP.rng.utcDateString();
      const v = save.dailyBests[d];
      return v ? String(v) : t('mode.noRecord');
    }
    const rec = save.records[mode.id];
    if (!rec) return t('mode.noRecord');
    if (mode.scoreType === 'time') {
      return rec.timeMs ? global.NP.render.fmtTime(rec.timeMs) : t('mode.noRecord');
    }
    return rec.score ? String(rec.score) : t('mode.noRecord');
  }

  /* ==================== 设置界面 ==================== */
  function bindSettings() {
    const s = save.settings;
    const vol = (id, key) => {
      const el = $(id), out = $(id + '-out');
      el.value = s.volumes[key];
      out.textContent = Math.round(s.volumes[key] * 100) + '%';
      el.addEventListener('input', () => {
        s.volumes[key] = parseFloat(el.value);
        out.textContent = Math.round(s.volumes[key] * 100) + '%';
        global.NP.audio.setVolume(key === 'bgm' ? 'bgm' : key, s.volumes[key]);
        writeSave();
      });
    };
    vol('vol-bgm', 'bgm'); vol('vol-sfx', 'sfx'); vol('vol-ui', 'sfxUi'); vol('vol-game', 'sfxGame');

    const chk = (id, key, after) => {
      const el = $(id);
      el.checked = !!s[key];
      el.addEventListener('change', () => {
        s[key] = el.checked;
        if (after) after(el.checked);
        writeSave();
      });
    };
    chk('chk-mute', 'muted', (v) => global.NP.audio.setMuted(v));
    chk('chk-flash', 'reducedFlash', (v) => {
      document.body.classList.toggle('reduced-flash', v);
      global.NP.render.fx.setReducedFlash(v);
    });
    chk('chk-pip', 'pip', (v) => { global.NP.render.state.replay.enabled = v; });
    chk('chk-autopause', 'autoPause');
    chk('chk-countdown', 'resumeCountdown');
    chk('chk-restartconfirm', 'restartConfirm');

    // 触控设置（§8.5：虚拟按键区可设开关与透明度）
    chk('chk-touchpad', 'touchPad', (v) => {
      if (global.NP.touch && global.NP.touch.setPadVisible) global.NP.touch.setPadVisible(v);
    });
    const padOp = $('vol-touchpad'), padOpOut = $('vol-touchpad-out');
    if (padOp) {
      padOp.value = s.touchPadOpacity != null ? s.touchPadOpacity : 0.85;
      if (padOpOut) padOpOut.textContent = Math.round(padOp.value * 100) + '%';
      padOp.addEventListener('input', () => {
        s.touchPadOpacity = parseFloat(padOp.value);
        if (padOpOut) padOpOut.textContent = Math.round(s.touchPadOpacity * 100) + '%';
        if (global.NP.touch && global.NP.touch.setPadOpacity) global.NP.touch.setPadOpacity(s.touchPadOpacity);
        writeSave();
      });
    }

    const selFx = $('sel-fx');
    selFx.value = s.fxLevel;
    selFx.addEventListener('change', () => {
      s.fxLevel = selFx.value;
      global.NP.render.fx.setFxLevel(s.fxLevel);
      writeSave();
    });

    $('sel-lang').value = s.language;
    $('sel-lang').addEventListener('change', () => {
      s.language = $('sel-lang').value;
      lang = s.language;
      applyI18n();
      renderModeCards();
      renderBindings();
      renderUnlocks();
      writeSave();
    });

    // 主题选择（皮肤 / 背景 / 音乐，含解锁状态）
    renderThemeSelects();

    // 预设 / 重置
    document.querySelectorAll('[data-preset]').forEach((btn) => {
      btn.addEventListener('click', () => {
        global.NP.input.applyPreset(btn.dataset.preset);
        save.settings.bindings = global.NP.input.getBindings();
        global.NP.audio.playSfx('ui-confirm');
        renderBindings();
        writeSave();
      });
    });
    $('btn-reset-bindings').addEventListener('click', () => {
      global.NP.input.setBindings(global.NP_CONFIG.input.defaultBindings);
      save.settings.bindings = global.NP.input.getBindings();
      renderBindings();
      writeSave();
    });

    renderBindings();
  }

  function renderThemeSelects() {
    const s = save.settings;
    const fill = (selId, items, current, onPick) => {
      const sel = $(selId);
      clear(sel);
      for (const it of items) {
        const opt = document.createElement('option');
        const unlocked = it.unlocked;
        opt.value = it.id;
        opt.textContent = t(it.nameKey) + (unlocked ? '' : ' (' + t('settings.locked') + ')');
        opt.disabled = !unlocked;
        sel.appendChild(opt);
      }
      sel.value = current;
      sel.addEventListener('change', () => { onPick(sel.value); writeSave(); });
    };
    const U = global.NP_CONFIG.unlock;
    fill('sel-skin', U.skins.map((x) => ({ id: x.id, nameKey: x.nameKey, unlocked: save.unlocks.skins.includes(x.id) })),
      s.skin, (v) => { s.skin = v; applySkin(); });
    fill('sel-bg', U.backgrounds.map((x) => ({ id: x.id, nameKey: x.nameKey, unlocked: save.unlocks.backgrounds.includes(x.id) })),
      s.background, (v) => { s.background = v; global.NP.render.fx.setBgTheme(v); });
    fill('sel-music', U.musics.map((x) => ({ id: x.id, nameKey: x.nameKey, unlocked: save.unlocks.musics.includes(x.id) })),
      s.music, (v) => { s.music = v; });
  }

  function applySkin() {
    const skin = global.NP_CONFIG.unlock.skins.find((x) => x.id === save.settings.skin);
    const colors = skin && skin.colors ? skin.colors : global.NP.srs.DEFAULT_COLORS;
    global.NP.render.fx.setSkin(colors);
  }

  /* ==================== 重绑定 ==================== */
  function renderBindings() {
    const wrap = $('bindings-list');
    clear(wrap);
    const bindings = global.NP.input.getBindings();
    const conflicts = global.NP.input.validateBindings(bindings);
    const conflictCodes = new Set(conflicts.map((c) => c.code));
    for (const action of Object.keys(bindings)) {
      const row = document.createElement('div');
      row.className = 'bind-row';
      const label = ACTION_LABELS[action] || [action, action];
      const name = document.createElement('div');
      name.className = 'action-name';
      name.textContent = lang === 'zh-CN' ? label[0] : label[1];
      const keys = document.createElement('div');
      keys.className = 'keys';
      for (const bind of bindings[action]) {
        const chip = document.createElement('span');
        chip.className = 'key-chip';
        if (conflictCodes.has(bind.code)) row.classList.add('conflict');
        chip.textContent = keyLabel(bind.code);
        chip.title = bind.code;
        chip.addEventListener('click', () => startRebind(action, bind));
        keys.appendChild(chip);
      }
      const btn = document.createElement('button');
      btn.className = 'btn mini rebind';
      btn.textContent = '+';
      btn.addEventListener('click', () => startRebind(action, null));
      row.appendChild(name); row.appendChild(keys); row.appendChild(btn);
      wrap.appendChild(row);
    }
    if (conflicts.length) {
      const warn = document.createElement('div');
      warn.style.color = '#FF1744';
      warn.textContent = t('settings.conflict') + ' ' + conflicts.map((c) => c.code).join(', ');
      wrap.appendChild(warn);
    }
  }

  function startRebind(action, replaceBind) {
    global.NP.audio.playSfx('ui-move');
    toast(t('settings.pressKey'), 2600);
    global.NP.input.captureNextKey((code) => {
      const bindings = global.NP.input.getBindings();
      if (replaceBind) {
        replaceBind.code = code;
      } else {
        bindings[action].push({ code });
      }
      const conflicts = global.NP.input.validateBindings(bindings);
      if (conflicts.length) global.NP.audio.playSfx('ui-error');
      else global.NP.audio.playSfx('ui-confirm');
      save.settings.bindings = bindings;
      renderBindings();
      writeSave();
    });
  }

  /* ==================== 成就 / 解锁 ==================== */
  function renderUnlocks() {
    $('stat-lines').textContent = save.stats.totalLines;
    $('stat-daily').textContent = save.stats.dailyCompletions;
    const grid = $('unlock-grid');
    clear(grid);
    const U = global.NP_CONFIG.unlock;
    const add = (name, cond, ok) => {
      const item = document.createElement('div');
      item.className = 'unlock-item' + (ok ? '' : ' locked');
      item.appendChild(el('span', 'state ' + (ok ? 'ok' : 'no'), ok ? t('unlock.unlocked') : t('unlock.locked')));
      item.appendChild(el('div', 'name', name));
      item.appendChild(el('div', 'cond', cond));
      grid.appendChild(item);
    };
    for (const sk of U.skins) add(t(sk.nameKey), `${t('unlock.totalLines')} ≥ ${sk.lines}`, save.unlocks.skins.includes(sk.id));
    for (const bg of U.backgrounds) add(t(bg.nameKey), t(bg.condKey), save.unlocks.backgrounds.includes(bg.id));
    for (const mu of U.musics) add(t(mu.nameKey), mu.condKey ? t(mu.condKey) : t('unlock.bg.none'), save.unlocks.musics.includes(mu.id));
    for (const ti of U.titles) add(t(ti.nameKey), t(ti.condKey), save.unlocks.titles.includes(ti.id));
  }

  /** 一局结束后更新统计并评估解锁（返回新解锁列表） */
  function assessUnlocks(result) {
    const U = global.NP_CONFIG.unlock;
    const st = save.stats;
    const newly = [];
    if (result.valid) {
      st.totalLines += result.lines;
      st.bestMaxCombo = Math.max(st.bestMaxCombo, result.maxCombo);
      st.bestPc = Math.max(st.bestPc, result.counts.pc);
      st.bestTspinClears = Math.max(st.bestTspinClears, result.counts.tspinClears);
      if (result.modeId === 'marathon' && result.level > st.marathonBestLevel) st.marathonBestLevel = result.level;
      if (result.modeId === 'sprint' && result.valid) {
        st.sprintBestMs = st.sprintBestMs ? Math.min(st.sprintBestMs, result.timeMs) : result.timeMs;
      }
      if (result.modeId === 'daily') st.dailyCompletions += 1;
    }

    const unlockSkin = (id) => { if (!save.unlocks.skins.includes(id)) { save.unlocks.skins.push(id); newly.push({ type: 'skin', id }); } };
    const unlockBg = (id) => { if (!save.unlocks.backgrounds.includes(id)) { save.unlocks.backgrounds.push(id); newly.push({ type: 'bg', id }); } };
    const unlockMusic = (id) => { if (!save.unlocks.musics.includes(id)) { save.unlocks.musics.push(id); newly.push({ type: 'music', id }); } };
    const unlockTitle = (id) => { if (!save.unlocks.titles.includes(id)) { save.unlocks.titles.push(id); newly.push({ type: 'title', id }); } };

    for (const sk of U.skins) if (sk.lines > 0 && st.totalLines >= sk.lines) unlockSkin(sk.id);
    for (const bg of U.backgrounds) {
      const c = bg.cond;
      if (!c) continue;
      if (c.type === 'marathonLevel' && st.marathonBestLevel >= c.level) unlockBg(bg.id);
      if (c.type === 'sprintUnder' && st.sprintBestMs > 0 && st.sprintBestMs <= c.seconds * 1000) unlockBg(bg.id);
    }
    for (const mu of U.musics) if (mu.daily > 0 && st.dailyCompletions >= mu.daily) unlockMusic(mu.id);
    for (const ti of U.titles) {
      const c = ti.cond;
      if (c.type === 'maxCombo' && st.bestMaxCombo >= c.value) unlockTitle(ti.id);
      if (c.type === 'pcCount' && st.bestPc >= c.value) unlockTitle(ti.id);
      if (c.type === 'tspinClears' && st.bestTspinClears >= c.value) unlockTitle(ti.id);
      if (c.type === 'sprintUnder' && st.sprintBestMs > 0 && st.sprintBestMs <= c.seconds * 1000) unlockTitle(ti.id);
      if (c.type === 'marathonLevel' && st.marathonBestLevel >= c.level) unlockTitle(ti.id);
      if (c.type === 'dailyCount' && st.dailyCompletions >= c.value) unlockTitle(ti.id);
    }
    writeSave();
    return newly;
  }

  /** 记录本局成绩（破纪录口径见 framework §2.3） */
  function recordRun(result) {
    if (!result.valid) return;
    if (result.modeId === 'daily') {
      const d = result.dailyDate || global.NP.rng.utcDateString();
      const prev = save.dailyBests[d] || 0;
      if (result.score > prev) save.dailyBests[d] = result.score;
    } else if (result.scoreType === 'time') {
      const rec = save.records.sprint;
      if (result.record || !rec.timeMs || result.timeMs < rec.timeMs) rec.timeMs = result.timeMs;
    } else {
      const rec = save.records[result.modeId];
      if (rec && result.score > rec.score) rec.score = result.score;
    }
    writeSave();
    renderModeCards();
  }

  function getRecord(modeId) {
    if (modeId === 'daily') {
      return { score: save.dailyBests[global.NP.rng.utcDateString()] || 0, timeMs: 0 };
    }
    return save.records[modeId] || { score: 0, timeMs: 0 };
  }

  /* ==================== 结算页 ==================== */
  let retryTimer = null;
  const callbacks = {};

  function showResult(result) {
    showScreen('screen-result');
    const grid = $('result-grid');
    const rec = result.record;
    $('record-banner').classList.toggle('hidden', !rec);
    $('result-panel').classList.toggle('record', !!rec);
    const fmt = global.NP.render.fmtTime;
    const cells = [
      [t('result.score'), String(result.score), rec && result.scoreType === 'score'],
      [t('result.time'), fmt(result.timeMs), rec && result.scoreType === 'time'],
      [t('result.lines'), String(result.lines), false],
      [t('result.level'), String(result.level), false],
      [t('result.maxCombo'), '×' + result.maxCombo, false],
      [t('result.b2b'), '×' + (result.maxB2b + (result.maxB2b ? 1 : 0)), false],
      [t('result.tspin'), String(result.counts.tspinClears), false],
      [t('result.tetris'), String(result.counts.tetris), false],
      [t('result.pc'), String(result.counts.pc), false],
    ];
    clear(grid);
    for (const [k, v, gold] of cells) {
      const cell = el('div', 'cell');
      cell.appendChild(el('span', 'k', k));
      cell.appendChild(el('span', 'v' + (gold ? ' gold' : ''), v));
      grid.appendChild(cell);
    }

    // 鼓励式文案（永远鼓励式，§2.3）
    const enc = $('result-encourage');
    if (rec) {
      enc.textContent = t('result.newRecord');
    } else if (!result.valid) {
      enc.textContent = t('result.unfinished');
    } else if (result.scoreType === 'time') {
      const diff = (result.timeMs - (result.best || 0)) / 1000;
      enc.textContent = t('result.encourage.timeNear', { n: diff.toFixed(2) });
    } else {
      const diff = (result.best || 0) - result.score;
      enc.textContent = diff > 0
        ? t('result.encourage.scoreNear', { n: diff })
        : t('result.encourage.keepGoing');
    }
    if (result.modeId === 'daily' && result.valid) {
      enc.textContent += ' · ' + t('result.dailyCount');
    }

    // 3 秒防误触锁定期
    const btn = $('btn-retry');
    const lockText = $('retry-lock-text');
    btn.disabled = true;
    let left = Math.ceil(global.NP_CONFIG.balance.feedback.resultLockMs / 1000);
    lockText.textContent = t('result.locked', { s: left });
    clearInterval(retryTimer);
    retryTimer = setInterval(() => {
      left -= 1;
      if (left <= 0) {
        clearInterval(retryTimer);
        btn.disabled = false;
        lockText.textContent = '';
        $('btn-watch-replay').classList.toggle('hidden', save.settings.pip);
      } else {
        lockText.textContent = t('result.locked', { s: left });
      }
    }, 1000);
  }

  function hideResult() {
    clearInterval(retryTimer);
    $('screen-result').classList.add('hidden');
    $('replay-modal').classList.add('hidden');
  }

  function canRetry() { return !$('btn-retry').disabled; }

  /* ==================== 初始化 ==================== */
  function init(cbs) {
    Object.assign(callbacks, cbs || {});
    loadSave();
    lang = save.settings.language || 'zh-CN';
    applyI18n();

    // 恢复存档中的重绑定键位（存档口径：设置/解锁/最佳成绩/重绑定）。
    // 与 config 默认键位按动作合并，防旧存档缺动作导致按键失灵。
    if (save.settings.bindings && global.NP.input && global.NP.input.setBindings) {
      const def = global.NP_CONFIG.input.defaultBindings;
      const merged = {};
      for (const action of Object.keys(def)) {
        const b = save.settings.bindings[action];
        merged[action] = (b && b.length) ? b : def[action];
      }
      global.NP.input.setBindings(merged);
      renderBindings();
    }

    $('btn-start').addEventListener('click', () => {
      global.NP.audio.unlock();
      global.NP.audio.playSfx('ui-confirm');
      renderModeCards();
      showScreen('screen-modes');
    });
    $('btn-settings').addEventListener('click', () => {
      global.NP.audio.playSfx('ui-move');
      showScreen('screen-settings');
    });
    $('btn-help').addEventListener('click', () => {
      global.NP.audio.playSfx('ui-move');
      showScreen('screen-help');
    });
    $('btn-unlocks').addEventListener('click', () => {
      global.NP.audio.playSfx('ui-move');
      renderUnlocks();
      showScreen('screen-unlocks');
    });
    $('btn-mode-back').addEventListener('click', () => {
      global.NP.audio.playSfx('ui-cancel');
      showScreen('screen-menu');
    });
    $('btn-help-back').addEventListener('click', () => {
      global.NP.audio.playSfx('ui-cancel');
      showScreen('screen-menu');
    });
    $('btn-unlocks-back').addEventListener('click', () => {
      global.NP.audio.playSfx('ui-cancel');
      showScreen('screen-menu');
    });
    $('btn-settings-close').addEventListener('click', () => {
      global.NP.audio.playSfx('ui-cancel');
      callbacks.closeSettings ? callbacks.closeSettings() : showScreen('screen-menu');
    });

    // 暂停菜单
    $('btn-resume').addEventListener('click', () => callbacks.resumeGame && callbacks.resumeGame());
    $('btn-pause-restart').addEventListener('click', () => callbacks.restartGame && callbacks.restartGame());
    $('btn-pause-settings').addEventListener('click', () => {
      showScreen('screen-settings');
    });
    // 「返回模式选择」→ 模式选择页 screen-modes（按钮文案 + 场景流转图 P.27「换模式需主动返回模式选择页」）
    $('btn-pause-quit').addEventListener('click', () => {
      const fn = callbacks.quitToModes || callbacks.quitToMenu;
      if (fn) fn();
    });

    // 快速重开确认
    $('btn-restart-yes').addEventListener('click', () => callbacks.restartGame && callbacks.restartGame());
    $('btn-restart-no').addEventListener('click', () => {
      $('screen-restart').classList.add('hidden');
      global.NP.audio.playSfx('ui-cancel');
      callbacks.resumeGame && callbacks.resumeGame();   // 取消 → 恢复对局（冻结时钟解冻）
    });

    // 结算
    $('btn-retry').addEventListener('click', () => {
      if (!canRetry()) { global.NP.audio.playSfx('ui-error'); return; }
      global.NP.audio.playSfx('ui-confirm');
      callbacks.retry && callbacks.retry();
    });
    $('btn-result-modes').addEventListener('click', () => {
      global.NP.audio.playSfx('ui-cancel');
      // 「返回模式选择」→ 模式选择页 screen-modes（与暂停菜单同口径，P.27）
      const fn = callbacks.quitToModes || callbacks.quitToMenu;
      if (fn) fn();
    });
    $('btn-watch-replay').addEventListener('click', () => {
      $('replay-modal').classList.remove('hidden');
      callbacks.watchReplay && callbacks.watchReplay();
    });
    $('btn-replay-close').addEventListener('click', () => {
      $('replay-modal').classList.add('hidden');
    });

    bindSettings();
    applySkin();
    // 触控层初始显隐/透明度（存档口径：设置项持久化，§8.5）
    if (global.NP.touch && global.NP.touch.setPadVisible) {
      global.NP.touch.setPadVisible(save.settings.touchPad !== false);
      global.NP.touch.setPadOpacity(save.settings.touchPadOpacity != null ? save.settings.touchPadOpacity : 0.85);
    }
    global.NP.render.fx.setBgTheme(save.settings.background);
    global.NP.render.fx.setFxLevel(save.settings.fxLevel);
    global.NP.render.fx.setReducedFlash(save.settings.reducedFlash);
    global.NP.render.state.replay.enabled = save.settings.pip;
    document.body.classList.toggle('reduced-flash', save.settings.reducedFlash);
    global.NP.audio.setMuted(save.settings.muted);
    for (const k of Object.keys(save.settings.volumes)) global.NP.audio.setVolume(k, save.settings.volumes[k]);
    renderModeCards();
  }

  global.NP = global.NP || {};
  global.NP.ui = {
    init, t, toast, showScreen, hideAll, hideOverlays, hideResult, showResult, canRetry,
    recordRun, assessUnlocks, getRecord, renderModeCards, renderUnlocks, renderThemeSelects,
    applySkin,
    getSave: () => save,
    getSettings: () => save.settings,
    setLang: (l) => { lang = l; applyI18n(); },
  };

  /* 主循环需要的 t() 快捷入口 */
  global.NP.t = (key, params) => t(key, params);
})(window);
