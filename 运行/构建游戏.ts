import { 创建Phaser构建插件 } from "./Phaser构建";

const 构建结果 = await Bun.build({
  entrypoints: ["./index.html"],
  outdir: "./产物",
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
}
