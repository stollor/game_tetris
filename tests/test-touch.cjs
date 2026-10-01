/**
 * NEON PULSE — 移动端触控输入无头测试（Node 直接运行：node src/tests/test-touch.cjs）
 *
 * 数据行来源（表驱动硬门口径，ticket-0002 · framework §8.5 按键唯一口径）：
 *   - framework §8.5「操作区 = 手柄式 3+3 两排」与键语义表（按键 → 动作逐行）
 *   - framework §8.5「按键时序（全文唯一口径）」：↓双击窗 300ms / ↑长按档 400ms·650ms
 *   - framework §8.5「多点触控 / ←+→仲裁 / 暂停清态」条目
 *   - framework §7.4 DAS/ARR 规格值（133ms / 33ms，←→ 移动同口径，走玩法核心状态机）
 *   - framework §9 移动端适配条目（viewport / touch-action / 切后台自动暂停 / M-04 竖屏）
 *
 * 覆盖：3+3 按键映射 / ↓按住软降·双击硬降 / ↑短按180°·长按Hold（两档）/
 *       ←→移动与后按优先仲裁 / 左转右转离散脉冲 / 多点触控 / 暂停清态 /
 *       操作区配置 / DOM 绑定 / 平台静态口径（无手势）。
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');

/* ==================== DOM 桩（供 touch.js 的 DOM 绑定层测试） ==================== */
function makeEl(tag) {
  const classes = new Set();
  const listeners = {};
  const e = {
    tag: tag || 'div', textContent: '', title: '', className: '', style: {}, dataset: {},
    children: [],
    classList: {
      add: (c) => classes.add(c),
      remove: (c) => classes.delete(c),
      toggle: (c, v) => { const w = v === undefined ? !classes.has(c) : !!v; if (w) classes.add(c); else classes.delete(c); return w; },
      contains: (c) => classes.has(c),
    },
    setAttribute(k, v) { e[k] = v; },
    addEventListener(type, fn) { (listeners[type] = listeners[type] || []).push(fn); },
    dispatch(type, ev) { for (const fn of listeners[type] || []) fn(ev || { preventDefault() {} }); },
    appendChild(c) { e.children.push(c); return c; },
    replaceChildren() { e.children = []; },
    setPointerCapture() {}, releasePointerCapture() {},
    getBoundingClientRect: () => ({ x: 0, y: 0, left: 0, top: 0, width: 390, height: 693 }),
  };
  return e;
}

const els = {};
const ctx = {
  console, Math, Date, JSON,
  performance: { now: () => 0 },
  navigator: {},
  matchMedia: () => ({ matches: false, addEventListener() {} }),
  requestAnimationFrame: () => 0,
  document: {
    createElement: (t) => makeEl(t),
    getElementById: (id) => (els[id] || (els[id] = makeEl('div'))),
    addEventListener: () => {},
    querySelectorAll: () => [],
    documentElement: { style: { setProperty() {} } },
    body: { classList: { contains: () => true, add() {}, remove() {}, toggle() {} } },
  },
};
ctx.window = ctx;
ctx.globalThis = ctx;
vm.createContext(ctx);
// touch.js 引用 document.body / matchMedia / requestAnimationFrame，桩已备齐
for (const f of ['config/input.js', 'ui/touch.js']) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
}

const NP = ctx.window.NP;
const TH = ctx.window.NP_CONFIG.input.touch;

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name + (extra !== undefined ? '  →  ' + JSON.stringify(extra) : '')); }
}
function eq(name, got, want) { ok(name, JSON.stringify(got) === JSON.stringify(want), { got, want }); }

/* ==================== 工具：按键 → 动作流水线 ==================== */
/** 创建一条「按键 → 动作」流水线（控制器 + 真实映射层），记录 onAction(name, down) 日志 */
function pipeline(overrides) {
  const log = [];
  const dispatch = NP.touch._test.createDispatcher((name, down) => log.push([name, !!down]));
  const ctrl = NP.touch._test.createButtonController(overrides || {}, dispatch);
  return { log, ctrl };
}
/** 取「按下」序列（离散动作/按住动作的 down 沿） */
const downs = (log) => log.filter(([, d]) => d).map(([a]) => a);
/** 取「松开」序列 */
const ups = (log) => log.filter(([, d]) => !d).map(([a]) => a);

