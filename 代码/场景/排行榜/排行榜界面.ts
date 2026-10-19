import Phaser from "phaser";
import type { Tap排行榜分数 } from "../../../框架/平台/TapTap/宿主类型";
import { 适配场景视口 } from "../../../框架/界面/响应式视口";
import { 界面按钮 } from "../../../框架/界面/按钮";
import { 应用文字清晰度 } from "../../../框架/界面/文字清晰度";
import { 界面滚动区域 } from "../../../框架/界面/滚动区域";
import { 关闭覆盖页面 } from "../../../框架/页面切换";
import {
  加载排行榜数据,
  type 排行榜周期,
  排行榜周期顺序,
  格式化排行榜错误,
  格式化榜分数,
} from "../../平台/排行榜";
import { 请求Tap登录 } from "../../平台/登录";
import { 排行榜周期标签 } from "../../平台/配置";
import type { 游戏模式 } from "../../玩法/再消一行";
import { 解析语言 } from "../../配置/再消一行文案";
import { 获取游戏设置 } from "../../配置/再消一行设置";
import { 界面主题, 颜色值 } from "../../配置/界面主题";

interface 榜面缓存 {
  状态文案: string;
  分数列表: Tap排行榜分数[];
  我的?: Tap排行榜分数 | null;
  周期展示?: string;
  需登录?: boolean;
}

export class 排行榜界面 extends Phaser.Scene {
  private 视口 = { 宽: 0, 高: 0, 比例: 1 };
  private 模式: 游戏模式 = "马拉松";
  private 周期: 排行榜周期 = "总";
  private 加载中 = false;
  private 缓存: 榜面缓存 = { 状态文案: "", 分数列表: [] };

  constructor() {
    super("排行榜界面");
  }

  init(数据: { 模式?: 游戏模式; 周期?: 排行榜周期 } = {}): void {
    this.模式 = 数据.模式 ?? "马拉松";
    this.周期 = 数据.周期 ?? "总";
    this.缓存 = { 状态文案: "", 分数列表: [] };
  }

