import Phaser from "phaser";
import { 应用文字清晰度 } from "../../../框架/文字清晰度";
import { 应用游戏设置, 获取游戏界面外观, 获取游戏背景色 } from "../../../框架/游戏框架";
import { 界面下拉菜单 } from "../../../框架/组件/Phaser界面/下拉菜单";
import { 界面分组 } from "../../../框架/组件/Phaser界面/分组";
import { 界面布局 } from "../../../框架/组件/Phaser界面/布局";
import { 界面按钮 } from "../../../框架/组件/Phaser界面/按钮";
import { 界面控件, 界面文字, 绑定按钮手势 } from "../../../框架/组件/Phaser界面/控件";
import { 界面滑块 } from "../../../框架/组件/Phaser界面/滑块";
import type { 语言选择 } from "../../../框架/设置";
import { 关闭覆盖页面 } from "../../../框架/页面切换";
import { 背景主题选项 } from "../../视觉/霓虹背景";
import { 获取文案, 解析语言 } from "../../配置/俄罗斯方块文案";
import { 更新游戏设置, type 游戏设置, 获取游戏设置, 默认设置 } from "../../配置/俄罗斯方块设置";

const 返回页面 = "开始菜单";

interface 设置选项 {
  名称: string;
  标签: string;
  是否选中: boolean;
  选择: () => void;
}

type 设置行配置 =
  | { 类型: "options"; 标题: string; 选项: 设置选项[] }
  | { 类型: "language"; 值: 语言选择 }
  | { 类型: "volume"; 标题: string; 值: number; 键: "音乐音量" | "音效音量" };

interface 设置分组配置 {
  标题: string;
  行: 设置行配置[];
}

class 外观标题牌 extends 界面控件 {
  constructor(
    场景: Phaser.Scene,
    标题: string,
    配置: { 宽: number; 高: number; 面板色: number; 强调色: number; 文字色: string; 英文: boolean },
  ) {
    super(场景, 0, 0, 配置.宽, 配置.高);
    const 背板 = 场景.add.graphics();
    背板
      .fillStyle(配置.面板色, 0.32)
      .fillRoundedRect(-配置.宽 / 2 + 4, -配置.高 / 2 + 8, 配置.宽 - 8, 配置.高 - 16, 6)
      .lineStyle(1, 配置.强调色, 0.45)
      .strokeRoundedRect(-配置.宽 / 2 + 4, -配置.高 / 2 + 8, 配置.宽 - 8, 配置.高 - 16, 6);
    this.add(背板);

    const 字号 = 标题.length > 6 ? "11px" : "14px";
    if (配置.英文) {
      const 文本 = 场景.add
        .text(0, 0, 标题, {
          fontFamily: '"Segoe UI", "Microsoft YaHei", sans-serif',
          fontSize: 字号,
          fontStyle: "bold",
          color: 配置.文字色,
          align: "center",
        })
        .setOrigin(0.5)
        .setAngle(-90);
      this.add(文本);
    } else {
      const 字符 = [...标题];
      const 行高 = 17;
      字符.forEach((字, 索引) => {
        const 文本 = 场景.add
          .text(0, (索引 - (字符.length - 1) / 2) * 行高, 字, {
            fontFamily: '"Segoe UI", "Microsoft YaHei", sans-serif',
            fontSize: 字号,
            fontStyle: "bold",
            color: 配置.文字色,
            align: "center",
          })
          .setOrigin(0.5);
        this.add(文本);
      });
    }
    场景.add.existing(this);
  }
}

class 外观选择卡片 extends 界面控件 {
  private readonly 底板: Phaser.GameObjects.Rectangle;
  private readonly 预览: Phaser.GameObjects.Graphics;
  private readonly 标签: Phaser.GameObjects.Text;

