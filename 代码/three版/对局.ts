import { 四边形合批 } from "../../框架Three/界面/四边形合批";
import type { 文字图集 } from "../../框架Three/界面/文字图集";
import type { 场景接口 } from "../../框架Three/运行时/场景栈";
import {
  type 再消一行状态,
  创建新局,
  可以放置,
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
} from "../玩法/再消一行";
import { type 消行闪烁, type 界面, 绘制对局 } from "./绘制";

/** 对局页：把 代码/玩法/ 的纯规则接到 Three 界面与输入上，可完整玩一局。 */

export interface 渲染资源 {
  字小: 文字图集;
  字大: 文字图集;
}

export type 操作名 = "左移" | "右移" | "旋转" | "软降" | "硬降" | "暂存" | "重新开始";

export interface 操作记录 {
  序号: number;
  类型: "操作" | "落块" | "消行";
  名称: string;
  分数: number;
  消行数: number;
  阶段: 游戏阶段;
  时刻毫秒: number;
}

export interface 对局快照 {
  阶段: 游戏阶段;
  分数: number;
  消行数: number;
  等级: number;
  连击: number;
  完赛: boolean;
  当前方块: 方块类型;
  下一个方块: 方块类型;
  暂存方块: 方块类型 | null;
  棋盘占用格数: number;
  /** 每列从底往上的已占用高度。 */
  列高度: number[];
  /** 可见最底行还空着的列，实机验收按它铺满底层。 */
  最低行空格: number[];
  有效用时: number;
}

export interface 对局统计 {
  操作次数: number;
  落块数: number;
  消行次数: number;
}

const 闪烁时长秒 = 0.22;

export class 对局页面 implements 场景接口<渲染资源> {
  private readonly 资源: 渲染资源;
  private readonly 合批: 四边形合批;
  private readonly 模式: 游戏模式;
  private 状态: 再消一行状态;
  private 随机源: () => number = Math.random;
  private 闪烁剩余秒 = 0;
  private 闪烁行: number[] = [];
  private 最后落块序号 = 0;
  private 最后消行序号 = 0;
  private 已通知结束 = false;
  private 结束回调: (() => void) | null = null;
  private readonly 记录列表: 操作记录[] = [];
  private readonly 统计: 对局统计 = { 操作次数: 0, 落块数: 0, 消行次数: 0 };
  private 记录序号 = 0;
  private 启动时刻 = performance.now();

  constructor(资源: 渲染资源, 模式: 游戏模式 = "马拉松") {
    this.资源 = 资源;
    this.模式 = 模式;
    this.合批 = new 四边形合批({
      纹理: [资源.字小.读取纹理(), 资源.字大.读取纹理()],
    });
    this.状态 = 创建新局(this.随机源, [], 模式);
    this.记录("操作", "开始对局");
  }

  设置结束回调(回调: () => void): void {
    this.结束回调 = 回调;
  }

  读取合批组() {
    return this.合批.提交();
  }

  读取合批统计() {
    return this.合批.读取统计();
  }

  读取状态(): 对局快照 {
    let 占用 = 0;
    for (let 行 = 0; 行 < 22; 行++) {
      for (let 列 = 0; 列 < 10; 列++) if (this.状态.棋盘[行]?.[列]) 占用++;
    }
    return {
      阶段: this.状态.阶段,
      分数: this.状态.分数,
      消行数: this.状态.消行数,
      等级: this.状态.等级,
      连击: this.状态.连击,
      完赛: this.状态.完赛,
      当前方块: this.状态.当前方块.类型,
      下一个方块: this.状态.下一个方块,
      暂存方块: this.状态.暂存方块,
      棋盘占用格数: 占用,
      列高度: 读取列高度(this.状态),
      最低行空格: 读取最低行空格(this.状态),
      有效用时: Math.round(this.状态.有效用时),
    };
  }

  读取统计(): 对局统计 {
    return { ...this.统计 };
  }

  读取操作记录(): 操作记录[] {
    return [...this.记录列表];
  }

  /** 实机验收的落块策略在页面外模拟用；返回规则状态副本，不改动当前对局。 */
  读取原始状态(): 再消一行状态 {
    return structuredClone(this.状态);
  }

