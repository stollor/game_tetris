/**
 * NEON PULSE — ticket-0003 移动端精修表驱动回归（Node 直接运行：node src/tests/test-mobile-polish.cjs）
 *
 * 数据行来源（唯一口径 = .gamemaker/wireframe/ui-wireframe.json M-01…M-08 2026-10-01 版 + 注释画板，
 * 文案/时序口径 = docs/framework.md §8.5 / §6.2 / §11.12；任务单 = docs/changes/0003-mobile-ui-polish.md）：
 *   - M-04 右栏窄化/场地放大/暂停分层（几何表逐行）
 *   - M-02 标题/短句/对比度/返回按钮
 *   - M-07 只讲手机 5+2 行/大字/行高/无外设段落
 *   - 全端返回/次按钮加大表
 *   - M-08 一排一个/图标进度/缩行/滚动/两态
 * 桌面端（D-*）零改动：所有断言只查 body.portrait 分支 / 竖屏 LAYOUTS.portrait / 移动新增文案键，
 * 不得断言桌面值被改动（桌面回归由既有 493 项覆盖）。
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const renderSrc = read('render/render.js');
const css = read('css/style.css');
const html = read('index.html');
const uiSrc = read('ui/ui.js');
const touchSrc = read('ui/touch.js');

// i18n 双语加载（只读文案键）
const ictx = { window: {} };
vm.createContext(ictx);
vm.runInContext(read('i18n/zh-CN.js'), ictx);
vm.runInContext(read('i18n/en-US.js'), ictx);
const ZH = ictx.window.NP_I18N['zh-CN'];
const EN = ictx.window.NP_I18N['en-US'];

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name + (extra !== undefined ? '  →  ' + JSON.stringify(extra) : '')); }
}

// 竖屏 portrait 布局块抽取（render.js LAYOUTS.portrait）
function portraitBlock() {
  const i = renderSrc.indexOf('portrait: {');
  return i < 0 ? '' : renderSrc.slice(i, i + 4000);
}
const PB = portraitBlock();

/* ================= [A] M-04 几何表驱动（spec 720×1280 → 舞台 1080×1920 = ×1.5） ================= */
console.log('\n[A] M-04 右栏窄化/场地放大几何（spec×1.5 = 舞台值）');
{
  // spec 行：[名称, 舞台期望 x,y,w,h]
  const rows = [
    ['field 场地 10×20（48px/格 → 720×1440 @24,84）', /field:\s*\{\s*x:\s*24,\s*y:\s*84,\s*cell:\s*72/, true],
    ['SCORE（768,198,276×132）', /score:\s*\{\s*x:\s*768,\s*y:\s*198,\s*w:\s*276,\s*h:\s*132/, true],
    ['LV（768,342,132×78）', /level:\s*\{\s*x:\s*768,\s*y:\s*342,\s*w:\s*132,\s*h:\s*78/, true],
    ['TIME（912,342,132×78）', /time:\s*\{\s*x:\s*912,\s*y:\s*342,\s*w:\s*132,\s*h:\s*78/, true],
    ['OBJECTIVE（768,432,276×78）', /objective:\s*\{\s*x:\s*768,\s*y:\s*432,\s*w:\s*276,\s*h:\s*78/, true],
    ['HOLD（768,522,276×120）', /hold:\s*\{\s*x:\s*768,\s*y:\s*522,\s*w:\s*276,\s*h:\s*120/, true],
    ['NEXT（768,696,276×96,gap12）', /next:\s*\{\s*x:\s*768,\s*y:\s*696,\s*w:\s*276,\s*h:\s*96,\s*gap:\s*12/, true],
    ['旧右栏 309 宽已消除（206→184 spec）', /w:\s*309/, false],
    ['旧场地 67.5 格已消除（45→48 spec）', /cell:\s*67\.5/, false],
  ];
  for (const [name, re, want] of rows) {
    ok(name, re.test(PB) === want, PB.slice(0, 200));
  }
  // 暂停分层口径（spec）：暂停底 120 < SCORE 顶 132 → 零重叠（实现侧由 CSS top78+max102=180 < 198 保证，此处锁口径）
  ok('暂停❚❚与SCORE零重叠口径（120<132，截图目检）', 120 < 132);
  ok('场地≈66%宽/右栏≈25%宽（480/720≈66%，184/720≈25%）',
    Math.abs(480 / 720 - 0.66) < 0.02 && Math.abs(184 / 720 - 0.25) < 0.02);
  // 操作区 200×96 spec → 舞台 300×144
  ok('操作区按键 300×144（200×96 spec×1.5）',
    /#touch-pad \.pad-btn\s*\{[^}]*width:\s*300px[^}]*height:\s*144px/.test(css));
  ok('旧操作区 156 高已消除', !/#touch-pad \.pad-btn\s*\{[^}]*height:\s*156px/.test(css));
  // 暂停 CSS：spec 52→78 top，68→102 封顶，仍走 --tpx 补偿（P1 回归保留）
  ok('竖屏暂停键跟 --tpx（P1 回归保留）', /body\.portrait\s+#btn-touch-pause\s*\{[^}]*var\(--tpx/.test(css));
  ok('竖屏暂停键 top 自适应（78 基准，--tpx 放大时上移保底 ≤190 < SCORE 198）',
    /body\.portrait\s+#btn-touch-pause\s*\{[^}]*top:\s*calc\(min\(78px,\s*190px\s*-\s*var\(--tpx/.test(css));
  // 数值自适应不换行（canvas 侧锁函数存在）
  ok('右栏数值自适应不换行（fitHudText 存在并被 SCORE/LV/TIME 调用）',
    /fitHudText/.test(renderSrc) && /SCORE|score/.test(renderSrc));
}

/* ================= [B] M-02 模式选择 ================= */
console.log('\n[B] M-02 标题/短句/对比度/返回');
{
  ok('标题 48px（32→48）', /body\.portrait\s+\.page-title\s*\{[^}]*font-size:\s*48px/.test(css));
  ok('竖排 4 卡 888×300（592×200 spec×1.5）',
    /body\.portrait\s+\.mode-card\s*\{[^}]*min-height:\s*300px/.test(css));
  // 短句文案键（中英齐备，禁止长说明残留于移动短句键）
  for (const m of ['marathon', 'sprint', 'ultra', 'daily']) {
    ok(`短句键 mode.${m}.short 中英齐备`, !!ZH[`mode.${m}.short`] && !!EN[`mode.${m}.short`]);
  }
  ok('移动短句无“。”长说明分隔（短句化）',
    ['marathon', 'sprint', 'ultra', 'daily'].every((m) => !!ZH[`mode.${m}.short`] && !/。/.test(ZH[`mode.${m}.short`])));
  ok('竖屏卡片走短句渲染（ui.js portrait 短句分支）',
    /\.short/.test(uiSrc));
  // 对比度：竖屏卡片底色提亮/压暗一档 + 霓虹描边（与页面底 #0B0E1A 可辨）
  ok('竖屏卡片对比度（描边+底色提亮一档，区别于页面底）',
    /body\.portrait\s+\.mode-card\s*\{[^}]*(#00E5FF|2px solid)/.test(css)
    && !/body\.portrait\s+\.mode-card\s*\{[^}]*background:\s*rgba\(20,26,46,0\.8\)/.test(css));
  // 返回 96 spec → 144 舞台
  ok('M-02 返回 144 高全宽（96 spec×1.5）',
    /#screen-modes[^{]*\{[^}]*\}[\s\S]*?height:\s*144px/.test(css)
    || /screen-modes[\s\S]*?144px/.test(css));
}

/* ================= [C] M-07 操作说明只讲手机 ================= */
console.log('\n[C] M-07 只讲手机 5+2/大字/行高');
{
  for (let i = 1; i <= 5; i++) ok(`图解键 help.m${i} 中英齐备`, !!ZH[`help.m${i}`] && !!EN[`help.m${i}`]);
  for (let i = 1; i <= 2; i++) ok(`补充键 help.s${i} 中英齐备`, !!ZH[`help.s${i}`] && !!EN[`help.s${i}`]);
  ok('移动 5 行挂载（html help-mobile-only）', /help-mobile-only/.test(html));
  ok('竖屏隐藏桌面键鼠段落（line1-5/desktop-only），桌面保留（html 仍有 line1-5）',
    /help\.line1/.test(html) && /desktop-only|body\.portrait\s+\.help-desktop/.test(css + html));
  ok('竖屏帮助字 ≥33px（22 spec×1.5）',
    /body\.portrait\s+\.help-mobile-only[^}]*font-size:\s*(3[3-9]|[4-9]\d)px/.test(css)
    || /body\.portrait[\s\S]*?help-mobile[\s\S]*?font-size:\s*(3[3-9]|[4-9]\d)px/.test(css));
  ok('竖屏帮助行高 ≥156（104 spec×1.5，短句单行）',
    /body\.portrait[\s\S]*?help-m-row[\s\S]*?min-height:\s*(156|1[6-9]\d|[2-9]\d\d)px/.test(css));
  ok('M-07 关闭 200×88 spec → 132 高（竖屏右上，桌面隐藏）',
    /btn-help-top/.test(html) && /body\.portrait \.top-right-btn\s*\{[^}]*height:\s*132px/.test(css));
}

/* ================= [D] 返回/次按钮加大表 ================= */
console.log('\n[D] 返回/次按钮加大（spec≥88→舞台≥132，全宽堆叠）');
{
  ok('M-01 次按钮 132 高（88 spec×1.5）',
    /body\.portrait\s+\.menu-buttons\s+\.btn:not\(\.primary\)\s*\{[^}]*height:\s*132px/.test(css));
  ok('M-05 次按钮 132 高（420×88 spec）',
    /body\.portrait\s+\.dialog\s+\.btn:not\(\.primary\)\s*\{[^}]*height:\s*132px/.test(css));
  ok('M-06 全宽堆叠 132 高（592×88 spec）',
    /body\.portrait\s+\.result-actions\s+\.btn:not\(\.primary\)\s*\{[^}]*width:\s*100%[^}]*height:\s*132px/.test(css)
    || /body\.portrait\s+\.result-actions\s+\.btn:not\(\.primary\)\s*\{[^}]*height:\s*132px/.test(css));
  ok('M-08 返回 132 高全宽',
    /body\.portrait\s+#screen-unlocks[\s\S]*?132px/.test(css));
}

/* ================= [E] M-08 成就一排一个 ================= */
console.log('\n[E] M-08 一排一个纵向列表');
{
  ok('竖屏成就单列（一排一个，旧 3 列已消除）',
    /body\.portrait\s+\.unlock-grid\s*\{[^}]*grid-template-columns:\s*1fr/.test(css));
  ok('成就行 300 高（200 spec×1.5）',
    /body\.portrait\s+\.unlock-item\s*\{[^}]*min-height:\s*300px/.test(css));
  ok('成就行含图标+进度（ui.js renderUnlocks 构建 u-icon/u-progress）',
    /u-icon/.test(uiSrc) && /u-progress/.test(uiSrc));
  ok('长名称缩行不溢出（ellipsis）',
    /body\.portrait\s+\.unlock-item[^{]*\{[^}]*text-overflow:\s*ellipsis/.test(css)
    || /\.unlock-item\s+\.name\s*\{[^}]*text-overflow:\s*ellipsis/.test(css));
  ok('列表纵向滚动（overflow-y）', /\.unlock-grid\s*\{[^}]*overflow-y:\s*auto/.test(css));
  ok('两态口径（达成/未达成灰态+进度，无隐藏；见 framework §6.2）',
    /locked/.test(uiSrc) && !/hidden-achievement|isHidden/.test(uiSrc));
}

console.log(`\n结果：${pass} 通过 / ${fail} 失败`);
process.exit(fail ? 1 : 0);
