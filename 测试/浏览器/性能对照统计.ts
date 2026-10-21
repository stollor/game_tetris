/**
 * 双版本性能对照的纯统计与参数校验：不依赖 Playwright/浏览器，供脚本与 bun test 共用。
 * 采样窗口只接受「前/后两次读数」的差值，不把累计帧数或累计时间当窗口值。
 */

export const 默认轮次 = 3;

export interface 采样点 {
  帧计数: number;
  时刻毫秒: number;
}

export interface 采样窗口读数 {
  帧增量: number;
  经过毫秒: number;
  经过秒: number;
  FPS: number;
}

export interface 数值汇总 {
  样本数: number;
  中位数: number | null;
  最小: number | null;
  最大: number | null;
}

function 要求有限数值(值: number, 名称: string): number {
  if (!Number.isFinite(值)) throw new Error(`${名称}必须是有限数值，实际为 ${String(值)}`);
  return 值;
}

/** 读取 `--轮次=`；缺省为 3，出现时必须是不带符号的十进制正整数。 */
export function 解析轮次(参数: readonly string[], 缺省 = 默认轮次): number {
  if (参数.includes("--轮次")) throw new Error("--轮次 必须写成 --轮次=<正整数>");
  const 项 = 参数.find((项) => 项.startsWith("--轮次="));
  if (!项) return 缺省;
  const 原文 = 项.slice("--轮次=".length);
  if (!/^[1-9]\d*$/.test(原文)) throw new Error(`--轮次 必须是正整数，实际为 "${原文}"`);
  const 值 = Number(原文);
  if (!Number.isSafeInteger(值)) throw new Error(`--轮次 超出安全整数范围：${原文}`);
  return 值;
}

/** 单次差值：负增量说明计数器被重置或读数顺序颠倒，直接拒绝，不截成 0。 */
export function 计算增量(前值: number, 后值: number, 名称 = "计数"): number {
  要求有限数值(前值, `${名称}前值`);
  要求有限数值(后值, `${名称}后值`);
  const 增量 = 后值 - 前值;
  if (增量 < 0) throw new Error(`${名称}出现负增量（${前值} → ${后值}），疑似计数器被重置`);
  return 增量;
}

/** 重置计数只接受非负数，避免用负值伪造窗口起点。 */
export function 重置计数(值: number, 名称 = "计数"): number {
  要求有限数值(值, 名称);
  if (值 < 0) throw new Error(`${名称}重置值不能为负：${值}`);
  return 值;
}

/** 同一采样窗口的渲染帧增量 / 实际经过秒数 / FPS；经过时间为 0 或负值一律拒绝。 */
export function 计算采样窗口(前: 采样点, 后: 采样点): 采样窗口读数 {
  const 帧增量 = 计算增量(前.帧计数, 后.帧计数, "渲染帧数");
  const 经过毫秒 = 计算增量(前.时刻毫秒, 后.时刻毫秒, "performance.now");
  if (经过毫秒 <= 0) throw new Error("采样窗口经过时间必须大于 0 毫秒");
  const 经过秒 = 经过毫秒 / 1000;
  return { 帧增量, 经过毫秒, 经过秒, FPS: 帧增量 / 经过秒 };
}

/** 忽略 null/undefined/非有限值，返回样本数、中位数与范围。 */
export function 汇总数值(值: readonly (number | null | undefined)[]): 数值汇总 {
  const 有效 = 值
    .filter((项): 项 is number => typeof 项 === "number" && Number.isFinite(项))
    .sort((甲, 乙) => 甲 - 乙);
  if (有效.length === 0) return { 样本数: 0, 中位数: null, 最小: null, 最大: null };
  const 中位下标 = Math.floor(有效.length / 2);
  const 中位数 = 有效.length % 2 === 1 ? 有效[中位下标] : (有效[中位下标 - 1] + 有效[中位下标]) / 2;
  return {
    样本数: 有效.length,
    中位数,
    最小: 有效[0],
    最大: 有效.at(-1) ?? null,
  };
}
