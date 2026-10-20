import type { Tap排行榜分数 } from "../../../框架/平台/TapTap/宿主类型";
import { type 滚动容器, 滚动容器 as 滚动容器类 } from "../../../框架Three/界面/控件/滚动容器";
import type { 文字项, 矩形 } from "../../../组件/绘制/图形对象";
import { 绘制霓虹按钮, 读取霓虹按钮文字样式 } from "../../../组件/霓虹街机/按钮配方";
import { 派生霓虹文字样式 } from "../../../组件/霓虹街机/文字样式";
import { 绘制页签, 读取页面语义色, type 页面语义色 } from "../../../组件/霓虹街机/页面配方";
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
import type { 页面上下文 } from "../接口/上下文";
import { 页面基类 } from "./页面工具";

/**
 * 排行榜页（7C）：与 Phaser 版同构——标题 + 周期页签 + 我的状态 + 榜单行 + 返回按钮。
 * 视觉来自共享配方（页面配方/按钮配方/文字样式），滚动与命中用 GM Three 控件能力自绘。
 */

const 行高 = 52;

interface 榜面缓存 {
  状态文案: string;
  分数列表: readonly Tap排行榜分数[];
  需登录?: boolean;
}

export class 排行榜界面 extends 页面基类 {
  private 模式: 游戏模式 = "马拉松";
  private 周期: 排行榜周期 = "总";
  private 滚动: 滚动容器 | null = null;
  private 滚动位置 = 0;
  private 缓存: 榜面缓存 = { 状态文案: "", 分数列表: [] };
  private 加载中 = false;
  private 色: 页面语义色 = 读取页面语义色(this.上下文.服务.设置.读取().样式);

  constructor(上下文: 页面上下文) {
    super(上下文, { 名称: "排行榜", 独占: true, 背景: false });
  }

  进入(): void {
    this.模式 = this.上下文.参数.模式 ?? "马拉松";
    this.周期 = "总";
    this.缓存 = { 状态文案: "", 分数列表: [] };
    super.进入();
    void this.刷新在线榜();
  }

  protected 构建(): void {
    this.滚动位置 = this.滚动?.读取滚动位置() ?? this.滚动位置;
    this.控件层.清空();
    this.色 = 读取页面语义色(this.上下文.服务.设置.读取().样式);
    const 英文 = this.上下文.服务.语言.是否英文();
    const 签宽 = Math.min(72, (this.逻辑宽 - 48) / 4 - 6);
    排行榜周期顺序.forEach((周期, i) => {
      const 矩形 = {
        左: 24 + i * (签宽 + 8),
        上: 51,
        宽: 签宽,
        高: 34,
      };
      this.创建热区({
        名称: `排行榜周期:${周期}`,
        矩形,
        点击: () => {
          if (this.周期 === 周期 || this.加载中) return;
          this.周期 = 周期;
          this.缓存 = { 状态文案: 英文 ? "Loading…" : "加载中…", 分数列表: [] };
          this.重建();
          void this.刷新在线榜();
        },
      });
    });
    const 列表顶 = 128;
    this.滚动 = new 滚动容器类({
      矩形: {
        左: 16,
        上: 列表顶,
        宽: this.逻辑宽 - 32,
        高: this.逻辑高 - 200,
      },
      内容高: Math.max(40, this.缓存.分数列表.length * 行高 + 8),
      显示滚动条: false,
      惯性: true,
    });
    this.控件层.添加(this.滚动);
    this.滚动.设置滚动位置(this.滚动位置);
    this.滚动位置 = this.滚动.读取滚动位置();
    this.创建热区({
      名称: "返回主菜单",
      矩形: { 左: this.逻辑宽 / 2 - 170, 上: this.逻辑高 - 56, 宽: 160, 高: 40 },
      点击: () => this.上下文.导航.返回(),
    });
    this.创建热区({
      名称: "登录 Tap",
      矩形: { 左: this.逻辑宽 / 2 + 10, 上: this.逻辑高 - 56, 宽: 160, 高: 40 },
      点击: () => {
        void 请求Tap登录().then((结果) => {
          this.缓存.状态文案 = 结果.完成
            ? 英文
              ? "Signed in, refreshing…"
              : "登录成功，正在刷新…"
            : 结果.原因;
          this.重建();
          if (结果.完成) void this.刷新在线榜();
        });
      },
    });
  }

