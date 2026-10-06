import Phaser from "phaser";
import { 界面下拉菜单 } from "../../../core/组件/Phaser界面/下拉菜单";
import { 计算响应式视口 } from "../../../core/组件/Phaser界面/响应式视口";
import { 界面音量控制 } from "../../../core/组件/Phaser界面/音量控制";
import {
  type 屏幕适配选择,
  更新游戏设置,
  type 背景主题,
  获取游戏设置,
  type 语言选择,
} from "../../../core/设置";
import { 绘制动态霓虹细节, 绘制霓虹背景, 背景主题选项 } from "../../视觉/霓虹背景";

type 页面 = "首页" | "模式" | "对局" | "暂停" | "设置" | "结算" | "退出";
type 平台预览 = 屏幕适配选择;
type 模式 = "马拉松" | "冲刺" | "极限" | "每日挑战";

interface 画布布局 {
  手机: boolean;
  比例: number;
  左: number;
  顶: number;
  宽: number;
  高: number;
  映射Y: (y: number) => number;
}

const 色彩 = {
  底色: 0x0a0e1d,
  面板: 0x121a2c,
  浮层: 0x18243a,
  线: 0x31435d,
  主字: "#F3F6FC",
  次字: "#9BAAC1",
  暗字: "#6F819B",
  青: 0x65e6dc,
  紫: 0xa990ff,
  黄: 0xf4cd75,
  红: 0xff7f9c,
  绿: 0x85dfa9,
};

const 方块色 = [0x65e6dc, 0xf4cd75, 0xa990ff, 0x85dfa9, 0xff7f9c, 0x82a8ff, 0xffad72];

export class 界面原型 extends Phaser.Scene {
  private 页面: 页面 = "首页";
  private 平台: 平台预览 = 获取游戏设置().屏幕适配;
  private 模式: 模式 = "马拉松";
  private 方块X = 3;
  private 方块旋转 = 0;
  private 演示分数 = 1240;
  private 演示消行 = 8;
  private 计时展示 = "02:48";
  private 语言: 语言选择 = 获取游戏设置().语言;
  private 背景主题: 背景主题 = 获取游戏设置().背景主题;
  private 布局!: 画布布局;
  private 背景动画层?: Phaser.GameObjects.Graphics;

  constructor() {
    super("界面原型");
  }

