/**
 * 对局输入状态机：只把「按住/松开」换算成规则动作，不碰 代码/玩法 与渲染。
 * DAS/ARR、长按暂存、双击硬降都复刻 Phaser 版的节奏值，方便两版对照。
 */

export type 虚拟键 = "左" | "右" | "左转" | "右转" | "旋转" | "半转" | "下" | "硬降" | "暂存";

export type 输入动作 =
  | { 类型: "移动"; 方向: -1 | 1 }
  | { 类型: "旋转"; 方向: 1 | -1 }
  | { 类型: "半转" }
  | { 类型: "软降" }
  | { 类型: "硬降" }
  | { 类型: "暂存" };

/** 首次横移延迟、之后每格的重复间隔。 */
export const 横移初始延迟毫秒 = 133;
export const 横移重复间隔毫秒 = 33;
/** 按住旋转键超过此毫秒触发一次暂存（与 Phaser 版一致）。 */
export const 长按暂存毫秒 = 450;
/** 触屏下键两次按下的最大间隔；第二次按直接硬降。 */
export const 双击硬降毫秒 = 280;
/** 只有短按抬起才计入双击；长按软降抬起后不触发双击。 */
export const 短按抬起毫秒 = 220;

export interface 输入状态选项 {
  /** 测试注入的时间源；缺省 performance.now。 */
  现在?: () => number;
}

export class 输入状态 {
  private readonly 现在: () => number;
  private readonly 按住 = new Set<虚拟键>();
  private 左按住毫秒 = 0;
  private 左下次横移 = 横移初始延迟毫秒;
  private 右按住毫秒 = 0;
  private 右下次横移 = 横移初始延迟毫秒;
  private 旋转按住毫秒 = 0;
  private 长按已触发 = false;
  private 下按下时刻 = 0;
  private 上次下抬起 = Number.NEGATIVE_INFINITY;

  constructor(选项: 输入状态选项 = {}) {
    this.现在 = 选项.现在 ?? (() => performance.now());
  }

  /** 按下：返回应立即执行的动作。重复按下不重复触发。 */
  按下(键: 虚拟键): 输入动作[] {
    if (this.按住.has(键)) return [];
    this.按住.add(键);
    switch (键) {
      case "左":
        this.左按住毫秒 = 0;
        this.左下次横移 = 横移初始延迟毫秒;
        return [{ 类型: "移动", 方向: -1 }];
      case "右":
        this.右按住毫秒 = 0;
        this.右下次横移 = 横移初始延迟毫秒;
        return [{ 类型: "移动", 方向: 1 }];
      case "左转":
        return [{ 类型: "旋转", 方向: -1 }];
      case "右转":
        return [{ 类型: "旋转", 方向: 1 }];
      case "半转":
        return [{ 类型: "半转" }];
      case "旋转":
        this.旋转按住毫秒 = 0;
        this.长按已触发 = false;
        return [{ 类型: "旋转", 方向: 1 }];
      case "下": {
        const 现在 = this.现在();
        this.下按下时刻 = 现在;
        if (现在 - this.上次下抬起 <= 双击硬降毫秒) {
          this.上次下抬起 = Number.NEGATIVE_INFINITY;
          return [{ 类型: "硬降" }];
        }
        this.上次下抬起 = Number.NEGATIVE_INFINITY;
        return [{ 类型: "软降" }];
      }
      case "硬降":
        return [{ 类型: "硬降" }];
      case "暂存":
        return [{ 类型: "暂存" }];
    }
  }

  /** 松开：清理长按/双击计时。 */
  松开(键: 虚拟键): void {
    this.按住.delete(键);
    if (键 === "左") {
      this.左按住毫秒 = 0;
      this.左下次横移 = 横移初始延迟毫秒;
    }
    if (键 === "右") {
      this.右按住毫秒 = 0;
      this.右下次横移 = 横移初始延迟毫秒;
    }
    if (键 === "旋转") {
      this.旋转按住毫秒 = 0;
      this.长按已触发 = false;
    }
    if (键 === "下") {
      const 经过 = this.现在() - this.下按下时刻;
      this.上次下抬起 = 经过 <= 短按抬起毫秒 ? this.现在() : Number.NEGATIVE_INFINITY;
    }
  }

  /** 每个固定步长推进：DAS/ARR 重复与长按暂存。 */
  更新(经过毫秒: number): 输入动作[] {
    const 动作: 输入动作[] = [];
    if (this.按住.has("左")) {
      this.左按住毫秒 += 经过毫秒;
      while (this.左按住毫秒 >= this.左下次横移) {
        动作.push({ 类型: "移动", 方向: -1 });
        this.左下次横移 += 横移重复间隔毫秒;
      }
    }
    if (this.按住.has("右")) {
      this.右按住毫秒 += 经过毫秒;
      while (this.右按住毫秒 >= this.右下次横移) {
        动作.push({ 类型: "移动", 方向: 1 });
        this.右下次横移 += 横移重复间隔毫秒;
      }
    }
    if (this.按住.has("旋转") && !this.长按已触发) {
      this.旋转按住毫秒 += 经过毫秒;
      if (this.旋转按住毫秒 >= 长按暂存毫秒) {
        this.长按已触发 = true;
        动作.push({ 类型: "暂存" });
      }
    }
    return 动作;
  }

  /** 按住下键时更新时钟走软降重力；同时供页面判断是否显示软降状态。 */
  读取按住软降(): boolean {
    return this.按住.has("下");
  }

  读取按住(键: 虚拟键): boolean {
    return this.按住.has(键);
  }

  /** 暂停、失焦、结算时清空所有按住状态，避免恢复后继续移动。 */
  清空(): void {
    this.按住.clear();
    this.左按住毫秒 = 0;
    this.左下次横移 = 横移初始延迟毫秒;
    this.右按住毫秒 = 0;
    this.右下次横移 = 横移初始延迟毫秒;
    this.旋转按住毫秒 = 0;
    this.长按已触发 = false;
    this.上次下抬起 = Number.NEGATIVE_INFINITY;
  }
}