  constructor(
    场景: Phaser.Scene,
    配置: {
      名称: string;
      标签: string;
      宽: number;
      高: number;
      面板色: number;
      背景色: number;
      强调色: number;
      类型: "样式" | "背景";
      样式值?: 游戏设置["样式"];
      已选: boolean;
      选择: () => void;
    },
  ) {
    super(场景, 0, 0, 配置.宽, 配置.高);
    this.name = 配置.名称;
    const 边色 = 配置.已选 ? 配置.强调色 : 0x718092;
    this.底板 = 场景.add
      .rectangle(0, 0, 配置.宽, 配置.高, 配置.面板色, 1)
      .setName(配置.名称)
      .setStrokeStyle(配置.已选 ? 2 : 1, 边色, 配置.已选 ? 1 : 0.42);
    this.预览 = 场景.add.graphics();
    const 预览高 = 配置.类型 === "背景" ? 配置.高 - 30 : 配置.高 - 31;
    const 预览宽 = 配置.宽 - 12;
    const x = -预览宽 / 2;
    const y = -配置.高 / 2 + 5;
    if (配置.类型 === "背景") {
      this.预览
        .fillGradientStyle(配置.背景色, 配置.背景色, 配置.强调色, 配置.强调色, 1, 1, 0.8, 0.8)
        .fillRoundedRect(x, y, 预览宽, 预览高, 5);
      this.预览
        .fillStyle(0xffedbd, 0.92)
        .fillCircle(x + 预览宽 * 0.74, y + 9, Math.max(3, Math.min(6, 预览高 * 0.13)));
      this.预览.fillStyle(配置.强调色, 0.9).fillTriangle(x, y + 30, x + 18, y + 13, x + 38, y + 30);
      this.预览
        .fillStyle(配置.背景色, 0.72)
        .fillTriangle(x + 21, y + 30, x + 43, y + 12, x + 66, y + 30);
      this.预览.fillStyle(0xffffff, 0.25).fillRect(x + 3, y + 32, Math.max(1, 预览宽 - 6), 1);
    } else if (配置.样式值 === "暖纸古典") {
      this.预览.fillStyle(0xeadfc8, 1).fillRoundedRect(x, y, 预览宽, 预览高, 2);
      this.预览.lineStyle(1, 0x9a6b1f, 0.75).strokeRect(x + 4, y + 4, 预览宽 - 8, 预览高 - 8);
      this.预览.fillStyle(0x9a6b1f, 1).fillRect(x + 9, y + 9, Math.max(16, 预览宽 * 0.4), 4);
      this.预览
        .lineStyle(1, 0x8e7a5d, 0.65)
        .lineBetween(x + 9, y + 18, x + 9 + Math.max(14, 预览宽 * 0.3), y + 18);
      this.预览.fillStyle(0x9a6b1f, 1).fillRect(x + 9, y + 23, Math.max(22, 预览宽 * 0.55), 7);
      this.预览
        .lineStyle(1, 0x9a6b1f, 0.75)
        .strokeRect(x + 14 + Math.max(22, 预览宽 * 0.55), y + 22, 13, 9);
    } else if (配置.样式值 === "青蓝未来") {
      this.预览.fillStyle(0x071922, 1).fillRoundedRect(x, y, 预览宽, 预览高, 4);
      this.预览.lineStyle(1, 0x4ed5d0, 0.16);
      for (let gx = x + 7; gx < x + 预览宽; gx += 12)
        this.预览.lineBetween(gx, y + 3, gx, y + 预览高 - 3);
      for (let gy = y + 6; gy < y + 预览高; gy += 10)
        this.预览.lineBetween(x + 3, gy, x + 预览宽 - 3, gy);
      this.预览.fillStyle(0x4ed5d0, 1).fillRect(x + 6, y + 7, Math.max(15, 预览宽 * 0.36), 5);
      this.预览.fillStyle(0x4ed5d0, 0.28).fillRect(x + 6, y + 16, Math.max(18, 预览宽 * 0.5), 4);
      this.预览
        .lineStyle(1, 0xa4fff4, 0.92)
        .strokeRect(x + 8, y + 24, Math.max(22, 预览宽 * 0.58), 8);
      this.预览.fillStyle(0xa4fff4, 1).fillCircle(x + 预览宽 - 10, y + 9, 2);
    } else {
      this.预览.fillStyle(0x101a2b, 1).fillRoundedRect(x, y, 预览宽, 预览高, 8);
      this.预览
        .fillStyle(0xe6b45c, 1)
        .fillRoundedRect(x + 7, y + 7, Math.max(18, 预览宽 * 0.42), 7, 4);
      this.预览
        .fillStyle(0xf6d98d, 0.75)
        .fillRoundedRect(x + 7, y + 18, Math.max(14, 预览宽 * 0.25), 4, 2);
      this.预览
        .lineStyle(1, 0xe6b45c, 0.94)
        .strokeRoundedRect(
          x + 10 + Math.max(18, 预览宽 * 0.42),
          y + 6,
          Math.max(10, 预览宽 * 0.2),
          20,
          5,
        );
      this.预览.fillStyle(0xe6b45c, 1).fillCircle(x + 14, y + 30, 2.5);
    }
    this.标签 = 场景.add
      .text(0, 配置.高 / 2 - 12, 配置.标签, {
        fontFamily: '"Segoe UI", "Microsoft YaHei", sans-serif',
        fontSize: 配置.宽 < 88 ? "9px" : "11px",
        color: 配置.面板色 === 0xfbf7ec ? "#423627" : "#e8edf3",
        align: "center",
        wordWrap: { width: 配置.宽 - 6 },
      })
      .setOrigin(0.5);
    this.add([this.底板, this.预览, this.标签]);
    this.底板.setInteractive({ useHandCursor: true });
    绑定按钮手势(this.底板, {
      点击: 配置.选择,
      移入: () => this.底板.setStrokeStyle(2, 配置.强调色, 0.8),
      移出: () => this.底板.setStrokeStyle(配置.已选 ? 2 : 1, 边色, 配置.已选 ? 1 : 0.42),
    });
    场景.add.existing(this);
  }
}

