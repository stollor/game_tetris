import type Phaser from "phaser";
import { 绑定滑动手势 } from "../../框架/界面/控件";
import type { 背景主题 } from "../配置/俄罗斯方块设置";
import { 游戏外观 } from "../配置/游戏外观";
import { 创建菜单按钮 } from "./按钮";
import { 风景浏览列表, 风景说明 } from "./风景浏览";

export { 地点浏览列表, 相邻风景, 风景浏览列表, 风景说明 } from "./风景浏览";

export interface 纯享层选项 {
  主题: 背景主题;
  范围?: readonly 背景主题[];
  返回名称: string;
  返回文案: string;
  返回: () => void;
  切换: (方向: -1 | 1) => void;
  动态名称?: string;
  动态?: boolean;
  切换动态?: () => void;
  过场?: boolean;
}

/** 全屏风景上的轻量操作：左右滑动切景，下滑返回；返回键在右下角。 */
export function 布置纯享层(场景: Phaser.Scene, 宽: number, 高: number, 选项: 纯享层选项): void {
  const 范围 = 选项.范围 ?? 风景浏览列表();
  const 说明 = 风景说明(选项.主题);
  const 手势 = 场景.add.rectangle(宽 / 2, 高 / 2, 宽, 高, 0, 0.001).setInteractive();
  绑定滑动手势(手势, {
    左滑: () => 选项.切换(1),
    右滑: () => 选项.切换(-1),
    下滑: 选项.返回,
  });
  const 返宽 = Math.min(132, Math.max(96, 宽 * 0.24));
  const 返回 = 创建菜单按钮(场景, {
    x: 宽 - 返宽 / 2 - 16,
    y: 高 - 36,
    宽: 返宽,
    高: 38,
    文案: 选项.返回文案,
    名称: 选项.返回名称,
    点击: 选项.返回,
    字号: "15px",
    覆盖: {
      样式: "文字",
      描边色: "#16303a",
      描边宽度: 4,
    },
  });
  if (选项.过场) {
    返回.y = 高 + 48;
    场景.tweens.add({ targets: 返回, y: 高 - 36, duration: 280, ease: "Cubic.easeOut" });
  }
  if (选项.切换动态)
    创建菜单按钮(场景, {
      x: 宽 - 78,
      y: 32,
      宽: 120,
      高: 36,
      文案: 选项.动态 ? "动态 · 开" : "动态 · 关",
      名称: 选项.动态名称 ?? "shop.preview.motion",
      点击: 选项.切换动态,
      字号: "13px",
      覆盖: { 样式: "文字", 描边色: "#16303a", 描边宽度: 4 },
    });
  场景.add
    .text(24, 高 - 78, 说明.标题, {
      fontFamily: 游戏外观.字体.家族,
      fontSize: "28px",
      fontStyle: "bold",
      color: "#fff8e7",
      stroke: "#16303a",
      strokeThickness: 4,
    })
    .setName("scenery.title");
  场景.add
    .text(25, 高 - 42, 说明.副题, {
      fontFamily: 游戏外观.字体.家族,
      fontSize: "13px",
      color: "#fff4d9",
      stroke: "#16303a",
      strokeThickness: 3,
    })
    .setName("scenery.caption");
  const 点 = 场景.add.graphics();
  const 总数 = 范围.length,
    当前 = Math.max(0, 范围.indexOf(选项.主题)),
    点宽 = Math.min(14, 360 / 总数);
  范围.forEach((_, i) => {
    点
      .fillStyle(0xfff6d8, i === 当前 ? 0.95 : 0.28)
      .fillCircle(宽 / 2 - ((总数 - 1) * 点宽) / 2 + i * 点宽, 高 - 16, i === 当前 ? 3.5 : 2.2);
  });
}
