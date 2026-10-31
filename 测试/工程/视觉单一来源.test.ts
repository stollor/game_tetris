import { expect, test } from "bun:test";
import { readdir, readFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { 项目根 as 项目根路径 } from "../接入/项目路径";

/**
 * 视觉单一来源规则（Phase 7D 出口）。
 *
 * 目的：Three 版是 Phaser 版的架构替换，视觉资产/逻辑必须单一来源：
 * 1) `代码/应用/**` 不得出现独立的主题色/背景基色/方块色数值表——颜色只能来自
 *    `资源/视效/外观/`、`代码/框架配置/`、`资源/预制体/霓虹街机/`（调色板/文字样式/配方）等共享来源；
 * 2) 页面布局不得在 Three 页面里自造硬编码布局表，必须来自共享配方/共享配置的布局函数；
 * 3) Three 包不得引入 Phaser 运行时（含经共享配方间接 import 到 `phaser` 的情况）。
 *
 * 白名单每一条都要写原因；7A 期间的过渡项在 7B/7C 迁移完成后由 7D 收紧清零。
 * 例外只允许"验收页/后端常量"这类非游戏视觉，且必须写明去向。
 */

const 项目 = 项目根路径;
const 归一 = (路径: string): string => 路径.replaceAll("\\", "/");

async function 收集ts(目录: string): Promise<string[]> {
  const 结果: string[] = [];
  const 列表 = await readdir(目录, { withFileTypes: true }).catch(() => null);
  if (!列表) return 结果;
  for (const 项 of 列表) {
    const 全 = join(目录, 项.name);
    if (项.isDirectory()) {
      if (项.name === "node_modules") continue;
      结果.push(...(await 收集ts(全)));
    } else if (项.name.endsWith(".ts") && !项.name.endsWith(".d.ts")) {
      结果.push(全);
    }
  }
  return 结果;
}

const three文件 = (await 收集ts(join(项目, "代码/three版"))).sort();

/**
 * 允许保留颜色字面量的文件（路径相对项目根 → {上限, 原因}）。
 * 7D 收紧后只剩两张「非游戏视觉」的工装页/调试 UI 白名单；游戏页面必须零字面量。
 */
const 颜色白名单: Record<string, { 上限: number; 原因: string }> = {
  "代码/应用/资源/验收页.ts": {
    上限: 13,
    原因: "资源验收工具页（不是游戏页面）：状态标识用色仅服务验收截图与统计，7D 登记保留",
  },
  "代码/应用/启动.ts": {
    上限: 3,
    原因: "资源加载失败时 DOM 可见错误条的 CSS 调试色（不属于游戏视觉，正常运行时不可见）；清屏色已改读 代码/配置/游戏外观.颜色.底色",
  },
};

/** 允许保留自造布局表的文件：7D 后为空，再出现即视为回归。 */
const 布局白名单: Record<string, string> = {};

const 颜色模式 = /0x[0-9a-fA-F]{6,8}|#[0-9a-fA-F]{6}\b/g;
const 布局声明模式 =
  /(?:const|let)\s+(布局|模式强调色|基础配色|基础背景表|主题配色|配色表|颜色表|模式说明)\s*[:=]/;

test("Three 版不得有独立硬编码色表（白名单外零容忍）", async () => {
  const 违规: string[] = [];
  for (const 文件 of three文件) {
    const 相对 = 归一(relative(项目, 文件));
    const 文本 = await readFile(文件, "utf8");
    const 数量 = 文本.match(颜色模式)?.length ?? 0;
    if (数量 === 0) continue;
    const 允许 = 颜色白名单[相对];
    if (!允许) {
      违规.push(`${相对}：出现 ${数量} 个颜色字面量，应改为 import 共享配置/配方`);
      continue;
    }
    if (数量 > 允许.上限)
      违规.push(`${相对}：颜色字面量 ${数量} 超过白名单上限 ${允许.上限}（${允许.原因}）`);
  }
  expect(违规).toEqual([]);
});

test("Three 页面不得自造硬编码布局表（白名单外零容忍）", async () => {
  const 违规: string[] = [];
  for (const 文件 of three文件) {
    const 相对 = 归一(relative(项目, 文件));
    const 文本 = await readFile(文件, "utf8");
    if (!布局声明模式.test(文本)) continue;
    if (!布局白名单[相对]) 违规.push(`${相对}：出现自造布局/配色表声明，应改为共享布局函数`);
  }
  expect(违规).toEqual([]);
});

/** 解析 import 目标：相对路径、.gamemaker/依赖/框架/*、GM预览协议；返回绝对路径（去扩展名）。 */
function 解析导入(来源文件: string, 规格: string): string | null {
  if (规格.startsWith(".")) return resolve(dirname(来源文件), 规格);
  if (规格 === "GM预览协议") return resolve(项目, "GM预览协议");
  if (规格.startsWith(".gamemaker/依赖/框架/")) return resolve(项目, 规格);
  return null;
}

test("Three 版不得引入 Phaser 运行时（含经共享配方的间接引入）", async () => {
  const 已查 = new Map<string, string | null>();
  const 递归找phaser = async (文件: string): Promise<string | null> => {
    const 键 = 归一(文件);
    if (已查.has(键)) return 已查.get(键) ?? null;
    已查.set(键, null);
    const 文本 = await readFile(文件, "utf8").catch(() => null);
    if (文本 === null) return null;
    // 去掉注释后逐条看 import；import type 会在编译期抹除，不算运行时依赖。
    const 去注释 = 文本.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
    for (const 匹配 of 去注释.matchAll(
      /^\s*(import|export)\s+(type\s+)?[^;]*?from\s+"([^"]+)"/gm,
    )) {
      if (匹配[2]) continue;
      const 规格 = 匹配[3];
      if (规格 === "phaser") {
        const 命中 = `${归一(relative(项目, 文件))} → phaser`;
        已查.set(键, 命中);
        return 命中;
      }
      const 目标 = 解析导入(文件, 规格);
      if (!目标) continue;
      for (const 候选 of [`${目标}.ts`, join(目标, "index.ts")]) {
        const 存在 = await Bun.file(候选).exists();
        if (!存在) continue;
        const 下游 = await 递归找phaser(候选);
        if (下游) {
          const 命中 = `${归一(relative(项目, 文件))} → ${下游}`;
          已查.set(键, 命中);
          return 命中;
        }
      }
    }
    return null;
  };
  const 违规: string[] = [];
  for (const 文件 of three文件) {
    const 命中 = await 递归找phaser(文件);
    if (命中) 违规.push(命中);
  }
  expect(违规).toEqual([]);
});
