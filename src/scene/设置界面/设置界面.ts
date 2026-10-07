import Phaser from "phaser";
import { 获取文案, 解析语言 } from "../../../core/多语言";
import { 应用游戏设置, 获取游戏界面外观, 获取游戏背景色 } from "../../../core/游戏框架";
import { 界面下拉菜单 } from "../../../core/组件/Phaser界面/下拉菜单";
import { 界面分组 } from "../../../core/组件/Phaser界面/分组";
import { 界面布局 } from "../../../core/组件/Phaser界面/布局";
import { 界面按钮 } from "../../../core/组件/Phaser界面/按钮";
import { 界面文字 } from "../../../core/组件/Phaser界面/控件";
import {
  更新游戏设置,
  type 游戏设置,
  type 背景主题,
  获取游戏设置,
  type 语言选择,
  默认设置,
} from "../../../core/设置";
import { 关闭覆盖页面 } from "../../../core/页面切换";
import { 背景主题选项 } from "../../视觉/霓虹背景";

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
  | { 类型: "background"; 值: 背景主题 };

interface 设置分组配置 {
  标题: string;
  行: 设置行配置[];
}

export class 设置界面 extends Phaser.Scene {
  private 状态文字?: 界面文字;

  constructor() {
    super("设置界面");
  }

  create(): void {
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
      字号: 字号 ?? (this.scale.width < 520 ? "12px" : "15px"),
    });
  }

  private 创建选项行(标题: string, 选项: 设置选项[], 宽: number): 界面布局 {
    const 外观 = this.获取外观();
    const 窄屏 = 宽 < 460;
    const 标签宽 = 标题 ? (窄屏 ? 宽 : 150) : 0;
    const 行 = new 界面布局(this, 0, 0, {
      方向: 窄屏 ? "垂直" : "水平",
      宽,
      高: 窄屏 ? 0 : 36,
      间距: 窄屏 ? 4 : 10,
      交叉轴对齐: 窄屏 ? "拉伸" : "居中",
      自动主轴尺寸: 窄屏,
    });
    if (标题) {
      行.添加(
        new 界面文字(this, 0, 0, {
          宽: 标签宽,
          高: 窄屏 ? 24 : 36,
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
      ? Math.max(68, Math.min(112, (按钮组宽 - 按钮间距 * (选项.length - 1)) / 3))
      : Math.max(76, Math.min(126, (按钮组宽 - 按钮间距 * (选项.length - 1)) / 3));
    const 按钮布局 = new 界面布局(this, 0, 0, {
      方向: "水平",
      宽: 按钮组宽,
      高: 36,
      间距: 按钮间距,
      主轴对齐: "居中",
      自动换行: 窄屏,
      自动交叉轴尺寸: 窄屏,
    });
    for (const 项目 of 选项) {
      按钮布局.添加(
        this.创建按钮(0, 0, 按钮宽, 36, 项目.标签, 项目.名称, 项目.选择, 项目.是否选中),
        { 宽: 按钮宽, 高: 36 },
      );
    }
    行.添加(按钮布局, 窄屏 ? { 宽: 按钮组宽 } : { 宽: 按钮组宽, 高: 36 });
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
      主轴对齐: "末尾",
    });
    行.添加(下拉框, { 宽: 宽度, 高: 36 });
    return 行;
  }

  private 创建背景行(当前背景: 背景主题, 宽: number): 界面布局 {
    const 外观 = this.获取外观();
    const 下拉框 = new 界面下拉菜单(this, 0, 0, {
      name: "settings.background.dropdown",
      宽: Math.min(220, Math.max(180, 宽 * 0.42)),
      高: 36,
      文案: 背景主题选项.find((选项) => 选项.值 === 当前背景)?.标签 ?? "晨光海岸",
      选项: 背景主题选项.map((选项) => ({
        name: `settings.background.${选项.值}`,
        文案: 选项.标签,
        值: 选项.值,
      })),
      面板色: 外观.面板,
      强调色: 外观.强调色,
      文字色: 外观.正文,
      选择: (值) => {
        if (值 === "晨光海岸" || 值 === "云海山岚" || 值 === "极光原野" || 值 === "霓虹天际") {
          this.更新({ 背景主题: 值 });
        }
      },
    });
    const 行 = new 界面布局(this, 0, 0, {
      方向: "水平",
      宽,
      高: 36,
      主轴对齐: "末尾",
    });
    行.添加(下拉框, { 宽: Math.min(220, Math.max(180, 宽 * 0.42)), 高: 36 });
    return 行;
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
        标题: 设置.语言 === "English" ? "Gameplay" : "玩法",
        行: [
          {
            类型: "options",
            标题: 设置.语言 === "English" ? "180° rotation" : "180°旋转",
            选项: [
              单选("settings.rotation180.on", 文案.开, "true", String(设置.旋转180), () =>
                this.更新({ 旋转180: true }),
              ),
              单选("settings.rotation180.off", 文案.关, "false", String(设置.旋转180), () =>
                this.更新({ 旋转180: false }),
              ),
            ],
          },
        ],
      },
      {
        标题: 文案.外观,
        行: [
          {
            类型: "options",
            标题: 文案.主题,
            选项: [
              单选("settings.theme.system", 文案.跟随系统, "跟随系统", 设置.主题, () =>
                this.更新({ 主题: "跟随系统" }),
              ),
              单选("settings.theme.dark", 文案.深色, "深色", 设置.主题, () =>
                this.更新({ 主题: "深色" }),
              ),
              单选("settings.theme.light", 文案.浅色, "浅色", 设置.主题, () =>
                this.更新({ 主题: "浅色" }),
              ),
            ],
          },
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
        ],
      },
      {
        标题: "语言与背景",
        行: [
          {
            类型: "language",
            值: 设置.语言,
          },
          {
            类型: "background",
            值: 设置.背景主题,
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
      间距: 6,
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
            ? this.创建选项行(行配置.标题, 行配置.选项, 宽)
            : 行配置.类型 === "language"
              ? this.创建语言行(行配置.值, 宽)
              : this.创建背景行(行配置.值, 宽);
        分组.添加行(行, 行.获取首选尺寸().高, 6);
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
      this.创建按钮(0, 0, 42, 38, "×", "settings.close", () => this.关闭()),
      { 宽: 42, 高: 38 },
    );

    const 页脚 = new 界面布局(this, 宽 / 2, 上 + 面板高 - 32, {
      方向: "水平",
      宽: 内容宽,
      高: 38,
      间距: 8,
      交叉轴对齐: "居中",
    });
    this.状态文字 = new 界面文字(this, 0, 0, {
      宽: 120,
      高: 38,
      文案: "",
      字号: "12px",
      颜色: 外观.次要文字,
      对齐: "左",
    });
    页脚.添加(this.状态文字, { 宽: 内容宽 - 258, 高: 38, 伸展: 1 });
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
    this.状态文字?.setLabel(this.获取文案().设置已更新);
  }

  private 恢复默认 = (): void => {
    this.更新({ ...默认设置 });
    this.状态文字?.setLabel(this.获取文案().已恢复默认);
  };

  private 关闭(): void {
    关闭覆盖页面(this, 返回页面);
  }
}