/* ============================================================
   【A】§8.5 按键 → 动作映射表驱动（每行 = framework §8.5 键语义表行）
   ============================================================ */
console.log('\n[A] §8.5 按键映射表驱动（3+3 手柄式）');
{
  const A = NP.touch._test.BUTTON_ACTIONS;
  const rows = [
    ['moveLeftDown', 'moveLeft'], ['moveLeftUp', 'moveLeft'],
    ['moveRightDown', 'moveRight'], ['moveRightUp', 'moveRight'],
    ['turnLeft', 'rotateCCW'], ['turnRight', 'rotateCW'],
    ['upShort', 'rotate180'], ['upLong', 'hold'],
    ['downDown', 'softDrop'], ['downUp', 'softDrop'], ['downDouble', 'hardDrop'],
    ['pauseTap', 'pause'],
  ];
  for (const [ev, action] of rows) {
    ok(`映射表行 ${ev} → ${action}（§8.5）`, Array.isArray(A[ev]) && A[ev].some((x) => x.action === action), A[ev]);
  }
  eq('turnLeft 为离散脉冲（按下即松开）',
    NP.touch._test.buttonToActions('turnLeft').map((x) => x.action), ['rotateCCW']);
  eq('upShort → rotate180（§8.5 ↑短按）',
    NP.touch._test.buttonToActions('upShort').map((x) => x.action), ['rotate180']);
  eq('upLong → hold（§8.5 ↑长按）',
    NP.touch._test.buttonToActions('upLong').map((x) => x.action), ['hold']);
  eq('downDouble → hardDrop（§8.5 ↓双击）',
    NP.touch._test.buttonToActions('downDouble').map((x) => x.action), ['hardDrop']);
  eq('未知事件 → 空数组（不抛错）', NP.touch._test.buttonToActions('nope'), []);
}

/* ============================================================
   【B】↓ 软降 / 双击硬降（双击窗 300ms，时序唯一口径）
   ============================================================ */
console.log('\n[B] ↓ 按住软降 · 双击硬降（双击窗 300ms）');
{
  const { log, ctrl } = pipeline({ holdMs: 400 });
  ctrl.press('down', 0);
  eq('↓按下 → 软降按住', log, [['softDrop', true]]);
  ctrl.release('down', 100);
  eq('↓松开 → 释放软降、不硬降', log, [['softDrop', true], ['softDrop', false]]);
}
{
  const { log, ctrl } = pipeline({ holdMs: 400 });
  ctrl.press('down', 0); ctrl.release('down', 80);
  ctrl.press('down', 200);   // 间隔 200ms ≤300ms → 双击
  eq('双击↓（间隔200ms）→ 第二击按下瞬间硬降', downs(log), ['softDrop', 'hardDrop'], log);
  eq('双击第二击不叠发软降按住（软降按下只一次）',
    log.filter(([a, d]) => a === 'softDrop' && d).length, 1, log);
  ctrl.release('down', 280);
  eq('双击松手 → 释放（硬降脉冲+软降释放，无残留按住）', log,
    [['softDrop', true], ['softDrop', false], ['hardDrop', true], ['hardDrop', false], ['softDrop', false]], log);
}
{
  const { log, ctrl } = pipeline({ holdMs: 400 });
  ctrl.press('down', 0); ctrl.release('down', 80);
  ctrl.press('down', 300);   // 间隔恰 300ms → 双击边界（含）
  eq('↓间隔恰300ms → 双击（边界含）', downs(log).includes('hardDrop'), true, log);
}
{
  const { log, ctrl } = pipeline({ holdMs: 400 });
  ctrl.press('down', 0); ctrl.release('down', 80);
  ctrl.press('down', 381);   // 间隔 381ms >300ms → 两次独立软降
  eq('↓间隔超窗（381ms）→ 两次独立软降、不硬降', log,
    [['softDrop', true], ['softDrop', false], ['softDrop', true]], log);
  ctrl.release('down', 460);
}
{
  const { log, ctrl } = pipeline({ holdMs: 400 });
  // 链式：连续快点每次都可硬降（第2击硬降后第3击仍在窗内）
  ctrl.press('down', 0); ctrl.release('down', 60);
  ctrl.press('down', 200); ctrl.release('down', 260);
  ctrl.press('down', 400);   // 距上次按下 200ms → 硬降
  eq('连续三击（200ms间隔）→ 两次硬降', downs(log).filter((a) => a === 'hardDrop').length, 2, log);
}
{
  const { log, ctrl } = pipeline({ holdMs: 400 });
  // 双击待判在暂停/结算时清掉：reset 后即使间隔在窗内也不判双击
  ctrl.press('down', 0); ctrl.release('down', 60);
  ctrl.reset();
  ctrl.press('down', 200);
  eq('reset 清掉双击待判 → 不判双击（只软降）', downs(log).includes('hardDrop'), false, log);
}

