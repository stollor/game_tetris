import type Phaser from "phaser";
import { 获取旅行图标 } from "../../组件/霓虹街机/图标";
import { 绘制霓虹玻璃 } from "../../组件/霓虹街机/底板";
import { 游戏外观 } from "../配置/游戏外观";

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

function 余额文字(n: number): string {
  return n >= 10000 ? `${(n / 10000).toFixed(n >= 100000 ? 0 : 1)}万` : n.toLocaleString();
}

/** 左上角金币条：半透明底板保证浅色/深色风景上都能读，避开右上角平台按钮。 */
export function 布置金币条(场景: Phaser.Scene, 选项: 金币条选项): 金币条 {
  const 文案 = 余额文字(选项.金币);
  const 高 = 34;
  const 宽 = Math.max(100, 42 + 文案.length * 9);
  const 层 = 场景.add.container(选项.x, 选项.y);
  const 底 = 场景.add.graphics();
  绘制霓虹玻璃(底, 0, 0, 宽, 高, { 透明度: 0.66, 圆角: 10 });
  层.add(底);
  层.add(场景.add.image(18, 高 / 2, 获取旅行图标(场景, "方块币")).setDisplaySize(18, 18));
  层.add(
    场景.add
      .text(34, 高 / 2, 文案, {
        fontFamily: 游戏外观.字体.家族,
        fontSize: "15px",
        fontStyle: "bold",
        color: "#ffe7a8",
        stroke: "#16303a",
        strokeThickness: 3,
      })
      .setOrigin(0, 0.5)
      .setName(选项.名称),
  );
  层.setSize(宽, 高);
  return { 层, 宽, 高 };
}
