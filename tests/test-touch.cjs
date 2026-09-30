/**
 * NEON PULSE — 移动端触控输入无头测试（Node 直接运行：node tests/test-touch.cjs）
 *
 * 数据行来源（表驱动硬门口径）：
 *   - framework §8.5「移动端触控映射」表（手势 → 动作逐行）
 *   - framework §8.5「虚拟按键区」条目（≥44×44px / 多点触控 / 开关与透明度）
 *   - framework §7.4 DAS/ARR 规格值（133ms / 33ms，触控边缘连移同口径）
 *   - framework §9 移动端适配条目（viewport / touch-action / 切后台自动暂停）
 *
 * 覆盖：滑动跟手步进 / 软降 / 快速下滑硬降 / 点击旋转 / 双击·上滑 180° / 长按 Hold /
 *       顶部暂停入口 / 多点触控 / 虚拟按键区 / 阈值边界 / 边缘 DAS 快速连移。
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
  return {
    tag: tag || 'div', textContent: '', title: '', className: '', style: {}, dataset: {},
    children: [],
    classList: {
      add: (c) => classes.add(c),
      remove: (c) => classes.delete(c),
      toggle: (c, v) => { const w = v === undefined ? !classes.has(c) : !!v; if (w) classes.add(c); else classes.delete(c); },
      contains: (c) => classes.has(c),
    },
    setAttribute(k, v) { this[k] = v; },
    addEventListener(type, fn) { (listeners[type] = listeners[type] || []).push(fn); },
    dispatch(type, ev) { for (const fn of listeners[type] || []) fn(ev || { preventDefault() {} }); },
    appendChild(c) { this.children.push(c); return c; },
    replaceChildren() { this.children = []; },
    setPointerCapture() {}, releasePointerCapture() {},
    getBoundingClientRect: () => ({ x: 0, y: 0, left: 0, top: 0, width: 390, height: 693 }),
  };
}

const els = {};
const ctx = {
  console, Math, Date, JSON,
  performance: { now: () => 0 },
  navigator: {},
  document: {
    createElement: (t) => makeEl(t),
    getElementById: (id) => (els[id] || (els[id] = makeEl('div'))),
    addEventListener: () => {},
    querySelectorAll: () => [],
    documentElement: { style: { setProperty() {} } },
  },
};
ctx.window = ctx;
vm.createContext(ctx);
for (const f of ['config/input.js', 'ui/touch.js']) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
}

const NP = ctx.window.NP;
const TH = ctx.window.NP_CONFIG.input.touch;      // 触控阈值配置（数据行取自 §8.5 / §7.4）

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name + (extra !== undefined ? '  →  ' + JSON.stringify(extra) : '')); }
}
function eq(name, got, want) { ok(name, JSON.stringify(got) === JSON.stringify(want), { got, want }); }

/* ==================== 工具：动作日志 / 手势轨迹 ==================== */
/** 创建一条「手势 → 动作」流水线（识别器 + 真实映射层），记录 onAction(name, down) 日志 */
function pipeline(overrides) {
  const log = [];
  const dispatch = NP.touch._test.createDispatcher((name, down) => log.push([name, !!down]));
  const rec = NP.touch._test.createRecognizer(overrides || {}, dispatch);
  return { log, rec };
}
/** 取「按下」序列（离散动作/按住动作的 down 沿），用于断言动作种类与次数 */
const downs = (log) => log.filter(([, d]) => d).map(([a]) => a);
/** 取「松开」序列 */
const ups = (log) => log.filter(([, d]) => !d).map(([a]) => a);
/** 旋转净效果（rotateCW=+1 / rotateCCW=−1 / rotate180=+2，mod 4；2 = 180°） */
function netRotation(log) {
  let r = 0;
  for (const [a, d] of log) {
    if (!d) continue;
    if (a === 'rotateCW') r += 1;
    else if (a === 'rotateCCW') r -= 1;
    else if (a === 'rotate180') r += 2;
  }
  return ((r % 4) + 4) % 4;
}

