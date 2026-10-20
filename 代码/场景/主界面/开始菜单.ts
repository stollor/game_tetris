import Phaser from "phaser";
import { 适配场景视口 } from "../../../框架/界面/响应式视口";
import type { 界面按钮 } from "../../../框架/界面/按钮";
import { 判定滑动方向, 绑定滑动手势 } from "../../../框架/界面/控件";
import { 应用文字清晰度 } from "../../../框架/界面/文字清晰度";
import { 解锁程序音频 } from "../../../框架/音频/音频";
import { 打开覆盖页面 } from "../../../框架/页面切换";
import {
  type 主界面布局,
  生成主界面文字项,
  计算主界面布局,
} from "../../../组件/霓虹街机/主界面布局";
import { 获取旅行图标 } from "../../../组件/霓虹街机/图标";
import { 添加霓虹文字项 } from "../../../组件/霓虹街机/文字";
import { 旅行收藏 } from "../../存档/旅行收藏";
import { 同步成就金币 } from "../../成就/旅行奖励";
import type { 游戏模式 } from "../../玩法/再消一行";
import { 创建菜单按钮 } from "../../界面/按钮";
import { 创建模式选择卡 } from "../../界面/模式卡";
import { 布置纯享层 } from "../../界面/纯享风景";
import { 布置金币条 } from "../../界面/金币条";
import { 已解锁风景列表, 相邻已解锁风景 } from "../../界面/风景浏览";
import { 绘制动态霓虹细节 } from "../../视觉/霓虹背景";
import { 布置烘焙底图 } from "../../视觉/风景缩略";
import { 获取文案, 解析语言 } from "../../配置/再消一行文案";
import { type 背景主题, 获取游戏设置 } from "../../配置/再消一行设置";
import { 界面主题 } from "../../配置/界面主题";
import { 播放再消一行音乐, 播放场景氛围 } from "../../音频/再消一行程序音频";

