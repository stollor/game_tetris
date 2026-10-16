import type Phaser from "phaser";
import { 界面滚动区域 } from "../../框架/界面/滚动区域";

/** 静态缩略图也使用框架裁剪，避免风景笔触越过卡片边界。 */
export function 创建风景裁剪(
  场景: Phaser.Scene,
  根: Phaser.GameObjects.Container,
  x: number,
  y: number,
  宽: number,
  高: number,
): Phaser.GameObjects.Graphics {
  const 区域 = new 界面滚动区域(场景, {
    左: x,
    上: y,
    宽,
    高,
    内容高: 高,
    显示滚动条: false,
  });
  区域.设置滚动可用(false);
  for (const 对象 of 区域.list) 对象.disableInteractive();
  根.add(区域);
  const 图 = 场景.add.graphics().setPosition(x, y);
  区域.内容容器.add(图);
  return 图;
}
