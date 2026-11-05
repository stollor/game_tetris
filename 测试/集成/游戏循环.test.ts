import { describe, expect, test } from "bun:test";
import { 创建游戏循环 } from "../../.gamemaker/依赖/框架/运行时/循环";

/** 手动驱动的循环：把排队中的下一帧回调取出来执行，模拟 rAF。 */
function 创建手动循环(选项: {
  渲染?: () => void;
  错误处理?: (错误: unknown, 阶段: "更新" | "渲染") => void;
}) {
  const 队列: (() => void)[] = [];
  let 现在 = 0;
  const 循环 = 创建游戏循环({
    时间源: () => 现在,
    请求帧: (回调) => {
      队列.push(回调);
      return 队列.length;
    },
    取消帧: () => {},
    请求定时: (回调) => {
      队列.push(回调);
      return 队列.length;
    },
    取消定时: () => {},
    更新: () => {},
    渲染: 选项.渲染 ?? (() => {}),
    错误处理: 选项.错误处理,
    失焦自动暂停: false,
  });
  const 推一帧 = () => {
    现在 += 16;
    队列.shift()?.();
  };
  return { 循环, 推一帧, 队列 };
}

describe("游戏循环", () => {
  test("渲染抛错有兜底时继续调度下一帧，帧数照常推进", () => {
    const 错误: { 阶段: string; 消息: string }[] = [];
    const { 循环, 推一帧, 队列 } = 创建手动循环({
      渲染: () => {
        throw new Error("绘制炸了");
      },
      错误处理: (错误项, 阶段) => {
        错误.push({ 阶段, 消息: 错误项 instanceof Error ? 错误项.message : String(错误项) });
      },
    });
    循环.启动();
    for (let 帧 = 0; 帧 < 5; 帧++) 推一帧();

    expect(错误.length).toBe(5);
    expect(错误.every((项) => 项.阶段 === "渲染")).toBe(true);
    expect(错误[0]?.消息).toBe("绘制炸了");
    // 关键：异常没有切断 rAF 链，循环仍在推帧。
    expect(循环.读取统计().帧数).toBe(5);
    expect(队列.length).toBe(1);
    循环.停止();
  });

  test("没有兜底时保持 fail-fast，把异常抛给调用方", () => {
    const { 循环, 推一帧 } = 创建手动循环({
      渲染: () => {
        throw new Error("绘制炸了");
      },
    });
    循环.启动();
    expect(() => 推一帧()).toThrow("绘制炸了");
    循环.停止();
  });
});
