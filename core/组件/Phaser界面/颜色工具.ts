/** 颜色数值工具：混色、提亮与压暗，供程序化绘制共用。 */

function 通道(色值: number): [number, number, number] {
  return [(色值 >> 16) & 0xff, (色值 >> 8) & 0xff, 色值 & 0xff];
}

function 合成(红: number, 绿: number, 蓝: number): number {
  return (
    (Math.max(0, Math.min(255, 红)) << 16) |
    (Math.max(0, Math.min(255, 绿)) << 8) |
    Math.max(0, Math.min(255, 蓝))
  );
}

/** 按比例在两个颜色之间插值（0 返回甲，1 返回乙）。 */
export function 混色(甲: number, 乙: number, 比例: number): number {
  const [甲红, 甲绿, 甲蓝] = 通道(甲);
  const [乙红, 乙绿, 乙蓝] = 通道(乙);
  const t = Math.min(1, Math.max(0, 比例));
  return 合成(
    Math.round(甲红 + (乙红 - 甲红) * t),
    Math.round(甲绿 + (乙绿 - 甲绿) * t),
    Math.round(甲蓝 + (乙蓝 - 甲蓝) * t),
  );
}

/** 向白色提亮。 */
export function 亮色(色值: number, 比例 = 0.3): number {
  return 混色(色值, 0xffffff, 比例);
}

/** 向黑色压暗。 */
export function 暗色(色值: number, 比例 = 0.3): number {
  return 混色(色值, 0x000000, 比例);
}

/** 数值颜色转 CSS 字符串。 */
export function 颜色字符串(色值: number): string {
  return `#${色值.toString(16).padStart(6, "0")}`;
}
