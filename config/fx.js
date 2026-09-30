/**
 * NEON PULSE — 特效强度分级配置（framework §8.3 / 02-animation-design §12，唯一口径）
 */
window.NP_CONFIG = window.NP_CONFIG || {};
window.NP_CONFIG.fx = {
  levels: ['low', 'mid', 'high'],
  defaultLevel: 'mid',
  mapping: {
    //  low           mid            high
    low:  { shake: 0,        particle: 0.35, fullscreenPulse: 0, edgeGlow: 0, bloom: 0.5,  danger: 0.5, panelFlow: 0, sparks: false },
    mid:  { shake: 1,        particle: 1,    fullscreenPulse: 1, edgeGlow: 0, bloom: 1.0,  danger: 1,   panelFlow: 1, sparks: true },
    high: { shake: 1.12,     particle: 1,    fullscreenPulse: 1, edgeGlow: 1, bloom: 1.15, danger: 1,   panelFlow: 1, sparks: true },
  },
  // 可访问性：无闪烁强光（关闭高频闪烁类特效/音效）
  reducedFlashDefault: false,
};
