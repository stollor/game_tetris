import Phaser from "phaser";
import { 界面按钮 } from "../../框架/界面/按钮";
import { 界面滑块 } from "../../框架/界面/滑块";
import { 绘制玻璃面板 } from "../../框架/界面/玻璃绘制";
import { 注册模态界面 } from "../../框架/界面/输入隔离";
import { 获取旅行图标 } from "../../组件/霓虹街机/图标";
import { 获取文案, 解析语言 } from "../配置/再消一行文案";
import { 更新游戏设置, 获取游戏设置 } from "../配置/再消一行设置";
import { 暂停外观 } from "../配置/界面主题";

/** 暂停期间可调整的对局内显示选项。 */
export class 界面对局设置菜单 extends Phaser.GameObjects.Container {
  private readonly 回调: { 返回: () => void; 预览落点影: (透明度: number) => void };
  private 面板宽 = 480;
  private readonly 关闭按钮: 界面按钮;
  private readonly 遮罩: Phaser.GameObjects.Rectangle;
  private readonly 卡片: Phaser.GameObjects.Graphics;
  private readonly 标题: Phaser.GameObjects.Text;
  private readonly 透明度标签: Phaser.GameObjects.Text;
  private readonly 透明度数值: Phaser.GameObjects.Text;
  private readonly 透明度滑块: 界面滑块;
  private readonly 网格标签: Phaser.GameObjects.Text;
  private readonly 按键说明标签: Phaser.GameObjects.Text;
  private readonly 网格开: 界面按钮;
  private readonly 网格关: 界面按钮;
  private readonly 按键说明开: 界面按钮;
  private readonly 按键说明关: 界面按钮;
  private readonly 返回按钮: 界面按钮;
  private readonly 上键标签: Phaser.GameObjects.Text;
  private readonly 上键选项: 界面按钮[] = [];
  private readonly 外观 = 暂停外观();

  constructor(
    scene: Phaser.Scene,
    回调: { 返回: () => void; 预览落点影: (透明度: number) => void },
  ) {
    super(scene, scene.scale.width / 2, scene.scale.height / 2);
    this.回调 = 回调;
    this.setDepth(40).setVisible(false);
    const 文案 = this.获取文案();
    this.遮罩 = scene.add
      .rectangle(
        0,
        0,
        scene.scale.width,
        scene.scale.height,
        this.颜色值(this.外观.遮罩色),
        this.外观.遮罩透明度,
      )
      .setInteractive()
      .on(
        "pointerdown",
        (
          指针: Phaser.Input.Pointer,
          _x: number,
          _y: number,
          事件: Phaser.Types.Input.EventData,
        ) => {
          事件.stopPropagation();
          const 点 = this.getWorldTransformMatrix().applyInverse(指针.worldX, 指针.worldY);
          if (Math.abs(点.x) > this.面板宽 / 2 || Math.abs(点.y) > 215) this.回调.返回();
        },
      );
    this.卡片 = scene.add.graphics();
    this.标题 = scene.add
      .text(0, 0, 文案.对局设置, {
        fontSize: "24px",
        fontStyle: "bold",
        color: this.外观.标题色,
      })
      .setOrigin(0.5);
    const 英文 = 解析语言(获取游戏设置().语言) !== "简体中文";
    this.上键标签 = scene.add
      .text(0, 0, 英文 ? "Touch ↑ rotation" : "手机 ↑ 旋转方向", {
        fontSize: "14px",
        color: this.外观.说明色,
      })
      .setOrigin(0, 0.5);
    for (const [i, 值] of (["左转", "右转", "180度"] as const).entries()) {
      this.上键选项.push(
        this.创建开关(
          scene,
          `game.settings.touch-up.${值}`,
          英文 ? (["LEFT", "RIGHT", "180°"][i] ?? "") : 值 === "180度" ? "180°" : 值,
          () => {
            更新游戏设置({ 手机上键旋转: 值 });
            this.刷新选项();
          },
        ),
      );
    }
    this.透明度标签 = scene.add
      .text(0, 0, 文案.落点影透明度, { fontSize: "14px", color: this.外观.说明色 })
      .setOrigin(0, 0.5);
    this.透明度数值 = scene.add
      .text(0, 0, "100%", { fontSize: "14px", color: this.外观.标题色 })
      .setOrigin(1, 0.5);
    this.透明度滑块 = new 界面滑块(scene, 0, 0, {
      宽: 280,
      值: 获取游戏设置().落点影透明度,
      步进: 5,
      name: "game.settings.ghost-opacity",
      轨道色: this.外观.按钮面板色,
      强调色: this.外观.强调色,
      变化: (透明度) => 更新游戏设置({ 落点影透明度: 透明度 }),
    });
    this.透明度滑块.on("change", (透明度: number) => {
      this.透明度数值.setText(`${Math.round(透明度)}%`);
      this.回调.预览落点影(透明度);
    });
    this.网格标签 = scene.add
      .text(0, 0, 文案.显示网格, { fontSize: "14px", color: this.外观.说明色 })
      .setOrigin(0, 0.5);
    this.按键说明标签 = scene.add
      .text(0, 0, 文案.显示按键说明, { fontSize: "14px", color: this.外观.说明色 })
      .setOrigin(0, 0.5);
    this.网格开 = this.创建开关(scene, "game.settings.grid.on", 文案.开, () =>
      this.更新开关({ 显示网格: true }),
    );
    this.网格关 = this.创建开关(scene, "game.settings.grid.off", 文案.关, () =>
      this.更新开关({ 显示网格: false }),
    );
    this.按键说明开 = this.创建开关(scene, "game.settings.key-guide.on", 文案.开, () =>
      this.更新开关({ 显示按键说明: true }),
    );
    this.按键说明关 = this.创建开关(scene, "game.settings.key-guide.off", 文案.关, () =>
      this.更新开关({ 显示按键说明: false }),
    );
    this.返回按钮 = new 界面按钮(scene, 0, 0, {
      宽: 210,
      高: 42,
      文案: 文案.返回暂停菜单,
      name: "game.settings.back",
      面板色: this.外观.按钮面板色,
      强调色: this.外观.强调色,
      文字色: this.外观.按钮文字色,
      点击: 回调.返回,
      字号: "14px",
    });
    this.add([
      this.遮罩,
      this.卡片,
      this.标题,
      this.透明度标签,
      this.透明度数值,
      this.透明度滑块,
      this.网格标签,
      this.网格开,
      this.网格关,
      this.按键说明标签,
      this.按键说明开,
      this.按键说明关,
      this.返回按钮,
      this.上键标签,
      ...this.上键选项,
    ]);
    注册模态界面(this, this.遮罩);
    scene.add.existing(this);
    this.关闭按钮 = new 界面按钮(scene, 0, 0, {
      宽: 32,
      高: 32,
      文案: "",
      name: "game.settings.close",
      图标: 获取旅行图标(scene, "关闭"),
      图标尺寸: 18,
      文字色: this.外观.按钮文字色,
      面板色: this.外观.面板色,
      强调色: this.外观.强调色,
      点击: () => this.回调.返回(),
    });
    this.add(this.关闭按钮);
    this.刷新选项();
    this.布局(scene.scale.width, scene.scale.height);
  }

