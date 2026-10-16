import { expect, test } from "bun:test";
import { readdir, readFile, stat } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";

const 项目 = resolve(import.meta.dir, "..");
/** 统一用正斜杠比较，避免 Windows 上 join 出来的反斜杠漏匹配。 */
const 归一 = (路径: string): string => 路径.replaceAll("\\", "/");
const 组件前缀 = `${归一(join(项目, "组件"))}/`;
const 预览前缀 = `${归一(join(项目, "组件/预览"))}/`;
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

/** 从 `组件/预览/` 的入口出发，按相对导入找出预览真正加载的组件，没覆盖到的文件就是漏登记。 */
async function 未登记组件(): Promise<string[]> {
  const 组件 = await 收集(join(项目, "组件"));
  const 已载 = new Set<string>();
  const 队列 = 组件.filter((文件) => 归一(文件).startsWith(预览前缀));
  while (队列.length > 0) {
    const 文件 = 队列.pop();
    if (!文件 || 已载.has(文件)) continue;
    已载.add(文件);
    const 文本 = (await readFile(文件, "utf8"))
      .replace(/\/\/[^\n]*/g, "")
      .replace(/\/\*[\s\S]*?\*\//g, "");
    for (const 匹配 of 文本.matchAll(/from\s+"([^"]+)"/g)) {
      const 规格 = 匹配[1];
      if (!规格.startsWith(".")) continue;
      const 目标 = resolve(dirname(文件), 规格);
      for (const 候选 of [`${目标}.ts`, join(目标, "index.ts")]) {
        // 只在组件内部沿引用传递，避免经过玩法代码把没登记的组件“蹭”成已覆盖。
        if (!归一(候选).startsWith(组件前缀)) continue;
        try {
          if ((await stat(候选)).isFile()) 队列.push(候选);
        } catch {
          // 目标不是文件就跳过，缺文件的问题交给真正的构建报错。
        }
      }
    }
  }
  return 组件
    .filter((文件) => !归一(文件).startsWith(预览前缀))
    .filter((文件) => !已载.has(文件))
    .map((文件) => 归一(relative(项目, 文件)))
    .sort((前, 后) => 前.localeCompare(后));
}

test("项目组件都被预览库的样品引用", async () => {
  expect(await 未登记组件()).toEqual([]);
});
