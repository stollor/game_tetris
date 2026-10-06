import Phaser from "phaser";
import { 界面按钮 } from "./按钮";

/** 可复用的游戏暂停面板，游戏规则由调用方的回调负责。 */
export class 界面暂停菜单 extends Phaser.GameObjects.Container {
  constructor(scene: Phaser.Scene, 回调: { 继续: () => void; 重开: () => void; 返回: () => void }) {
    super(scene, scene.scale.width / 2, scene.scale.height / 2);
    this.setDepth(30).setVisible(false);
    const 遮罩 = scene.add
      .rectangle(0, 0, scene.scale.width, scene.scale.height, 0x050811, 0.78)
      .setScrollFactor(0)
      .setInteractive()
      .on(
        "pointerdown",
        (
          _pointer: Phaser.Input.Pointer,
          _x: number,
          _y: number,
          事件: Phaser.Types.Input.EventData,
        ) => 事件.stopPropagation(),
      );
    const 卡片 = scene.add
      .rectangle(0, 0, 470, 300, 0x151e31, 0.99)
      .setStrokeStyle(1, 0x536987, 0.95);
    const 标题 = scene.add
      .text(0, -92, "稍作休息", { fontSize: "29px", fontStyle: "bold", color: "#F3F6FC" })
      .setOrigin(0.5);
    const 说明 = scene.add
      .text(0, -50, "当前进度已为你保留", { fontSize: "14px", color: "#9BAAC1" })
      .setOrigin(0.5);
    const 样式 = { 面板色: "#1B2942", 强调色: "#65E6DC", 文字色: "#F3F6FC" };
    const 继续 = new 界面按钮(scene, 0, -4, {
      宽: 300,
      高: 50,
      文案: "继续游戏",
      name: "game.pause.resume",
      ...样式,
      点击: 回调.继续,
      已选: true,
      字号: "16px",
    });
    const 重开 = new 界面按钮(scene, -80, 66, {
      宽: 140,
      高: 44,
      文案: "重新开始",
      name: "game.pause.restart",
      ...样式,
      点击: 回调.重开,
      字号: "13px",
    });
    const 返回 = new 界面按钮(scene, 80, 66, {
      宽: 140,
      高: 44,
      文案: "返回首页",
      name: "game.pause.home",
      ...样式,
      点击: 回调.返回,
      字号: "13px",
    });
    this.add([遮罩, 卡片, 标题, 说明, 继续, 重开, 返回]);
    scene.add.existing(this);
  }

  布局(宽: number, 高: number): void {
    this.setPosition(宽 / 2, 高 / 2);
    const 遮罩 = this.getAt(0) as Phaser.GameObjects.Rectangle;
    遮罩.setSize(宽, 高);
  }
}
