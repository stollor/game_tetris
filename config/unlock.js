/**
 * NEON PULSE — 解锁 / 成就配置（framework §6.2）
 * 解锁为纯外观/内容，不提供任何数值优势（公平性）。
 */
window.NP_CONFIG = window.NP_CONFIG || {};
window.NP_CONFIG.unlock = {
  /* 方块主题配色（默认"经典霓虹"自带）：累计消除行数里程碑 */
  skins: [
    { id: 'classic',     nameKey: 'skin.classic',     lines: 0,    colors: null }, // 使用默认色板
    { id: 'neonpink',    nameKey: 'skin.neonpink',    lines: 100,
      colors: { I: '#FF4FD8', O: '#FFD54F', T: '#B388FF', S: '#69F0AE', Z: '#FF6E9C', J: '#82B1FF', L: '#FFAB40' } },
    { id: 'cyberyellow', nameKey: 'skin.cyberyellow', lines: 500,
      colors: { I: '#FFD54F', O: '#FFF59D', T: '#FFC107', S: '#C6FF00', Z: '#FF9100', J: '#FFE082', L: '#FF6F00' } },
    { id: 'mono',        nameKey: 'skin.mono',        lines: 2000,
      colors: { I: '#EAF2FF', O: '#D5DEEF', T: '#B8C4DE', S: '#CFE0FF', Z: '#9FB0D0', J: '#C6D2EC', L: '#E2E9F7' } },
    { id: 'amber',       nameKey: 'skin.amber',       lines: 5000,
      colors: { I: '#FFB300', O: '#FFE082', T: '#FF8F00', S: '#FFCA28', Z: '#FF6D00', J: '#FFA726', L: '#FFD180' } },
  ],

  /* 背景主题：雨夜 / 数据流 / 日蚀 */
  backgrounds: [
    { id: 'default',   nameKey: 'bg.default',   condKey: 'unlock.bg.none' },
    { id: 'rain',      nameKey: 'bg.rain',      cond: { type: 'marathonLevel', level: 10 }, condKey: 'unlock.bg.rain' },     // = 90 行
    { id: 'dataflow',  nameKey: 'bg.dataflow',  cond: { type: 'marathonLevel', level: 15 }, condKey: 'unlock.bg.dataflow' }, // = 140 行（通关）
    { id: 'eclipse',   nameKey: 'bg.eclipse',   cond: { type: 'sprintUnder', seconds: 60 }, condKey: 'unlock.bg.eclipse' },
  ],

  /* 音乐曲目（额外 BGM）：完成每日挑战累计次数 */
  musics: [
    { id: 'main',         nameKey: 'music.main',  daily: 0 },
    { id: 'alt_neon_rain', nameKey: 'music.neonrain', daily: 3,  condKey: 'unlock.music.3' },
    { id: 'alt_eclipse',   nameKey: 'music.eclipse',  daily: 10, condKey: 'unlock.music.10' },
  ],

  /* 称号成就（6 个，条件闭合） */
  titles: [
    { id: 'comboManiac', nameKey: 'title.comboManiac', condKey: 'title.comboManiac.cond', cond: { type: 'maxCombo', value: 10 } },
    { id: 'flawless',    nameKey: 'title.flawless',    condKey: 'title.flawless.cond',    cond: { type: 'pcCount', value: 3 } },
    { id: 'spinner',     nameKey: 'title.spinner',     condKey: 'title.spinner.cond',     cond: { type: 'tspinClears', value: 8 } },
    { id: 'windbreaker', nameKey: 'title.windbreaker', condKey: 'title.windbreaker.cond', cond: { type: 'sprintUnder', seconds: 60 } },
    { id: 'ironwall',    nameKey: 'title.ironwall',    condKey: 'title.ironwall.cond',    cond: { type: 'marathonLevel', level: 15 } },
    { id: 'regular',     nameKey: 'title.regular',     condKey: 'title.regular.cond',     cond: { type: 'dailyCount', value: 30 } },
  ],
};