  create(): void {
    应用文字清晰度(this);
    this.cameras.main.fadeIn(120, 8, 18, 25);
    this.缓存.状态文案 = this.t("加载中…", "Loading…");
    this.布局();
    this.scale.on("resize", this.布局, this);
    window.addEventListener("keydown", this.按键);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off("resize", this.布局, this);
      window.removeEventListener("keydown", this.按键);
    });
    void this.刷新数据();
  }

  private readonly 按键 = (e: KeyboardEvent) => {
    if (e.code === "Escape") this.返回();
  };

  private 返回 = () => 关闭覆盖页面(this, "开始菜单");

  private 英文(): boolean {
    return 解析语言(获取游戏设置().语言) !== "简体中文";
  }

  private t(zh: string, en: string): string {
    return this.英文() ? en : zh;
  }

  private 布局 = (): void => {
    this.视口 = 适配场景视口(this, 1440, 900);
    for (const 对象 of [...this.children.list]) 对象.destroy();
    const w = this.视口.宽;
    const h = this.视口.高;
    const theme = 界面主题();
    this.add.rectangle(w / 2, h / 2, w, h, 颜色值(theme.面板.主面板.背景));

    this.add
      .text(w / 2, 28, this.t(`${this.模式} 排行榜`, `${this.模式} LEADERBOARD`), {
        fontSize: "22px",
        color: theme.文字.主要,
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setName("leaderboard.title");

    const 签宽 = Math.min(72, (w - 48) / 4 - 6);
    排行榜周期顺序.forEach((周期, i) => {
      const 标签 = this.英文() ? 排行榜周期标签[周期].英文 : 排行榜周期标签[周期].中文;
      const 选中 = this.周期 === 周期;
      new 界面按钮(this, 24 + 签宽 / 2 + i * (签宽 + 8), 68, {
        宽: 签宽,
        高: 34,
        文案: 标签,
        name: `leaderboard.period.${周期}`,
        点击: () => {
          if (this.周期 === 周期 || this.加载中) return;
          this.周期 = 周期;
          this.缓存 = { 状态文案: this.t("加载中…", "Loading…"), 分数列表: [] };
          this.布局();
          void this.刷新数据();
        },
        已选: 选中,
        面板色: theme.按钮.次要.默认.背景,
        强调色: theme.文字.强调,
        文字色: 选中 ? theme.文字.强调 : theme.文字.主要,
        字号: "13px",
      });
    });

    this.add
      .text(w / 2, 112, this.缓存.状态文案, {
        fontSize: "12px",
        color: theme.文字.次要,
        wordWrap: { width: Math.max(160, w - 48) },
        align: "center",
      })
      .setOrigin(0.5, 0)
      .setName("leaderboard.status");

    const 行高 = 52;
    const 列表 = this.缓存.分数列表;
    const 滚动 = new 界面滚动区域(this, {
      左: 16,
      上: 128,
      宽: w - 32,
      高: h - 200,
      内容高: Math.max(40, 列表.length * 行高 + 8),
      显示滚动条: false,
    });

    if (!列表.length && !this.加载中 && this.缓存.状态文案 && !this.缓存.需登录) {
      const 空 =
        this.缓存.分数列表.length === 0 && this.缓存.状态文案.includes("我的")
          ? this.t("暂无上榜成绩", "No scores yet")
          : "";
      if (空)
        this.add
          .text(w / 2, 168, 空, { fontSize: "14px", color: theme.文字.次要 })
          .setOrigin(0.5)
          .setName("leaderboard.empty");
    }

    列表.forEach((项, i) => {
      const y = 128 + i * 行高;
      const 行 = this.add.container(16, y);
      const g = this.add.graphics();
      g.fillStyle(颜色值(theme.按钮.次要.默认.背景), 0.65).fillRoundedRect(
        0,
        0,
        w - 44,
        行高 - 8,
        10,
      );
      const 名 = 项.user?.name || this.t("玩家", "Player");
      const 排名 = 项.rankDisplay ?? String(项.rank ?? i + 1);
      const 分 = 项.scoreDisplay ?? 格式化榜分数(this.模式, 项.score);
      行.add([
        g,
        this.add.text(12, 12, `#${排名}`, {
          fontSize: "14px",
          color: theme.文字.强调,
          fontStyle: "bold",
        }),
        this.add.text(64, 12, 名, { fontSize: "14px", color: theme.文字.主要 }),
        this.add.text(w - 56, 12, 分, { fontSize: "14px", color: theme.文字.主要 }).setOrigin(1, 0),
      ]);
      滚动.内容容器.add(行);
      滚动.注册可视内容(行, y, 行高);
    });

    new 界面按钮(this, w / 2 - 90, h - 36, {
      宽: 160,
      高: 40,
      文案: this.t("返回", "Back"),
      name: "leaderboard.back",
      点击: this.返回,
      面板色: theme.按钮.次要.默认.背景,
      强调色: theme.文字.强调,
      文字色: theme.文字.主要,
    });
    new 界面按钮(this, w / 2 + 90, h - 36, {
      宽: 160,
      高: 40,
      文案: this.t("登录 Tap", "Sign in"),
      name: "leaderboard.login",
      点击: () => {
        void 请求Tap登录().then((r) => {
          this.缓存.状态文案 = r.完成
            ? this.t("登录成功，正在刷新…", "Signed in, refreshing…")
            : r.原因;
          this.布局();
          if (r.完成) void this.刷新数据();
        });
      },
      面板色: theme.按钮.次要.默认.背景,
      强调色: theme.文字.强调,
      文字色: theme.文字.主要,
    });
  };

  private async 刷新数据(): Promise<void> {
    if (this.加载中) return;
    this.加载中 = true;
    this.缓存.状态文案 = this.t("加载中…", "Loading…");
    this.布局();
    const 结果 = await 加载排行榜数据({ 模式: this.模式, 周期: this.周期, 条数: 20 });
    this.加载中 = false;
    if (!this.sys.isActive()) return;

    if (!结果.完成) {
      this.缓存 = {
        状态文案: 结果.需登录
          ? this.t("尚未登录 TapTap，请点下方登录后再查看。", "Please sign in to TapTap first.")
          : 格式化排行榜错误(结果.代码, 结果.原因, this.英文()),
        分数列表: [],
        需登录: 结果.需登录,
      };
      this.布局();
      return;
    }

    const 我的行 =
      结果.我的 && (结果.我的.rank != null || 结果.我的.score != null)
        ? this.t(
            `我的：第 ${结果.我的.rankDisplay ?? 结果.我的.rank ?? "—"} 名 · ${
              结果.我的.scoreDisplay ?? 格式化榜分数(this.模式, 结果.我的.score)
            }`,
            `Me: #${结果.我的.rankDisplay ?? 结果.我的.rank ?? "—"} · ${
              结果.我的.scoreDisplay ?? 格式化榜分数(this.模式, 结果.我的.score)
            }`,
          )
        : this.t("我的：暂无成绩", "Me: no score yet");
    const 周期提示 = 结果.当前周期展示 ? ` · ${结果.当前周期展示}` : "";
    this.缓存 = {
      状态文案: `${我的行}${周期提示}`,
      分数列表: 结果.分数列表,
      我的: 结果.我的,
      周期展示: 结果.当前周期展示,
    };
    this.布局();
  }
}
