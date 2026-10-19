import { readdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { 创建Phaser构建插件 } from "./Phaser构建";

const 产物目录 = "./产物";
for (const 名 of readdirSync(产物目录, { withFileTypes: true })) {
  if (名.isFile() && /\.(js|css|html|map)$/.test(名.name)) {
    rmSync(join(产物目录, 名.name));
  }
}

const 构建结果 = await Bun.build({
  entrypoints: ["./index.html"],
  outdir: 产物目录,
  target: "browser",
  plugins: [创建Phaser构建插件()],
});

if (!构建结果.success) {
  for (const 日志 of 构建结果.logs) console.error(日志);
  process.exitCode = 1;
} else {
  for (const 文件 of 构建结果.outputs) {
    console.log(文件.path.split(/[\\/]/).at(-1) + "  " + 文件.size + " bytes");
  }
  // Bun minify may glue Unicode property names to `instanceof` (e.g. `.节点instanceof`),
  // which is a single Identifier continuum and crashes at parse time → black screen.
  const 粘连 = /[\u4e00-\u9fff]instanceof/;
  for (const 名 of readdirSync(产物目录)) {
    if (!名.endsWith(".js")) continue;
    const 文本 = readFileSync(join(产物目录, 名), "utf8");
    if (粘连.test(文本)) {
      console.error(
        `构建产物含非法粘连: ${名} 中出现「中文instanceof」。请给 instanceof 左操作数加括号，例如 (项.节点) instanceof 界面控件`,
      );
      process.exitCode = 1;
    }
  }
}
