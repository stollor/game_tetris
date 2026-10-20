import type { 指针事件 } from "../../../框架Three/运行时/输入路由";
import { 新对局编号 } from "../../场景/对局/对局编号";
import type { 对局纪录 } from "../../存档/对局纪录";
import type { 对局奖励输入 } from "../../存档/旅行收藏";
import {
  type 再消一行状态,
  切换暂停,
  创建新局,
  创建模式随机源,
  type 方块类型,
  旋转方块,
  暂存换块,
  更新时钟,
  type 游戏模式,
  type 游戏阶段,
  硬降,
  移动方块,
  读取格子,
  软降一步,
} from "../../玩法/再消一行";
import { type 对局布局数据, 计算对局布局 } from "../../视觉/对局布局";
import { 获取技巧反馈 } from "../../视觉/技巧反馈";
import type { 游戏文案 } from "../../语言/类型";
import type { 游戏设置 } from "../../配置/再消一行设置";
import { 读取方块外观方案 } from "../主题/方块";
import type { 对局测试控制, 界面快照, 界面按钮快照, 页面上下文, 页面实例 } from "../接口/上下文";
import type { 对局结果 } from "../接口/服务";
import { 操作键虚拟键, 绘制对局画面 } from "../视觉/对局绘制";
import {
  创建特效状态,
  更新特效,
  清空特效,
  type 特效状态,
  绘制特效,
  触发消行,
  触发硬降,
  触发锁定,
  触发震动,
  读取震动偏移,
} from "../视觉/特效";
import { type 对局视图, type 提示视图, type 绘制环境, 计算影子 } from "../视觉/绘制";
import { 绘制背景, 读取背景动态 } from "../视觉/背景";
import { 模式名称, 模式目标文案, 读取对局计时文案, 读取每日日期 } from "./四模式";
import { 记录最近结算 } from "./最近对局";
import {
  type 最近结算,
  生成对局结果,
  生成结算徽标,
  生成结算统计,
  结算标题,
  type 金币奖励,
} from "./结算数据";
import { type 虚拟键, type 输入动作, 输入状态 } from "./输入";

/**
 * 对局页：把 代码/玩法/再消一行.ts 的纯规则接到 Three 的共享合批/命中分发上。
 * 负责四模式、输入（DAS/ARR/暂存/硬降）、HUD/特效展示、结束结算与操作记录；
 * 页面实例由装配层复用，每次 进入() 按 上下文.参数.模式 重开一局。
 */

export interface 对局快照 {
  阶段: 游戏阶段;
  模式: 游戏模式;
  /** UTC 日期 YYYY-MM-DD：每日挑战种子/纪录键的日期。 */
  日期: string;
  分数: number;
  消行数: number;
  等级: number;
  连击: number;
  最长连击: number;
  完赛: boolean;
  目标达成: boolean;
  剩余时间: number;
  当前方块: 方块类型;
  下一个方块: 方块类型;
  暂存方块: 方块类型 | null;
  本块已暂存: boolean;
  棋盘占用格数: number;
  列高度: number[];
  最低行空格: number[];
  有效用时: number;
}

export type 操作名 = "左移" | "右移" | "旋转" | "软降" | "硬降" | "暂存" | "重新开始";

export interface 操作记录 {
  序号: number;
  类型: "操作" | "落块" | "消行" | "暂停" | "结算";
  名称: string;
  分数: number;
  消行数: number;
  阶段: 游戏阶段;
  时刻毫秒: number;
}

export interface 对局统计 {
  操作次数: number;
  落块数: number;
  消行次数: number;
}

/** Phaser 版测试桥的读取状态口径，启动层按它挂 window.__再消一行测试__。 */
export interface 测试状态 {
  阶段: 游戏阶段;
  分数: number;
  有效用时: number;
  暂存方块: 方块类型 | null;
  本块已暂存: boolean;
  消行数: number;
  当前方块: 方块类型;
  当前格子: [number, number][];
  当前朝向: number;
  下一个方块: 方块类型;
  棋盘: (方块类型 | null)[][];
}

interface 提示状态 {
  技巧: { 文本: string; 剩余秒: number; 时长秒: number } | null;
  成就: { 文本: string; 剩余秒: number; 时长秒: number } | null;
  目标剩余秒: number;
}

const 技巧时长秒 = 1.15;
const 成就时长秒 = 2.4;
const 目标提示秒 = 2.2;

const 键映射: Record<string, 虚拟键> = {
  ArrowLeft: "左",
  ArrowRight: "右",
  ArrowDown: "下",
  Space: "硬降",
  KeyC: "暂存",
  KeyX: "左转",
  KeyZ: "半转",
};

