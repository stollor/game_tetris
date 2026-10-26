import type { 界面快照 } from "../../../代码/应用/接口/上下文";
import type { 测试状态 } from "../../../代码/页面/对局/对局页面";

declare global {
  interface Window {
    __再消一行测试__?: {
      读取状态(): 测试状态;
      读取界面(): 界面快照 & {
        震屏?: { 剩余: number };
        消行特效?: { 活跃: boolean };
      };
      读取音频(): unknown;
      设置序列(序列: readonly string[]): void;
      准备单行消除(): void;
      准备四行消除(继续连击?: boolean, 保留堆叠?: boolean): void;
      硬降(): void;
      设置暂停(暂停: boolean): void;
      结束当前对局(): void;
      准备结算(完赛?: boolean): void;
      进入素材场景(场景: string, 宽?: number, 高?: number, 皮肤?: string): void;
      开始素材演示(参数: {
        模式: string;
        皮肤: string;
        目标: "成功" | "失败";
        秒数: number;
        宽: number;
        高: number;
      }): void;
      读取素材演示(): { 场景: string; 结束: boolean; 完赛: boolean; 消行数: number };
      准备倒计时: (剩余毫秒: number) => void;
      准备贴墙旋转: () => void;
    };
  }
}
