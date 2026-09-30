// ============================================================================
// NEON PULSE · bloom_threshold.frag — Bloom 后处理 Pass 1：亮部提取
// ============================================================================
// 用途：美术基调「发光描边（Bloom/Glow 后处理）」（framework §3.2）。三 pass 链：
//       ① 本文件提取亮部 → ② bloom_blur.frag 两次分离高斯 → ③ bloom_composite.frag 合成。
// 触发：每帧一次（渲染到 1/2 或 1/4 分辨率 RT，省性能）。
// 规格：u_texel = 1/RT 分辨率；u_threshold 建议 0.62；u_knee 软拐点 0.25。
// 性能：1/4 分辨率下 ≈ 0.2ms（中端核显 1080p）。
// ============================================================================
// 依赖：common.glsl（可选；本文件自包含，仅用 luma）
// ============================================================================

uniform sampler2D u_scene;      // 场景颜色（线性空间）
uniform vec2  u_texel;          // 1 / RT 尺寸
uniform float u_threshold;      // 亮部阈值，建议 0.62
uniform float u_knee;           // 软拐点宽度，建议 0.25
uniform float u_intensity;      // 特效强度分级：低 0.5 / 中 1.0 / 高 1.4

varying vec2 v_uv;

void main() {
    vec3 c = texture2D(u_scene, v_uv).rgb;
    float l = luma(c);
    // 软阈值：低于 knee 的完全丢弃，平滑过渡避免硬切边
    float soft = clamp(l - u_threshold + u_knee, 0.0, 2.0 * u_knee);
    soft = soft * soft / (4.0 * u_knee + 1e-4);
    float contrib = max(soft, l - u_threshold) / max(l, 1e-4);
    gl_FragColor = vec4(c * contrib * u_intensity, 1.0);
}
