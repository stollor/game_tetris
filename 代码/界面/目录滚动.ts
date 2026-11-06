/** 横向目录的最小滚动：选中项已可见则保持当前位置，否则只滚到刚好露出。 */
export function 计算目录滚动(当前: number, 项左: number, 项宽: number, 可视宽: number): number {
  const 边 = 8;
  if (项左 < 当前 + 边) return Math.max(0, 项左 - 边);
  if (项左 + 项宽 > 当前 + 可视宽 - 边) return Math.max(0, 项左 + 项宽 - 可视宽 + 边);
  return 当前;
}

/**
 * 把选中项滚到可视区正中（两端夹紧）：进商店时当前主题的 tab 应该在中间，
 * 而不是贴着左边或只露出半张卡。
 */
export function 计算目录滚动居中(项左: number, 项宽: number, 可视宽: number): number {
  const 目标 = 项左 + 项宽 / 2 - 可视宽 / 2;
  return Math.max(0, 目标);
}
