import { existsSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

/** 构建《再消一行》Three 版：产物写 产物-three/，并打印包体与 gzip 对照数据。 */

const 产物目录 = "./产物-three";
// Bun 在子进程里对中文目录直接 rmSync 会误报 ENOENT，先逐文件删再删目录。
if (existsSync(产物目录)) {
  for (const 项 of readdirSync(产物目录, { withFileTypes: true }))
    rmSync(join(产物目录, 项.name), { recursive: true, force: true });
  rmSync(产物目录, { recursive: true, force: true });
}

const 构建结果 = await Bun.build({
  entrypoints: ["./index.three.html"],
  outdir: 产物目录,
  target: "browser",
});

if (!构建结果.success) {
  for (const 日志 of 构建结果.logs) console.error(日志);
  process.exitCode = 1;
} else {
  const 明细 = readdirSync(产物目录, { withFileTypes: true })
    .filter((项) => 项.isFile())
    .map((项) => {
      const 数据 = readFileSync(join(产物目录, 项.name));
      return { 名称: 项.name, 字节: 数据.byteLength, gzip字节: gzipSync(数据).byteLength };
    })
    .sort((甲, 乙) => 乙.字节 - 甲.字节);
  for (const 文件 of 明细) console.log(`${文件.名称}  ${文件.字节} bytes  gzip ${文件.gzip字节}`);
  const 合计 = 明细.reduce((累计, 文件) => 累计 + 文件.字节, 0);
  const gzip合计 = 明细.reduce((累计, 文件) => 累计 + 文件.gzip字节, 0);
  const js = 明细.filter((文件) => 文件.名称.endsWith(".js"));
  const 最大Chunk = js[0] ?? { 名称: "-", 字节: 0, gzip字节: 0 };
  console.log(
    `总大小 ${合计} bytes，gzip 合计 ${gzip合计} bytes，最大 chunk ${最大Chunk.名称} ${最大Chunk.字节} bytes（gzip ${最大Chunk.gzip字节}）`,
  );

  // Bun minify 可能把中文标识符与 instanceof 粘成同一个 Identifier，构建期直接拦下。
  const 粘连 = /[\u4e00-\u9fff]instanceof/;
  for (const 文件 of 明细) {
    if (!文件.名称.endsWith(".js")) continue;
    const 文本 = readFileSync(join(产物目录, 文件.名称), "utf8");
    if (粘连.test(文本)) {
      console.error(
        `构建产物含非法粘连: ${文件.名称} 中出现「中文instanceof」。请给 instanceof 左操作数加括号。`,
      );
      process.exitCode = 1;
    }
  }
}
