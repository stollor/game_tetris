/**
 * NEON PULSE — 移动端触控输入层（framework §8.5）
 *
 * 结构（纯逻辑 + DOM 绑定分离，表驱动测试 tests/test-touch.cjs）：
 *   1. GESTURE_ACTIONS   —— §8.5「手势 → 动作」映射表（唯一口径，测试逐行断言）
 *   2. createRecognizer —— 手势识别状态机（纯函数式输入采样，无 DOM 依赖）
 *   3. createDispatcher —— 手势 → onAction(name, down) 动作分发（与键盘/手柄同一动作接口，§8.5）
 *   4. buildPad / bindPauseButton / bindSurface —— 虚拟按键区（≥44×44px、多点触控、可设开关与透明度）
 *      与顶部暂停入口（触控暂停入口必须存在，不依赖手势误触）
 *
 * §8.5 手势映射（全文唯一口径）：
 *   左/右滑动 → 移动（跟手步进：每跨约 1 格宽移一步，含 DAS 快速连移）
 *   下滑      → 软降（跟手加速）
 *   快速下滑（速度超阈值松手）→ 硬降
 *   点击右/左半区 → 顺/逆时针旋转
 *   双击 / 上滑 → 180° 旋转（双击零等待：首击立即旋转，第二击补偿回退 + 180°，净效果恰 180°）
 *   长按      → Hold
 *   顶部暂停按钮 → 暂停
 */
