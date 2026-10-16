import { delimiter, resolve } from "node:path";

const 命令参数 = Bun.argv.slice(2);
if (命令参数.length === 0) {
  console.error("请提供要运行的 Bun 命令和参数。");
  process.exitCode = 1;
} else {
  const NODE_PATH = [resolve(process.cwd(), "node_modules"), process.env.NODE_PATH]
    .filter((路径): 路径 is string => Boolean(路径))
    .join(delimiter);
  const 子进程 = Bun.spawn([process.execPath, ...命令参数], {
    cwd: process.cwd(),
    env: { ...process.env, NODE_PATH },
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
  });
  process.exitCode = await 子进程.exited;
}
