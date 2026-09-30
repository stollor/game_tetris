// ============================================================================
// NEON PULSE · level_pulse.frag — 升级 300ms 全屏色彩脉冲
// ============================================================================
// 用途：升级瞬间的全屏色彩脉冲（framework §6.1「等级与速度瞬间切换，仅用 300ms
//       的全屏色彩脉冲提示」），与 sfx_level_up 同帧触发。
// 时长：u_progress 0→1 = **300ms**（固定，不可延长；BPM 切换也用同一 300ms 渐变）。
// 约束：纯视觉；不改变任何游戏时钟；输入响应 ≤1 帧不受影响。
// ============================================================================
// 依赖：common.glsl（在本文件之前拼接）
// ============================================================================

uniform float u_progress;   // 0..1（300ms）
uniform vec2  u_res;
uniform vec3  u_colorA;     // 脉冲色 1（默认 PAL_CYAN）
uniform vec3  u_colorB;     // 脉冲色 2（默认 PAL_PURPLE）

varying vec2 v_uv;

void main() {
    vec2 uv = v_uv;
    vec2 p = uv - 0.5;
    p.x *= u_res.x / u_res.y;
    float t = u_progress;

    vec3 col = vec3(0.0);

    // 双环外推（青 / 紫）
    float r1 = 0.08 + 0.62 * t;
    float r2 = 0.08 + 0.44 * t;
    col += u_colorA * glow(sdRing(p, r1, 0.05 * (1.0 - 0.5 * t) + 0.012), 0.06)
           * pow(1.0 - t, 1.2);
    col += u_colorB * glow(sdRing(p, r2, 0.032 * (1.0 - 0.5 * t) + 0.010), 0.045)
           * pow(1.0 - t, 1.2) * 0.55;

    // 底部上升光柱（等化器感，7 根）
    for (int i = 0; i < 7; i++) {
        float fi = float(i);
        float bx = -0.42 + 0.14 * fi;
        float bh = 0.16 + 0.30 * hash11(fi * 5.1) * (1.0 - 0.4 * t);
        vec2 d = abs(p - vec2(bx, -0.5 + bh * 0.5)) - vec2(0.022, bh * 0.5);
        float sd = length(max(d, 0.0));
        col += u_colorA * exp(-sd / 0.028) * pow(1.0 - t, 1.3) * 0.55;
    }

    // 全屏底色微脉冲（亮度提升 ≤8%，不遮挡读块）
    col += mix(u_colorA, u_colorB, 0.5) * 0.08 * pow(1.0 - t, 1.5);

    gl_FragColor = vec4(col, clamp(max(max(col.r, col.g), col.b), 0.0, 1.0));
}
