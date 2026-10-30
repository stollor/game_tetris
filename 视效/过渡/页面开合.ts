import type { 图层变换 } from "../../框架/界面/图元合批";
import { 计算矩形映射 } from "../../框架/界面/流转";

export const 页面开合参数 = {
  打开秒: 0.3,
  关闭秒: 0.2,
  打开曲线: 3,
  关闭曲线: 2.2,
  页面: {
    设置: { x: 0, y: 18, 缩放: 0.978 },
    成就: { x: 20, y: 0, 缩放: 0.985 },
    商店: { x: 0, y: 28, 缩放: 0.99 },
  },
} as const;

export const 页面开合命中层 = "页面开合";
export type 开合页面 = keyof typeof 页面开合参数.页面;
export type 开合方向 = "打开" | "关闭";

export function 是开合页面(页面: string): 页面 is 开合页面 {
  return Object.hasOwn(页面开合参数.页面, 页面);
}

/** 复用流转矩形映射，整个缓存图层中的文字、图标与裁剪保持一致。 */
export function 计算页面开合变换(
  页面: 开合页面,
  方向: 开合方向,
  秒: number,
  宽: number,
  高: number,
  背景 = false,
): 图层变换 {
  const 时长 = 方向 === "打开" ? 页面开合参数.打开秒 : 页面开合参数.关闭秒;
  const 进度 = Math.max(0, Math.min(1, 秒 / 时长));
  const 远离 =
    方向 === "打开" ? (1 - 进度) ** 页面开合参数.打开曲线 : 进度 ** 页面开合参数.关闭曲线;
  const 配方 = 页面开合参数.页面[页面];
  // 设置的面板属于背景层，需要和正文一起移动；风景背景只交叉淡入淡出。
  const 运动 = 背景 && 页面 !== "设置" ? 0 : 远离;
  const 缩放 = 1 - (1 - 配方.缩放) * 运动;
  const 静止 = { 左: 0, 上: 0, 宽, 高 };
  const 映射 = 计算矩形映射(静止, {
    左: (宽 * (1 - 缩放)) / 2 + 配方.x * 运动,
    上: (高 * (1 - 缩放)) / 2 + 配方.y * 运动,
    宽: 宽 * 缩放,
    高: 高 * 缩放,
  });
  return {
    x: 映射.当前中心X - 映射.静止中心X * 映射.缩放X,
    y: 映射.当前中心Y - 映射.静止中心Y * 映射.缩放Y,
    缩放X: 映射.缩放X,
    缩放Y: 映射.缩放Y,
    透明度: 1 - 远离,
  };
}

export class 页面开合 {
  private 状态: { 页面: 开合页面; 方向: 开合方向; 秒: number; 完成: () => void } | null = null;

  读取播放中(): boolean {
    return this.状态 !== null;
  }

  播放(页面: 开合页面, 方向: 开合方向, 完成: () => void): void {
    this.状态 = { 页面, 方向, 秒: 0, 完成 };
  }

  更新(秒: number): boolean {
    const 状态 = this.状态;
    if (!状态) return false;
    状态.秒 += Math.max(0, 秒);
    const 时长 = 状态.方向 === "打开" ? 页面开合参数.打开秒 : 页面开合参数.关闭秒;
    if (状态.秒 >= 时长) {
      this.状态 = null;
      状态.完成();
    }
    return true;
  }

  读取变换(页面: string, 子层: number, 宽: number, 高: number): 图层变换 | null {
    const 状态 = this.状态;
    if (!状态 || 页面 !== 状态.页面) return null;
    return 计算页面开合变换(状态.页面, 状态.方向, 状态.秒, 宽, 高, 子层 < 2);
  }
}
