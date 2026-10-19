const 禁用列表 = new Set(
  typeof location !== "undefined" && ["localhost", "127.0.0.1", "[::1]"].includes(location.hostname)
    ? new URLSearchParams(location.search).get("gm-disable")?.split(",")
    : [],
);
/** 仅隔离测试地址生效，不写设置或存档；每帧只查集合。 */
export function 禁用性能项(名称: string): boolean {
  return 禁用列表.has(名称);
}