  /** 面板与键盘共用的操作入口；结束或未开始时忽略移动类操作。 */
  操作(名: 操作名): void {
    if (名 === "重新开始") {
      this.重新开始();
      return;
    }
    if (this.状态.阶段 !== "进行中") return;
    switch (名) {
      case "左移":
        移动方块(this.状态, -1, 0, this.随机源);
        break;
      case "右移":
        移动方块(this.状态, 1, 0, this.随机源);
        break;
      case "旋转":
        旋转方块(this.状态, 1, false, this.随机源);
        break;
      case "软降":
        软降一步(this.状态, this.随机源);
        break;
      case "硬降":
        硬降(this.状态, this.随机源);
        break;
      case "暂存":
        暂存换块(this.状态, this.随机源);
        break;
    }
    this.统计.操作次数++;
    this.记录("操作", 名);
    this.检查事件();
  }

  重新开始(): void {
    this.状态 = 创建新局(this.随机源, [], this.模式);
    this.闪烁剩余秒 = 0;
    this.闪烁行 = [];
    this.最后落块序号 = 0;
    this.最后消行序号 = 0;
    this.已通知结束 = false;
    this.启动时刻 = performance.now();
    this.记录("操作", "重新开始");
  }

  进入(): void {}

  更新(固定步长秒: number): void {
    if (this.状态.阶段 === "进行中") 更新时钟(this.状态, 固定步长秒 * 1000, this.随机源);
    if (this.闪烁剩余秒 > 0) this.闪烁剩余秒 = Math.max(0, this.闪烁剩余秒 - 固定步长秒);
    this.检查事件();
    if (this.状态.阶段 === "结束" && !this.已通知结束) {
      this.已通知结束 = true;
      this.结束回调?.();
    }
  }

  渲染(): void {
    this.合批.清空();
    绘制对局(this.创建界面(), this.状态, this.计算影子(), this.读取闪烁());
    this.合批.提交();
  }

  销毁(): void {
    this.合批.销毁();
  }

  读取已用毫秒(): number {
    return Math.round(performance.now() - this.启动时刻);
  }

  private 记录(类型: 操作记录["类型"], 名称: string): void {
    if (this.记录列表.length >= 400) this.记录列表.shift();
    this.记录列表.push({
      序号: ++this.记录序号,
      类型,
      名称,
      分数: this.状态.分数,
      消行数: this.状态.消行数,
      阶段: this.状态.阶段,
      时刻毫秒: Math.round(performance.now() - this.启动时刻),
    });
  }

  private 创建界面(): 界面 {
    return { 合批: this.合批, 字小: this.资源.字小, 字大: this.资源.字大 };
  }

  private 读取闪烁(): 消行闪烁 | null {
    if (this.闪烁剩余秒 <= 0) return null;
    return { 行: this.闪烁行, 比例: this.闪烁剩余秒 / 闪烁时长秒 };
  }

  private 检查事件(): void {
    const 落块事件 = this.状态.落块事件;
    if (落块事件 && 落块事件.序号 > this.最后落块序号) {
      this.最后落块序号 = 落块事件.序号;
      this.统计.落块数++;
      this.记录(
        "落块",
        `${落块事件.类型} ${落块事件.行数 > 0 ? `消 ${落块事件.行数} 行` : "落地"}`,
      );
    }
    const 消行事件 = this.状态.消行事件;
    if (消行事件 && 消行事件.序号 > this.最后消行序号) {
      this.最后消行序号 = 消行事件.序号;
      this.统计.消行次数++;
      this.闪烁行 = 消行事件.行;
      this.闪烁剩余秒 = 闪烁时长秒;
      this.记录("消行", `消除 ${消行事件.行.length} 行`);
    }
  }

  /** 当前方块垂直下落到底的落点（不含当前方块自身）。 */
  private 计算影子(): [number, number][] {
    let 影 = this.状态.当前方块;
    const 下移 = () => ({
      ...影,
      中心行2: 影.中心行2 + 2,
      格子: 影.格子.map((格) => ({ ...格, 行2: 格.行2 + 2 })),
    });
    while (可以放置(this.状态, 下移())) 影 = 下移();
    return 读取格子(影);
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
        // 从上往下找到第一个占用格，就是这一列实际堆到的高度。
        高度 = 20 - 行;
        break;
      }
    }
    高度列表.push(高度);
  }
  return 高度列表;
}
