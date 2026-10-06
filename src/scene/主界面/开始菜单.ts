import Phaser from "phaser";
import { type 背景主题, 获取游戏设置 } from "../../../core/设置";
import { 打开覆盖页面 } from "../../../core/页面切换";
import type { 游戏模式 } from "../../玩法/俄罗斯方块";
import { 绘制动态霓虹细节, 绘制霓虹背景 } from "../../视觉/霓虹背景";

const 模式项: { 模式: 游戏模式; 标题: string; 说明: string; 色彩: number }[] = [
  { 模式: "马拉松", 标题: "马拉松 MARATHON", 说明: "不断挑战更高等级与分数", 色彩: 0x00e5ff },
  { 模式: "冲刺", 标题: "冲刺 SPRINT", 说明: "先消满 40 行", 色彩: 0xffee58 },
  { 模式: "极限", 标题: "极限 ULTRA", 说明: "120 秒内冲击最高分", 色彩: 0xff2d9b },
  { 模式: "每日挑战", 标题: "每日挑战 DAILY", 说明: "与今天相同的固定方块序列", 色彩: 0x00e676 },
];

export class 开始菜单 extends Phaser.Scene {
  private 选择模式 = false;
  private 背景主题: 背景主题 = 获取游戏设置().背景主题;
  private 背景动画层?: Phaser.GameObjects.Graphics;
  constructor() {
    super("开始菜单");
  }

  create(): void {
    this.cameras.main.setBackgroundColor("#080B18");
    this.绘制背景();
    this.构建();
    this.scale.on("resize", this.重建, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () =>
      this.scale.off("resize", this.重建, this),
    );
  }

  update(时间: number): void {
    const 新主题 = 获取游戏设置().背景主题;
    if (新主题 !== this.背景主题) {
      this.背景主题 = 新主题;
      this.重建();
    }
    if (this.背景动画层?.active) {
      绘制动态霓虹细节(this.背景动画层, this.scale.width, this.scale.height, 时间, this.背景主题);
    }
  }

  private 绘制背景(): void {
    const 宽 = this.scale.width;
    const 高 = this.scale.height;
    this.背景主题 = 获取游戏设置().背景主题;
    const 背景 = this.add.graphics().setDepth(-2);
    绘制霓虹背景(背景, 宽, 高, this.背景主题);
    this.背景动画层 = this.add.graphics().setDepth(-1);
    绘制动态霓虹细节(this.背景动画层, 宽, 高, this.time.now, this.背景主题);
  }

  private 重建 = (): void => {
    this.children.removeAll(true);
    this.绘制背景();
    this.构建();
  };
  private 构建(): void {
    const w = this.scale.width,
      h = this.scale.height,
      c = this.add.container(w / 2, h / 2);
    c.add(
      this.add
        .text(0, -Math.min(230, h * 0.34), "NEON PULSE", {
          fontFamily: "Arial",
          fontSize: w < 520 ? "38px" : "58px",
          fontStyle: "bold",
          color: "#eaf7ff",
          letterSpacing: 7,
        })
        .setOrigin(0.5),
    );
    c.add(
      this.add
        .text(0, -Math.min(180, h * 0.26), "俄罗斯方块  ·  霓虹街机", {
          fontSize: "16px",
          color: "#8296be",
          letterSpacing: 2,
        })
        .setOrigin(0.5),
    );
    if (!this.选择模式) {
      const 启用180旋转 = localStorage.getItem("neon-pulse:rotation-180") !== "false";
      c.add(
        this.add
          .text(0, -55, "选择你的节奏", { fontSize: "21px", color: "#00e5ff", fontStyle: "bold" })
          .setOrigin(0.5),
      );
      this.按钮(
        c,
        0,
        -4,
        300,
        54,
        "开始游戏",
        "menu.start",
        () => {
          this.选择模式 = true;
          this.重建();
        },
        0x00e5ff,
      );
      this.按钮(
        c,
        0,
        62,
        300,
        46,
        "设置",
        "menu.settings",
        () => 打开覆盖页面(this, "设置界面"),
        0x7c4dff,
      );
      this.按钮(
        c,
        0,
        120,
        300,
        42,
        `180°旋转：${启用180旋转 ? "开" : "关"}`,
        "menu.rotation180",
        () => {
          localStorage.setItem("neon-pulse:rotation-180", 启用180旋转 ? "false" : "true");
          this.重建();
        },
        0x8296be,
      );
      c.add(
        this.add
          .text(0, 178, "← → 移动     ↑ / X 旋转     ↓ 软降     空格 硬降     P 暂停", {
            fontSize: w < 700 ? "11px" : "13px",
            color: "#7284a6",
          })
          .setOrigin(0.5),
      );
    } else {
      c.add(
        this.add
          .text(0, -104, "选择游戏模式", { fontSize: "21px", color: "#00e5ff", fontStyle: "bold" })
          .setOrigin(0.5),
      );
      模式项.forEach((item, i) => {
        const y = -48 + i * 70;
        this.按钮(
          c,
          0,
          y,
          Math.min(410, w - 44),
          58,
          item.标题,
          `mode.${item.模式}`,
          () => this.开始(item.模式),
          item.色彩,
        );
        c.add(
          this.add
            .text(0, y + 18, item.说明, { fontSize: "11px", color: "#8296be" })
            .setOrigin(0.5),
        );
      });
      this.按钮(
        c,
        0,
        250,
        170,
        38,
        "返回",
        "mode.back",
        () => {
          this.选择模式 = false;
          this.重建();
        },
        0x8296be,
      );
    }
  }

  private 按钮(
    c: Phaser.GameObjects.Container,
    x: number,
    y: number,
    w: number,
    h: number,
    label: string,
    name: string,
    action: () => void,
    color: number,
  ): void {
    const plate = this.add
      .rectangle(x, y, w, h, 0x101a35, 0.95)
      .setStrokeStyle(1, color, 0.75)
      .setInteractive({ useHandCursor: true })
      .setName(name);
    plate
      .on("pointerover", () => plate.setFillStyle(0x18274a, 1))
      .on("pointerout", () => plate.setFillStyle(0x101a35, 0.95))
      .on("pointerdown", action);
    const text = this.add
      .text(x, y, label, {
        fontSize: h > 45 ? "16px" : "14px",
        fontStyle: "bold",
        color: `#${color.toString(16).padStart(6, "0")}`,
      })
      .setOrigin(0.5)
      .setDepth(2);
    c.add([plate, text]);
  }

  private 开始(模式: 游戏模式): void {
    const 日期 = new Date().toISOString().slice(0, 10);
    this.scene.start("俄罗斯方块对局", { 模式, 日期 });
  }
}
