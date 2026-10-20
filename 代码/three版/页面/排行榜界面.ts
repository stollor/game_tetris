import type { Tap排行榜分数 } from "../../../框架/平台/TapTap/宿主类型";
import { 绘制矩形描边, 绘制面板 } from "../../../框架Three/界面/控件/工具";
import { 文本行, 绘制文本行 } from "../../../框架Three/界面/控件/文本行";
import type { 滚动容器 } from "../../../框架Three/界面/控件/滚动容器";
import type { 控件接口, 矩形, 绘制环境 } from "../../../框架Three/界面/控件/类型";
import { 页签 } from "../../../框架Three/界面/控件/页签";
import { 格式化榜分数 } from "../../平台/排行榜";
import type { 游戏模式 } from "../../玩法/再消一行";
import { 游戏模式顺序 } from "../../配置/游戏外观";
import type { 页面上下文 } from "../接口/上下文";
import { 创建滚动区域, 页面基类 } from "./页面工具";

/**
 * 排行榜页：优先 TapTap 在线榜（可用时），不可用/失败时降级为本地纪录展示；
 * 每日挑战按当天日期读取本地纪录，不报错、不空屏。
 */

const 顶栏高 = 64;
const 页签高 = 36;

interface 榜面缓存 {
  状态: string;
  列表: readonly Tap排行榜分数[];
  加载中: boolean;
}

export class 排行榜界面 extends 页面基类 {
  private 模式: 游戏模式 = "马拉松";
  private 滚动: 滚动容器 | null = null;
  private 缓存: 榜面缓存 = { 状态: "", 列表: [], 加载中: false };

  constructor(上下文: 页面上下文) {
    super(上下文, { 名称: "排行榜", 独占: true });
  }

  进入(): void {
    super.进入();
    void this.刷新在线榜();
  }

  protected 构建(): void {
    const 英文 = this.上下文.服务.语言.是否英文();
    const 已选 = 游戏模式顺序.indexOf(this.模式);
    this.添加控件(
      new 页签({
        矩形: { 左: 14, 上: 顶栏高 + 8, 宽: this.逻辑宽 - 28, 高: 页签高 },
        条目: 游戏模式顺序.map((模式) => (英文 ? 英文模式名(模式) : 模式)),
        已选: Math.max(0, 已选),
        变化: (序号) => {
          this.模式 = 游戏模式顺序[序号] ?? "马拉松";
          this.缓存 = { 状态: "", 列表: [], 加载中: false };
          this.重建();
          void this.刷新在线榜();
        },
      }),
    );
    const 列表顶 = 顶栏高 + 页签高 + 64;
    this.滚动 = 创建滚动区域(this.控件层, {
      矩形: { 左: 0, 上: 列表顶, 宽: this.逻辑宽, 高: this.逻辑高 - 列表顶 - 8 },
      内容高: Math.max(320, 312 + this.缓存.列表.length * 54),
      显示滚动条: true,
      惯性: true,
    });
    this.添加本地纪录行(英文);
    this.添加各模式纪录(英文);
    this.缓存.列表.forEach((项, 序号) => {
      this.添加在线行(项, 序号, 英文);
    });
    this.添加返回按钮(英文 ? "Back" : "返回主菜单");
  }

  protected 绘制内容(环境: 绘制环境): void {
    const 英文 = this.上下文.服务.语言.是否英文();
    this.绘制顶栏(环境, `${英文 ? "LEADERBOARD" : "排行榜"} · ${this.模式}`);
    const 状态 = this.缓存.加载中 ? (英文 ? "Loading…" : "加载中…") : this.缓存.状态;
    if (状态)
      绘制文本行(环境, { 左: 16, 上: 顶栏高 + 页签高 + 8, 宽: this.逻辑宽 - 32, 高: 48 }, 状态, {
        字号档: "小",
        颜色: 环境.配色.弱字,
        最大行数: 2,
      });
  }

