import type Phaser from "phaser";
import { 绑定滑动手势 } from "../../框架/界面/控件";
import { 计算主界面布局, 计算纯享圆点 } from "../../组件/霓虹街机/主界面布局";
import { 添加霓虹文字项 } from "../../组件/霓虹街机/文字";
import { 读取霓虹文字样式 } from "../../组件/霓虹街机/文字样式";
import type { 背景主题 } from "../配置/再消一行设置";
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
  const 布局 = 计算主界面布局(宽, 高, "纯享");
  const 纯享 = 布局.纯享;
  if (!纯享) return;
  const 范围 = 选项.范围 ?? 风景浏览列表();
  const 说明 = 风景说明(选项.主题);
  const 手势 = 场景.add.rectangle(宽 / 2, 高 / 2, 宽, 高, 0, 0.001).setInteractive();
  绑定滑动手势(手势, {
    左滑: () => 选项.切换(1),
    右滑: () => 选项.切换(-1),
    下滑: 选项.返回,
  });
  const 返回 = 创建菜单按钮(场景, {
    x: 纯享.返回钮.中心X,
    y: 纯享.返回钮.中心Y,
    宽: 纯享.返回钮.宽,
    高: 纯享.返回钮.高,
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
    场景.tweens.add({ targets: 返回, y: 纯享.返回钮.中心Y, duration: 280, ease: "Cubic.easeOut" });
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
  添加霓虹文字项(场景, undefined, {
    文案: 说明.标题,
    样式: 读取霓虹文字样式("风景标题"),
    锚点: "左上",
    x: 纯享.标题.x,
    y: 纯享.标题.y,
  }).setName("scenery.title");
  添加霓虹文字项(场景, undefined, {
    文案: 说明.副题,
    样式: 读取霓虹文字样式("风景说明"),
    锚点: "左上",
    x: 纯享.说明.x,
    y: 纯享.说明.y,
  }).setName("scenery.caption");
  const 点 = 场景.add.graphics();
  const 当前 = Math.max(0, 范围.indexOf(选项.主题));
  for (const [i, 圆点] of 计算纯享圆点(布局, 范围.length, 当前).entries()) {
    点.fillStyle(0xfff6d8, i === 当前 ? 0.95 : 0.28).fillCircle(圆点.x, 圆点.y, 圆点.半径);
  }
}
