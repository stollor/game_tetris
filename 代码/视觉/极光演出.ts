import Phaser from "phaser";
import {
  引用烘焙贴图,
  type 替身项,
  获取替身贴图,
  获取烘焙贴图,
  设置替身贴图,
} from "../性能/图形烘焙";

const 极光色 = [0x3ff0c0, 0x4de3d8, 0x7ad9ff];
const 签名表 = new WeakMap<Phaser.GameObjects.Graphics, string>();

/** 帘幕形状只生成一次；Canvas回退仍可按原时间重画。 */
export function 绘制极光帘幕(
  g: Phaser.GameObjects.Graphics,
  宽: number,
  高: number,
  时间: number,
  条: number,
): void {
  const 色 = 极光色[条] ?? 0x4de3d8;
  const 基Y = 高 * (0.12 + 条 * 0.05);
  for (let 遍 = 0; 遍 < 2; 遍++) {
    const 步长 = Math.max(10, 宽 / (44 + 遍 * 28));
    const 偏移 = 遍 === 1 ? 步长 * 0.5 : 0;
    for (let x = -步长; x < 宽 + 步长; x += 步长) {
      const nx = x / 宽;
      const 顶 =
        基Y +
        Math.sin(nx * 5.2 + 条 * 1.9 + 时间 * 0.00022) * 高 * 0.05 +
        Math.sin(nx * 11 + 时间 * 0.00035) * 高 * 0.02;
      const 帘高 = 高 * (0.12 + 0.07 * Math.sin(nx * 6.5 + 条 * 2.2 + 时间 * 0.0003));
      const 淡 = (遍 === 0 ? 0.052 : 0.03) * (0.8 + 0.2 * Math.sin(nx * 4.2 + 时间 * 0.0005 + 条));
      g.fillGradientStyle(色, 色, 色, 色, 淡, 淡, 0, 0).fillRect(x + 偏移, 顶, 步长 + 1, 帘高);
    }
  }
}

export function 移动极光替身(
  g: Phaser.GameObjects.Graphics,
  宽: number,
  高: number,
  时间: number,
): boolean {
  const 场景 = g.scene;
  if (!场景 || 场景.game.renderer.type !== Phaser.WEBGL) return false;
  const 签名 = `${宽}x${高}@${场景.cameras.main.zoom}`;
  let 列表 = 获取替身贴图(g);
  if (!列表 || 列表.length !== 3 || 签名表.get(g) !== 签名) {
    设置替身贴图(g, undefined);
    const 新列表: 替身项[] = [];
    for (let i = 0; i < 3; i++) {
      const 贴 = 获取烘焙贴图(场景, `极光帘幕.${宽}x${高}.${i}`, (图) =>
        绘制极光帘幕(图, 宽, 高, 0, i),
      );
      if (!贴) {
        for (const 项 of 新列表) 项.贴图.destroy();
        return false;
      }
      const 图 = new Phaser.GameObjects.Image(场景, 0, 0, 贴.键, 贴.帧);
      引用烘焙贴图(图);
      图.setOrigin((-贴.左 * 贴.比) / 图.width, (-贴.顶 * 贴.比) / 图.height).setScale(1 / 贴.比);
      图.setName(`scenery.aurora.curtain.${i}`);
      新列表.push({ 贴图: 图, x: 0, y: 0, 透明度: 1 });
    }
    设置替身贴图(g, 新列表);
    签名表.set(g, 签名);
    列表 = 新列表;
  }
  // 星点和萤火已经画在静态底图里。这里只留三条帘幕，避免每帧再提交几十张光点。
  for (let i = 0; i < 3; i++) {
    const 项 = 列表[i];
    if (!项) continue;
    项.x = Math.sin(时间 * 0.00018 + i) * 宽 * 0.012;
    项.y = Math.sin(时间 * 0.00022 + i * 1.9) * 高 * 0.012;
    项.透明度 = 0.84 + Math.sin(时间 * 0.0003 + i * 2.2) * 0.16;
  }
  return true;
}
