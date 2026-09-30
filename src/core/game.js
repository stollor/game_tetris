/**
 * NEON PULSE — 对局核心状态机（framework §2 / §5 / §6 / §7 / §8.4）
 * 执行顺序（唯一）：方块锁定 → Lock Out 判定 → 消行扫描与结算（含隐藏行）→ 下一块出块 → Top Out 判定。
 * 时钟：update(dtMs) 由外部（音频时钟派生）推进，暂停期间不调用 = 全部冻结（§8.4）。
 */
(function (global) {
  'use strict';

  const BAL = () => global.NP_CONFIG.balance;
  const SRS = () => global.NP.srs;

  /* 等级 → 重力速度（行/秒，§7.3，19 级起 20G 封顶） */
  function gravityRowsPerSec(level) {
    const t = BAL().gravityRowsPerSec;
    return t[Math.min(level, t.length) - 1];
  }
  /* 软降速度（§7.4 唯一口径）：min(max(40, 20×重力), 1200) */
  function softDropRowsPerSec(level) {
    const s = BAL().softDrop;
    return Math.min(Math.max(s.baseRowsPerSec, s.gravityMul * gravityRowsPerSec(level)), s.capRowsPerSec);
  }
  /* BPM(等级) = 128 + 4×(等级−1)，19 级起封顶 200（§7.6） */
  function bpmOf(level) {
    const b = BAL().bpm;
    return Math.min(b.base + b.stepPerLevel * (level - 1), b.capValue);
  }
  /* Combo 乘区（§7.2） */
  function comboMult(n) {
    const t = BAL().comboMultiplier;
    return t[Math.min(n, t.length) - 1];
  }

  class Game {
    /**
     * @param {object} mode  config/modes.js 中的模式对象
     * @param {object} opts  { bestScore, bestTimeMs, dailySeed } —— 破纪录判定基准（开局锁定）
     */
    constructor(mode, opts) {
      this.mode = mode;
      this.opts = opts || {};
      this.cfg = BAL();

      // ---------- 场地：整场 22 行（行 -2..19），索引 = 行 + 2 ----------
      this.grid = [];
      for (let i = 0; i < 22; i++) this.grid.push(new Array(10).fill(0));

      // ---------- 出块序列（7-bag；每日挑战固定种子） ----------
      if (mode.daily) {
        const d = global.NP.rng.createDailyBagger();
        this.bagger = d.bagger; this.seed = d.seed; this.dailyDate = d.dateStr;
      } else {
        const r = global.NP.rng.createRandomBagger();
        this.bagger = r.bagger; this.seed = r.seed; this.dailyDate = null;
      }

      // ---------- 状态 ----------
      this.phase = 'falling';          // falling | clearing | over
      this.active = null;
      this.holdType = null;
      this.holdUsed = false;
      this.inputBuffer = [];

      // ---------- 进度 / 计分 ----------
      this.level = 1;
      this.totalLines = 0;
      this.score = 0;
      this.combo = 0; this.maxCombo = 0;
      this.b2bActive = false; this.b2bCount = 0; this.maxB2b = 0;
      this.counts = { tspin: 0, tspinMini: 0, tetris: 0, triple: 0, double: 0, single: 0, pc: 0, tspinClears: 0 };
      this.cleared = false;            // Marathon/Daily 通关标记（15 级 = 140 行）

      // ---------- 计时（有效用时 = 墙钟 − 暂停累计；暂停期间 update 不被调用） ----------
      this.elapsedMs = 0;
      this.ultraExpired = false;

      // ---------- 手感 ----------
      this.fallAccum = 0;
      this.softCredit = 0;
      this.softHeld = false;
      this.softExtra = false;          // 软降是否产生了额外下落（T-Spin 取消项）
      this.dasDir = 0; this.dasTimer = 0; this.arrTimer = 0; this.dasCharged = false;
      this.lockTimer = 0; this.lockResets = 0;
      this.clearTimer = 0;

      // ---------- 危险预警（滞回区间 12–16 防抖） ----------
      this.danger = false;
      this.stackHeight = 0;

      // ---------- 破纪录 ----------
      this.bestScore = opts.bestScore || 0;
      this.bestTimeMs = opts.bestTimeMs || 0;
      this.recordTriggered = false;

      this.debug = { lastJudge: '—', kick: '—', snapMs: 0 };

      this.spawnNext();
    }

    /* ==================== 事件 ==================== */
    emit(name, data) { if (this.onEvent) this.onEvent(name, data || {}); }

    /* ==================== 出块（Top Out 判定在此） ==================== */
    spawnNext(type) {
      const t = type || this.bagger.next();
      this.holdUsed = false;            // 出新块（非 Hold）→ Hold 次数重置
      const piece = {
        type: t, rot: 0, px: 0, py: 0,
        lastAction: 'spawn', lastKick: -1, kickIs180: false,
      };
      if (!this.canPlace(piece, 0, 0)) {
        this.active = piece;
        this.endRun('topout');        // 出生占格任一格被占用 → 顶出失败
        return;
      }
      this.active = piece;
      this.fallAccum = 0;
      this.softCredit = 0;
      this.softExtra = false;
      this.lockTimer = 0;
      this.lockResets = 0;
      this.emit('spawn', { type: t, next: this.bagger.peek(5) });
    }

    /* ==================== 碰撞 ==================== */
    canPlace(piece, dPx, dPy, rotOverride) {
      const srs = SRS();
      // rotOverride：旋转检测时传入目标朝向（不能用当前朝向算碰撞，否则踢墙表永不生效）
      const cells = srs.cellsOf(piece.type, rotOverride === undefined ? piece.rot : rotOverride, piece.px + dPx, piece.py + dPy);
      for (const [c, r] of cells) {
        if (c < 0 || c > 9 || r < -2 || r > 19) return false;   // 出界
        if (this.grid[r + 2][c] !== 0) return false;            // 重叠
      }
      return true;
    }
    grounded() { return this.active && !this.canPlace(this.active, 0, 1); }

    /* ==================== 输入动作 ==================== */
    move(dir) {
      if (this.phase !== 'falling' || !this.active) return false;
      if (!this.canPlace(this.active, dir, 0)) {
        this.emit('moveFail', {});
        return false;
      }
      this.active.px += dir;
      this.active.lastAction = 'move';   // 成功横移取消 T-Spin 条件①
      this.resetLock();
      this.emit('move', { dir });
      return true;
    }

    rotate(dir) { // dir: 1 顺时针 / -1 逆时针 / 2 = 180°
      if (this.phase !== 'falling' || !this.active) return false;
      const srs = SRS();
      const p = this.active;
      const is180 = dir === 2;
      const to = is180 ? ((p.rot + 2) & 3) : ((p.rot + dir + 4) & 3);
      const kicks = srs.getKicks(p.type, p.rot, to, is180);
      for (let i = 0; i < kicks.length; i++) {
        const [dx, dr] = kicks[i];
        if (this.canPlace(p, dx, dr, to)) {
          p.px += dx; p.py += dr;
          p.rot = to;
          p.lastAction = 'rotate';       // 成功旋转更新判定状态
          p.lastKick = i;
          p.kickIs180 = is180;
          this.resetLock();
          this.emit('rotate', { deg: is180 ? 180 : (dir === 1 ? 90 : -90), kick: i, success: true });
          return true;
        }
      }
      this.emit('rotate', { deg: is180 ? 180 : (dir === 1 ? 90 : -90), success: false });
      return false;                      // 失败的旋转不改变判定状态
    }

    hardDrop() {
      if (this.phase !== 'falling' || !this.active) return;
      const p = this.active;
      let cells = 0;
      while (this.canPlace(p, 0, 1)) { p.py += 1; cells++; }
      if (cells > 0) {
        this.score += cells * this.cfg.score.hardDropPerCell;  // +2/格，即时入账、不进乘区
        this.emit('score', { delta: cells * this.cfg.score.hardDropPerCell, total: this.score });
      }
      this.emit('harddrop', { cells });
      this.lockPiece(true);
    }

    hold() {
      if (this.phase !== 'falling' || !this.active || this.holdUsed) {
        return;   // Hold 次数用尽：按不动处理，不改变任何状态
      }
      const swapped = this.holdType;
      this.holdType = this.active.type;
      this.holdUsed = true;
      this.emit('hold', { hold: this.holdType, swap: swapped });
      if (swapped) {
        // 换入暂存方块：最后一次有效操作清为「非旋转」
        const piece = {
          type: swapped, rot: 0, px: 0, py: 0,
          lastAction: 'none', lastKick: -1, kickIs180: false,
        };
        if (!this.canPlace(piece, 0, 0)) {
          this.active = piece;
          this.endRun('topout');
          return;
        }
        this.active = piece;
        this.fallAccum = 0; this.softCredit = 0; this.softExtra = false;
        this.lockTimer = 0; this.lockResets = 0;
      } else {
        this.spawnNext();
        this.holdUsed = true;              // 本块 Hold 次数已用
        if (this.active) this.active.lastAction = 'none';
      }
    }

    setHeld(action, down) {
      // 左右移动 DAS / ARR 状态机（§7.4）
      if (action === 'moveLeft' || action === 'moveRight') {
        const dir = action === 'moveLeft' ? -1 : 1;
        if (down) {
          this.dasDir = dir; this.dasTimer = 0; this.arrTimer = 0; this.dasCharged = false;
          this.move(dir);
        } else if (this.dasDir === dir) {
          this.dasDir = 0;
        }
        return;
      }
      if (action === 'softDrop') this.softHeld = down;
    }

    /* ==================== 锁定延迟（§5.4） ==================== */
    resetLock() {
      if (!this.grounded()) return;
      if (this.lockResets < this.cfg.feel.moveResetLimit) {
        this.lockTimer = 0;
        this.lockResets++;
      } else {
        this.lockPiece(false);          // 超次数立即锁定
      }
    }

    /* ==================== 主更新（dtMs：本帧游戏时间，暂停时为 0） ==================== */
    update(dtMs) {
      if (this.phase === 'over' || dtMs <= 0) return;
      const dt = Math.min(dtMs, 100);   // 帧率无关 + 防跳帧大步

      // ---- 计时（有效用时）与 Ultra 归零边界（P.28：时钟更新后、状态转移前判定） ----
      this.elapsedMs += dt;
      if (this.mode.timeLimitMs && !this.ultraExpired && this.elapsedMs >= this.mode.timeLimitMs) {
        this.ultraExpired = true;
        if (this.phase === 'clearing') {
          this.endRun('timeout');       // 已锁定块：结算链已走完（计分在锁定瞬间完成）
        } else {
          this.endRun('timeout');       // 未锁定块：作废、不入场地、计 0 分
        }
        return;
      }
      if (this.phase === 'clearing') {
        this.clearTimer -= dt;
        if (this.clearTimer <= 0) {
          if (this._sprintDone) {
            this.endRun('goal');           // Sprint：消满 40 行，消行动画走完即结算
            return;
          }
          this.phase = 'falling';
          this.spawnNext();
          this.flushInputBuffer();
        }
        return;
      }

      const p = this.active;
      if (!p) return;

      // ---- DAS / ARR 自动横移（§7.4 步进口径）----
      // 首次自动横移恰发生在按住后 DAS=133ms（首步不叠加 ARR）；
      // DAS 达标帧超出 133ms 的溢出量回填 ARR 累积器，后续第 k 次自动横移
      // 严格对齐 133 + k×33 ms（首个 ≥ 该时刻的逻辑帧），不随帧步长漂移。
      if (this.dasDir !== 0 && this.phase === 'falling') {
        this.dasTimer += dt;
        if (this.dasTimer >= this.cfg.feel.dasMs) {
          if (!this.dasCharged) {
            this.dasCharged = true;
            this.arrTimer = this.dasTimer - this.cfg.feel.dasMs;   // 溢出回填（含本帧超出 DAS 的部分）
            if (!this.move(this.dasDir)) this.arrTimer = 0;        // 首次自动横移 = DAS 时刻
          } else {
            this.arrTimer += dt;
          }
          const step = Math.max(this.cfg.feel.arrMs, 0.0001);     // ARR=0（高速段）时一帧到底
          while (this.arrTimer >= step) {
            this.arrTimer -= step;
            if (!this.move(this.dasDir)) { this.arrTimer = 0; break; }
          }
        }
      }

      // ---- 重力 / 软降（§7.3 / §7.4） ----
      const g = gravityRowsPerSec(this.level);
      const is20G = g >= this.cfg.gravityCap;                 // 19 级及以上 = 20G
      const softActive = this.softHeld && !is20G;             // 20G 段软降键无任何实际效果
      const speed = softActive ? softDropRowsPerSec(this.level) : g;
      if (softActive) {
        // 额外下落额度（§7.1 C：Soft Drop +1/格，只统计额外下落格数，唯一口径）。
        // 上限 = 单帧最大下落格数（下方 guard = 30）：高速段（12 级起 20×重力 ≥ 440 行/秒）
        // 单帧额外下落可达 5–20 格，旧版 4 格封顶会系统性少算软降分。
        this.softCredit = Math.min(this.softCredit + (speed - g) * dt / 1000, 30);
      }
      this.fallAccum += speed * dt / 1000;
      let guard = 30;
      while (this.fallAccum >= 1 && guard-- > 0) {
        if (this.canPlace(p, 0, 1)) {
          p.py += 1;
          this.fallAccum -= 1;
          if (softActive && this.softCredit >= 1) {
            this.softCredit -= 1;
            this.score += this.cfg.score.softDropPerCell;      // +1/格（额外下落）
            this.softExtra = true;                            // 软降额外下落 → 取消 T-Spin 条件①
            p.lastAction = 'drop';
            this.emit('softdrop', {});
            this.emit('score', { delta: this.cfg.score.softDropPerCell, total: this.score });
          }
          if (this.grounded() && this.lockTimer <= 0) this.lockTimer = 0;
        } else {
          this.fallAccum = 0;
          this.softCredit = 0;               // 已贴地：剩余额度作废（未实际发生的下落不计分，防额度累积多算）
          break;
        }
      }

      // ---- 锁定延迟 ----
      if (this.grounded()) {
        this.lockTimer += dt;
        if (this.lockTimer >= this.cfg.feel.lockDelayMs) this.lockPiece(false);
      } else {
        this.lockTimer = 0;
      }
    }

    /* ==================== 锁定 → 判定 → 消行 → 计分（§5.5 / §7） ==================== */
    lockPiece(isHardDrop) {
      if (this.phase !== 'falling' || !this.active) return;
      const p = this.active;
      const srs = SRS();
      const cells = srs.cellsOf(p.type, p.rot, p.px, p.py);

      // 1) 写入场地
      for (const [c, r] of cells) {
        if (r >= -2 && r <= 19) this.grid[r + 2][c] = p.type;
      }

      // 2) Lock Out 判定（先于消行扫描）：全部锁在隐藏区（行 -2/-1）→ 失败
      const allHidden = cells.every(([, r]) => r < 0);
      if (allHidden) {
        // Lock Out：lock 事件与正常锁定同构补齐判定字段（tspin / lines / label / rows 等）。
        // 消费端按 `d.tspin !== 'none'` 判技巧分支，缺字段的 undefined 会被误判成 T-Spin。
        this.emit('lock', {
          cells, hardDrop: isHardDrop, lines: 0, tspin: 'none', label: '', rows: [],
          cellTypes: cells.map(([c, r]) => [c, r, p.type]),
          combo: this.combo, b2b: this.b2bActive ? this.b2bCount : 0, b2bEvent: null, pc: false, gain: 0,
        });
        this.endRun('lockout');
        return;
      }

      // 3) T-Spin 判定（三点法，§5.3）
      let tspin = 'none';   // none | mini | full
      if (p.type === 'T' && p.lastAction === 'rotate') {
        const cx = srs.PIECES.T.center[0] + p.px;
        const cy = srs.PIECES.T.center[1] + p.py;
        if (srs.cornerCount(this.grid, cx, cy) >= 3) {
          // Mini / Full 判定表（命中即止）
          const kickLast = p.kickIs180 ? 1 : 4;
          if (srs.frontCornersBlocked(this.grid, p.rot, cx, cy)) tspin = 'full';
          else if (p.lastKick === kickLast) tspin = 'full';
          else tspin = 'mini';
        }
      }

      // 4) 消行扫描（整场 22 行，含隐藏行，同权）
      const fullRows = [];
      for (let i = 0; i < 22; i++) {
        if (this.grid[i].every((v) => v !== 0)) fullRows.push(i);
      }
      const lines = fullRows.length;
      // Mini 只可能消 0/1 行；消 2 行及以上一律 Full
      if (tspin === 'mini' && lines >= 2) tspin = 'full';

      // 5) 计分（等级 = 该次消行结算时的当前等级）
      const lvl = this.level;
      const S = this.cfg.score;
      let base = 0, label = '';
      if (lines === 0) {
        if (tspin === 'full') { base = S.lockBonus.tspin; label = 'tspin'; }
        else if (tspin === 'mini') { base = S.lockBonus.tspinMini; label = 'tspinMini'; }
      } else if (tspin === 'full') {
        base = [0, S.lineBase.tspinSingle, S.lineBase.tspinDouble, S.lineBase.tspinTriple][lines] || 0;
        label = ['tspin', 'tspinSingle', 'tspinDouble', 'tspinTriple'][lines] || 'tspin';
      } else if (tspin === 'mini') {
        base = S.lineBase.tspinMiniSingle; label = 'tspinMiniSingle';
      } else {
        base = [0, S.lineBase.single, S.lineBase.double, S.lineBase.triple, S.lineBase.tetris][lines] || 0;
        label = ['', 'single', 'double', 'triple', 'tetris'][lines];
      }

      // Combo（§5.6）
      if (lines >= 1) {
        this.combo += 1;
        if (this.combo > this.maxCombo) this.maxCombo = this.combo;
      } else {
        this.combo = 0;
      }
      const cm = lines >= 1 ? comboMult(this.combo) : 1.0;

      // B2B（§5.6）
      const difficult = (tspin !== 'none' && lines >= 1) || (tspin === 'none' && lines === 4);
      const normalClear = tspin === 'none' && lines >= 1 && lines <= 3;
      let bm = 1.0, b2bEvent = null;
      if (difficult) {
        if (this.b2bActive) {
          this.b2bCount += 1;
          bm = this.cfg.b2bMultiplier;
          b2bEvent = 'continue';
        } else {
          this.b2bActive = true;
          this.b2bCount = 0;
          b2bEvent = 'on';
        }
        if (this.b2bCount > this.maxB2b) this.maxB2b = this.b2bCount;
      } else if (normalClear) {
        this.b2bActive = false;
        this.b2bCount = 0;
      }

      // 消行基础分（表 A：分值 × 等级）× Combo × B2B（表 A 进乘区）
      let gain = lines >= 1 ? Math.round(base * lvl * cm * bm) : 0;

      // 执行消行（移除满行，上方整体下移）
      // 索引口径：fullRows 为升序（扫描序），删除时降序逐行「只 splice」——先删索引大的行，
      // 更靠上的未处理行索引保持不变；最后一次性 unshift 补空行。
      // 注意不可 splice+unshift 交替执行：unshift 会使上方未处理满行整体下移 +1，
      // 旧索引失效导致删错行、满行残留（≥2 行消除时残留满行会被重复计行计分，
      // 且 Perfect Clear 的全空判定永远不成立）。
      if (lines > 0) {
        for (const idx of fullRows.slice().sort((a, b) => b - a)) {
          this.grid.splice(idx, 1);
        }
        for (let i = 0; i < lines; i++) {
          this.grid.unshift(new Array(10).fill(0));
        }
      }

      // Perfect Clear（整场 22 行含隐藏行全清）
      let pc = false;
      if (lines >= 1) {
        pc = this.grid.every((row) => row.every((v) => v === 0));
        if (pc) {
          gain += S.perfectClear * lvl;   // 乘区之后直接加、不进乘区
          this.counts.pc += 1;
        }
      }

      // 0 行落块奖励（表 B）：与表 A 互斥，分值 × 等级、直接加分不进乘区
      if (lines === 0 && base > 0) gain += base * lvl;

      if (gain > 0) {
        this.score += gain;
        this.emit('score', { delta: gain, total: this.score });
      }

      // 统计
      if (lines === 1) this.counts.single += 1;
      if (lines === 2) this.counts.double += 1;
      if (lines === 3) this.counts.triple += 1;
      if (lines === 4) this.counts.tetris += 1;
      // 「T-Spin 消行」唯一口径 = 消行数 ≥ 1 的 T-Spin（含 T-Spin Mini Single，§5.3 / §5.6 闭合定义），
      // 与 B2B 有效动作、结算页「T-Spin 消行」、成就「旋光者」（config/unlock.js tspinClears ≥ 8）完全一致
      if (tspin !== 'none' && lines >= 1) this.counts.tspinClears += 1;
      if (tspin === 'full') this.counts.tspin += 1;      // T-Spin Full 判定次数（含 0 行）
      if (tspin === 'mini') this.counts.tspinMini += 1;  // T-Spin Mini 判定次数（含 0 行）
      this.totalLines += lines;

      // 6) 升级（该批消行结算完成后生效，本批按升级前等级计分）
      const newLevel = 1 + Math.floor(this.totalLines / this.cfg.linesPerLevel);
      const leveled = newLevel > this.level;
      if (leveled) {
        this.level = newLevel;
        this.emit('levelup', { level: this.level });
      }

      // Marathon / Daily 通关标记：达到 15 级（累计 140 行）
      if (!this.cleared && this.mode.clearLevel && this.level >= this.mode.clearLevel) {
        this.cleared = true;
        this.emit('cleared', { level: this.level });
      }

      // 7) 危险预警（滞回）
      this.updateDanger();

      // 8) 破纪录（分数型：分数超过历史最佳的瞬间，非阻塞）
      if (this.mode.scoreType === 'score' && !this.recordTriggered && this.score > this.bestScore && this.bestScore >= 0) {
        this.recordTriggered = true;
        this.emit('record', { kind: 'score', score: this.score, best: this.bestScore });
      }

      // 9) 判定事件（反馈 & 调试面板）
      this.debug.lastJudge = label || (lines > 0 ? 'clear' : 'none');
      this.emit('lock', {
        cells, hardDrop: isHardDrop, lines, tspin, label,
        cellTypes: cells.map(([c, r]) => [c, r, p.type]),
        combo: this.combo, b2b: this.b2bActive ? this.b2bCount : 0, b2bEvent, pc, gain,
        rows: fullRows.slice(),   // 升序副本（未排序）：fx.lineClear 用 rows[0] 定位最顶行
      });

      // 10) Sprint：消满 40 行即结束（在消行动画走完后进入结算）
      const sprintDone = this.mode.goalLines && this.totalLines >= this.mode.goalLines;

      if (lines > 0) {
        this.phase = 'clearing';
        this.clearTimer = this.cfg.feel.clearAnimMs;
        this._sprintDone = sprintDone;
      } else if (sprintDone) {
        this.endRun('goal');
      } else {
        this.spawnNext();
      }
    }

    /* ==================== 危险预警（堆叠高度，§8.2） ==================== */
    updateDanger() {
      let top = null;
      for (let i = 0; i < 22; i++) {
        if (this.grid[i].some((v) => v !== 0)) { top = i - 2; break; }  // i-2 = 场地行号
      }
      this.stackHeight = top === null ? 0 : Math.max(0, 20 - top);
      const h = this.cfg.feedback;
      if (!this.danger && this.stackHeight >= h.dangerHeight) {
        this.danger = true;
        this.emit('danger', { on: true });
      } else if (this.danger && this.stackHeight < h.dangerClearHeight) {
        this.danger = false;
        this.emit('danger', { on: false });
      }
    }

    /* ==================== 消行动画期间的输入缓冲（§8.2） ==================== */
    bufferAction(name) {
      if (this.inputBuffer.length < 8) this.inputBuffer.push(name);
    }
    flushInputBuffer() {
      const buf = this.inputBuffer.splice(0);
      for (const name of buf) {
        if (name === 'hardDrop') this.hardDrop();
        else if (name === 'hold') this.hold();
        else if (name === 'rotateCW') this.rotate(1);
        else if (name === 'rotateCCW') this.rotate(-1);
        else if (name === 'rotate180') this.rotate(2);
        else if (name === 'moveLeft') this.move(-1);
        else if (name === 'moveRight') this.move(1);
      }
    }

    /* ==================== 结束 / 结算（§2.3） ==================== */
    endRun(reason) {
      if (this.phase === 'over') return;
      this.phase = 'over';
      this.active = null;

      const valid = reason === 'quit' ? false : (this.mode.scoreType === 'time'
        ? reason === 'goal'                      // Sprint：完赛才产生成绩
        : true);                                 // 分数型：失败/超时即结算

      const result = {
        modeId: this.mode.id,
        scoreType: this.mode.scoreType,
        reason,                                  // topout | lockout | goal | timeout | quit
        valid,
        score: this.score,
        timeMs: this.elapsedMs,
        maxCombo: this.maxCombo,
        maxB2b: this.maxB2b,
        lines: this.totalLines,
        level: this.level,
        counts: Object.assign({}, this.counts),
        dailyDate: this.dailyDate,
        seed: this.seed,
        record: false,
        bestDiff: 0,
      };

      // 破纪录判定：分数型 = 严格超过历史最佳分；Sprint = 有效用时严格小于历史最佳
      if (valid) {
        if (this.mode.scoreType === 'score') {
          result.record = this.score > this.bestScore;
          result.bestDiff = this.score - this.bestScore;      // 正数 = 新纪录
          result.best = this.bestScore;
        } else {
          result.record = this.bestTimeMs === 0 || this.elapsedMs < this.bestTimeMs;
          result.bestDiff = this.bestTimeMs > 0 ? (this.bestTimeMs - this.elapsedMs) : 0; // 正数 = 更快
          result.best = this.bestTimeMs;
        }
      }

      // 破纪录瞬间触发（framework §2.3，时机闭合、不提前不预判）：
      //   分数型 = 分数超过历史最佳的瞬间（锁定结算第 8 步已 emit，recordTriggered 置位）；
      //   时间型（Sprint）= 完成第 40 行那块锁定、进入结算的瞬间（= endRun('goal') 且判定为新纪录）
      //   同样触发全屏爆发 + NEW RECORD 字幕 + 画中画慢镜头（复用 record 事件链路）。
      if (result.record && this.mode.scoreType === 'time' && reason === 'goal' && !this.recordTriggered) {
        this.recordTriggered = true;
        this.emit('record', { kind: 'time', timeMs: this.elapsedMs, best: this.bestTimeMs });
      }

      this.emit('runend', result);
    }

    /** Ultra 归零 / 目标达成等由外部触发的结束（供主循环在特殊分支调用） */
    requestQuit() { this.endRun('quit'); }
  }

  // Sprint 目标达成：在消行动画结束时进入结算（已在 update 的 clearing 分支内处理）

  global.NP = global.NP || {};
  global.NP.game = {
    Game,
    gravityRowsPerSec,
    softDropRowsPerSec,
    bpmOf,
    comboMult,
  };
})(window);
