import { expect, test } from "bun:test";
import { readdir, readFile, stat } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";

const 项目 = resolve(import.meta.dir, "..");
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

/** 从 Three 启动与独立预览入口递归导入图，确保项目组件都接入当前运行引擎。 */
async function 未接入组件(): Promise<string[]> {
  const 组件 = (await 收集(join(项目, "组件"))).filter(
    (文件) => !归一(文件).includes("/组件/绘制/") && !归一(文件).includes("/组件/草稿/"),
  );
  const 已载 = new Set<string>();
  const 队列 = [join(项目, "代码/three版/启动.ts"), join(项目, "组件/预览/界面资源.ts")];
  while (队列.length > 0) {
    const 文件 = 队列.pop();
    if (!文件 || 已载.has(文件)) continue;
    已载.add(文件);
    const 文本 = (await readFile(文件, "utf8"))
      .replace(/\/\/[^\n]*/g, "")
      .replace(/\/\*[\s\S]*?\*\//g, "");
    for (const 匹配 of 文本.matchAll(/from\s+"([^"]+)"/g)) {
      const 规格 = 匹配[1];
      const 目标 = 规格.startsWith(".")
        ? resolve(dirname(文件), 规格)
        : 规格.startsWith("框架Three/")
          ? resolve(项目, "框架Three", 规格.slice("框架Three/".length))
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
  return 组件
    .filter((文件) => !已载.has(文件))
    .map((文件) => 归一(relative(项目, 文件)))
    .sort((前, 后) => 前.localeCompare(后));
}

test("项目组件由Three启动或独立预览入口接入", async () => {
  expect(await 未接入组件()).toEqual([]);
});