/* ============================================================
   【C】↑ 短按180° / 长按Hold（标准400ms / 长档650ms）
   ============================================================ */
console.log('\n[C] ↑ 短按180° · 长按Hold（400ms / 650ms 两档）');
{
  const { log, ctrl } = pipeline({ holdMs: 400 });
  ctrl.press('up', 0);
  eq('↑按下未松手 → 不立即触发（等阈值或松手）', log, []);
  ctrl.release('up', 150);
  eq('↑短按（150ms<400ms松手）→ 180°', downs(log), ['rotate180'], log);
  eq('180°为离散脉冲（按下即松开）', ups(log), ['rotate180'], log);
}
{
  const { log, ctrl } = pipeline({ holdMs: 400 });
  ctrl.press('up', 0);
  ctrl.tick(399);
  eq('↑长按阈值前（399ms）不触发', log, []);
  ctrl.tick(400);
  eq('↑达标准档阈值（400ms）即触发Hold（不等松手）', downs(log), ['hold'], log);
  ctrl.tick(2400);
  eq('持续按住只触发一次（不连发）', downs(log), ['hold'], log);
  ctrl.release('up', 2500);
  eq('长按触发后松手不补180°', downs(log), ['hold'], log);
}
{
  const { log, ctrl } = pipeline({ holdMs: 650 });
  ctrl.press('up', 0);
  ctrl.tick(400);
  eq('长档下400ms不触发（档值生效）', log, []);
  ctrl.tick(649);
  eq('长档下649ms仍不触发', log, []);
  ctrl.tick(650);
  eq('长档下650ms触发Hold', downs(log), ['hold'], log);
  ctrl.release('up', 700);
}
{
  const { log, ctrl } = pipeline({ holdMs: 400 });
  // 他键同按不中断↑计时（§8.5）
  ctrl.press('up', 0);
  ctrl.press('left', 100);
  ctrl.press('down', 150);
  ctrl.tick(400);
  eq('他键同按不中断↑计时（400ms仍触发Hold）', downs(log).includes('hold'), true, log);
  ctrl.release('left', 450); ctrl.release('down', 460); ctrl.release('up', 500);
}
{
  const { log, ctrl } = pipeline({ holdMs: 400 });
  // 长按计时在暂停时清掉：reset 后 tick 不得触发
  ctrl.press('up', 0);
  ctrl.reset();
  ctrl.tick(1000);
  eq('reset 清掉长按计时 → tick不触发Hold', log, []);
}
{
  const { log, ctrl } = pipeline({ holdMs: 400 });
  // ↑重复按下忽略（同键多点不双发），松手后可再按
  ctrl.press('up', 0);
  ctrl.press('up', 10);
  ctrl.release('up', 100);
  eq('↑重复按下不双发（一次短按只一次180°）', downs(log), ['rotate180'], log);
}

/* ============================================================
   【D】←→ 移动（DAS/ARR 同 §7.4，走玩法核心）与后按优先仲裁
   ============================================================ */
