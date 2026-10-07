import Phaser from "phaser";
import { 获取文案, 解析语言 } from "../../多语言";
import { 获取游戏设置 } from "../../设置";
import { 界面布局 } from "./布局";
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
  private readonly 遮罩: Phaser.GameObjects.Rectangle;
  private readonly 卡片: Phaser.GameObjects.Graphics;
  private readonly 标题: Phaser.GameObjects.Text;
  private readonly 说明: Phaser.GameObjects.Text;
  private readonly 操作布局: 界面布局;
  private readonly 外观: 暂停菜单外观;

  constructor(
    scene: Phaser.Scene,
    回调: { 继续: () => void; 重开: () => void; 返回: () => void; 设置: () => void },
    外观: 暂停菜单外观 = Phaser预制体配置.暂停菜单,
  ) {
    super(scene, scene.scale.width / 2, scene.scale.height / 2);
    this.外观 = 外观;
    this.setDepth(30).setVisible(false);
    this.遮罩 = scene.add
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
    this.卡片 = scene.add.graphics();
    this.标题 = scene.add
      .text(0, -92, "稍作休息", { fontSize: "29px", fontStyle: "bold", color: 外观.标题色 })
      .setOrigin(0.5);
    this.说明 = scene.add
      .text(0, -50, "当前进度已为你保留", { fontSize: "14px", color: 外观.说明色 })
      .setOrigin(0.5);
    const 样式 = {
      面板色: 外观.按钮面板色,
      强调色: 外观.强调色,
      文字色: 外观.按钮文字色,
    };
    const 设置文案 = 获取文案(解析语言(获取游戏设置().语言)).设置;
    const 按钮宽 = 350;
    const 继续 = new 界面按钮(scene, 0, 0, {
      宽: 按钮宽,
      高: 50,
      文案: "继续游戏",
      name: "game.pause.resume",
      ...样式,
      点击: 回调.继续,
      已选: true,
      字号: "16px",
    });
    const 重开 = new 界面按钮(scene, 0, 0, {
      宽: 按钮宽,
      高: 44,
      文案: "重新开始",
      name: "game.pause.restart",
      ...样式,
      点击: 回调.重开,
      字号: "13px",
    });
    const 设置 = new 界面按钮(scene, 0, 0, {
      宽: 按钮宽,
      高: 44,
      文案: 设置文案,
      name: "game.pause.settings",
      ...样式,
      点击: 回调.设置,
      字号: "13px",
    });
    const 返回 = new 界面按钮(scene, 0, 0, {
      宽: 按钮宽,
      高: 44,
      文案: "返回首页",
      name: "game.pause.home",
      ...样式,
      点击: 回调.返回,
      字号: "13px",
    });
    this.操作布局 = new 界面布局(scene, 0, 0, {
      方向: "垂直",
      宽: 按钮宽,
      高: 0,
      间距: 12,
      主轴对齐: "居中",
      交叉轴对齐: "拉伸",
      自动主轴尺寸: true,
    });
    this.操作布局.添加(继续, { 宽: 按钮宽, 高: 50 });
    this.操作布局.添加(重开, { 宽: 按钮宽, 高: 44 });
    this.操作布局.添加(设置, { 宽: 按钮宽, 高: 44 });
    this.操作布局.添加(返回, { 宽: 按钮宽, 高: 44 });
    this.add([this.遮罩, this.卡片, this.标题, this.说明, this.操作布局]);
    scene.add.existing(this);
    this.布局(scene.scale.width, scene.scale.height);
  }

  布局(宽: number, 高: number): void {
    this.setPosition(宽 / 2, 高 / 2);
    this.遮罩.setSize(宽, 高);
    const 面板宽 = Math.min(470, 宽 - 32);
    const 面板高 = Math.min(410, 高 - 32);
    const 顶 = -面板高 / 2;
    this.卡片.clear();
    绘制玻璃面板(this.卡片, -面板宽 / 2, 顶, 面板宽, 面板高, {
      圆角: 24,
      填色: this.颜色值(this.外观.面板色),
      透明度: 0.98,
      边色: this.颜色值(this.外观.边框色),
      边透明度: 0.9,
      强调色: this.颜色值(this.外观.强调色),
      高光: true,
    });
    this.卡片
      .fillStyle(this.颜色值(this.外观.强调色), 0.85)
      .fillRoundedRect(-60, 顶 + 2, 120, 4, 2);
    this.标题.setPosition(0, 顶 + 54);
    this.说明.setPosition(0, 顶 + 96);
    const 操作宽 = Math.min(350, 面板宽 - 56);
    const 操作高 = this.操作布局.height;
    const 操作中心Y = Math.min(46, 面板高 / 2 - 操作高 / 2 - 22);
    this.操作布局.设置布局尺寸(操作宽, 操作高).setPosition(0, 操作中心Y);
  }

  private 颜色值(颜色: string): number {
    return Number.parseInt(颜色.replace("#", ""), 16);
  }
}
