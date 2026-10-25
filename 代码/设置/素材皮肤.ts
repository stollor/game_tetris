import { 基础背景列表, 是基础背景 } from "../存档/基础背景解锁";
import { 旅行收藏 } from "../存档/旅行收藏";
import { 查找地点 } from "../框架配置/旅行地点";
import { 外观编号, 外观部位列表 } from "../项目配置/旅行皮肤";
import { 更新游戏设置, 穿戴旅行外观 } from "./游戏设置";

/** 只改当前浏览器会话里的外观，方便素材录像换皮肤。正式玩家存档不在这个会话里。 */
export function 应用素材皮肤(名称: string, 宽: number, 高: number): void {
  const 屏幕适配 = 高 > 宽 * 1.05 ? "手机竖屏" : "电脑横屏";
  if (是基础背景(名称)) {
    localStorage.setItem("旅行版:基础背景保留", JSON.stringify([...基础背景列表]));
    更新游戏设置({ 背景主题: 名称, 省电模式: "关", 背景动态: true, 屏幕适配 });
    return;
  }
  const 地点 = 查找地点(名称);
  if (!地点) throw new Error(`未知皮肤：${名称}`);
  const 当前 = new 旅行收藏(localStorage).读取();
  const 已购 = [...当前.已购];
  for (const 部位 of 外观部位列表) {
    const 编号 = 外观编号(地点.名称, 部位);
    if (!已购.includes(编号)) 已购.push(编号);
  }
  localStorage.setItem("旅行版:收藏", JSON.stringify({ 版本: 1, 数据: { ...当前, 已购 } }));
  if (!穿戴旅行外观(地点.名称, "整套")) throw new Error(`没能穿上皮肤：${名称}`);
  // 主界面看的是背景主题。穿戴只保证拥有静态背景，这里再写一次，避免被设置校验丢掉。
  更新游戏设置({ 背景主题: 地点.名称, 省电模式: "关", 背景动态: true, 屏幕适配 });
}
