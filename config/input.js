/**
 * NEON PULSE — 输入映射配置（framework §8.1）
 * 键位全局无冲突（强制）：A/D 专用于左右移动；180° 仅 W；软降 S、Hold C、重开 R 不与移动/旋转重叠。
 * code 采用 KeyboardEvent.code（物理键位），label 仅作显示。
 */
window.NP_CONFIG = window.NP_CONFIG || {};
window.NP_CONFIG.input = {
  /* 默认绑定（预设：现代） */
  defaultBindings: {
    moveLeft:  [{ code: 'ArrowLeft' }, { code: 'KeyA' }],
    moveRight: [{ code: 'ArrowRight' }, { code: 'KeyD' }],
    rotateCW:  [{ code: 'ArrowUp' }, { code: 'KeyX' }],
    rotateCCW: [{ code: 'KeyZ' }, { code: 'ControlLeft' }, { code: 'ControlRight' }],
    rotate180: [{ code: 'KeyW' }],
    softDrop:  [{ code: 'ArrowDown' }, { code: 'KeyS' }],
    hardDrop:  [{ code: 'Space' }],
    hold:      [{ code: 'ShiftLeft' }, { code: 'ShiftRight' }, { code: 'KeyC' }],
    pause:     [{ code: 'Escape' }, { code: 'KeyP' }],
    restart:   [{ code: 'KeyR' }],
    mute:      [{ code: 'KeyM' }],
  },

  /* 预设：现代 / 街机 / 左手（重绑定冲突校验在 ui 设置里执行） */
  presets: {
    modern: {
      moveLeft: ['ArrowLeft', 'KeyA'], moveRight: ['ArrowRight', 'KeyD'],
      rotateCW: ['ArrowUp', 'KeyX'], rotateCCW: ['KeyZ', 'ControlLeft'],
      rotate180: ['KeyW'], softDrop: ['ArrowDown', 'KeyS'], hardDrop: ['Space'],
      hold: ['ShiftLeft', 'KeyC'], pause: ['Escape', 'KeyP'], restart: ['KeyR'], mute: ['KeyM'],
    },
    arcade: {
      moveLeft: ['ArrowLeft'], moveRight: ['ArrowRight'],
      rotateCW: ['ArrowUp'], rotateCCW: ['KeyZ', 'ControlLeft'],
      rotate180: ['KeyX'], softDrop: ['ArrowDown'], hardDrop: ['Space'],
      hold: ['ShiftLeft', 'KeyC'], pause: ['Enter', 'KeyP'], restart: ['KeyR'], mute: ['KeyM'],
    },
    lefthand: {
      moveLeft: ['KeyA'], moveRight: ['KeyD'],
      rotateCW: ['KeyE', 'KeyX'], rotateCCW: ['KeyQ', 'KeyZ'],
      rotate180: ['KeyW'], softDrop: ['KeyS'], hardDrop: ['Space'],
      hold: ['KeyF'], pause: ['Escape', 'KeyP'], restart: ['KeyR'], mute: ['KeyM'],
    },
  },

  /* 手柄（Gamepad API 标准映射） */
  gamepad: {
    moveAxis: 0,          // 左摇杆横轴 + 十字键
    softAxis: 1,          // 右摇杆纵轴（下为正）/ 十字键下
    rotateCW: 0,          // A / ×
    rotateCCW: 1,         // B / ○
    rotate180: 3,         // Y / △
    hardDrop: 7,          // RT / R2
    hold: 4,              // LB / L1
    pause: 9,             // Start
    axisDeadzone: 0.4,
  },

  /* 移动端触控（framework §8.5 按键唯一口径 · ticket-0002）：手柄式 3+3 按键，无手势。
     按键 → 动作映射见 §8.5 键语义表（src/ui/touch.js BUTTON_ACTIONS，表驱动测试 tests/test-touch.cjs）。*/
  touch: {
    /* 按键时序（全文唯一口径，见 framework §8.5） */
    doubleDownMs: 300,      // ↓双击窗：两次↓按下起点间隔 ≤300ms 即判双击，第二击按下瞬间触发硬降
    holdStandardMs: 400,    // ↑长按 Hold 标准档阈值（达阈值即触发，不等松手）
    holdLongMs: 650,        // ↑长按 Hold 长档阈值
    /* 手柄式 3+3 操作区（§8.5 / M-04：各 200×104，多点触控各键独立） */
    padMinPx: 44,           // 单个触控目标最小边长（CSS px 下限，实际 200×104，§8.5 / DoD 10）
    padDefaultOpacity: 0.85, // 按键透明度默认（范围 0.30–1.00，步进 0.05）
    padOpacityMin: 0.30,
    padOpacityMax: 1.00,
    padOpacityStep: 0.05,
    // row: 1 = 第1排 左转·↑·右转；2 = 第2排 ←·↓·→（左转/右转在←/→正上方、↑在↓正上方）
    // key: 按键标识（controller press/release 用）；action: 离散键的直达动作；
    // up/down 为特殊键（短/长、按住/双击），经 controller 时序后分发，不直达。
    padButtons: [
      { key: 'turnLeft',  action: 'rotateCCW', icon: '\u21BA', labelKey: 'touch.ccw',   row: 1 },
      { key: 'up',        action: 'up',        icon: '\u2191', labelKey: 'touch.up',    row: 1 },
      { key: 'turnRight', action: 'rotateCW',  icon: '\u21BB', labelKey: 'touch.cw',    row: 1 },
      { key: 'left',      action: 'moveLeft',  icon: '\u25C0', labelKey: 'touch.left',  row: 2 },
      { key: 'down',      action: 'down',      icon: '\u25BC', labelKey: 'touch.down',  row: 2 },
      { key: 'right',     action: 'moveRight', icon: '\u25B6', labelKey: 'touch.right', row: 2 },
    ],
  },

  /* 局内快速重开确认（§8.4：默认先弹确认） */
  restartConfirmDefault: true,
};
