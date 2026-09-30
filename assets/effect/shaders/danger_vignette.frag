// ============================================================================
// NEON PULSE · danger_vignette.frag — 危险预警红光呼吸
// ============================================================================
// 用途：堆叠高度 ≥16 行时场地边缘红光呼吸（framework §8.2 危险预警）。
// 触发：堆叠高度 ≥16 行进入（同时叠加 bgm_layer_heartbeat.wav 低频心跳层）；
//       回到 <12 行解除（滞回区间 12–16 行不改变状态，防抖）。
// 循环：常驻循环，呼吸周期 2.0s（0.5Hz），与 BPM 解耦但可由 u_beat 对齐拍点。
// 规格：场地边缘叠加层（Additive）；强度随 u_intensity 0..1（特效强度分级联动）。
// ============================================================================
// 依赖：common.glsl（在本文件之前拼接）
// ============================================================================

uniform float u_time;
uniform float u_intensity;  // 0 = 关闭，1 = 全强度（低档位 = 0.5）
uniform float u_beat;       // 可选：节拍相位 0..1（对齐拍点时用；不拍则传 0）
uniform vec2  u_res;

varying vec2 v_uv;

void main() {
    vec2 uv = v_uv;
    // 呼吸：2s 周期；u_beat 存在时叠加一次拍点闪
    float breathe = 0.55 + 0.45 * sin(u_time * 3.14159);      // 0.5Hz
    float beatFlash = pow(max(1.0 - u_beat, 0.0), 3.0) * 0.22;

    // 边缘距离（越靠边越亮）
    float edge = 1.0 - smoothstep(0.0, 0.10, min(min(uv.x, 1.0 - uv.x), min(uv.y, 1.0 - uv.y)));
    float corner = 1.0 - smoothstep(0.0, 0.34, length((uv - 0.5) * vec2(u_res.x / u_res.y, 1.0)) * 0.72);

    vec3 col = PAL_DANGER * (edge * 0.9 + corner * 0.16) * (breathe + beatFlash) * u_intensity;

    gl_FragColor = vec4(col, clamp(max(max(col.r, col.g), col.b), 0.0, 1.0));
}
