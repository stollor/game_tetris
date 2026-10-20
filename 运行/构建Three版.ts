import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
} from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { gzipSync } from "node:zlib";

/**
 * 构建《再消一行》Three 版：产物写 `产物-three/`，并把运行时资源一起复制进产物：
 * - 项目静态图集（`.gamemaker/图集/项目/再消一行/`）→ `产物-three/图集/`
 * - 用到的散图（游戏图标、GM 套件样张）→ `产物-three/资源/`、`产物-three/GM套件/`
 * 构建后自检图片存在且非空；包体统计区分「脚本/页面（有 gzip 对照）」与「图片资源
 * （webp/png 已是压缩格式，gzip 对照没有意义，只报原始字节）」。
 */

const 产物目录 = "./产物-three";
const 图集源目录 = "./.gamemaker/图集/项目/再消一行";
const 散图列表 = [
  { 源: "./资源/图标/游戏图标.png", 目标: "./资源/图标/游戏图标.png" },
  {
    源: "../../projects/GameMaker-v2/游戏模块库/UI组件库/套件/暗黑风格/资源/圣所.png",
    目标: "./GM套件/暗黑风格/资源/圣所.png",
  },
];

// Bun 在子进程里对中文目录直接 rmSync 会误报 ENOENT，先逐文件删再删目录。
if (existsSync(产物目录)) {
  for (const 项 of readdirSync(产物目录, { withFileTypes: true }))
    rmSync(join(产物目录, 项.name), { recursive: true, force: true });
  rmSync(产物目录, { recursive: true, force: true });
}

const 构建结果 = await Bun.build({
  entrypoints: ["./index.three.html", "./index.资源验收.html"],
  outdir: 产物目录,
  target: "browser",
});

if (!构建结果.success) {
  for (const 日志 of 构建结果.logs) console.error(日志);
  process.exitCode = 1;
} else {
  复制图集();
  复制散图();
  自检资源();
  打印包体();

  // Bun minify 可能把中文标识符与 instanceof 粘成同一个 Identifier，构建期直接拦下。
  const 粘连 = /[\u4e00-\u9fff]instanceof/;
  for (const 文件 of 遍历文件(产物目录)) {
    if (!文件.endsWith(".js")) continue;
    const 文本 = readFileSync(文件, "utf8");
    if (粘连.test(文本)) {
      console.error(
        `构建产物含非法粘连: ${文件} 中出现「中文instanceof」。请给 instanceof 左操作数加括号。`,
      );
      process.exitCode = 1;
    }
  }
}

function 遍历文件(目录: string): string[] {
  const 结果: string[] = [];
  for (const 项 of readdirSync(目录, { withFileTypes: true })) {
    const 路径 = join(目录, 项.name);
    if (项.isDirectory()) 结果.push(...遍历文件(路径));
    else 结果.push(路径);
  }
  return 结果;
}

function 复制图集(): void {
  const 目标目录 = join(产物目录, "图集");
  mkdirSync(目标目录, { recursive: true });
  if (!existsSync(图集源目录))
    throw new Error(
      `缺少项目图集目录：${resolve(图集源目录)}。请先在游戏仓库运行「gm 图集 生成 项目 再消一行」。`,
    );
  for (const 项 of readdirSync(图集源目录, { withFileTypes: true }))
    cpSync(join(图集源目录, 项.name), join(目标目录, 项.name), { recursive: true });
}

function 复制散图(): void {
  for (const 项 of 散图列表) {
    const 源 = resolve(项.源);
    if (!existsSync(源)) throw new Error(`缺少散图：${源}`);
    const 目标 = join(产物目录, 项.目标);
    mkdirSync(dirname(目标), { recursive: true });
    cpSync(源, 目标);
  }
}

function 自检资源(): void {
  const 清单路径 = join(产物目录, "图集/清单.json");
  if (!existsSync(清单路径)) throw new Error(`构建产物缺少图集清单：${resolve(清单路径)}`);
  const 清单 = JSON.parse(readFileSync(清单路径, "utf8")) as {
    页?: { 文件?: unknown }[];
  };
  const 页列表 = Array.isArray(清单.页) ? 清单.页 : [];
  if (页列表.length === 0) throw new Error(`构建产物图集清单没有页：${resolve(清单路径)}`);
  for (const 页 of 页列表) {
    if (typeof 页.文件 !== "string") throw new Error(`构建产物图集清单页文件名非法：${清单路径}`);
    const 页路径 = join(产物目录, "图集", 页.文件);
    if (!existsSync(页路径) || statSync(页路径).size === 0)
      throw new Error(`构建产物缺少图集页图：${resolve(页路径)}`);
  }
  for (const 项 of 散图列表) {
    const 路径 = join(产物目录, 项.目标);
    if (!existsSync(路径) || statSync(路径).size === 0)
      throw new Error(`构建产物缺少散图：${resolve(路径)}`);
  }
  console.log(
    `资源自检通过：图集 ${页列表.length} 页，散图 ${散图列表.length} 张（图集/ + 资源/ + GM套件/）`,
  );
}

function 打印包体(): void {
  const 明细 = 遍历文件(产物目录)
    .filter((项) => 项.endsWith(".js") || 项.endsWith(".html") || 项.endsWith(".css"))
    .map((路径) => {
      const 数据 = readFileSync(路径);
      return {
        名称: relative(产物目录, 路径).replaceAll("\\", "/"),
        字节: 数据.byteLength,
        gzip字节: gzipSync(数据).byteLength,
      };
    })
    .sort((甲, 乙) => 乙.字节 - 甲.字节);
  for (const 文件 of 明细) console.log(`${文件.名称}  ${文件.字节} bytes  gzip ${文件.gzip字节}`);
  const 脚本合计 = 明细.reduce((累计, 文件) => 累计 + 文件.字节, 0);
  const gzip合计 = 明细.reduce((累计, 文件) => 累计 + 文件.gzip字节, 0);
  const js = 明细.filter((文件) => 文件.名称.endsWith(".js"));
  const 最大Chunk = js[0] ?? { 名称: "-", 字节: 0, gzip字节: 0 };

  const 图片 = 遍历文件(产物目录)
    .filter((项) => /\.(webp|png|jpg|jpeg)$/i.test(项))
    .map((路径) => ({
      名称: relative(产物目录, 路径).replaceAll("\\", "/"),
      字节: statSync(路径).size,
    }))
    .sort((甲, 乙) => 乙.字节 - 甲.字节);
  const 图片合计 = 图片.reduce((累计, 文件) => 累计 + 文件.字节, 0);
  for (const 文件 of 图片)
    console.log(`${文件.名称}  ${文件.字节} bytes  （图片已压缩，不计 gzip 对照）`);

  console.log(
    `脚本/页面 ${脚本合计} bytes，gzip 合计 ${gzip合计} bytes，最大 chunk ${最大Chunk.名称} ${最大Chunk.字节} bytes（gzip ${最大Chunk.gzip字节}）`,
  );
  console.log(
    `图片资源 ${图片合计} bytes；产物总计 ${脚本合计 + 图片合计} bytes。gzip 对照只覆盖脚本/页面：webp/png 本身已是压缩格式，再 gzip 没有参考意义。`,
  );
}
