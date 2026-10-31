import { describe, expect, test } from "bun:test";
import { 校验音乐库 } from "../../.gamemaker/依赖/框架/音频/音乐目录";
import { 校验音效库 } from "../../.gamemaker/依赖/框架/音频/音效目录";
import { 场景氛围表 } from "../../代码/框架配置/场景氛围";
import { 音乐库 } from "../../代码/框架配置/音乐";
import { 消行谱, 连击谱, 音效库 } from "../../代码/框架配置/音效";
import { 结算音效名称 } from "../../代码/音频/结算音效";
import { 模式配置, 节奏配置, 速度表 } from "../../代码/项目配置/模式";

describe("配置表运行值", () => {
  test("模式目标与用户确认的当前配置一致", () => {
    expect(模式配置.马拉松目标行数).toBe(100);
    expect(模式配置.冲刺目标行数).toBe(40);
    expect(模式配置.冲刺等级上限).toBe(5);
    expect(模式配置.极限毫秒).toBe(120_000);
  });

  test("锁定节奏与原有硬编码一致", () => {
    expect(节奏配置.锁定延迟毫秒).toBe(500);
    expect(节奏配置.锁定重置上限).toBe(15);
  });

  test("逐档下落速度与用户确认的调参基线一致", () => {
    expect(速度表).toEqual([
      0, 0.5, 0.6, 0.8, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6, 6.5, 7, 7.5, 8, 8,
    ]);
  });
});

describe("框架配置音频表", () => {
  test("音乐库与音效库通过框架校验", () => {
    expect(() => 校验音乐库(音乐库)).not.toThrow();
    expect(() => 校验音效库(音效库)).not.toThrow();
  });

  test("十八种基础音效全部登记", () => {
    const 名称 = 音效库
      .filter((项) => 项.id.startsWith("再消一行.") && !项.名称.endsWith("氛围"))
      .map((项) => 项.名称)
      .sort();
    expect(名称).toEqual(
      [
        "移动",
        "旋转",
        "软降",
        "硬降",
        "锁定",
        "四行",
        "消行",
        "连击",
        "暂存",
        "技巧",
        "全清",
        "准备",
        "开始",
        "暂停",
        "继续",
        "结束",
        "胜利",
        "返回",
      ].sort(),
    );
  });

  test("两首背景曲谱用稳定编号登记", () => {
    expect(音乐库.filter((项) => 项.id.startsWith("再消一行.")).map((项) => 项.id)).toEqual([
      "再消一行.菜单",
      "再消一行.对局",
    ]);
  });

  test("像素主题各有一首主题曲，互不雷同", () => {
    const 主题曲 = 音乐库.filter((项) => 项.id.endsWith(".主题") && 项.类型 === "曲谱");
    expect(主题曲.map((项) => 项.id).sort()).toEqual(["砖机液晶.主题", "街机彩砖.主题"]);
    const 谱 = 主题曲.map((项) => (项.类型 === "曲谱" ? JSON.stringify(项.曲谱) : ""));
    expect(new Set(谱).size).toBe(2);
  });

  test("四套主题都有独立氛围谱", () => {
    expect(Object.keys(场景氛围表).sort()).toEqual(
      ["极光原野", "砖机液晶", "街机彩砖", "立体晶格"].sort(),
    );
    expect(音效库.filter((项) => 项.id.startsWith("再消一行.氛围.")).map((项) => 项.id)).toEqual(
      Object.keys(场景氛围表).map((主题) => `再消一行.氛围.${主题}`),
    );
    for (const 配方 of Object.values(场景氛围表)) expect(配方.循环.length).toBeGreaterThan(0);
  });

  test("冲刺完赛用胜利音，未完赛用结束音", () => {
    expect(结算音效名称(true)).toBe("胜利");
    expect(结算音效名称(false)).toBe("结束");
  });
  test("消行与连击随参数变化", () => {
    expect(消行谱(1).音符?.length).toBeLessThan(消行谱(4).音符?.length ?? 0);
    const 前 = 连击谱(3).音符?.[0]?.起频 ?? 0;
    const 后 = 连击谱(5).音符?.[0]?.起频 ?? 0;
    expect(后).toBeGreaterThan(前);
  });
});
