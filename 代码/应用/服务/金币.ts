import { 收藏 } from "../../存档/收藏";
import type { 金币服务 } from "../接口/服务";

/** 金币/主题所有权：每次操作都用同一份版本化存档重新读取，失败不清空原数据。 */
export function 创建金币服务(存储: Storage = localStorage): 金币服务 {
  const 订阅者 = new Set<() => void>();
  const 通知 = () => {
    for (const 回调 of 订阅者) 回调();
  };
  const 读收藏 = () => new 收藏(存储);
  return {
    读取: () => 读收藏().读取(),
    增加: (数量) => {
      const 结果 = 读收藏().增加测试金币(数量);
      通知();
      return 结果;
    },
    购买主题: (主题) => {
      const 结果 = 读收藏().购买主题(主题);
      通知();
      return 结果;
    },
    领取成就: (已解锁) => {
      const 结果 = 读收藏().领取成就(已解锁);
      通知();
      return 结果;
    },
    结算对局: (输入) => {
      const 结果 = 读收藏().结算对局(输入);
      通知();
      return 结果;
    },
    订阅: (回调) => {
      订阅者.add(回调);
      return () => {
        订阅者.delete(回调);
      };
    },
  };
}
