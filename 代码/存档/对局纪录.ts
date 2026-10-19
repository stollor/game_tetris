import { type 存储接口, 存档 } from "../../框架/存档";
import type { 游戏模式 } from "../玩法/再消一行";

export interface 对局纪录 {
  分数: number;
  用时: number | null;
  消行数?: number;
  等级?: number;
  最长连击?: number;
}
const 非负整数 = (值: unknown): 值 is number =>
  typeof 值 === "number" && Number.isSafeInteger(值) && 值 >= 0;
function 校验纪录(值: unknown): 值 is 对局纪录 | null {
  if (值 === null) return true;
  if (typeof 值 !== "object") return false;
  const r = 值 as Partial<对局纪录>;
  return (
    非负整数(r.分数) &&
    (r.用时 === null || (typeof r.用时 === "number" && Number.isFinite(r.用时) && r.用时 >= 0)) &&
    [r.消行数, r.等级, r.最长连击].every((v) => v === undefined || 非负整数(v))
  );
}
/** 保留旧键及裸 JSON 格式，通过框架负责校验和读取失败后的覆盖保护。 */
export function 创建纪录存档(模式: 游戏模式, 日期: string, 存储: 存储接口) {
  return new 存档<对局纪录 | null>({
    键: 模式 === "每日挑战" ? `neon-pulse:daily:${日期}` : `neon-pulse:best:${模式}`,
    版本: 0,
    存储,
    创建: () => null,
    校验: 校验纪录,
    解码: (数据) => ({
      版本: 0,
      数据:
        typeof 数据 === "object" && 数据 !== null && !("用时" in 数据)
          ? { ...数据, 用时: null }
          : 数据,
    }),
    编码: (载荷) => 载荷.数据,
  });
}
/** 分数模式比高分，冲刺只记录有效完赛，零秒等非法完赛数据不能成为最佳。 */
export function 是否刷新纪录(模式: 游戏模式, 新: 对局纪录, 旧: 对局纪录 | null): boolean {
  return 模式 === "冲刺"
    ? 新.用时 !== null && 新.用时 > 0 && (旧?.用时 == null || 新.用时 < 旧.用时)
    : 新.分数 > (旧?.分数 ?? -1);
}