/** 恒速下滑轨迹（v px/ms、tEnd ms）：用于精确断言松手速度阈值 */
function constSwipeDown(rec, id, v, tEnd) {
  rec.down(id, 200, 200, 0);
  for (let t = 40; t < tEnd; t += 40) rec.move(id, 200, 200 + v * t, t);
  rec.up(id, 200, 200 + v * tEnd, tEnd);
}

const CELL = 50;                    // 测试注入：1 格 = 50px（跟手步进阈值）
const REGION = 390;                 // 手势区宽（点击左右半区分界 = 195）
const BASE = { cellPx: CELL, regionW: REGION };

/* ============================================================
   【A】§8.5 手势 → 动作映射表驱动（每行 = framework §8.5 表行）
   ============================================================ */
console.log('\n[A] §8.5 手势映射表驱动');

// 表行 1「左 / 右滑动 | 移动（跟手步进：每跨约 1 格宽移一步，含 DAS 快速连移）」
{
  const { log, rec } = pipeline(BASE);
  rec.down(1, 300, 400, 0);
  rec.move(1, 150, 402, 60);            // dx = −150px = 3 格
  rec.up(1, 150, 402, 120);
  eq('左滑跨 3 格 → moveLeft ×3（每跨 1 格一步）', downs(log), ['moveLeft', 'moveLeft', 'moveLeft']);
  eq('移动步进为离散脉冲（按下即松开，不残留 DAS）', ups(log), ['moveLeft', 'moveLeft', 'moveLeft']);
}
{
  const { log, rec } = pipeline(BASE);
  rec.down(1, 50, 400, 0);
  rec.move(1, 235, 400, 60);            // dx = +185px = 3.7 格 → 3 步（不足整格不触发）
  rec.up(1, 235, 400, 120);
  eq('右滑跨 3.7 格 → moveRight ×3（步进取整）', downs(log), ['moveRight', 'moveRight', 'moveRight']);
}
{
  const { log, rec } = pipeline(BASE);
  rec.down(1, 50, 400, 0);
  rec.move(1, 350, 400, 30);            // 快速滑动 6 格（30ms）
  rec.up(1, 350, 400, 40);
  eq('快速右滑跨 6 格 → 6 步全送达（含 DAS 快速连移，无节流丢步）',
    downs(log), Array(6).fill('moveRight'));
}
// 步进阈值边界（“每跨约 1 格宽移一步”的量化口径）
{
  const { log, rec } = pipeline(BASE);
  rec.down(1, 300, 400, 0);
  rec.move(1, 255, 400, 30);            // 0.9 格
  eq('跨 0.9 格 → 0 步', downs(log), []);
  rec.move(1, 245, 400, 60);            // 1.1 格
  eq('跨 1.1 格 → 1 步', downs(log), ['moveLeft']);
  rec.move(1, 190, 400, 90);            // 2.2 格
  eq('跨 2.2 格 → 累计 2 步', downs(log), ['moveLeft', 'moveLeft']);
  rec.up(1, 190, 400, 120);
}
{
  // 亚像素容差：触控坐标量化噪声（±0.1px 级）不得让“恰好跨 3 格”欠一步（实玩复验发现）
  const { log, rec } = pipeline(BASE);
  rec.down(1, 300, 400, 0);
  rec.move(1, 300 - 3 * CELL + 0.2, 400, 60);   // 跨 2.9988 格（坐标噪声）
  eq('跨 2.998 格（亚像素噪声）→ 仍为 3 步', downs(log),
    ['moveLeft', 'moveLeft', 'moveLeft']);
  rec.up(1, 150, 400, 120);
}

