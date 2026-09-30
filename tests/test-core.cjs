/**
 * NEON PULSE — 核心玩法无头测试（Node 直接运行：node tests/test-core.js）
 * 覆盖：SRS 出生/旋转坐标、踢墙、T-Spin 三点法/Mini/Full、7-bag 与每日种子、
 *       计分（表 A/B/C + Combo/B2B 乘区）、Lock Out / Top Out、Ultra 归零边界、20G 软降边界。
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const ctx = {
  console,
  Math,
  performance: { now: () => 0 },
  navigator: {},
  document: { addEventListener: () => {}, querySelectorAll: () => [] },
};
ctx.window = ctx;
vm.createContext(ctx);

const FILES = [
  'config/balance.js', 'config/modes.js', 'config/input.js', 'config/fx.js',
  'config/audio.js', 'config/unlock.js', 'i18n/zh-CN.js', 'i18n/en-US.js',
  'core/rng.js', 'core/srs.js', 'core/game.js',
];
for (const f of FILES) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
}

const NP = ctx.window.NP;
const SRS = NP.srs;
const MODES = ctx.window.NP_CONFIG.modes;

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name + (extra !== undefined ? '  →  ' + JSON.stringify(extra) : '')); }
}
function eq(name, got, want) { ok(name, JSON.stringify(got) === JSON.stringify(want), { got, want }); }

/* ================= 1. SRS 出生坐标（framework §5.4） ================= */
console.log('\n[1] 出生占格与旋转坐标');
const SPAWN_WANT = {
  I: [[3, -1], [4, -1], [5, -1], [6, -1]],
  O: [[4, -2], [5, -2], [4, -1], [5, -1]],
  T: [[4, -2], [3, -1], [4, -1], [5, -1]],
  S: [[4, -2], [5, -2], [3, -1], [4, -1]],
  Z: [[3, -2], [4, -2], [4, -1], [5, -1]],
  J: [[3, -2], [3, -1], [4, -1], [5, -1]],
  L: [[5, -2], [3, -1], [4, -1], [5, -1]],
};
for (const t of Object.keys(SPAWN_WANT)) {
  eq(`spawn ${t}`, SRS.ROT_CELLS[t][0].slice().sort(), SPAWN_WANT[t].slice().sort());
}
// T 的 R 态：竖排列 4、行 -2..0 + 凸起 (5,-1)
eq('T rot=R', SRS.ROT_CELLS.T[1].slice().sort(), [[5, -1], [4, -2], [4, -1], [4, 0]].sort());
// I 的 R 态：竖排列 5、行 -2..1
eq('I rot=R', SRS.ROT_CELLS.I[1].slice().sort(), [[5, -2], [5, -1], [5, 0], [5, 1]].sort());
// O 占格恒定
eq('O rot=R 不移位', SRS.ROT_CELLS.O[1].slice().sort(), SPAWN_WANT.O.slice().sort());

/* ================= 2. 踢墙表换算 ================= */
console.log('\n[2] SRS 踢墙（y 偏移符号翻转）');
eq('JLSTZ 0>1 kick2', SRS.getKicks('T', 0, 1, false)[2], [-1, -1]);   // 标准 (-1,+1) → 行 -1
eq('I 0>1 kick3', SRS.getKicks('I', 0, 1, false)[3], [-2, 1]);       // 标准 (-2,-1) → 行 +1
eq('O 不踢', SRS.getKicks('O', 0, 1, false), [[0, 0]]);
eq('180 踢墙两条', SRS.getKicks('T', 0, 2, true), [[0, 0], [0, -1]]);

/* ---- 2b. 标准 SRS 踢墙全表：8 组×5 条逐组断言（getKicks 返回行坐标，y 已翻转） ---- */
const KICK_KEYS = ['0>1', '1>0', '1>2', '2>1', '2>3', '3>2', '3>0', '0>3'];
// 标准 I 踢墙表（行坐标：[col 偏移, row 偏移]，向下为正；I 自成一套，见 tetris.wiki SRS）
const WANT_I = {
  '0>1': [[0, 0], [-2, 0], [1, 0], [-2, 1], [1, -2]],
  '1>0': [[0, 0], [2, 0], [-1, 0], [2, -1], [-1, 2]],
  '1>2': [[0, 0], [-1, 0], [2, 0], [-1, -2], [2, 1]],
  '2>1': [[0, 0], [1, 0], [-2, 0], [1, 2], [-2, -1]],
  '2>3': [[0, 0], [2, 0], [-1, 0], [2, -1], [-1, 2]],
  '3>2': [[0, 0], [-2, 0], [1, 0], [-2, 1], [1, -2]],
  '3>0': [[0, 0], [1, 0], [-2, 0], [1, 2], [-2, -1]],
  '0>3': [[0, 0], [-1, 0], [2, 0], [-1, -2], [2, 1]],
};
// 标准 JLSTZ 踢墙表（行坐标）
const WANT_JLSTZ = {
  '0>1': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
  '1>0': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
  '1>2': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
  '2>1': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
  '2>3': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
  '3>2': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
  '3>0': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
  '0>3': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
};
const kicksOf = (type, key) => {
  const [f, t] = key.split('>').map(Number);
  return SRS.getKicks(type, f, t, false);
};
for (const key of KICK_KEYS) {
  eq(`I ${key} 五条`, kicksOf('I', key), WANT_I[key]);
  eq(`JLSTZ ${key} 五条`, kicksOf('T', key), WANT_JLSTZ[key]);
}

