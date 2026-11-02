/** 底板画布共用的小工具：颜色转 rgba 字符串。 */
export function 串(值: number, 透明 = 1): string {
  const r = (值 >> 16) & 0xff;
  const g = (值 >> 8) & 0xff;
  const b = 值 & 0xff;
  return `rgba(${r}, ${g}, ${b}, ${透明})`;
}
