/**
 * NEON PULSE — 场景流转回归（Node 直接运行： node qa/ui-flow-test.cjs）
 * 用 DOM / 模块桩驱动真实的 src/main.js + src/ui/input.js，复现评审意见的两个场景：
 *   ① 结算页「再来一局」（Space / Enter）触发重开后，同一 keydown 不得再串台成新局的
 *      hardDrop（默认键位 Space）/ pause（街机预设 Enter）——违反 §2.3 / §8.2。
 *   ② 「暂停→设置」按 Esc 返回暂停层后，同一 Esc 不得再被当暂停键穿透成 resumeGame()
 *      （modalOpen 必须含 screen-pause / resume-countdown，且 UI 层消费后不再分发）。
 *   附带：暂停键在暂停层仍是开关语义（再按 = 继续）、快速重开确认期间 Esc 不得穿透。
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.join(__dirname, '..');

let pass = 0, fail = 0;
function check(name, ok, detail) {
  if (ok) { pass++; console.log('  ✔ ' + name); }
  else { fail++; console.log('  ✘ ' + name + (detail ? '  → ' + detail : '')); }
}

/* ==================== DOM / 浏览器环境桩 ==================== */
global.window = global;

// 元素桩：只需 classList / style / textContent / disabled
function makeEl() {
  const classes = new Set(['hidden']);
  return {
    textContent: '', style: {}, disabled: false,
    classList: {
      add: (c) => classes.add(c),
      remove: (c) => classes.delete(c),
      toggle: (c, v) => {
        const want = v === undefined ? !classes.has(c) : !!v;
        if (want) classes.add(c); else classes.delete(c);
      },
      contains: (c) => classes.has(c),
    },
    addEventListener: () => {},
    getContext: () => null,
  };
}
const els = {};
global.document = {
  readyState: 'complete',                 // 让 main.js 立刻走 boot()
  documentElement: { lang: '', style: { setProperty() {} } },
  body: null,                             // 下方 makeEl 后补（classList.toggle('portrait') 用）
  getElementById: (id) => (els[id] || (els[id] = makeEl())),
  addEventListener: () => {},
  querySelectorAll: () => [],
};
global.document.body = makeEl();
global.innerWidth = 1920;                 // fit() 布局判定（横屏）
global.innerHeight = 1080;
const winHandlers = {};
global.addEventListener = (type, fn) => { (winHandlers[type] = winHandlers[type] || []).push(fn); };
global.requestAnimationFrame = () => 0;   // 截断主循环 / 手柄轮询递归
if (typeof global.navigator === 'undefined') {
  Object.defineProperty(global, 'navigator', { value: {}, configurable: true });
}

/* ==================== 模块桩（音频 / 渲染 / UI） ==================== */
const audioCalls = { suspend: 0, resume: 0, sfx: [] };
global.NP = {
  audio: {
    now: () => 0,
    init: () => {}, unlock: () => {},
    resume: () => { audioCalls.resume++; },
    suspend: () => { audioCalls.suspend++; },
    playSfx: (k) => audioCalls.sfx.push(k),
    setBpm: () => {}, onLevel: () => {}, setHeartbeat: () => {},
    setMuted: () => {}, setVolume: () => {}, updateBeat: () => {},
    startGameBgm: () => {}, startMenuBgm: () => {}, startResultBgm: () => {},
    state: { beatPos: 0 },
  },
  render: {
    init: () => {}, frame: () => {}, setDebug: () => {},
    setLayout: () => {},                   // 横/竖屏布局切换（fit() 调用）
    getStageSize: () => ({ W: 1920, H: 1080 }),
    getDebug: () => ({ lastJudge: '—', kick: '—', snapMs: 0 }),
    state: { skinColors: {}, fps: 60, particles: [], debug: {}, replay: { enabled: true } },
    fx: new Proxy({}, { get: () => () => {} }),   // 任意特效调用均为 no-op
  },
  t: (k) => k,
};

