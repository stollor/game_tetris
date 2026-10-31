import type { 组件事件 } from "../../框架/节点/命中";
import type { 节点绘制环境 } from "../../框架/节点/渲染";
import { 在本地空间绘制, 文字空间矩阵 } from "../../框架/节点/渲染";
import type { 矩形 } from "../../框架/节点/类型";
import { 包含点 } from "../../框架/节点/类型";
import { 组件 } from "../../框架/节点/组件";
import { 读取画笔 } from "../../框架/节点/组件/文字";
import type { 模式卡数据, 模式卡绘制状态 } from "../../预制体/模式选择/模式卡配方";
import { 生成模式卡文字项, 绘制模式卡, 计算模式卡排行区域 } from "../../预制体/模式选择/模式卡配方";

/**
 * 模式卡组件（游戏特有）：一张模式装置卡 = 一个节点。
 *
 * 卡内有两个命中区：整卡（开始该模式）与卡内排行钮（进排行榜）。排行钮是卡配方的一部分，
 * 所以不拆成子节点，按局部坐标分流；视觉仍由 `绘制模式卡` 预制体画，组件只管状态与命中。
 */
export interface 模式卡参数 {
  数据?: 模式卡数据;
  时间秒?: number;
  点击?: () => void;
  排行点击?: () => void;
}

export class 模式卡组件 extends 组件<模式卡参数> {
  private 按下中 = false;
  private 排行按下 = false;
  private 捕获: "卡" | "排行" | null = null;
  private 时间秒 = 0;

  constructor(参数: 模式卡参数 = {}) {
    super("模式卡", 参数);
  }

  protected 默认参数(): 模式卡参数 {
    return { 时间秒: 0 };
  }

  设置时间秒(秒: number): void {
    this.时间秒 = 秒;
  }

  是否交互件(): boolean {
    return true;
  }

  可命中(): boolean {
    return true;
  }

  处理按下(事件: 组件事件): boolean {
    const 排行 = this.读取排行矩形();
    if (排行 && 包含点(排行, this.局部转卡坐标(事件.局部坐标))) {
      this.捕获 = "排行";
      this.排行按下 = true;
    } else {
      this.捕获 = "卡";
      this.按下中 = true;
    }
    this.节点?.标脏("按下");
    return true;
  }

  处理移动(事件: 组件事件): void {
    if (!this.捕获) return;
    const 点 = this.局部转卡坐标(事件.局部坐标);
    const 排行 = this.读取排行矩形();
    if (this.捕获 === "排行") {
      const 在内 = 排行 ? 包含点(排行, 点) : false;
      if (在内 !== this.排行按下) {
        this.排行按下 = 在内;
        this.节点?.标脏("移出");
      }
      return;
    }
    const 在内 = this.读取卡矩形() ? 包含点(this.读取卡矩形()!, 点) : false;
    if (在内 !== this.按下中) {
      this.按下中 = 在内;
      this.节点?.标脏("移出");
    }
  }

  处理抬起(事件: 组件事件): void {
    const 捕获 = this.捕获;
    if (!捕获) return;
    this.捕获 = null;
    const 点 = this.局部转卡坐标(事件.局部坐标);
    if (捕获 === "排行") {
      const 应点击 = this.排行按下 && this.读取排行矩形() && 包含点(this.读取排行矩形()!, 点);
      this.排行按下 = false;
      this.节点?.标脏("抬起");
      if (应点击) this.读取参数().排行点击?.();
      return;
    }
    const 应点击 = this.按下中 && this.读取卡矩形() && 包含点(this.读取卡矩形()!, 点);
    this.按下中 = false;
    this.节点?.标脏("抬起");
    if (应点击) this.读取参数().点击?.();
  }

  处理取消(): void {
    if (!this.捕获) return;
    this.捕获 = null;
    this.按下中 = false;
    this.排行按下 = false;
    this.节点?.标脏("取消");
  }

  绘制(环境: 节点绘制环境): void {
    const 画笔 = 读取画笔(环境);
    const 矩形 = 环境.节点.读取本地矩形();
    const 数据 = this.读取参数().数据;
    if (!画笔 || !矩形 || !数据) return;
    const 区域 = this.读取卡区域(矩形);
    const 动效: 模式卡绘制状态 = {
      按下: this.按下中,
      下沉: this.按下中 ? 3 : 0,
      时间秒: this.时间秒,
      点亮: this.按下中 ? [1, 1, 1, 1] : [0, 0, 0, 0],
      排行按下: this.排行按下,
    };
    在本地空间绘制(环境, () => {
      const 图形 = 环境.图形;
      绘制模式卡(图形, 区域, 数据, 动效);
      for (const 项 of 生成模式卡文字项(区域, 数据)) {
        const x = 项.x;
        const y = 项.y + (动效.下沉 ?? 0);
        画笔.绘制文字({
          ...项,
          x,
          y,
          变换: 文字空间矩阵(环境, 矩形.高),
        });
      }
    });
  }

  /** 卡区域在节点本地「左上角、y 向下」空间里。 */
  private 读取卡区域(矩形: 矩形) {
    return {
      模式: this.读取参数().数据?.装置 ?? "马拉松",
      中心X: 矩形.宽 / 2,
      中心Y: 矩形.高 / 2,
      宽: 矩形.宽,
      高: 矩形.高,
    } as const;
  }

  private 读取卡矩形(): 矩形 | null {
    return this.节点?.读取本地矩形() ?? null;
  }

  /** 排行钮矩形：与预制体共用同一份几何，坐标是卡本地（左上角、y 向下）。 */
  private 读取排行矩形(): 矩形 | null {
    const 矩形 = this.读取卡矩形();
    const 数据 = this.读取参数().数据;
    if (!矩形 || !数据?.有排行) return null;
    const 排行 = 计算模式卡排行区域(this.读取卡区域(矩形));
    return { x: 排行.中心X - 排行.宽 / 2, y: 排行.中心Y - 排行.高 / 2, 宽: 排行.宽, 高: 排行.高 };
  }

  /** 事件局部坐标（y 向上）→ 卡本地（左上角、y 向下）。 */
  private 局部转卡坐标(点: { x: number; y: number }): { x: number; y: number } {
    const 矩形 = this.读取卡矩形();
    return { x: 点.x, y: (矩形?.高 ?? 0) - 点.y };
  }
}