export class 对局页面 implements 页面实例 {
  readonly 测试: 对局测试控制;
  private readonly 上下文: 页面上下文;
  private 状态: 再消一行状态;
  private 模式: 游戏模式 = "马拉松";
  private 每日日期 = "";
  private 随机源: () => number = Math.random;
  private readonly 输入 = new 输入状态();
  private readonly 特效: 特效状态 = 创建特效状态();
  private readonly 提示: 提示状态 = { 技巧: null, 成就: null, 目标剩余秒: 0 };
  private 设置: 游戏设置;
  private 文案: 游戏文案;
  private readonly 记录列表: 操作记录[] = [];
  private readonly 统计: 对局统计 = { 操作次数: 0, 落块数: 0, 消行次数: 0 };
  private 记录序号 = 0;
  private 启动时刻 = performance.now();
  /** 背景动画时间轴（秒）：随更新步长累计，不另造时钟。 */
  private 背景时间秒 = 0;
  /** 当前对局整页布局（与 Phaser 同一份共享布局）。 */
  private 布局数据?: 对局布局数据;
  private 最后落块序号 = 0;
  private 最后消行序号 = 0;
  private 已结算 = false;
  private 已结算时刻 = 0;
  private 目标已提示 = false;
  private 对局编号 = "";
  private 本局落块数 = 0;
  private 测试序列: 方块类型[] = [];
  private 撤销绑定: (() => void)[] = [];
  private 注销命中: (() => void)[] = [];
  private 已进入 = false;
  private 历史最佳: 对局纪录 | null = null;
  private 刷新纪录 = false;
  private 金币奖励: 金币奖励 | null = null;
  private 金币失败原因 = "";
  private 新成就: string[] = [];

  constructor(上下文: 页面上下文) {
    this.上下文 = 上下文;
    this.文案 = 上下文.服务.语言.读取();
    this.设置 = 上下文.服务.设置.读取();
    this.状态 = 创建新局(Math.random, [], "马拉松");
    this.测试 = {
      设置序列: (序列) => {
        const 合法 = 序列.filter((项): 项 is 方块类型 =>
          (["I", "O", "T", "S", "Z", "J", "L"] as const).includes(项 as 方块类型),
        );
        this.测试序列 = 合法;
        this.开始新局();
      },
      准备单行消除: () => {
        this.测试序列 = ["I", "O"];
        this.开始新局();
        const 底行 = this.状态.棋盘.at(-1);
        if (底行) {
          for (let 列 = 0; 列 < 底行.length; 列++) {
            if (列 < 3 || 列 > 6) 底行[列] = "J";
          }
        }
        this.请求重绘();
      },
      硬降: () => {
        if (this.状态.阶段 !== "进行中") return;
        this.执行硬降();
      },
      设置暂停: (暂停) => {
        this.设置暂停(暂停);
      },
      结束当前对局: () => {
        if (this.状态.阶段 === "结束") return;
        this.状态.阶段 = "结束";
        this.请求重绘();
      },
      准备结算: () => {
        this.开始新局();
        this.状态.阶段 = "结束";
        this.状态.完赛 = false;
        this.状态.有效用时 = 12345;
        this.状态.剩余时间 = 0;
        this.状态.分数 = 4321;
        this.状态.消行数 = 13;
        this.状态.等级 = 5;
        this.状态.最长连击 = 3;
        this.请求重绘();
      },
    };
  }

  /* ---------------------------------------------------------------- */
  /* 场景生命周期                                                     */
  /* ---------------------------------------------------------------- */

  进入(): void {
    this.模式 = this.上下文.参数.模式 ?? "马拉松";
    this.每日日期 = this.上下文.服务.当日日期();
    this.文案 = this.上下文.服务.语言.读取();
    this.设置 = this.上下文.服务.设置.读取();
    this.开始新局();
    this.绑定监听();
    this.注册命中();
    this.已进入 = true;
    this.播放音效("开始");
    this.上下文.服务.音频.播放音乐("再消一行.对局");
  }

  退出(): void {
    this.释放监听();
    清空特效(this.特效);
    this.输入.清空();
    this.上下文.资源.设置玩法进行中(false);
    this.请求重绘();
    this.已进入 = false;
  }

  暂停(): void {
    if (this.状态.阶段 === "进行中") {
      切换暂停(this.状态);
      this.输入.清空();
      this.记录("暂停", "失焦自动暂停");
      this.上下文.资源.设置玩法进行中(false);
      this.请求重绘();
    }
  }

  恢复(): void {
    this.请求重绘();
  }