  protected 读取文字快照(): readonly string[] {
    const 当地 = this.上下文.服务.纪录.读取(
      this.模式,
      this.模式 === "每日挑战" ? this.上下文.服务.当日日期() : undefined,
    );
    return [
      `模式:${this.模式}`,
      `本地最佳:${当地 ? (this.模式 === "冲刺" ? `${typeof 当地.用时 === "number" ? (当地.用时 / 1000).toFixed(2) : "—"}s` : 当地.分数) : 0}`,
      `在线:${this.上下文.服务.平台.是否可用() ? "可用" : "仅本地"}`,
    ];
  }

  private 添加本地纪录行(英文: boolean): void {
    const 容器 = this.滚动;
    if (!容器) return;
    const 今日 = this.上下文.服务.当日日期();
    const 纪录 = this.上下文.服务.纪录.读取(this.模式, this.模式 === "每日挑战" ? 今日 : undefined);
    const 矩形: 矩形 = { 左: 12, 上: 10, 宽: this.逻辑宽 - 24, 高: 64 };
    容器.添加(new 行底板(矩形));
    容器.添加(
      new 文本行({
        矩形: { 左: 矩形.左 + 14, 上: 矩形.上 + 8, 宽: 矩形.宽 - 28, 高: 24 },
        文本: 英文 ? "Local best" : "本地最佳纪录",
        字号档: "小",
        对齐: "左",
        颜色: this.环境.配色.次字,
      }),
    );
    const 内容 = 纪录
      ? this.模式 === "冲刺"
        ? `${typeof 纪录.用时 === "number" ? (纪录.用时 / 1000).toFixed(2) : "—"}s · ${纪录.消行数 ?? 0} 行`
        : `${纪录.分数.toLocaleString()} 分 · 等级 ${纪录.等级 ?? 1} · ${纪录.消行数 ?? 0} 行`
      : this.模式 === "每日挑战"
        ? 英文
          ? "No score today"
          : "今日暂无纪录"
        : 英文
          ? "No score yet"
          : "暂无纪录";
    容器.添加(
      new 文本行({
        矩形: { 左: 矩形.左 + 14, 上: 矩形.上 + 32, 宽: 矩形.宽 - 28, 高: 28 },
        文本: 内容,
        字号档: "中",
        对齐: "左",
        颜色: this.环境.配色.强调,
      }),
    );
  }

  /** 各模式本地纪录一览：满足「本地纪录按模式/每日挑战展示」。 */
  private 添加各模式纪录(英文: boolean): void {
    const 容器 = this.滚动;
    if (!容器) return;
    const 今日 = this.上下文.服务.当日日期();
    游戏模式顺序.forEach((模式, 序号) => {
      const 上 = 86 + 序号 * 52;
      const 矩形: 矩形 = { 左: 12, 上, 宽: this.逻辑宽 - 24, 高: 44 };
      const 当前 = 模式 === this.模式;
      const 纪录 = this.上下文.服务.纪录.读取(模式, 模式 === "每日挑战" ? 今日 : undefined);
      容器.添加(new 行底板(矩形, 当前));
      容器.添加(
        new 文本行({
          矩形: { 左: 矩形.左 + 12, 上: 矩形.上 + 10, 宽: 150, 高: 24 },
          文本: 英文 ? 英文模式名(模式) : 模式,
          字号档: "小",
          对齐: "左",
          颜色: 当前 ? this.环境.配色.强调 : this.环境.配色.主字,
        }),
      );
      const 值 = 纪录
        ? 模式 === "冲刺"
          ? `${typeof 纪录.用时 === "number" ? (纪录.用时 / 1000).toFixed(2) : "—"}s`
          : 纪录.分数.toLocaleString()
        : "—";
      容器.添加(
        new 文本行({
          矩形: { 左: 矩形.左 + 矩形.宽 - 160, 上: 矩形.上 + 10, 宽: 148, 高: 24 },
          文本: 模式 === "每日挑战" ? `${格式化日期(今日)}  ${值}` : 值,
          字号档: "小",
          对齐: "右",
          颜色: 纪录 ? this.环境.配色.强调 : this.环境.配色.弱字,
        }),
      );
    });
  }

