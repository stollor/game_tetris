/**
 * NEON PULSE — 移动端触控输入层（framework §8.5 按键唯一口径 · ticket-0002）
 *
 * 结构（纯逻辑 + DOM 绑定分离，表驱动测试 tests/test-touch.cjs）：
 *   1. BUTTON_ACTIONS    —— §8.5「按键 → 动作」映射表（唯一口径，测试逐行断言）
 *   2. createButtonController —— 3+3 按键时序状态机（纯逻辑，无 DOM 依赖）
 *   3. createDispatcher  —— 按键事件 → onAction(name, down) 动作分发（与键盘/手柄同一动作接口，§8.5）
 *   4. buildPad / bindPauseButton —— 手柄式 3+3 操作区（各 200×104、多点触控各键独立）
 *      与顶部暂停入口（常驻，不依赖手势）
 *
 * §8.5 键语义（全文唯一口径）：
 *   ← / →        移动（DAS=133ms / ARR=33ms，口径同 §7.4；同时按住后按优先，松开后按者回落先按者重起）
 *   ↓ 按住       软降；双击 ↓ = 硬降（两次↓按下起点间隔 ≤300ms，第二击按下瞬间触发）
 *   ↑ 短按       180° 旋转（未达长按阈值松手）；↑ 长按 = Hold（达阈值即触发：标准档 400ms / 长档 650ms）
 *   左转/右转    逆 / 顺时针旋转（等价 §8.1 的 Z / ↑或X）
 *   顶部 ❚❚      暂停（常驻入口）
 * 移动端无手势：滑动/快滑/点两半区/上滑/双击等手势映射整体废除，只保留按键 + 顶部暂停入口。
 */
