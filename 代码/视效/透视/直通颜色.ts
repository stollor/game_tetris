/**
 * 直通颜色：渲染器输出 LinearSRGB 直通（2D 界面依赖它），
 * Three 的 Color 默认把十六进制当 sRGB 转进线性工作空间，原样输出会整体压暗。
 * 3D 侧改用这里把十六进制直接换算成 0–1 向量，画面上看到的颜色与主题表一致。
 */

export type 颜色向量 = [number, number, number];

export function 转颜色向量(十六进制: number): 颜色向量 {
  return [((十六进制 >> 16) & 0xff) / 255, ((十六进制 >> 8) & 0xff) / 255, (十六进制 & 0xff) / 255];
}
