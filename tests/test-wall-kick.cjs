/**
 * 贴墙/踢墙回归测试 —— 回归缺陷：贴墙旋转后方块嵌墙卡死（踢墙表不生效）
 *
 * 根因（已修）：rotate() 的碰撞检测曾用「旧朝向」算占格，kick 0 恒通过 →
 * 踢墙表永不生效，旋转后新形状嵌进墙里 → 下落检测恒 false → 卡死。
 *
 * 运行：node tests/test-wall-kick.cjs
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
	'src/core/rng.js', 'src/core/srs.js', 'src/core/game.js',
];
for (const f of FILES) {
	vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
}
const NP = ctx.NP;
const MODES = ctx.NP_CONFIG.modes;
const mode = MODES.find((m) => m.id === 'marathon');

let pass = 0, fail = 0;
function ok(name, cond, detail) {
	if (cond) { pass++; console.log(`  ✓ ${name}`); }
	else { fail++; console.log(`  ✗ ${name}${detail ? ' — ' + detail : ''}`); }
}

function newGame() {
	return new NP.game.Game(mode, {});
}
function makePiece(game, type, rot, px, py) {
	game.active = { type, rot, px, py, lastAction: 'spawn', lastKick: 0, kickIs180: false };
	game.phase = 'falling';
}
/** 断言：当前方块所有占格合法（不越界、不重叠）——canPlace 是权威判定 */
function layoutValid(game) {
	return game.canPlace(game.active, 0, 0);
}

console.log('\n== 贴墙旋转回归 ==');

// 1) 紧贴左右墙，各类型 × 各旋转方向：旋转后必须布局合法
{
	let allValid = true, tried = 0, detail = '';
	for (const type of ['I', 'J', 'L', 'S', 'T', 'Z', 'O']) {
		for (let rot = 0; rot < 4; rot++) {
			for (const [px, py, dir] of [[0, 2, 1], [9, 2, -1], [-1, 2, 1], [10, 2, -1], [0, 2, 2]]) {
				const g = newGame();
				makePiece(g, type, rot, px, py);
				if (!layoutValid(g)) continue; // 非法初始位跳过
				g.rotate(dir);
				tried++;
				if (!layoutValid(g)) {
					allValid = false;
					detail = `${type} rot${rot} @(${px},${py}) dir${dir} → 嵌墙/越界`;
					break;
				}
			}
		}
	}
	ok(`贴墙旋转后布局合法（${tried} 种组合）`, allValid, detail);
}

// 2) 踢墙表生效：贴墙旋转若成功应产生 kick 位移（px/py 变化），而非原地硬转
{
	const g = newGame();
	makePiece(g, 'I', 1, 4, 5);   // I 竖平移 +4 → 占 c=9 贴右墙；转横占 c=7..10 必越界，逼踢墙向左
	if (!layoutValid(g)) { fail++; console.log('  ✗ 用例2 初始位非法（测试场景错误）'); }
	else {
		const before = { px: g.active.px, py: g.active.py, rot: g.active.rot };
		const moved = g.rotate(1);
		const shifted = g.active.px !== before.px || g.active.py !== before.py;
		ok('贴墙旋转触发踢墙位移（kick 表生效）', moved && shifted, `before=${JSON.stringify(before)} after=(${g.active.px},${g.active.py},rot${g.active.rot})`);
	}
}

// 3) 旋转后不卡死：下方无阻挡时必须能下落
{
	const g = newGame();
	makePiece(g, 'T', 0, -3, 3);   // T 平移 -3 → 占 c=0..2 贴左墙悬空
	g.rotate(1);
	ok('贴墙旋转后仍可下落（不卡死）', g.canPlace(g.active, 0, 1), `pos=(${g.active.px},${g.active.py},rot${g.active.rot})`);
}

// 4) 半堵场景（下方障碍逼出深度 kick）：旋转后仍合法
{
	const g = newGame();
	for (let c = 0; c < 10; c++) if (c !== 0) g.grid[10][c] = 'J'; // 行 8 铺满只留左 1 格
	makePiece(g, 'T', 2, -3, 7);
	g.rotate(-1);
	ok('障碍逼墙旋转后布局合法', layoutValid(g));
}

console.log(`\n结果：${pass} 通过 / ${fail} 失败`);
process.exit(fail ? 1 : 0);