(function (global) {
  'use strict';

  /* ==================== §8.5 按键 → 动作映射表 ====================
   * down: true  = 按住型动作按下（move / softDrop 按住）
   * down: false = 按住型动作松开
   * 无 down 字段 = 离散脉冲（按下 + 立即松开，按按下顺序依次执行）
   */
  const BUTTON_ACTIONS = {
    moveLeftDown:  [{ action: 'moveLeft', down: true }],
    moveLeftUp:    [{ action: 'moveLeft', down: false }],
    moveRightDown: [{ action: 'moveRight', down: true }],
    moveRightUp:   [{ action: 'moveRight', down: false }],
    turnLeft:      [{ action: 'rotateCCW' }],    // 第1排左键：逆时针
    turnRight:     [{ action: 'rotateCW' }],     // 第1排右键：顺时针
    upShort:       [{ action: 'rotate180' }],    // ↑短按：180° 旋转
    upLong:        [{ action: 'hold' }],         // ↑长按：Hold 暂存
    downDown:      [{ action: 'softDrop', down: true }],   // ↓按住：软降
    downUp:        [{ action: 'softDrop', down: false }],  // ↓松开：释放软降
    downDouble:    [{ action: 'hardDrop' }],     // ↓双击第二击：硬降
    pauseTap:      [{ action: 'pause', down: true }],      // 顶部暂停入口
  };

  /** 按键事件 → 动作序列（未知事件返回空数组，不得抛错） */
  function buttonToActions(event) {
    return BUTTON_ACTIONS[event] || [];
  }

  /** 动作分发器：按键事件 → onAction(name, down)（与键盘/手柄同一动作接口，§8.5 禁两套逻辑） */
  function createDispatcher(onAction) {
    return function dispatch(event, payload) {
      void payload;
      for (const a of buttonToActions(event)) {
        if (a.down === true) onAction(a.action, true);
        else if (a.down === false) onAction(a.action, false);
        else { onAction(a.action, true); onAction(a.action, false); }   // 离散脉冲
      }
    };
  }

  /* ==================== 3+3 按键时序状态机（纯逻辑） ==================== */
  const DEFAULTS = {
    doubleDownMs: 300,
    holdMs: 400,          // ↑长按阈值（标准档 400 / 长档 650，由存档 touchHoldMode 派生）
  };

  function resolveCfg(overrides) {
    const conf = (global.NP_CONFIG && global.NP_CONFIG.input && global.NP_CONFIG.input.touch) || {};
    const cfg = {
      doubleDownMs: conf.doubleDownMs != null ? conf.doubleDownMs : DEFAULTS.doubleDownMs,
      holdMs: conf.holdStandardMs != null ? conf.holdStandardMs : DEFAULTS.holdMs,
    };
    if (overrides) {
      if (overrides.doubleDownMs != null) cfg.doubleDownMs = overrides.doubleDownMs;
      if (overrides.holdMs != null) cfg.holdMs = overrides.holdMs;
      // 兼容：直接传标准/长档数值
      if (overrides.holdStandardMs != null && overrides.holdMs == null) cfg.holdMs = overrides.holdStandardMs;
    }
    return cfg;
  }

  /**
   * 创建按键控制器。emit(event, payload) 为按键事件输出回调（接 createDispatcher）。
   * 按键标识 key ∈ left / right / turnLeft / turnRight / up / down。
   * 时间 t 单位 ms（单调递增即可，测试注入；DOM 层用 performance.now）。
   * 方法：press(key, t) / release(key, t) / tick(t) / reset() / setHoldMs(ms)。
   */
  function createButtonController(overrides, emit) {
    const cfg = resolveCfg(overrides);
    const st = {
      moveStack: [],        // 按住中的移动键栈（'left'/'right'，按 press 顺序；栈顶 = 后按优先）
      leftHeld: false,
      rightHeld: false,
      downHeld: false,
      downLastPressT: null, // ↓双击待判：上一次↓按下起点时刻（暂停/结算/重开时清掉）
      upHeld: false,
      upPressT: 0,
      upFired: false,       // ↑长按已触发 Hold（触发后不补 180°）
    };

    function press(key, t) {
      if (key === 'left' || key === 'right') {
        const flag = key === 'left' ? 'leftHeld' : 'rightHeld';
        if (st[flag]) return;                       // 同键重复按下忽略（多点同键不双发）
        st[flag] = true;
        st.moveStack.push(key);
        emit(key === 'left' ? 'moveLeftDown' : 'moveRightDown');
        return;
      }
      if (key === 'turnLeft') { emit('turnLeft'); return; }
      if (key === 'turnRight') { emit('turnRight'); return; }
      if (key === 'up') {
        if (st.upHeld) return;
        st.upHeld = true;
        st.upPressT = t;
        st.upFired = false;
        return;
      }
      if (key === 'down') {
        // 双击 ↓ = 两次↓按下起点间隔 ≤300ms，第二击按下瞬间触发硬降（时序唯一口径）。
        // 超窗为两次独立软降。双击第二击只发硬降（不叠发软降按住），松手时统一释放。
        if (st.downLastPressT != null && t - st.downLastPressT <= cfg.doubleDownMs) {
          st.downHeld = true;
          st.downLastPressT = t;                    // 链式：连续快点每次都可硬降
          emit('downDouble');
          return;
        }
        st.downHeld = true;
        st.downLastPressT = t;
        emit('downDown');
        return;
      }
    }

    function release(key, t) {
      void t;
      if (key === 'left' || key === 'right') {
        const flag = key === 'left' ? 'leftHeld' : 'rightHeld';
        if (!st[flag]) return;
        st[flag] = false;
        // 是否栈顶被移除：只有松开后按者（栈顶）才回落先按者（§8.5 后按优先）
        const wasTop = st.moveStack.length && st.moveStack[st.moveStack.length - 1] === key;
        const idx = st.moveStack.lastIndexOf(key);
        if (idx >= 0) st.moveStack.splice(idx, 1);
        emit(key === 'left' ? 'moveLeftUp' : 'moveRightUp');
        // 回落重起 DAS/ARR（§7.4）：重新分发一次剩余栈顶的 press（游戏层 setHeld 重置 dasTimer）
        if (wasTop && st.moveStack.length) {
          const top = st.moveStack[st.moveStack.length - 1];
          emit(top === 'left' ? 'moveLeftDown' : 'moveRightDown');
        }
        return;
      }
      if (key === 'turnLeft' || key === 'turnRight') return;  // 离散键松手无语义
      if (key === 'up') {
        if (!st.upHeld) return;
        st.upHeld = false;
        if (st.upFired) return;                     // 长按已触发 Hold，松手不补 180°
        emit('upShort');                            // 未达阈值松手 = 180°
        return;
      }
      if (key === 'down') {
        if (!st.downHeld) return;
        st.downHeld = false;
        emit('downUp');
        return;
      }
    }

    /** 时间驱动：↑长按判定（达阈值即触发，不等松手，触发后不补 180°；他键同按不中断计时） */
    function tick(t) {
      if (st.upHeld && !st.upFired && t - st.upPressT >= cfg.holdMs) {
        st.upFired = true;
        emit('upLong');
      }
    }

    function reset() {
      st.moveStack.length = 0;
      st.leftHeld = false;
      st.rightHeld = false;
      st.downHeld = false;
      st.downLastPressT = null;
      st.upHeld = false;
      st.upFired = false;
    }

    return {
      press, release, tick, reset,
      setHoldMs: (ms) => { cfg.holdMs = ms; },
      getCfg: () => cfg,
      getState: () => ({ moveStack: st.moveStack.slice(), leftHeld: st.leftHeld, rightHeld: st.rightHeld, downHeld: st.downHeld, upHeld: st.upHeld, upFired: st.upFired, downLastPressT: st.downLastPressT }),
    };
  }

  // 历史别名：旧手势识别器已废除（§8.5 无手势）。保留 createRecognizer 名字作兼容桩，
  // 直接返回按键控制器，避免旧引用崩溃；新代码一律用 createButtonController。
  function createRecognizer(overrides, emit) {
    return createButtonController(overrides, emit);
  }

  /* ==================== DOM 绑定层 ==================== */
  const state = {
    onAction: null,
    ctrl: null,
    dispatch: null,
    surface: null, pad: null, pauseBtn: null,
    gameActive: false,
    holdMs: 400,
    raf: 0,
    lastTick: 0,
  };

  const fire = (action, down) => { if (state.onAction) state.onAction(action, down); };

  /** 当前 Hold 阈值（存档 touchHoldMode 派生：standard 400 / long 650） */
  function currentHoldMs() {
    const touchCfg = (global.NP_CONFIG && global.NP_CONFIG.input && global.NP_CONFIG.input.touch) || {};
    try {
      const ui = global.NP && global.NP.ui && global.NP.ui.getSettings ? global.NP.ui.getSettings() : null;
      const mode = ui && ui.touchHoldMode;
      if (mode === 'long') return touchCfg.holdLongMs != null ? touchCfg.holdLongMs : 650;
      return touchCfg.holdStandardMs != null ? touchCfg.holdStandardMs : 400;
    } catch (_) { return 400; }
  }

  /** 构建手柄式 3+3 操作区（§8.5 / M-04：第1排 左转·↑·右转；第2排 ←·↓·→，各 200×104，多点触控） */
  function buildPad(container, onAction, touchCfg) {
    const cfg = touchCfg || ((global.NP_CONFIG && global.NP_CONFIG.input.touch) || {});
    container.replaceChildren();
    const buttons = (cfg.padButtons || []).slice().sort((a, b) => (a.row - b.row) || 0);
    // 两排容器（M-04 操作区两排各 3 键）
    const rows = {};
    for (const spec of buttons) {
      const r = spec.row || 1;
      if (!rows[r]) {
        const div = document.createElement('div');
        div.className = 'touch-pad-row touch-pad-row-' + r;
        container.appendChild(div);
        rows[r] = div;
      }
    }
    const ctrlHolder = { ctrl: null };
    for (const spec of buttons) {
      const key = spec.key || spec.action;
      const btn = document.createElement('button');
      btn.className = 'touch-btn pad-btn pad-key-' + key;
      btn.dataset.key = key;
      btn.dataset.action = spec.action;
      btn.dataset.labelKey = spec.labelKey || '';
      // 图标 + 中文键名（双行，图标大、键名小；文案经 i18n，不得另立语义）
      const icon = document.createElement('span');
      icon.className = 'pad-icon';
      icon.textContent = spec.icon;
      const nm = document.createElement('span');
      nm.className = 'pad-name';
      nm.textContent = (global.NP.t ? global.NP.t(spec.labelKey) : spec.action);
      btn.appendChild(icon);
      btn.appendChild(nm);
      const label = nm.textContent || spec.action;
      btn.title = label;
      btn.setAttribute('aria-label', label);
      // 每个按键独立跟踪 pointerId（多点触控：按住移动同时点旋转，各键独立通道互不取消）
      const heldPointers = new Set();
      const keyOf = () => key;
      const press = (e) => {
        if (e.preventDefault) e.preventDefault();
        const pid = e.pointerId != null ? e.pointerId : Math.random();
        if (heldPointers.has(pid)) return;
        heldPointers.add(pid);
        if (btn.setPointerCapture) { try { btn.setPointerCapture(e.pointerId); } catch (_) { /* 桩环境 */ } }
        routePress(keyOf(), nowMs());
      };
      const release = (e) => {
        const pid = e.pointerId != null ? e.pointerId : null;
        if (pid != null && !heldPointers.has(pid)) return;
        if (pid != null) heldPointers.delete(pid);
        else heldPointers.clear();
        routeRelease(keyOf(), nowMs());
      };
      btn.addEventListener('pointerdown', press);
      btn.addEventListener('pointerup', release);
      btn.addEventListener('pointercancel', release);
      btn.addEventListener('lostpointercapture', release);
      // 键盘焦点操作（无障碍：Enter/Space 等同点按）
      btn.addEventListener('keydown', (e) => {
        if (e.code === 'Enter' || e.code === 'Space') { e.preventDefault(); routePress(keyOf(), nowMs()); }
      });
      btn.addEventListener('keyup', (e) => {
        if (e.code === 'Enter' || e.code === 'Space') { e.preventDefault(); routeRelease(keyOf(), nowMs()); }
      });
      (rows[spec.row || 1] || container).appendChild(btn);
      void ctrlHolder;
    }
    void onAction;
  }

  // 路由：DOM 按键 → 控制器 → dispatch → onAction（同一动作接口，禁两套逻辑）
  function routePress(key, t) {
    if (!state.ctrl || !state.dispatch) return;
    const emit = (ev, p) => state.dispatch(ev, p);
    // 控制器实例的 press 需经 emit 转 dispatch；这里直接调用控制器方法，
    // 控制器的 emit 已在 init 时绑定为 dispatch。
    state.ctrl.press(key, t);
    void emit;
  }
  function routeRelease(key, t) {
    if (!state.ctrl || !state.dispatch) return;
    state.ctrl.release(key, t);
  }

  /** 顶部暂停入口（§8.5：常驻，不依赖手势） */
  function bindPauseButton(btn, onAction) {
    if (!btn.textContent) btn.textContent = '\u275A\u275A';          // ❚❚ 暂停图标（中文可读标签见 title）
    if (global.NP.t) btn.title = global.NP.t('touch.pause');
    btn.setAttribute('aria-label', btn.title || 'pause');
    btn.addEventListener('pointerdown', (e) => {
      if (e.preventDefault) e.preventDefault();
      onAction('pause', true);
      onAction('pause', false);
    });
  }

  const nowMs = () => (global.performance && global.performance.now ? global.performance.now() : Date.now());

  /** 视口/布局变化：刷新 Hold 阈值（存档派生），手势区同步已废除（无手势，保留空实现兼容） */
  function syncMetrics() {
    if (state.ctrl) state.ctrl.setHoldMs(currentHoldMs());
  }

  /** 按键常驻不可关（§8.5）：无开关字段；setPadVisible 保留作兼容空操作（恒按“可见”处理） */
  function setPadVisible(v) {
    void v;
    applyVisibility();
  }
  function setPadOpacity(v) {
    const op = v == null ? 0.85 : v;
    if (state.pad) state.pad.style.opacity = String(op);
    if (state.pauseBtn) state.pauseBtn.style.opacity = String(op);
  }
  function setHoldMs(ms) {
    state.holdMs = ms;
    if (state.ctrl) state.ctrl.setHoldMs(ms);
  }
  function applyVisibility() {
    // 模态层打开时隐藏操作区与暂停入口（P0/P1：设置/暂停等面板不得被 3+3 按键层遮挡，
    // elementFromPoint 必须命中面板控件；z-index 兜底见 css）。
    const modal = isModalOpen();
    // 桌面键鼠默认不显示（D-06），移动端（竖屏或粗指针）对局中常驻：
    // 同一玩法核心与动作接口，显隐只影响 DOM，不影响逻辑。
    const coarse = (global.matchMedia && global.matchMedia('(pointer: coarse)').matches)
      || document.body.classList.contains('portrait');
    const show = state.gameActive && coarse && !modal;
    // 无粗指针 API 的测试桩环境默认显示（便于断言按键存在）
    const showEff = (global.matchMedia ? show : (state.gameActive && !modal ? true : false));
    if (state.pad) state.pad.classList.toggle('hidden', !showEff);
    if (state.pauseBtn) state.pauseBtn.classList.toggle('hidden', !state.gameActive || modal);
    // 菜单态画布必须隐藏（M-01）：对局外隐藏画布，菜单 keyart 横幅不受对局画布污染
    const canvas = document.getElementById ? document.getElementById('game-canvas') : null;
    if (canvas && canvas.classList) canvas.classList.toggle('hidden', !state.gameActive);
  }

  /** 是否有模态层打开（设置/帮助/模式/成就/结算/暂停/重开确认/回放/倒计时） */
  function isModalOpen() {
    try {
      const ids = ['screen-settings', 'screen-help', 'screen-modes', 'screen-unlocks',
        'screen-result', 'screen-pause', 'screen-restart', 'replay-modal', 'resume-countdown'];
      for (const id of ids) {
        const n = document.getElementById ? document.getElementById(id) : null;
        if (n && n.classList && !n.classList.contains('hidden')) return true;
      }
    } catch (_) { /* 桩环境 */ }
    return false;
  }

  /** 语言切换后刷新按键文案（P2：applyI18n 只刷 data-i18n，按键在 init 一次性构建） */
  function refreshPadLabels() {
    try {
      if (state.pad && state.pad.children) {
        for (const row of state.pad.children) {
          if (!row || !row.children) continue;
          for (const btn of row.children) {
            const lk = btn.dataset && btn.dataset.labelKey;
            if (!lk || !global.NP.t) continue;
            const txt = global.NP.t(lk);
            let nm = null;
            if (btn.querySelector) { try { nm = btn.querySelector('.pad-name'); } catch (_) { nm = null; } }
            if (!nm && btn.children) {
              for (const c of btn.children) {
                if (c.className && c.className.indexOf('pad-name') >= 0) { nm = c; break; }
              }
            }
            if (nm) nm.textContent = txt;
            if (txt) { btn.title = txt; if (btn.setAttribute) btn.setAttribute('aria-label', txt); }
          }
        }
      }
      if (state.pauseBtn && global.NP.t) {
        const tp = global.NP.t('touch.pause');
        if (tp) { state.pauseBtn.title = tp; if (state.pauseBtn.setAttribute) state.pauseBtn.setAttribute('aria-label', tp); }
      }
    } catch (_) { /* 桩环境 */ }
  }
  /** 对局开始/结束：控制触控层显隐；离开对局时清掉全部按住态、双击待判与长按计时 */
  function setGameActive(v) {
    state.gameActive = !!v;
    if (!v && state.ctrl) {
      // 释放可能残留的按住（左/右移动、软降），防“幽灵输入”；双击待判与长按计时一并清掉
      fire('moveLeft', false);
      fire('moveRight', false);
      fire('softDrop', false);
      state.ctrl.reset();
    }
    if (state.ctrl) state.ctrl.setHoldMs(currentHoldMs());
    applyVisibility();
  }
  /** 暂停/结算/切后台/重开时清掉全部按住态、双击待判与长按计时（恢复后需重按） */
  function clearHeld() {
    if (!state.ctrl) return;
    fire('moveLeft', false);
    fire('moveRight', false);
    fire('softDrop', false);
    state.ctrl.reset();
  }

  /** 主循环驱动：↑长按判定的时间推进 */
  function tickLoop() {
    if (state.ctrl) state.ctrl.tick(nowMs());
    state.raf = global.requestAnimationFrame ? global.requestAnimationFrame(tickLoop) : 0;
  }

  function init(opts) {
    opts = opts || {};
    state.onAction = opts.onAction || fire;
    state.dispatch = createDispatcher(state.onAction);
    state.ctrl = createButtonController(opts.overrides || { holdMs: currentHoldMs() }, (ev, p) => state.dispatch(ev, p));
    state.ctrl.setHoldMs(currentHoldMs());
    state.surface = opts.surface || null;
    state.pad = opts.pad || null;
    state.pauseBtn = opts.pauseBtn || null;

    // 移动端无手势：对局画布不再绑定手势区（滑动/点按手势整体废除，防系统手势冲突）
    void state.surface;
    if (state.pad) {
      buildPad(state.pad, state.onAction,
        (global.NP_CONFIG && global.NP_CONFIG.input && global.NP_CONFIG.input.touch) || {});
    }
    if (state.pauseBtn) bindPauseButton(state.pauseBtn, state.onAction);

    syncMetrics();
    applyVisibility();
    if (global.requestAnimationFrame && !state.raf) tickLoop();
    // 竖屏/指针变化时刷新显隐
    if (global.matchMedia && global.matchMedia('(pointer: coarse)').addEventListener) {
      try { global.matchMedia('(pointer: coarse)').addEventListener('change', applyVisibility); } catch (_) { /* 兼容 */ }
    }
  }

  global.NP = global.NP || {};
  global.NP.touch = {
    init, setGameActive, setPadVisible, setPadOpacity, syncMetrics, setHoldMs, clearHeld,
    refresh: applyVisibility, refreshPadLabels,
    _test: {
      createButtonController, createRecognizer, createDispatcher, buttonToActions,
      BUTTON_ACTIONS, buildPad, bindPauseButton,
    },
  };
})(window);