(function (global) {
  'use strict';

  /* ==================== §8.5 手势 → 动作映射表 ====================
   * down: true  = 按住型动作按下（softDrop 软降按住）
   * down: false = 按住型动作松开
   * 无 down 字段 = 离散脉冲（按下 + 立即松开）
   */
  const GESTURE_ACTIONS = {
    moveStepLeft:  [{ action: 'moveLeft' }],           // 跟手步进：每次跨格 = 一次离散移动脉冲
    moveStepRight: [{ action: 'moveRight' }],
    softStart:     [{ action: 'softDrop', down: true }],
    softEnd:       [{ action: 'softDrop', down: false }],
    hardDrop:      [{ action: 'hardDrop' }],
    tapRight:      [{ action: 'rotateCW' }],           // 点击屏幕右半区
    tapLeft:       [{ action: 'rotateCCW' }],          // 点击屏幕左半区
    swipeUp:       [{ action: 'rotate180' }],          // 上滑
    longPress:     [{ action: 'hold' }],               // 长按
    pauseTap:      [{ action: 'pause' }],              // 顶部暂停按钮
    // 双击：special（首击已立即旋转，第二击先补偿回退首击旋转量再 180°，净效果恰 180°；
    // 不引入双击等待窗口，单击响应 ≤1 帧）
    doubleTap: 'compensated',
  };

  /** 双击补偿：已知首击手势（tapRight/tapLeft），返回动作序列（净效果 = 180°） */
  function gestureToActions(gesture, payload) {
    if (gesture === 'doubleTap') {
      const inverse = (payload && payload.first) === 'tapLeft' ? 'rotateCW' : 'rotateCCW';
      return [{ action: inverse }, { action: 'rotate180' }];
    }
    return GESTURE_ACTIONS[gesture] || [];
  }

  /** 动作分发器：手势 → onAction(name, down)（与键盘/手柄同一动作接口，§8.5 等价） */
  function createDispatcher(onAction) {
    return function dispatch(gesture, payload) {
      for (const a of gestureToActions(gesture, payload)) {
        if (a.down === true) onAction(a.action, true);
        else if (a.down === false) onAction(a.action, false);
        else { onAction(a.action, true); onAction(a.action, false); }   // 离散脉冲
      }
    };
  }

  /* ==================== 手势识别状态机（纯逻辑） ==================== */
  const DEFAULTS = {
    tapMaxMs: 260, tapMaxPx: 24, doubleTapMs: 280, doubleTapPx: 80,
    longPressMs: 420, softDropPx: 24, swipeUpPx: 60,
    hardDropVelPxMs: 0.85, hardDropMinPx: 60,
    edgeZonePx: 48, edgeDASms: 133, edgeARRms: 33,
    cellPx: 50, regionW: 390,
  };

  function resolveCfg(overrides) {
    const conf = (global.NP_CONFIG && global.NP_CONFIG.input && global.NP_CONFIG.input.touch) || {};
    const cfg = Object.assign({}, DEFAULTS, conf, overrides || {});
    return cfg;
  }

  /**
   * 创建识别器。emit(gesture, payload) 为手势输出回调。
   * 指针采样：down / move / up / cancel；tick(t) 驱动长按与边缘 DAS 连移（DOM 层走 RAF）。
   */
  function createRecognizer(overrides, emit) {
    const cfg = resolveCfg(overrides);
    const pointers = new Map();       // pointerId -> 采样状态
    let lastTap = null;               // 双击判定：上一次点击 { t, x, y, side, first }

    function down(id, x, y, t) {
      pointers.set(id, {
        x0: x, y0: y, x, y, t0: t, lastTickT: t,
        steps: 0,                     // 已发步数（跟手步进锚点）
        axis: null,                   // null | 'h' | 'v'（首次超点击阈值时锁定主导轴）
        softOn: false,
        longFired: false,
        edgeT: 0, edgeCharged: false,
        samples: [{ x, y, t }],
      });
    }

    /** 松手竖直速度：取最近 ~100ms 采样窗口的 dy/dt（px/ms） */
    function recentVy(p, x, y, t) {
      let ref = p.samples[0];
      for (const s of p.samples) { if (t - s.t <= 100) { ref = s; break; } }
      const dt = t - ref.t;
      return dt > 0 ? (y - ref.y) / dt : 0;
    }

    function move(id, x, y, t) {
      const p = pointers.get(id);
      if (!p) return;
      p.x = x; p.y = y;
      p.samples.push({ x, y, t });
      if (p.samples.length > 8) p.samples.shift();
      const dx = x - p.x0, dy = y - p.y0;
      // 主导轴锁定：超出点击阈值后按位移主导方向判定（斜向不误判双轴）
      if (p.axis === null && Math.max(Math.abs(dx), Math.abs(dy)) > cfg.tapMaxPx) {
        p.axis = Math.abs(dx) >= Math.abs(dy) ? 'h' : 'v';
      }
      if (p.axis === 'h') {
        // 跟手步进（§8.5）：每跨约 1 格宽一步，快速滑动多格 = 全部送达（DAS 快速连移）。
        // 跨格判定带 0.5px 亚像素容差：触控坐标量化噪声（±0.1px 级）不得让“恰好跨 3 格”欠一步。
        const EPS = 0.5;
        const mag = Math.abs(dx) + EPS;
        const target = (dx < 0 ? -1 : 1) * Math.trunc(mag / cfg.cellPx);
        while (p.steps < target) { p.steps++; p.lastStepT = t; emit(dx > 0 ? 'moveStepRight' : 'moveStepLeft'); }
        while (p.steps > target) { p.steps--; p.lastStepT = t; emit(dx > 0 ? 'moveStepRight' : 'moveStepLeft'); }
      } else if (p.axis === 'v') {
        if (dy > cfg.softDropPx && !p.softOn) { p.softOn = true; emit('softStart'); }
      }
    }

    function up(id, x, y, t) {
      const p = pointers.get(id);
      if (!p) return;
      pointers.delete(id);
      const dx = x - p.x0, dy = y - p.y0;
      const dur = t - p.t0;

      if (p.softOn) emit('softEnd');            // 先释放软降，绝不残留按住态

      // 上滑 → 180° 旋转
      if (dy < -cfg.swipeUpPx && Math.abs(dy) >= Math.abs(dx)) {
        if (!p.longFired) emit('swipeUp');
        return;
      }
      // 下滑 → 软降（已释放）；速度超阈值松手 → 硬降（§8.5）
      if (dy > cfg.softDropPx || p.axis === 'v') {
        const vy = recentVy(p, x, y, t);
        if (dy >= cfg.hardDropMinPx && vy >= cfg.hardDropVelPxMs && !p.longFired) emit('hardDrop');
        return;
      }
      if (p.axis === 'h') return;               // 滑动：步进已在 move 中发出
      if (p.longFired) return;                  // 长按已触发 Hold，松手不再算点击

      // 点击（位移与时长都在阈值内）→ 左/右半区旋转；同侧快速两次 = 双击 180°
      if (Math.abs(dx) <= cfg.tapMaxPx && Math.abs(dy) <= cfg.tapMaxPx && dur <= cfg.tapMaxMs) {
        const side = x < cfg.regionW / 2 ? 'left' : 'right';
        const prev = lastTap;
        if (prev && side === prev.side
          && t - prev.t <= cfg.doubleTapMs
          && Math.abs(x - prev.x) <= cfg.doubleTapPx && Math.abs(y - prev.y) <= cfg.doubleTapPx) {
          lastTap = null;
          emit('doubleTap', { side, first: prev.first });   // first = 首击动作（补偿回退用）
          return;
        }
        const first = side === 'left' ? 'tapLeft' : 'tapRight';
        emit(first, { x, y });
        lastTap = { t, x, y, side, first };
      }
    }

    function cancel(id, t) {
      const p = pointers.get(id);
      if (!p) return;
      pointers.delete(id);
      if (p.softOn) emit('softEnd');
    }

    /** 时间驱动：长按判定 + 边缘 DAS 快速连移（DOM 层 RAF 每帧调用） */
    function tick(t) {
      for (const p of pointers.values()) {
        const dt = Math.max(0, t - p.lastTickT);
        // 长按（静止按住达阈值）→ Hold，仅一次
        if (!p.longFired && p.axis === null
          && Math.abs(p.x - p.x0) <= cfg.tapMaxPx && Math.abs(p.y - p.y0) <= cfg.tapMaxPx
          && t - p.t0 >= cfg.longPressMs) {
          p.longFired = true;
          emit('longPress');
        }
        // 边缘 DAS 快速连移（§8.5「含 DAS 快速连移」，DAS/ARR 与 §7.4 同值）：
        // 仅当指头抵住屏幕左右边缘持续按住时启用，中部静止按住不连发（无误触连发）
        if (p.axis === 'h') {
          const atRight = p.x >= cfg.regionW - cfg.edgeZonePx;
          const atLeft = p.x <= cfg.edgeZonePx;
          if (atRight || atLeft) {
            const gesture = atRight ? 'moveStepRight' : 'moveStepLeft';
            p.edgeT += dt;
            if (!p.edgeCharged) {
              if (p.edgeT >= cfg.edgeDASms) { p.edgeCharged = true; p.edgeT = 0; emit(gesture); }
            } else {
              while (p.edgeT >= cfg.edgeARRms) { p.edgeT -= cfg.edgeARRms; emit(gesture); }
            }
          } else {
            p.edgeT = 0; p.edgeCharged = false;
          }
        }
        p.lastTickT = t;
      }
    }

    return {
      down, move, up, cancel, tick,
      setRegion: (w) => { cfg.regionW = w; },
      getCfg: () => cfg,
      activeCount: () => pointers.size,
      reset: () => { pointers.clear(); lastTap = null; },
    };
  }

  /* ==================== DOM 绑定层 ==================== */
  const state = {
    onAction: null,
    rec: null,
    dispatch: null,
    surface: null, pad: null, pauseBtn: null,
    gameActive: false,
    padVisible: true,
    raf: 0,
  };

  const fire = (action, down) => { if (state.onAction) state.onAction(action, down); };

  /** 构建虚拟按键区（§8.5：左/右/旋转/软降/硬降 + Hold，多点触控，≥44×44px） */
  function buildPad(container, onAction, touchCfg) {
    const cfg = touchCfg || ((global.NP_CONFIG && global.NP_CONFIG.input.touch) || {});
    container.replaceChildren();
    for (const spec of cfg.padButtons || []) {
      const btn = document.createElement('button');
      btn.className = 'touch-btn pad-btn';
      btn.dataset.action = spec.action;
      btn.textContent = spec.icon;
      const label = (global.NP.t ? global.NP.t(spec.labelKey) : spec.action);
      btn.title = label;
      btn.setAttribute('aria-label', label);
      // 多点触控：每个按键独立跟踪 pointerId（按住方向的同时点旋转，§8.5）
      const held = new Set();
      const press = (e) => {
        if (e.preventDefault) e.preventDefault();
        held.add(e.pointerId);
        if (btn.setPointerCapture) { try { btn.setPointerCapture(e.pointerId); } catch (_) { /* 桩环境 */ } }
        onAction(spec.action, true);
      };
      const release = (e) => {
        if (!held.has(e.pointerId)) return;
        held.delete(e.pointerId);
        onAction(spec.action, false);
      };
      btn.addEventListener('pointerdown', press);
      btn.addEventListener('pointerup', release);
      btn.addEventListener('pointercancel', release);
      btn.addEventListener('lostpointercapture', release);
      container.appendChild(btn);
    }
  }

  /** 顶部暂停入口（§8.5：触控暂停入口必须存在，不依赖手势误触） */
  function bindPauseButton(btn, onAction) {
    if (!btn.textContent) btn.textContent = '\u275A\u275A';          // ❚❚ 暂停图标（中文可读标签见 title）
    if (global.NP.t) btn.title = global.NP.t('touch.pause');
    btn.setAttribute('aria-label', btn.title || 'pause');
    btn.addEventListener('pointerdown', (e) => {
      if (e.preventDefault) e.preventDefault();
      onAction('pause', true);
    });
  }

  /**
   * 手势区绑定（对局画布）。仅触控/笔输入驱动方块手势；
   * 鼠标不做方块操作（§8.1：鼠标仅用于菜单），菜单点击走 DOM 按钮不受影响。
   */
  function bindSurface(surface, rec, emitGesture) {
    const handlers = {
      pointerdown: (e) => {
        if (e.pointerType === 'mouse') return;
        if (e.preventDefault) e.preventDefault();
        if (surface.setPointerCapture) { try { surface.setPointerCapture(e.pointerId); } catch (_) { /* 桩环境 */ } }
        rec.down(e.pointerId, e.clientX, e.clientY, nowMs());
      },
      pointermove: (e) => {
        if (e.pointerType === 'mouse') return;
        rec.move(e.pointerId, e.clientX, e.clientY, nowMs());
      },
      pointerup: (e) => {
        if (e.pointerType === 'mouse') return;
        rec.up(e.pointerId, e.clientX, e.clientY, nowMs());
      },
      pointercancel: (e) => { rec.cancel(e.pointerId, nowMs()); },
      lostpointercapture: (e) => { rec.cancel(e.pointerId, nowMs()); },
    };
    for (const type of Object.keys(handlers)) surface.addEventListener(type, handlers[type]);
    void emitGesture;
  }

  const nowMs = () => (global.performance && global.performance.now ? global.performance.now() : Date.now());

  /** 视口/布局变化：同步手势区宽度（点击左右半区分界）与跟手步进格宽（CSS px） */
  function syncMetrics() {
    if (!state.rec || !state.surface) return;
    const rect = state.surface.getBoundingClientRect ? state.surface.getBoundingClientRect() : null;
    const render = global.NP.render;
    const stageW = render && render.getStageSize ? render.getStageSize().W : 1920;
    const cellUnits = render && render.LAY && render.LAY.field ? render.LAY.field.cell : 40;
    if (rect && rect.width) {
      state.rec.setRegion(rect.width);
      state.rec.getCfg().cellPx = cellUnits * rect.width / stageW;
    }
  }

  /** 显隐与透明度（§8.5：虚拟按键区可设置开关与透明度） */
  function setPadVisible(v) {
    state.padVisible = !!v;
    applyVisibility();
  }
  function setPadOpacity(v) {
    if (state.pad) state.pad.style.opacity = String(v == null ? 1 : v);
    if (state.pauseBtn) state.pauseBtn.style.opacity = String(v == null ? 1 : v);
  }
  function applyVisibility() {
    const show = state.gameActive && state.padVisible;
    if (state.pad) state.pad.classList.toggle('hidden', !show);
    if (state.pauseBtn) state.pauseBtn.classList.toggle('hidden', !state.gameActive);
  }
  /** 对局开始/结束：控制触控层显隐；离开对局时清掉全部按住态，防“幽灵输入” */
  function setGameActive(v) {
    state.gameActive = !!v;
    if (!v && state.rec) {
      const cfg = state.rec.getCfg();
      // 释放可能残留的软降按住
      fire('softDrop', false);
      state.rec.reset();
      void cfg;
    }
    applyVisibility();
  }

  /** 主循环驱动：长按 / 边缘 DAS 连移的时间推进 */
  function tickLoop() {
    if (state.rec) state.rec.tick(nowMs());
    state.raf = global.requestAnimationFrame ? global.requestAnimationFrame(tickLoop) : 0;
  }

  function init(opts) {
    opts = opts || {};
    state.onAction = opts.onAction || fire;
    state.dispatch = createDispatcher(state.onAction);
    state.rec = createRecognizer(opts.overrides || {}, (g, p) => state.dispatch(g, p));
    state.surface = opts.surface || null;
    state.pad = opts.pad || null;
    state.pauseBtn = opts.pauseBtn || null;

    if (state.surface) bindSurface(state.surface, state.rec, state.dispatch);
    if (state.pad) {
      buildPad(state.pad, state.onAction,
        (global.NP_CONFIG && global.NP_CONFIG.input && global.NP_CONFIG.input.touch) || {});
    }
    if (state.pauseBtn) bindPauseButton(state.pauseBtn, state.onAction);

    syncMetrics();
    applyVisibility();
    if (global.requestAnimationFrame) tickLoop();
  }

  global.NP = global.NP || {};
  global.NP.touch = {
    init, setGameActive, setPadVisible, setPadOpacity, syncMetrics,
    _test: {
      createRecognizer, createDispatcher, gestureToActions,
      GESTURE_ACTIONS, buildPad, bindPauseButton,
    },
  };
})(window);
