import Phaser from "phaser";
import { 创建复用池 } from "../../框架/复用/复用池";
import { 获取烘焙贴图 } from "../性能/图形烘焙";
import { 获取纹理预算 } from "../性能/纹理缓存";

const 释放表 = new WeakMap<Phaser.GameObjects.Image, () => void>();
const 键表 = new WeakMap<Phaser.GameObjects.Image, string>();
const 帧表 = new WeakMap<Phaser.GameObjects.Image, string | undefined>();

function 解除纹理(图: Phaser.GameObjects.Image): void {
  const 释放 = 释放表.get(图);
  if (!释放 && !键表.has(图)) return;
  // 只放开引用。烘焙结果是共用的，不能因为这张图换了造型就把位图删掉。
  释放?.();
  释放表.delete(图);
  键表.delete(图);
  帧表.delete(图);
}

function 绑定纹理(图: Phaser.GameObjects.Image, 键: string, 帧?: string): void {
  if (键表.get(图) === 键 && 帧表.get(图) === 帧) return;
  解除纹理(图);
  图.setTexture(键, 帧 ?? "__BASE");
  const 释放 = 获取纹理预算(图.scene).引用(键);
  释放表.set(图, 释放);
  键表.set(图, 键);
  帧表.set(图, 帧);
}

export interface 图像池 {
  开始(): void;
  /** 同键的烘焙结果会复用。失败时调用方应改回矢量绘制。 */
  放置(
    键: string,
    绘制: (图: Phaser.GameObjects.Graphics) => void,
    x: number,
    y: number,
    调整?: (图: Phaser.GameObjects.Image) => void,
  ): boolean;
  结束(): void;
  取消(): void;
  图像(): readonly Phaser.GameObjects.Image[];
  销毁(): void;
}

/** 把同一造型的烘焙贴图贴到复用的 Image 上。一轮开始到结束之间，多出来的实例归还进池。 */
export function 创建图像池(
  场景: Phaser.Scene,
  父: Phaser.GameObjects.Container,
  选项?: { 混合?: Phaser.BlendModes; 低于?: Phaser.GameObjects.GameObject; 空闲上限?: number },
): 图像池 {
  const 现用: Phaser.GameObjects.Image[] = [];
  let 游标 = 0;
  const 池 = 创建复用池({
    创建: () => {
      const 图 = new Phaser.GameObjects.Image(场景, 0, 0, "__DEFAULT").setVisible(false);
      if (选项?.混合 !== undefined) 图.setBlendMode(选项.混合);
      图.once("destroy", () => 解除纹理(图));
      return 图;
    },
    重置: (图) => {
      图.setVisible(false).setAlpha(1).setAngle(0).clearTint();
      if (图.parentContainer === 父) 父.remove(图);
      return 图.scene !== undefined && 图.active;
    },
    销毁: (图) => {
      if (图.scene) 图.destroy();
      else 解除纹理(图);
    },
    空闲上限: 选项?.空闲上限 ?? 32,
  });

  return {
    开始() {
      游标 = 0;
    },
    放置(键, 绘制, x, y, 调整) {
      const 贴 = 获取烘焙贴图(场景, 键, 绘制);
      if (!贴) return false;
      let 图 = 现用[游标];
      if (!图) {
        图 = 池.借出();
        现用.push(图);
      }
      游标 += 1;
      if (图.parentContainer !== 父) {
        父.add(图);
        if (选项?.低于) 父.moveBelow(图, 选项.低于);
      }
      绑定纹理(图, 贴.键, 贴.帧);
      图
        .setOrigin(
          (-贴.左 * 贴.比) / Math.max(1, 图.width),
          (-贴.顶 * 贴.比) / Math.max(1, 图.height),
        )
        .setScale(1 / 贴.比)
        .setPosition(x, y)
        .setVisible(true)
        .setAlpha(1)
        .setAngle(0)
        .clearTint();
      调整?.(图);
      return true;
    },
    结束() {
      while (现用.length > 游标) {
        const 图 = 现用.pop();
        if (图) 池.归还(图);
      }
    },
    取消() {
      游标 = 0;
      this.结束();
    },
    图像: () => 现用,
    销毁() {
      for (const 图 of 现用) 池.归还(图);
      现用.length = 0;
      游标 = 0;
      池.清空();
    },
  };
}
