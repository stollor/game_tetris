import { 创建Phaser构建插件 } from "./Phaser构建";

function 读取服务地址(参数: string[]): { 主机名: string; 端口: number } {
  let 主机名 = "0.0.0.0";
  let 端口 = Number(process.env.PORT ?? 3000);

  for (let 序号 = 0; 序号 < 参数.length; 序号++) {
    const 参数项 = 参数[序号];
    const 主机参数 =
      参数项 === "--host"
        ? 参数[++序号]
        : 参数项.startsWith("--host=")
          ? 参数项.slice(7)
          : undefined;
    if (主机参数 !== undefined) {
      const IPv6 = 主机参数.match(/^\[([^\]]+)\](?::(\d+))?$/);
      if (IPv6) {
        主机名 = IPv6[1]!;
        if (IPv6[2]) 端口 = Number(IPv6[2]);
        continue;
      }

      const 主机端口 = 主机参数.match(/^(.*):(\d+)$/);
      if (主机端口) {
        主机名 = 主机端口[1] || "0.0.0.0";
        端口 = Number(主机端口[2]);
      } else if (主机参数) {
        主机名 = 主机参数;
      }
      continue;
    }

    const 端口参数 =
      参数项 === "--port"
        ? 参数[++序号]
        : 参数项.startsWith("--port=")
          ? 参数项.slice(7)
          : undefined;
    if (端口参数 !== undefined) 端口 = Number(端口参数);
  }

  if (!Number.isInteger(端口) || 端口 < 0 || 端口 > 65535) {
    throw new Error("开发服务器端口无效：" + 端口);
  }
  return { 主机名, 端口 };
}

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
