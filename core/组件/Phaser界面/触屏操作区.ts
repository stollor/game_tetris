import Phaser from "phaser";

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
  private readonly 按钮: Phaser.GameObjects.Rectangle[] = [];
  private readonly 标题: Phaser.GameObjects.Text[] = [];

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0);
    操作项.forEach(({ 操作, 文案, 名称 }) => {
      const 背景 = scene.add
        .rectangle(0, 0, 100, 54, 0x101a35, 0.98)
        .setStrokeStyle(1, 操作 === "软降" ? 0x65e6dc : 0x354967, 0.92)
        .setInteractive({ useHandCursor: true })
        .setName(`touch.${名称}`);
      const 标签 = scene.add
        .text(0, 0, 文案, {
          fontFamily: "sans-serif",
          fontSize: 操作 === "软降" ? "22px" : "23px",
          fontStyle: "bold",
          color: 操作 === "软降" ? "#65e6dc" : "#e3ecfa",
        })
        .setOrigin(0.5);
      背景.on("pointerdown", () => this.emit("control-down", 操作));
      const 松开 = (): void => {
        this.emit("control-up", 操作);
      };
      背景.on("pointerup", 松开).on("pointerupoutside", 松开).on("pointerout", 松开);
      this.按钮.push(背景);
      this.标题.push(标签);
      this.add([背景, 标签]);
    });
    this.setDepth(4);
    scene.add.existing(this);
  }

  布局(视口宽: number, 视口高: number, 竖屏: boolean): void {
    const 显示宽 = Math.max(100, 视口宽 - 32);
    const 间距 = 10;
    const 按钮宽 = (显示宽 - 间距 * 2) / 3;
    const 按钮高 = 54;
    const 左边 = (视口宽 - 显示宽) / 2;
    const 第一行Y = 视口高 - 124;
    const 第二行Y = 视口高 - 60;
    this.按钮.forEach((按钮, 索引) => {
      const 列 = 索引 % 3;
      const 行 = Math.floor(索引 / 3);
      const x = 左边 + 列 * (按钮宽 + 间距) + 按钮宽 / 2;
      const y = 行 === 0 ? 第一行Y : 第二行Y;
      按钮.setPosition(x, y).setSize(按钮宽, 按钮高);
      if (按钮.input) {
        按钮.input.hitArea = new Phaser.Geom.Rectangle(-按钮宽 / 2, -按钮高 / 2, 按钮宽, 按钮高);
      }
      this.标题[索引]?.setPosition(x, y);
    });
    this.setVisible(竖屏);
  }
}