// UI 桩：只实现 main.js 用到的接口；canRetry / settings 可在用例中改写；init 捕获回调供用例直调
const uiCbs = {};
const settings = { music: 'main', pip: true, autoPause: true, resumeCountdown: false, restartConfirm: true, muted: false };
const save = {
  dailyBests: {},
  records: { marathon: { score: 0 }, sprint: { timeMs: 0 }, ultra: { score: 0 } },
};
global.NP.ui = {
  init: (cbs) => { Object.assign(uiCbs, cbs || {}); },
  t: (k) => k, toast: () => {},
  showScreen: (id) => {
    for (const s of ['screen-menu', 'screen-modes', 'screen-settings', 'screen-help', 'screen-unlocks', 'screen-result']) {
      global.document.getElementById(s).classList.toggle('hidden', s !== id);
    }
    for (const s of ['screen-pause', 'screen-restart', 'resume-countdown', 'replay-modal']) global.document.getElementById(s).classList.add('hidden');
  },
  hideAll: () => { for (const id of Object.keys(els)) els[id].classList.add('hidden'); },
  hideOverlays: () => { for (const s of ['screen-pause', 'screen-restart', 'resume-countdown', 'replay-modal']) global.document.getElementById(s).classList.add('hidden'); },
  hideResult: () => global.document.getElementById('screen-result').classList.add('hidden'),
  showResult: () => global.document.getElementById('screen-result').classList.remove('hidden'),
  renderModeCards: () => {},
  canRetry: () => true,
  getSettings: () => settings,
  getSave: () => save,
};

/* ==================== 载入真实模块：配置 / 核心 / 输入 / 主流程 ==================== */
for (const f of [
  'config/balance.js', 'config/input.js', 'config/modes.js',
  'core/rng.js', 'core/srs.js', 'core/timing.js', 'core/game.js',
  'ui/input.js', 'main.js',
]) {
  vm.runInThisContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), { filename: f });
}

const app = global.NP.app;                     // main.js 暴露的内部状态
const $ = (id) => global.document.getElementById(id);
const shown = (id) => !$(id).classList.contains('hidden');

// 模拟一次真实键盘事件（keydown 依次送达 input.js / main.js 注册的所有监听器）
function key(code, repeat) {
  const e = { code, repeat: !!repeat, preventDefault() {} };
  for (const fn of winHandlers.keydown || []) fn(e);
}

// 桩：统计玩法层硬降次数（真实 Game 原型）
let hardDrops = 0;
const origHardDrop = global.NP.game.Game.prototype.hardDrop;
global.NP.game.Game.prototype.hardDrop = function () { hardDrops++; return origHardDrop.apply(this, arguments); };

console.log('【场景①】结算页「再来一局」：重开事件不得串台到新局');
{
  // —— 默认键位 Space = 结算页主按钮/说明书重开键，同时也是 hardDrop ——
  app.scene = 'result'; app.game = null; app.modeId = 'sprint';
  audioCalls.suspend = 0;
  hardDrops = 0;
  key('Space');
  check('Space 触发重开并进入新局', app.scene === 'game' && !!app.game);
  check('同一 Space 不得在新局瞬间触发 hardDrop（§2.3 / §8.2）', hardDrops === 0, `hardDrops=${hardDrops}`);

  // —— 街机预设：Enter = pause，同时也是结算页确认键 ——
  global.NP.input.applyPreset('arcade');
  app.scene = 'result'; app.game = null;
  audioCalls.suspend = 0;
  hardDrops = 0;
  key('Enter');
  check('Enter 触发重开并进入新局', app.scene === 'game' && !!app.game);
  check('同一 Enter 不得把新局立刻 pause（暂停遮罩不得弹出）',
    audioCalls.suspend === 0 && !shown('screen-pause') && app.paused === false,
    `suspend=${audioCalls.suspend} paused=${app.paused}`);

  // —— 锁定期（防误触）按键：只播 error，不重开、也不得串台 ——
  global.NP.ui.canRetry = () => false;
  app.scene = 'result'; app.game = { phase: 'over' };   // 结算页真实状态：对局已结束
  hardDrops = 0;
  key('Space');
  check('锁定期 Space 不重开、不串台', app.scene === 'result' && hardDrops === 0);
  global.NP.ui.canRetry = () => true;
  global.NP.input.applyPreset('modern');
}

console.log('【场景②】暂停→设置→Esc 返回：返回不得变成“继续游戏”');
{
  app.scene = 'game'; app.game = { phase: 'falling' }; // 进行中的对局
  app.paused = true; app.resuming = false;
  $('screen-settings').classList.remove('hidden');   // 从暂停菜单进入设置（showScreen 会藏掉暂停层）
  $('screen-pause').classList.add('hidden');
  audioCalls.resume = 0;
  key('Escape');
  check('Esc 返回后停留在暂停层（screen-pause 显示）', shown('screen-pause'));
  check('Esc 返回后设置页关闭', !shown('screen-settings'));
  check('同一 Esc 不得穿透成 resumeGame()（对局仍处暂停）',
    app.paused === true && audioCalls.resume === 0, `paused=${app.paused} resume=${audioCalls.resume}`);

  // —— 模态判定必须含暂停层（静态口径同步校验）——
  const src = fs.readFileSync(path.join(ROOT, 'main.js'), 'utf8');
  check('modalOpen 纳入 screen-pause / resume-countdown',
    /function modalOpen\(\)[\s\S]{0,300}?'screen-pause', 'resume-countdown'/.test(src));
}

