/**
 * NEON PULSE — 输入层（framework §8.1）
 * 键盘 + 手柄（Gamepad API 标准映射）；动作统一走 onAction(name, down)。
 * 移动端触控（手势 / 虚拟按键区 / 顶部暂停入口，§8.5）在 src/ui/touch.js 实现，
 * 同样回调 onAction 动作接口 —— 三端一套逻辑，可热切换，不走两套分发。
 * 玩法输入不做鼠标（v1）；鼠标只用于菜单（DOM 层）。
 * 重绑定支持 + 冲突校验（键位全局无冲突）。
 */
(function (global) {
  'use strict';

  const ICfg = () => global.NP_CONFIG.input;

  // 动作名 → 是否为“按住型”（move/soft 走 held + DAS；其余为离散按下）
  const HOLDABLE = { moveLeft: 1, moveRight: 1, softDrop: 1 };

  const state = {
    bindings: null,          // action -> [{code}]
    codeMap: {},             // code -> [action]
    onAction: null,
    onUiKey: null,           // 菜单层键盘导航（可选）
    capture: null,           // 重绑定捕获回调
    enabled: true,
    gpPrev: {},              // 手柄上一帧按键状态
    gpHeld: {},
  };

  function cloneBindings(b) {
    const out = {};
    for (const k of Object.keys(b)) out[k] = b[k].map((x) => (typeof x === 'string' ? { code: x } : Object.assign({}, x)));
    return out;
  }

  function rebuildMap() {
    state.codeMap = {};
    for (const action of Object.keys(state.bindings)) {
      for (const b of state.bindings[action]) {
        if (!state.codeMap[b.code]) state.codeMap[b.code] = [];
        state.codeMap[b.code].push(action);
      }
    }
  }

  function setBindings(b) {
    state.bindings = cloneBindings(b);
    rebuildMap();
  }

  /** 冲突校验：同一物理键不得绑定到多个动作（同动作多键位允许） */
  function validateBindings(b) {
    const seen = {};
    const conflicts = [];
    for (const action of Object.keys(b)) {
      for (const bind of b[action]) {
        const code = typeof bind === 'string' ? bind : bind.code;
        if (seen[code] && seen[code] !== action) conflicts.push({ code, actions: [seen[code], action] });
        seen[code] = action;
      }
    }
    return conflicts;
  }

  function applyPreset(name) {
    const preset = ICfg().presets[name];
    if (!preset) return;
    const out = {};
    for (const action of Object.keys(preset)) out[action] = preset[action].map((c) => ({ code: c }));
    setBindings(out);
  }

  /* ==================== 键盘 ==================== */
  function onKeyDown(e) {
    if (state.capture) {
      e.preventDefault();
      const cb = state.capture;
      state.capture = null;
      cb(e.code);
      return;
    }
    // 菜单层：交给 UI（Esc / 方向 / 回车等）。
    // 返回 true = 事件已被 UI 层消费（如结算页「再来一局」的空格/回车已切入新局、
    // 暂停菜单「返回」的 Esc 已切回暂停层），必须立即终止向玩法层分发：
    // 否则同一 keydown 会串台成新局的 hardDrop / pause（违反 §2.3 空格/回车重开、§8.2 输入响应语义）。
    if (state.onUiKey && state.onUiKey(e) === true) return;
    const actions = state.codeMap[e.code];
    if (!actions || !state.enabled) return;
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault();
    if (e.repeat) return;   // 系统重复按住交给 DAS/ARR，不重复触发离散动作
    for (const action of actions) {
      if (state.onAction) state.onAction(action, true);
    }
    for (const action of actions) {
      if (!HOLDABLE[action]) continue;   // 离散动作按下即触发，无“释放”语义
    }
  }

  function onKeyUp(e) {
    const actions = state.codeMap[e.code];
    if (!actions) return;
    // 松手事件无条件送达（不受 enabled / 阶段影响）：
    // 吞掉 key up 会让 DAS / 软降状态残留，产生“幽灵移动”
    for (const action of actions) {
      if (HOLDABLE[action] && state.onAction) state.onAction(action, false);
    }
  }

  /* ==================== 手柄（轮询） ==================== */
  function pollGamepad() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const gp = pads && pads[0];
    const cfg = ICfg().gamepad;
    const fire = (action, down) => {
      const key = 'gp:' + action;
      if (state.gpHeld[key] === down) return;
      state.gpHeld[key] = down;
      if (state.onAction) state.onAction(action, down);
    };
    if (gp && state.enabled) {
      const axisX = gp.axes[cfg.moveAxis] || 0;
      const axisY = gp.axes[cfg.softAxis] || 0;
      const dz = cfg.axisDeadzone;
      fire('moveLeft', axisX < -dz || (gp.buttons[14] && gp.buttons[14].pressed));
      fire('moveRight', axisX > dz || (gp.buttons[15] && gp.buttons[15].pressed));
      fire('softDrop', axisY > dz || (gp.buttons[13] && gp.buttons[13].pressed));
      const map = [
        ['rotateCW', cfg.rotateCW], ['rotateCCW', cfg.rotateCCW], ['rotate180', cfg.rotate180],
        ['hardDrop', cfg.hardDrop], ['hold', cfg.hold], ['pause', cfg.pause],
      ];
      for (const [action, idx] of map) {
        const btn = gp.buttons[idx];
        fire(action, !!(btn && btn.pressed));
      }
    } else {
      // 手柄断开 / 输入禁用：释放所有残留的按住状态，避免“幽灵输入”
      for (const key of Object.keys(state.gpHeld)) {
        if (!state.gpHeld[key]) continue;
        state.gpHeld[key] = false;
        const action = key.slice(3);          // 'gp:xxx' → 'xxx'
        if (state.onAction) state.onAction(action, false);
      }
    }
    requestAnimationFrame(pollGamepad);
  }

  function init(opts) {
    opts = opts || {};
    state.onAction = opts.onAction || null;
    state.onUiKey = opts.onUiKey || null;
    setBindings(ICfg().defaultBindings);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    requestAnimationFrame(pollGamepad);
  }

  /** 重绑定捕获：下一个按键即新绑定 */
  function captureNextKey(cb) { state.capture = cb; }

  global.NP = global.NP || {};
  global.NP.input = {
    init, setBindings, getBindings: () => state.bindings,
    validateBindings, applyPreset, captureNextKey,
    setEnabled: (v) => { state.enabled = v; },
  };
})(window);
