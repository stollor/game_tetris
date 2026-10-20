import type Phaser from "phaser";
import { 霓虹纪录页脚 } from "../../组件/霓虹街机/对局侧栏";
import type { 游戏文案 } from "../语言/类型";

export type { 霓虹纪录页脚布局 } from "../../组件/霓虹街机/对局侧栏";
export type { 霓虹侧栏几何 } from "../../组件/霓虹街机/对局侧栏配方";

/** 侧栏底部最佳纪录页脚：标签来自文案，数值由场景写入。 */
export function 创建对局纪录页脚(场景: Phaser.Scene, 文案: 游戏文案): 霓虹纪录页脚 {
  return new 霓虹纪录页脚(场景, { 标签: 文案.最佳纪录, 值: "—" });
}