// 表行 2「下滑 | 软降（跟手加速）」
{
  const { log, rec } = pipeline(BASE);
  rec.down(1, 200, 200, 0);
  rec.move(1, 202, 270, 80);            // dy = 70 > softDropPx
  eq('下滑 → 软降按住（跟手加速）', log, [['softDrop', true]]);
  rec.move(1, 202, 340, 200);
  rec.up(1, 202, 360, 400);             // 慢速松手
  eq('慢速下滑松手 → 释放软降、不硬降', log, [['softDrop', true], ['softDrop', false]]);
}

// 表行 3「快速下滑（速度超阈值松手）| 硬降」（恒速轨迹精确断言阈值，数据行取自 §8.5）
{
  const { log, rec } = pipeline(BASE);
  rec.down(1, 200, 200, 0);
  rec.move(1, 200, 330, 40);            // 130px / 40ms = 3.25 px/ms
  rec.up(1, 200, 370, 60);              // 松手速度 2 px/ms ≥ 阈值
  eq('快速下滑松手 → 硬降', downs(log).includes('hardDrop'), true, downs(log));
  eq('硬降前软降已释放（无残留按住）',
    log.map(([a, d]) => a + ':' + d).slice(0, 3), ['softDrop:true', 'softDrop:false', 'hardDrop:true']);
}
{
  const { log, rec } = pipeline(BASE);
  constSwipeDown(rec, 1, TH.hardDropVelPxMs * 0.84, 100);   // 速度 0.84×阈值，位移已达标
  eq('下滑松手速度低于阈值 → 不硬降（只软降）', downs(log).includes('hardDrop'), false, downs(log));
}
{
  const { log, rec } = pipeline(BASE);
  constSwipeDown(rec, 1, TH.hardDropVelPxMs * 1.0, 100);    // 速度恰达阈值
  eq('下滑松手速度达阈值 → 硬降（阈值边界）', downs(log).includes('hardDrop'), true, downs(log));
}
{
  const { log, rec } = pipeline(BASE);
  constSwipeDown(rec, 1, 0.4, 300);                         // 慢速但距离大
  eq('慢速长下滑 → 只软降不硬降（距离不代替速度）', downs(log).includes('hardDrop'), false, downs(log));
}

// 表行 4「点击屏幕右半区 | 顺时针旋转」/「点击屏幕左半区 | 逆时针旋转」
{
  const { log, rec } = pipeline(BASE);
  rec.down(1, 300, 400, 0); rec.up(1, 301, 401, 90);     // 右半区（x ≥ 195）
  eq('点击右半区 → rotateCW', downs(log), ['rotateCW']);
}
{
  const { log, rec } = pipeline(BASE);
  rec.down(1, 120, 400, 0); rec.up(1, 119, 400, 90);     // 左半区
  eq('点击左半区 → rotateCCW', downs(log), ['rotateCCW']);
}
{
  const { log, rec } = pipeline(BASE);
  rec.down(1, 300, 400, 0);
  rec.move(1, 360, 400, 50);            // 位移超点击阈值 → 滑动，不是点击
  rec.up(1, 360, 400, 120);
  eq('点击后拖动 → 不触发旋转（防误触）', downs(log).filter((a) => a.startsWith('rotate')), []);
  eq('拖动按跟手步进处理（跨 1.2 格 → 1 步）', downs(log), ['moveRight']);
}