  更新(固定步长秒: number): void {
    if (!this.已进入) return;
    const 秒 = Math.max(0, 固定步长秒);
    this.背景时间秒 += 秒;
    this.更新提示(秒);
    const 特效活跃 = 更新特效(this.特效, 秒);
    if (this.状态.阶段 === "进行中") {
      const 动作 = this.输入.更新(秒 * 1000);
      for (const 项 of 动作) this.执行输入动作(项);
      if (this.状态.阶段 === "进行中") {
        更新时钟(this.状态, 秒 * 1000, this.随机源, this.输入.读取按住软降());
        this.检查事件();
      }
      this.请求重绘();
    } else if (特效活跃 || this.提示.技巧 || this.提示.成就 || this.提示.目标剩余秒 > 0) {
      this.请求重绘();
    }
    if (this.状态.阶段 === "结束" && !this.已结算) this.生成结算();
  }

  渲染(): void {
    if (!this.已进入) return;
    const 资源 = this.上下文.资源;
    const 环境: 绘制环境 = {
      合批: 资源.合批,
      图形: 资源.画笔.图形,
      方块方案: 读取方块外观方案(this.设置),
      画笔: 资源.画笔,
      主题: this.上下文.主题,
    };
    绘制背景(资源.画笔.图形, {
      宽: 资源.逻辑宽,
      高: 资源.逻辑高,
      主题: this.设置.背景主题,
      动态: 读取背景动态(this.设置),
      时间秒: this.背景时间秒,
    });
    const 偏移 = 读取震动偏移(this.特效);
    const 视图: 对局视图 = {
      状态: this.状态,
      方块外观: 读取方块外观方案(this.设置),
      模式文字: 模式名称(this.模式, this.文案),
      计时文案:
        this.模式 === "马拉松"
          ? 模式目标文案(this.模式, this.文案)
          : 读取对局计时文案(this.模式, this.状态, this.每日日期),
      影子: 计算影子(this.状态),
      显示网格: this.设置.显示网格,
      落点影透明度: this.设置.落点影透明度,
      暂停: this.状态.阶段 === "暂停",
    };
    const 提示: 提示视图 = {
      技巧: this.提示.技巧
        ? {
            文本: this.提示.技巧.文本,
            比例: Math.max(0, this.提示.技巧.剩余秒 / this.提示.技巧.时长秒),
          }
        : null,
      成就: this.提示.成就
        ? {
            文本: this.提示.成就.文本,
            比例: Math.min(1, this.提示.成就.剩余秒 / 350),
          }
        : null,
      目标: this.提示.目标剩余秒 > 0 ? this.提示.目标剩余秒 / 目标提示秒 : null,
      暂停: this.状态.阶段 === "暂停",
    };
    绘制对局画面(环境, {
      布局: this.读取布局(),
      视图,
      提示,
      模式名: 视图.模式文字,
      计时文案: 视图.计时文案,
      最佳纪录: this.读取最佳纪录文案(),
      偏移X: 偏移.x,
      偏移Y: 偏移.y,
    });
    // 暂停/结算面板压在特效之上；特效是叠加混合批次，必须避免盖住面板。
    if (this.状态.阶段 !== "暂停" && !this.已结算) {
      绘制特效(环境, this.特效, { 开: this.设置.省电模式 !== "开" }, 偏移.x, 偏移.y);
    }
  }

  /* ---------------------------------------------------------------- */
  /* 对外读取（装配层调试桥/统计/结算页用）                            */
  /* ---------------------------------------------------------------- */

  读取快照(): 对局快照 {
    let 占用 = 0;
    for (const 行 of this.状态.棋盘) {
      for (const 格 of 行) if (格) 占用++;
    }
    return {
      阶段: this.状态.阶段,
      模式: this.模式,
      日期: this.每日日期,
      分数: this.状态.分数,
      消行数: this.状态.消行数,
      等级: this.状态.等级,
      连击: this.状态.连击,
      最长连击: this.状态.最长连击,
      完赛: this.状态.完赛,
      目标达成: this.状态.目标达成,
      剩余时间: this.状态.剩余时间,
      当前方块: this.状态.当前方块.类型,
      下一个方块: this.状态.下一个方块,
      暂存方块: this.状态.暂存方块,
      本块已暂存: this.状态.本块已暂存,
      棋盘占用格数: 占用,
      列高度: 读取列高度(this.状态),
      最低行空格: 读取最低行空格(this.状态),
      有效用时: Math.round(this.状态.有效用时),
    };
  }

  读取原始状态(): 再消一行状态 {
    return structuredClone(this.状态);
  }