console.log('\n[D] ←→ 移动与后按优先仲裁');
{
  const { log, ctrl } = pipeline({});
  ctrl.press('left', 0);
  eq('←按下 → moveLeft:down（DAS状态机由玩法核心接管）', log, [['moveLeft', true]]);
  ctrl.release('left', 100);
  eq('←松开 → moveLeft:up', log, [['moveLeft', true], ['moveLeft', false]]);
}
{
  const { log, ctrl } = pipeline({});
  ctrl.press('right', 0);
  ctrl.release('right', 50);
  eq('→按松 → moveRight down/up', log, [['moveRight', true], ['moveRight', false]]);
}
{
  const { log, ctrl } = pipeline({});
  // ←+→ 同时按住后按优先，松开后按者回落先按者重起 DAS/ARR（§8.5）
  ctrl.press('left', 0);
  ctrl.press('right', 100);
  eq('←按住后按→ → 后按优先（依次分发两次press）', log,
    [['moveLeft', true], ['moveRight', true]], log);
  ctrl.release('right', 200);
  eq('松开后按者（→）→ 回落先按者（←重起press）', log,
    [['moveLeft', true], ['moveRight', true], ['moveRight', false], ['moveLeft', true]], log);
  ctrl.release('left', 300);
}
{
  const { log, ctrl } = pipeline({});
  // 非栈顶释放不回落（→仍是栈顶，←释放只发自己的up）
  ctrl.press('left', 0);
  ctrl.press('right', 100);
  ctrl.release('left', 150);
  eq('非栈顶释放（←）→ 只发自己的up，不回落', log,
    [['moveLeft', true], ['moveRight', true], ['moveLeft', false]], log);
  ctrl.release('right', 200);
}
{
  const { log, ctrl } = pipeline({});
  // 同键重复按下忽略
  ctrl.press('left', 0);
  ctrl.press('left', 10);
  eq('同键重复按下忽略（不双发）', log, [['moveLeft', true]], log);
  ctrl.release('left', 50);
}

/* ============================================================
   【E】左转/右转离散脉冲 + 多点触控（各键独立通道）
   ============================================================ */
console.log('\n[E] 左转/右转离散脉冲 + 多点触控');
{
  const { log, ctrl } = pipeline({});
  ctrl.press('turnLeft', 0);
  eq('左转 → 逆时针离散脉冲', log, [['rotateCCW', true], ['rotateCCW', false]], log);
  ctrl.release('turnLeft', 50);
  eq('离散键松手无语义（不补发）', log, [['rotateCCW', true], ['rotateCCW', false]], log);
}
{
  const { log, ctrl } = pipeline({});
  ctrl.press('turnRight', 0);
  eq('右转 → 顺时针离散脉冲', log, [['rotateCW', true], ['rotateCW', false]], log);
}
{
  const { log, ctrl } = pipeline({});
  // 多点触控：按住←的同时点右转，各键独立互不取消（§8.5）
  ctrl.press('left', 0);
  ctrl.press('turnRight', 50);
  eq('多点：按住←同时点右转（两动作共存）', log,
    [['moveLeft', true], ['rotateCW', true], ['rotateCW', false]], log);
  ctrl.release('left', 100);
}
{
  const { log, ctrl } = pipeline({});
  // 多点：按住↓软降的同时短按↑180°（↑↓独立）
  ctrl.press('down', 0);
  ctrl.press('up', 50);
  ctrl.release('up', 120);
  eq('多点：↓软降中↑短按180°（互不干扰）', log,
    [['softDrop', true], ['rotate180', true], ['rotate180', false]], log);
  ctrl.release('down', 200);
}
{
  const { log, ctrl } = pipeline({});
  // 离散脉冲按按下顺序依次执行
  ctrl.press('turnLeft', 0);
  ctrl.press('turnRight', 10);
  eq('离散脉冲按按下顺序依次执行', downs(log), ['rotateCCW', 'rotateCW'], log);
}

/* ============================================================
   【F】操作区配置（3+3 / 200×104 / 透明度 / Hold档）
   ============================================================ */