// 表行 5「双击 / 上滑 | 180° 旋转」——双击零等待：首击立即旋转，第二击补偿回退 + 180°，净效果恰 180°
{
  const { log, rec } = pipeline(BASE);
  rec.down(1, 300, 400, 0); rec.up(1, 300, 400, 80);     // 第 1 击（右半区）
  rec.down(1, 310, 404, 150); rec.up(1, 310, 404, 220);  // 第 2 击（同侧，间隔 150ms）
  eq('双击（同侧）→ 序列含 rotate180', downs(log).includes('rotate180'), true, downs(log));
  eq('双击净旋转 = 180°（首击补偿，恰为 2/4 圈）', netRotation(log), 2);
  eq('双击不产生按住型残留', ups(log).filter((a) => a === 'moveLeft' || a === 'moveRight' || a === 'softDrop'), []);
}
{
  const { log, rec } = pipeline(BASE);
  rec.down(1, 120, 400, 0); rec.up(1, 120, 400, 80);     // 左半区首击
  rec.down(1, 110, 404, 150); rec.up(1, 110, 404, 220);
  eq('双击（左半区）净旋转 = 180°', netRotation(log), 2);
}
{
  const { log, rec } = pipeline(BASE);
  rec.down(1, 200, 500, 0);
  rec.move(1, 202, 420, 60);
  rec.up(1, 202, 410, 120);             // 上滑 90px ≥ swipeUpPx
  eq('上滑 → rotate180', downs(log), ['rotate180']);
}
{
  const { log, rec } = pipeline(BASE);
  rec.down(1, 300, 400, 0); rec.up(1, 300, 400, 80);
  rec.down(1, 310, 404, 80 + TH.doubleTapMs + 20); rec.up(1, 310, 404, 80 + TH.doubleTapMs + 90);
  eq('双击超窗 → 两次独立旋转（各 90°）', downs(log), ['rotateCW', 'rotateCW']);
}
{
  const { log, rec } = pipeline(BASE);
  rec.down(1, 300, 400, 0); rec.up(1, 300, 400, 80);
  rec.down(1, 60, 404, 150); rec.up(1, 60, 404, 220);    // 异侧快速两次点击
  eq('异侧双击 → 两次独立旋转（不并成 180°）', downs(log), ['rotateCW', 'rotateCCW']);
}

// 表行 6「长按 | Hold」
{
  const { log, rec } = pipeline(BASE);
  rec.down(1, 200, 300, 0);
  rec.tick(TH.longPressMs - 1);
  eq('长按阈值前不触发', downs(log), []);
  rec.tick(TH.longPressMs);
  eq('长按达标 → hold', downs(log), ['hold']);
  rec.tick(TH.longPressMs + 2000);
  eq('持续按住只触发一次（不连发）', downs(log), ['hold']);
  rec.up(1, 200, 300, 3000);
  eq('松手不再触发', downs(log), ['hold']);
}
{
  const { log, rec } = pipeline(BASE);
  rec.down(1, 200, 300, 0);
  rec.move(1, 260, 300, 50);            // 位移超点击阈值 = 滑动，长按取消
  rec.tick(TH.longPressMs + 300);
  eq('按住并拖动 → 不触发 Hold', downs(log), ['moveRight']);
}

// 边缘 DAS 快速连移（§8.5「含 DAS 快速连移」+ §7.4 DAS/ARR 同口径）
{
  const { log, rec } = pipeline(BASE);
  rec.down(1, 300, 400, 0);
  rec.move(1, 380, 400, 20);            // 跨 1.6 格 → 1 步；x=380 抵住右边缘（regionW=390）
  eq('抵住右边缘前的跟手步进 = 1 步', downs(log), ['moveRight']);
  rec.tick(20 + TH.edgeDASms);          // DAS 时刻：首次自动横移
  eq('边缘按住 DAS=133ms → 首次自动连移', downs(log), ['moveRight', 'moveRight']);
  rec.tick(20 + TH.edgeDASms + TH.edgeARRms);
  rec.tick(20 + TH.edgeDASms + 2 * TH.edgeARRms);
  eq('此后每 ARR=33ms 一步（DAS 快速连移）', downs(log),
    ['moveRight', 'moveRight', 'moveRight', 'moveRight']);
}
{
  const { log, rec } = pipeline(BASE);
  rec.down(1, 200, 400, 0);
  rec.move(1, 250, 400, 20);            // 中部按住（非边缘）
  rec.tick(20 + 500);
  rec.tick(20 + 1000);
  eq('非边缘静止按住不自动连移（无误触连发）', downs(log), ['moveRight']);
}

