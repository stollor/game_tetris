import { type 存储接口, 存档 } from "../../框架Three/存档";
import { 成就定义 } from "../成就/再消一行成就";
import { type 地点名称, type 地点皮肤, 地点皮肤表, 查找地点 } from "../框架配置/旅行地点";
import {
  外观原价,
  外观编号,
  type 外观部位,
  外观部位列表,
  金币奖励配置,
} from "../项目配置/旅行皮肤";

export interface 旅行存档 {
  金币: number;
  累计获得: number;
  已购: string[];
  已结算: string[];
  已领成就: string[];
  最近首局日期: string;
}
export interface 收藏结果 {
  成功: boolean;
  原因: string;
  金币: number;
  新增: number;
}
export interface 对局奖励输入 {
  编号: string;
  分数: number;
  消行: number;
  用时: number;
  落块: number;
  破纪录: boolean;
  日期: string;
}
const 合法商品 = new Set(
  地点皮肤表.flatMap((地点) => 外观部位列表.map((部位) => 外观编号(地点.名称, 部位))),
);
const 成就编号 = new Set<string>(成就定义.map((项) => 项.编号));
const 整数 = (值: unknown): 值 is number =>
  typeof 值 === "number" && Number.isSafeInteger(值) && 值 >= 0;
const 字串数组 = (值: unknown): 值 is string[] =>
  Array.isArray(值) &&
  值.every((项) => typeof 项 === "string" && 项.length > 0 && 项.length <= 100) &&
  new Set(值).size === 值.length;
function 校验(值: unknown): 值 is 旅行存档 {
  if (!值 || typeof 值 !== "object") return false;
  const 数据 = 值 as Partial<旅行存档>;
  return (
    整数(数据.金币) &&
    整数(数据.累计获得) &&
    数据.金币 <= 数据.累计获得 &&
    字串数组(数据.已购) &&
    数据.已购.every((项) => 合法商品.has(项)) &&
    字串数组(数据.已结算) &&
    字串数组(数据.已领成就) &&
    数据.已领成就.every((项) => 成就编号.has(项)) &&
    typeof 数据.最近首局日期 === "string" &&
    /^(\d{4}-\d{2}-\d{2})?$/.test(数据.最近首局日期)
  );
}
export function 旅行日期(时间 = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(时间);
}

