/** 冲刺实时计时按50毫秒整桶向下取整；暂停、结束保留精确有效用时。 */
export function 获取冲刺显示用时(有效用时: number, 进行中: boolean): number {
  return 进行中 ? Math.floor(有效用时 / 50) * 50 : 有效用时;
}