// 多点触控：双指同时滑动（§8.5 虚拟按键区多点触控 / 手势多指并行）
{
  const { log, rec } = pipeline(BASE);
  rec.down(1, 300, 400, 0);
  rec.down(2, 100, 500, 10);
  rec.move(1, 200, 400, 30);            // 指 1：左滑 2 格
  rec.move(2, 200, 500, 40);            // 指 2：右滑 2 格
  rec.up(1, 200, 400, 60);
  rec.up(2, 200, 500, 70);
  eq('双指滑动步进互不干扰（左 2 / 右 2）', downs(log),
    ['moveLeft', 'moveLeft', 'moveRight', 'moveRight']);
}

/* ============================================================
   【B】§8.5 虚拟按键区 / 配置一致性（表驱动）
   ============================================================ */
console.log('\n[B] 虚拟按键区配置（§8.5）与 DAS/ARR 口径（§7.4）');
{
  const pad = TH.padButtons;
  const actions = pad.map((b) => b.action);
  for (const need of ['moveLeft', 'moveRight', 'softDrop', 'hardDrop']) {
    ok(`虚拟按键区含 ${need}（§8.5：左/右/旋转/软降/硬降）`, actions.includes(need));
  }
  ok('虚拟按键区含旋转键', actions.includes('rotateCW') && actions.includes('rotateCCW'));
  ok('虚拟按键区含 Hold', actions.includes('hold'));
  ok('单个触控目标 ≥ 44×44px（§8.5 / DoD 10）', TH.padMinPx >= 44, TH.padMinPx);
  eq('边缘连移 DAS 与 §7.4 规格值一致（133ms）', TH.edgeDASms, 133);
  eq('边缘连移 ARR 与 §7.4 规格值一致（33ms）', TH.edgeARRms, 33);
}
{
  // §8.5 手势映射表完整性：识别器产出的每个手势都有动作映射，且动作名与 §8.5 表一致
  const A = NP.touch._test.GESTURE_ACTIONS;
  const rows = [
    ['moveStepLeft', 'moveLeft'], ['moveStepRight', 'moveRight'],
    ['softStart', 'softDrop'], ['softEnd', 'softDrop'], ['hardDrop', 'hardDrop'],
    ['tapRight', 'rotateCW'], ['tapLeft', 'rotateCCW'], ['swipeUp', 'rotate180'],
    ['longPress', 'hold'], ['pauseTap', 'pause'],
  ];
  for (const [g, action] of rows) {
    ok(`映射表行 ${g} → ${action}（§8.5）`, Array.isArray(A[g]) && A[g].some((x) => x.action === action),
      A[g]);
  }
  ok('映射表行 doubleTap → rotate180（§8.5）',
    (NP.touch._test.gestureToActions('doubleTap', { first: 'tapRight' }) || []).some((x) => x.action === 'rotate180'));
  eq('doubleTap 补偿（首击 CW）→ [rotateCCW, rotate180]',
    NP.touch._test.gestureToActions('doubleTap', { first: 'tapRight' }).map((x) => x.action),
    ['rotateCCW', 'rotate180']);
  eq('doubleTap 补偿（首击 CCW）→ [rotateCW, rotate180]',
    NP.touch._test.gestureToActions('doubleTap', { first: 'tapLeft' }).map((x) => x.action),
    ['rotateCW', 'rotate180']);
}

/* ============================================================
   【C】DOM 绑定：虚拟按键区 / 顶部暂停入口 / 多点触控
   ============================================================ */
