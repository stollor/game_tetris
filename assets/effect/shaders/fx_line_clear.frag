// ============================================================================
// NEON PULSE · fx_line_clear.frag — 消行爆光（shader 版）
// ============================================================================
// 用途：行爆白闪 → 光条拉伸 → 碎片外飞 → 辉光衰减（framework §8.2 每次消行）。
//       与序列帧素材 fx/fx_line_burst.png 二选一；shader 版可按行颜色/宽度自适应。
// 触发：消行结算瞬间（250ms 消行动画内）；多行错位 40ms 叠加。
// 时长：u_progress 0→1 对应 250ms（1–4 行同曲线，行数用 u_rows 控制强度）。
// 规格：全屏 quad 叠加（Additive）；u_rowY 为消行行中心的归一化 y（0=底，1=顶）。
// ============================================================================
// 依赖：common.glsl（在本文件之前拼接）
// ============================================================================

uniform float u_progress;  // 0..1（250ms）
uniform float u_rowY;      // 消行行中心 y（uv）
uniform float u_rowH;      // 行高（uv，例：40px/800px = 0.05）
uniform float u_rows;      // 同批消行数 1..4（强度/碎片数量）
uniform vec3  u_color;     // 消行色（块色均值或青白）
uniform vec2  u_res;
uniform float u_seed;      // 随机种子（每行不同，保证碎片不重样）

varying vec2 v_uv;

// 单个碎片：沿行分布外飞的四边形辉光
float shard(vec2 uv, vec2 pos, vec2 vel, float p, float seed) {
    vec2 p0 = pos + vel * p;
    float size = (0.020 + 0.012 * hash11(seed)) * (1.0 - 0.55 * p);
    vec2 d = abs(uv - p0) - vec2(size, size * 0.62);
    float sd = length(max(d, 0.0));
    return exp(-sd / (size * 0.9));
}

void main() {
    vec2 uv = v_uv;
    float p = u_progress;

    // ---- 白闪核心：横条（高度先撑后收）----
    float barH = u_rowH * (1.05 + 0.75 * sin(3.14159 * min(p * 1.6, 1.0)));
    float dy = abs(uv.y - u_rowY);
    float core = smoothstep(barH, 0.0, dy);
    float flash = pow(max(1.0 - p / 0.35, 0.0), 1.4);

    vec3 col = vec3(0.0);
    col += vec3(1.0) * core * flash * 1.25;
    col += mix(vec3(1.0), u_color, clamp(p * 1.6, 0.0, 1.0)) * core * pow(1.0 - p, 1.4) * 0.85;

    // ---- 碎片外飞（数量随 u_rows 增加）----
    int n = int(6.0 + u_rows * 5.0);
    for (int i = 0; i < 20; i++) {
        if (i >= n) break;
        float fi = float(i) + u_seed * 13.7;
        vec2 pos = vec2(hash11(fi * 1.7), u_rowY + (hash11(fi * 2.3) - 0.5) * u_rowH * 0.8);
        vec2 vel = vec2((hash11(fi * 3.1) - 0.5) * 0.9, (hash11(fi * 4.7) - 0.5) * 0.55);
        col += u_color * shard(uv, pos, vel, p, fi) * pow(1.0 - p, 1.2) * 0.95;
    }

    // ---- 残留辉光 ----
    float halo = exp(-dy / (u_rowH * (2.0 + 6.0 * p)));
    col += u_color * halo * pow(1.0 - p, 1.6) * 0.5;

    gl_FragColor = vec4(col, clamp(max(max(col.r, col.g), col.b), 0.0, 1.0));
}