  打开(): void {
    this.刷新选项();
    this.回调.预览落点影(获取游戏设置().落点影透明度);
    this.setVisible(true);
  }

  布局(宽: number, 高: number): void {
    this.setPosition(宽 / 2, 高 / 2);
    const 比例 = Math.min(1, (高 - 24) / 430);
    this.setScale(比例);
    this.遮罩.setSize(宽 / 比例, 高 / 比例);
    this.卡片.clear();
    const 面板宽 = Math.min(480, 宽 / 比例 - 28);
    const 面板高 = 430;
    this.面板宽 = 面板宽;
    this.关闭按钮.setPosition(面板宽 / 2 - 26, -面板高 / 2 + 27);
    绘制玻璃面板(this.卡片, -面板宽 / 2, -面板高 / 2, 面板宽, 面板高, {
      圆角: 22,
      填色: this.颜色值(this.外观.面板色),
      透明度: 0.99,
      边色: this.颜色值(this.外观.边框色),
      边透明度: 0.92,
      强调色: this.颜色值(this.外观.强调色),
      高光: false,
    });
    const 左 = -面板宽 / 2 + 28;
    const 右 = 面板宽 / 2 - 28;
    this.标题.setPosition(0, -面板高 / 2 + 38);
    this.透明度标签.setPosition(左, -面板高 / 2 + 78);
    this.透明度数值.setPosition(右, -面板高 / 2 + 78);
    this.透明度滑块.设置布局尺寸(Math.max(120, 面板宽 - 64), 32).setPosition(0, -面板高 / 2 + 114);
    this.网格标签.setPosition(左, -面板高 / 2 + 166);
    this.网格开.setPosition(右 - 142, -面板高 / 2 + 166);
    this.网格关.setPosition(右 - 66, -面板高 / 2 + 166);
    this.按键说明标签.setPosition(左, -面板高 / 2 + 216);
    this.按键说明开.setPosition(右 - 142, -面板高 / 2 + 216);
    this.按键说明关.setPosition(右 - 66, -面板高 / 2 + 216);
    this.返回按钮.setPosition(0, 面板高 / 2 - 38);
    this.上键标签.setPosition(左, -面板高 / 2 + 266);
    this.上键选项.forEach((按钮, i) => {
      按钮.setPosition(-76 + i * 76, -面板高 / 2 + 300);
    });
  }

  private 创建开关(scene: Phaser.Scene, name: string, label: string, 点击: () => void): 界面按钮 {
    return new 界面按钮(scene, 0, 0, {
      宽: 68,
      高: 34,
      文案: label,
      name,
      面板色: this.外观.按钮面板色,
      强调色: this.外观.强调色,
      文字色: this.外观.按钮文字色,
      文字色跟随底色: true,
      采用传入配色: true,
      点击,
      字号: "13px",
    });
  }

  private 更新开关(变化: { 显示网格?: boolean; 显示按键说明?: boolean }): void {
    更新游戏设置(变化);
    this.刷新选项();
  }

  private 刷新选项(): void {
    const 设置 = 获取游戏设置();
    this.上键选项.forEach((按钮, i) => {
      按钮.setSelected(设置.手机上键旋转 === ["左转", "右转", "180度"][i]);
    });
    this.透明度滑块.setValue(设置.落点影透明度);
    this.透明度数值.setText(`${设置.落点影透明度}%`);
    this.网格开.setSelected(设置.显示网格);
    this.网格关.setSelected(!设置.显示网格);
    this.按键说明开.setSelected(设置.显示按键说明);
    this.按键说明关.setSelected(!设置.显示按键说明);
  }

  private 获取文案() {
    return 获取文案(解析语言(获取游戏设置().语言));
  }

  private 颜色值(颜色: string): number {
    return Number.parseInt(颜色.replace("#", ""), 16);
  }
}