/** 余额、所有权和奖励凭据写在同一份版本化存档里，保存失败不会扣款或授予商品。 */
export class 旅行收藏 {
  private readonly 存档: 存档<旅行存档>;
  错误 = "";
  constructor(存储: 存储接口) {
    this.存档 = new 存档({
      键: "旅行版:收藏",
      版本: 1,
      存储,
      创建: () => ({
        金币: 金币奖励配置.初始金币,
        累计获得: 金币奖励配置.初始金币,
        已购: [],
        已结算: [],
        已领成就: [],
        最近首局日期: "",
      }),
      校验,
      失败: (_阶段, 错误) => {
        this.错误 = 错误 instanceof Error ? 错误.message : "无法保存旅行收藏";
      },
    });
  }
  读取(): 旅行存档 {
    this.错误 = "";
    return this.存档.读取();
  }
  拥有(地点: 地点名称, 部位: 外观部位, 数据 = this.读取()): boolean {
    return 数据.已购.includes(外观编号(地点, 部位));
  }
  增加测试金币(数量: number): 收藏结果 {
    const 数据 = this.读取();
    if (!整数(数量) || 数量 < 1 || 数量 > 1000000)
      return this.结果(数据, false, "测试金币数量无效");
    return this.写入(
      数据,
      { ...数据, 金币: 数据.金币 + 数量, 累计获得: 数据.累计获得 + 数量 },
      `测试金币 +${数量}`,
    );
  }
  报价(地点: 地点皮肤, 部位: 外观部位 | "整套", 数据 = this.读取()): number {
    if (部位 === "整套") {
      const 补齐价 = 外观部位列表
        .filter((项) => 项 !== "静态背景")
        .reduce((和, 项) => 和 + this.报价(地点, 项, 数据), 0);
      return Math.ceil((补齐价 * 金币奖励配置.套装折扣) / 10) * 10;
    }
    if (this.拥有(地点.名称, 部位, 数据)) return 0;
    const 原价 = 外观原价(地点, 部位);
    return 部位 === "动态背景" && this.拥有(地点.名称, "静态背景", 数据)
      ? 原价 - 外观原价(地点, "静态背景")
      : 原价;
  }
  购买(名称: string, 部位: 外观部位 | "整套"): 收藏结果 {
    const 数据 = this.读取();
    const 地点 = 查找地点(名称);
    if (!地点 || (部位 !== "整套" && !外观部位列表.includes(部位)))
      return this.结果(数据, false, "商品不存在");
    const 价格 = this.报价(地点, 部位, 数据);
    if (!价格) return this.结果(数据, false, "已经拥有，无需重复购买");
    if (数据.金币 < 价格) return this.结果(数据, false, `还差 ${价格 - 数据.金币} 金币`);
    const 授予 =
      部位 === "整套"
        ? 外观部位列表
        : 部位 === "动态背景"
          ? (["静态背景", "动态背景"] as const)
          : [部位];
    const 新 = {
      ...数据,
      金币: 数据.金币 - 价格,
      已购: [...new Set([...数据.已购, ...授予.map((项) => 外观编号(地点.名称, 项))])],
    };
    return this.写入(数据, 新, "购买成功，已存入收藏");
  }
  领取成就(已解锁: readonly string[]): 收藏结果 {
    const 数据 = this.读取();
    const 新领 = [...new Set(已解锁)].filter(
      (项) => 成就编号.has(项) && !数据.已领成就.includes(项),
    );
    if (!新领.length) return this.结果(数据, true, "没有待领取的成就奖励");
    const 奖励 = 新领.length * 金币奖励配置.成就;
    return this.写入(
      数据,
      {
        ...数据,
        金币: 数据.金币 + 奖励,
        累计获得: 数据.累计获得 + 奖励,
        已领成就: [...数据.已领成就, ...新领],
      },
      `成就奖励 +${奖励}`,
    );
  }
  结算对局(对局: 对局奖励输入): 收藏结果 {
    const 数据 = this.读取();
    if (
      !对局.编号 ||
      对局.编号.length > 100 ||
      ![对局.分数, 对局.消行, 对局.落块].every(整数) ||
      !Number.isFinite(对局.用时) ||
      对局.用时 < 0 ||
      !/^\d{4}-\d{2}-\d{2}$/.test(对局.日期)
    )
      return this.结果(数据, false, "对局数据无效");
    if (数据.已结算.includes(对局.编号)) return this.结果(数据, true, "本局奖励已领取");
    if (对局.用时 < 金币奖励配置.有效对局秒 * 1000 || 对局.落块 < 金币奖励配置.有效落块数)
      return this.结果(
        数据,
        true,
        `对局满${金币奖励配置.有效对局秒}秒且落块${金币奖励配置.有效落块数}次，可获得对局金币`,
      );
    const 表现 = Math.min(
      金币奖励配置.对局表现上限,
      Math.floor(对局.分数 / 金币奖励配置.每表现分) + 对局.消行,
    );
    const 首局 = 对局.日期 > 数据.最近首局日期 ? 金币奖励配置.每日首局 : 0;
    const 纪录 = 对局.破纪录 ? 金币奖励配置.破纪录 : 0;
    const 奖励 = 金币奖励配置.对局基础 + 表现 + 首局 + 纪录;
    return this.写入(
      数据,
      {
        ...数据,
        金币: 数据.金币 + 奖励,
        累计获得: 数据.累计获得 + 奖励,
        已结算: [...数据.已结算, 对局.编号],
        最近首局日期: 首局 ? 对局.日期 : 数据.最近首局日期,
      },
      `对局 ${金币奖励配置.对局基础 + 表现}${首局 ? ` · 今日首局 ${首局}` : ""}${纪录 ? ` · 破纪录 ${纪录}` : ""}`,
    );
  }
  private 结果(数据: 旅行存档, 成功: boolean, 原因: string, 新增 = 0): 收藏结果 {
    return { 成功, 原因, 金币: 数据.金币, 新增 };
  }
  private 写入(旧: 旅行存档, 新: 旅行存档, 原因: string): 收藏结果 {
    if (!this.存档.保存(新))
      return this.结果(旧, false, "保存失败，金币和收藏未改变。请检查浏览器存储空间。");
    return this.结果(新, true, 原因, Math.max(0, 新.金币 - 旧.金币));
  }
}

/** 支持同源多页签串行修改；每次交易重新读存档，避免使用过期余额。 */
export async function 执行收藏操作(操作: (收藏: 旅行收藏) => 收藏结果): Promise<收藏结果> {
  const 执行 = () => 操作(new 旅行收藏(localStorage));
  const 结果 = navigator.locks ? await navigator.locks.request("旅行版:收藏", 执行) : 执行();
  window.dispatchEvent(new CustomEvent("旅行版:收藏变化", { detail: 结果 }));
  return 结果;
}
