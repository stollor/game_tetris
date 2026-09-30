// ============================================================================
// NEON PULSE · bg_data_flow.frag — 对局背景（数据流 / 城市剪影 / 网格 / 节拍脉冲）
// ============================================================================
// 用途：对局场景全屏背景层（framework §3.2）。城市剪影缓慢流动 + 数据流粒子，
//       速度随 BPM(等级) 联动；不得干扰读块（亮度上限压在 0.22 以下）。
// 触发：常驻循环渲染。
// 规格：全屏 quad；u_speed = BPM(等级)/128（1.0–1.5625）；u_beatPulse 每拍衰减到 0。
// 性能：单 pass，中端核显 1080p ≈ 0.3ms。
// ============================================================================
// 依赖：common.glsl（在本文件之前拼接）
// ============================================================================

uniform vec2  u_res;
uniform float u_time;      // 秒（建议用音频时钟，随暂停冻结）
uniform float u_speed;     // BPM(等级)/128，1.0 起
uniform float u_beatPulse; // 每小节第 1 拍 / 每拍脉冲 0..1（§7.6 用途 2）
uniform float u_danger;    // 危险状态 0..1（≥16 行呼吸红光）
uniform float u_dim;       // 全局亮度系数（低配档位用，默认 1.0）

varying vec2 v_uv;

// 城市剪影：按列取 hash 得楼高，窗口点阵随时间闪烁
float cityLayer(vec2 uv, float cols, float baseH, float t) {
    float col = floor(uv.x * cols);
    float h = baseH + 0.16 * hash11(col * 1.7);
    float inCity = step(uv.y, h);
    // 窗口点阵
    vec2 wgrid = vec2(cols * 6.0, 42.0);
    vec2 cell = floor(uv * wgrid);
    float win = step(0.72, hash21(cell + col)) * step(uv.y, h - 0.01);
    float flick = 0.55 + 0.45 * sin(t * 0.7 + hash21(cell) * 6.2831);
    return inCity * (0.55 + 0.45 * win * flick);
}

// 数据流：竖向下落的亮段（多列并行，速度不同）
float dataStream(vec2 uv, float cols, float t, float seed) {
    float col = floor(uv.x * cols);
    float speed = (0.10 + 0.22 * hash11(col + seed)) * t;
    float y = fract(uv.y * (2.2 + 1.6 * hash11(col * 3.1 + seed)) + speed);
    float dash = smoothstep(0.0, 0.16, y) * smoothstep(0.42, 0.16, y);
    float lane = step(0.55, hash11(col * 2.3 + seed));
    return dash * lane;
}

void main() {
    vec2 uv = v_uv;
    float t = u_time * u_speed;

    // ---- 底色：深空蓝紫纵向渐变 ----
    vec3 col = mix(PAL_BG, PAL_BG2, smoothstep(0.0, 1.0, uv.y * 0.65 + 0.18));

    // ---- 城市剪影（两层视差，最低亮度层）----
    float cityFar = cityLayer(vec2(uv.x + t * 0.0035, uv.y), 26.0, 0.16, t);
    float cityNear = cityLayer(vec2(uv.x * 1.25 - t * 0.006, uv.y), 18.0, 0.11, t);
    col = mix(col, PAL_BG2 * 1.45, cityFar * 0.5);
    col = mix(col, PAL_BG2 * 1.85, cityNear * 0.55);

    // ---- 数据流粒子（三列阵列）----
    float ds = dataStream(uv, 42.0, t, 0.0) * 0.34
             + dataStream(uv, 30.0, t * 1.35, 11.0) * 0.26
             + dataStream(uv, 56.0, t * 0.8, 23.0) * 0.20;
    col += PAL_CYAN * ds * 0.28;

    // ---- 场地网格（低亮度半透明）----
    vec2 g = abs(fract(uv * vec2(30.0, 17.0)) - 0.5);
    float grid = 1.0 - smoothstep(0.0, 0.035, min(g.x, g.y));
    col += PAL_GRID * grid * 0.35;

    // ---- 节拍脉冲：边缘辉光 + 底部光带（§7.6 用途 2）----
    float edge = 1.0 - smoothstep(0.0, 0.16, min(min(uv.x, 1.0 - uv.x), min(uv.y, 1.0 - uv.y)));
    col += PAL_CYAN * edge * u_beatPulse * 0.16;
    col += PAL_CYAN * smoothstep(0.22, 0.0, uv.y) * u_beatPulse * 0.10;

    // ---- 危险红光呼吸（§8.2）----
    col += PAL_DANGER * edge * u_danger * 0.30;

    gl_FragColor = vec4(clamp(col * u_dim, 0.0, 1.0), 1.0);
}
