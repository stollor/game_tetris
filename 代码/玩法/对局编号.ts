interface 编号来源 {
  randomUUID?: () => string;
  getRandomValues?: (数组: Uint8Array) => Uint8Array;
}

/** 局域网 HTTP 不是安全上下文，浏览器不提供 crypto.randomUUID。 */
export function 新对局编号(来源: 编号来源 = crypto): string {
  if (typeof 来源.randomUUID === "function") return 来源.randomUUID();
  const 字节 = new Uint8Array(16);
  if (typeof 来源.getRandomValues === "function") 来源.getRandomValues(字节);
  else {
    for (let 下标 = 0; 下标 < 字节.length; 下标++) 字节[下标] = Math.floor(Math.random() * 256);
  }
  字节[6] = ((字节[6] ?? 0) & 0x0f) | 0x40;
  字节[8] = ((字节[8] ?? 0) & 0x3f) | 0x80;
  const 十六进制 = Array.from(字节, (值) => 值.toString(16).padStart(2, "0")).join("");
  return `${十六进制.slice(0, 8)}-${十六进制.slice(8, 12)}-${十六进制.slice(12, 16)}-${十六进制.slice(16, 20)}-${十六进制.slice(20)}`;
}