  读取测试状态(): 测试状态 {
    return {
      阶段: this.状态.阶段,
      分数: this.状态.分数,
      有效用时: this.状态.有效用时,
      暂存方块: this.状态.暂存方块,
      本块已暂存: this.状态.本块已暂存,
      消行数: this.状态.消行数,
      当前方块: this.状态.当前方块.类型,
      当前格子: 读取格子(this.状态.当前方块),
      当前朝向: this.状态.当前方块.旋转,
      下一个方块: this.状态.下一个方块,
      棋盘: structuredClone(this.状态.棋盘),
    };
  }

  读取对局统计(): 对局统计 {
    return { ...this.统计 };
  }

  读取操作记录(): 操作记录[] {
    return [...this.记录列表];
  }

  读取已用毫秒(): number {
    return Math.round(performance.now() - this.启动时刻);
  }

  /** 供验收读取：当前模式的结算展示口径。 */
  读取结算展示(): { 统计: { 标签: string; 数值: string }[]; 徽标: string; 标题: string } {
    const 结果 = this.组装结果();
    return {
      统计: 生成结算统计(this.模式, 结果, this.历史最佳, this.文案),
      徽标: 生成结算徽标(this.模式, 结果, this.刷新纪录, this.文案),
      标题: 结算标题(结果, this.文案),
    };
  }

  /** 供验收按名称驱动真实点击；坐标与命中注册共用同一份布局。 */
  读取界面(): 界面快照 {
    const 对局定位 = this.读取布局();
    const 进行中 = this.状态.阶段 === "进行中";
    const 暂停中 = this.状态.阶段 === "暂停";
    const 按钮: 界面按钮快照[] = [];
    for (const 键 of 对局定位.操作区.键) {
      按钮.push({
        名称: 键.名称,
        左: 键.中心X - 键.宽 / 2,
        上: 键.中心Y - 键.高 / 2,
        宽: 键.宽,
        高: 键.高,
        可用: 进行中,
      });
    }
    if (对局定位.侧栏) {
      按钮.push({
        名称: "硬降",
        左: 对局定位.侧栏.硬降.中心X - 对局定位.侧栏.硬降.宽 / 2,
        上: 对局定位.侧栏.硬降.中心Y - 对局定位.侧栏.硬降.高 / 2,
        宽: 对局定位.侧栏.硬降.宽,
        高: 对局定位.侧栏.硬降.高,
        可用: 进行中,
      });
    }
    按钮.push({
      名称: "离开",
      左: 对局定位.离开按钮.中心X - 对局定位.离开按钮.宽 / 2,
      上: 对局定位.离开按钮.中心Y - 对局定位.离开按钮.高 / 2,
      宽: 对局定位.离开按钮.宽,
      高: 对局定位.离开按钮.高,
      可用: true,
    });
    按钮.push({
      名称: "暂停",
      左: 对局定位.暂停按钮.中心X - 对局定位.暂停按钮.宽 / 2,
      上: 对局定位.暂停按钮.中心Y - 对局定位.暂停按钮.高 / 2,
      宽: 对局定位.暂停按钮.宽,
      高: 对局定位.暂停按钮.高,
      可用: this.状态.阶段 !== "结束",
    });
    for (const 项 of 对局定位.暂停面板.按钮) {
      const 名称 =
        项.名称 === "继续"
          ? "继续"
          : 项.名称 === "重开"
            ? "重新开始"
            : 项.名称 === "设置"
              ? "对局设置"
              : "返回主菜单";
      按钮.push({ 名称, ...项.矩形, 可用: 暂停中 });
    }
    return {
      按钮,
      文字: [
        模式名称(this.模式, this.文案),
        读取对局计时文案(this.模式, this.状态, this.每日日期),
        String(this.状态.分数),
        String(this.状态.消行数),
        String(this.状态.等级),
      ],
    };
  }

  /* ---------------------------------------------------------------- */
  /* 内部：开局与重置                                                 */
  /* ---------------------------------------------------------------- */

  private 开始新局(): void {
    this.随机源 = 创建模式随机源(this.模式, this.每日日期);
    this.状态 = 创建新局(this.随机源, this.测试序列, this.模式);
    this.测试序列 = [];
    this.提示.技巧 = null;
    this.提示.成就 = null;
    this.提示.目标剩余秒 = 0;
    清空特效(this.特效);
    this.输入.清空();
    this.统计.操作次数 = 0;
    this.统计.落块数 = 0;
    this.统计.消行次数 = 0;
    this.最后落块序号 = 0;
    this.最后消行序号 = 0;
    this.已结算 = false;
    this.已结算时刻 = 0;
    this.目标已提示 = false;
    this.对局编号 = 新对局编号();
    this.本局落块数 = 0;
    this.刷新纪录 = false;
    this.历史最佳 = null;
    this.金币奖励 = null;
    this.金币失败原因 = "";
    this.新成就 = [];
    this.启动时刻 = performance.now();
    this.记录("操作", `开始对局 · ${this.模式}`);
    this.上下文.资源.设置玩法进行中(true);
    this.请求重绘();
  }

