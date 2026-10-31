import { expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { 项目根 as 项目根路径 } from "../接入/项目路径";

const 根 = 项目根路径;
const 视觉目录 = ["资源/预制体", "资源/视效", "资源/主题"];

async function 源文件(目录: string): Promise<string[]> {
  const 文件: string[] = [];
  for (const 项 of await readdir(目录, { withFileTypes: true })) {
    if (项.isDirectory()) 文件.push(...(await 源文件(join(目录, 项.name))));
    else if (项.isFile() && 项.name.endsWith(".ts")) 文件.push(join(目录, 项.name));
  }
  return 文件;
}

test("根目录只放项目自己的东西", async () => {
  const 允许 = new Set([
    ".gamemaker",
    ".git",
    ".gitattributes",
    ".gitignore",
    ".vscode",
    "AGENTS.md",
    "GM预览协议.ts",
    "biome.json",
    "bun.lock",
    "bunfig.toml",
    "index.html",
    "node_modules",
    "package.json",
    "tsconfig.json",
    "代码",
    "测试",
    "资源",
    "配置",
  ]);
  expect((await readdir(根)).filter((名) => !允许.has(名))).toEqual([]);
});

test("依赖联接、打包产物、验收报告都在 .gamemaker 托管区", async () => {
  for (const 名 of ["框架", "游戏模块库", "GM"])
    expect(existsSync(join(根, ".gamemaker/依赖", 名))).toBe(true);
  for (const 旧 of [
    "框架",
    "游戏模块库",
    "GM工具",
    "产物",
    "reports",
    "预制体",
    "视效",
    "主题",
    "宣发",
    "文档",
    "截图",
    "组件",
  ])
    expect(existsSync(join(根, 旧))).toBe(false);
});

test("资源目录就是游戏视觉与素材，策划数据在配置内", async () => {
  for (const 名 of ["预制体", "视效", "主题", "字体", "宣发"])
    expect(existsSync(join(根, "资源", 名))).toBe(true);
  expect(existsSync(join(根, "资源/预制体/预览/界面资源.ts"))).toBe(true);
  expect(existsSync(join(根, "配置/策划/项目.json"))).toBe(true);
  // 资源视觉检查交给 GM 界面预览/UI交付，项目不再自建资源验收页与测试夹具。
  expect(existsSync(join(根, "测试/资源验收"))).toBe(false);
  expect(existsSync(join(根, "测试/资源"))).toBe(false);
});

test("现行入口与职责归位，构建工具和独立预览不进入业务依赖", async () => {
  expect(existsSync(join(根, "代码/应用/启动.ts"))).toBe(true);
  expect(existsSync(join(根, "代码/three版/启动.ts"))).toBe(false);
  expect(existsSync(join(根, "index.three.html"))).toBe(false);
  expect(await readFile(join(根, "index.html"), "utf8")).toContain("代码/应用/启动.ts");
  const 解析器 = new Bun.Transpiler({ loader: "ts" });
  for (const 目录名 of ["代码", ...视觉目录])
    for (const 文件 of await 源文件(join(根, 目录名))) {
      for (const 项 of 解析器.scanImports(await readFile(文件, "utf8"))) {
        expect(
          /\.gamemaker\/依赖\/GM|(?:^|\/)源码\/|资源\/预制体\/预览\/|^(node:|bun$|playwright$)/.test(
            项.path,
          ),
          文件 + " → " + 项.path,
        ).toBe(false);
        if (/^three(?:\/|$)/.test(项.path)) {
          const 路径 = 文件.replaceAll("\\", "/");
          expect(
            路径.endsWith("代码/应用/资源/资源加载.ts") ||
              路径.endsWith("资源/视效/透视/透视棋盘.ts") ||
              路径.endsWith("资源/视效/透视/房间装置.ts"),
            "Three只从明确的资源适配边界接入：" + 文件,
          ).toBe(true);
        }
        if (
          文件.startsWith(join(根, "代码/玩法") + "\\") ||
          文件.startsWith(join(根, "代码/玩法") + "/")
        )
          expect(
            /框架\/(世界|界面|开发)\/|^three(?:\/|$)/.test(项.path),
            "玩法不得依赖引擎：" + 文件,
          ).toBe(false);
      }
    }
});
