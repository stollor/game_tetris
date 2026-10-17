import type Phaser from "phaser";
import { 获取画布像素比 } from "../../框架/界面/画布像素比";
import type { 背景主题 } from "../配置/俄罗斯方块设置";
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
): string {
  // 镜头缩放已含画布像素比与大屏放大，按它烘焙才不会发糊。
  const 比 = Math.max(1, 场景.cameras?.main?.zoom || 获取画布像素比());
  const w = Math.max(1, Math.round(宽)),
    h = Math.max(1, Math.round(高));
  const 键 = `风景缩略.${主题}.${静态主体 ? 1 : 0}.${w}x${h}@${比}`;
  if (场景.textures.exists(键)) return 键;
  const 纹理 = 场景.textures.addDynamicTexture(键, Math.ceil(w * 比), Math.ceil(h * 比));
  if (!纹理) return 键;
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
): Phaser.GameObjects.Image {
  const 图 = 场景.add
    .image(x, y, 获取风景缩略(场景, 主题, 宽, 高))
    .setOrigin(0)
    .setDisplaySize(宽, 高);
  根.add(图);
  return 图;
}

const 底图引用 = new Map<string, number>();

function 引用底图(场景: Phaser.Scene, 图: Phaser.GameObjects.Image, 键: string): void {
  底图引用.set(键, (底图引用.get(键) ?? 0) + 1);
  图.once("destroy", () => 释放底图(场景, 键));
}

/** 整屏纹理较大（高 DPR 下约 10MB），无人使用就立刻释放，避免纯享切换风景时堆积。 */
function 释放底图(场景: Phaser.Scene, 键: string): void {
  const 剩余 = (底图引用.get(键) ?? 1) - 1;
  if (剩余 > 0) {
    底图引用.set(键, 剩余);
    return;
  }
  底图引用.delete(键);
  if (场景.sys?.textures?.exists(键)) 场景.sys.textures.remove(键);
}

/** 整屏底图：烘焙成纹理后用一张 Image 显示；尺寸/主题变化时换新纹理并释放旧的。 */
export function 布置烘焙底图(
  场景: Phaser.Scene,
  旧图: Phaser.GameObjects.Image | undefined,
  宽: number,
  高: number,
  主题: 背景主题,
  静态主体: boolean,
): Phaser.GameObjects.Image {
  const 键 = 获取风景缩略(场景, 主题, 宽, 高, 静态主体);
  const 图 = 场景.add.image(0, 0, 键).setOrigin(0).setDisplaySize(宽, 高).setDepth(-2);
  引用底图(场景, 图, 键);
  // 先引用新纹理再销毁旧图，同尺寸重排时不会把同一张纹理释放后重烘。
  旧图?.destroy();
  return 图;
}
