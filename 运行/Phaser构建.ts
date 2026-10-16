import { resolve } from "node:path";
import type { BunPlugin } from "bun";

export function 创建Phaser构建插件(): BunPlugin {
  return {
    name: "phaser-singleton",
    setup(builder) {
      const Phaser入口 = resolve(process.cwd(), "node_modules", "phaser", "dist", "phaser.esm.js");
      builder.onResolve({ filter: /^phaser$/ }, () => ({ path: Phaser入口 }));
    },
  };
}