  /* ---------------------------------------------------------------- */
  /* 内部：输入                                                       */
  /* ---------------------------------------------------------------- */

  private 绑定监听(): void {
    const 按下 = (事件: KeyboardEvent) => {
      if (事件.repeat) return;
      if (!this.按下键(事件.code)) return;
      事件.preventDefault();
    };
    const 松开 = (事件: KeyboardEvent) => {
      const 键 = this.键盘键(事件.code);
      if (!键) return;
      事件.preventDefault();
      this.输入.松开(键);
    };
    const 失焦 = () => {
      this.输入.清空();
      // 窗口失焦自动暂停，回到页面后由玩家按 P/Esc 或点「继续」恢复。
      if (this.状态.阶段 === "进行中") this.设置暂停(true);
    };
    window.addEventListener("keydown", 按下);
    window.addEventListener("keyup", 松开);
    window.addEventListener("blur", 失焦);
    this.撤销绑定.push(() => {
      window.removeEventListener("keydown", 按下);
      window.removeEventListener("keyup", 松开);
      window.removeEventListener("blur", 失焦);
    });
    this.撤销绑定.push(
      this.上下文.服务.设置.订阅((设置) => {
        this.设置 = 设置;
        this.请求重绘();
      }),
    );
  }

  private 释放监听(): void {
    for (const 撤销 of this.撤销绑定) 撤销();
    this.撤销绑定 = [];
    for (const 注销 of this.注销命中) 注销();
    this.注销命中 = [];
  }

  /** 键盘按下：返回是否已消费该键（用于 preventDefault）。 */
  private 按下键(代码: string): boolean {
    if (代码 === "KeyP" || 代码 === "Escape") {
      if (this.状态.阶段 !== "结束") this.设置暂停(this.状态.阶段 !== "暂停");
      return true;
    }
    if (代码 === "KeyR") {
      if (this.状态.阶段 !== "结束") this.开始新局();
      return true;
    }
    const 键 = this.键盘键(代码);
    if (!键) return false;
    if (this.状态.阶段 !== "进行中") return true;
    for (const 动作 of this.输入.按下(键)) this.执行输入动作(动作);
    this.请求重绘();
    return true;
  }

  private 键盘键(代码: string): 虚拟键 | null {
    if (代码 === "ArrowUp") return this.上键虚拟键();
    return 键映射[代码] ?? null;
  }

  /** 上键方向跟随设置：左转 / 右转 / 180°（与 Phaser 版一致）。 */
  private 上键虚拟键(): 虚拟键 {
    if (this.设置.手机上键旋转 === "右转") return "右转";
    if (this.设置.手机上键旋转 === "180度") return "半转";
    return "左转";
  }

  /** 触屏按钮：按下开始按住态，抬起/取消释放。 */
  private 触屏按钮(键: 虚拟键, 事件: 指针事件): void {
    if (事件.类型 === "按下") {
      for (const 动作 of this.输入.按下(键)) this.执行输入动作(动作);
    } else if (事件.类型 === "抬起" || 事件.类型 === "取消") {
      this.输入.松开(键);
    }
    this.请求重绘();
  }

  private 执行输入动作(动作: 输入动作): void {
    if (this.状态.阶段 !== "进行中") return;
    switch (动作.类型) {
      case "移动":
        if (移动方块(this.状态, 动作.方向, 0, this.随机源)) this.播放音效("移动");
        break;
      case "旋转":
        if (旋转方块(this.状态, 动作.方向, false, this.随机源)) this.播放音效("旋转");
        break;
      case "半转":
        if (旋转方块(this.状态, 1, true, this.随机源)) this.播放音效("旋转");
        break;
      case "软降":
        if (软降一步(this.状态, this.随机源)) this.播放音效("软降");
        break;
      case "硬降":
        this.执行硬降();
        return;
      case "暂存":
        if (暂存换块(this.状态, this.随机源)) {
          this.播放音效("暂存");
          this.记录("操作", "暂存");
        }
        break;
    }
    this.统计.操作次数++;
    this.检查事件();
    this.请求重绘();
  }

  private 执行硬降(): void {
    const 原格子 = 读取格子(this.状态.当前方块);
    const 类型 = this.状态.当前方块.类型;
    const 距离 = 硬降(this.状态, this.随机源);
    if (距离 > 0) {
      this.播放音效("硬降");
      触发硬降(this.特效, 原格子, 距离, 类型);
      if (this.设置.省电模式 !== "开") 触发震动(this.特效, 2);
    }
    this.统计.操作次数++;
    this.检查事件();
    this.请求重绘();
  }

