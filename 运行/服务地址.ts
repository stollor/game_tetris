/** 开发服务器参数：--host / --port 或 PORT 环境变量，默认 0.0.0.0:3000。 */
export function 读取服务地址(参数: string[]): { 主机名: string; 端口: number } {
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
