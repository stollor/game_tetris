import { expect, test } from "bun:test";
import { readdir, readFile, stat } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { 项目根 as 项目根路径 } from "../接入/项目路径";

const 项目 = 项目根路径;
/** 统一用正斜杠比较，避免 Windows 上 join 出来的反斜杠漏匹配。 */
const 归一 = (路径: string): string => 路径.replaceAll("\\", "/");
const 跳过目录 = new Set(["资源", "node_modules"]);

async function 收集(目录: string): Promise<string[]> {
  const 结果: string[] = [];
  const 列表 = await readdir(目录, { withFileTypes: true }).catch(() => null);
  if (!列表) return 结果;
  for (const 项 of 列表) {
    const 全 = join(目录, 项.name);
    if (项.isDirectory()) {
      if (跳过目录.has(项.name)) continue;
      结果.push(...(await 收集(全)));
    } else if (项.name.endsWith(".ts") && !项.name.endsWith(".d.ts")) {
      结果.push(全);
    }
  }
  return 结果;
}

/** 从 Three 启动递归导入图，确保项目预制体都接入当前运行引擎。 */
async function 未接入预制体(): Promise<string[]> {
  const 预制体 = (await 收集(join(项目, "预制体"))).filter(
    (文件) => !归一(文件).includes("/预制体/预览/") && !归一(文件).includes("/预制体/草稿/"),
  );
  const 已载 = new Set<string>();
  const 队列 = [join(项目, "代码/应用/启动.ts")];
  while (队列.length > 0) {
    const 文件 = 队列.pop();
    if (!文件 || 已载.has(文件)) continue;
    已载.add(文件);
    const 文本 = (await readFile(文件, "utf8"))
      .replace(/\/\/[^\n]*/g, "")
      .replace(/\/\*[\s\S]*?\*\//g, "");
    for (const 匹配 of 文本.matchAll(/(?:from\s+|import\s*\(\s*)"([^"]+)"/g)) {
      const 规格 = 匹配[1];
      const 目标 = 规格.startsWith(".")
        ? resolve(dirname(文件), 规格)
        : 规格.startsWith("框架/")
          ? resolve(项目, "框架", 规格.slice("框架/".length))
          : null;
      if (!目标) continue;
      for (const 候选 of [`${目标}.ts`, join(目标, "index.ts")]) {
        try {
          if ((await stat(候选)).isFile()) 队列.push(候选);
        } catch {
          // 目标不是文件就跳过，缺文件的问题交给真正的构建报错。
        }
      }
    }
  }
  return 预制体
    .filter((文件) => !已载.has(文件))
    .map((文件) => 归一(relative(项目, 文件)))
    .sort((前, 后) => 前.localeCompare(后));
}

test("项目预制体由Three启动接入", async () => {
  expect(await 未接入预制体()).toEqual([]);
});