  /** 侧栏最佳纪录文案：与 Phaser 加载最佳文案同一口径。 */
  private 读取最佳纪录文案(): string {
    try {
      const 记录 = this.上下文.服务.纪录.读取(
        this.模式,
        this.模式 === "每日挑战" ? this.每日日期 : undefined,
      );
      if (!记录) return this.文案.暂无纪录;
      if (this.模式 === "冲刺")
        return 记录.用时 !== null ? `${(记录.用时 / 1000).toFixed(2)}s` : this.文案.暂无完赛纪录;
      return `${记录.分数.toLocaleString()} pts`;
    } catch {
      return this.文案.暂无纪录;
    }
  }

  /** 计算/缓存整页布局：与 Phaser 同一份共享布局。 */
  private 读取布局(): 对局布局数据 {
    const 设置 = this.设置;
    this.布局数据 = 计算对局布局(this.上下文.资源.逻辑宽, this.上下文.资源.逻辑高, {
      屏幕适配: 设置.屏幕适配,
      显示按键说明: 设置.显示按键说明,
      模式: this.模式,
      阶段: this.状态.阶段,
      手机上键旋转: 设置.手机上键旋转,
      英文: this.上下文.服务.语言.是否英文(),
    });
    return this.布局数据;
  }

  private 设置暂停(暂停: boolean): void {
    if (this.状态.阶段 === "结束") return;
    if ((this.状态.阶段 === "暂停") === 暂停) return;
    切换暂停(this.状态);
    this.输入.清空();
    this.播放音效(暂停 ? "暂停" : "继续");
    this.记录("暂停", 暂停 ? "暂停" : "继续");
    this.上下文.资源.设置玩法进行中(!暂停);
    this.请求重绘();
  }

  /* ---------------------------------------------------------------- */
  /* 内部：事件与展示                                                 */
  /* ---------------------------------------------------------------- */

  private 检查事件(): void {
    const 落块 = this.状态.落块事件;
    if (落块 && 落块.序号 > this.最后落块序号) {
      this.最后落块序号 = 落块.序号;
      this.本局落块数++;
      this.统计.落块数++;
      触发锁定(this.特效, 落块.格子);
      if (落块.行数 === 4 && this.设置.省电模式 !== "开") 触发震动(this.特效, 4);
      this.记录(
        "落块",
        `${落块.类型} ${落块.行数 > 0 ? `消 ${落块.行数} 行` : "落地"}`,
        `${落块.得分}`,
      );
      const 反馈 = 获取技巧反馈(落块, this.上下文.服务.语言.是否英文());
      if (反馈) this.提示.技巧 = { 文本: 反馈, 剩余秒: 技巧时长秒, 时长秒: 技巧时长秒 };
      if (落块.行数 === 0 && this.状态.阶段 === "进行中") this.播放音效("锁定");
      if (落块.全清) this.播放音效("全清");
      else if (落块.T旋 !== "无" || 落块.连续高难) this.播放音效("技巧");
      const 新解锁 = this.上下文.服务.成就.记录落块(this.状态);
      if (新解锁.length) this.提示成就(新解锁);
      if (this.状态.目标达成 && !this.目标已提示) {
        this.目标已提示 = true;
        this.提示.目标剩余秒 = 目标提示秒;
        this.记录("操作", "目标达成");
      }
    }
    const 消行 = this.状态.消行事件;
    if (消行 && 消行.序号 > this.最后消行序号) {
      this.最后消行序号 = 消行.序号;
      this.统计.消行次数++;
      触发消行(this.特效, 消行.行);
      this.播放消行(消行.行.length, this.状态.连击);
      this.记录("消行", `消除 ${消行.行.length} 行`, `${this.状态.分数}`);
    }
  }

  private 提示成就(编号: string[]): void {
    const 定义 = this.上下文.服务.成就.全部定义();
    const 英文 = this.上下文.服务.语言.是否英文();
    const 名称 = 编号
      .map((项) => 定义.find((定义项) => 定义项.编号 === 项))
      .filter((项) => 项 !== undefined)
      .map((项) => (英文 ? 项.英文 : 项.名称));
    if (!名称.length) return;
    this.新成就 = [...new Set([...this.新成就, ...编号])];
    let 文本 = `成就解锁 · ${名称.slice(0, 2).join(" / ")}${名称.length > 2 ? ` +${名称.length - 2}` : ""}`;
    try {
      const 结果 = this.上下文.服务.金币.领取成就(this.上下文.服务.成就.读取已解锁());
      if (结果.成功 && 结果.新增 > 0) 文本 += ` · +${结果.新增} 方块币`;
    } catch {
      /* 成就金币失败不阻塞对局提示 */
    }
    this.提示.成就 = { 文本, 剩余秒: 成就时长秒, 时长秒: 成就时长秒 };
  }

