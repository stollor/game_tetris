import { expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { 项目根 as 项目根路径 } from "../接入/项目路径";

const 根 = 项目根路径;
async function 源文件(目录: string): Promise<string[]> {
  const 文件: string[] = [];
  for (const 项 of await readdir(目录, { withFileTypes: true })) {
    if (项.isDirectory()) 文件.push(...(await 源文件(join(目录, 项.name))));
    else if (项.isFile() && 项.name.endsWith(".ts")) 文件.push(join(目录, 项.name));
  }
  return 文件;
}

test("现行入口与职责归位，构建工具和独立预览不进入业务依赖", async () => {
  expect(existsSync(join(根, "代码/应用/启动.ts"))).toBe(true);
  expect(existsSync(join(根, "代码/three版/启动.ts"))).toBe(false);
  expect(existsSync(join(根, "index.three.html"))).toBe(false);
  expect(await readFile(join(根, "index.html"), "utf8")).toContain("代码/应用/启动.ts");
  const 解析器 = new Bun.Transpiler({ loader: "ts" });
  for (const 目录名 of ["代码", "视效", "主题"])
    for (const 文件 of await 源文件(join(根, 目录名))) {
      for (const 项 of 解析器.scanImports(await readFile(文件, "utf8"))) {
        expect(
          /GM工具|(?:^|\/)源码\/|预制体\/预览\/|^(node:|bun$|playwright$)/.test(项.path),
          文件 + " → " + 项.path,
        ).toBe(false);
        if (/^three(?:\/|$)/.test(项.path)) {
          const 路径 = 文件.replaceAll("\\", "/");
          expect(
            路径.endsWith("代码/应用/资源/资源加载.ts") ||
              路径.endsWith("视效/透视/透视棋盘.ts") ||
              路径.endsWith("视效/透视/房间装置.ts"),
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