/* ---- 2c. 踢墙表不变式自检（防再次混用 y 口径 / 镜像口径） ---- */
const xnegKick = (k) => k.map(([dx, dr]) => [-dx, dr]);        // 左右镜像：x 取负
const revKick = (k) => k.map(([dx, dr]) => [-dx, -dr]);         // 反向：回转同一旋转对
// ① 每对 (X>Y, Y>X) 互为反向 —— 对 I 与 JLSTZ 均成立（标准 SRS 通用性质）
for (const type of ['I', 'T']) {
  const tag = type === 'I' ? 'I' : 'JLSTZ';
  for (const [a, b] of [['0>1', '1>0'], ['1>2', '2>1'], ['2>3', '3>2'], ['3>0', '0>3']]) {
    eq(`${tag} 不变式① ${a}⇄${b} 互为反向`, revKick(kicksOf(type, a)), kicksOf(type, b));
  }
}
// ②③ 仅适用于 JLSTZ：标准 SRS 的 I 表自成一套（既不左右镜像对称、也不与 JLSTZ 同构），
//    对 I 断言②③属于伪标准，会把错误的镜像/同构实现锁死。
{
  const type = 'T', tag = 'JLSTZ';
  // ② 左右镜像关系
  eq(`${tag} 不变式② 0>3=镜像(0>1)`, xnegKick(kicksOf(type, '0>1')), kicksOf(type, '0>3'));
  eq(`${tag} 不变式② 1>2=镜像(3>2)`, xnegKick(kicksOf(type, '3>2')), kicksOf(type, '1>2'));
  eq(`${tag} 不变式② 2>1=镜像(2>3)`, xnegKick(kicksOf(type, '2>3')), kicksOf(type, '2>1'));
  eq(`${tag} 不变式② 1>0=镜像(3>0)`, xnegKick(kicksOf(type, '3>0')), kicksOf(type, '1>0'));
  // ③ 与 JLSTZ 表同构：0>1=2>1、1>0=1>2、2>3=0>3、3>2=3>0
  eq(`${tag} 不变式③ 0>1=2>1`, kicksOf(type, '0>1'), kicksOf(type, '2>1'));
  eq(`${tag} 不变式③ 1>0=1>2`, kicksOf(type, '1>0'), kicksOf(type, '1>2'));
  eq(`${tag} 不变式③ 2>3=0>3`, kicksOf(type, '2>3'), kicksOf(type, '0>3'));
  eq(`${tag} 不变式③ 3>2=3>0`, kicksOf(type, '3>2'), kicksOf(type, '3>0'));
  // I 表反向自检：明确断言 I 不满足②③（防止未来又把 JLSTZ 结构套回 I）
  ok('I 非伪标准：0>3≠镜像(0>1)',
    JSON.stringify(xnegKick(kicksOf('I', '0>1'))) !== JSON.stringify(kicksOf('I', '0>3')));
  ok('I 非伪标准：0>1≠2>1',
    JSON.stringify(kicksOf('I', '0>1')) !== JSON.stringify(kicksOf('I', '2>1')));
}

