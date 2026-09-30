// ============================================================================
// NEON PULSE · fx_record_burst.frag — 破纪录金色爆发（非阻塞全屏叠加层）
// ============================================================================
// 用途：破纪录瞬间的 ≤300ms 全屏特效（framework §2.3 非阻塞铁律）。
// 触发：分数型=分数超过历史最佳瞬间；Sprint=第 40 行锁定进入结算瞬间。
// 时长：u_progress 0→1 对应 **300ms**（硬上限，禁止更长）。
// 关键约束：纯视觉叠加层，输入照常穿透；不得暂停/冻结任何游戏时钟。
// ============================================================================
// 依赖：common.glsl（在本文件之前拼接）
// ============================================================================

uniform float u_progress;  // 0..1（≤300ms）
uniform float u_time;
uniform vec2  u_res;
uniform float u_seed;

varying vec2 v_uv;

void main() {
    vec2 uv = v_uv;
    vec2 p = uv - 0.5;
    p.x *= u_res.x / u_res.y;
    float t = u_progress;
    float spin = t * 0.22;

    vec3 col = vec3(0.0);

    // ---- 12 道金色射线（旋转外推）----
    for (int i = 0; i < 12; i++) {
        float a = float(i) * 0.5236 + spin;
        vec2 dir = vec2(cos(a), sin(a));
        float along = dot(p, dir);
        float perp = abs(-p.x * dir.y + p.y * dir.x);
        float len = 0.18 + 0.58 * t;
        float taper = clamp(1.0 - along / len, 0.12, 1.0);
        float ray = step(0.0, along) * step(along, len) * smoothstep(perp, perp - 0.028 * taper, 0.028 * taper);
        col += PAL_RECORD * ray * pow(1.0 - t, 1.15) * 0.95;
    }

    // ---- 金色环 ----
    float r = 0.08 + 0.52 * t;
    float w = 0.055 * (1.0 - 0.6 * t) + 0.010;
    col += PAL_RECORD * glow(sdRing(p, r, w), w * 1.2) * pow(1.0 - t, 1.3);

    // ---- 星点粒子 ----
    for (int i = 0; i < 10; i++) {
        float fi = float(i) + u_seed * 3.7;
        float a = hash11(fi) * 6.2831;
        float d = hash11(fi * 1.7) * 0.62 * (0.35 + t);
        vec2 sp = vec2(cos(a), sin(a)) * d;
        float sd = length(p - sp);
        col += mix(PAL_RECORD, vec3(1.0), hash11(fi * 2.3)) * exp(-sd / 0.018) * (1.0 - t) * 0.9;
    }

    // ---- 中心白闪（前 30%）----
    if (t < 0.3) {
        col += vec3(1.0) * exp(-length(p) / 0.3) * (1.0 - t / 0.3) * 1.2;
    }

    gl_FragColor = vec4(col, clamp(max(max(col.r, col.g), col.b), 0.0, 1.0));
}
