// ============================================================================
// NEON PULSE · bloom_composite.frag — Bloom 后处理 Pass 3：合成 + 屏幕边缘辉光
// ============================================================================
// 用途：场景 + 多级 Bloom 合成；「高」档位附加屏幕边缘辉光（framework §8.3）。
// 规格：u_bloomA = 近半径 Bloom，u_bloomB = 远半径 Bloom；u_edgeGlow 高档 = 1.0，
//       中档 = 0.0，低档 = 0.0 且 u_bloomMul = 0.5。
// 性能：单 pass ≈ 0.25ms。
// ============================================================================
// 依赖：common.glsl（在本文件之前拼接）
// ============================================================================

uniform sampler2D u_scene;
uniform sampler2D u_bloomA;     // 近半径
uniform sampler2D u_bloomB;     // 远半径
uniform float u_bloomMul;       // 低 0.5 / 中 1.0 / 高 1.15
uniform float u_edgeGlow;       // 屏幕边缘辉光开关（仅高档 1.0）
uniform float u_time;
uniform vec2  u_res;

varying vec2 v_uv;

void main() {
    vec3 scene = texture2D(u_scene, v_uv).rgb;
    vec3 bloom = texture2D(u_bloomA, v_uv).rgb * 0.7 + texture2D(u_bloomB, v_uv).rgb * 0.5;
    vec3 col = scene + bloom * u_bloomMul;

    // 屏幕边缘辉光（高档位）：青白冷光，低强度、不遮挡读块
    if (u_edgeGlow > 0.0) {
        vec2 uv = v_uv;
        float edge = 1.0 - smoothstep(0.0, 0.07, min(min(uv.x, 1.0 - uv.x), min(uv.y, 1.0 - uv.y)));
        float breathe = 0.8 + 0.2 * sin(u_time * 1.6);
        col += PAL_CYAN * edge * 0.10 * breathe * u_edgeGlow;
    }

    // 轻微饱和提升 + 输出（显示空间）
    col = saturate3(col, 1.06);
    gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
