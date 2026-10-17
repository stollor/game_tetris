import Phaser from "phaser";
import { 应用游戏设置, 获取游戏界面外观, 获取游戏背景色 } from "../../../框架/游戏框架";
import { 界面下拉菜单 } from "../../../框架/界面/下拉菜单";
import { 界面分组 } from "../../../框架/界面/分组";
import { 适配场景视口 } from "../../../框架/界面/响应式视口";
import { 界面布局 } from "../../../框架/界面/布局";
import { 界面按钮 } from "../../../框架/界面/按钮";
import { 界面文字 } from "../../../框架/界面/控件";
import { 应用文字清晰度 } from "../../../框架/界面/文字清晰度";
import { 界面滑块 } from "../../../框架/界面/滑块";
import { 界面滚动区域 } from "../../../框架/界面/滚动区域";
import type { 语言选择 } from "../../../框架/设置/设置";
import { 解锁程序音频 } from "../../../框架/音频/音频";
import { 关闭覆盖页面 } from "../../../框架/页面切换";
import { 创建外观选择列表, type 外观卡配置 } from "../../../组件/霓虹街机/外观卡";
import { 基础背景已解锁, 是基础背景 } from "../../存档/基础背景解锁";
import { 旅行收藏 } from "../../存档/旅行收藏";
import { 立即同步云存档 } from "../../平台/云存档";
import { 格式化云同步文案, 订阅云同步状态, 读取云同步状态 } from "../../平台/云存档状态";
import { 刷新Tap用户身份, 订阅Tap用户身份 } from "../../平台/用户身份";
import { 清除实测低端 } from "../../性能/画质";
import { 旅行主题表 } from "../../框架配置/旅行主题";
import { 地点皮肤表, 查找地点 } from "../../框架配置/旅行地点";
import { 背景主题选项 } from "../../视觉/霓虹背景";
import { 获取文案, 解析语言 } from "../../配置/俄罗斯方块文案";
import { 更新游戏设置, type 游戏设置, 获取游戏设置, 默认设置 } from "../../配置/俄罗斯方块设置";
import { 方块外观方案表 } from "../../配置/方块外观";
import { 界面主题 } from "../../配置/界面主题";
import { 背景主题配置 } from "../../配置/背景主题";

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
  | { 类型: "volume"; 标题: string; 值: number; 键: "音乐音量" | "音效音量" | "背景音效音量" };

interface 设置分组配置 {
  标题: string;
  行: 设置行配置[];
}

export class 设置界面 extends Phaser.Scene {
  private 视口 = { 宽: 0, 高: 0, 比例: 1 };
  private 结构签名 = "";
  private 滚动区?: 界面滚动区域;
  private 取消云订阅?: () => void;
  private 取消用户订阅?: () => void;
  private 云同步中 = false;
  private readonly 设置更新 = (): void => {
    if (this.获取结构签名() !== this.结构签名) this.重建界面();
  };
  private 获取结构签名(): string {
    const s = 获取游戏设置();
    return JSON.stringify([
      s.语言,
      s.样式,
      s.主题,
      s.背景主题,
      s.方块外观,
      s.旅行样式,
      s.旅行音乐,
      s.旅行音效,
      s.背景动态,
      s.省电模式,
      s.显示触屏提示,
    ]);
  }
  constructor() {
    super("设置界面");
  }

  create(): void {
    应用文字清晰度(this, 2);
    this.cameras.main.fadeIn(150, 8, 18, 25);
    this.滚动区 = undefined;
    this.重建界面();
    this.scale.on("resize", this.重建界面, this);
    window.addEventListener("gamemaker:settings-change", this.设置更新);
    window.addEventListener("keydown", this.处理关闭键);
    this.取消云订阅 = 订阅云同步状态(() => {
      if (this.sys.isActive()) this.重建界面();
    });
    this.取消用户订阅 = 订阅Tap用户身份(() => {
      if (this.sys.isActive()) this.重建界面();
    });
    void 刷新Tap用户身份().then(() => {
      if (this.sys.isActive()) this.重建界面();
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      window.removeEventListener("keydown", this.处理关闭键);
      this.scale.off("resize", this.重建界面, this);
      window.removeEventListener("gamemaker:settings-change", this.设置更新);
      this.取消云订阅?.();
      this.取消用户订阅?.();
    });
  }

  private readonly 处理关闭键 = (e: KeyboardEvent): void => {
    if (e.code === "Escape" && !e.repeat) {
      e.preventDefault();
      this.关闭();
    }
  };

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
      字号: 字号 ?? (this.视口.宽 < 520 ? "12px" : "15px"),
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
    const 按钮组宽 = 窄屏 ? 宽 : 宽 - 标签宽 - (标题 ? 10 : 0);
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

