import type Phaser from "phaser";
import { 绑定滑动手势 } from "../../框架/界面/控件";
import type { 背景主题 } from "../配置/再消一行设置";
import { 游戏外观 } from "../配置/游戏外观";
import { 创建菜单按钮 } from "./按钮";
import { 风景浏览列表, 风景说明 } from "./风景浏览";

export {
  地点浏览列表,
  已解锁风景列表,
  相邻已解锁风景,
  相邻风景,
  风景已解锁,
  风景浏览列表,
  风景说明,
} from "./风景浏览";

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

/** 半透明胶囊底板：暗底+浅描边，亮暗风景上都够清楚，又不抢戏。 */
function 绘制纯享胶囊(
  图形: Phaser.GameObjects.Graphics,
  宽: number,
  高: number,
  状态: { 已选: boolean; 悬停: boolean; 按下: boolean; 可用: boolean },
): void {
  const r = 高 / 2;
  const 加压 = 状态.按下 ? 0.06 : 状态.悬停 ? 0.03 : 0;
  // 轻阴影（偏下）提高亮景对比
  图形.fillStyle(0x000000, 0.22 + 加压);
  图形.fillRoundedRect(-宽 / 2 + 1, -高 / 2 + 2, 宽, 高, r);
  // 半透明深色胶囊
  图形.fillStyle(0x101820, 0.7 + 加压);
  图形.fillRoundedRect(-宽 / 2, -高 / 2, 宽, 高, r);
  // 浅描边：暗景可见轮廓，亮景也不糊
  图形.lineStyle(1.5, 0xfff6e8, 0.55 + 加压);
  图形.strokeRoundedRect(-宽 / 2 + 0.5, -高 / 2 + 0.5, 宽 - 1, 高 - 1, r);
  // 内侧细线增加层次
  图形.lineStyle(1, 0xffffff, 0.12);
  图形.strokeRoundedRect(-宽 / 2 + 2.5, -高 / 2 + 2.5, 宽 - 5, 高 - 5, Math.max(4, r - 2));
}

/** 全屏风景上的轻量操作：左右滑动切景，下滑返回；返回键固定右下角。 */
export function 布置纯享层(场景: Phaser.Scene, 宽: number, 高: number, 选项: 纯享层选项): void {
  const 范围 = 选项.范围 ?? 风景浏览列表();
  const 说明 = 风景说明(选项.主题);
  const 手势 = 场景.add.rectangle(宽 / 2, 高 / 2, 宽, 高, 0, 0.001).setInteractive();
  绑定滑动手势(手势, {
    左滑: () => 选项.切换(1),
    右滑: () => 选项.切换(-1),
    下滑: 选项.返回,
  });
  const 返宽 = Math.min(132, Math.max(100, 宽 * 0.24));
  const 返高 = 40;
  const 返x = 宽 - 返宽 / 2 - 16;
  const 返y = 高 - 40;
  const 返回 = 创建菜单按钮(场景, {
    x: 返x,
    y: 返y,
    宽: 返宽,
    高: 返高,
    文案: 选项.返回文案,
    名称: 选项.返回名称,
    点击: 选项.返回,
    字号: "15px",
    覆盖: {
      绘制底板: 绘制纯享胶囊,
      面板色: "#101820",
      强调色: "#101820",
      文字色: "#fff8e7",
      描边色: "#0c141c",
      描边宽度: 3,
      面板透明度: 0,
      边框透明度: 0,
    },
  });
  if (选项.过场) {
    返回.y = 高 + 48;
    场景.tweens.add({ targets: 返回, y: 返y, duration: 280, ease: "Cubic.easeOut" });
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
      覆盖: {
        绘制底板: 绘制纯享胶囊,
        面板色: "#101820",
        强调色: "#101820",
        文字色: "#fff8e7",
        描边色: "#0c141c",
        描边宽度: 3,
        面板透明度: 0,
        边框透明度: 0,
      },
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
  const 总数 = Math.max(1, 范围.length);
  const 当前 = Math.max(0, 范围.indexOf(选项.主题));
  const 点宽 = Math.min(14, 360 / 总数);
  范围.forEach((_, i) => {
    点
      .fillStyle(0xfff6d8, i === 当前 ? 0.95 : 0.28)
      .fillCircle(宽 / 2 - ((总数 - 1) * 点宽) / 2 + i * 点宽, 高 - 16, i === 当前 ? 3.5 : 2.2);
  });
}
