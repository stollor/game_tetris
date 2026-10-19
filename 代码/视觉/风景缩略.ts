import type Phaser from "phaser";
import { 获取画布像素比 } from "../../框架/界面/画布像素比";
import { 引用纹理, 获取纹理预算 } from "../性能/纹理缓存";
import type { 背景主题 } from "../配置/再消一行设置";
import { 绘制霓虹背景 } from "./霓虹背景";

/**
 * 静态风景缩略图烘焙成纹理：只在首次需要时用矢量绘制一次，之后以 Image 显示。
 * 避免每帧重新细分上千条矢量命令，也省掉逐卡裁剪遮罩。纹理按地点、尺寸和画布像素比缓存。
 */
export function 获取风景缩略(
  场景: Phaser.Scene,
  主题: 背景主题,
  宽: number,
  高: number,
  静态主体 = true,
): string | null {
  // 镜头缩放已含画布像素比与大屏放大，按它烘焙才不会发糊。
  const 比 = Math.max(1, 场景.cameras?.main?.zoom || 获取画布像素比());
  const w = Math.max(1, Math.round(宽)),
    h = Math.max(1, Math.round(高));
  const 键 = `风景缩略.${主题}.${静态主体 ? 1 : 0}.${w}x${h}@${比}`;
  if (场景.textures.exists(键)) return 键;
  const 像素宽 = Math.ceil(w * 比),
    像素高 = Math.ceil(h * 比);
  const 预算 = 获取纹理预算(场景);
  if (!预算.腾出空间(像素宽 * 像素高)) return null;
  const 纹理 = 场景.textures.addDynamicTexture(键, 像素宽, 像素高);
  if (!纹理) return null;
  预算.登记(键, 像素宽 * 像素高, () => {
    if (场景.textures.exists(键)) 场景.textures.remove(键);
  });
  const 图 = 场景.make.graphics({}, false);
  绘制霓虹背景(图, w, h, 主题, 静态主体);
  const 包 = 场景.make.container({ x: 0, y: 0 }, false).setScale(比);
  包.add(图);
  纹理.draw(包, 0, 0);
  纹理.render();
  包.destroy(true);
  return 键;
}

/** 在容器内放一张烘焙好的风景缩略图（左上角对齐）。 */
export function 添加风景缩略(
  场景: Phaser.Scene,
  根: Phaser.GameObjects.Container,
  x: number,
  y: number,
  宽: number,
  高: number,
  主题: 背景主题,
): Phaser.GameObjects.Image | Phaser.GameObjects.Graphics {
  const 键 = 获取风景缩略(场景, 主题, 宽, 高);
  if (!键) {
    const 图 = 场景.add.graphics({ x, y });
    绘制霓虹背景(图, 宽, 高, 主题, true);
    根.add(图);
    return 图;
  }
  const 图 = 场景.add.image(x, y, 键).setOrigin(0).setDisplaySize(宽, 高);
  根.add(图);
  引用纹理(场景, 图);
  return 图;
}

function 引用底图(场景: Phaser.Scene, 图: Phaser.GameObjects.Image, 键: string): void {
  const 预算 = 获取纹理预算(场景);
  const 释放 = 预算.引用(键);
  图.once("destroy", () => {
    释放();
    // 整屏纹理无人使用立即释放，缩略图则留待 LRU 淘汰。
    预算.移除(键);
  });
}

/** 整屏底图：烘焙成纹理后用一张 Image 显示；尺寸/主题变化时换新纹理并释放旧的。 */
export function 布置烘焙底图(
  场景: Phaser.Scene,
  旧图: Phaser.GameObjects.Image | Phaser.GameObjects.Graphics | undefined,
  宽: number,
  高: number,
  主题: 背景主题,
  静态主体: boolean,
): Phaser.GameObjects.Image | Phaser.GameObjects.Graphics {
  const 键 = 获取风景缩略(场景, 主题, 宽, 高, 静态主体);
  if (!键) {
    const 图 = 场景.add.graphics().setDepth(-2);
    绘制霓虹背景(图, 宽, 高, 主题, 静态主体);
    旧图?.destroy();
    return 图;
  }
  const 图 = 场景.add.image(0, 0, 键).setOrigin(0).setDisplaySize(宽, 高).setDepth(-2);
  引用底图(场景, 图, 键);
  // 先引用新纹理再销毁旧图，同尺寸重排时不会把同一张纹理释放后重烘。
  旧图?.destroy();
  return 图;
}