  protected 绘制内容(): void {
    const 画笔 = this.上下文.资源.画笔;
    const 图形 = 画笔.图形;
    if (!this.滚动) return;
    const 英文 = this.上下文.服务.语言.是否英文();
    const 色 = this.色;
    图形.fillStyle(色.面板, 1).fillRect(0, 0, this.逻辑宽, this.逻辑高);
    画笔.绘制文字(
      生成页面文字项(
        "中中",
        this.逻辑宽 / 2,
        28,
        22,
        色.正文,
        "粗体",
        "中",
        `${this.模式} ${英文 ? "LEADERBOARD" : "排行榜"}`,
      ),
    );
    const 签宽 = Math.min(72, (this.逻辑宽 - 48) / 4 - 6);
    const 标签 = 排行榜周期标签;
    排行榜周期顺序.forEach((周期, i) => {
      const 矩形 = { 左: 24 + i * (签宽 + 8), 上: 51, 宽: 签宽, 高: 34 };
      const 选中 = this.周期 === 周期;
      绘制页签(图形, 矩形, 选中, 色.按钮底, 色.强调, 8);
      画笔.绘制文字(
        生成页面文字项(
          "中中",
          矩形.左 + 矩形.宽 / 2,
          矩形.上 + 矩形.高 / 2,
          13,
          选中 ? 色.强调 : 色.正文,
          "常规",
          "中",
          英文 ? 标签[周期].英文 : 标签[周期].中文,
        ),
      );
    });
    const 状态 = this.加载中 ? (英文 ? "Loading…" : "加载中…") : this.缓存.状态文案;
    if (状态)
      画笔.绘制文字({
        文案: 状态,
        样式: 派生霓虹文字样式("正文", { 字号: 12, 颜色: 色.次要, 对齐: "中" }),
        锚点: "中上",
        x: this.逻辑宽 / 2,
        y: 112,
        最大宽: Math.max(160, this.逻辑宽 - 48),
      });
    const 可视 = this.滚动.读取可视矩形();
    const 偏移 = this.滚动.读取滚动位置();
    const 文字偏移 = { x: 可视.左, y: 可视.上 - 偏移 };
    画笔.压入裁剪(可视);
    图形.save();
    图形.translateCanvas(可视.左, 可视.上 - 偏移);
    const 行宽 = this.逻辑宽 - 44;
    this.缓存.分数列表.forEach((项, i) => {
      const 行矩形: 矩形 = { 左: 0, 上: i * 行高, 宽: 行宽, 高: 行高 - 8 };
      图形
        .fillStyle(色.按钮底, 0.65)
        .fillRoundedRect(行矩形.左, 行矩形.上, 行矩形.宽, 行矩形.高, 10);
      const 名 = 项.user?.name || (英文 ? "Player" : "玩家");
      const 排名 = 项.rankDisplay ?? String(项.rank ?? i + 1);
      const 分 = 项.scoreDisplay ?? 格式化榜分数(this.模式, 项.score);
      画笔.绘制文字(
        移位(
          生成页面文字项("左上", 12, 行矩形.上 + 12, 14, 色.强调, "粗体", "左", `#${排名}`),
          文字偏移,
        ),
      );
      画笔.绘制文字(
        移位(生成页面文字项("左上", 64, 行矩形.上 + 12, 14, 色.正文, "常规", "左", 名), 文字偏移),
      );
      画笔.绘制文字(
        移位(
          生成页面文字项("右上", 行宽 - 12, 行矩形.上 + 12, 14, 色.正文, "常规", "右", 分),
          文字偏移,
        ),
      );
    });
    图形.restore();
    画笔.弹出裁剪();
    for (const [i, 文案] of [英文 ? "Back" : "返回", 英文 ? "Sign in" : "登录 Tap"].entries()) {
      const 按钮矩形 = {
        左: this.逻辑宽 / 2 - 170 + i * 180,
        上: this.逻辑高 - 56,
        宽: 160,
        高: 40,
      };
      绘制霓虹按钮(图形, 按钮矩形.左 + 80, 按钮矩形.上 + 20, 160, 40, { 变体: "次要" });
      画笔.绘制文字({
        文案,
        样式: 读取霓虹按钮文字样式({ 变体: "次要", 字号: 15 }),
        锚点: "中中",
        x: 按钮矩形.左 + 80,
        y: 按钮矩形.上 + 20,
      });
    }
    if (
      !this.缓存.分数列表.length &&
      !this.加载中 &&
      !this.缓存.需登录 &&
      this.缓存.状态文案.includes("我的")
    )
      画笔.绘制文字(
        生成页面文字项(
          "中中",
          this.逻辑宽 / 2,
          168,
          14,
          色.次要,
          "常规",
          "中",
          英文 ? "No scores yet" : "暂无上榜成绩",
        ),
      );
  }

