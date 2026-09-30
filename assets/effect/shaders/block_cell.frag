// ============================================================================
// NEON PULSE · block_cell.frag — 方块单元格（数据光块材质）
// ============================================================================
// 用途：渲染单个方块格（下落块 / 已锁定块 / Ghost 三种状态共用）。
// 触发：每个活动/锁定格各一次（实例化或四边形批次）。
// 风格：内部 10–15% 垂直微渐变 + 2px 内高光（上/左亮、下/右暗）+ 同色外发光；
//       Ghost = 半透明轮廓态（美术简报 §2 材质/边缘处理）。
// 规格：u_uv ∈ [0,1] 为格内 UV；u_isGhost=1 时输出描边+淡填充；
//       u_flash 为锁定/消行白闪 0..1（叠加在材质之上）。
// 性能：单 pass，简单 ALU；800 格全屏 ≈ 0.6ms。
// ============================================================================
// 依赖：common.glsl（在本文件之前拼接）
// ============================================================================

uniform vec3  u_color;    // 方块身份色（七色之一，色板见 common.glsl）
uniform float u_isGhost;  // 1.0 = Ghost 落点投影
uniform float u_flash;    // 0..1 白闪（锁定/消行瞬间）
uniform float u_time;     // 秒（Ghost 呼吸用）
uniform float u_glowMul;  // 外发光倍率（特效强度分级：低 0.5 / 中 1.0 / 高 1.4）

varying vec2 v_uv;        // 格内 UV [0,1]

void main() {
    vec2 uv = v_uv;
    float d = sdBox(uv - 0.5, vec2(0.5));          // <0 格内

    // ---- 内部微渐变（顶部略亮 10–15%）----
    vec3 base = u_color * (0.86 + 0.16 * uv.y);

    // ---- 内高光：上/左亮边 2px（按 40px 格 ≈ 0.05 uv），下/右暗边 ----
    float e = 0.055;
    float bevel = 0.0;
    bevel += smoothstep(e, 0.0, uv.y) * 0.42;      // 上
    bevel += smoothstep(e, 0.0, uv.x) * 0.28;      // 左
    bevel -= smoothstep(1.0 - e, 1.0, uv.y) * 0.30; // 下
    bevel -= smoothstep(1.0 - e, 1.0, uv.x) * 0.22; // 右
    base += vec3(bevel) * mix(u_color, vec3(1.0), 0.45);

    // ---- 外发光（同色 Bloom 预亮，配合后处理 bloom 更佳）----
    float og = outerGlow(d, 0.13) * u_glowMul;

    vec3 col;
    float alpha;
    if (u_isGhost > 0.5) {
        // Ghost：半透明描边 + 极淡填充 + 呼吸
        float breathe = 0.72 + 0.18 * sin(u_time * 2.4);
        float edge = glow(d + 0.42, 0.10);          // 描边带
        col = u_color * (edge * 1.15 + 0.10) * breathe;
        alpha = clamp(edge * 0.72 + 0.12 * breathe, 0.0, 1.0) * 0.55;
    } else {
        float fill = 1.0 - smoothstep(-0.02, 0.02, d); // 格内 1
        col = base * fill + u_color * og * 0.9;
        alpha = clamp(fill * 0.96 + og * 0.75, 0.0, 1.0);
    }

    // ---- 白闪叠加（行爆/锁定瞬间）----
    col = flashMix(col, u_flash);
    alpha = max(alpha, u_flash * 0.9);

    gl_FragColor = vec4(col, alpha);
}
