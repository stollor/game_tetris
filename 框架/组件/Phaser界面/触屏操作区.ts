import Phaser from "phaser";
import { 界面按钮 } from "./按钮";
import { Phaser预制体配置 } from "./预制体配置";

export type 触屏操作 = "左转" | "旋转" | "右转" | "左移" | "软降" | "右移";

const 操作项: { 操作: 触屏操作; 文案: string; 名称: string }[] = [
  { 操作: "左转", 文案: "↺", 名称: "rotate-left" },
  { 操作: "旋转", 文案: "↑", 名称: "rotate" },
  { 操作: "右转", 文案: "↻", 名称: "rotate-right" },
  { 操作: "左移", 文案: "←", 名称: "left" },
  { 操作: "软降", 文案: "↓", 名称: "soft-drop" },
  { 操作: "右移", 文案: "→", 名称: "right" },
];

/** 独立的两行三列触屏操作区；输入含义由所属游戏场景绑定。 */
export class 界面触屏操作区 extends Phaser.GameObjects.Container {
  private readonly 按钮: 界面按钮[] = [];

  constructor(
    scene: Phaser.Scene,
    外观: { 面板色: string; 强调色: string; 文字色: string; 字号?: string } = {
      面板色: "#101a35",
      强调色: "#354967",
      文字色: "#e3ecfa",
      字号: "23px",
    },
  ) {
    super(scene, 0, 0);
    操作项.forEach(({ 操作, 文案, 名称 }) => {
      const 按钮 = new 界面按钮(scene, 0, 0, {
        宽: 100,
        高: 54,
        文案,
        name: `touch.${名称}`,
        面板色: 外观.面板色,
        强调色: 外观.强调色,
        文字色: 外观.文字色,
        字号: 外观.字号 ?? `${Phaser预制体配置.按钮.最小字号 + 11}px`,
        点击: () => {},
        面板透明度: Phaser预制体配置.按钮.面板透明度,
        边框透明度: Phaser预制体配置.按钮.边框透明度,
        按下: () => this.emit("control-down", 操作),
        松开: () => this.emit("control-up", 操作),
      });
      this.按钮.push(按钮);
      this.add(按钮);
    });
    this.setDepth(4);
    scene.add.existing(this);
  }

  布局(视口宽: number, 视口高: number, 竖屏: boolean): void {
    const 外观 = Phaser预制体配置.触屏操作区;
    const 显示宽 = Math.max(外观.最小宽度, 视口宽 - 外观.横向边距 * 2);
    const 间距 = 外观.列间距;
    const 按钮宽 = (显示宽 - 间距 * 2) / 3;
    const 按钮高 = 外观.按钮高度;
    const 左边 = (视口宽 - 显示宽) / 2;
    const 第二行Y = 视口高 - 外观.底部间距;
    const 第一行Y = 第二行Y - 外观.行间距;
    this.按钮.forEach((按钮, 索引) => {
      const 列 = 索引 % 3;
      const 行 = Math.floor(索引 / 3);
      const x = 左边 + 列 * (按钮宽 + 间距) + 按钮宽 / 2;
      const y = 行 === 0 ? 第一行Y : 第二行Y;
      按钮.setPosition(x, y).设置布局尺寸(按钮宽, 按钮高);
    });
    this.setVisible(竖屏);
  }
}