  create(): void {
    this.重绘();
    this.scale.on("resize", this.重绘, this);
    window.addEventListener("keydown", this.处理键盘);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off("resize", this.重绘, this);
      window.removeEventListener("keydown", this.处理键盘);
    });
  }

  update(时间: number): void {
    const 新主题 = 获取游戏设置().背景主题;
    if (新主题 !== this.背景主题) {
      this.背景主题 = 新主题;
      this.重绘();
    }
    if (this.背景动画层?.active) {
      绘制动态霓虹细节(this.背景动画层, this.scale.width, this.scale.height, 时间, this.背景主题);
    }
  }

  private 重绘 = (): void => {
    this.children.removeAll(true);
    this.背景动画层 = undefined;
    this.计算布局();
    this.绘制背景();
    if (this.页面 === "设置" || this.页面 === "暂停") this.创建弹层输入遮罩();
    if (this.页面 === "首页") this.绘制首页();
    if (this.页面 === "模式") this.绘制模式选择();
    if (this.页面 === "对局") this.绘制对局();
    if (this.页面 === "暂停") this.绘制对局(true);
    if (this.页面 === "设置") this.绘制设置();
    if (this.页面 === "结算") this.绘制结算();
    if (this.页面 === "退出") this.绘制退出();
  };

  private 计算布局(): void {
    const 窗口宽 = this.scale.width;
    const 窗口高 = this.scale.height;
    const 竖屏 = 窗口高 > 窗口宽 * 1.04;
    const 手机 = this.平台 === "手机竖屏" || (this.平台 === "自动" && 竖屏);
    const 适配 = 计算响应式视口({
      视口宽: 窗口宽,
      视口高: 窗口高,
      基准宽: 手机 ? 430 : 1440,
      基准高: 900,
      固定轴: 手机 ? "宽度" : "高度",
      顶栏高: 手机 ? 156 : 102,
      底栏起点: 手机 ? 704 : 822,
      中区最小高: 手机 ? 350 : 560,
    });
    this.布局 = {
      手机,
      比例: 适配.比例,
      左: 适配.左,
      顶: 适配.顶,
      宽: 手机 ? 430 : 适配.设计宽,
      高: 适配.设计高,
      映射Y: 适配.映射Y,
    };
  }

  private px(值: number): number {
    return 值 * this.布局.比例;
  }

  private X(值: number): number {
    const 桌面内容偏移 = this.布局.手机 ? 0 : (this.布局.宽 - 1440) / 2;
    return this.布局.左 + this.px(值 + 桌面内容偏移);
  }

  private Y(值: number): number {
    return this.布局.映射Y(值);
  }

  private 绘制背景(): void {
    this.背景主题 = 获取游戏设置().背景主题;
    const 背景 = this.add.graphics().setDepth(-10);
    绘制霓虹背景(背景, this.scale.width, this.scale.height, this.背景主题);
    const 暗幕 = this.add.graphics().setDepth(-9);
    暗幕
      .fillStyle(色彩.底色, this.页面 === "设置" || this.页面 === "暂停" ? 0.2 : 0.08)
      .fillRect(0, 0, this.scale.width, this.scale.height);
    const 柔光 = this.add.graphics().setDepth(-8);
    柔光
      .fillStyle(色彩.青, 0.035)
      .fillCircle(this.scale.width * 0.16, this.scale.height * 0.18, this.scale.width * 0.25);
    柔光
      .fillStyle(色彩.紫, 0.045)
      .fillCircle(this.scale.width * 0.84, this.scale.height * 0.78, this.scale.width * 0.3);
    this.背景动画层 = this.add.graphics().setDepth(-7);
    绘制动态霓虹细节(
      this.背景动画层,
      this.scale.width,
      this.scale.height,
      this.time.now,
      this.背景主题,
    );
  }

  private 方框(
    x: number,
    y: number,
    宽: number,
    高: number,
    填色 = 色彩.面板,
    边色 = 色彩.线,
    圆角 = 18,
    透明度 = 0.94,
  ): Phaser.GameObjects.Graphics {
    const 图形 = this.add.graphics();
    图形
      .fillStyle(填色, 透明度)
      .fillRoundedRect(this.X(x), this.Y(y), this.px(宽), this.px(高), this.px(圆角));
    if (边色 !== -1) {
      图形
        .lineStyle(Math.max(1, this.px(1)), 边色, 0.75)
        .strokeRoundedRect(this.X(x), this.Y(y), this.px(宽), this.px(高), this.px(圆角));
    }
    return 图形;
  }

  private 文字(
    x: number,
    y: number,
    文案: string,
    字号: number,
    颜色: string | number = 色彩.主字,
    对齐X = 0,
    对齐Y = 0.5,
    加粗 = false,
  ): Phaser.GameObjects.Text {
    const 文本 = this.add.text(this.X(x), this.Y(y), 文案, {
      fontFamily: '"Segoe UI", "Microsoft YaHei", sans-serif',
      fontSize: `${Math.max(10, Math.round(this.px(字号)))}px`,
      fontStyle: 加粗 ? "bold" : "normal",
      color: typeof 颜色 === "number" ? `#${颜色.toString(16).padStart(6, "0")}` : 颜色,
      resolution: 2,
    });
    return 文本.setOrigin(对齐X, 对齐Y);
  }

  private 按钮(
    x: number,
    y: number,
    宽: number,
    高: number,
    文案: string,
    名称: string,
    点击: () => void,
    选项: { 主按钮?: boolean; 次要?: boolean; 字号?: number; 左对齐?: boolean; 深度?: number } = {},
  ): void {
    const 填色 = 选项.主按钮 ? 色彩.青 : 选项.次要 ? 色彩.浮层 : 色彩.面板;
    const 字色 = 选项.主按钮 ? "#081721" : 选项.次要 ? 色彩.主字 : 色彩.次字;
    const 按钮 = this.add
      .rectangle(
        this.X(x + 宽 / 2),
        this.Y(y + 高 / 2),
        this.px(宽),
        this.px(高),
        填色,
        选项.主按钮 ? 1 : 0.92,
      )
      .setStrokeStyle(
        Math.max(1, this.px(1)),
        选项.主按钮 ? 色彩.青 : 色彩.线,
        选项.主按钮 ? 0.2 : 0.8,
      )
      .setInteractive({ useHandCursor: true })
      .setName(名称)
      .setDepth(选项.深度 ?? 0)
      .on("pointerover", () => 按钮.setFillStyle(选项.主按钮 ? 0x91fff2 : 0x22324d, 1))
      .on("pointerout", () => 按钮.setFillStyle(填色, 选项.主按钮 ? 1 : 0.92))
      .on("pointerdown", 点击);
    this.文字(
      选项.左对齐 ? x + 20 : x + 宽 / 2,
      y + 高 / 2,
      文案,
      选项.字号 ?? 16,
      字色,
      选项.左对齐 ? 0 : 0.5,
      0.5,
      true,
    ).setDepth((选项.深度 ?? 0) + 1);
  }

  private 小标题(
    x: number,
    y: number,
    文案: string,
    颜色: string | number = 色彩.次字,
    对齐X = 0,
  ): void {
    this.文字(x, y, 文案, 12, 颜色, 对齐X, 0.5, true);
  }

  private 标签(x: number, y: number, 文案: string, 强调: string | number = 色彩.次字): void {
    this.方框(x, y, 116, 34, 色彩.浮层, -1, 17, 0.88);
    this.文字(x + 58, y + 17, 文案, 12, 强调, 0.5, 0.5, true);
  }

  private 显示页面(页面: 页面): void {
    this.页面 = 页面;
    this.重绘();
  }

  private 创建弹层输入遮罩(): void {
    this.add
      .rectangle(
        this.scale.width / 2,
        this.scale.height / 2,
        this.scale.width,
        this.scale.height,
        0x000000,
        0.001,
      )
      .setInteractive()
      .setDepth(this.页面 === "暂停" ? 19 : -6)
      .on(
        "pointerdown",
        (
          _pointer: Phaser.Input.Pointer,
          _x: number,
          _y: number,
          事件: Phaser.Types.Input.EventData,
        ) => 事件.stopPropagation(),
      );
  }

  private 绘制首页(): void {
    if (this.布局.手机) this.绘制手机首页();
    else this.绘制电脑首页();
  }

  private 绘制手机首页(): void {
    const 中心Y = 405;
    this.文字(215, 中心Y - 138, "NEON", 46, "#173b53", 0.5, 0.5, true);
    this.文字(215, 中心Y - 84, "PULSE", 46, "#087f83", 0.5, 0.5, true);
    this.按钮(38, 中心Y - 20, 354, 62, "开始游戏", "home.start", () => this.显示页面("模式"), {
      主按钮: true,
      字号: 18,
    });
    this.按钮(38, 中心Y + 57, 354, 54, "设置与操作", "home.settings", () => this.显示页面("设置"), {
      字号: 14,
    });
    this.按钮(38, 中心Y + 125, 354, 54, "退出", "home.exit", () => this.显示页面("退出"), {
      字号: 14,
    });
  }

  private 绘制电脑首页(): void {
    this.文字(720, 260, "NEON", 82, "#173b53", 0.5, 0.5, true);
    this.文字(720, 352, "PULSE", 82, "#087f83", 0.5, 0.5, true);
    this.按钮(565, 452, 310, 66, "开始游戏", "home.start", () => this.显示页面("模式"), {
      主按钮: true,
      字号: 17,
    });
    this.按钮(565, 536, 150, 52, "设置与操作", "home.settings", () => this.显示页面("设置"), {
      字号: 13,
    });
    this.按钮(725, 536, 150, 52, "退出", "home.exit", () => this.显示页面("退出"), {
      字号: 13,
    });
  }

  private 绘制模式选择(): void {
    this.顶部返回("返回首页", () => this.显示页面("首页"));
    this.文字(
      this.布局.手机 ? 24 : 84,
      this.布局.手机 ? 118 : 150,
      "选择游戏模式",
      this.布局.手机 ? 29 : 40,
      "#173b53",
      0,
      0.5,
      true,
    );
    this.文字(
      this.布局.手机 ? 24 : 86,
      this.布局.手机 ? 153 : 190,
      "每种节奏，都有自己的目标。",
      this.布局.手机 ? 13 : 15,
      "#465b70",
    );
    const 模式项: { 模式: 模式; 说明: string; 细节: string; 色彩: number }[] = [
      { 模式: "马拉松", 说明: "不断挑战更高等级与分数", 细节: "无时间限制", 色彩: 色彩.青 },
      { 模式: "冲刺", 说明: "率先消除 40 行", 细节: "目标 40 行", 色彩: 色彩.黄 },
      { 模式: "极限", 说明: "120 秒内冲击最高分", 细节: "限时 02:00", 色彩: 色彩.红 },
      { 模式: "每日挑战", 说明: "今天，每个人面对相同序列", 细节: "每日更新", 色彩: 色彩.绿 },
    ];
    if (this.布局.手机) {
      模式项.forEach((项, 索引) => {
        const y = 202 + 索引 * 113;
        this.模式卡片(
          24,
          y,
          382,
          92,
          项.模式,
          项.说明,
          项.色彩,
          () => this.开始演示(项.模式),
          项.细节,
        );
      });
      this.文字(215, 735, "所有模式都可以随时暂停。", 11, 色彩.暗字, 0.5, 0.5);
      return;
    }
    模式项.forEach((项, 索引) => {
      const x = 索引 % 2 === 0 ? 110 : 750;
      const y = 270 + Math.floor(索引 / 2) * 220;
      this.模式卡片(
        x,
        y,
        580,
        174,
        项.模式,
        项.说明,
        项.色彩,
        () => this.开始演示(项.模式),
        项.细节,
      );
    });
  }

  private 绘制对局(显示暂停 = false): void {
    if (this.布局.手机) this.绘制手机对局();
    else this.绘制电脑对局();
    if (显示暂停) this.绘制暂停卡片();
  }

  private 绘制手机对局(): void {
    this.顶部返回("离开", () => this.显示页面("首页"));
    this.文字(215, 50, this.模式, 18, 色彩.主字, 0.5, 0.5, true);
    this.按钮(334, 30, 72, 40, "暂停", "game.pause", () => this.显示页面("暂停"), {
      字号: 12,
    });
    this.小标题(24, 104, "等级");
    this.文字(24, 132, "04", 23, 色彩.黄, 0, 0.5, true);
    this.小标题(215, 104, "本局分数", 色彩.次字, 0.5);
    this.文字(215, 132, String(this.演示分数).padStart(6, "0"), 23, 色彩.主字, 0.5, 0.5, true);
    this.小标题(406, 104, "消行", 色彩.次字, 1);
    this.文字(406, 132, String(this.演示消行).padStart(2, "0"), 23, 色彩.青, 1, 0.5, true);

    this.绘制迷你棋盘(14, 174, 25, 10, 20, true);
    this.方框(286, 174, 128, 240, 0x1b2942, 0x536987, 16, 1);
    this.小标题(300, 195, "后续方块", 色彩.青);
    const 预览 = [
      {
        格点: [
          [0, 1],
          [1, 1],
          [2, 1],
          [1, 0],
        ],
        色值: 方块色[2],
      },
      {
        格点: [
          [0, 0],
          [0, 1],
          [0, 2],
          [1, 2],
        ],
        色值: 方块色[6],
      },
      {
        格点: [
          [0, 0],
          [1, 0],
          [0, 1],
          [1, 1],
        ],
        色值: 方块色[1],
      },
    ];
    预览.forEach((方块, 索引) => {
      const y = 212 + 索引 * 62;
      this.方框(296, y, 108, 54, 0x263650, -1, 10, 0.96);
      this.文字(307, y + 27, `0${索引 + 1}`, 10, 色彩.暗字, 0, 0.5, true);
      this.绘制小方块组(330, y + 9, 11, 方块.格点, 方块.色值);
    });
    this.方框(286, 426, 128, 112, 0x1b2942, 0x536987, 16, 1);
    this.小标题(300, 448, "最佳纪录", 色彩.次字);
    this.文字(300, 478, "28,460", 17, 色彩.主字, 0, 0.5, true);
    this.文字(300, 510, "今日排名  #12", 10, 色彩.次字);

    this.触控按钮(24, 704, 120, "↺", "game.rotate-left", () => this.旋转(-1));
    this.触控按钮(155, 704, 120, "↑", "game.rotate", () => this.旋转(1));
    this.触控按钮(286, 704, 120, "↻", "game.rotate-right", () => this.旋转(1));
    this.触控按钮(24, 772, 120, "←", "game.left", () => this.移动(-1));
    this.触控按钮(155, 772, 120, "↓", "game.down", () => this.软降(), true);
    this.触控按钮(286, 772, 120, "→", "game.right", () => this.移动(1));
  }

  private 绘制电脑对局(): void {
    this.顶部返回("返回", () => this.显示页面("首页"));
    this.文字(720, 48, `${this.模式}  /  街机对局`, 16, 色彩.次字, 0.5, 0.5, true);
    this.按钮(1286, 22, 76, 42, "暂停", "game.pause", () => this.显示页面("暂停"), {
      字号: 13,
    });
    this.绘制迷你棋盘(390, 112, 36, 10, 20, true);

    this.方框(780, 112, 280, 124, 0x1b2942, 0x536987, 20, 1);
    this.小标题(804, 140, "等级");
    this.文字(804, 188, "04", 25, 色彩.黄, 0, 0.5, true);
    this.小标题(888, 140, "本局分数");
    this.文字(888, 188, String(this.演示分数).padStart(6, "0"), 25, 色彩.主字, 0, 0.5, true);
    this.小标题(1028, 140, "消行", 色彩.次字, 1);
    this.文字(1028, 188, String(this.演示消行).padStart(2, "0"), 25, 色彩.青, 1, 0.5, true);

    this.方框(780, 254, 280, 292, 0x1b2942, 0x536987, 20, 1);
    this.小标题(804, 284, "接下来", 色彩.青);
    const 桌面预览 = [
      {
        格点: [
          [0, 1],
          [1, 1],
          [2, 1],
          [1, 0],
        ],
        色值: 方块色[2],
      },
      {
        格点: [
          [0, 0],
          [0, 1],
          [0, 2],
          [1, 2],
        ],
        色值: 方块色[6],
      },
      {
        格点: [
          [0, 0],
          [1, 0],
          [0, 1],
          [1, 1],
        ],
        色值: 方块色[1],
      },
    ];
    桌面预览.forEach((方块, 索引) => {
      const y = 302 + 索引 * 72;
      this.方框(798, y, 244, 62, 0x263650, -1, 12, 0.98);
      this.文字(818, y + 31, `0${索引 + 1}`, 12, 色彩.暗字, 0, 0.5, true);
      this.绘制小方块组(870, y + 12, 16, 方块.格点, 方块.色值);
    });
    this.方框(780, 566, 280, 118, 0x1b2942, 0x536987, 20, 1);
    this.小标题(804, 596, "最佳纪录", 色彩.次字);
    this.文字(804, 638, "028,460", 24, 色彩.主字, 0, 0.5, true);
    this.文字(1036, 638, "今日排名  #12", 12, 色彩.次字, 1, 0.5);
  }

  private 绘制暂停卡片(): void {
    const 中心X = this.布局.手机 ? 215 : 720;
    const 中心Y = this.布局.手机 ? 485 : 450;
    const 宽 = this.布局.手机 ? 350 : 480;
    const 高 = this.布局.手机 ? 300 : 324;
    const 遮罩 = this.add.graphics().setDepth(20);
    遮罩.fillStyle(0x050811, 0.76).fillRect(0, 0, this.scale.width, this.scale.height);
    this.方框(中心X - 宽 / 2, 中心Y - 高 / 2, 宽, 高, 0x151e31, 0x40546f, 24, 1).setDepth(21);
    this.文字(中心X, 中心Y - 104, "稍作休息", 27, 色彩.主字, 0.5, 0.5, true).setDepth(22);
    this.文字(中心X, 中心Y - 66, "当前进度已为你保留", 13, 色彩.次字, 0.5, 0.5).setDepth(22);
    this.按钮(
      中心X - 155,
      中心Y - 25,
      310,
      54,
      "继续游戏",
      "pause.resume",
      () => this.显示页面("对局"),
      { 主按钮: true, 深度: 22 },
    );
    this.按钮(
      中心X - 155,
      中心Y + 42,
      148,
      48,
      "重新开始",
      "pause.restart",
      () => this.重开演示(),
      { 字号: 13, 深度: 22 },
    );
    this.按钮(
      中心X + 7,
      中心Y + 42,
      148,
      48,
      "返回首页",
      "pause.home",
      () => this.显示页面("首页"),
      { 字号: 13, 深度: 22 },
    );
  }

  private 绘制设置(): void {
    this.顶部返回("返回首页", () => this.显示页面("首页"));
    const 中心X = this.布局.手机 ? 215 : 720;
    this.文字(
      this.布局.手机 ? 24 : 390,
      this.布局.手机 ? 132 : 190,
      "设置",
      this.布局.手机 ? 30 : 40,
      "#173b53",
      0,
      0.5,
      true,
    );
    this.文字(
      this.布局.手机 ? 24 : 392,
      this.布局.手机 ? 164 : 226,
      "按你的习惯调整操作与反馈。",
      this.布局.手机 ? 13 : 15,
      "#465b70",
    );
    const y起点 = this.布局.手机 ? 228 : 290;
    const 行高 = this.布局.手机 ? 78 : 82;
    const 当前设置 = 获取游戏设置();
    const 设置项 = [
      { 标签: "音乐", 音量: 当前设置.音乐音量, 开启: 当前设置.背景音乐, 键: "music" },
      { 标签: "音效", 音量: 当前设置.音效音量, 开启: 当前设置.音效音量 > 0, 键: "sfx" },
    ];
    设置项.forEach((项, 索引) => {
      const y = y起点 + 索引 * 行高;
      const x = this.布局.手机 ? 24 : 390;
      const w = this.布局.手机 ? 382 : 660;
      new 界面音量控制(this, this.X(x + w / 2), this.Y(y + (this.布局.手机 ? 32 : 34)), {
        宽: this.px(w),
        高: this.px(this.布局.手机 ? 64 : 68),
        名称: `settings.${项.键}`,
        标签: 项.标签,
        音量: 项.音量,
        开启: 项.开启,
        面板色: "#141E32",
        边框色: "#33425F",
        轨道色: "#31435D",
        强调色: "#65E6DC",
        文字色: "#F3F6FC",
        次要文字色: "#9BAAC1",
        音量变化: (音量, 提交) => {
          if (项.键 === "music") 更新游戏设置({ 音乐音量: 音量, 背景音乐: 音量 > 0 });
          else 更新游戏设置({ 音效音量: 音量 });
          if (提交) this.sound.setMute(音量 === 0);
        },
        开关切换: (开启) => {
          if (项.键 === "music") 更新游戏设置({ 背景音乐: 开启 });
        },
      });
    });
    const 设置列X = this.布局.手机 ? 24 : 492;
    const 单列宽 = this.布局.手机 ? 382 : 220;
    const 语言Y = y起点 + 设置项.length * 行高 + 20;
    const 适配X = this.布局.手机 ? 设置列X : 设置列X + 单列宽 + 16;
    this.文字(设置列X, 语言Y, "语言", 14, "#354a60", 0, 0.5, true);
    this.创建下拉菜单(
      设置列X,
      语言Y + 16,
      单列宽,
      44,
      "settings.language.dropdown",
      [
        { name: "settings.language.system", 文案: "跟随系统", 值: "跟随系统" },
        { name: "settings.language.zh", 文案: "简体中文", 值: "简体中文" },
        { name: "settings.language.en", 文案: "English", 值: "English" },
      ],
      this.语言,
      (值) => {
        if (值 === "跟随系统" || 值 === "简体中文" || 值 === "English") {
          this.语言 = 值;
          更新游戏设置({ 语言: 值 });
          this.重绘();
        }
      },
    );
    const 设备Y = this.布局.手机 ? 语言Y + 92 : 语言Y;
    const 背景X = this.布局.手机 ? 设置列X : 设置列X + (单列宽 + 16) * 2;
    const 背景Y = this.布局.手机 ? 设备Y + 92 : 语言Y;
    this.文字(适配X, 设备Y, "屏幕适配", 14, "#354a60", 0, 0.5, true);
    this.创建下拉菜单(
      适配X,
      设备Y + 16,
      单列宽,
      44,
      "settings.platform.dropdown",
      [
        { name: "settings.platform.auto", 文案: "自动", 值: "自动" },
        { name: "settings.platform.phone", 文案: "手机竖屏", 值: "手机竖屏" },
        { name: "settings.platform.desktop", 文案: "电脑横屏", 值: "电脑横屏" },
      ],
      this.平台,
      (值) => {
        if (值 === "自动" || 值 === "手机竖屏" || 值 === "电脑横屏") {
          this.平台 = 值;
          更新游戏设置({ 屏幕适配: 值 });
          this.重绘();
        }
      },
    );
    this.文字(背景X, 背景Y, "背景动画", 14, "#354a60", 0, 0.5, true);
    this.创建下拉菜单(
      背景X,
      背景Y + 16,
      单列宽,
      44,
      "settings.background.dropdown",
      背景主题选项.map((选项) => ({
        name: `settings.background.${选项.值}`,
        文案: 选项.标签,
        值: 选项.值,
      })),
      this.背景主题,
      (值) => {
        if (值 === "晨光海岸" || 值 === "云海山岚" || 值 === "极光原野" || 值 === "霓虹天际") {
          this.背景主题 = 值;
          更新游戏设置({ 背景主题: 值 });
          this.重绘();
        }
      },
    );
    const 底栏Y = 804;
    const 返回宽 = this.布局.手机 ? 88 : 106;
    const 完成宽 = this.布局.手机 ? 278 : 360;
    this.按钮(
      this.布局.手机 ? 24 + 返回宽 + 12 : 中心X - 完成宽 / 2,
      底栏Y,
      完成宽,
      54,
      "完成",
      "settings.done",
      () => this.显示页面("首页"),
      { 主按钮: true },
    );
  }

  private 绘制结算(): void {
    const 中心X = this.布局.手机 ? 215 : 720;
    const 顶Y = this.布局.手机 ? 160 : 215;
    this.顶部返回("返回对局", () => this.显示页面("对局"));
    this.方框(
      中心X - (this.布局.手机 ? 190 : 360),
      顶Y,
      this.布局.手机 ? 380 : 720,
      this.布局.手机 ? 510 : 460,
      0x131d31,
      0x40546f,
      26,
      0.97,
    );
    this.标签(中心X - 58, 顶Y + 38, "本局完成", 色彩.青);
    this.文字(中心X, 顶Y + 119, "打得漂亮。", this.布局.手机 ? 31 : 40, 色彩.主字, 0.5, 0.5, true);
    this.文字(
      中心X,
      顶Y + 170,
      String(this.演示分数).padStart(6, "0"),
      this.布局.手机 ? 42 : 56,
      色彩.青,
      0.5,
      0.5,
      true,
    );
    const 数据X = this.布局.手机
      ? [中心X - 112, 中心X + 112]
      : [中心X - 225, 中心X - 75, 中心X + 75, 中心X + 225];
    const 数据 = this.布局.手机
      ? [
          ["消除行数", `${this.演示消行}`],
          ["最高等级", "04"],
        ]
      : [
          ["消除行数", `${this.演示消行}`],
          ["最高等级", "04"],
          ["连击次数", "06"],
          ["用时", this.计时展示],
        ];
    数据.forEach(([标签, 值], 索引) => {
      this.小标题(数据X[索引], 顶Y + 252, 标签);
      this.文字(数据X[索引], 顶Y + 282, 值, 20, 色彩.主字, 0, 0.5, true);
    });
    this.按钮(
      中心X - (this.布局.手机 ? 165 : 250),
      顶Y + 344,
      this.布局.手机 ? 330 : 500,
      58,
      "再来一局",
      "result.replay",
      () => this.重开演示(),
      { 主按钮: true, 字号: 17 },
    );
    this.按钮(
      中心X - (this.布局.手机 ? 165 : 250),
      顶Y + 416,
      this.布局.手机 ? 330 : 500,
      48,
      "返回首页",
      "result.home",
      () => this.显示页面("首页"),
      { 字号: 13 },
    );
  }

  private 顶部返回(文案: string, 点击: () => void): void {
    const 游戏顶栏 = this.页面 === "对局" || this.页面 === "暂停";
    const y = this.布局.手机 ? (游戏顶栏 ? 30 : 804) : 82;
    const x = this.布局.手机 ? 24 : 82;
    this.按钮(
      x,
      y,
      this.布局.手机 && !游戏顶栏 ? 88 : this.布局.手机 ? 72 : 106,
      this.布局.手机 && !游戏顶栏 ? 54 : this.布局.手机 ? 40 : 42,
      `‹  ${文案}`,
      `nav.${文案}`,
      点击,
      { 次要: true, 字号: 12 },
    );
  }

  private 模式卡片(
    x: number,
    y: number,
    宽: number,
    高: number,
    标题: string,
    说明: string,
    强调色: number,
    点击: () => void,
    附注 = "点按选择",
  ): void {
    const 容器 = this.add
      .rectangle(this.X(x + 宽 / 2), this.Y(y + 高 / 2), this.px(宽), this.px(高), 色彩.面板, 0.97)
      .setStrokeStyle(Math.max(1, this.px(1)), 强调色, 0.52)
      .setInteractive({ useHandCursor: true })
      .setName(`mode.${标题}`)
      .on("pointerover", () => 容器.setFillStyle(0x202c42, 1))
      .on("pointerout", () => 容器.setFillStyle(色彩.面板, 0.97))
      .on("pointerdown", 点击);
    this.add.rectangle(this.X(x + 2), this.Y(y + 高 / 2), this.px(3), this.px(高 - 30), 强调色, 1);
    const 字号 = this.布局.手机 ? 17 : 21;
    this.文字(x + 22, y + 高 * 0.38, 标题, 字号, 色彩.主字, 0, 0.5, true).setDepth(容器.depth + 1);
    this.文字(x + 22, y + 高 * 0.67, 说明, this.布局.手机 ? 11 : 13, 色彩.次字).setDepth(
      容器.depth + 1,
    );
    this.文字(x + 宽 - 18, y + 高 * 0.36, "↗", 18, 强调色, 1, 0.5, true).setDepth(容器.depth + 1);
    this.文字(x + 宽 - 18, y + 高 * 0.72, 附注, 10, 色彩.暗字, 1, 0.5).setDepth(容器.depth + 1);
  }

  private 触控按钮(
    x: number,
    y: number,
    宽: number,
    文案: string,
    名称: string,
    点击: () => void,
    主按钮 = false,
  ): void {
    this.按钮(x, y, 宽, 54, 文案, 名称, 点击, {
      主按钮,
      次要: !主按钮,
      字号: 文案 === "硬降" ? 13 : 文案 === "180°" ? 12 : 21,
    });
  }

  private 创建下拉菜单(
    x: number,
    y: number,
    宽: number,
    高: number,
    名称: string,
    选项: { name: string; 文案: string; 值: string }[],
    当前值: string,
    选择: (值: string) => void,
  ): void {
    const 菜单 = new 界面下拉菜单(this, this.X(x + 宽 / 2), this.Y(y + 高 / 2), {
      name: 名称,
      宽,
      高,
      文案: 选项.find((项) => 项.值 === 当前值)?.文案 ?? 当前值,
      选项,
      面板色: "#1B2942",
      强调色: "#65E6DC",
      文字色: "#F3F6FC",
      展开方向: "下",
      选项高: 28,
      选择,
    });
    菜单.setScale(this.布局.比例);
  }

  private 绘制退出(): void {
    const 中心X = this.布局.手机 ? 215 : 720;
    const 中心Y = 420;
    this.文字(中心X, 中心Y - 48, "准备离开？", 30, 色彩.主字, 0.5, 0.5, true);
    this.文字(
      中心X,
      中心Y,
      "这是可交互的界面预览，可以关闭当前标签页结束。",
      13,
      色彩.次字,
      0.5,
      0.5,
    );
    this.按钮(
      中心X - 150,
      中心Y + 48,
      300,
      54,
      "返回游戏首页",
      "exit.return",
      () => this.显示页面("首页"),
      { 主按钮: true },
    );
  }

  private 绘制迷你棋盘(
    x: number,
    y: number,
    格子: number,
    列数: number,
    行数: number,
    游戏状态: boolean,
  ): void {
    const 宽 = 格子 * 列数;
    const 高 = 格子 * 行数;
    this.方框(x - 10, y - 10, 宽 + 20, 高 + 20, 0x080e1b, 0x2d3d58, 12, 0.97);
    const 网格 = this.add.graphics();
    for (let 列 = 0; 列 <= 列数; 列 += 1) {
      网格
        .lineStyle(Math.max(1, this.px(0.7)), 0x31405a, 0.45)
        .lineBetween(this.X(x + 列 * 格子), this.Y(y), this.X(x + 列 * 格子), this.Y(y + 高));
    }
    for (let 行 = 0; 行 <= 行数; 行 += 1) {
      网格
        .lineStyle(Math.max(1, this.px(0.7)), 0x31405a, 0.45)
        .lineBetween(this.X(x), this.Y(y + 行 * 格子), this.X(x + 宽), this.Y(y + 行 * 格子));
    }

    if (游戏状态) {
      for (let 列 = 0; 列 < 列数; 列 += 1) {
        const 堆高 = (列 * 7 + 3) % 5;
        for (let i = 0; i < 堆高; i += 1) {
          this.方块格(x, y, 格子, 列, 行数 - 1 - i, 方块色[(列 + i) % 方块色.length], 0.72);
        }
      }
      const 形状 = [
        [0, 1],
        [1, 1],
        [2, 1],
        [1, 0],
      ];
      for (const [dx, dy] of 形状) {
        const [旋x, 旋y] = this.旋转坐标(dx, dy, this.方块旋转);
        const 列 = Phaser.Math.Clamp(this.方块X + 旋x, 0, 列数 - 1);
        this.方块格(x, y, 格子, 列, Math.min(Math.floor(行数 * 0.35) + 旋y, 行数 - 1), 方块色[2]);
      }
    } else {
      const 点缀: [number, number, number][] = [
        [1, 5, 3],
        [2, 5, 3],
        [3, 5, 3],
        [3, 4, 3],
        [6, 7, 0],
        [7, 7, 0],
        [8, 7, 0],
        [8, 6, 0],
        [0, 8, 5],
        [1, 8, 5],
        [2, 8, 5],
        [4, 8, 1],
        [5, 8, 1],
        [6, 8, 1],
      ];
      for (const [列, 行, 色号] of 点缀) {
        if (列 < 列数 && 行 < 行数) this.方块格(x, y, 格子, 列, 行, 方块色[色号]);
      }
    }
  }

  private 方块格(
    x: number,
    y: number,
    格子: number,
    列: number,
    行: number,
    色值: number,
    透明度 = 1,
  ): void {
    const 内边距 = Math.max(1, 格子 * 0.09);
    const 方块 = this.add.graphics();
    方块
      .fillStyle(色值, 0.14 * 透明度)
      .fillRoundedRect(
        this.X(x + 列 * 格子),
        this.Y(y + 行 * 格子),
        this.px(格子 - 1),
        this.px(格子 - 1),
        this.px(4),
      );
    方块
      .fillStyle(色值, 0.92 * 透明度)
      .fillRoundedRect(
        this.X(x + 列 * 格子 + 内边距),
        this.Y(y + 行 * 格子 + 内边距),
        this.px(格子 - 内边距 * 2 - 1),
        this.px(格子 - 内边距 * 2 - 1),
        this.px(3),
      );
    方块
      .lineStyle(Math.max(1, this.px(0.8)), 0xffffff, 0.45 * 透明度)
      .strokeRoundedRect(
        this.X(x + 列 * 格子 + 内边距),
        this.Y(y + 行 * 格子 + 内边距),
        this.px(格子 - 内边距 * 2 - 1),
        this.px(格子 - 内边距 * 2 - 1),
        this.px(3),
      );
  }

  private 绘制小方块组(x: number, y: number, 格子: number, 格点: number[][], 颜色: number): void {
    for (const [列, 行] of 格点) {
      const 图形 = this.add.graphics();
      图形
        .fillStyle(颜色, 0.22)
        .fillRoundedRect(
          this.X(x + 列 * 格子),
          this.Y(y + 行 * 格子),
          this.px(格子 - 2),
          this.px(格子 - 2),
          this.px(4),
        );
      图形
        .fillStyle(颜色, 0.95)
        .fillRoundedRect(
          this.X(x + 列 * 格子 + 2),
          this.Y(y + 行 * 格子 + 2),
          this.px(格子 - 6),
          this.px(格子 - 6),
          this.px(3),
        );
    }
  }

  private 旋转坐标(x: number, y: number, 次数: number): [number, number] {
    let 坐标: [number, number] = [x, y];
    for (let i = 0; i < 次数; i += 1) 坐标 = [2 - 坐标[1], 坐标[0]];
    if (次数 < 0) 坐标 = [2 - y, x];
    return 坐标;
  }

  private 移动(方向: number): void {
    this.方块X = Phaser.Math.Clamp(this.方块X + 方向, 0, 7);
    this.重绘();
  }

  private 旋转(方向: number): void {
    this.方块旋转 = (this.方块旋转 + 4 + 方向) % 4;
    this.重绘();
  }

  private 硬降(): void {
    this.演示分数 += 40;
    this.演示消行 = (this.演示消行 + 1) % 40;
    this.方块X = (this.方块X + 2) % 7;
    this.重绘();
  }

  private 软降(): void {
    this.演示分数 += 1;
    this.计时展示 = this.计时展示 === "02:48" ? "02:49" : this.计时展示;
    this.重绘();
  }

  private 开始演示(模式名: 模式): void {
    this.模式 = 模式名;
    const 游戏模式 = 模式名 === "极限" ? "极限" : 模式名 === "每日挑战" ? "每日挑战" : 模式名;
    this.scene.start("俄罗斯方块对局", { 模式: 游戏模式 });
  }

  private 重开演示(): void {
    this.演示分数 = 1240;
    this.演示消行 = 8;
    this.方块X = 3;
    this.方块旋转 = 0;
    this.计时展示 = "02:48";
    this.页面 = "对局";
    this.重绘();
  }

  private readonly 处理键盘 = (事件: KeyboardEvent): void => {
    if (this.页面 === "对局") {
      if (事件.code === "ArrowLeft") this.移动(-1);
      if (事件.code === "ArrowRight") this.移动(1);
      if (事件.code === "ArrowUp" || 事件.code === "KeyX") this.旋转(1);
      if (事件.code === "KeyZ") this.旋转(-1);
      if (事件.code === "Space") this.硬降();
      if (事件.code === "Escape" || 事件.code === "KeyP") {
        this.页面 = "暂停";
        this.重绘();
      }
      if (["ArrowLeft", "ArrowRight", "ArrowUp", "Space"].includes(事件.code))
        事件.preventDefault();
      return;
    }
    if (this.页面 === "暂停" && (事件.code === "Escape" || 事件.code === "KeyP")) {
      this.页面 = "对局";
      this.重绘();
    }
  };
}