export class 设置界面 extends Phaser.Scene {
  constructor() {
    super("设置界面");
  }

  create(): void {
    应用文字清晰度(this, 2);
    this.重建界面();
    this.scale.on("resize", this.重建界面, this);
    window.addEventListener("gamemaker:settings-change", this.重建界面);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off("resize", this.重建界面, this);
      window.removeEventListener("gamemaker:settings-change", this.重建界面);
    });
  }

  private 获取外观() {
    return 获取游戏界面外观(获取游戏设置());
  }

  private 获取文案() {
    return 获取文案(解析语言(获取游戏设置().语言));
  }

  private 色值(颜色: string): number {
    return Number.parseInt(颜色.replace("#", ""), 16);
  }

  private 创建按钮(
    x: number,
    y: number,
    宽: number,
    高: number,
    文案: string,
    名称: string,
    点击: () => void,
    已选 = false,
    字号?: string,
  ): 界面按钮 {
    const 外观 = this.获取外观();
    // 设置按钮文字禁止使用文字阴影，保持文字清晰。
    return new 界面按钮(this, x, y, {
      宽,
      高,
      文案,
      name: 名称,
      面板色: 外观.面板,
      强调色: 外观.强调色,
      文字色: 外观.正文,
      点击,
      已选,
      文字色跟随底色: true,
      字号: 字号 ?? (this.scale.width < 520 ? "12px" : "15px"),
    });
  }

  private 创建选项行(标题: string, 选项: 设置选项[], 宽: number): 界面布局 {
    const 外观 = this.获取外观();
    const 窄屏 = 宽 < 460;
    const 标签宽 = 标题 ? (窄屏 ? 宽 : 150) : 0;
    const 卡片选择 = 标题 === this.获取文案().样式 || 标题 === "背景" || 标题 === "Background";
    const 行高 = 卡片选择 ? 74 : 36;
    const 行 = new 界面布局(this, 0, 0, {
      方向: 窄屏 ? "垂直" : "水平",
      宽,
      高: 窄屏 ? 0 : 行高,
      间距: 窄屏 ? 4 : 10,
      交叉轴对齐: 窄屏 ? "拉伸" : "居中",
      自动主轴尺寸: 窄屏,
    });
    if (标题) {
      行.添加(
        new 界面文字(this, 0, 0, {
          宽: 标签宽,
          高: 窄屏 ? 24 : 行高,
          文案: 标题,
          字号: 窄屏 ? "13px" : "16px",
          颜色: 外观.正文,
          对齐: "左",
          内边距: 2,
        }),
        { 宽: 标签宽, 高: 窄屏 ? 24 : 36 },
      );
    }
    const 按钮组宽 = 窄屏 ? 宽 : 宽 - 标签宽;
    const 按钮间距 = 窄屏 ? 4 : 10;
    const 按钮宽 = 窄屏
      ? (按钮组宽 - 按钮间距 * (选项.length - 1)) / 选项.length
      : Math.max(76, Math.min(160, (按钮组宽 - 按钮间距 * (选项.length - 1)) / 选项.length));
    const 按钮布局 = new 界面布局(this, 0, 0, {
      方向: "水平",
      宽: 按钮组宽,
      高: 行高,
      间距: 按钮间距,
      主轴对齐: "居中",
      自动换行: false,
      自动交叉轴尺寸: 窄屏,
    });
    for (const 项目 of 选项) {
      按钮布局.添加(
        this.创建按钮(
          0,
          0,
          按钮宽,
          卡片选择 ? 行高 : 36,
          卡片选择
            ? `${项目.标签}\n${标题 === this.获取文案().样式 ? "A  ▰  ▱" : "○  ≋  ≋"}`
            : 项目.标签,
          项目.名称,
          项目.选择,
          项目.是否选中,
          卡片选择 ? "11px" : undefined,
        ),
        { 宽: 按钮宽, 高: 卡片选择 ? 行高 : 36 },
      );
    }
    行.添加(按钮布局, 窄屏 ? { 宽: 按钮组宽 } : { 宽: 按钮组宽, 高: 行高 });
    行.重新排列();
    return 行;
  }

  private 创建语言行(当前语言: 语言选择, 宽: number): 界面布局 {
    const 外观 = this.获取外观();
    const 文案 = this.获取文案();
    const 宽度 = Math.min(220, Math.max(180, 宽 * 0.42));
    const 语言选项 = [
      { name: "settings.language.system", 文案: 文案.跟随系统, 值: "跟随系统" },
      { name: "settings.language.zh", 文案: 文案.简体中文, 值: "简体中文" },
      { name: "settings.language.en", 文案: "English", 值: "English" },
    ];
    const 下拉框 = new 界面下拉菜单(this, 0, 0, {
      name: "settings.language.dropdown",
      宽: 宽度,
      高: 36,
      文案: 语言选项.find((选项) => 选项.值 === 当前语言)?.文案 ?? 文案.跟随系统,
      选项: 语言选项,
      面板色: 外观.面板,
      强调色: 外观.强调色,
      文字色: 外观.正文,
      选择: (值) => {
        if (值 === "跟随系统" || 值 === "简体中文" || 值 === "English") {
          this.更新({ 语言: 值 });
        }
      },
    });
    const 行 = new 界面布局(this, 0, 0, {
      方向: "水平",
      宽,
      高: 36,
      间距: 10,
      交叉轴对齐: "居中",
    });
    行.添加(
      new 界面文字(this, 0, 0, {
        宽: 110,
        高: 36,
        文案: 文案.语言,
        字号: "15px",
        颜色: 外观.正文,
        对齐: "左",
        内边距: 2,
      }),
      { 宽: 110, 高: 36, 伸展: 1 },
    );
    行.添加(下拉框, { 宽: 宽度, 高: 36 });
    return 行;
  }

  private 创建音量行(标题: string, 值: number, 键: "音乐音量" | "音效音量", 宽: number): 界面布局 {
    const 外观 = this.获取外观();
    const 文本 = new 界面文字(this, 0, 0, {
      宽: 126,
      高: 36,
      文案: `${标题}  ${值}%`,
      字号: "14px",
      颜色: 外观.正文,
      对齐: "左",
      内边距: 2,
    });
    const 滑块 = new 界面滑块(this, 0, 0, {
      宽: 80,
      命中高: 32,
      值,
      步进: 5,
      name: `settings.${键 === "音乐音量" ? "music" : "sfx"}-volume.slider`,
      轨道色: 外观.轨道,
      强调色: 外观.强调色,
      变化: (新值) => this.更新({ [键]: 新值 }),
    });
    滑块.on("change", (新值: number) => 文本.setLabel(`${标题}  ${新值}%`));
    const 行 = new 界面布局(this, 0, 0, { 方向: "水平", 宽, 高: 36, 间距: 12, 交叉轴对齐: "居中" });
    行.添加(文本, { 宽: 126, 高: 36 });
    行.添加(滑块, { 高: 32, 伸展: 1 });
    return 行;
  }

  private 创建外观行(标题: string, 选项: 设置选项[], 宽: number): 界面布局 {
    const 外观 = this.获取外观();
    const 窄屏 = 宽 < 460;
    const 是背景 = 标题 === "背景" || 标题 === "Background";
    const 间距 = 窄屏 ? 6 : 10;
    const 标签宽 = 窄屏 ? 42 : 52;
    const 内容宽 = 宽 - 标签宽 - 间距;
    const 卡片高 = 是背景 ? 82 : 78;
    const 卡片宽 = (内容宽 - 间距 * (选项.length - 1)) / 选项.length;
    const 当前 = 获取游戏设置();
    const 容器 = new 界面布局(this, 0, 0, {
      方向: "垂直",
      宽,
      高: 0,
      间距: 4,
      自动主轴尺寸: true,
    });
    const 行 = new 界面布局(this, 0, 0, { 方向: "水平", 宽, 高: 卡片高, 间距, 交叉轴对齐: "居中" });
    const 英文 = 获取游戏设置().语言 === "English";
    行.添加(
      new 外观标题牌(this, 标题, {
        宽: 标签宽,
        高: 卡片高,
        面板色: this.色值(外观.面板),
        强调色: this.色值(外观.强调色),
        文字色: 外观.正文,
        英文,
      }),
      { 宽: 标签宽, 高: 卡片高 },
    );
    for (const 项目 of 选项) {
      const 样式值 =
        项目.名称 === "settings.style.gilded-night"
          ? "夜空鎏金"
          : 项目.名称 === "settings.style.warm-paper"
            ? "暖纸古典"
            : 项目.名称 === "settings.style.neon-tide"
              ? "青蓝未来"
              : undefined;
      const 值 = 是背景 ? 项目.名称.replace("settings.background.", "") : 样式值;
      const 是当前 = 是背景 ? 值 === 当前.背景主题 : 值 === 当前.样式;
      const 配色 = 是背景
        ? 值 === "晨光海岸"
          ? [0x78b8d0, 0x47a5aa]
          : 值 === "云海山岚"
            ? [0x9dbdca, 0x728f9b]
            : 值 === "极光原野"
              ? [0x142d3b, 0x35a879]
              : [0x17243b, 0x5475b4]
        : 值 === "暖纸古典"
          ? [0xf2ecdd, 0x9a6b1f]
          : 值 === "青蓝未来"
            ? [0x071922, 0x4ed5d0]
            : [0x101a2b, 0xe6b45c];
      const 卡片 = new 外观选择卡片(this, {
        名称: 项目.名称,
        标签: 项目.标签,
        宽: 卡片宽,
        高: 卡片高,
        面板色: this.色值(外观.面板),
        背景色: 配色[0] ?? 0,
        强调色: 配色[1] ?? 0,
        类型: 是背景 ? "背景" : "样式",
        样式值,
        已选: 是当前,
        选择: 项目.选择,
      });
      行.添加(卡片, { 宽: 卡片宽, 高: 卡片高 });
    }
    容器.添加(行, { 宽, 高: 卡片高 });
    容器.重新排列();
    return 容器;
  }

  private 创建设置分组(设置: 游戏设置, 文案: ReturnType<typeof 获取文案>): 设置分组配置[] {
    const 单选 = (
      名称: string,
      标签: string,
      值: string,
      当前值: string,
      选择: () => void,
    ): 设置选项 => ({ 名称, 标签, 是否选中: 当前值 === 值, 选择 });

    return [
      {
        标题: 设置.语言 === "English" ? "General" : "常规",
        行: [
          { 类型: "volume", 标题: 文案.音乐音量, 值: 设置.音乐音量, 键: "音乐音量" },
          { 类型: "volume", 标题: 文案.音效音量, 值: 设置.音效音量, 键: "音效音量" },
          { 类型: "language", 值: 设置.语言 },
        ],
      },
      {
        标题: 文案.外观,
        行: [
          {
            类型: "options",
            标题: 文案.样式,
            选项: [
              单选("settings.style.gilded-night", 文案.夜空鎏金, "夜空鎏金", 设置.样式, () =>
                this.更新({ 样式: "夜空鎏金" }),
              ),
              单选("settings.style.warm-paper", 文案.暖纸古典, "暖纸古典", 设置.样式, () =>
                this.更新({ 样式: "暖纸古典" }),
              ),
              单选("settings.style.neon-tide", 文案.青蓝未来, "青蓝未来", 设置.样式, () =>
                this.更新({ 样式: "青蓝未来" }),
              ),
            ],
          },
          {
            类型: "options",
            标题: 设置.语言 === "English" ? "Background" : "背景",
            选项: 背景主题选项.map((项目) =>
              单选(`settings.background.${项目.值}`, 项目.标签, 项目.值, 设置.背景主题, () =>
                this.更新({ 背景主题: 项目.值 }),
              ),
            ),
          },
        ],
      },
    ];
  }

  private 绘制设置分组(x: number, y: number, 宽: number, 配置: 设置分组配置[]): 界面布局 {
    const 外观 = this.获取外观();
    const 中心X = x + 宽 / 2;
    const 布局 = new 界面布局(this, 中心X, y, {
      方向: "垂直",
      宽,
      高: 0,
      间距: 18,
      自动主轴尺寸: true,
    });
    for (const 分组配置项 of 配置) {
      const 分组 = new 界面分组(this, 0, 0, {
        标题: 分组配置项.标题,
        宽,
        强调色: 外观.强调色,
      });
      for (const 行配置 of 分组配置项.行) {
        const 行 =
          行配置.类型 === "options"
            ? 行配置.标题 === this.获取文案().样式 ||
              行配置.标题 === "背景" ||
              行配置.标题 === "Background"
              ? this.创建外观行(行配置.标题, 行配置.选项, 宽)
              : this.创建选项行(行配置.标题, 行配置.选项, 宽)
            : 行配置.类型 === "language"
              ? this.创建语言行(行配置.值, 宽)
              : this.创建音量行(行配置.标题, 行配置.值, 行配置.键, 宽);
        分组.添加行(行, 行.获取首选尺寸().高, 10);
      }
      布局.添加(分组, { 宽, 高: 分组.getContentHeight() });
    }
    布局.重新排列().setPosition(中心X, y + 布局.height / 2);
    return 布局;
  }

  private 重建界面 = (): void => {
    const 设置 = 获取游戏设置();
    const 文案 = this.获取文案();
    const 外观 = this.获取外观();
    const 宽 = this.scale.width;
    const 高 = this.scale.height;
    const 面板宽 = Math.min(740, 宽 - 32);
    const 左 = (宽 - 面板宽) / 2;

    this.children.removeAll(true);
    this.cameras.main.setBackgroundColor("rgba(0,0,0,0)");
    const 内容X = 左 + 28;
    const 内容宽 = 面板宽 - 56;
    // 先量出内容真实高度再定面板高度与页脚位置，避免窄屏时下拉行被页脚按钮压住
    const 内容布局 = this.绘制设置分组(内容X + 4, 0, 内容宽 - 8, this.创建设置分组(设置, 文案));
    const 内容高 = 内容布局.height;
    const 面板高 = Math.min(高 - 24, Math.max(460, 内容高 + 72 + 38 + 26));
    const 上 = (高 - 面板高) / 2;
    this.add
      .rectangle(宽 / 2, 高 / 2, 宽, 高, this.色值(外观.遮罩), 0.76)
      .setInteractive()
      .setDepth(-2)
      .on(
        "pointerdown",
        (
          _pointer: Phaser.Input.Pointer,
          _x: number,
          _y: number,
          事件: Phaser.Types.Input.EventData,
        ) => 事件.stopPropagation(),
      );
    this.add
      .rectangle(宽 / 2, 高 / 2, 面板宽, 面板高, this.色值(获取游戏背景色(设置)), 0.98)
      .setStrokeStyle(1, this.色值(外观.强调色), 0.75)
      .setDepth(-1);
    内容布局.setPosition(内容X + 4 + (内容宽 - 8) / 2, 上 + 72 + 内容高 / 2);
    const 标题布局 = new 界面布局(this, 宽 / 2, 上 + 31, {
      方向: "水平",
      宽: 内容宽,
      高: 42,
      交叉轴对齐: "居中",
    });
    const 标题 = new 界面文字(this, 0, 0, {
      宽: 0,
      高: 36,
      文案: 文案.设置,
      字号: "25px",
      颜色: 外观.强调色,
      对齐: "左",
    });
    标题布局.添加(标题, { 高: 38, 伸展: 1 });
    标题布局.添加(
      this.创建按钮(0, 0, 42, 38, "×", "settings.close", () => this.关闭(), false, "20px"),
      { 宽: 42, 高: 38 },
    );

    const 页脚 = new 界面布局(this, 宽 / 2, 上 + 面板高 - 32, {
      方向: "水平",
      宽: 内容宽,
      高: 38,
      间距: 8,
      主轴对齐: "末尾",
      交叉轴对齐: "居中",
    });
    页脚.添加(this.创建按钮(0, 0, 142, 38, 文案.恢复默认, "settings.defaults", this.恢复默认), {
      宽: 142,
      高: 38,
    });
    页脚.添加(
      this.创建按钮(0, 0, 90, 38, 文案.完成, "settings.done", () => this.关闭(), true),
      { 宽: 90, 高: 38 },
    );
  };

  private 更新(变化: Partial<游戏设置>): void {
    const 设置 = 更新游戏设置(变化);
    应用游戏设置(设置);
  }

  private 恢复默认 = (): void => {
    this.更新({ ...默认设置 });
  };

  private 关闭(): void {
    关闭覆盖页面(this, 返回页面);
  }
}