console.log('【场景② 附带】暂停键开关语义不回归 / 重开确认不被穿透');
{
  // —— Esc / 暂停键在暂停层仍是开关：再按 = 继续（不能因模态判定被吞掉）——
  app.scene = 'game'; app.paused = true; app.resuming = false;
  $('screen-pause').classList.remove('hidden');
  $('screen-settings').classList.add('hidden');
  key('Escape');
  check('暂停层再按 Esc = 继续游戏（开关语义保留）', app.paused === false && !shown('screen-pause'));

  // —— 未暂停时 Esc = 暂停 ——
  key('Escape');
  check('对局中 Esc = 暂停（遮罩弹出、时钟冻结入口）', app.paused === true && shown('screen-pause'));
  key('Escape');   // 恢复，供下一用例

  // —— 快速重开确认打开时，Esc 不得穿透为 resume ——
  app.scene = 'game'; app.paused = true; app.resuming = false;
  $('screen-restart').classList.remove('hidden');
  $('screen-pause').classList.add('hidden');
  audioCalls.resume = 0;
  key('Escape');
  check('快速重开确认期间 Esc 不得穿透（仍暂停、确认框保留）',
    app.paused === true && shown('screen-restart') && audioCalls.resume === 0);
  $('screen-restart').classList.add('hidden');
}

console.log('【场景① 附带】结算页键盘整体归 UI 层（其他玩法键不泄漏）');
{
  app.scene = 'result'; app.game = { phase: 'over' };
  hardDrops = 0;
  key('KeyR');          // 快速重开键
  key('KeyP');          // 暂停键（默认绑定之一）
  check('结算页按 R / P 不得影响玩法层', app.scene === 'result' && hardDrops === 0);
}

console.log('【场景③】「返回模式选择」必须路由到模式选择页 screen-modes（评审回归）');
{
  // —— 暂停菜单/结算页按钮的回调 quitToModes → screen-modes，而非主菜单 screen-menu ——
  app.scene = 'game';
  app.game = { phase: 'falling', requestQuit() { this.phase = 'over'; } };   // 进行中的对局
  app.paused = true;
  $('screen-pause').classList.remove('hidden');
  audioCalls.resume = 0;
  uiCbs.quitToModes();
  check('暂停菜单「返回模式选择」→ 落在 screen-modes', shown('screen-modes') && !shown('screen-menu'));
  check('退出后本局作废、暂停/重开遮罩全部清理',
    app.scene === 'menu' && app.game === null && app.paused === false && !shown('screen-pause'),
    `scene=${app.scene} paused=${app.paused}`);
  check('退出后音频解冻（冻结时钟不得带进菜单）', audioCalls.resume > 0);

  // —— 结算页同口径 ——
  app.scene = 'result'; app.game = { phase: 'over' };
  uiCbs.quitToModes();
  check('结算页「返回模式选择」→ 落在 screen-modes', shown('screen-modes') && !shown('screen-result'));

  // —— 结算页 Esc「打开菜单」（§2.3）仍回主菜单，不得回归 ——
  app.scene = 'result'; app.game = { phase: 'over' };
  key('Escape');
  check('结算页 Esc 仍回主菜单 screen-menu（§2.3「仅 Esc 打开菜单」）', shown('screen-menu') && !shown('screen-modes'));

  // —— 静态口径同步：按钮文案 =「返回模式选择」且两处按钮都走 quitToModes → screen-modes ——
  const uiSrc = fs.readFileSync(path.join(ROOT, 'ui/ui.js'), 'utf8');
  const mainSrc = fs.readFileSync(path.join(ROOT, 'main.js'), 'utf8');
  check('btn-pause-quit（暂停菜单）走 quitToModes',
    /btn-pause-quit'\)\.addEventListener\('click',[\s\S]{0,200}?quitToModes/.test(uiSrc));
  check('btn-result-modes（结算页）走 quitToModes',
    /btn-result-modes'\)\.addEventListener\('click',[\s\S]{0,250}?quitToModes/.test(uiSrc));
  check('quitToModes 路由到 screen-modes',
    /function quitToModes\(\)\s*\{\s*quitTo\('screen-modes'\)/.test(mainSrc));
}

console.log(`\n结果：${pass} 通过 / ${fail} 失败`);
process.exit(fail ? 1 : 0);
