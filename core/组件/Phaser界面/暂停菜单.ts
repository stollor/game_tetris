import Phaser from "phaser";
import { 界面按钮 } from "./按钮";
import { 绘制玻璃面板 } from "./玻璃绘制";
import { Phaser预制体配置 } from "./预制体配置";

export interface 暂停菜单外观 {
  遮罩色: string;
  遮罩透明度: number;
  面板色: string;
  边框色: string;
  标题色: string;
  说明色: string;
  按钮面板色: string;
  强调色: string;
  按钮文字色: string;
}

/** 可复用的游戏暂停面板，游戏规则由调用方的回调负责。 */
export class 界面暂停菜单 extends Phaser.GameObjects.Container {
  constructor(
    scene: Phaser.Scene,
    回调: { 继续: () => void; 重开: () => void; 返回: () => void },
    外观: 暂停菜单外观 = Phaser预制体配置.暂停菜单,
  ) {
    super(scene, scene.scale.width / 2, scene.scale.height / 2);
    this.setDepth(30).setVisible(false);
    const 遮罩 = scene.add
      .rectangle(
        0,
        0,
        scene.scale.width,
        scene.scale.height,
        this.颜色值(外观.遮罩色),
        外观.遮罩透明度,
      )
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
    const 卡片 = scene.add.graphics();
    绘制玻璃面板(卡片, -235, -150, 470, 300, {
      圆角: 24,
      填色: this.颜色值(外观.面板色),
      透明度: 0.98,
      边色: this.颜色值(外观.边框色),
      边透明度: 0.9,
      强调色: this.颜色值(外观.强调色),
      高光: true,
    });
    // 顶部强调光条
    卡片.fillStyle(this.颜色值(外观.强调色), 0.85).fillRoundedRect(-60, -150 + 2, 120, 4, 2);
    const 标题 = scene.add
      .text(0, -92, "稍作休息", { fontSize: "29px", fontStyle: "bold", color: 外观.标题色 })
      .setOrigin(0.5);
    const 说明 = scene.add
      .text(0, -50, "当前进度已为你保留", { fontSize: "14px", color: 外观.说明色 })
      .setOrigin(0.5);
    const 样式 = {
      面板色: 外观.按钮面板色,
      强调色: 外观.强调色,
      文字色: 外观.按钮文字色,
    };
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

  private 颜色值(颜色: string): number {
    return Number.parseInt(颜色.replace("#", ""), 16);
  }
}