/* ================= 3. 7-bag 与每日种子 ================= */
console.log('\n[3] 随机器');
{
  const { bagger } = NP.rng.createRandomBagger();
  const seq = [];
  for (let i = 0; i < 21; i++) seq.push(bagger.next());
  for (let k = 0; k < 3; k++) {
    const bag = seq.slice(k * 7, k * 7 + 7).slice().sort();
    eq(`bag#${k + 1} 七种齐备`, bag, ['I', 'J', 'L', 'O', 'S', 'T', 'Z']);
  }
}
{
  // 同种子 → 同序列（每日挑战跨端一致性）
  const s1 = NP.rng.makeBagger(NP.rng.mulberry32(12345));
  const s2 = NP.rng.makeBagger(NP.rng.mulberry32(12345));
  const a = [], b = [];
  for (let i = 0; i < 35; i++) { a.push(s1.next()); b.push(s2.next()); }
  eq('mulberry32 序列一致', a, b);
  // mulberry32 参考实现逐字节对照
  const ref = (seed) => {
    let t = seed >>> 0;
    return () => {
      t = (t + 0x6D2B79F5) >>> 0;
      let r = Math.imul(t ^ (t >>> 15), t | 1) >>> 0;
      r = (r ^ (r + Math.imul(r ^ (r >>> 7), r | 61)) >>> 0) >>> 0;
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  };
  const g1 = NP.rng.mulberry32(0x811C9DC5), g2 = ref(0x811C9DC5);
  let same = true;
  for (let i = 0; i < 100; i++) if (g1() !== g2()) same = false;
  ok('mulberry32 与参考伪代码一致（100 次取数）', same);
  // FNV-1a 已知向量："" → offset basis
  eq('FNV-1a("")', NP.rng.fnv1a32(''), 0x811C9DC5);
  eq('FNV-1a("a")', NP.rng.fnv1a32('a'), 0xe40c292c);
}

/* ================= 4. 对局构造工具 ================= */
function newGame(modeId, opts) {
  const mode = MODES.find((m) => m.id === modeId);
  return new NP.game.Game(mode, opts || {});
}
function fillRows(game, rows, holes) {
  // rows: 场地行号数组；holes: [c,r] 空位
  for (const r of rows) {
    for (let c = 0; c < 10; c++) {
      if (holes.some(([hc, hr]) => hc === c && hr === r)) continue;
      game.grid[r + 2][c] = 'J';
    }
  }
}
function makePiece(game, type, rot, px, py, lastAction, lastKick) {
  game.active = {
    type, rot, px, py,
    lastAction: lastAction || 'move', lastKick: lastKick == null ? -1 : lastKick, kickIs180: false,
  };
  game.phase = 'falling';
}
/** 把当前方块压到最低点（使其贴地，用于 Lock Delay / Move Reset 用例） */
function dropToGround(game) {
  while (game.canPlace(game.active, 0, 1)) game.active.py += 1;
}

/* ================= 5. 消行计分 ================= */
console.log('\n[4] 计分（表 A + Combo × B2B；表 B/C 直接加分）');
{
  const g = newGame('marathon');
  // 单消：行 19 只留 3..6 空（I 块硬降落底）
  fillRows(g, [19], [[3, 19], [4, 19], [5, 19], [6, 19]]);
  makePiece(g, 'I', 0, 0, 0, 'spawn');
  let ev = null;
  g.onEvent = (n, d) => { if (n === 'lock') ev = d; };
  g.hardDrop();
  eq('Single 消行数', ev.lines, 1);
  eq('Single 判定', ev.label, 'single');
  eq('Combo 1', ev.combo, 1);
  // 基础 100×1 × combo 1.0 × b2b 1.0 + PC 1000×1 + 硬降 2×20格
  eq('Single 总分 = 100 + PC 1000 + 硬降 40', g.score, 100 + 1000 + 2 * 20);
}
{
  const g = newGame('marathon');
  g.grid[17][0] = 'J';   // 残留方块：避免全清干扰本用例（只测 Tetris 基础分，PC 另测）
  // Tetris：16..19 行只留第 9 列空 → I 竖排
  fillRows(g, [16, 17, 18, 19], [[9, 16], [9, 17], [9, 18], [9, 19]]);
  makePiece(g, 'I', 1, 0, 0, 'spawn');   // rot=R：竖排列 5
  let ev = null;
  g.onEvent = (n, d) => { if (n === 'lock') ev = d; };
  g.active.px = 4;                       // 列 5 → 列 9
  g.hardDrop();
  eq('Tetris 消行数', ev.lines, 4);
  eq('Tetris 判定', ev.label, 'tetris');
  eq('Tetris 开启 B2B', ev.b2bEvent, 'on');
  eq('Tetris 得分 800×1×1.0', ev.gain, 800);
}
{
  // B2B ×1.5：连续第二次有效动作
  const g = newGame('marathon');
  g.grid[13][0] = 'J';   // 残留方块：避免全清干扰本用例（放在消行区外，两轮消行后仍在场）
  const doTetris = (rows) => {
    fillRows(g, rows, rows.map((r) => [9, r]));
    makePiece(g, 'I', 1, 4, 0, 'spawn');
    let e = null;
    g.onEvent = (n, d) => { if (n === 'lock') e = d; };
    g.hardDrop();
    g.phase = 'falling';
    return e;
  };
  doTetris([16, 17, 18, 19]);
  const ev2 = doTetris([16, 17, 18, 19]);
  eq('B2B 第二次计数 +1', ev2.b2b, 1);
  eq('B2B ×1.5 × Combo1.2 → 800×1.2×1.5 = 1440', ev2.gain, 1440);
}
{
  // 普通消行打断 B2B
  const g = newGame('marathon');
  fillRows(g, [16, 17, 18, 19], [[9, 16], [9, 17], [9, 18], [9, 19]]);
  makePiece(g, 'I', 1, 4, 0, 'spawn');
  g.onEvent = () => {};
  g.hardDrop();
  fillRows(g, [19], [[3, 19], [4, 19], [5, 19], [6, 19]]);
  makePiece(g, 'I', 0, 0, 0, 'spawn');
  let ev = null;
  g.onEvent = (n, d) => { if (n === 'lock') ev = d; };
  g.hardDrop();
  eq('普通消行打断 B2B', [g.b2bActive, ev.b2bEvent], [false, undefined]);
  eq('Combo 连续累计（不因消行类型断链）', ev.combo, 2);
}
{
  // Combo 乘区：连续消行
  const g = newGame('marathon');
  let ev = null;
  for (let i = 0; i < 3; i++) {
    fillRows(g, [19], [[3, 19], [4, 19], [5, 19], [6, 19]]);
    makePiece(g, 'I', 0, 0, 0, 'spawn');
    g.onEvent = (n, d) => { if (n === 'lock') ev = d; };
    g.hardDrop();
    g.phase = 'falling';
    g.fallAccum = 0;
  }
  eq('Combo 累计到 3', ev.combo, 3);
  eq('Combo3 乘区 1.4 → 100×1.4 + PC 1000 = 1140', ev.gain, 1140);
}

/* ================= 6. T-Spin 判定 ================= */
console.log('\n[5] T-Spin 三点法 / Mini / Full');
// TSD 槽位：T(rot=0，凸向上) 中心 (4,19) → 占 (4,18)(3,19)(4,19)(5,19)
// 行 17 留 (0,17) 空（不消行）、行 18 仅 (4,18) 空、行 19 仅 (3,19)(4,19)(5,19) 空
{
  const g = newGame('marathon');
  fillRows(g, [17, 18, 19], [[0, 17], [4, 18], [3, 19], [4, 19], [5, 19]]);
  makePiece(g, 'T', 0, 0, 20, 'rotate', 0);
  const cells = SRS.cellsOf('T', 0, 0, 20);
  let ev = null;
  g.onEvent = (n, d) => { if (n === 'lock') ev = d; };
  g.lockPiece(false);
  ok('T 槽位占格正确', JSON.stringify(cells) === JSON.stringify([[4, 18], [3, 19], [4, 19], [5, 19]]), cells);
  eq('T-Spin Full 判定', ev.tspin, 'full');
  eq('TSD label', ev.label, 'tspinDouble');
  eq('TSD 消 2 行', ev.lines, 2);
  eq('TSD 得分 1200×1×1.0', ev.gain, 1200);
}
{
  // T-Spin Mini Single：前角不全堵（(5,18) 空）→ Mini，消 1 行 → 200×等级
  const g = newGame('marathon');
  fillRows(g, [17, 18, 19], [[0, 17], [4, 18], [5, 18], [3, 19], [4, 19], [5, 19]]);
  makePiece(g, 'T', 0, 0, 20, 'rotate', 0);
  let ev = null;
  g.onEvent = (n, d) => { if (n === 'lock') ev = d; };
  g.lockPiece(false);
  eq('Mini 判定', ev.tspin, 'mini');
  eq('Mini Single label', ev.label, 'tspinMiniSingle');
  eq('Mini Single 得分 200×1', ev.gain, 200);
}
{
  // T-Spin Mini（0 行）：行 19 不满 → 落块奖励 100×等级
  const g = newGame('marathon');
  fillRows(g, [17, 18, 19], [[0, 17], [4, 18], [5, 18], [0, 19], [3, 19], [4, 19], [5, 19]]);
  makePiece(g, 'T', 0, 0, 20, 'rotate', 0);
  let ev = null;
  g.onEvent = (n, d) => { if (n === 'lock') ev = d; };
  g.lockPiece(false);
  eq('0 行 Mini', [ev.tspin, ev.lines], ['mini', 0]);
  eq('0 行 Mini 得分 100×1', ev.gain, 100);
}
{
  // kick index 4（该转向组最后一条）→ Full；0 行 Full = 400×等级
  const g = newGame('marathon');
  fillRows(g, [17, 18, 19], [[0, 17], [4, 18], [5, 18], [0, 19], [3, 19], [4, 19], [5, 19]]);
  makePiece(g, 'T', 0, 0, 20, 'rotate', 4);
  let ev = null;
  g.onEvent = (n, d) => { if (n === 'lock') ev = d; };
  g.lockPiece(false);
  eq('kick index 4 → Full', ev.tspin, 'full');
  eq('0 行 Full 得分 400×1', ev.gain, 400);
}
{
  // 非旋转落块不判 T-Spin
  const g = newGame('marathon');
  fillRows(g, [17, 18, 19], [[0, 17], [4, 18], [3, 19], [4, 19], [5, 19]]);
  makePiece(g, 'T', 0, 0, 20, 'move', 0);
  let ev = null;
  g.onEvent = (n, d) => { if (n === 'lock') ev = d; };
  g.lockPiece(false);
  eq('移动后不判 T-Spin', ev.tspin, 'none');
  eq('普通 Double 计分 300', ev.gain, 300);
}
{
  // Hold 重置判定状态
  const g = newGame('marathon');
  makePiece(g, 'T', 0, 0, 0, 'rotate', 0);
  g.holdType = 'I';
  g.onEvent = () => {};
  g.hold();
  eq('Hold 换入后 lastAction 清为非旋转', g.active.lastAction === 'rotate', false);
}

/* ================= 7. 失败判定 ================= */
console.log('\n[6] Top Out / Lock Out');
{
  const g = newGame('marathon');
  fillRows(g, [-2, -1], []);      // 出生区被占
  let end = null;
  g.onEvent = (n, d) => { if (n === 'runend') end = d; };
  g.spawnNext();
  eq('Top Out', end.reason, 'topout');
}
{
  const g = newGame('marathon');
  // 行 0..19 全满（阻塞下落）→ O 块（只占行 -2/-1）硬降 0 格即锁 → 全部在隐藏区
  fillRows(g, Array.from({ length: 20 }, (_, i) => i), []);
  makePiece(g, 'O', 0, 0, 0, 'spawn');
  let end = null;
  g.onEvent = (n, d) => { if (n === 'runend') end = d; };
  g.hardDrop();
  eq('Lock Out（锁定瞬间、先于消行）', end.reason, 'lockout');
}

/* ================= 8. Ultra 归零边界 / Sprint 成绩口径 ================= */
console.log('\n[7] 模式边界');
{
  const g = newGame('ultra');
  g.onEvent = () => {};
  g.elapsedMs = 120000;
  let end = null;
  g.onEvent = (n, d) => { if (n === 'runend') end = d; };
  g.update(16);
  eq('Ultra 归零 → timeout', end.reason, 'timeout');
  ok('Ultra 未锁定块计 0 分（作废）', end.score === g.score);
  ok('Ultra 记完赛成绩', end.valid === true);
}
{
  const g = newGame('sprint');
  g.onEvent = () => {};
  let end = null;
  g.onEvent = (n, d) => { if (n === 'runend') end = d; };
  g.endRun('topout');
  eq('Sprint 未完赛不产生成绩', end.valid, false);
}
{
  const g = newGame('sprint');
  g.onEvent = () => {};
  // 连续消 40 行 → goal
  let end = null;
  g.onEvent = (n, d) => { if (n === 'runend') end = d; };
  for (let i = 0; i < 10; i++) {
    fillRows(g, [16, 17, 18, 19], [[9, 16], [9, 17], [9, 18], [9, 19]]);
    makePiece(g, 'I', 1, 4, 0, 'spawn');
    g.phase = 'falling';
    g.hardDrop();
    if (g.phase === 'clearing') { for (let k = 0; k < 3 && g.phase === 'clearing'; k++) g.update(100); }  // 走完 250ms 消行动画
  }
  eq('Sprint 消满 40 行 → goal', end && end.reason, 'goal');
  eq('Sprint 完赛有效', end && end.valid, true);
  eq('Sprint 最高 5 级', end && end.level, 5);
}

/* ================= 9. 速度 / 软降 / 20G 边界（全表驱动） ================= */
console.log('\n[8] 速度 / 软降 / BPM / Combo 口径（§7.3 / §7.4 / §7.6 / §7.2 全表）');
// —— §7.3 重力速度全表：数据行逐行取自规格表（等级 / 行/秒 / 格/帧） ——
const GRAVITY_SPEC = [
  [1, 0.5, 0.008], [2, 0.8, 0.013], [3, 1.2, 0.020], [4, 1.8, 0.030],
  [5, 2.4, 0.040], [6, 3.0, 0.050], [7, 4.5, 0.075], [8, 6.0, 0.10],
  [9, 8.0, 0.13], [10, 10, 0.17], [11, 12, 0.20], [12, 16, 0.27],
  [13, 22, 0.37], [14, 30, 0.50], [15, 60, 1.0], [16, 120, 2.0],
  [17, 300, 5.0], [18, 600, 10.0], [19, 1200, 20.0],
];
for (const [lvl, rows, cell] of GRAVITY_SPEC) {
  eq(`重力 ${lvl} 级 = ${rows} 行/秒（§7.3 表行）`, NP.game.gravityRowsPerSec(lvl), rows);
  ok(`重力 ${lvl} 级 ≈ ${cell} 格/帧（60fps 唯一换算）`, Math.abs(rows / 60 - cell) < 0.005, rows / 60);
}
eq('重力 19 级起封顶 20G（25 级仍 1200）', NP.game.gravityRowsPerSec(25), 1200);

// —— §7.4 软降速度全表：min(max(40, 20×重力), 1200)，分段唯一口径 ——
const SOFTDROP_SPEC = [
  [1, 40], [2, 40], [3, 40], [4, 40],                          // 1–4 级 = 40 行/秒
  [5, 48], [6, 60], [7, 90], [8, 120], [9, 160], [10, 200],    // 5–14 级 = 20×重力
  [11, 240], [12, 320], [13, 440], [14, 600],
  [15, 1200], [16, 1200], [17, 1200], [18, 1200],              // 15–18 级 = 封顶 1200
  [19, 1200], [25, 1200],                                      // 19 级+ = 与重力同速（额外下落 0）
];
for (const [lvl, want] of SOFTDROP_SPEC) {
  eq(`软降 ${lvl} 级 = ${want} 行/秒（§7.4 分段表行）`, NP.game.softDropRowsPerSec(lvl), want);
}

// —— §7.6 BPM(等级) 全表：128 + 4×(等级−1)，19 级起封顶 200 ——
const BPM_SPEC = [
  [1, 128], [2, 132], [3, 136], [4, 140], [5, 144], [6, 148], [7, 152],
  [8, 156], [9, 160], [10, 164], [11, 168], [12, 172], [13, 176], [14, 180],
  [15, 184], [16, 188], [17, 192], [18, 196], [19, 200],
];
for (const [lvl, want] of BPM_SPEC) eq(`BPM ${lvl} 级 = ${want}（§7.6 表行）`, NP.game.bpmOf(lvl), want);
eq('BPM 19 级起封顶 200（25 级仍 200）', NP.game.bpmOf(25), 200);

// —— §7.2 Combo 乘区全表：n=1..10，≥10 封顶 3.0 ——
const COMBO_SPEC = [1.0, 1.2, 1.4, 1.6, 1.8, 2.1, 2.3, 2.5, 2.7, 3.0];
for (let n = 1; n <= 10; n++) {
  eq(`Combo ${n} 乘区 = ${COMBO_SPEC[n - 1]}（§7.2 表行）`, NP.game.comboMult(n), COMBO_SPEC[n - 1]);
}
for (const n of [11, 15, 99]) eq(`Combo ${n} 封顶 3.0`, NP.game.comboMult(n), 3.0);
{
  // 20G 段（19 级）软降不计分、不取消 T-Spin
  const g = newGame('marathon');
  g.onEvent = () => {};
  g.level = 19;
  g.totalLines = 180;
  makePiece(g, 'T', 0, 0, 0, 'rotate', 0);
  g.setHeld('softDrop', true);
  const scoreBefore = g.score;
  g.update(16);
  eq('20G 软降不计分', g.score, scoreBefore);
  eq('20G 软降不取消 T-Spin', g.active.lastAction, 'rotate');
  eq('20G 单帧到底', g.active.py > 10, true);
}

/* ================= 10. 等级推进 ================= */
console.log('\n[9] 等级推进（每 10 行 +1，结算后生效）');
{
  const g = newGame('marathon');
  g.onEvent = () => {};
  g.grid[19][0] = 'J';   // 残留方块：避免全清干扰本用例
  fillRows(g, [19], [[3, 19], [4, 19], [5, 19], [6, 19]]);
  makePiece(g, 'I', 0, 0, 0, 'spawn');
  while (g.canPlace(g.active, 0, 1)) g.active.py++;   // 落底（不计硬降分）
  g.totalLines = 9;
  let ev = null;
  g.onEvent = (n, d) => { if (n === 'lock') ev = d; };
  g.lockPiece(false);
  eq('第 10 行后升 2 级', g.level, 2);
  ok('本批消行按升级前等级计分（100×1）', ev.gain === 100, ev.gain);
}
{
  const g = newGame('marathon');
  g.onEvent = () => {};
  g.grid[17][0] = 'J';   // 残留方块：避免全清干扰本用例（必须在 fillRows 覆盖区之外，否则被覆写失效）
  g.totalLines = 17;
  g.level = 2;
  fillRows(g, [16, 17, 18, 19], [[9, 16], [9, 17], [9, 18], [9, 19]]);
  makePiece(g, 'I', 1, 4, 0, 'spawn');
  while (g.canPlace(g.active, 0, 1)) g.active.py++;
  let ev = null;
  g.onEvent = (n, d) => { if (n === 'lock') ev = d; };
  g.lockPiece(false);
  eq('消 4 行跨过 20 行阈值 → 3 级', g.level, 3);
  eq('跨级前按 2 级计分 800×2 = 1600', ev.gain, 1600);
}

/* ================= 11. Perfect Clear ================= */
console.log('\n[10] Perfect Clear');
{
  const g = newGame('marathon');
  g.onEvent = () => {};
  fillRows(g, [19], [[3, 19], [4, 19], [5, 19], [6, 19]]);
  makePiece(g, 'I', 0, 0, 0, 'spawn');
  while (g.canPlace(g.active, 0, 1)) g.active.py++;
  let ev = null;
  g.onEvent = (n, d) => { if (n === 'lock') ev = d; };
  g.lockPiece(false);
  eq('全清判定', ev.pc, true);
  eq('全清得分 = 100×1 + 1000×1 = 1100', ev.gain, 1100);
  eq('PC 次数统计', g.counts.pc, 1);
}

/* ================= 12. 评审回归：T-Spin 消行口径 / Lock Out 事件字段 ================= */
console.log('\n[11] 评审回归：T-Spin 消行口径统一 + Lock Out 事件字段');
{
  // ① 口径唯一：「T-Spin 消行」= 消行数 ≥ 1 的 T-Spin（含 Mini Single，§5.6 闭合定义）
  //    必须与 B2B 有效动作（difficult）、成就「旋光者」（tspinClears ≥ 8）同一计数器
  const titles = ctx.window.NP_CONFIG.unlock.titles;
  const spinner = titles.find((x) => x.id === 'spinner');
  ok('成就「旋光者」与「T-Spin 消行」共用同一计数器 tspinClears',
    !!spinner && spinner.cond.type === 'tspinClears' && spinner.cond.value === 8,
    spinner && spinner.cond);
}
{
  // T-Spin Mini Single（消 1 行）：既计 tspinClears，又是 B2B 有效动作（口径不得分裂）
  const g = newGame('marathon');
  fillRows(g, [17, 18, 19], [[0, 17], [4, 18], [5, 18], [3, 19], [4, 19], [5, 19]]);
  makePiece(g, 'T', 0, 0, 20, 'rotate', 0);
  let ev = null;
  g.onEvent = (n, d) => { if (n === 'lock') ev = d; };
  g.lockPiece(false);
  eq('Mini Single 判定', [ev.tspin, ev.lines], ['mini', 1]);
  eq('Mini Single 计入「T-Spin 消行」', g.counts.tspinClears, 1);
  eq('Mini Single 同时是 B2B 有效动作（同口径）', ev.b2bEvent, 'on');
}
{
  // T-Spin Double（Full 消 2 行）：计入 tspinClears
  const g = newGame('marathon');
  fillRows(g, [17, 18, 19], [[0, 17], [4, 18], [3, 19], [4, 19], [5, 19]]);
  makePiece(g, 'T', 0, 0, 20, 'rotate', 0);
  g.onEvent = () => {};
  g.lockPiece(false);
  eq('TSD 计入「T-Spin 消行」', g.counts.tspinClears, 1);
}
{
  // 0 行 Mini / 0 行 Full：不是消行动作，不计入 tspinClears（§5.6）
  const g1 = newGame('marathon');
  fillRows(g1, [17, 18, 19], [[0, 17], [4, 18], [5, 18], [0, 19], [3, 19], [4, 19], [5, 19]]);
  makePiece(g1, 'T', 0, 0, 20, 'rotate', 0);
  g1.onEvent = () => {};
  g1.lockPiece(false);
  eq('0 行 Mini 不计入「T-Spin 消行」', g1.counts.tspinClears, 0);
  eq('0 行 Mini 也不得打断/累加 B2B', [g1.b2bActive, g1.b2bCount], [false, 0]);

  const g2 = newGame('marathon');
  fillRows(g2, [17, 18, 19], [[0, 17], [4, 18], [5, 18], [0, 19], [3, 19], [4, 19], [5, 19]]);
  makePiece(g2, 'T', 0, 0, 20, 'rotate', 4);
  g2.onEvent = () => {};
  g2.lockPiece(false);
  eq('0 行 Full 不计入「T-Spin 消行」', g2.counts.tspinClears, 0);
}
{
  // 普通消行：不计入 tspinClears
  const g = newGame('marathon');
  fillRows(g, [19], [[3, 19], [4, 19], [5, 19], [6, 19]]);
  makePiece(g, 'I', 0, 0, 0, 'spawn');
  g.onEvent = () => {};
  g.hardDrop();
  eq('普通 Single 不计入「T-Spin 消行」', g.counts.tspinClears, 0);
}
{
  // ② Lock Out 的 lock 事件必须带判定字段（tspin/lines），不得让 undefined 命中技巧分支
  const g = newGame('marathon');
  fillRows(g, Array.from({ length: 20 }, (_, i) => i), []);
  makePiece(g, 'O', 0, 0, 0, 'spawn');
  let ev = null;
  g.onEvent = (n, d) => { if (n === 'lock') ev = d; };
  g.hardDrop();
  ok('Lock Out 也发 lock 事件', !!ev);
  eq('Lock Out lock 事件带 tspin=none（非 undefined）', ev.tspin, 'none');
  eq('Lock Out lock 事件带 lines=0（非 undefined）', ev.lines, 0);
  ok('Lock Out 不得命中 T-Spin 技巧分支（消费端 `d.tspin !== \'none\'` 判定）',
    (ev.tspin !== 'none') === false, ev.tspin);
  eq('Lock Out 不计入「T-Spin 消行」', g.counts.tspinClears, 0);
}

/* ================= 13. 评审回归：多行消除索引正确性 / 无残留满行 / PC 触发 ================= */
console.log('\n[12] 评审回归：多行消除真正消除（splice/unshift 索引错位）');
{
  // Double：行 18/19 只留第 9 列空 → I 竖排补满 → 消 2 行
  // 回归目标：≥2 行消除不得残留满行（旧 bug：splice+unshift 交替使未处理满行下移 +1，
  // 旧索引失效删错行 → Double 残留 1 条满行、Triple/Tetris 残留 2 条）
  const g = newGame('marathon');
  fillRows(g, [18, 19], [[9, 18], [9, 19]]);
  makePiece(g, 'I', 1, 4, 0, 'spawn');   // 竖排列 5 → 列 9
  let ev = null;
  g.onEvent = (n, d) => { if (n === 'lock') ev = d; };
  g.hardDrop();
  eq('Double 消行数', ev.lines, 2);
  eq('Double 判定', ev.label, 'double');
  eq('Double 得分 300×1×1.0×1.0', ev.gain, 300);
  eq('Double 事件 rows 为升序副本（最顶行在前，供 fx.lineClear 定位）', ev.rows, [20, 21]);
  ok('Double 后场地无满行残留', g.grid.every((row) => row.some((v) => v === 0)), '残留满行');
  eq('Double 计入 totalLines / 计数', [g.totalLines, g.counts.double], [2, 1]);
  // I 竖条残留段（列 9）随上方行下移到底两行，其余格为空
  eq('残留段下移到底两行', [[g.grid[20][9], g.grid[21][9]],
    g.grid[20].slice(0, 9).every((v) => v === 0) && g.grid[21].slice(0, 9).every((v) => v === 0)],
    [['I', 'I'], true]);
  // 旧 bug 残留满行会被下次锁定重复扫描、重复计行计分
  g.phase = 'falling';
  makePiece(g, 'O', 0, 0, 0, 'spawn');
  let ev2 = null;
  g.onEvent = (n, d) => { if (n === 'lock') ev2 = d; };
  g.hardDrop();
  eq('后续锁定不重复计行', ev2.lines, 0);
  eq('后续锁定不重复计分', [g.totalLines, g.counts.double], [2, 1]);
}
{
  // Triple：行 17/18/19 只留第 9 列空 → I 竖排补满 → 消 3 行
  const g = newGame('marathon');
  fillRows(g, [17, 18, 19], [[9, 17], [9, 18], [9, 19]]);
  makePiece(g, 'I', 1, 4, 0, 'spawn');
  let ev = null;
  g.onEvent = (n, d) => { if (n === 'lock') ev = d; };
  g.hardDrop();
  eq('Triple 消行数', ev.lines, 3);
  eq('Triple 判定', ev.label, 'triple');
  eq('Triple 得分 500×1×1.0×1.0', ev.gain, 500);
  eq('Triple 事件 rows 为升序副本', ev.rows, [19, 20, 21]);
  ok('Triple 后场地无满行残留', g.grid.every((row) => row.some((v) => v === 0)), '残留满行');
  eq('Triple 计入 totalLines / 计数', [g.totalLines, g.counts.triple], [3, 1]);
  eq('I 残留段落到底行', [g.grid[21][9], g.grid[21].slice(0, 9).every((v) => v === 0)], ['I', true]);
}
{
  // Tetris 全清：16..19 行只留第 9 列空 → I 竖排补满 4 行 → 场地全空 → Perfect Clear
  // 回归目标：全清场景 pc 必须成立、+1000×等级 必须入账（旧 bug：残留满行 → 永不 PC）
  const g = newGame('marathon');
  fillRows(g, [16, 17, 18, 19], [[9, 16], [9, 17], [9, 18], [9, 19]]);
  makePiece(g, 'I', 1, 4, 0, 'spawn');
  let ev = null;
  g.onEvent = (n, d) => { if (n === 'lock') ev = d; };
  g.hardDrop();
  eq('Tetris 消行数', ev.lines, 4);
  eq('Tetris 事件 rows 为升序副本', ev.rows, [18, 19, 20, 21]);
  ok('Tetris 后场地无满行残留', g.grid.every((row) => row.some((v) => v === 0)), '残留满行');
  ok('全清后场地 22 行全空', g.grid.every((row) => row.every((v) => v === 0)));
  eq('Tetris 全清触发 PC', ev.pc, true);
  eq('Tetris 全清得分 800×1×1.0 + PC 1000×1 = 1800', ev.gain, 1800);
  eq('PC / Tetris 计数', [g.counts.pc, g.counts.tetris], [1, 1]);
  eq('Tetris 计入 totalLines', g.totalLines, 4);
}

/* ================= 14. 核心算法状态机表驱动（§5.4 / §7.4 手感参数） ================= */
console.log('\n[13] 手感状态机表驱动（DAS / ARR / Lock Delay / Move Reset / 消行动画）');
const FEEL = ctx.window.NP_CONFIG.balance.feel;
// —— 规格表行（framework §7.4 表格逐行取数，实现值必须逐行相等） ——
const FEEL_SPEC = [
  { key: 'dasMs', label: 'DAS（按住到自动横移延迟）', spec: 133 },
  { key: 'arrMs', label: 'ARR（自动横移间隔）', spec: 33 },
  { key: 'lockDelayMs', label: 'Lock Delay', spec: 500 },
  { key: 'moveResetLimit', label: 'Move Reset 上限', spec: 15 },
  { key: 'clearAnimMs', label: '消行动画时长', spec: 250 },
];
for (const row of FEEL_SPEC) {
  eq(`${row.label} = ${row.spec}（§7.4 表行）`, FEEL[row.key], row.spec);
}

/** 预测：按住后第 k 次自动横移（k 从 0 起）发生时刻 = 首个 ≥ (DAS + k×ARR) 的逻辑帧 */
function expectShiftMs(k, dtMs) {
  return Math.ceil((FEEL.dasMs + k * FEEL.arrMs - 1e-6) / dtMs) * dtMs;
}
/** 按住方向键跑 dt 步进，返回自动横移发生的累计时刻数组（不含按住瞬间的手动横移） */
function runDas(dtMs, ticks, dir) {
  const g = newGame('marathon');
  const shifts = [];
  let inUpdate = false, t = 0;
  g.onEvent = (n) => { if (n === 'move' && inUpdate) shifts.push(t); };
  g.setHeld(dir === 1 ? 'moveRight' : 'moveLeft', true);   // t=0：手动横移（非自动）
  for (let i = 0; i < ticks; i++) {
    t += dtMs;
    inUpdate = true;
    g.update(dtMs);
    inUpdate = false;
    if (g.phase !== 'falling' || !g.active) break;
    g.active.px = 0;   // 测试钩子：把方块挪回场地中央，保证后续自动横移永不撞墙失败
  }
  return shifts;
}
// —— DAS / ARR 行为表驱动：多帧步长逐行断言，期望时刻直接由规格值 133/33 推出 ——
const DAS_ROWS = [
  { dtMs: 10, ticks: 35, label: '10ms 步进' },
  { dtMs: 7, ticks: 50, label: '7ms 步进' },
  { dtMs: 16.7, ticks: 25, label: '60fps 16.7ms' },
  { dtMs: 33, ticks: 12, label: '33ms 步进' },
];
for (const row of DAS_ROWS) {
  const shifts = runDas(row.dtMs, row.ticks, 1);
  ok(`${row.label}：首次自动横移 = DAS 133ms 的首个逻辑帧（期望 ${expectShiftMs(0, row.dtMs)}，实测 ${shifts[0]}）`,
    shifts.length > 0 && Math.abs(shifts[0] - expectShiftMs(0, row.dtMs)) < 0.01, shifts.slice(0, 3));
  ok(`${row.label}：首步不得叠加 ARR（不得到 133+33ms 才首移）`,
    shifts.length > 0 && shifts[0] < FEEL.dasMs + FEEL.arrMs, shifts[0]);
  for (let k = 1; k < 5; k++) {
    ok(`${row.label}：第 ${k + 1} 次自动横移 = ${expectShiftMs(k, row.dtMs)}ms（133 + ${k}×33 的首个逻辑帧）`,
      shifts.length > k && Math.abs(shifts[k] - expectShiftMs(k, row.dtMs)) < 0.01, shifts[k]);
  }
}
{
  // 点按（<DAS 松开）：只有按住瞬间的 1 次手动横移，不得出现自动横移
  const g = newGame('marathon');
  let moves = 0;
  g.onEvent = (n) => { if (n === 'move') moves++; };
  g.setHeld('moveRight', true);
  for (let i = 0; i < 8; i++) g.update(10);      // 按住 80ms < 133ms
  g.setHeld('moveRight', false);
  for (let i = 0; i < 30; i++) g.update(10);     // 松开后 300ms 不得再自动横移
  eq('点按 80ms 松开：仅 1 次手动横移、无自动横移', moves, 1);
}
{
  // 换向重新起算 DAS：按右 100ms → 换左，左移的 DAS 从换向时刻重新计 133ms
  const g = newGame('marathon');
  const moves = [];
  let inUpdate = false, t = 0;
  g.onEvent = (n, d) => { if (n === 'move' && inUpdate) moves.push([t, d.dir]); };
  g.setHeld('moveRight', true);
  for (let i = 0; i < 10; i++) { t += 10; inUpdate = true; g.update(10); inUpdate = false; g.active.px = 0; }
  g.setHeld('moveLeft', true);                   // 换向
  const tSwitch = t;
  for (let i = 0; i < 30; i++) { t += 10; inUpdate = true; g.update(10); inUpdate = false; g.active.px = 0; }
  ok('换向后 133ms 内无自动横移（重新起算）', moves.every(([mt]) => mt >= tSwitch + 133), moves);
  ok('换向后首次自动横移 = 140ms（DAS 133ms 的 10ms 首帧）且方向正确',
    moves.length > 0 && moves[0][0] === tSwitch + 140 && moves[0][1] === -1, moves.slice(0, 2));
}

// —— Lock Delay 行为表驱动：触底后恰在首个 ≥ 500ms 的逻辑帧锁定 ——
const LOCK_ROWS = [
  { dtMs: 10, label: '10ms 步进' },
  { dtMs: 16.7, label: '60fps 16.7ms' },
  { dtMs: 33, label: '33ms 步进' },
];
for (const row of LOCK_ROWS) {
  const g = newGame('marathon');
  dropToGround(g);
  let lockedAt = null, t = 0;
  g.onEvent = (n) => { if (n === 'lock' && lockedAt === null) lockedAt = t; };
  for (let i = 0; i < 200 && lockedAt === null; i++) { t += row.dtMs; g.update(row.dtMs); }
  ok(`${row.label}：Lock Delay = 500ms 的首个逻辑帧锁定（实测 ${lockedAt}）`,
    lockedAt !== null && lockedAt >= FEEL.lockDelayMs && lockedAt - row.dtMs < FEEL.lockDelayMs, lockedAt);
}
{
  // 触底 300ms 后成功横移 → 重置，锁定应发生在换向后完整 500ms（累计 ≈ 800ms）
  const g = newGame('marathon');
  dropToGround(g);
  let lockedAt = null, t = 0, moved = false;
  g.onEvent = (n) => { if (n === 'lock' && lockedAt === null) lockedAt = t; };
  for (let i = 0; i < 200 && lockedAt === null; i++) {
    t += 10; g.update(10);
    if (!moved && t >= 300) { g.move(1); moved = true; }
  }
  ok('成功移动重置 Lock Delay：完整 500ms 窗口从重置起算（≈300+500=800ms 锁定）',
    moved && lockedAt !== null && lockedAt >= 800 && lockedAt - 10 < 800, lockedAt);
}
{
  // Move Reset：触底期间每次成功操作重置计时 +1，上限 15 次；第 16 次成功操作超次数立即锁定（§5.4）
  const g = newGame('marathon');
  dropToGround(g);
  let locks = 0, resetsAtLock = null;
  g.onEvent = (n) => { if (n === 'lock') { if (locks === 0) resetsAtLock = g.lockResets; locks++; } };
  for (let i = 1; i <= FEEL.moveResetLimit; i++) {
    g.lockTimer = 250;                              // 模拟已耗一半锁定延迟
    const okMove = g.move(i % 2 ? 1 : -1);          // 交替横移，永不撞墙
    ok(`Move Reset 第 ${i}/${FEEL.moveResetLimit} 次：成功操作重置计时为 0 并计数 ${i}`,
      okMove && g.lockTimer === 0 && g.lockResets === i && locks === 0,
      { okMove, lockTimer: g.lockTimer, lockResets: g.lockResets, locks });
  }
  eq('15 次重置用尽前绝不锁定', locks, 0);
  eq('15 次后 lockResets = 15（上限）', g.lockResets, FEEL.moveResetLimit);
  g.lockTimer = 250;
  g.move(1);
  eq('第 16 次成功操作：超次数立即锁定（§5.4）', locks, 1);
  eq('锁定瞬间重置计数 = 15（第 16 次不再重置）', resetsAtLock, FEEL.moveResetLimit);
}
{
  // 消行动画 / 输入缓冲（§7.4：250ms，期间缓冲，动画结束立即出块）
  const g = newGame('marathon');
  fillRows(g, [19], [[3, 19], [4, 19], [5, 19], [6, 19]]);
  makePiece(g, 'I', 0, 0, 0, 'spawn');
  g.onEvent = () => {};
  g.hardDrop();
  eq('消行后进入消行动画（clearing）', g.phase, 'clearing');
  g.update(100);
  eq('动画 100ms 仍处消行动画（输入缓冲期，不出块）', g.phase, 'clearing');
  g.update(100);
  g.update(49);
  eq('动画 249ms 仍未出块', g.phase, 'clearing');
  g.update(1);
  eq('动画走完 250ms 立即出块（§7.4）', g.phase, 'falling');
  ok('出块为可操作新方块', !!g.active);
}

/* ================= 15. 危险预警滞回（§8.2） ================= */
console.log('\n[14] 危险预警滞回表驱动（≥16 进入 / <12 解除）');
{
  const g = newGame('marathon');
  g.onEvent = () => {};
  const setHeight = (h) => {
    for (let i = 0; i < 22; i++) g.grid[i][0] = 0;
    if (h > 0) for (let r = 20 - h; r <= 19; r++) g.grid[r + 2][0] = 'J';
  };
  // 数据行取自 §8.2 反馈表：dangerHeight=16（≥16 进入）、dangerClearHeight=12（<12 解除）
  const DANGER_ROWS = [
    { h: 15, want: false }, { h: 16, want: true }, { h: 13, want: true },
    { h: 12, want: true }, { h: 11, want: false }, { h: 20, want: true },
    { h: 12, want: true }, { h: 11, want: false },
  ];
  for (const row of DANGER_ROWS) {
    setHeight(row.h);
    g.updateDanger();
    eq(`堆叠高度 ${row.h} → danger=${row.want}（滞回 12–16）`, g.danger, row.want);
  }
}

console.log(`\n结果：${pass} 通过 / ${fail} 失败`);
process.exit(fail ? 1 : 0);