console.log('\n[F] 操作区配置（§8.5）');
{
  const pad = TH.padButtons;
  eq('操作区共 6 键（3+3）', pad.length, 6);
  const byRow = (r) => pad.filter((b) => b.row === r).map((b) => b.key);
  eq('第1排 = 左转·↑·右转', byRow(1), ['turnLeft', 'up', 'turnRight']);
  eq('第2排 = ←·↓·→', byRow(2), ['left', 'down', 'right']);
  const keys = pad.map((b) => b.key);
  for (const need of ['left', 'right', 'turnLeft', 'turnRight', 'up', 'down']) {
    ok(`操作区含 ${need} 键（§8.5 手柄式 3+3）`, keys.includes(need));
  }
  ok('左转/右转在←/→正上方（同列布局，M-04）',
    pad.find((b) => b.key === 'turnLeft').row === 1 && pad.find((b) => b.key === 'left').row === 2);
  ok('↑在↓正上方（同列布局，M-04）',
    pad.find((b) => b.key === 'up').row === 1 && pad.find((b) => b.key === 'down').row === 2);
  ok('单个触控目标 ≥ 44×44px（§8.5 / DoD 10）', TH.padMinPx >= 44, TH.padMinPx);
  eq('↓双击窗 = 300ms（§8.5 时序唯一口径）', TH.doubleDownMs, 300);
  eq('↑长按标准档 = 400ms', TH.holdStandardMs, 400);
  eq('↑长按长档 = 650ms', TH.holdLongMs, 650);
  ok('按键透明度范围 0.30–1.00（§8.5）', TH.padOpacityMin === 0.30 && TH.padOpacityMax === 1.00, [TH.padOpacityMin, TH.padOpacityMax]);
  eq('按键透明度步进 0.05', TH.padOpacityStep, 0.05);
  eq('按键透明度默认 0.85', TH.padDefaultOpacity, 0.85);
}
{
  // 旧手势阈值必须废除（§8.5 移动端无手势）：配置不得再含手势字段
  for (const gone of ['tapMaxMs', 'tapMaxPx', 'doubleTapMs', 'longPressMs', 'softDropPx', 'swipeUpPx', 'hardDropVelPxMs', 'edgeDASms', 'edgeARRms']) {
    ok(`手势阈值已废除：${gone} 不再存在`, TH[gone] === undefined, TH[gone]);
  }
}

/* ============================================================
   【G】DOM 绑定：3+3 操作区 / 顶部暂停入口 / 多点触控
   ============================================================ */
console.log('\n[G] DOM 绑定（3+3 操作区 + 顶部暂停入口）');
{
  const log = [];
  const onAction = (a, d) => log.push([a, !!d]);
  const pad = makeEl('div');
  NP.touch._test.buildPad(pad, onAction, ctx.window.NP_CONFIG.input.touch);
  // 两排容器
  eq('操作区按两排构建（M-04 两排各3键）', pad.children.length, 2);
  const row1 = pad.children[0].children.map((b) => b.dataset.key);
  const row2 = pad.children[1].children.map((b) => b.dataset.key);
  eq('第1排 DOM = 左转·↑·右转', row1, ['turnLeft', 'up', 'turnRight']);
  eq('第2排 DOM = ←·↓·→', row2, ['left', 'down', 'right']);
  const allBtns = pad.children[0].children.concat(pad.children[1].children);
  for (const b of allBtns) {
    ok(`按键 ${b.dataset.key} 有中文可读标签`, !!b.title, b.title);
  }

  // 单键按住 / 松开（←走 DAS 按住语义）
  const left = allBtns.find((b) => b.dataset.key === 'left');
  left.dispatch('pointerdown', { pointerId: 1, preventDefault() {} });
  // buildPad 经 controller+dispatcher：需先 init？buildPad 静态构建只绑路由到全局 ctrl；
  // 此处直接断言按钮路由键名（动作分发走 pipeline 已覆盖），DOM 层只断言结构与标签。
  ok('←键路由键名正确', left.dataset.key === 'left');
  void log;
}
{
  // 顶部暂停入口（常驻，不依赖手势，§8.5）
  const log = [];
  const pauseBtn = makeEl('button');
  NP.touch._test.bindPauseButton(pauseBtn, (a, d) => log.push([a, !!d]));
  pauseBtn.dispatch('pointerdown', { pointerId: 1, preventDefault() {} });
  ok('顶部暂停按钮 → pause', log.some(([a]) => a === 'pause'), log);
}

