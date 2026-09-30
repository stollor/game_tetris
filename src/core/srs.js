/**
 * NEON PULSE — SRS 旋转系统与 T-Spin 判定（framework §5.3 / §5.4）
 * 坐标约定：列 c = 0..9 从左到右；行 r = -2..19（负行为隐藏缓冲区，行 0 = 可视区顶部，向下为正）。
 * 套用标准 SRS 踢墙表时只翻转 y 偏移符号（标准表 y 向上为正），kick index 顺序不变。
 */
(function (global) {
  'use strict';

  /* ---------- 出生占格与旋转中心（framework §5.4 唯一实现依据） ---------- */
  const PIECES = {
    I: { center: [4.5, -0.5], spawn: [[3, -1], [4, -1], [5, -1], [6, -1]] },
    O: { center: [4.5, -1.5], spawn: [[4, -2], [5, -2], [4, -1], [5, -1]] },
    T: { center: [4, -1], spawn: [[4, -2], [3, -1], [4, -1], [5, -1]] },
    S: { center: [4, -1], spawn: [[4, -2], [5, -2], [3, -1], [4, -1]] },
    Z: { center: [4, -1], spawn: [[3, -2], [4, -2], [4, -1], [5, -1]] },
    J: { center: [4, -1], spawn: [[3, -2], [3, -1], [4, -1], [5, -1]] },
    L: { center: [4, -1], spawn: [[5, -2], [3, -1], [4, -1], [5, -1]] },
  };
  const TYPES = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];

  /**
   * 旋转态占格：以旋转中心为轴做 90° 顺时针旋转（屏幕坐标，行向下为正）。
   * (dx, dy) -> (-dy, dx)；相对坐标用 ×2 整数保证 I/O 的半整数精度。
   */
  const ROT_CELLS = {}; // ROT_CELLS[type][rot] = [[c,r], ...]（位于出生位置、偏移 (0,0) 时）
  function buildRotCells() {
    for (const type of TYPES) {
      const { center, spawn } = PIECES[type];
      const cx2 = center[0] * 2, cy2 = center[1] * 2;
      let rel = spawn.map(([c, r]) => [c * 2 - cx2, r * 2 - cy2]); // 相对中心 ×2
      const states = [];
      for (let rot = 0; rot < 4; rot++) {
        states.push(rel.map(([x, y]) => [(cx2 + x) / 2, (cy2 + y) / 2])); // 还原回整数格坐标
        rel = rel.map(([x, y]) => [-y, x]); // 顺时针 90°
      }
      ROT_CELLS[type] = states;
    }
  }
  buildRotCells();

  /* ---------- SRS 踢墙表（标准，y 向上为正；使用时 rowDelta = -y） ---------- */
  // JLSTZ 五条 / 组（kick index 0–4）
  const KICKS_JLSTZ = {
    '0>1': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
    '1>0': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
    '1>2': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
    '2>1': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
    '2>3': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
    '3>2': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
    '3>0': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
    '0>3': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
  };
  // I 五条 / 组（标准 SRS I 踢墙表，y 向上为正；与上面 JLSTZ 表同一存储口径）。
  // 标准 SRS 的 I 表自成一套（tetris.wiki: "the I tetromino has its own set of kick values"）：
  // 既不与 JLSTZ 同构，也不左右镜像对称，故只有不变式①成立（tests/test-core.cjs §2c）：
  //   ① 每对 (X>Y, Y>X) 互为反向（两组偏移整体取负）。
  // 典型行为：平放 I 贴地旋成竖放（0>1）靠 Test5「右 1 上 2」(1,2) 上踢 2 格立起来；
  //           Test4 为「左 2 下 1」(-2,-1)，与 JLSTZ 的 (±1,±1)/(0,±2) 结构完全不同，不可镜像套用。
  const KICKS_I = {
    '0>1': [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]],
    '1>0': [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]],
    '1>2': [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]],
    '2>1': [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]],
    '2>3': [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]],
    '3>2': [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]],
    '3>0': [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]],
    '0>3': [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]],
  };
  // 180°：(0,0) 与「上方 1 格」试探（row 向下为正，上方 = -1）；最后一条等价 kick index 4
  const KICKS_180 = [[0, 0], [0, -1]];

  /** 取踢墙序列（已换算为本作行号方向：col 偏移、row 偏移） */
  function getKicks(type, from, to, is180) {
    if (is180) return KICKS_180.map(([dx, dr]) => [dx, dr]);
    const table = type === 'I' ? KICKS_I : (type === 'O' ? null : KICKS_JLSTZ);
    if (!table) return [[0, 0]]; // O 不踢
    const key = `${from}>${to}`;
    return (table[key] || [[0, 0]]).map(([dx, y]) => [dx, -y]); // y 偏移符号翻转
  }

  /** 旋转态占格（含 O：占格恒定） */
  function cellsOf(type, rot, px, py) {
    return ROT_CELLS[type][rot].map(([c, r]) => [c + px, r + py]);
  }

  /* ---------- T-Spin 三点法（§5.3） ---------- */
  /** 格是否被占用或出界（整场 = 行 -2..19、列 0..9） */
  function cornerBlocked(grid, c, r) {
    if (c < 0 || c > 9 || r < -2 || r > 19) return true;
    return grid[r + 2][c] !== 0;
  }

  /** 四个对角格中被占用/出界的数量（以旋转中心 (cx,cy) 为基准） */
  function cornerCount(grid, cx, cy) {
    let n = 0;
    if (cornerBlocked(grid, cx - 1, cy - 1)) n++;
    if (cornerBlocked(grid, cx + 1, cy - 1)) n++;
    if (cornerBlocked(grid, cx - 1, cy + 1)) n++;
    if (cornerBlocked(grid, cx + 1, cy + 1)) n++;
    return n;
  }

  /** 两个「前角」（按最终朝向，凸出方向一侧的两个对角格）是否均被占用/出界 */
  function frontCornersBlocked(grid, rot, cx, cy) {
    let a, b;
    if (rot === 0) { a = [cx - 1, cy - 1]; b = [cx + 1, cy - 1]; }        // 凸向上
    else if (rot === 1) { a = [cx + 1, cy - 1]; b = [cx + 1, cy + 1]; }   // 凸向右
    else if (rot === 2) { a = [cx - 1, cy + 1]; b = [cx + 1, cy + 1]; }   // 凸向下
    else { a = [cx - 1, cy - 1]; b = [cx - 1, cy + 1]; }                  // 凸向左
    return cornerBlocked(grid, a[0], a[1]) && cornerBlocked(grid, b[0], b[1]);
  }

  /* ---------- 默认色板（art-direction-brief §3，唯一口径） ---------- */
  const DEFAULT_COLORS = {
    I: '#00E5FF', O: '#FFEE58', T: '#7C4DFF', S: '#00E676',
    Z: '#FF2D9B', J: '#2979FF', L: '#FF8A00',
  };

  global.NP = global.NP || {};
  global.NP.srs = {
    PIECES, TYPES, DEFAULT_COLORS, ROT_CELLS,
    getKicks, cellsOf, cornerBlocked, cornerCount, frontCornersBlocked,
  };
})(window);
