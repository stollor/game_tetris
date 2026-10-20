import type Phaser from "phaser";
import { 获取旅行图标 } from "../../组件/霓虹街机/图标";
import { 添加霓虹文字项 } from "../../组件/霓虹街机/文字";
import { 生成金币条文字项, 绘制金币条底板, 计算金币条, type 金币条布局 } from "./金币条配方";

export type { 金币条布局 } from "./金币条配方";
export {
  生成金币条文字项,
  绘制金币条,
  绘制金币条图标,
  绘制金币条底板,
  计算金币条,
} from "./金币条配方";

/**
 * Phaser 版金币条装配：几何/底板/文字项来自 `金币条配方.ts`（与 Three 共用），
 * 这里只负责容器、图标纹理与 Phaser Text 的创建。
 */

export interface 金币条选项 {
  x: number;
  y: number;
  金币: number;
  名称: string;
}

export interface 金币条 {
  层: Phaser.GameObjects.Container;
  宽: number;
  高: number;
}

/** 相对布局：Phaser 版把图形与文字放进以 (左,上) 定位的容器，其余坐标随之归一。 */
function 相对布局(布局: 金币条布局): 金币条布局 {
  return {
    ...布局,
    左: 0,
    上: 0,
    文字X: 布局.文字X - 布局.左,
    文字Y: 布局.文字Y - 布局.上,
    图标X: 布局.图标X - 布局.左,
    图标Y: 布局.图标Y - 布局.上,
  };
}

export function 布置金币条(场景: Phaser.Scene, 选项: 金币条选项): 金币条 {
  const 布局 = 计算金币条(选项.x, 选项.y, 选项.金币);
  const 相对 = 相对布局(布局);
  const 层 = 场景.add.container(选项.x, 选项.y);
  const 底 = 场景.add.graphics();
  绘制金币条底板(底, 相对);
  层.add(底);
  层.add(
    场景.add
      .image(相对.图标X, 相对.图标Y, 获取旅行图标(场景, "方块币"))
      .setDisplaySize(相对.图标尺寸, 相对.图标尺寸),
  );
  const [文字项] = 生成金币条文字项(相对, 选项.金币);
  const 文字 = 添加霓虹文字项(场景, 层, 文字项);
  文字.setName(选项.名称);
  层.setSize(布局.宽, 布局.高);
  return { 层, 宽: 布局.宽, 高: 布局.高 };
}
