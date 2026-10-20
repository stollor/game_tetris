import { 创建Phaser构建插件 } from "./Phaser构建";
import { 读取服务地址 } from "./服务地址";

const 构建结果 = await Bun.build({
  entrypoints: ["./index.html"],
  target: "browser",
  plugins: [创建Phaser构建插件()],
});

if (!构建结果.success) {
  for (const 日志 of 构建结果.logs) console.error(日志);
  process.exitCode = 1;
} else {
  const 静态文件 = new Map(
    构建结果.outputs.map((文件) => [文件.path.split(/[\\/]/).at(-1)!, 文件]),
  );

  const { 主机名, 端口: 首选端口 } = 读取服务地址(Bun.argv.slice(2));
  let 当前端口 = 首选端口;
  let 服务器: ReturnType<typeof Bun.serve> | undefined;

  while (!服务器) {
    try {
      服务器 = Bun.serve({
        hostname: 主机名,
        port: 当前端口,
        fetch(请求) {
          const 路径 =
            decodeURIComponent(new URL(请求.url).pathname).replace(/^\/+/, "") || "index.html";
          const 文件 = 静态文件.get(路径);
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

  console.log("游戏已构建并启动：" + 服务器.url);
}
