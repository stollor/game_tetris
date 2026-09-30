// ============================================================================
// NEON PULSE · bloom_blur.frag — Bloom 后处理 Pass 2：分离高斯模糊
// ============================================================================
// 用途：对亮部 RT 做两次分离高斯（先横向 u_dir=(1,0)，再纵向 u_dir=(0,1)）。
// 规格：9-tap 高斯，步长 u_texel * u_step（建议 1.0 / 2.0 / 4.0 三级递进做多级 Bloom）。
// 性能：两次调用 ≈ 0.4ms（1/4 分辨率）。
// ============================================================================

uniform sampler2D u_tex;
uniform vec2  u_texel;
uniform vec2  u_dir;        // (1,0) = 横向；(0,1) = 纵向
uniform float u_step;       // 步长倍率（多级 Bloom：1.0 / 2.0 / 4.0）

varying vec2 v_uv;

void main() {
    // 9-tap 高斯权重（σ ≈ 2.0）
    float w[5];
    w[0] = 0.2270270270;
    w[1] = 0.1945945946;
    w[2] = 0.1216216216;
    w[3] = 0.0540540541;
    w[4] = 0.0162162162;

    vec2 off = u_dir * u_texel * u_step;
    vec3 acc = texture2D(u_tex, v_uv).rgb * w[0];
    for (int i = 1; i < 5; i++) {
        acc += texture2D(u_tex, v_uv + off * float(i)).rgb * w[i];
        acc += texture2D(u_tex, v_uv - off * float(i)).rgb * w[i];
    }
    gl_FragColor = vec4(acc, 1.0);
}
