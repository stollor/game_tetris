import { existsSync } from "node:fs";
import { dirname, join } from "node:path";

/**
 * 测试文件按代码目录镜像放置，层级会变；项目根不靠相对层数推算，
 * 而是从本文件向上找到含 package.json 的目录，测试怎么搬都不会断。
 */
function 向上找项目根(起点: string): string {
  let 目录 = 起点;
  for (;;) {
    if (existsSync(join(目录, "package.json"))) return 目录;
    const 上级 = dirname(目录);
    if (上级 === 目录) throw new Error(`找不到项目根（package.json）：${起点}`);
    目录 = 上级;
  }
}

export const 项目根 = 向上找项目根(import.meta.dir);