  private 更新提示(秒: number): void {
    if (this.提示.技巧) {
      this.提示.技巧.剩余秒 -= 秒;
      if (this.提示.技巧.剩余秒 <= 0) this.提示.技巧 = null;
    }
    if (this.提示.成就) {
      this.提示.成就.剩余秒 -= 秒;
      if (this.提示.成就.剩余秒 <= 0) this.提示.成就 = null;
    }
    if (this.提示.目标剩余秒 > 0) {
      this.提示.目标剩余秒 = Math.max(0, this.提示.目标剩余秒 - 秒);
    }
  }

  /* ---------------------------------------------------------------- */
  /* 内部：结算                                                       */
  /* ---------------------------------------------------------------- */

  private 组装结果(): 对局结果 {
    return 生成对局结果(this.模式, this.状态, this.每日日期);
  }

  private 组装奖励输入(破纪录: boolean): 对局奖励输入 {
    return {
      编号: this.对局编号,
      分数: this.状态.分数,
      消行: this.状态.消行数,
      用时: Math.round(this.状态.有效用时),
      落块: this.本局落块数,
      破纪录,
      日期: this.每日日期,
    };
  }

  private 生成结算(): void {
    this.已结算 = true;
    this.已结算时刻 = Date.now();
    this.上下文.资源.设置玩法进行中(false);
    this.输入.清空();
    清空特效(this.特效);
    this.播放音效(this.状态.完赛 ? "胜利" : "结束");
    this.上下文.服务.音频.停止音乐();
    const 结果 = this.组装结果();
    try {
      this.历史最佳 = this.上下文.服务.纪录.读取(this.模式, this.每日日期);
      this.刷新纪录 = this.上下文.服务.纪录.保存(
        this.模式,
        {
          分数: 结果.分数,
          用时: 结果.完赛 ? 结果.用时毫秒 : null,
          消行数: 结果.消行数,
          等级: 结果.等级,
          最长连击: 结果.最长连击,
        },
        this.每日日期,
      );
      const 结算成就: string[] = [];
      if (this.模式 === "冲刺" && this.状态.完赛 && this.上下文.服务.成就.推进("sprint", 1)) {
        结算成就.push("sprint");
      }
      if (
        this.模式 === "极限" &&
        this.状态.剩余时间 <= 0 &&
        this.状态.有效用时 >= 120000 &&
        this.上下文.服务.成就.推进("ultra", 1)
      ) {
        结算成就.push("ultra");
      }
      if (结算成就.length) this.提示成就(结算成就);
    } catch {
      this.历史最佳 = null;
      this.刷新纪录 = false;
    }
    const 破纪录 = this.历史最佳 !== null && this.刷新纪录;
    try {
      const 收藏 = this.上下文.服务.金币.结算对局(this.组装奖励输入(破纪录));
      if (收藏.成功) {
        this.金币奖励 = { 新增: 收藏.新增, 总额: 收藏.金币, 原因: 收藏.原因 };
      } else {
        this.金币失败原因 = 收藏.原因;
      }
    } catch {
      this.金币失败原因 = "旅行奖励保存失败";
    }
    this.记录("结算", `结算 · 分数 ${结果.分数} · 消行 ${结果.消行数}`, `${结果.分数}`);
    const 结算 = this.组装最近结算(破纪录);
    记录最近结算(结算);
    this.上下文.导航.打开覆盖("结算", { 结果 });
    this.请求重绘();
  }

  private 组装最近结算(破纪录 = false): 最近结算 {
    return {
      编号: this.对局编号,
      结果: this.组装结果(),
      目标达成: this.状态.目标达成,
      刷新纪录: this.刷新纪录,
      历史最佳: this.历史最佳,
      金币: this.金币奖励,
      金币失败原因: this.金币失败原因,
      新成就: [...new Set(this.新成就)],
      结束时刻毫秒: this.已结算时刻,
      奖励输入: this.组装奖励输入(破纪录),
    };
  }

  /* ---------------------------------------------------------------- */
  /* 内部：命中注册                                                   */
  /* ---------------------------------------------------------------- */