console.log('\n[C] DOM 绑定（虚拟按键区 + 顶部暂停入口）');
{
  const log = [];
  const onAction = (a, d) => log.push([a, !!d]);
  const pad = makeEl('div');
  NP.touch._test.buildPad(pad, onAction, ctx.window.NP_CONFIG.input.touch);
  eq('虚拟按键按配置构建（7 键）', pad.children.length, TH.padButtons.length);
  for (let i = 0; i < pad.children.length; i++) {
    const btn = pad.children[i];
    const spec = TH.padButtons[i];
    eq(`按键 ${spec.action} 路由动作名`, btn.dataset.action, spec.action);
    ok(`按键 ${spec.action} 有中文可读标签`, !!btn.title, btn.title);
  }

  // 单键按住 / 松开
  const left = pad.children.find((b) => b.dataset.action === 'moveLeft');
  left.dispatch('pointerdown', { pointerId: 1, preventDefault() {} });
  eq('按下左键 → moveLeft:down', log, [['moveLeft', true]]);
  left.dispatch('pointerup', { pointerId: 1, preventDefault() {} });
  eq('松开左键 → moveLeft:up', log, [['moveLeft', true], ['moveLeft', false]]);

  // 多点触控：按住方向的同时点旋转（§8.5）
  log.length = 0;
  const rot = pad.children.find((b) => b.dataset.action === 'rotateCW');
  left.dispatch('pointerdown', { pointerId: 11, preventDefault() {} });
  rot.dispatch('pointerdown', { pointerId: 12, preventDefault() {} });
  eq('多点触控：按住方向的同时点旋转（两个动作同时在按下态）', log,
    [['moveLeft', true], ['rotateCW', true]]);
  left.dispatch('pointerup', { pointerId: 11, preventDefault() {} });
  rot.dispatch('pointerup', { pointerId: 12, preventDefault() {} });
  eq('双指各自独立松开', log.slice(2), [['moveLeft', false], ['rotateCW', false]]);
}

{
  // 顶部暂停入口（不依赖手势误触，§8.5）
  const log = [];
  const pauseBtn = makeEl('button');
  NP.touch._test.bindPauseButton(pauseBtn, (a, d) => log.push([a, !!d]));
  pauseBtn.dispatch('pointerdown', { pointerId: 1, preventDefault() {} });
  eq('顶部暂停按钮 → pause', log, [['pause', true]]);
}

/* ============================================================
   【D】平台适配静态口径（§9：viewport / touch-action / 切后台自动暂停 / 9:16）
   ============================================================ */
console.log('\n[D] 平台适配静态口径（§9 / §8.5）');
{
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const css = fs.readFileSync(path.join(ROOT, 'css/style.css'), 'utf8');
  const main = fs.readFileSync(path.join(ROOT, 'main.js'), 'utf8');
  const render = fs.readFileSync(path.join(ROOT, 'render/render.js'), 'utf8');

  ok('viewport meta：恰配屏宽 + 禁缩放 + 安全区（§9）',
    /name="viewport"[^>]*width=device-width/.test(html)
    && /user-scalable=no/.test(html) && /viewport-fit=cover/.test(html));
  ok('touch-action 受控（禁双击缩放 / 滚动劫持，§9）', /touch-action:\s*none/.test(css));
  ok('禁用长按菜单 / 文字选择（§9）', /-webkit-touch-callout:\s*none/.test(css));
  ok('竖屏 9:16 布局切换（§9：场地上部居中、操作区底部）',
    /portrait/.test(main) && /setLayout/.test(render) && /1080/.test(render) && /1920/.test(render));
  ok('切后台 / 失焦自动暂停（§8.4 / DoD 10）',
    /visibilitychange/.test(main) && /autoPause/.test(main));
  ok('触控走同一动作接口（onAction），不走两套逻辑（§8.5）',
    /createDispatcher\(/.test(fs.readFileSync(path.join(ROOT, 'ui/touch.js'), 'utf8'))
    && /onAction/.test(fs.readFileSync(path.join(ROOT, 'ui/touch.js'), 'utf8')));
}

console.log(`\n结果：${pass} 通过 / ${fail} 失败`);
process.exit(fail ? 1 : 0);
