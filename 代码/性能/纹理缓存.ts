import type Phaser from "phaser";
import { 纹理预算 } from "../../框架/绘画/纹理预算";

const 缓存表 = new WeakMap<Phaser.Textures.TextureManager, 纹理预算>();
const 像素上限 = 24 * 1024 * 1024;
const 数量上限 = 160;

/** 观测只读取已有预算，不因采样创建缓存。 */
export function 读取纹理缓存统计(纹理表: Phaser.Textures.TextureManager) {
  const 预算 = 缓存表.get(纹理表);
  return 预算 ? { ...预算.获取统计(), 像素上限, 数量上限 } : null;
}

/** 只计算本游戏生成的纹理；源图片、文字与驱动额外开销不计入此像素预算。 */
export function 获取纹理预算(场景: Phaser.Scene): 纹理预算 {
  const 纹理表 = 场景.textures;
  let 预算 = 缓存表.get(纹理表);
  if (!预算) {
    预算 = new 纹理预算(像素上限, 数量上限);
    缓存表.set(纹理表, 预算);
    const 当前 = 预算;
    场景.game.events.once("destroy", () => {
      当前.清理();
      缓存表.delete(纹理表);
    });
  }
  return 预算;
}

export function 引用纹理(场景: Phaser.Scene, 图: Phaser.GameObjects.Image): void {
  const 释放 = 获取纹理预算(场景).引用(图.texture.key);
  图.once("destroy", 释放);
}