export class 开始菜单 extends Phaser.Scene {
  private 视口 = { 宽: 0, 高: 0, 比例: 1 };
  private 选择模式 = false;
  private 纯享背景 = false;
  private 纯享主题: 背景主题 = 获取游戏设置().背景主题;
  private 背景主题: 背景主题 = 获取游戏设置().背景主题;
  private 背景动画层?: Phaser.GameObjects.Graphics;
  private 角钮: 界面按钮[] = [];
  private 角钮层?: Phaser.GameObjects.Container;
  private 开始钮?: 界面按钮;
  private 标题层?: Phaser.GameObjects.Container;
  private 金币层?: Phaser.GameObjects.Container;
  private 布局?: 主界面布局;
  private 过场?: "进入纯享" | "退出纯享" | "进入模式" | "退出模式";
  constructor() {
    super("开始菜单");
  }
  create(): void {
    应用文字清晰度(this);
    this.cameras.main.fadeIn(180, 8, 18, 25);
    this.选择模式 = false;
    this.纯享背景 = false;
    this.重建();
    播放再消一行音乐("菜单");
    void 同步成就金币();
    window.addEventListener("旅行版:收藏变化", this.重建);
    this.input.on("pointerdown", 解锁程序音频);
    this.scale.on("resize", this.重建, this);
    window.addEventListener("gamemaker:settings-change", this.重建);
    window.addEventListener("keydown", this.按键);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off("resize", this.重建, this);
      window.removeEventListener("旅行版:收藏变化", this.重建);
      this.input.off("pointerdown", 解锁程序音频);
      window.removeEventListener("gamemaker:settings-change", this.重建);
      window.removeEventListener("keydown", this.按键);
    });
  }
  private readonly 按键 = (e: KeyboardEvent): void => {
    if (!this.scene.isActive() || this.scene.isPaused() || e.repeat) return;
    if (this.纯享背景) {
      if (e.code === "Enter" || e.code === "Escape") {
        this.退出纯享();
        return;
      }
      if (e.code === "ArrowLeft") this.切纯享(-1);
      if (e.code === "ArrowRight") this.切纯享(1);
      return;
    }
    if (e.code === "Enter") {
      解锁程序音频();
      if (this.选择模式) this.开始("马拉松");
      else this.进入模式选择();
    } else if (e.code === "Escape" && this.选择模式) this.退出模式选择();
  };
  update(时间: number): void {
    if (this.背景动画层?.active)
      绘制动态霓虹细节(
        this.背景动画层,
        this.视口.宽,
        this.视口.高,
        时间,
        this.背景主题,
        this.纯享背景 ? true : 获取游戏设置().背景动态,
      );
  }
  private 切纯享(方向: -1 | 1): void {
    this.纯享主题 = 相邻已解锁风景(this.纯享主题, 方向);
    this.重建();
  }
  private 进入纯享(): void {
    if (this.纯享背景) return;
    this.选择模式 = false;
    const 解锁 = 已解锁风景列表();
    const 当前 = 获取游戏设置().背景主题;
    this.纯享主题 = 解锁.includes(当前) ? 当前 : (解锁[0] ?? 当前);
    this.纯享背景 = true;
    this.过场 = "进入纯享";
    this.重建();
  }
  private 退出纯享(): void {
    if (!this.纯享背景) return;
    this.纯享背景 = false;
    this.过场 = "退出纯享";
    this.重建();
  }
  private readonly 重建 = (): void => {
    const 过场 = this.过场;
    this.过场 = undefined;
    this.tweens.killAll();
    this.视口 = 适配场景视口(this, 1440, 900);
    this.角钮 = [];
    this.角钮层 = undefined;
    this.开始钮 = undefined;
    this.标题层 = undefined;
    this.金币层 = undefined;
    for (const 对象 of [...this.children.list]) 对象.destroy();
    this.背景主题 = this.纯享背景 ? this.纯享主题 : 获取游戏设置().背景主题;
    布置烘焙底图(
      this,
      undefined,
      this.视口.宽,
      this.视口.高,
      this.背景主题,
      this.纯享背景 ? false : !获取游戏设置().背景动态,
    );
    this.背景动画层 = this.add.graphics().setDepth(-1);
    播放场景氛围(this.背景主题);
    this.构建();
    if (this.纯享背景) {
      布置纯享层(this, this.视口.宽, this.视口.高, {
        主题: this.纯享主题,
        范围: 已解锁风景列表(),
        返回名称: "menu.scenery.exit",
        返回文案: "返回",
        返回: () => this.退出纯享(),
        切换: (方向) => this.切纯享(方向),
        过场: 过场 === "进入纯享",
      });
      if (过场 === "进入纯享") this.移出菜单(true);
      else this.立刻藏起菜单(true);
      return;
    }
    if (this.选择模式) {
      if (过场 === "进入模式") this.移出角钮();
      else this.立刻藏起角钮();
      return;
    }
    if (过场 === "退出纯享") {
      this.立刻藏起菜单(true);
      this.移入菜单(true);
    } else if (过场 === "退出模式") {
      this.立刻藏起角钮();
      this.移入角钮();
    }
  };
  private 进入模式选择(): void {
    if (this.选择模式) return;
    this.选择模式 = true;
    this.过场 = "进入模式";
    this.重建();
  }
  private 退出模式选择(): void {
    if (!this.选择模式) return;
    this.选择模式 = false;
    this.过场 = "退出模式";
    this.重建();
  }
  private 立刻藏起角钮(): void {
    this.角钮层?.setX(-140).setAlpha(0);
    for (const 钮 of this.角钮) 钮.设置可用(false);
  }
  private 移出角钮(): void {
    if (!this.角钮层) return;
    for (const 钮 of this.角钮) 钮.设置可用(false);
    this.tweens.add({
      targets: this.角钮层,
      x: -140,
      alpha: 0,
      duration: 280,
      ease: "Cubic.easeIn",
    });
  }
  private 移入角钮(): void {
    if (!this.角钮层) return;
    for (const 钮 of this.角钮) 钮.设置可用(true);
    this.角钮层.setX(-140).setAlpha(0);
    this.tweens.add({
      targets: this.角钮层,
      x: 0,
      alpha: 1,
      duration: 320,
      ease: "Cubic.easeOut",
    });
  }
  private 立刻藏起菜单(含金币: boolean): void {
    const { 高 } = this.视口;
    this.立刻藏起角钮();
    this.开始钮?.setY(高 + 80).setAlpha(0);
    this.开始钮?.设置可用(false);
    this.标题层?.setY(-70).setAlpha(0);
    if (含金币) this.金币层?.setX(-180).setAlpha(0);
  }
  private 移出菜单(含金币: boolean): void {
    const { 高 } = this.视口;
    this.移出角钮();
    if (this.开始钮)
      this.tweens.add({
        targets: this.开始钮,
        y: 高 + 80,
        alpha: 0,
        duration: 280,
        ease: "Cubic.easeIn",
        onComplete: () => this.开始钮?.设置可用(false),
      });
    if (this.标题层)
      this.tweens.add({
        targets: this.标题层,
        y: -70,
        alpha: 0,
        duration: 240,
        ease: "Cubic.easeIn",
      });
    if (含金币 && this.金币层)
      this.tweens.add({
        targets: this.金币层,
        x: -180,
        alpha: 0,
        duration: 240,
        ease: "Cubic.easeIn",
      });
  }
  private 移入菜单(含金币: boolean): void {
    const { 高 } = this.视口;
    this.移入角钮();
    if (this.开始钮) {
      this.开始钮.设置可用(true);
      this.开始钮.setY(高 + 80).setAlpha(0);
      this.tweens.add({
        targets: this.开始钮,
        y: this.布局?.开始钮?.中心Y ?? this.开始钮.y,
        alpha: 1,
        duration: 320,
        ease: "Cubic.easeOut",
      });
    }
    if (this.标题层) {
      this.标题层.setY(-70).setAlpha(0);
      this.tweens.add({
        targets: this.标题层,
        y: 0,
        alpha: 1,
        duration: 280,
        ease: "Cubic.easeOut",
      });
    }
    if (含金币 && this.金币层) {
      this.金币层.setX(-180).setAlpha(0);
      this.tweens.add({
        targets: this.金币层,
        x: 0,
        alpha: 1,
        duration: 280,
        ease: "Cubic.easeOut",
      });
    }
  }
  private 构建(): void {
    const 布局 = 计算主界面布局(
      this.视口.宽,
      this.视口.高,
      this.选择模式 ? "模式选择" : this.纯享背景 ? "纯享" : "菜单",
    );
    this.布局 = 布局;
    const { 宽, 高 } = this.视口;
    if (!this.选择模式 && !this.纯享背景) {
      const 手势 = this.add
        .rectangle(宽 / 2, 高 / 2, 宽, 高, 0, 0.001)
        .setInteractive()
        .setDepth(-1)
        .setName("menu.scenery");
      绑定滑动手势(手势, { 上滑: () => this.进入纯享() });
      手势.on("pointerup", (指针: Phaser.Input.Pointer) => {
        if (!判定滑动方向(指针.downX, 指针.downY, 指针.x, 指针.y)) this.进入纯享();
      });
    }
    const 语言 = 解析语言(获取游戏设置().语言);
    const 英文 = 语言 !== "简体中文";
    const t = (zh: string, en: string) => (英文 ? en : zh);
    const 游戏名称 = 获取文案(语言).游戏名称;
    document.title = 游戏名称;
    this.标题层 = this.add.container(0, 0);
    for (const 项 of 生成主界面文字项(布局, { 英文, 游戏名称 }))
      添加霓虹文字项(this, this.标题层, 项);
    this.金币层 = this.add.container(0, 0);
    this.金币层.add(
      布置金币条(this, {
        x: 布局.金币.左,
        y: 布局.金币.上,
        金币: new 旅行收藏(localStorage).读取().金币,
        名称: "menu.coins",
      }).层,
    );
    const 角项: { 名称: string; 点: () => void }[] = [
      { 名称: "menu.settings", 点: () => 打开覆盖页面(this, "设置界面") },
      { 名称: "menu.achievements", 点: () => 打开覆盖页面(this, "成就界面") },
      { 名称: "menu.shop", 点: () => 打开覆盖页面(this, "旅行商店") },
    ];
    this.角钮层 = this.add.container(0, 0);
    // 设置/成就/商店各自一块按钮底板，互不共用背景；按钮命中、手势与配色仍走霓虹配方。
    this.角钮 = 布局.角钮.项.map((项, i) =>
      创建菜单按钮(this, {
        x: 布局.角钮.中心X,
        y: 布局.角钮.中心Y[i] ?? 0,
        宽: 布局.角钮.宽,
        高: 布局.角钮.高,
        文案: t(项.文案.中文, 项.文案.英文),
        名称: 角项[i]?.名称 ?? `menu.corner.${i}`,
        点击: 角项[i]?.点 ?? (() => undefined),
        图标: 获取旅行图标(this, 项.图标),
        图标尺寸: 18,
        字号: "12px",
        容器: this.角钮层,
        覆盖: {
          图文方向: "竖排",
          描边宽度: 0,
        },
      }),
    );
    if (布局.开始钮) {
      const 开始 = 布局.开始钮;
      this.开始钮 = this.按钮(
        开始.中心X,
        开始.中心Y,
        开始.宽,
        开始.高,
        t(开始.文案.中文, 开始.文案.英文),
        "menu.start",
        () => this.进入模式选择(),
        false,
        true,
      );
    } else if (布局.模式选择) {
      for (const [索引, 卡] of 布局.模式选择.卡.entries()) {
        创建模式选择卡(this, this.add.container(), {
          索引,
          模式: 卡.模式,
          x: 卡.中心X,
          y: 卡.中心Y,
          宽: 卡.宽,
          高: 卡.高,
          英文,
          点击: () => this.开始(卡.模式),
          排行点击: () => 打开覆盖页面(this, "排行榜界面", { 模式: 卡.模式 }),
        });
      }
      const 返回 = 布局.模式选择.返回钮;
      this.按钮(
        返回.中心X,
        返回.中心Y,
        返回.宽,
        返回.高,
        t(返回.文案.中文, 返回.文案.英文),
        "mode.back",
        () => this.退出模式选择(),
      );
    }
  }
  private 按钮(
    x: number,
    y: number,
    宽: number,
    高: number,
    文案: string,
    name: string,
    点击: () => void,
    轻量 = false,
    主要 = false,
  ): 界面按钮 {
    return 创建菜单按钮(this, {
      x,
      y,
      宽,
      高,
      文案,
      名称: name,
      点击,
      变体: 主要 ? "主要" : "次要",
      字号: 轻量 ? "14px" : "16px",
      覆盖: 轻量
        ? { 样式: "文字", 描边色: "#16303a", 描边宽度: 4 }
        : {
            强调色: 主要 ? 界面主题().文字.强调 : 界面主题().按钮.次要.默认.描边,
            文字色: 主要 ? 界面主题().按钮.主要.默认.文字 : 界面主题().面板.主面板.正文文字,
            面板透明度: 0.78,
          },
    });
  }
  private 开始(模式: 游戏模式): void {
    this.scene.start("再消一行对局", { 模式, 日期: new Date().toISOString().slice(0, 10) });
  }
}
