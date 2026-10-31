import { 数值面板 } from "../../../.gamemaker/依赖/框架/界面/控件/数值面板";

interface 加分事件 {
  目标: number;
  起点: { 列: number; 行: number };
  经过秒: number;
  等待秒: number;
  已击中: boolean;
}
export interface 计分反馈视图 {
  显示分数: number;
  目标分数: number;
  击中: number;
  流光: { 列: number; 行: number; 进度: number }[];
}
export const 计分流光秒 = 0.32;

/** 这里只编排落块/消行到 HUD 的表现，计分真值仍在玩法状态。 */
export class 计分反馈 {
  private readonly 数值 = new 数值面板({ 矩形: { 左: 0, 上: 0, 宽: 1, 高: 1 }, 标签: "", 值: 0 });
  private 事件: 加分事件[] = [];

  重置(值 = 0): void {
    this.数值.设置数值(值, true);
    this.事件 = [];
  }

  加分(目标: number, 起点: { 列: number; 行: number }, 消行: boolean): void {
    if (目标 <= this.数值.读取目标值() || this.事件.some((项) => 项.目标 === 目标)) return;
    this.事件.push({ 目标, 起点, 经过秒: 0, 等待秒: 消行 ? 0.14 : 0.04, 已击中: false });
  }

  更新(秒: number): boolean {
    const 活跃 = this.活跃();
    // 先推进旧目标，再处理本帧抵达的流光，命中的这一帧仍保留旧数字。
    this.数值.更新(Math.max(0, 秒));
    for (const 项 of this.事件) {
      项.经过秒 += Math.max(0, 秒);
      if (!项.已击中 && 项.经过秒 >= 项.等待秒 + 计分流光秒) {
        项.已击中 = true;
        this.数值.设置数值(Math.max(项.目标, this.数值.读取目标值()));
      }
    }
    this.事件 = this.事件.filter((项) => 项.经过秒 < 项.等待秒 + 计分流光秒 + 0.28);
    return 活跃 || this.活跃();
  }

  活跃(): boolean {
    return this.事件.length > 0 || this.数值.读取显示值() !== this.数值.读取目标值();
  }

  读取(): 计分反馈视图 {
    let 击中 = 0;
    const 流光: 计分反馈视图["流光"] = [];
    for (const 项 of this.事件) {
      const 飞行秒 = 项.经过秒 - 项.等待秒;
      if (飞行秒 >= 0 && 飞行秒 < 计分流光秒) 流光.push({ ...项.起点, 进度: 飞行秒 / 计分流光秒 });
      if (项.已击中) 击中 = Math.max(击中, Math.max(0, 1 - (飞行秒 - 计分流光秒) / 0.28));
    }
    return { 显示分数: this.数值.读取显示值(), 目标分数: this.数值.读取目标值(), 击中, 流光 };
  }
}

/** 进位只在末位接近 9 时带动上一位，静止时所有数字落在同一底线上。 */
export function 读取滚动数位(值: number, 位数: number) {
  const 正值 = Math.max(0, 值);
  return Array.from({ length: 位数 }, (_, i) => {
    const 单位 = 10 ** (位数 - i - 1);
    const 数字 = Math.floor(正值 / 单位) % 10;
    const 进度 = 单位 === 1 ? 正值 % 1 : Math.max(0, (正值 % 单位) - (单位 - 1));
    return { 数字, 下一个: (数字 + 1) % 10, 进度 };
  });
}
