import { existsSync } from "node:fs";
import { resolve, sep } from "node:path";
import { 构建项目 } from "../.gamemaker/依赖/GM/工具链/游戏项目/构建/构建项目";
import { 校验配置 } from "../.gamemaker/依赖/游戏模块库/框架/配置表/配置协议";
import { 读取服务地址 } from "./服务地址";

/**
 * Three 版开发服务器：构建两个页面（游戏 / 资源验收）后在本进程内存里提供页面，
 * 并把游戏仓库里的静态资源挂成三个只读路由：
 * - `/图集/<相对路径>`  → `.gamemaker/图集/项目/再消一行/`（清单.json + 页图；`清单.目录` 语义就是相对 .gamemaker/图集/ 的这个子目录）
 * - `/资源/<相对路径>`  → 游戏仓库 `资源/`
 * - `/测试资源/<相对路径>` → 项目 `测试/资源/`
 * 路径统一 resolve + 前缀校验，拒绝越界；所有响应 no-store，配置变化后刷新重建，原页面与上轮哈希资源保持可用；代码修改仍需重启。
 */

const 基础目录 = process.cwd();
const 图集目录 = resolve(基础目录, ".gamemaker/图集/项目/再消一行");
const 资源目录 = resolve(基础目录, "资源");
const 测试资源目录 = resolve(基础目录, "测试/资源");
/** 资源验收页在测试目录内；构建产物按文件名索引，所以运行时用文件名当别名。 */
const 资源验收入口 = "./测试/资源验收/资源验收.html";
const 资源验收别名 = "资源验收.html";

const 静态路由列表 = [
  { 前缀: "/图集/", 目录: 图集目录 },
  { 前缀: "/资源/", 目录: 资源目录 },
  { 前缀: "/测试资源/", 目录: 测试资源目录 },
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

let 静态文件 = new Map<string, Bun.BuildArtifact>();
let 上次文件 = 静态文件;
let 构建中: Promise<void> | undefined;
async function 确保构建(): Promise<void> {
  if (构建中) return 构建中;
  // HTML刷新必须读取源码变化，不能只以配置表内容决定是否重建。
  构建中 = (async () => {
    校验配置(await Bun.file("配置/配置表.json").json());
    const 结果 = await 构建项目({
      entrypoints: ["./index.html", 资源验收入口],
      target: "browser",
    });
    if (!结果.success) throw new Error(结果.logs.map(String).join("\n"));
    上次文件 = 静态文件;
    静态文件 = new Map(结果.outputs.map((文件) => [文件.path.split(/[\\/]/).at(-1) ?? "", 文件]));
  })();
  try {
    await 构建中;
  } finally {
    构建中 = undefined;
  }
}
await 确保构建();
{
  const { 主机名, 端口: 首选端口 } = 读取服务地址(Bun.argv.slice(2));
  let 当前端口 = 首选端口;
  let 服务器: ReturnType<typeof Bun.serve> | undefined;

  while (!服务器) {
    try {
      服务器 = Bun.serve({
        hostname: 主机名,
        port: 当前端口,
        async fetch(请求) {
          try {
            const 路径 = decodeURIComponent(new URL(请求.url).pathname).replace(/^\/+/, "") || "";
            // 静态资源路由（图集 / 游戏资源 / 项目测试资源）。
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
            const 别名 = 路径 === "资源验收" ? 资源验收别名 : 路径;
            if (!别名 || 别名 === "index.html" || 别名 === 资源验收别名) await 确保构建();
            const 文件 = 静态文件.get(别名 || "index.html") ?? 上次文件.get(别名);
            if (!文件) return new Response("Not Found", { status: 404 });
            return new Response(文件, {
              headers: {
                "Content-Type": 文件.type,
                "Cache-Control": "no-store",
              },
            });
          } catch (错误) {
            console.error(错误);
            return new Response("配置或构建失败，请修正后刷新", { status: 500 });
          }
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
  console.log("项目测试资源路由：" + 测试资源目录);
}