  private 添加在线行(项: Tap排行榜分数, 序号: number, 英文: boolean): void {
    const 容器 = this.滚动;
    if (!容器) return;
    const 矩形: 矩形 = {
      左: 12,
      上: 312 + 序号 * 54,
      宽: this.逻辑宽 - 24,
      高: 46,
    };
    容器.添加(new 行底板(矩形));
    容器.添加(
      new 文本行({
        矩形: { 左: 矩形.左 + 12, 上: 矩形.上 + 10, 宽: 60, 高: 26 },
        文本: `#${项.rankDisplay ?? 项.rank ?? 序号 + 1}`,
        字号档: "小",
        对齐: "左",
        颜色: this.环境.配色.强调,
      }),
    );
    容器.添加(
      new 文本行({
        矩形: { 左: 矩形.左 + 70, 上: 矩形.上 + 10, 宽: 170, 高: 26 },
        文本: 项.user?.name || (英文 ? "Player" : "玩家"),
        字号档: "小",
        对齐: "左",
      }),
    );
    容器.添加(
      new 文本行({
        矩形: { 左: 矩形.左 + 矩形.宽 - 120, 上: 矩形.上 + 10, 宽: 104, 高: 26 },
        文本: 项.scoreDisplay ?? 格式化榜分数(this.模式, 项.score),
        字号档: "小",
        对齐: "右",
      }),
    );
  }

  private async 刷新在线榜(): Promise<void> {
    if (!this.上下文.服务.平台.是否可用()) {
      this.缓存 = {
        状态: this.上下文.服务.语言.是否英文()
          ? "Showing local records (TapTap unavailable)"
          : "当前环境仅显示本地纪录（TapTap 不可用）",
        列表: [],
        加载中: false,
      };
      this.请求重绘();
      return;
    }
    this.缓存 = { ...this.缓存, 加载中: true, 状态: "" };
    this.重建();
    const 结果 = await this.上下文.服务.平台.加载排行榜(this.模式, "总");
    this.缓存 = {
      状态: 结果.完成
        ? this.上下文.服务.语言.是否英文()
          ? "Live leaderboard"
          : "在线排行榜"
        : (结果.原因 ?? (this.上下文.服务.语言.是否英文() ? "Unavailable" : "排行榜不可用")),
      列表: 结果.完成 ? 结果.分数列表 : [],
      加载中: false,
    };
    if (this.控件层.读取控件列表().length > 0) this.重建();
  }
}

/** 行底板：只画不交互；当前模式的行用强调描边。 */
class 行底板 implements 控件接口 {
  private readonly 矩形值: 矩形;
  private readonly 高亮: boolean;
  constructor(矩形: 矩形, 高亮 = false) {
    this.矩形值 = 矩形;
    this.高亮 = 高亮;
  }
  读取矩形(): 矩形 {
    return this.矩形值;
  }
  命中(): null {
    return null;
  }
  绘制(环境: 绘制环境): void {
    绘制面板(环境, this.矩形值, {
      圆角: 10,
      填充透明度: 0.72,
      描边宽: this.高亮 ? 0 : 1,
    });
    // 高亮行单独画四条边，避免描边色垫在填充下面把整行染成强调色。
    if (this.高亮) 绘制矩形描边(环境, this.矩形值, 环境.配色.强调, 1.5, 0.9);
  }
}

function 英文模式名(模式: 游戏模式): string {
  return { 马拉松: "Marathon", 冲刺: "Sprint", 极限: "Ultra", 每日挑战: "Daily" }[模式];
}

/** 每日挑战日期展示：2026-10-20 → 10月20日。 */
function 格式化日期(日期: string): string {
  const 部分 = 日期.split("-");
  if (部分.length !== 3) return 日期;
  return `${Number(部分[1])}月${Number(部分[2])}日`;
}
