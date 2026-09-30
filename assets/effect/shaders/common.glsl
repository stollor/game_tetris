// ============================================================================
// NEON PULSE · common.glsl — 特效公共库（GLSL ES 1.00 / WebGL1 兼容）
// ============================================================================
// 用法：引擎在编译各 fragment shader 前把本文件内容拼接到其顶部（或用 #include 展开）。
// 坐标约定：v_uv ∈ [0,1]，原点左下；u_res = 像素分辨率；u_time = 秒（音频时钟驱动更佳）。
// 色板唯一口径对齐 03-art-design/art-direction-brief.md §3。
// ============================================================================

precision mediump float;

const vec3 PAL_BG       = vec3(0.043, 0.055, 0.102); // #0B0E1A
const vec3 PAL_BG2      = vec3(0.078, 0.102, 0.180); // #141A2E
const vec3 PAL_GRID     = vec3(0.165, 0.200, 0.322); // #2A3352
const vec3 PAL_CYAN     = vec3(0.000, 0.898, 1.000); // #00E5FF I 块
const vec3 PAL_LEMON    = vec3(1.000, 0.933, 0.345); // #FFEE58 O 块
const vec3 PAL_PURPLE   = vec3(0.486, 0.302, 1.000); // #7C4DFF T 块
const vec3 PAL_GREEN    = vec3(0.000, 0.902, 0.463); // #00E676 S 块
const vec3 PAL_MAGENTA  = vec3(1.000, 0.176, 0.608); // #FF2D9B Z 块
const vec3 PAL_BLUE     = vec3(0.161, 0.475, 1.000); // #2979FF J 块
const vec3 PAL_ORANGE   = vec3(1.000, 0.541, 0.000); // #FF8A00 L 块
const vec3 PAL_TEXT     = vec3(0.918, 0.949, 1.000); // #EAF2FF
const vec3 PAL_RECORD   = vec3(1.000, 0.835, 0.310); // #FFD54F 破纪录金
const vec3 PAL_DANGER   = vec3(1.000, 0.090, 0.267); // #FF1744 危险红

// ---------------------------------------------------------------- 基础工具
float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

float hash11(float p) {
    p = fract(p * 0.1031);
    p *= p + 33.33;
    p *= p + p;
    return fract(p);
}

vec2 hash22(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.xx + p3.yz) * p3.zy);
}

float hash21(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
}

float vnoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash21(i), hash21(i + vec2(1.0, 0.0)), u.x),
               mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), u.x), u.y);
}

mat2 rot2(float a) {
    float s = sin(a), c = cos(a);
    return mat2(c, -s, s, c);
}

// ---------------------------------------------------------------- SDF
float sdRing(vec2 p, float r, float w) {
    return abs(length(p) - r) - w;
}

float sdBox(vec2 p, vec2 b) {
    vec2 d = abs(p) - b;
    return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
}

// 软发光：给定 SDF 距离与辉光宽度，返回 0..1 强度（外发光常用）
float glow(float sd, float w) {
    return clamp(1.0 - abs(sd) / max(w, 1e-4), 0.0, 1.0);
}

// 外发光（指数衰减，越近越亮）
float outerGlow(float sd, float w) {
    return exp(-max(sd, 0.0) / max(w, 1e-4));
}

// ---------------------------------------------------------------- 颜色工具
vec3 saturate3(vec3 c, float s) {
    float l = luma(c);
    return clamp(mix(vec3(l), c, s), 0.0, 1.0);
}

// 白 → 色 的行爆白闪调色
vec3 flashMix(vec3 base, float flash) {
    return mix(base, vec3(1.0), clamp(flash, 0.0, 1.0));
}