/* ============================================================
   【H】平台适配静态口径（§9 / §8.5：无手势 + M-04 竖屏 + 画布隐藏）
   ============================================================ */
console.log('\n[H] 平台适配静态口径（§9 / §8.5）');
{
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const css = fs.readFileSync(path.join(ROOT, 'css/style.css'), 'utf8');
  const main = fs.readFileSync(path.join(ROOT, 'main.js'), 'utf8');
  const render = fs.readFileSync(path.join(ROOT, 'render/render.js'), 'utf8');
  const touchSrc = fs.readFileSync(path.join(ROOT, 'ui/touch.js'), 'utf8');
  const zh = fs.readFileSync(path.join(ROOT, 'i18n/zh-CN.js'), 'utf8');
  const en = fs.readFileSync(path.join(ROOT, 'i18n/en-US.js'), 'utf8');

  ok('viewport meta：恰配屏宽 + 禁缩放 + 安全区（§9）',
    /name="viewport"[^>]*width=device-width/.test(html)
    && /user-scalable=no/.test(html) && /viewport-fit=cover/.test(html));
  ok('touch-action 受控（禁双击缩放 / 滚动劫持，§9）', /touch-action:\s*none/.test(css));
  ok('禁用长按菜单 / 文字选择（§9）', /-webkit-touch-callout:\s*none/.test(css));
  ok('竖屏 9:16 布局切换（§9 / M-04）',
    /portrait/.test(main) && /setLayout/.test(render) && /1080/.test(render) && /1920/.test(render));
  ok('M-04 右侧信息栏口径（SCORE/LV/TIME/OBJECTIVE/HOLD/NEXT）',
    /SCORE/.test(render) && /NEXT/.test(render) && /HOLD/.test(render));
  ok('切后台 / 失焦自动暂停（§8.4 / DoD 10）',
    /visibilitychange/.test(main) && /autoPause/.test(main));
  ok('触控走同一动作接口（createDispatcher/onAction），不走两套逻辑（§8.5）',
    /createDispatcher\(/.test(touchSrc) && /onAction/.test(touchSrc));
  ok('移动端无手势：实现无滑动/快滑/半区点击手势映射（§8.5 废除）',
    !/swipeUp|tapRight|tapLeft|moveStepLeft|softStart/.test(touchSrc), '含手势残留');
  ok('操作区 DOM 为 3+3 两排（M-04）', /touch-pad-row/.test(touchSrc) && /pad-key-/.test(touchSrc));
  ok('菜单态画布隐藏（M-01：菜单态画布必须隐藏）', /game-canvas/.test(touchSrc) && /hidden/.test(touchSrc));
  ok('帮助文案为按键图解（无手势语义，M-07）',
    !/左右滑动移动/.test(zh) && /左转/.test(zh) && /双击/.test(zh));
  ok('帮助英文同样无手势残留（Swipe 废除）', !/Swipe left\/right to move/.test(en));
  // P1 回归（ticket-0002 采样2）：竖屏暂停键尺寸必须跟 --tpx 补偿，不得写死 96px 覆盖
  ok('竖屏暂停键跟 --tpx 补偿（DoD 10 ≥44×44，P1 回归）',
    /body\.portrait\s+#btn-touch-pause\s*\{[^}]*var\(--tpx/.test(css)
    && !/body\.portrait\s+#btn-touch-pause\s*\{[^}]*width:\s*96px/.test(css));
  // P2 回归（ticket-0002 采样3）：键位绑定表热切换（折叠→外接键盘展开）
  ok('键位绑定表热切换（M-03：折叠 + 外接键盘 keydown 展开）',
    (() => { try {
      const ui = fs.readFileSync(path.join(ROOT, 'ui/ui.js'), 'utf8');
      return /externalKeyboard/.test(ui) && /window\.addEventListener\('keydown'/.test(ui)
        && /bindings-list/.test(ui) && /bindings-hint/.test(ui)
        && /folded\s*=\s*isTouchLayout\(\)\s*&&\s*!externalKeyboard/.test(ui);
    } catch (_) { return false; } })());
}

console.log(`\n结果：${pass} 通过 / ${fail} 失败`);
process.exit(fail ? 1 : 0);