  protected 读取文字快照(): readonly string[] {
    const 当地 = this.上下文.服务.纪录.读取(
      this.模式,
      this.模式 === "每日挑战" ? this.上下文.服务.当日日期() : undefined,
    );
    return [
      `模式:${this.模式}`,
      `周期:${this.周期}`,
      `状态:${this.缓存.状态文案}`,
      `我的:${this.缓存.状态文案.startsWith("我的") || this.缓存.状态文案.startsWith("Me:") ? this.缓存.状态文案 : "无"}`,
      `行数:${this.缓存.分数列表.length}`,
      `滚动:${this.滚动?.读取滚动位置() ?? 0}`,
      `本地最佳:${
        当地
          ? this.模式 === "冲刺"
            ? `${typeof 当地.用时 === "number" ? (当地.用时 / 1000).toFixed(2) : "—"}s`
            : 当地.分数
          : 0
      }`,
      `在线:${this.上下文.服务.平台.是否可用() ? "可用" : "仅本地"}`,
    ];
  }

  private async 刷新在线榜(): Promise<void> {
    const 英文 = this.上下文.服务.语言.是否英文();
    if (this.加载中) return;
    this.加载中 = true;
    this.缓存 = { 状态文案: 英文 ? "Loading…" : "加载中…", 分数列表: [] };
    this.重建();
    const 结果 = await 加载排行榜数据({ 模式: this.模式, 周期: this.周期, 条数: 20 });
    this.加载中 = false;
    const 我的 = 结果.我的;
    const 我的行 =
      我的 && (我的.rank != null || 我的.score != null)
        ? 英文
          ? `Me: #${我的.rankDisplay ?? 我的.rank ?? "—"} · ${我的.scoreDisplay ?? 格式化榜分数(this.模式, 我的.score)}`
          : `我的：第 ${我的.rankDisplay ?? 我的.rank ?? "—"} 名 · ${我的.scoreDisplay ?? 格式化榜分数(this.模式, 我的.score)}`
        : 英文
          ? "Me: no score yet"
          : "我的：暂无成绩";
    this.缓存 = {
      状态文案: 结果.完成
        ? `${我的行}${结果.当前周期展示 ? ` · ${结果.当前周期展示}` : ""}`
        : 结果.需登录
          ? 英文
            ? "Please sign in to TapTap first."
            : "尚未登录 TapTap，请点下方登录后再查看。"
          : 格式化排行榜错误(结果.代码, 结果.原因, 英文),
      分数列表: 结果.完成 ? 结果.分数列表 : [],
      需登录: 结果.需登录,
    };
    this.重建();
  }
}

function 生成页面文字项(
  锚点: 文字项["锚点"],
  x: number,
  y: number,
  字号: number,
  颜色: number,
  字重: "常规" | "粗体",
  对齐: "左" | "中" | "右",
  文案: string,
): 文字项 {
  return {
    文案,
    样式: 派生霓虹文字样式("正文", { 字号, 颜色, 字重, 对齐 }),
    锚点,
    x,
    y,
  };
}

function 移位(项: 文字项, 偏移: { x: number; y: number }): 文字项 {
  return { ...项, x: 项.x + 偏移.x, y: 项.y + 偏移.y };
}
