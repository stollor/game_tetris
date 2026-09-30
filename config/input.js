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

  /* 移动端触控（framework §8.5）：手势识别阈值 + 虚拟按键区。
     手势 → 动作映射见 §8.5 表（src/ui/touch.js GESTURE_ACTIONS，表驱动测试 tests/test-touch.cjs）。*/
  touch: {
    /* 手势阈值（工程阈值；动作映射数据行取自 §8.5 表） */
    tapMaxMs: 260,          // 点击最大时长（超过且静止 = 长按候选）
    tapMaxPx: 24,           // 点击最大位移（超过 = 滑动，不触发点击旋转）
    doubleTapMs: 280,       // 双击判定窗口
    doubleTapPx: 80,        // 双击两次落点最大距离
    longPressMs: 420,       // 长按 → Hold
    softDropPx: 24,         // 下滑进入软降的最小位移
    swipeUpPx: 60,          // 上滑 → 180° 旋转
    hardDropVelPxMs: 0.85,  // 快速下滑松手 → 硬降的松手速度阈值（px/ms）
    hardDropMinPx: 60,      // 触发硬降的最小下滑距离
    /* 边缘 DAS 快速连移（§8.5「含 DAS 快速连移」，与 §7.4 DAS/ARR 同值） */
    edgeZonePx: 48,         // 抵住屏幕左右边缘的判定带宽
    edgeDASms: 133,         // = §7.4 DAS
    edgeARRms: 33,          // = §7.4 ARR
    /* 虚拟按键区（§8.5：左/右/旋转/软降/硬降 + Hold；可设开关与透明度） */
    padMinPx: 44,           // 单个触控目标最小边长（CSS px，§8.5 / DoD 10）
    padDefaultOpacity: 0.85,
    padButtons: [
      { action: 'moveLeft',  icon: '\u25C0', labelKey: 'touch.left' },
      { action: 'moveRight', icon: '\u25B6', labelKey: 'touch.right' },
      { action: 'rotateCCW', icon: '\u21BA', labelKey: 'touch.ccw' },
      { action: 'rotateCW',  icon: '\u21BB', labelKey: 'touch.cw' },
      { action: 'softDrop',  icon: '\u25BC', labelKey: 'touch.soft' },
      { action: 'hardDrop',  icon: '\u21D3', labelKey: 'touch.hard' },
      { action: 'hold',      icon: '\u21C4', labelKey: 'touch.hold' },
    ],
  },

  /* 局内快速重开确认（§8.4：默认先弹确认） */
  restartConfirmDefault: true,
};