  private 注册命中(): void {
    const 命中 = this.上下文.资源.命中;
    const 对局定位 = this.读取布局();
    for (const 键 of 对局定位.操作区.键) {
      this.注销命中.push(
        命中.注册({
          名称: `对局.${键.名称}`,
          左: 键.中心X - 键.宽 / 2,
          上: 键.中心Y - 键.高 / 2,
          宽: 键.宽,
          高: 键.高,
          深度: 5,
          禁用: () => this.状态.阶段 !== "进行中",
          回调: (事件) => this.触屏按钮(操作键虚拟键(键), 事件),
        }),
      );
    }
    if (对局定位.侧栏) {
      const 硬降 = 对局定位.侧栏.硬降;
      this.注销命中.push(
        命中.注册({
          名称: "对局.硬降",
          左: 硬降.中心X - 硬降.宽 / 2,
          上: 硬降.中心Y - 硬降.高 / 2,
          宽: 硬降.宽,
          高: 硬降.高,
          深度: 5,
          禁用: () => this.状态.阶段 !== "进行中",
          回调: (事件) => {
            if (事件.类型 !== "抬起") return;
            this.执行硬降();
          },
        }),
      );
    }
    this.注销命中.push(
      命中.注册({
        名称: "对局.离开",
        左: 对局定位.离开按钮.中心X - 对局定位.离开按钮.宽 / 2,
        上: 对局定位.离开按钮.中心Y - 对局定位.离开按钮.高 / 2,
        宽: 对局定位.离开按钮.宽,
        高: 对局定位.离开按钮.高,
        深度: 6,
        回调: (事件) => {
          if (事件.类型 !== "抬起") return;
          this.上下文.导航.替换("主界面");
        },
      }),
    );
    this.注销命中.push(
      命中.注册({
        名称: "对局.暂停",
        左: 对局定位.暂停按钮.中心X - 对局定位.暂停按钮.宽 / 2,
        上: 对局定位.暂停按钮.中心Y - 对局定位.暂停按钮.高 / 2,
        宽: 对局定位.暂停按钮.宽,
        高: 对局定位.暂停按钮.高,
        深度: 6,
        禁用: () => this.状态.阶段 === "结束",
        回调: (事件) => {
          if (事件.类型 !== "抬起") return;
          this.设置暂停(this.状态.阶段 !== "暂停");
        },
      }),
    );
    for (const 项 of 对局定位.暂停面板.按钮) {
      this.注销命中.push(
        命中.注册({
          名称: `对局.暂停菜单.${项.名称}`,
          ...项.矩形,
          深度: 20,
          禁用: () => this.状态.阶段 !== "暂停",
          回调: (事件) => {
            if (事件.类型 !== "抬起") return;
            if (项.名称 === "继续") this.设置暂停(false);
            else if (项.名称 === "重开") this.开始新局();
            else if (项.名称 === "设置") {
              this.设置暂停(false);
              this.上下文.导航.进入("设置");
            } else this.上下文.导航.替换("主界面");
          },
        }),
      );
    }
  }

  /* ---------------------------------------------------------------- */
  /* 内部：小工具                                                     */
  /* ---------------------------------------------------------------- */

  private 请求重绘(): void {
    this.上下文.资源.请求重绘();
  }

  private 播放音效(名称: string): void {
    this.上下文.服务.音频.播放音效(`再消一行.${名称}`);
  }

  private 播放消行(行数: number, 连击: number): void {
    this.上下文.服务.音频.播放消行(行数, 连击);
  }

  private 记录(类型: 操作记录["类型"], 名称: string, 备注 = ""): void {
    if (this.记录列表.length >= 400) this.记录列表.shift();
    this.记录列表.push({
      序号: ++this.记录序号,
      类型,
      名称: 备注 ? `${名称} · ${备注}` : 名称,
      分数: this.状态.分数,
      消行数: this.状态.消行数,
      阶段: this.状态.阶段,
      时刻毫秒: Math.round(performance.now() - this.启动时刻),
    });
  }
}

function 读取最低行空格(状态: 再消一行状态): number[] {
  const 空格列表: number[] = [];
  for (let 列 = 0; 列 < 10; 列++) {
    if (!状态.棋盘[21]?.[列]) 空格列表.push(列);
  }
  return 空格列表;
}

/** 每列从底往上的已占用高度，供实机验收的自动落块选择最低列。 */
function 读取列高度(状态: 再消一行状态): number[] {
  const 高度列表: number[] = [];
  for (let 列 = 0; 列 < 10; 列++) {
    let 高度 = 0;
    for (let 行 = 0; 行 < 20; 行++) {
      if (状态.棋盘[行 + 2]?.[列]) {
        高度 = 20 - 行;
        break;
      }
    }
    高度列表.push(高度);
  }
  return 高度列表;
}

void 读取每日日期;
