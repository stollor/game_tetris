import Phaser from "phaser";
import {
  引用烘焙贴图,
  type 替身项,
  获取替身贴图,
  获取烘焙贴图,
  设置替身贴图,
} from "../性能/图形烘焙";
import { 绘制极光帘幕 as 共享绘制极光帘幕 } from "./背景配方/极光帘幕";

const 签名表 = new WeakMap<Phaser.GameObjects.Graphics, string>();

/** 帘幕形状只生成一次；Canvas回退仍可按原时间重画。 */
export function 绘制极光帘幕(
  g: Phaser.GameObjects.Graphics,
  宽: number,
  高: number,
  时间: number,
  条: number,
): void {
  共享绘制极光帘幕(g, 宽, 高, 时间, 条);
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
