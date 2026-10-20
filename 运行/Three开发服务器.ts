import { existsSync } from "node:fs";
import { resolve, sep } from "node:path";
import { 读取服务地址 } from "./服务地址";

/**
 * Three 版开发服务器：构建两个页面（游戏 / 资源验收）后在本进程内存里提供页面，
 * 并把游戏仓库里的静态资源挂成三个只读路由：
 * - `/图集/<相对路径>`  → `.gamemaker/图集/项目/再消一行/`（清单.json + 页图；`清单.目录` 语义就是相对 .gamemaker/图集/ 的这个子目录）
 * - `/资源/<相对路径>`  → 游戏仓库 `资源/`
 * - `/GM套件/<相对路径>` → GM `游戏模块库/UI组件库/套件/`（跨仓相对路径，游戏根 ../../projects/GameMaker-v2/...）
 * 路径统一 resolve + 前缀校验，拒绝越界；所有响应 no-store，改代码重启即生效。
 */

const 基础目录 = process.cwd();
const 图集目录 = resolve(基础目录, ".gamemaker/图集/项目/再消一行");
const 资源目录 = resolve(基础目录, "资源");
const GM套件目录 = resolve(基础目录, "../../projects/GameMaker-v2/游戏模块库/UI组件库/套件");

const 静态路由列表 = [
  { 前缀: "/图集/", 目录: 图集目录 },
  { 前缀: "/资源/", 目录: 资源目录 },
  { 前缀: "/GM套件/", 目录: GM套件目录 },
] as const;

const 内容类型表: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webp": "image/webp",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
};

function 读取内容类型(路径: string): string {
  const 点序号 = 路径.lastIndexOf(".");
  return (
    内容类型表[点序号 >= 0 ? 路径.slice(点序号).toLowerCase() : ""] ?? "application/octet-stream"
  );
}

/** 解析静态资源路径；越界返回 null。 */
function 解析静态文件(路径: string): { 文件路径: string } | null {
  for (const 路由 of 静态路由列表) {
    if (!路径.startsWith(路由.前缀)) continue;
    const 相对 = decodeURIComponent(路径.slice(路由.前缀.length));
    const 文件路径 = resolve(路由.目录, 相对);
    if (文件路径 !== 路由.目录 && !文件路径.startsWith(`${路由.目录}${sep}`)) return null;
    return { 文件路径 };
  }
  return null;
}

const 构建结果 = await Bun.build({
  entrypoints: ["./index.three.html", "./index.资源验收.html"],
  target: "browser",
});

if (!构建结果.success) {
  for (const 日志 of 构建结果.logs) console.error(日志);
  process.exitCode = 1;
} else {
  const 静态文件 = new Map(
    构建结果.outputs.map((文件) => [文件.path.split(/[\\/]/).at(-1) ?? "", 文件]),
  );

  const { 主机名, 端口: 首选端口 } = 读取服务地址(Bun.argv.slice(2));
  let 当前端口 = 首选端口;
  let 服务器: ReturnType<typeof Bun.serve> | undefined;

  while (!服务器) {
    try {
      服务器 = Bun.serve({
        hostname: 主机名,
        port: 当前端口,
        async fetch(请求) {
          const 路径 = decodeURIComponent(new URL(请求.url).pathname).replace(/^\/+/, "") || "";
          // 静态资源路由（图集 / 游戏资源 / GM 套件）。
          const 静态 = 解析静态文件(`/${路径}`);
          if (静态) {
            if (!existsSync(静态.文件路径)) return new Response("Not Found", { status: 404 });
            return new Response(Bun.file(静态.文件路径), {
              headers: {
                "Content-Type": 读取内容类型(静态.文件路径),
                "Cache-Control": "no-store",
              },
            });
          }
          const 别名 = 路径 === "资源验收" ? "index.资源验收.html" : 路径;
          const 文件 = 静态文件.get(别名 || "index.three.html");
          if (!文件) return new Response("Not Found", { status: 404 });
          return new Response(文件, {
            headers: {
              "Content-Type": 文件.type,
              "Cache-Control": "no-store",
            },
          });
        },
      });
    } catch (错误) {
      const 端口被占用 = 错误 instanceof Error && "code" in 错误 && 错误.code === "EADDRINUSE";
      if (!端口被占用 || 当前端口 === 0 || 当前端口 >= 65535) throw 错误;
      console.warn("端口 " + 当前端口 + " 已占用，尝试端口 " + (当前端口 + 1) + "。");
      当前端口++;
    }
  }

  console.log("Three 版已构建并启动：" + 服务器.url);
  console.log("资源验收页：" + 服务器.url + "资源验收");
  console.log("图集路由：" + 图集目录);
  console.log("GM 套件路由：" + GM套件目录);
}
