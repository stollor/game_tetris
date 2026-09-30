// ============================================================================
// NEON PULSE · fx_combo_ring.frag — COMBO 全屏色环脉冲
// ============================================================================
// 用途：Combo ≥5 时的全屏色环脉冲（framework §8.2 Combo 反馈分级表）。
// 触发：连击达成 Combo = 5 及以上，每次连击触发一环；可多环错峰叠加。
// 时长：u_progress 0→1 对应 300ms；环外推至全屏对角线外。
// 风格：青 → 品红渐变环 + 白色内芯 + 环上星点（与 fx/fx_combo_ring.png 一致）。
// ============================================================================
// 依赖：common.glsl（在本文件之前拼接）
// ============================================================================

uniform float u_progress;  // 0..1（300ms）
uniform vec2  u_res;
uniform float u_strength;  // 强度：0.5（中）/ 1.0（高，低档不播放）
uniform float u_seed;

varying vec2 v_uv;

void main() {
    vec2 uv = v_uv;
    vec2 p = uv - 0.5;
    p.x *= u_res.x / u_res.y;               // 保持圆形
    float t = u_progress;

    vec3 colA = PAL_CYAN;
    vec3 colB = PAL_MAGENTA;
    vec3 ringCol = mix(colA, colB, t);

    float r = 0.06 + 0.72 * t;
    float w = 0.075 * (1.0 - 0.68 * t) + 0.010;
    float d = sdRing(p, r, w);

    vec3 col = vec3(0.0);
    col += ringCol * glow(d, w * 1.25) * pow(1.0 - t, 1.25) * 1.15 * u_strength;
    col += vec3(1.0) * glow(d, w * 0.5) * pow(1.0 - t, 2.0) * 0.35 * u_strength;

    // 环上星点
    for (int i = 0; i < 6; i++) {
        float fi = float(i) + u_seed * 7.3;
        float a = hash11(fi) * 6.2831 + t * 0.6;
        vec2 sp = vec2(cos(a), sin(a)) * r;
        float sd = length(p - sp);
        col += ringCol * exp(-sd / 0.028) * (1.0 - t) * 0.8 * u_strength;
    }

    // 起始中心闪光
    if (t < 0.22) {
        col += vec3(1.0) * exp(-length(p) / 0.24) * (1.0 - t / 0.22) * u_strength;
    }

    gl_FragColor = vec4(col, clamp(max(max(col.r, col.g), col.b), 0.0, 1.0));
}
