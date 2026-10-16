import { 界面文字 } from "Phaser框架/界面/控件";
import type Phaser from "phaser";
import { 游戏外观 } from "../../代码/配置/游戏外观";

export interface 霓虹文字配置 {
  颜色: string;
  字号?: number;
  粗体?: boolean;
  对齐?: "left" | "center" | "right";
  最大宽?: number;
  描边色?: string;
  描边宽?: number;
  字距?: number;
  深度?: number;
  内边距?: number;
}

function 解析对齐(对齐: 霓虹文字配置["对齐"]): "left" | "center" | "right" {
  return 对齐 ?? "center";
}

/**
 * 框架 `界面文字` 的霓虹配方：统一使用 `游戏外观.字体`，返回可参与自动布局的文字控件。
 * 需要逐字换行和固定宽度的正文用这一个。
 */
export function 创建霓虹文字(
  场景: Phaser.Scene,
  x: number,
  y: number,
  文案: string,
  配置: 霓虹文字配置 & { 宽?: number; 高?: number },
): 界面文字 {
  const 对齐 = 解析对齐(配置.对齐);
  const 控件 = new 界面文字(场景, x, y, {
    宽: 配置.宽 ?? 0,
    高: 配置.高 ?? 0,
    文案,
    字号: `${Math.max(10, Math.round(配置.字号 ?? 游戏外观.字体.正文))}px`,
    颜色: 配置.颜色,
    字体: 游戏外观.字体.家族,
    对齐: 对齐 === "left" ? "左" : "中",
    内边距: 配置.内边距 ?? 0,
  });
  if (对齐 === "right") 控件.setPosition(x - 控件.width / 2, y);
  return 控件;
}

/**
 * 原生 Phaser 文字配方，使用项目字体规格。
 * 仅在需要粗体、描边、字距或直接读取 `.text`/`.style` 的场景内文字时使用；
 * 普通正文优先用 `创建霓虹文字`，以复用框架的逐字换行。
 */
export function 添加霓虹原生文字(
  场景: Phaser.Scene,
  容器: Phaser.GameObjects.Container | undefined,
  x: number,
  y: number,
  文案: string,
  配置: 霓虹文字配置,
): Phaser.GameObjects.Text {
  // Phaser 4 的文字样式里，值为 undefined 的可选键（stroke/letterSpacing/padding/wordWrap）
  // 会让创建出的文字测得出尺寸却不参与渲染；这里按需拼装，不默认写空键。
  const 样式: Phaser.Types.GameObjects.Text.TextStyle = {
    fontFamily: 游戏外观.字体.家族,
    fontSize: `${Math.max(10, Math.round(配置.字号 ?? 游戏外观.字体.正文))}px`,
    color: 配置.颜色,
    fontStyle: 配置.粗体 ? "bold" : "normal",
    align: 解析对齐(配置.对齐),
  };
  if (配置.字距 !== undefined) 样式.letterSpacing = 配置.字距;
  if (配置.描边色 !== undefined) {
    样式.stroke = 配置.描边色;
    样式.strokeThickness = 配置.描边宽 ?? 4;
  }
  if (配置.内边距 !== undefined) {
    const 边距 = 配置.内边距;
    样式.padding = { left: 边距, right: 边距, top: 边距, bottom: 边距 };
  }
  if (配置.最大宽) 样式.wordWrap = { width: 配置.最大宽 };
  const 对象 = 场景.add.text(x, y, 文案, 样式);
  if (配置.深度 !== undefined) 对象.setDepth(配置.深度);
  容器?.add(对象);
  return 对象;
}
