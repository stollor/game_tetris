/**
 * NEON PULSE — Canvas 2D 渲染引擎（04-audio-fx/docs/03-shader-fx-design.md §7 Canvas 降级路径）
 * 绘制层级（对应 §2）：L0 背景 → L1 场地网格 → L2/L3 方块（含 Ghost）→ L4 消行/锁定/拖尾
 * → L5 粒子 → L6 全屏特效（色环/升级/破纪录）→ L7 危险红光 → L8 HUD/字幕/画中画。
 * 所有特效均为非阻塞叠加层；时间源 = 音频时钟（暂停冻结）。
 */
(function (global) {
  'use strict';

  /* 运行时舞台尺寸（横屏 1920×1080 / 竖屏 9:16=1080×1920，setLayout 切换，§9） */
  let W = 1920, H = 1080;
  const SRS = () => global.NP.srs;

  /* ---------- 布局（art-direction-brief §5，1920×1080 @16:9；竖屏 9:16 移动端优先，§9） ----------
     竖屏布局：场地上部居中、HUD 紧随其下、底部预留虚拟按键操作区（§8.5 / DoD 10 不遮挡场地与 HUD）。 */
  const LAYOUTS = {
    landscape: {
      field: { x: 720, y: 150, cell: 40, cols: 10, rows: 20 },   // 400×800
      hold: { x: 330, y: 190, w: 200, h: 160 },
      next: { x: 345, y: 396, w: 112, h: 112, gap: 16, count: 5, horizontal: false },
      pip: { x: 1596, y: 648, w: 306, h: 408 },
      hud: {
        score: { x: 1210, y: 150, w: 380, h: 130 },
        level: { x: 1210, y: 300, w: 180, h: 110 },
        combo: { x: 1410, y: 300, w: 180, h: 110 },
        b2b: { x: 1210, y: 430, w: 180, h: 96 },
        time: { x: 1410, y: 430, w: 180, h: 96 },
        objective: { x: 1210, y: 546, w: 380, h: 120 },
        best: { x: 1210, y: 686, w: 380, h: 86 },
        clear: { x: 1400, y: 810 },
      },
      padZoneY: 960,           // 底部虚拟按键区起点（DOM 层对齐，不遮挡场地/HUD）
    },
    // 竖屏 M-04（1080×1920 = 720×1280 线框 ×1.5，ticket-0003 精修）：
    // 右栏窄化 206→184（舞台 309→276，内容紧凑排版），场地 45→48px/格（舞台 cell 72，720×1440 @24,84，
    // 高度吃满顶栏下缘到操作区上缘；比例场地≈66%宽/右栏≈25%宽）；暂停❚❚独占右上（DOM 层 102×102 @954,78，
    // 底 180 < SCORE 顶 198，零重叠）；NEXT 格 184×64 spec（舞台 276×96）。
    // COMBO/B2B 不占侧栏（场中央浮字，§8.2 阈值表）；BEST 不进对局侧栏（结算/模式卡展示）。
    portrait: {
      field: { x: 24, y: 84, cell: 72, cols: 10, rows: 20 },   // 720×1440，全高左侧（48px/格 spec）
      hold: { x: 768, y: 522, w: 276, h: 120 },
      next: { x: 768, y: 696, w: 276, h: 96, gap: 12, count: 5, horizontal: false },
      pip: { x: 387, y: 700, w: 306, h: 408 },
      hud: {
        score: { x: 768, y: 198, w: 276, h: 132 },
        level: { x: 768, y: 342, w: 132, h: 78 },
        time: { x: 912, y: 342, w: 132, h: 78 },
        objective: { x: 768, y: 432, w: 276, h: 78 },
        clear: { x: 540, y: 1446 },
      },
      padZoneY: 1548,          // y ≥ 1548 全部留给底部手柄式 3+3 操作区（M-04：0,1548 1080×372）
    },
  };
  const LAY = Object.assign({}, LAYOUTS.landscape);

  /* ---------- 工具 ---------- */
  function hexRgb(hex) {
    // 防御：非法/未知色值（如调试夹具注入的假方块色）不得把 NaN 写进 CanvasGradient，
    // 否则 addColorStop 抛 SyntaxError 污染控制台；解析失败统一回退为安全灰白。
    const h = String(hex == null ? '' : hex).replace('#', '');
    const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
    if (!isFinite(r) || !isFinite(g) || !isFinite(b)) return [170, 180, 200];
    return [r, g, b];
  }
  function rgba(hex, a) { const [r, g, b] = hexRgb(hex); return `rgba(${r},${g},${b},${a})`; }
  function mixWhite(hex, t) {
    const [r, g, b] = hexRgb(hex);
    return `rgb(${Math.round(r + (255 - r) * t)},${Math.round(g + (255 - g) * t)},${Math.round(b + (255 - b) * t)})`;
  }
  function mixBlack(hex, t) {
    const [r, g, b] = hexRgb(hex);
    return `rgb(${Math.round(r * (1 - t))},${Math.round(g * (1 - t))},${Math.round(b * (1 - t))})`;
  }
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);            // ≈ cubic-bezier(0.16,1,0.3,1)
  const overshoot = (t) => { const c = 1.70158 * 1.2; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };

  /* ---------- 素材加载 ---------- */
  const IMG = {};
  const SPRITES = {
    lineBurst: { url: 'assets/effect/fx/fx_line_burst.png', frames: 16, cols: 4, cell: 256, fps: 60 },
    comboRing: { url: 'assets/effect/fx/fx_combo_ring.png', frames: 16, cols: 4, cell: 256, fps: 60 },
    recordBurst: { url: 'assets/effect/fx/fx_record_burst.png', frames: 18, cols: 6, cell: 256, fps: 60 },
    pcBurst: { url: 'assets/effect/fx/fx_pc_burst.png', frames: 16, cols: 4, cell: 256, fps: 60 },
    lockFlash: { url: 'assets/effect/fx/fx_lock_flash.png', frames: 8, cols: 4, cell: 128, fps: 60 },
    dropTrail: { url: 'assets/effect/fx/fx_drop_trail.png', frames: 8, cols: 4, cell: 128, fps: 60 },
    levelWave: { url: 'assets/effect/fx/fx_levelup_wave.png', frames: 18, cols: 6, cell: 256, fps: 60 },
    dangerPulse: { url: 'assets/effect/fx/fx_danger_pulse.png', frames: 8, cols: 4, cell: 256, fps: 12 },
  };
  const PARTICLES = {
    glow: 'assets/effect/fx/particle_glow.png',
    spark: 'assets/effect/fx/particle_spark.png',
    shard: 'assets/effect/fx/particle_shard.png',
  };

  const state = {
    canvas: null, ctx: null,
    skinColors: Object.assign({}, SRS().DEFAULT_COLORS),
    bgTheme: 'default',
    fxLevel: 'mid',
    reducedFlash: false,
    shake: { amp: 0, t: 0, dur: 0, rebound: false },
    beatPulse: 0,
    captions: [],
    floats: [],
    particles: [],
    fxList: [],        // 序列帧叠加层 {sprite, t0, dur, x, y, w, h, alpha}
    clearFx: [],       // 消行动画（白闪行 + 光条）
    levelPulseT0: -1,
    recordT0: -1,
    comboRings: [],
    dangerT: 0,
    ghostAlpha: 0.5,
    replay: { active: false, frames: [], t0: 0, fade: 0, enabled: true },
    debug: null,
    fps: 60,
  };

  function loadImages() {
    const load = (key, url) => {
      const img = new Image();
      img.src = url;
      IMG[key] = img;
    };
    load('bgField', 'assets/texture/scene/scene-field-bg.png');
    load('bgMenu', 'assets/texture/scene/scene-menu-bg.png');
    for (const k of Object.keys(SPRITES)) load(k, SPRITES[k].url);
    for (const k of Object.keys(PARTICLES)) load(k, PARTICLES[k]);
  }

  /* ---------- 粒子着色缓存（tint + Additive） ---------- */
  const tintCache = {};
  function tinted(key, color) {
    const ck = key + '|' + color;
    if (tintCache[ck]) return tintCache[ck];
    const img = IMG[key];
    if (!img || !img.complete || !img.naturalWidth) return null;
    const c = document.createElement('canvas');
    c.width = img.naturalWidth; c.height = img.naturalHeight;
    const g = c.getContext('2d');
    g.drawImage(img, 0, 0);
    g.globalCompositeOperation = 'source-in';
    g.fillStyle = color;
    g.fillRect(0, 0, c.width, c.height);
    tintCache[ck] = c;
    return c;
  }

  /* ==================== 方块格材质（block_cell 降级实现） ==================== */
  function drawCell(ctx, x, y, size, color, alpha, glowMul) {
    const pad = 1.5;
    ctx.save();
    ctx.globalAlpha = alpha;
    // 外发光
    ctx.shadowColor = rgba(color, 0.9);
    ctx.shadowBlur = 13 * glowMul;
    // 主体：上亮下暗微渐变（10–15%）
    const g = ctx.createLinearGradient(x, y, x, y + size);
    g.addColorStop(0, mixWhite(color, 0.30));
    g.addColorStop(1, mixBlack(color, 0.28));
    ctx.fillStyle = g;
    ctx.fillRect(x + pad, y + pad, size - pad * 2, size - pad * 2);
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = alpha;
    // 内高光：上 / 左
    ctx.strokeStyle = mixWhite(color, 0.55);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + 4, y + 3.5); ctx.lineTo(x + size - 4, y + 3.5);
    ctx.moveTo(x + 3.5, y + 4); ctx.lineTo(x + 3.5, y + size - 4);
    ctx.stroke();
    // 内暗线：下 / 右
    ctx.strokeStyle = mixBlack(color, 0.45);
    ctx.beginPath();
    ctx.moveTo(x + 4, y + size - 3.5); ctx.lineTo(x + size - 4, y + size - 3.5);
    ctx.moveTo(x + size - 3.5, y + 4); ctx.lineTo(x + size - 3.5, y + size - 4);
    ctx.stroke();
    // 描边
    ctx.strokeStyle = mixWhite(color, 0.62);
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x + 2, y + 2, size - 4, size - 4);
    ctx.restore();
  }

  function drawGhostCell(ctx, x, y, size, color, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = rgba(color, 0.22);
    ctx.fillRect(x + 3, y + 3, size - 6, size - 6);
    ctx.strokeStyle = rgba(color, 0.75);
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 5]);
    ctx.strokeRect(x + 3, y + 3, size - 6, size - 6);
    ctx.restore();
  }

  /* ==================== 面板（扁平矩形 + 斜切角 + 1px 霓虹描边） ==================== */
  function chamferPath(ctx, x, y, w, h, cut) {
    ctx.beginPath();
    ctx.moveTo(x + cut, y);
    ctx.lineTo(x + w, y);
    ctx.lineTo(x + w, y + h - cut);
    ctx.lineTo(x + w - cut, y + h);
    ctx.lineTo(x, y + h);
    ctx.lineTo(x, y + cut);
    ctx.closePath();
  }
  function drawPanel(ctx, x, y, w, h, glow) {
    chamferPath(ctx, x, y, w, h, 14);
    ctx.fillStyle = 'rgba(20,26,46,0.72)';
    ctx.fill();
    ctx.strokeStyle = rgba('#2A3352', 0.9);
    ctx.lineWidth = 1.5;
    ctx.stroke();
    if (glow) {
      ctx.save();
      ctx.strokeStyle = rgba('#00E5FF', 0.35 + 0.2 * glow);
      ctx.shadowColor = rgba('#00E5FF', 0.6);
      ctx.shadowBlur = 12;
      ctx.stroke();
      ctx.restore();
    }
  }
  function label(ctx, text, x, y, size, color, align) {
    ctx.font = `600 ${size}px "Rajdhani","Chakra Petch","Segoe UI",sans-serif`;
    ctx.fillStyle = color;
    ctx.textAlign = align || 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(text, x, y);
  }
  function numText(ctx, text, x, y, size, color, align) {
    ctx.font = `700 ${size}px "Consolas","Roboto Mono",monospace`;
    ctx.fillStyle = color;
    ctx.textAlign = align || 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(text, x, y);
  }
  /* M-04 右栏窄化配套：数值字号自适应不换行（ticket-0003）。
     在给定最大宽度内按需缩小字号绘制，单行不换行不溢出；桌面宽栏不受影响（传入 maxW 极大即原逻辑）。 */
  function fitHudText(ctx, text, x, y, baseSize, maxW, color, weight) {
    let size = baseSize;
    const fam = weight === 'label'
      ? `"Rajdhani","Chakra Petch","Segoe UI",sans-serif`
      : `"Consolas","Roboto Mono",monospace`;
    const wt = weight === 'label' ? 600 : 700;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    while (size > 10) {
      ctx.font = `${wt} ${size}px ${fam}`;
      try {
        if (ctx.measureText(text).width <= maxW) break;
      } catch (_) { break; }   // 桩环境无 measureText：保持基准字号
      size -= 2;
    }
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
    return size;
  }

  /* ==================== 特效触发 API ==================== */
  const fx = {
    shake(px, ms, rebound) {
      const map = state.fxLevel === 'low' ? 0 : state.fxLevel === 'high' ? 1.12 : 1;
      state.shake = { amp: px * map, t: 0, dur: ms / 1000, rebound: rebound && state.fxLevel === 'high' };
    },
    beatPulse() { state.beatPulse = 1; },
    lineClear(rows, colors, lines, tspinLabel) {
      const now = global.NP.audio.now();
      rows.forEach((rowIdx, i) => {
        state.clearFx.push({
          row: rowIdx, t0: now + i * 0.04, dur: 0.25,      // 多行错位 40ms
          colors: colors.slice(),
        });
      });
      state.fxList.push({
        sprite: 'lineBurst', t0: now, dur: 0.267,
        x: LAY.field.x, y: LAY.field.y + rows[0] * LAY.field.cell - 8,
        w: LAY.field.cols * LAY.field.cell, h: rows.length * LAY.field.cell + 16,
        alpha: 1, playTo: 8,
      });
      if (lines === 4) {
        state.fxList.push({ sprite: 'pcBurst', t0: now, dur: 0.267, x: LAY.field.x - 120, y: LAY.field.y + 260, w: 640, h: 640, alpha: 0.5 });
      }
    },
    lockFlash(cells, color) {
      const now = global.NP.audio.now();
      for (const [c, r] of cells) {
        if (r < 0) continue;
        state.fxList.push({
          sprite: 'lockFlash', t0: now, dur: 0.133,
          x: LAY.field.x + c * LAY.field.cell, y: LAY.field.y + r * LAY.field.cell,
          w: LAY.field.cell, h: LAY.field.cell, alpha: 0.9, color,
        });
      }
    },
    dropTrail(cells, color) {
      const now = global.NP.audio.now();
      const byCol = {};
      for (const [c, r] of cells) {
        if (!byCol[c] || r < byCol[c]) byCol[c] = r;
      }
      for (const c of Object.keys(byCol)) {
        const r = byCol[c];
        if (r < 0) continue;
        state.fxList.push({
          sprite: 'dropTrail', t0: now, dur: 0.133,
          x: LAY.field.x + c * LAY.field.cell, y: LAY.field.y + Math.max(0, r - 2) * LAY.field.cell,
          w: LAY.field.cell, h: LAY.field.cell * 3, alpha: 0.8, color,
        });
      }
    },
    comboRing() {
      const now = global.NP.audio.now();
      state.comboRings.push({ t0: now, dur: 0.3 });
      if (state.comboRings.length > 3) state.comboRings.shift();
    },
    levelPulse() { state.levelPulseT0 = global.NP.audio.now(); },
    recordBurst() { state.recordT0 = global.NP.audio.now(); fx.shake(5, 300); },
    caption(text, opts) {
      const now = global.NP.audio.now();
      state.captions.push(Object.assign({
        text, sub: '', t0: now, dur: 0.7, size: 48, color: '#EAF2FF', glow: '#00E5FF', y: 0.42,
      }, opts || {}));
    },
    floatScore(text, color) {
      const now = global.NP.audio.now();
      state.floats.push({ text, color: color || '#FFD54F', t0: now, dur: 0.5 });
    },
    particles(list) {
      const budget = global.NP_CONFIG.balance.feedback.particleLimit;
      const mul = state.fxLevel === 'low' ? 0.35 : 1;
      const n = Math.round(list.length * mul);
      for (let i = 0; i < n && state.particles.length < budget; i++) state.particles.push(list[i]);
    },
    setReplay(frames) { state.replay.frames = frames; },
    startReplay() { state.replay.active = true; state.replay.t0 = global.NP.audio.now(); state.replay.fade = 0; },
    stopReplay() { state.replay.active = false; },
    setFxLevel(l) { state.fxLevel = l; },
    setReducedFlash(v) { state.reducedFlash = v; },
    setSkin(colors) { state.skinColors = colors || Object.assign({}, SRS().DEFAULT_COLORS); },
    setBgTheme(id) { state.bgTheme = id || 'default'; },
  };

  /* ==================== 主绘制 ==================== */
  function frame(game, dtSec) {
    const ctx = state.ctx;
    const now = global.NP.audio.now();
    const cfg = global.NP_CONFIG.balance.feedback;

    // 震屏（内容层整体位移，HUD 不震）
    let sx = 0, sy = 0;
    const sh = state.shake;
    if (sh.dur > 0) {
      sh.t += dtSec;
      const k = Math.max(0, 1 - sh.t / sh.dur);
      const amp = sh.amp * easeOut(k);
      sx = Math.sin(sh.t * 90) * amp;
      sy = Math.cos(sh.t * 77) * amp * 0.8;
      if (sh.rebound && sh.t > sh.dur) { sh.dur = 0; state.shake = { amp: 1.5, t: 0, dur: 0.08, rebound: false }; }
    }

    ctx.clearRect(0, 0, W, H);
    drawBackground(ctx, dtSec, game);

    ctx.save();
    ctx.translate(sx, sy);
    drawField(ctx, game, now);
    drawFxLayers(ctx, now, game);
    ctx.restore();

    drawDanger(ctx, game, now);
    drawHud(ctx, game, now, cfg);
    drawCaptions(ctx, now);
    drawFloats(ctx, now);
    drawReplayWindow(ctx, now);
    if (state.debug) drawDebug(ctx, game);
  }

  /* ---------- L0 背景：城市剪影 + 数据流 + 节拍脉冲 ---------- */
  function drawBackground(ctx, dtSec, game) {
    const speed = game ? global.NP.game.bpmOf(game.level) / 128 : 1;
    state.bgOffset = (state.bgOffset || 0) + dtSec * 14 * speed;
    const img = IMG.bgField;
    if (img && img.complete && img.naturalWidth) {
      const scale = Math.max(W / img.naturalWidth, H / img.naturalHeight);
      const dw = img.naturalWidth * scale, dh = img.naturalHeight * scale;
      const off = state.bgOffset % 40;
      ctx.drawImage(img, -off, (H - dh) / 2, dw, dh);
      ctx.drawImage(img, -off + dw - 1, (H - dh) / 2, dw, dh);
    } else {
      ctx.fillStyle = '#0B0E1A';
      ctx.fillRect(0, 0, W, H);
    }
    // 主题微调（解锁背景：雨夜 / 数据流 / 日蚀）
    const tint = { default: 'rgba(11,14,26,0.45)', rain: 'rgba(10,20,40,0.5)', dataflow: 'rgba(8,12,34,0.5)', eclipse: 'rgba(20,10,30,0.55)' }[state.bgTheme] || 'rgba(11,14,26,0.45)';
    ctx.fillStyle = tint;
    ctx.fillRect(0, 0, W, H);

    // 数据流粒子（竖向细线，随 BPM 加速）
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const n = state.fxLevel === 'low' ? 8 : 18;
    for (let i = 0; i < n; i++) {
      const x = ((i * 137.5 + state.bgOffset * (1 + (i % 3) * 0.4)) % (W + 200)) - 100;
      const y = ((i * 311.7 + state.bgOffset * 2.2) % (H + 120)) - 60;
      ctx.fillStyle = i % 2 ? 'rgba(0,229,255,0.10)' : 'rgba(124,77,255,0.10)';
      ctx.fillRect(x, y, 2, 26);
    }
    // 节拍脉冲（每小节第 1 拍，150ms 衰减）
    if (state.beatPulse > 0.01) {
      ctx.fillStyle = `rgba(0,229,255,${0.06 * state.beatPulse})`;
      ctx.fillRect(0, 0, W, H);
    }
    ctx.restore();
    state.beatPulse = Math.max(0, state.beatPulse - dtSec * 6.7);
  }

  /* ---------- L1–L3 场地 + 方块 ---------- */
  function drawField(ctx, game, now) {
    const F = LAY.field;
    // 场地底 + 网格（低亮度半透明）
    ctx.fillStyle = 'rgba(20,26,46,0.55)';
    ctx.fillRect(F.x, F.y, F.cols * F.cell, F.rows * F.cell);
    ctx.strokeStyle = rgba('#2A3352', 0.35);
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let c = 0; c <= F.cols; c++) {
      ctx.moveTo(F.x + c * F.cell, F.y); ctx.lineTo(F.x + c * F.cell, F.y + F.rows * F.cell);
    }
    for (let r = 0; r <= F.rows; r++) {
      ctx.moveTo(F.x, F.y + r * F.cell); ctx.lineTo(F.x + F.cols * F.cell, F.y + r * F.cell);
    }
    ctx.stroke();
    // 场地外框（霓虹描边）
    ctx.strokeStyle = rgba('#2A3352', 0.95);
    ctx.lineWidth = 2;
    ctx.strokeRect(F.x - 1, F.y - 1, F.cols * F.cell + 2, F.rows * F.cell + 2);

    if (!game) return;
    const colors = state.skinColors;
    const glowMul = { low: 0.5, mid: 1.0, high: 1.4 }[state.fxLevel];

    // L2 已锁定方块（可视行 0..19；隐藏行不显示，但消行动画可越界显示）
    for (let r = 0; r < 20; r++) {
      for (let c = 0; c < 10; c++) {
        const v = game.grid[r + 2][c];
        if (v) drawCell(ctx, F.x + c * F.cell, F.y + r * F.cell, F.cell, colors[v] || '#fff', 1, glowMul);
      }
    }

    // Ghost（半透明落点投影，2.6s 呼吸；13 级起振幅 +30%）
    const p = game.active;
    if (p && game.phase === 'falling') {
      const breath = 0.42 + 0.065 * (1 + Math.sin(now / 2.6 * Math.PI * 2)) * (game.level >= 13 ? 1.3 : 1);
      let gy = 0;
      while (game.canPlace(p, 0, gy + 1)) gy++;
      const ghostCells = SRS().cellsOf(p.type, p.rot, p.px, p.py + gy);
      for (const [c, r] of ghostCells) {
        if (r < 0) continue;
        drawGhostCell(ctx, F.x + c * F.cell, F.y + r * F.cell, F.cell, colors[p.type], breath);
      }
      // L3 活动方块（出块淡入 80ms）
      const age = Math.min(1, (now - (game.activeSpawnAt || now - 0.1)) / 0.08);
      const alpha = 0.4 + 0.6 * easeOut(age);
      const cells = SRS().cellsOf(p.type, p.rot, p.px, p.py);
      for (const [c, r] of cells) {
        if (r < 0) continue;
        drawCell(ctx, F.x + c * F.cell, F.y + r * F.cell + (1 - easeOut(age)) * 4, F.cell, colors[p.type], alpha, glowMul);
      }
    }
  }

  /* ---------- L4–L6 特效叠加层（Additive） ---------- */
  function drawFxLayers(ctx, now, game) {
    const F = LAY.field;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    // 消行白闪（0–90ms，行高外扩 1.75×）+ 光条
    state.clearFx = state.clearFx.filter((e) => now - e.t0 < e.dur);
    for (const e of state.clearFx) {
      const t = Math.max(0, (now - e.t0) / e.dur);
      const a = (1 - t) * 0.95;
      const hEx = F.cell * (1 + 0.75 * t);
      const y = F.y + e.row * F.cell + (F.cell - hEx) / 2;
      const g = ctx.createLinearGradient(F.x, y, F.x + F.cols * F.cell, y);
      g.addColorStop(0, `rgba(255,255,255,${a})`);
      g.addColorStop(0.5, `rgba(200,240,255,${a * 0.9})`);
      g.addColorStop(1, `rgba(255,255,255,${a * 0.5})`);
      ctx.fillStyle = g;
      ctx.fillRect(F.x, y, F.cols * F.cell, hEx);
    }

    // 序列帧特效（锁闪 / 拖尾 / 消行爆光 / 升级 / 破纪录 / 全清 / 色环）
    state.fxList = state.fxList.filter((e) => now - e.t0 < e.dur);
    for (const e of state.fxList) {
      const sp = SPRITES[e.sprite];
      const img = IMG[e.sprite];
      const t = (now - e.t0) / e.dur;
      if (t < 0 || !img || !img.complete || !img.naturalWidth) continue;
      const playTo = e.playTo || sp.frames;
      const f = Math.min(playTo - 1, Math.floor(t * e.dur * sp.fps));
      const sxp = (f % sp.cols) * sp.cell;
      const syp = Math.floor(f / sp.cols) * sp.cell;
      ctx.globalAlpha = (e.alpha != null ? e.alpha : 1) * (t > 0.6 ? (1 - t) / 0.4 : 1);
      ctx.drawImage(img, sxp, syp, sp.cell, sp.cell, e.x, e.y, e.w, e.h);
      ctx.globalAlpha = 1;
    }

    // 粒子（碎块 / 辉光 / 火花）
    state.particles = state.particles.filter((p) => now - p.t0 < p.life);
    for (const p of state.particles) {
      const t = (now - p.t0) / p.life;
      const img = tinted(p.kind, p.color) || IMG[p.kind];
      if (!img) continue;
      const x = p.x + p.vx * (now - p.t0) * 60;
      const y = p.y + p.vy * (now - p.t0) * 60 + (p.gravity || 0) * Math.pow(now - p.t0, 2) * 600;
      const s = p.size * (1 - t * 0.5);
      ctx.globalAlpha = Math.max(0, 1 - t) * (p.alpha != null ? p.alpha : 1);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate((p.rot || 0) * (now - p.t0));
      ctx.drawImage(img, -s / 2, -s / 2, s, s);
      ctx.restore();
    }
    ctx.globalAlpha = 1;

    // Combo ≥5 全屏色环（最多 3 环错峰）
    state.comboRings = state.comboRings.filter((r) => now - r.t0 < r.dur);
    if (state.fxLevel !== 'low') {
      for (const r of state.comboRings) {
        const img = IMG.comboRing;
        if (!img || !img.complete) continue;
        const t = (now - r.t0) / r.dur;
        const f = Math.min(15, Math.floor(t * 16));
        ctx.globalAlpha = 1 - t * 0.4;
        const s = 900 + t * 700;
        ctx.drawImage(img, (f % 4) * 256, Math.floor(f / 4) * 256, 256, 256, W / 2 - s / 2, H / 2 - s / 2, s, s);
        ctx.globalAlpha = 1;
      }
    }

    // 升级全屏色彩脉冲（300ms）
    if (state.levelPulseT0 >= 0 && state.fxLevel !== 'low') {
      const t = (now - state.levelPulseT0) / 0.3;
      if (t >= 1) state.levelPulseT0 = -1;
      else {
        const img = IMG.levelWave;
        if (img && img.complete) {
          const f = Math.min(17, Math.floor(t * 18));
          ctx.globalAlpha = 0.85 * (1 - t * 0.5);
          ctx.drawImage(img, (f % 6) * 256, Math.floor(f / 6) * 256, 256, 256, 0, 0, W, H);
          ctx.globalAlpha = 1;
        }
      }
    }

    // 破纪录全屏爆发（≤300ms 硬上限，非阻塞叠加层）
    if (state.recordT0 >= 0) {
      const t = (now - state.recordT0) / 0.3;
      if (t >= 1) state.recordT0 = -1;
      else {
        const img = IMG.recordBurst;
        if (img && img.complete) {
          const f = Math.min(17, Math.floor(t * 18));
          ctx.globalAlpha = 0.95 * (1 - t * 0.3);
          ctx.drawImage(img, (f % 6) * 256, Math.floor(f / 6) * 256, 256, 256, W / 2 - 700, H / 2 - 700, 1400, 1400);
          ctx.globalAlpha = 1;
        }
      }
    }
    ctx.restore();
  }

  /* ---------- L7 危险红光呼吸（2.0s 周期） ---------- */
  function drawDanger(ctx, game, now) {
    if (!game || !game.danger) return;
    const cfg = global.NP_CONFIG.balance.feedback;
    const mul = { low: 0.5, mid: 1, high: 1 }[state.fxLevel];
    const breathe = 0.5 + 0.5 * Math.sin(now / 2 * Math.PI * 2);
    const a = (0.18 + 0.22 * breathe) * mul;
    const F = LAY.field;
    const g1 = ctx.createLinearGradient(F.x - 60, 0, F.x + 30, 0);
    g1.addColorStop(0, `rgba(255,23,68,${a})`);
    g1.addColorStop(1, 'rgba(255,23,68,0)');
    ctx.fillStyle = g1;
    ctx.fillRect(F.x - 60, F.y - 20, 90, F.rows * F.cell + 40);
    const g2 = ctx.createLinearGradient(F.x + F.cols * F.cell + 60, 0, F.x + F.cols * F.cell - 30, 0);
    g2.addColorStop(0, `rgba(255,23,68,${a})`);
    g2.addColorStop(1, 'rgba(255,23,68,0)');
    ctx.fillStyle = g2;
    ctx.fillRect(F.x + F.cols * F.cell - 30, F.y - 20, 90, F.rows * F.cell + 40);
  }

  /* ---------- L8 HUD（槽位布局，横/竖屏共用一套绘制） ---------- */
  function drawHud(ctx, game, now, cfg) {
    const T = global.NP.t;
    const HD = LAY.hud;

    // HOLD（P2 ticket-0002 采样2：竖屏窄栏标签 +2，桌面 22 不动）
    const hold = LAY.hold;
    const isPortraitHud = LAY.next && LAY.next.w > 200;   // 竖屏 w276 / 横屏 w112（桌面分支零改动）
    drawPanel(ctx, hold.x, hold.y, hold.w, hold.h);
    label(ctx, T('hud.hold'), hold.x + 16, hold.y + 30, isPortraitHud ? 24 : 22, '#8A94B8');
    if (game && game.holdType) {
      drawMiniPiece(ctx, game.holdType, hold.x + hold.w / 2, hold.y + hold.h * 0.62, 26,
        game.holdUsed ? 0.35 : 1);
    }

    // NEXT ×5（向下透明度递减 100% → 35%；竖屏横向排列）
    const nx = LAY.next;
    label(ctx, T('hud.next'), nx.x + 8, nx.y - 12, isPortraitHud ? 24 : 22, '#8A94B8');
    if (game) {
      const nexts = game.bagger.peek(nx.count);
      for (let i = 0; i < nexts.length; i++) {
        const x = nx.horizontal ? nx.x + i * (nx.w + nx.gap) : nx.x;
        const y = nx.horizontal ? nx.y : nx.y + i * (nx.h + nx.gap);
        drawPanel(ctx, x, y, nx.w, nx.h);
        drawMiniPiece(ctx, nexts[i], x + nx.w / 2, y + nx.h / 2, 22, 1 - i * 0.16);
      }
    }

    // SCORE（大号；桌面 h130 原口径零改动，竖屏小宽自适应不换行 ticket-0003）
    const S = HD.score;
    drawPanel(ctx, S.x, S.y, S.w, S.h);
    if (S.w < 320) {
      label(ctx, T('hud.score'), S.x + 18, S.y + 30, 22, '#8A94B8');
      if (game) fitHudText(ctx, String(Math.round(game.score)).padStart(7, '0'), S.x + 18, S.y + S.h - 28, 44, S.w - 36, '#EAF2FF');
    } else {
      label(ctx, T('hud.score'), S.x + 18, S.y + 32, 22, '#8A94B8');
      if (game) numText(ctx, String(Math.round(game.score)).padStart(7, '0'), S.x + 18, S.y + 102, 64, '#EAF2FF');
    }

    // LEVEL（桌面 h110 原口径零改动；竖屏 h84 收紧）
    const L = HD.level;
    drawPanel(ctx, L.x, L.y, L.w, L.h);
    if (L.h <= 90) {
      label(ctx, T('hud.level'), L.x + 12, L.y + 24, 20, '#8A94B8');
      if (game) fitHudText(ctx, String(game.level), L.x + 12, L.y + L.h - 12, 36, L.w - 24, '#00E5FF');
    } else {
      label(ctx, T('hud.level'), L.x + 18, L.y + 32, 22, '#8A94B8');
      if (game) numText(ctx, String(game.level), L.x + 18, L.y + 92, 52, '#00E5FF');
    }

    // COMBO（M-04 竖屏不占侧栏，场中央浮字见 drawCaptions；缺槽位即跳过）
    if (HD.combo) {
      const C = HD.combo;
      drawPanel(ctx, C.x, C.y, C.w, C.h);
      label(ctx, T('hud.combo'), C.x + 18, C.y + 32, 22, '#8A94B8');
      if (game && game.combo >= 2) {
        numText(ctx, '×' + game.combo, C.x + 18, C.y + 92, 52, '#FF2D9B');
      } else {
        numText(ctx, '—', C.x + 18, C.y + 92, 42, '#8A94B8');
      }
    }

    // B2B（同上，竖屏浮字）
    if (HD.b2b) {
      const B = HD.b2b;
      drawPanel(ctx, B.x, B.y, B.w, B.h);
      label(ctx, T('hud.b2b'), B.x + 18, B.y + 30, 20, '#8A94B8');
      if (game) numText(ctx, game.b2bActive ? '×' + (game.b2bCount + 1) : '—', B.x + 18, B.y + 78, 36,
        game.b2bActive ? '#FFD54F' : '#8A94B8');
    }

    // TIME（桌面 h96 原口径零改动；竖屏 h84 收紧）
    const TM = HD.time;
    drawPanel(ctx, TM.x, TM.y, TM.w, TM.h);
    if (TM.h <= 90) {
      label(ctx, T('hud.time'), TM.x + 12, TM.y + 24, 20, '#8A94B8');
      if (game) {
        const timeTxt = game.mode.timeLimitMs
          ? fmtTime(Math.max(0, game.mode.timeLimitMs - game.elapsedMs))
          : fmtTime(game.elapsedMs);
        fitHudText(ctx, timeTxt, TM.x + 12, TM.y + TM.h - 12, 26, TM.w - 24, '#EAF2FF');
      }
    } else {
      label(ctx, T('hud.time'), TM.x + 18, TM.y + 30, 20, '#8A94B8');
      if (game) {
        const timeTxt = game.mode.timeLimitMs
          ? fmtTime(Math.max(0, game.mode.timeLimitMs - game.elapsedMs))
          : fmtTime(game.elapsedMs);
        numText(ctx, timeTxt, TM.x + 18, TM.y + 78, 32, '#EAF2FF');
      }
    }

    // OBJECTIVE（桌面 h120 原口径零改动；竖屏 h84 收紧）
    const O = HD.objective;
    drawPanel(ctx, O.x, O.y, O.w, O.h);
    if (O.h <= 90) {
      label(ctx, T('hud.objective'), O.x + 12, O.y + 24, 20, '#8A94B8');
      if (game) {
        let ratio = 0, txt = '';
        if (game.mode.goalLines) {
          ratio = Math.min(1, game.totalLines / game.mode.goalLines);
          txt = `${game.totalLines} / ${game.mode.goalLines} ${T('hud.lines')}`;
        } else if (game.mode.timeLimitMs) {
          ratio = 1 - Math.min(1, game.elapsedMs / game.mode.timeLimitMs);
          txt = T('hud.left') + ' ' + fmtTime(Math.max(0, game.mode.timeLimitMs - game.elapsedMs));
        } else {
          ratio = Math.min(1, game.totalLines / ((game.mode.clearLevel || 15) * 10 - 10));
          txt = `${game.totalLines} ${T('hud.lines')} · LV ${game.level}`;
        }
        fitHudText(ctx, txt, O.x + 12, O.y + O.h - 22, 24, O.w - 24, '#EAF2FF');
        const bw = O.w - 24;
        const barY = O.y + O.h - 12;
        ctx.fillStyle = 'rgba(42,51,82,0.8)';
        ctx.fillRect(O.x + 12, barY, bw, 6);
        const g = ctx.createLinearGradient(O.x + 12, 0, O.x + 12 + bw, 0);
        g.addColorStop(0, '#00E5FF'); g.addColorStop(1, '#7C4DFF');
        ctx.fillStyle = g;
        ctx.fillRect(O.x + 12, barY, bw * ratio, 6);
      }
    } else {
      label(ctx, T('hud.objective'), O.x + 18, O.y + 32, 22, '#8A94B8');
      if (game) {
        let ratio = 0, txt = '';
        if (game.mode.goalLines) {
          ratio = Math.min(1, game.totalLines / game.mode.goalLines);
          txt = `${game.totalLines} / ${game.mode.goalLines} ${T('hud.lines')}`;
        } else if (game.mode.timeLimitMs) {
          ratio = 1 - Math.min(1, game.elapsedMs / game.mode.timeLimitMs);
          txt = T('hud.left') + ' ' + fmtTime(Math.max(0, game.mode.timeLimitMs - game.elapsedMs));
        } else {
          ratio = Math.min(1, game.totalLines / ((game.mode.clearLevel || 15) * 10 - 10));
          txt = `${game.totalLines} ${T('hud.lines')} · LV ${game.level}`;
        }
        numText(ctx, txt, O.x + 18, O.y + 84, 34, '#EAF2FF');
        const bw = O.w - 36;
        ctx.fillStyle = 'rgba(42,51,82,0.8)';
        ctx.fillRect(O.x + 18, O.y + 98, bw, 8);
        const g = ctx.createLinearGradient(O.x + 18, 0, O.x + 18 + bw, 0);
        g.addColorStop(0, '#00E5FF'); g.addColorStop(1, '#7C4DFF');
        ctx.fillStyle = g;
        ctx.fillRect(O.x + 18, O.y + 98, bw * ratio, 8);
      }
    }

    // BEST / 危险提示（M-04 竖屏不进对局侧栏，缺槽位即跳过；危险红光见 drawDanger + 心跳层）
    if (HD.best) {
      const BT = HD.best;
      drawPanel(ctx, BT.x, BT.y, BT.w, BT.h);
      label(ctx, T('hud.best'), BT.x + 18, BT.y + 32, 20, '#8A94B8');
      if (game) {
        const bestTxt = game.mode.scoreType === 'time'
          ? (game.bestTimeMs ? fmtTime(game.bestTimeMs) : '—')
          : String(game.bestScore || 0);
        numText(ctx, bestTxt, BT.x + 18, BT.y + 70, 30, '#FFD54F');
        if (game.danger) {
          label(ctx, '⚠ ' + T('hud.danger'), BT.x + BT.w - 18, BT.y + 70, 28, '#FF1744', 'right');
        }
      }
    } else if (game && game.danger && HD.objective) {
      // 竖屏危险角标（OBJECTIVE 栏右端，不另占侧栏）
      label(ctx, '⚠ ' + T('hud.danger'), HD.objective.x + HD.objective.w - 12, HD.objective.y + 52, 24, '#FF1744', 'right');
    }
    // 通关进度提示（调试 / 信息）
    if (game && game.mode.clearLevel && game.cleared) {
      label(ctx, T('hud.clear'), HD.clear.x, HD.clear.y, 26, '#00E676', 'center');
    }
  }

  function drawMiniPiece(ctx, type, cx, cy, cell, alpha) {
    const cells = SRS().ROT_CELLS[type][0];
    const minC = Math.min(...cells.map((c) => c[0])), maxC = Math.max(...cells.map((c) => c[0]));
    const minR = Math.min(...cells.map((c) => c[1])), maxR = Math.max(...cells.map((c) => c[1]));
    const w = (maxC - minC + 1) * cell, h = (maxR - minR + 1) * cell;
    const x0 = cx - w / 2 - minC * cell, y0 = cy - h / 2 - minR * cell;
    for (const [c, r] of cells) {
      drawCell(ctx, x0 + c * cell, y0 + r * cell, cell, state.skinColors[type] || '#fff', alpha, 0.8);
    }
  }

  /* ---------- 字幕（Combo / T-Spin / 破纪录 等，overshoot 弹出） ---------- */
  function drawCaptions(ctx, now) {
    state.captions = state.captions.filter((c) => now - c.t0 < c.dur);
    for (const c of state.captions) {
      const t = (now - c.t0) / c.dur;
      const pop = Math.min(1, t / 0.28);
      const scale = 0.6 + 0.4 * overshoot(pop);
      const fade = t > 0.6 ? 1 - (t - 0.6) / 0.4 : 1;
      const y = H * c.y - t * 24;
      ctx.save();
      ctx.globalAlpha = fade;
      ctx.translate(W / 2, y);
      ctx.scale(scale, scale);
      ctx.textAlign = 'center';
      ctx.shadowColor = c.glow;
      ctx.shadowBlur = 22;
      ctx.font = `700 ${c.size}px "Rajdhani","Chakra Petch","Segoe UI",sans-serif`;
      const grad = ctx.createLinearGradient(-200, 0, 200, 0);
      grad.addColorStop(0, '#00E5FF'); grad.addColorStop(1, '#FF2D9B');
      ctx.fillStyle = c.color === 'grad' ? grad : c.color;
      ctx.fillText(c.text, 0, 0);
      if (c.sub) {
        ctx.font = `600 ${c.size * 0.42}px "Rajdhani","Segoe UI",sans-serif`;
        ctx.fillStyle = '#EAF2FF';
        ctx.fillText(c.sub, 0, c.size * 0.62);
      }
      ctx.restore();
      // 大号字幕两道光条横扫（240ms）
      if (c.size >= 72 && t < 0.34 && state.fxLevel !== 'low') {
        const sw = easeOut(t / 0.34);
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = 'rgba(0,229,255,0.35)';
        ctx.fillRect(W / 2 - 420 + sw * 260, y - 24, 160, 3);
        ctx.fillRect(W / 2 + 260 - sw * 260, y - 24, 160, 3);
        ctx.restore();
      }
    }
  }

  function drawFloats(ctx, now) {
    state.floats = state.floats.filter((f) => now - f.t0 < f.dur);
    for (const f of state.floats) {
      const t = (now - f.t0) / f.dur;
      ctx.save();
      ctx.globalAlpha = 1 - t;
      ctx.textAlign = 'center';
      ctx.font = `700 34px "Consolas",monospace`;
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, W / 2, H * 0.55 - t * 60);
      ctx.restore();
    }
  }

  /* ---------- 画中画回放窗（最后 3 秒慢镜头，非阻塞） ---------- */
  function drawReplayWindow(ctx, now) {
    const rp = state.replay;
    if (!rp.active || !rp.frames.length || !rp.enabled) return;
    const dur = 3 / 0.5;                     // 3 秒内容 @0.5× = 6 秒
    const t = (now - rp.t0);
    if (t > dur + 0.3) { rp.active = false; return; }
    const fadeIn = Math.min(1, t / 0.2);
    const fadeOut = t > dur ? 1 - (t - dur) / 0.3 : 1;
    const P = LAY.pip;
    ctx.save();
    ctx.globalAlpha = fadeIn * fadeOut;
    // 窗体
    chamferPath(ctx, P.x, P.y, P.w, P.h, 12);
    ctx.fillStyle = 'rgba(11,14,26,0.82)';
    ctx.fill();
    ctx.strokeStyle = rgba('#FFD54F', 0.8);
    ctx.lineWidth = 2;
    ctx.shadowColor = rgba('#FFD54F', 0.5);
    ctx.shadowBlur = 16;
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.font = `600 20px "Rajdhani","Segoe UI",sans-serif`;
    ctx.fillStyle = '#FFD54F';
    ctx.fillText('REPLAY · ×0.5', P.x + 16, P.y + 28);
    // 回放帧（0.5× 速）
    const idx = Math.min(rp.frames.length - 1, Math.floor(t * 0.5 * 10));
    const snap = rp.frames[idx];
    const scale = (P.h - 60) / (20 * 40);
    const fw = 10 * 40 * scale, fh = 20 * 40 * scale;
    const fx0 = P.x + (P.w - fw) / 2, fy0 = P.y + 40;
    ctx.fillStyle = 'rgba(20,26,46,0.8)';
    ctx.fillRect(fx0, fy0, fw, fh);
    for (let r = 0; r < 20; r++) {
      for (let c = 0; c < 10; c++) {
        const v = snap.grid[r + 2][c];
        if (!v) continue;
        ctx.fillStyle = state.skinColors[v] || '#fff';
        ctx.fillRect(fx0 + c * 40 * scale, fy0 + r * 40 * scale, 40 * scale - 1, 40 * scale - 1);
      }
    }
    for (const [c, r] of snap.cells) {
      if (r < 0) continue;
      ctx.fillStyle = state.skinColors[snap.type] || '#fff';
      ctx.fillRect(fx0 + c * 40 * scale, fy0 + r * 40 * scale, 40 * scale - 1, 40 * scale - 1);
    }
    ctx.restore();
  }

  /* ---------- 调试面板（DoD §11.4） ---------- */
  function drawDebug(ctx, game) {
    const d = state.debug;
    ctx.save();
    ctx.fillStyle = 'rgba(11,14,26,0.8)';
    ctx.fillRect(24, 24, 260, 170);
    ctx.strokeStyle = rgba('#2A3352', 1);
    ctx.strokeRect(24, 24, 260, 170);
    ctx.font = '600 18px "Consolas",monospace';
    ctx.fillStyle = '#8A94B8';
    ctx.textAlign = 'left';
    const T = global.NP.t;
    const lines = [
      T('debug.title'),
      `${T('debug.judge')}: ${d.lastJudge}`,
      `${T('debug.kick')}: ${d.kick}`,
      `${T('debug.snap')}: ${d.snapMs.toFixed(1)}ms`,
      `${T('debug.fps')}: ${state.fps.toFixed(0)}`,
      `${T('debug.seed')}: ${game ? (game.seed >>> 0).toString(16) : '—'}`,
    ];
    lines.forEach((s, i) => ctx.fillText(s, 36, 52 + i * 24));
    ctx.restore();
  }

  function fmtTime(ms) {
    const s = Math.max(0, ms) / 1000;
    const m = Math.floor(s / 60);
    const sec = s - m * 60;
    return `${String(m).padStart(2, '0')}:${sec < 10 ? '0' : ''}${sec.toFixed(2)}`;
  }

  /* ==================== 初始化 / 布局切换 ==================== */
  function init(canvas) {
    state.canvas = canvas;
    canvas.width = W; canvas.height = H;
    state.ctx = canvas.getContext('2d');
    loadImages();
    return state;
  }

  /**
   * 布局切换（§9：16:9 主设计 1920×1080 / 移动端竖屏优先 9:16=1080×1920）。
   * 切换时同步画布物理尺寸（重设 width/height 会清空 ctx 状态，每帧重绘无影响）。
   */
  function setLayout(mode) {
    const key = mode === 'portrait' ? 'portrait' : 'landscape';
    const L = LAYOUTS[key];
    for (const k of Object.keys(LAY)) delete LAY[k];
    Object.assign(LAY, L);
    W = key === 'portrait' ? 1080 : 1920;
    H = key === 'portrait' ? 1920 : 1080;
    state.layout = key;
    if (state.canvas) {
      state.canvas.width = W;
      state.canvas.height = H;
      state.ctx = state.canvas.getContext('2d');
    }
  }

  global.NP = global.NP || {};
  global.NP.render = {
    init, frame, fx, state, LAY, fmtTime, setLayout,
    getStageSize: () => ({ W, H }),
    setDebug: (v) => { state.debug = v ? (state.debug || {}) : null; },
    getDebug: () => state.debug,
  };
})(window);
