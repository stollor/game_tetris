import Phaser from "phaser";
import { 应用文字清晰度 } from "../../../core/文字清晰度";
import { 播放程序音效, 解锁程序音频, 设置程序音乐场景 } from "../../../core/程序音频";
import { 绘制玻璃按钮 } from "../../../core/组件/Phaser界面/玻璃绘制";
import { type 游戏设置, type 背景主题, 获取游戏设置 } from "../../../core/设置";
import { 打开覆盖页面 } from "../../../core/页面切换";
import type { 游戏模式 } from "../../玩法/俄罗斯方块";
import { 应用背景文字样式, 背景文字配色 } from "../../视觉/文字可读性";
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
    应用文字清晰度(this);
    设置程序音乐场景("菜单");
    this.input.on("pointerdown", 解锁程序音频);
    // 场景实例会在对局结束后复用；每次进入菜单都从首屏开始。
    this.选择模式 = false;
    this.cameras.main.setBackgroundColor("#080B18");
    this.绘制背景();
    this.构建();
    this.scale.on("resize", this.重建, this);
    window.addEventListener("gamemaker:settings-change", this.设置已更新);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off("resize", this.重建, this);
      window.removeEventListener("gamemaker:settings-change", this.设置已更新);
    });
  }

  private 设置已更新 = (事件: Event): void => {
    const 设置 = (事件 as CustomEvent<游戏设置>).detail;
    if (设置.背景主题 === this.背景主题) return;
    this.背景主题 = 设置.背景主题;
    this.重建();
  };

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
    const 文字配色 = 背景文字配色(this.背景主题);
    const 标题字号 = w < 520 ? 38 : 58;
    const 标题文本 = this.add
      .text(0, -Math.min(230, h * 0.34), "NEON PULSE", {
        fontFamily: "Arial",
        fontSize: `${标题字号}px`,
        fontStyle: "bold",
        color: 文字配色.主字,
        letterSpacing: 7,
      })
      .setOrigin(0.5);
    应用背景文字样式(标题文本, this.背景主题, 标题字号);
    c.add(标题文本);
    const 副标题文本 = this.add
      .text(0, -Math.min(180, h * 0.26), "俄罗斯方块  ·  霓虹街机", {
        fontSize: "16px",
        color: 文字配色.次字,
        letterSpacing: 2,
      })
      .setOrigin(0.5);
    c.add(副标题文本);
    if (!this.选择模式) {
      const 标语文本 = this.add
        .text(0, -55, "选择你的节奏", { fontSize: "21px", color: 文字配色.强调, fontStyle: "bold" })
        .setOrigin(0.5);
      c.add(标语文本);
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
    } else {
      const 模式标语文本 = this.add
        .text(0, -104, "选择游戏模式", {
          fontSize: "21px",
          color: 文字配色.强调,
          fontStyle: "bold",
        })
        .setOrigin(0.5);
      c.add(模式标语文本);
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
            .text(0, y + 18, item.说明, { fontSize: "11px", color: "#A9BDD8" })
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
    const 视觉 = this.add.graphics();
    const 绘制底板 = (悬停: boolean) => {
      视觉.clear();
      绘制玻璃按钮(视觉, x, y, w, h, {
        圆角: 12,
        填色: 悬停 ? 0x18274a : 0x101a35,
        强调色: color,
        透明度: 悬停 ? 1 : 0.95,
        边透明度: 0.75,
        悬停,
      });
    };
    绘制底板(false);
    const plate = this.add
      .rectangle(x, y, w, h, 0x000000, 0.001)
      .setInteractive({ useHandCursor: true })
      .setName(name);
    plate
      .on("pointerover", () => 绘制底板(true))
      .on("pointerout", () => 绘制底板(false))
      .on("pointerdown", () => {
        解锁程序音频();
        播放程序音效("开始");
        action();
      });
    // 紫色文字在深色底板上对比不足，换亮薰衣草白保可读
    const 文字色值 = color === 0x7c4dff ? 0xe9e2ff : color;
    const text = this.add
      .text(x, y, label, {
        fontSize: h > 45 ? "16px" : "14px",
        fontStyle: "bold",
        color: `#${文字色值.toString(16).padStart(6, "0")}`,
      })
      .setOrigin(0.5)
      .setDepth(2);
    c.add([视觉, plate, text]);
  }

  private 开始(模式: 游戏模式): void {
    const 日期 = new Date().toISOString().slice(0, 10);
    设置程序音乐场景("对局");
    this.scene.start("俄罗斯方块对局", { 模式, 日期 });
  }
}