  private 创建音量行(
    标题: string,
    值: number,
    键: "音乐音量" | "音效音量" | "背景音效音量",
    宽: number,
  ): 界面布局 {
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

      name: `settings.${键 === "音乐音量" ? "music" : 键 === "背景音效音量" ? "ambient" : "sfx"}-volume.slider`,
      轨道色: 外观.轨道,
      强调色: 外观.强调色,
      变化: (新值) => {
        解锁程序音频();
        this.更新({ [键]: 新值 });
      },
    });
    滑块.on("change", (新值: number) => 文本.setLabel(`${标题}  ${新值}%`));
    const 行 = new 界面布局(this, 0, 0, { 方向: "水平", 宽, 高: 36, 间距: 12, 交叉轴对齐: "居中" });
    行.添加(文本, { 宽: 126, 高: 36 });
    行.添加(滑块, { 高: 32, 伸展: 1 });
    return 行;
  }

  private 创建外观行(标题: string, 选项: 设置选项[], 宽: number): 界面布局 {
    const 外观 = this.获取外观(),
      当前 = 获取游戏设置();
    const 容器 = new 界面布局(this, 0, 0, { 方向: "垂直", 宽, 高: 182 });
    const 舞台 = this.add.container(-宽 / 2, -91);
    容器.add(舞台);
    const 类型 =
      标题 === "背景" || 标题 === "Background"
        ? "背景"
        : 标题 === "方块外观" || 标题 === "Blocks"
          ? "方块"
          : "样式";
    const 卡片: 外观卡配置[] = 选项.map((项) => {
      const 原样式 =
        项.名称 === "settings.style.gilded-night"
          ? "夜空鎏金"
          : 项.名称 === "settings.style.warm-paper"
            ? "暖纸古典"
            : 项.名称 === "settings.style.neon-tide"
              ? "青蓝未来"
              : undefined;
      const 值 = 项.名称.replace(/^settings\.(background|blocks|travel-style)\./, "");
      const 地点 = 查找地点(值);
      const 配色 = 地点 ? 旅行主题表[地点.名称] : 界面主题(原样式 ?? 当前.样式);
      const 方块方案 =
        类型 === "方块" ? 方块外观方案表.find((方案) => 方案.名称 === 值) : undefined;
      const 背景值 = 类型 === "背景" ? 背景主题选项.find((背景) => 背景.值 === 值)?.值 : undefined;
      const 背景配色 = 背景值 ? 背景主题配置[背景值].预览配色 : undefined;
      return {
        名称: 项.名称,
        标签: 项.标签,
        宽: 108,
        高: 100,
        面板色: this.色值(外观.面板),
        背景色: 背景配色?.[0] ?? this.色值(配色.页面.背景),
        强调色: 背景配色?.[1] ?? this.色值(配色.文字.强调),
        类型,
        样式值: 原样式,
        背景值,
        方块方案: 方块方案?.名称,
        已选: 项.是否选中,
        选择: 项.选择,
      };
    });
    创建外观选择列表(
      this,
      舞台,
      宽,
      标题,
      卡片,
      `settings.appearance.${类型 === "方块" ? "blocks" : 类型 === "背景" ? "background" : "style"}`,
    );
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

    const 收藏 = new 旅行收藏(localStorage);
    return [
      {
        标题: 设置.语言 === "English" ? "General" : "常规",
        行: [
          {
            类型: "options",
            标题: 设置.语言 === "English" ? "Touch labels" : "触屏功能提示",
            选项: [
              单选("settings.touch-tips.on", "开", "开", 设置.显示触屏提示 ? "开" : "关", () =>
                this.更新({ 显示触屏提示: true }),
              ),
              单选("settings.touch-tips.off", "关", "关", 设置.显示触屏提示 ? "开" : "关", () =>
                this.更新({ 显示触屏提示: false }),
              ),
            ],
          },
          {
            类型: "options",
            标题: 设置.语言 === "English" ? "Background motion" : "动态背景",
            选项: [
              单选("settings.motion.on", "开", "开", 设置.背景动态 ? "开" : "关", () =>
                this.更新({ 背景动态: true }),
              ),
              单选("settings.motion.off", "关", "关", 设置.背景动态 ? "开" : "关", () =>
                this.更新({ 背景动态: false }),
              ),
            ],
          },
          {
            类型: "options",
            标题: 设置.语言 === "English" ? "Power saving" : "省电模式",
            选项: (["自动", "开", "关"] as const).map((值) =>
              单选(
                `settings.power-saving.${{ 自动: "auto", 开: "on", 关: "off" }[值]}`,
                设置.语言 === "English" ? { 自动: "Auto", 开: "On", 关: "Off" }[值] : 值,
                值,
                设置.省电模式,
                () => {
                  if (值 === "关") 清除实测低端();
                  this.更新({ 省电模式: 值 });
                },
              ),
            ),
          },
          {
            类型: "volume",
            标题: 设置.语言 === "English" ? "Music" : "音乐",
            值: 设置.音乐音量,
            键: "音乐音量",
          },
          {
            类型: "volume",
            标题: 设置.语言 === "English" ? "Effects" : "音效",
            值: 设置.音效音量,
            键: "音效音量",
          },
          {
            类型: "volume",
            标题: 设置.语言 === "English" ? "Ambience" : "背景音效",
            值: 设置.背景音效音量,
            键: "背景音效音量",
          },
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
              单选(
                "settings.style.gilded-night",
                文案.夜空鎏金,
                "夜空鎏金",
                设置.旅行样式 ?? 设置.样式,
                () => this.更新({ 样式: "夜空鎏金" }),
              ),
              单选(
                "settings.style.warm-paper",
                文案.暖纸古典,
                "暖纸古典",
                设置.旅行样式 ?? 设置.样式,
                () => this.更新({ 样式: "暖纸古典" }),
              ),
              单选(
                "settings.style.neon-tide",
                文案.青蓝未来,
                "青蓝未来",
                设置.旅行样式 ?? 设置.样式,
                () => this.更新({ 样式: "青蓝未来" }),
              ),
              ...地点皮肤表
                .filter((项) => 收藏.拥有(项.名称, "界面样式"))
                .map((项) =>
                  单选(
                    `settings.travel-style.${项.名称}`,
                    项.名称,
                    项.名称,
                    设置.旅行样式 ?? "",
                    () => this.更新({ 样式: "夜空鎏金", 旅行样式: 项.名称 }),
                  ),
                ),
            ],
          },
          {
            类型: "options",
            标题: 设置.语言 === "English" ? "Background" : "背景",
            选项: 背景主题选项
              .filter((项) =>
                查找地点(项.值)
                  ? 收藏.拥有(查找地点(项.值)?.名称 ?? "成都熊猫", "静态背景")
                  : !是基础背景(项.值) || 基础背景已解锁(项.值, localStorage),
              )
              .map((项目) =>
                单选(`settings.background.${项目.值}`, 项目.标签, 项目.值, 设置.背景主题, () =>
                  this.更新({ 背景主题: 项目.值 }),
                ),
              ),
          },
          {
            类型: "options",
            标题: 设置.语言 === "English" ? "Blocks" : "方块外观",
            选项: 方块外观方案表
              .filter(
                (项) =>
                  !查找地点(项.名称) ||
                  收藏.拥有(查找地点(项.名称)?.名称 ?? "成都熊猫", "方块外观"),
              )
              .map((项) =>
                单选(
                  `settings.blocks.${项.名称}`,
                  设置.语言 === "English" ? 项.英文 : 项.名称,
                  项.名称,
                  设置.方块外观,
                  () => this.更新({ 方块外观: 项.名称 }),
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
              行配置.标题 === "Background" ||
              行配置.标题 === "方块外观" ||
              行配置.标题 === "Blocks"
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
    this.视口 = 适配场景视口(this, 1440, 900);
    const 滚动位置 = this.滚动区?.获取滚动位置() ?? 0;
    this.结构签名 = this.获取结构签名();
    const 设置 = 获取游戏设置();
    const 文案 = this.获取文案();
    const 外观 = this.获取外观();
    const 宽 = this.视口.宽;
    const 高 = this.视口.高;
    const 面板宽 = Math.min(740, 宽 - 32);
    const 左 = (宽 - 面板宽) / 2;

    for (const 对象 of [...this.children.list]) 对象.destroy();
    this.cameras.main.setBackgroundColor("rgba(0,0,0,0)");
    const 内容X = 左 + 14;
    const 内容宽 = 面板宽 - 28;
    // 先量出内容真实高度再定面板高度与页脚位置，避免窄屏时下拉行被页脚按钮压住
    const 内容布局 = this.绘制设置分组(内容X + 4, 0, 内容宽 - 8, this.创建设置分组(设置, 文案));
    const 内容高 = 内容布局.height;
    const 面板高 = Math.min(高 - 24, Math.max(460, 内容高 + 72 + 78 + 26));
    const 上 = (高 - 面板高) / 2;
    this.add
      .rectangle(宽 / 2, 高 / 2, 宽, 高, this.色值(外观.遮罩), 0.76)
      .setInteractive()
      .setDepth(-2)
      .on(
        "pointerdown",
        (
          pointer: Phaser.Input.Pointer,
          _x: number,
          _y: number,
          事件: Phaser.Types.Input.EventData,
        ) => {
          事件.stopPropagation();
          if (
            pointer.worldX < 左 ||
            pointer.worldX > 左 + 面板宽 ||
            pointer.worldY < 上 ||
            pointer.worldY > 上 + 面板高
          )
            this.关闭();
        },
      );
    this.add
      .rectangle(宽 / 2, 高 / 2, 面板宽, 面板高, this.色值(获取游戏背景色(设置)), 0.98)
      .setStrokeStyle(1, this.色值(外观.强调色), 0.75)
      .setDepth(-1);
    内容布局.setPosition(内容X + 4 + (内容宽 - 8) / 2, 上 + 72 + 内容高 / 2);
    const 滚动区 = new 界面滚动区域(this, {
      左: 内容X,
      上: 上 + 65,
      宽: 内容宽,
      高: Math.max(100, 面板高 - 166),
      内容高: 内容高 + 12,
      允许控件拖动: true,
      显示滚动条: false,
    });
    滚动区.内容容器.add(内容布局);
    滚动区.设置滚动位置(滚动位置).刷新交互裁剪();
    this.滚动区 = 滚动区;
    // 不放右上角关闭：易与小游戏外层关闭误触；仅保留底栏「完成」。
    new 界面文字(this, 宽 / 2, 上 + 31, {
      宽: 内容宽,
      高: 42,
      文案: 文案.设置,
      字号: "25px",
      颜色: 外观.强调色,
      对齐: "左",
    });

    const 英文 = 解析语言(设置.语言) !== "简体中文";
    const 云状态 = 读取云同步状态();
    const 云文案 = this.云同步中 ? (英文 ? "Syncing…" : "同步中…") : 格式化云同步文案(云状态, 英文);
    // 窄屏：状态独占一行，按钮另起一行，避免「云存档已同步 · 时间」与恢复默认/立即同步/完成重叠。
    const 页脚高 = 78;
    const 页脚 = new 界面布局(this, 宽 / 2, 上 + 面板高 - 页脚高 / 2 - 10, {
      方向: "垂直",
      宽: 内容宽,
      高: 页脚高,
      间距: 6,
      主轴对齐: "居中",
      交叉轴对齐: "拉伸",
    });
    页脚.添加(
      new 界面文字(this, 0, 0, {
        宽: 内容宽,
        高: 28,
        文案: 云文案,
        字号: "11px",
        颜色: 外观.次要文字 ?? 外观.正文,
        对齐: "左",
      }),
      { 宽: 内容宽, 高: 28 },
    );
    const 钮行 = new 界面布局(this, 0, 0, {
      方向: "水平",
      宽: 内容宽,
      高: 38,
      间距: 8,
      主轴对齐: "末尾",
      交叉轴对齐: "居中",
    });
    const 同步宽 = 英文 ? 96 : 88;
    钮行.添加(
      this.创建按钮(
        0,
        0,
        同步宽,
        34,
        英文 ? "Sync now" : "立即同步",
        "settings.cloud-sync",
        () => {
          if (this.云同步中) return;
          this.云同步中 = true;
          this.重建界面();
          void 立即同步云存档()
            .catch(() => undefined)
            .finally(() => {
              this.云同步中 = false;
              if (this.sys.isActive()) this.重建界面();
            });
        },
      ),
      { 宽: 同步宽, 高: 34 },
    );
    钮行.添加(this.创建按钮(0, 0, 80, 34, 文案.恢复默认, "settings.defaults", this.恢复默认), {
      宽: 80,
      高: 34,
    });
    钮行.添加(
      this.创建按钮(0, 0, 56, 34, 文案.完成, "settings.done", () => this.关闭(), true),
      { 宽: 56, 高: 34 },
    );
    页脚.添加(钮行, { 宽: 内容宽, 高: 38 });
  };

  private 更新(变化: Partial<游戏设置>): void {
    const 设置 = 更新游戏设置(变化);
    应用游戏设置(设置);
  }

  private 恢复默认 = (): void => {
    this.更新({ ...默认设置 });
    this.重建界面();
  };

  private 关闭(): void {
    关闭覆盖页面(this, 返回页面);
  }
}
