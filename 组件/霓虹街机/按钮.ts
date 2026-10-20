import { type 按钮配置, 界面按钮 } from "Phaser框架/界面/按钮";
import type Phaser from "phaser";
import { 游戏外观 } from "../../代码/配置/游戏外观";
import { 读取霓虹按钮配色, type 霓虹按钮变体 } from "./按钮配方";
import { 读取霓虹调色板 } from "./调色板";

export type { 霓虹按钮变体 } from "./按钮配方";

export interface 霓虹按钮参数 {
  x: number;
  y: number;
  宽: number;
  高: number;
  文案: string;
  名称: string;
  点击: () => void;
  变体?: 霓虹按钮变体;
  字号?: string;
  已选?: boolean;
  可用?: boolean;
  图标?: string;
  图标尺寸?: number;
  容器?: Phaser.GameObjects.Container;
  /** 变体覆盖不到的个别差异，例如按下回调或临时强调色。 */
  覆盖?: Partial<按钮配置>;
}

/**
 * 霓虹街机按钮配方：颜色取自 `调色板.ts` 的按钮变体，命中与手势仍用框架通用按钮。
 *
 * Phaser 侧继续使用框架 `绘制玻璃按钮` 的九宫格烘焙底板（这是 Phaser 画面的视觉真相，也是
 * 代码/性能/图形烘焙.ts 认得的贴图路径）；共享的 `绘制霓虹按钮` 供 Three 版与预览消费，
 * 两者算法同源。Three 版无需经过 Phaser 的图形烘焙，因此不存在二次烘焙偏差。
 */
export function 创建霓虹按钮(场景: Phaser.Scene, 参数: 霓虹按钮参数): 界面按钮 {
  const 调色板 = 读取霓虹调色板();
  const 变体 = 参数.变体 ?? "次要";
  const 按钮配色 = 读取霓虹按钮配色(变体);
  const 按钮 = new 界面按钮(场景, 参数.x, 参数.y, {
    宽: Math.max(24, 参数.宽),
    高: Math.max(24, 参数.高),
    文案: 参数.文案,
    name: 参数.名称,
    点击: 参数.点击,
    面板色: 按钮配色.面板,
    边框色: 按钮配色.边框,
    强调色: 按钮配色.边框,
    文字色: 按钮配色.文字,
    面板透明度: 调色板.按钮面板透明度,
    边框透明度: 调色板.按钮边框透明度,
    采用传入配色: true,
    文字色跟随底色: true,
    已选: 参数.已选 ?? false,
    图标: 参数.图标,
    图标尺寸: 参数.图标尺寸,
    字号: 参数.字号 ?? `${游戏外观.字体.按钮}px`,
    按下: () => {
      场景.tweens.killTweensOf(按钮);
      场景.tweens.add({
        targets: 按钮,
        scaleX: 0.975,
        scaleY: 0.96,
        duration: 65,
        ease: "Quad.easeOut",
      });
    },
    松开: () => {
      场景.tweens.killTweensOf(按钮);
      场景.tweens.add({ targets: 按钮, scaleX: 1, scaleY: 1, duration: 170, ease: "Back.easeOut" });
    },
    ...参数.覆盖,
  });
  if (参数.可用 === false) 按钮.设置可用(false);
  参数.容器?.add(按钮);
  return 按钮;
}
