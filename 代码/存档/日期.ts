/**
 * 游戏日期口径：每日挑战种子、纪录键与金币「每日首局」都用北京时间，
 * 与设备时区无关，避免跨时区玩家在同一真实日期被算成两天。
 */
export function 北京日期(时间 = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(时间);
}
