import { 界面文字 } from "Phaser框架/界面/控件";
import type Phaser from "phaser";
import { 游戏外观 } from "../../代码/配置/游戏外观";
import type { 文字锚点, 文字项 } from "../../框架Three/界面/绘制/协议";

export {
  派生霓虹文字样式,
  读取霓虹文字样式,
  type 霓虹文字角色,
} from "./文字样式";

function 颜色文本(颜色: number | string): string {
  if (typeof 颜色 === "string") return 颜色;
  return `#${颜色.toString(16).padStart(6, "0")}`;
}

function 锚点原点(锚点: 文字锚点): [number, number] {
  switch (锚点) {
    case "左上":
      return [0, 0];
    case "左中":
      return [0, 0.5];
    case "中上":
      return [0.5, 0];
    case "中中":
      return [0.5, 0.5];
    case "右上":
      return [1, 0];
    case "右中":
      return [1, 0.5];
  }
}

/**
 * Phaser 后端的共享文字项渲染：把配方给出的 `文字项` 建成原生 Text。
 * 这是 Phaser 侧唯一从 文字项 到 Text 的转换点；Three 侧换由画笔.绘制文字 渲染同一份 文字项。
 */
export function 添加霓虹文字项(
  场景: Phaser.Scene,
  容器: Phaser.GameObjects.Container | undefined,
  项: 文字项,
): Phaser.GameObjects.Text {
  const 样式: Phaser.Types.GameObjects.Text.TextStyle = {
    fontFamily: 项.样式.字体 ?? 游戏外观.字体.家族,
    fontSize: `${项.样式.字号}px`,
    color: 颜色文本(项.样式.颜色),
  };
  if (项.样式.字重 === "粗体") 样式.fontStyle = "bold";
  if (项.样式.对齐 !== undefined) {
    样式.align = 项.样式.对齐 === "左" ? "left" : 项.样式.对齐 === "右" ? "right" : "center";
  }
  if (项.样式.描边 !== undefined) {
    样式.stroke = 颜色文本(项.样式.描边.颜色);
    样式.strokeThickness = 项.样式.描边.粗细;
  }
  if (项.样式.字距 !== undefined) 样式.letterSpacing = 项.样式.字距;
  if (项.最大宽 !== undefined) 样式.wordWrap = { width: 项.最大宽 };
  const 对象 = 场景.add.text(项.x, 项.y, 项.文案, 样式);
  const [原点X, 原点Y] = 锚点原点(项.锚点);
  对象.setOrigin(原点X, 原点Y);
  if (项.缩放 !== undefined || 项.缩放X !== undefined || 项.缩放Y !== undefined)
    对象.setScale(项.缩放X ?? 项.缩放 ?? 1, 项.缩放Y ?? 项.缩放 ?? 1);
  容器?.add(对象);
  return 对象;
}

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
