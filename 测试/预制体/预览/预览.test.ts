import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { Texture } from "three";
import type { 界面资源场景环境 } from "../../../.gamemaker/依赖/框架/开发/界面资源协议";
import { 图元合批 } from "../../../.gamemaker/依赖/框架/界面/图元合批";
import type {
  文字服务 as 控件文字服务,
  界面配色,
} from "../../../.gamemaker/依赖/框架/界面/控件/类型";
import { Three图形 } from "../../../.gamemaker/依赖/框架/界面/绘制/图形";
import type { 画笔, 资源层 } from "../../../.gamemaker/依赖/框架/界面/绘制/画笔";
import { 命中分发 } from "../../../.gamemaker/依赖/框架/运行时/输入路由";
import type { 对局奖励输入 } from "../../../代码/存档/旅行收藏";
import { 界面资源样品 } from "../../../资源/预制体/预览/界面资源";
import { 项目根 as 项目根路径 } from "../../接入/项目路径";

// ── 原 资源主题预览.test.ts ──
describe("资源主题预览", () => {
  test("独立样品的主题槽位由同一输入接管，保留有效的形状及播放输入", () => {
    const 背景 = 界面资源样品.find((项) => 项.编号 === "game-background");
    const 方块 = 界面资源样品.find((项) => 项.编号 === "block-shape");
    expect(背景?.状态.map((项) => 项.键)).toEqual(["资源主题", "播放", "时间"]);
    expect(方块?.状态.some((项) => 项.键 === "资源主题")).toBe(true);
    expect(方块?.状态.some((项) => 项.键 === "外观")).toBe(false);
    expect(方块?.状态.some((项) => 项.键 === "形状")).toBe(true);
  });
});

