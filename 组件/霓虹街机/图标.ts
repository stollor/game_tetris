import type Phaser from "phaser";

export type 旅行图标名称 = "关闭" | "方块币" | "风景" | "设置" | "成就" | "商店";

/** 图标作为真实纹理交给框架按钮，命中与交互仍使用通用按钮。 */
export function 获取旅行图标(场景: Phaser.Scene, 名称: 旅行图标名称): string {
  const 键 = `旅行图标.${名称}`;
  if (场景.textures.exists(键)) return 键;
  const g = 场景.make.graphics({}, false);
  if (名称 === "关闭")
    g.lineStyle(2.5, 0xffffff).lineBetween(7, 7, 25, 25).lineBetween(25, 7, 7, 25);
  if (名称 === "方块币") {
    for (const [列, 行] of [
      [0, 0],
      [1, 0],
      [0, 1],
      [1, 1],
    ]) {
      const x = 3 + 列 * 14,
        y = 3 + 行 * 14;
      g.fillStyle(0xf4c66c).fillRoundedRect(x, y, 12, 12, 2);
      g.lineStyle(1, 0x80531f).strokeRoundedRect(x, y, 12, 12, 2);
      g.fillStyle(0xfff3bf).fillRect(x + 2, y + 2, 8, 2);
    }
  }
  if (名称 === "风景")
    g.lineStyle(2, 0xffffff)
      .strokeRoundedRect(3, 5, 26, 22, 4)
      .strokeTriangle(5, 24, 13, 13, 20, 24)
      .strokeTriangle(15, 24, 22, 16, 28, 24)
      .strokeCircle(23, 11, 2);
  if (名称 === "设置") {
    g.lineStyle(2.2, 0xffffff).strokeCircle(16, 16, 6);
    for (let i = 0; i < 6; i++) {
      const 角 = (i * Math.PI) / 3;
      g.lineBetween(
        16 + Math.cos(角) * 8.5,
        16 + Math.sin(角) * 8.5,
        16 + Math.cos(角) * 13.5,
        16 + Math.sin(角) * 13.5,
      );
    }
  }
  if (名称 === "成就") {
    g.lineStyle(2.2, 0xffe7a8);
    const 星 = [
      16, 4, 19.4, 12.2, 28, 12.6, 21.4, 18.2, 23.6, 26.5, 16, 22, 8.4, 26.5, 10.6, 18.2, 4, 12.6,
      12.6, 12.2,
    ];
    g.beginPath();
    g.moveTo(星[0], 星[1]);
    for (let i = 2; i < 星.length; i += 2) g.lineTo(星[i], 星[i + 1]);
    g.closePath();
    g.strokePath();
  }
  if (名称 === "商店") {
    g.lineStyle(2.2, 0xffffff).strokeRoundedRect(8, 13, 16, 14, 3);
    g.beginPath();
    g.moveTo(12, 13);
    g.lineTo(12, 10);
    g.arc(16, 10, 4, Math.PI, 0, false);
    g.lineTo(20, 13);
    g.strokePath();
  }
  g.generateTexture(键, 32, 32);
  g.destroy();
  return 键;
}