// ── 原 页面预览环境.test.ts ──
describe("页面预览环境", () => {
  /**
   * 真实页面预览环境的无浏览器规则测试：用最小画笔/合批模拟 GM 宿主资源，
   * 验证页面样品确实 new 真实页面、设置与金币只读隔离，并且不落盘、不联网。
   */

  interface 计数存储 extends Storage {
    写入次数(): number;
    重置写入(): void;
  }

  function 创建计数存储(): 计数存储 {
    const 数据 = new Map<string, string>();
    let 写入 = 0;
    return {
      get length() {
        return 数据.size;
      },
      clear: () => {
        数据.clear();
      },
      getItem: (键) => 数据.get(键) ?? null,
      key: (序号) => [...数据.keys()][序号] ?? null,
      removeItem: (键) => {
        数据.delete(键);
      },
      setItem: (键, 值) => {
        写入++;
        数据.set(键, 值);
      },
      写入次数: () => 写入,
      重置写入: () => {
        写入 = 0;
      },
    };
  }

  function 安装存储(存储: Storage): () => void {
    const 全局 = globalThis as { localStorage?: Storage };
    const 原 = 全局.localStorage;
    全局.localStorage = 存储;
    return () => {
      if (原 === undefined) delete 全局.localStorage;
      else 全局.localStorage = 原;
    };
  }

  interface 网络计数 {
    读取次数(): number;
    重置(): void;
    恢复(): void;
  }

  function 安装网络计数(): 网络计数 {
    const 原 = globalThis.fetch;
    let 次数 = 0;
    const 假fetch = async (...参数: Parameters<typeof fetch>): Promise<Response> => {
      次数++;
      throw new Error(`预览测试禁止网络请求：${String(参数[0])}`);
    };
    Object.defineProperty(globalThis, "fetch", {
      configurable: true,
      writable: true,
      value: 假fetch,
    });
    return {
      读取次数: () => 次数,
      重置: () => {
        次数 = 0;
      },
      恢复: () => {
        Object.defineProperty(globalThis, "fetch", {
          configurable: true,
          writable: true,
          value: 原,
        });
      },
    };
  }

  const 假控件文字: 控件文字服务 = {
    测量: (文本) => Array.from(文本).length * 12,
    读取行高: () => 14,
    排版: (文本, _档, 最大宽度) => {
      const 宽 = Array.from(文本).length * 12;
      return {
        宽: 最大宽度 === undefined ? 宽 : Math.min(宽, 最大宽度),
        高: 14,
        行数: 1,
      };
    },
    折行: (文本) => [文本],
    绘制: () => ({ 宽: 0, 高: 0, 行数: 1 }),
    读取纯色紫外线: () => ({ u: 0, v: 0, 宽: 1, 高: 1 }),
  };

  const 假配色: 界面配色 = {
    底色: 0x0a0e1d,
    面板: 0x15213a,
    浮层: 0x1d2c4a,
    描边: 0x3c5177,
    主字: 0xf3f6fc,
    次字: 0xa9bdd8,
    弱字: 0x7c8faa,
    强调: 0x65e6dc,
    强调字: 0x081721,
    主按钮面板: 0x65e6dc,
    主按钮字: 0x081721,
    次按钮面板: 0x18243a,
    次按钮字: 0xf3f6fc,
    危险: 0xff7f9c,
    成功: 0x85dfa9,
    警告: 0xf4cd75,
    遮罩: 0x000000,
    遮罩透明度: 0.5,
  };

  interface 测试环境 {
    环境: 界面资源场景环境;
    清理: (() => void)[];
    标记失效次数(): number;
  }

  function 创建测试环境(): 测试环境 {
    const 合批 = new 图元合批({ 初始四边形数: 256, 初始三角形数: 1024 });
    const 纯色 = { u: 0, v: 0, 宽: 1, 高: 1 };
    const 白块 = new Texture();
    const 纹理序号 = 合批.注册纹理("页面预览测试白块", 白块);
    合批.设置纯色({ 纹理: 纹理序号, 紫外线: 纯色 });
    const 图形 = new Three图形({ 合批, 纯色紫外线: 纯色, 纯色纹理序号: 纹理序号 });
    const 画笔: 画笔 = {
      图形,
      绘制文字: () => ({ 宽: 0, 高: 0 }),
      测量文字: () => ({ 宽: 0, 高: 0 }),
      绘制纹理帧: () => false,
      绘制散图: () => false,
      读取纯色紫外线: () => 纯色,
      重置: () => {},
      压入裁剪: () => {},
      弹出裁剪: () => {},
    };
    const 资源: 资源层 = {
      读取帧: () => undefined,
      读取页纹理: () => undefined,
      读取散图: () => undefined,
      读取统计: () => ({ 图集数: 0, 页数: 0, 帧数: 0, 纹理字节: 0, 散图数: 0 }),
      销毁: () => {},
    };
    const 命中 = new 命中分发();
    const 清理: (() => void)[] = [];
    let 失效 = 0;
    const 环境: 界面资源场景环境 = {
      画笔,
      控件环境: { 合批, 文字: 假控件文字, 配色: 假配色 },
      设置绘制层: () => {},
      状态: {},
      改状态: () => {},
      资源: {
        逻辑宽: 390,
        逻辑高: 844,
        合批,
        画笔,
        资源,
        命中,
        请求重绘: () => {},
        请求渲染: () => {},
        标记失效: () => {
          失效++;
        },
        需要重建: () => true,
        开始重建: () => {},
        设置绘制层: () => {},
      },
      登记清理: (回调) => {
        清理.push(回调);
      },
    };
    return { 环境, 清理, 标记失效次数: () => 失效 };
  }

  const 奖励输入: 对局奖励输入 = {
    编号: "预览-结算",
    分数: 12800,
    消行: 24,
    用时: 0,
    落块: 24,
    破纪录: true,
    日期: "2026-01-01",
  };

  test("页面样品按页面表登记十个真实页面且元数据不执行游戏模块", async () => {
    // 设置模块加载时会迁移一次旧存档（主题页要读真实主题目录，链路上必然经过它）。
    // 先把它加载完再装计数存储，这样断言到的就是「样品元数据自己有没有写盘」。
    await import("../../../代码/设置/游戏设置");
    const 存储 = 创建计数存储();
    const 恢复存储 = 安装存储(存储);
    const 网络 = 安装网络计数();
    try {
      const { 页面样品, 页面样品清单 } = await import("../../../资源/预制体/预览/页面样品");
      expect(存储.写入次数()).toBe(0);
      expect(网络.读取次数()).toBe(0);
      expect(页面样品).toHaveLength(10);
      // 清单同源于页面表：页面表 7 页 + 启动层合并的对局 + 浮层页。
      const { 创建页面表 } = await import("../../../代码/页面/页面表");
      const { 浮层页面 } = await import("../../../代码/应用/接口/上下文");
      const 应有 = [...Object.keys(创建页面表()), "对局", ...浮层页面];
      expect(页面样品清单.map(String)).toEqual(应有.map(String));
      expect(页面样品.map((项) => String(项.功能))).toEqual(应有.map(String));
      const 预期: readonly {
        编号: string;
        路径: string;
        导出: string;
        方式: "独立" | "需适配";
      }[] = [
        { 编号: "页面-菜单", 路径: "代码/页面/菜单页.ts", 导出: "菜单页", 方式: "独立" },
        {
          编号: "页面-模式选择",
          路径: "代码/页面/模式选择页.ts",
          导出: "模式选择页",
          方式: "独立",
        },
        { 编号: "页面-纯享", 路径: "代码/页面/纯享页.ts", 导出: "纯享页", 方式: "独立" },
        { 编号: "页面-设置", 路径: "代码/页面/设置界面.ts", 导出: "设置界面", 方式: "独立" },
        { 编号: "页面-成就", 路径: "代码/页面/成就界面.ts", 导出: "成就界面", 方式: "独立" },
        {
          编号: "页面-排行榜",
          路径: "代码/页面/排行榜界面.ts",
          导出: "排行榜界面",
          方式: "独立",
        },
        { 编号: "页面-商店", 路径: "代码/页面/商店界面.ts", 导出: "商店界面", 方式: "独立" },
        {
          编号: "页面-对局",
          路径: "代码/页面/对局/对局页面.ts",
          导出: "对局页面",
          方式: "需适配",
        },
        {
          编号: "页面-暂停菜单",
          路径: "代码/页面/对局/暂停菜单页面.ts",
          导出: "暂停菜单页面",
          方式: "独立",
        },
        { 编号: "页面-结算", 路径: "代码/页面/结算/结算页面.ts", 导出: "结算页面", 方式: "独立" },
      ];
      for (const 项 of 预期) {
        const 样品 = 页面样品.find((候选) => 候选.编号 === 项.编号);
        if (!样品) throw new Error(`缺少页面样品：${项.编号}`);
        expect(样品.分类).toBe("应用");
        expect(样品.页面).toBe(true);
        expect(样品.宽).toBe(390);
        expect(样品.高).toBe(844);
        expect(样品.预览?.方式).toBe(项.方式);
        expect(样品.状态.length).toBeGreaterThan(0);
        expect(样品.源码[0]).toEqual({ 路径: 项.路径, 导出: 项.导出 });
        if (项.方式 === "独立") expect(typeof 样品.创建场景).toBe("function");
        else {
          // 不能独立预览就必须写清原因，并且不提供伪造的场景。
          expect(样品.创建场景).toBeUndefined();
          expect(样品.预览?.原因?.length ?? 0).toBeGreaterThan(0);
        }
        // 源码[0] 必须是真实页面模块导出的页面类，主题页据此算「这个页面里有什么」。
        const 模块 = await import(join(项目根路径, 项.路径.replace(/\.ts$/u, "")));
        expect(typeof 模块[项.导出]).toBe("function");
      }
    } finally {
      网络.恢复();
      恢复存储();
    }
  });

  test("共享宿主上的设置修改只在本实例并通知订阅", async () => {
    const 存储 = 创建计数存储();
    const 恢复存储 = 安装存储(存储);
    try {
      const { 创建预览页面上下文 } = await import("../../../资源/预制体/预览/页面环境");
      const { 环境, 标记失效次数 } = 创建测试环境();
      const 甲 = 创建预览页面上下文(环境, { 页面: "菜单" });
      const 乙 = 创建预览页面上下文(环境, { 页面: "菜单" });
      const 乙原始 = { ...乙.上下文.服务.设置.读取() };
      const 通知: string[] = [];
      const 取消 = 甲.上下文.服务.设置.订阅((设置) => 通知.push(设置.背景主题));
      const 失效前 = 标记失效次数();

      甲.上下文.服务.设置.更新({ 背景主题: "云海山岚" });

      expect(甲.上下文.服务.设置.读取().背景主题).toBe("云海山岚");
      expect(乙.上下文.服务.设置.读取()).toEqual(乙原始);
      expect(通知).toEqual(["云海山岚"]);
      expect(标记失效次数()).toBeGreaterThan(失效前);

      取消();
      甲.销毁();
      const 销毁后 = 标记失效次数();
      甲.上下文.服务.设置.更新({ 背景主题: "霓虹天际" });
      expect(标记失效次数()).toBe(销毁后);
      乙.销毁();
    } finally {
      恢复存储();
    }
  });

  test("金币购买/奖励/成就推进只读且不落盘不联网", async () => {
    const 存储 = 创建计数存储();
    const 恢复存储 = 安装存储(存储);
    const 网络 = 安装网络计数();
    try {
      const { 创建预览页面上下文 } = await import("../../../资源/预制体/预览/页面环境");
      const { 环境 } = 创建测试环境();
      const 甲 = 创建预览页面上下文(环境, { 页面: "商店" });
      const 乙 = 创建预览页面上下文(环境, { 页面: "商店" });
      const 乙设置 = { ...乙.上下文.服务.设置.读取() };
      const 乙金币 = 乙.上下文.服务.金币.读取();

      存储.重置写入();
      网络.重置();

      const 购买 = 甲.上下文.服务.金币.购买("成都熊猫", "方块外观");
      const 增加 = 甲.上下文.服务.金币.增加(100);
      const 领取 = 甲.上下文.服务.金币.领取成就(["first-lock"]);
      const 奖励 = 甲.上下文.服务.金币.结算对局(奖励输入);
      for (const 结果 of [购买, 增加, 领取, 奖励]) {
        expect(结果.成功).toBe(false);
        expect(结果.原因).toContain("只读");
        expect(结果.金币).toBe(乙金币.金币);
        expect(结果.新增).toBe(0);
      }

      expect(甲.上下文.服务.金币.读取()).toEqual(乙金币);
      甲.上下文.服务.设置.更新({ 背景主题: "晨光海岸" });
      expect(乙.上下文.服务.设置.读取()).toEqual(乙设置);

      const 平台结果 = await 甲.上下文.服务.平台.加载排行榜("马拉松", "总");
      expect(平台结果.完成).toBe(false);
      expect(平台结果.原因).toContain("离线");
      expect(存储.写入次数()).toBe(0);
      expect(网络.读取次数()).toBe(0);

      甲.销毁();
      乙.销毁();
    } finally {
      网络.恢复();
      恢复存储();
    }
  });

  test("真实页面样品创建真实页面并在销毁时清理", async () => {
    const 存储 = 创建计数存储();
    // 纯享页进入要读风景解锁，链路上有游戏的一次性存档迁移；先种上迁移标记，
    // 这样断言到的就是「预览自己有没有写玩家数据」，而不是存档迁移。
    存储.setItem("旅行版:基础背景保留", "[]");
    const 恢复存储 = 安装存储(存储);
    const 网络 = 安装网络计数();
    try {
      const { 页面样品: 样品列表 } = await import("../../../资源/预制体/预览/页面样品");
      for (const 样品 of 样品列表) await 样品.准备资源?.();
      存储.重置写入();
      网络.重置();

      const { 环境, 清理 } = 创建测试环境();
      // 只跑声明「独立」的页面；需适配的（对局）没有场景，不能伪造。
      const 可预览 = 样品列表.filter((项) => 项.预览?.方式 === "独立");
      expect(可预览).toHaveLength(9);
      for (const 样品 of 可预览) {
        const 场景 = 样品.创建场景?.(环境);
        if (!场景) throw new Error(`页面样品未提供场景：${样品.编号}`);
        场景.更新?.(1 / 60);
        场景.渲染?.();
        const 界面 = 场景.读取界面?.();
        if (!界面) throw new Error(`页面样品未提供界面：${样品.编号}`);
        expect(界面.按钮.length).toBeGreaterThan(0);
        // 排行榜/成就进入后有异步平台能力探测：让它先落地，再销毁，确认不会继续写盘。
        await new Promise((完成) => setTimeout(完成, 0));
        场景.销毁?.();
      }

      for (const 项 of 清理) expect(() => 项()).not.toThrow();
      expect(存储.写入次数()).toBe(0);
      expect(网络.读取次数()).toBe(0);
    } finally {
      网络.恢复();
      恢复存储();
    }
  });

  test("结算页由框架管理命中生命周期，重建不重复绑定，退出取消按住", async () => {
    const 恢复存储 = 安装存储(创建计数存储());
    try {
      const { 创建预览页面上下文 } = await import("../../../资源/预制体/预览/页面环境");
      const { 结算页面 } = await import("../../../代码/页面/结算/结算页面");
      const { 环境 } = 创建测试环境();
      const 会话 = 创建预览页面上下文(环境, { 页面: "结算" });
      const 导航: string[] = [];
      会话.上下文.导航.替换 = (名称) => 导航.push(名称);
      const 页面 = new 结算页面(会话.上下文);
      const 命中 = 环境.资源.命中;
      // 背景两页是节点页面，各登记一块整页命中区；这里只看结算页自己进出是否干净。
      const 基线 = 命中.读取区域数();
      expect(基线).toBe(2);
      页面.进入();
      页面.调整尺寸();
      expect(命中.读取区域数()).toBe(基线 + 1);
      页面.更新(1);
      const 菜单 = 页面.读取界面().按钮.find((项) => 项.名称 === "返回主菜单");
      if (!菜单) throw new Error("缺少结算菜单按钮");
      expect(菜单.可用).toBe(true);
      const 坐标 = { x: 菜单.左 + 菜单.宽 / 2, y: 菜单.上 + 菜单.高 / 2 };
      命中.派发("按下", 坐标);
      页面.退出();
      expect(命中.读取区域数()).toBe(基线);
      页面.进入();
      expect(命中.读取区域数()).toBe(基线 + 1);
      页面.更新(1);
      命中.派发("抬起", 坐标);
      expect(导航).toEqual([]);
      命中.派发("按下", 坐标);
      命中.派发("抬起", 坐标);
      expect(导航).toEqual(["菜单"]);
      页面.销毁();
      expect(命中.读取区域数()).toBe(基线);
      会话.销毁();
      expect(命中.读取区域数()).toBe(0);
    } finally {
      恢复存储();
    }
  });
});
