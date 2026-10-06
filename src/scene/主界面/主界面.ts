import Phaser from "phaser";
import { 获取文案, 解析语言 } from "../../../core/多语言";
import { 获取游戏界面外观, 获取游戏背景色 } from "../../../core/游戏框架";
import { 界面布局 } from "../../../core/组件/Phaser界面/布局";
import { 界面按钮 } from "../../../core/组件/Phaser界面/按钮";
import { 界面文字 } from "../../../core/组件/Phaser界面/控件";
import { 获取游戏设置 } from "../../../core/设置";
import { 绑定音频管理器 } from "../../../core/音频";
import { 打开覆盖页面 } from "../../../core/页面切换";

type 菜单文案键 = "开始游戏" | "设置" | "退出游戏";

interface 菜单项 {
  对象: 界面按钮;
  文案键: 菜单文案键;
}

export class 主界面 extends Phaser.Scene {
  private 标题?: 界面文字;
  private 说明?: 界面文字;
  private 主布局?: 界面布局;
  private 菜单项: 菜单项[] = [];
  private 已请求开始 = false;

  constructor() {
    super("主界面");
  }

  create(): void {
    绑定音频管理器(this.sound);
    this.主布局 = new 界面布局(this, this.scale.width / 2, this.scale.height / 2, {
      方向: "垂直",
      宽: Math.min(420, this.scale.width - 32),
      高: 0,
      间距: 8,
      内边距: { 上: 8, 下: 8 },
      交叉轴对齐: "居中",
      自动主轴尺寸: true,
    });
    const 外观 = 获取游戏界面外观(获取游戏设置());
    this.标题 = new 界面文字(this, 0, 0, {
      宽: 0,
      高: 0,
      文案: "",
      字号: "48px",
      颜色: 外观.强调色,
      内边距: 14,
    });
    this.说明 = new 界面文字(this, 0, 0, {
      宽: 0,
      高: 0,
      文案: "",
      字号: "18px",
      颜色: 外观.次要文字,
      内边距: 8,
    });
    this.主布局.添加(this.标题, { 间距后: 4 });
    this.主布局.添加(this.说明, { 间距后: 22 });
    this.菜单项 = [
      this.创建菜单按钮("menu.start", "开始游戏", () => this.请求开始游戏()),
      this.创建菜单按钮("menu.settings", "设置", () => 打开覆盖页面(this, "设置界面")),
      this.创建菜单按钮("menu.exit", "退出游戏", () => this.退出游戏()),
    ];
    this.菜单项.forEach(({ 对象 }) => {
      this.主布局?.添加(对象, { 间距后: 4 });
    });
    this.scale.on("resize", this.排列界面, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off("resize", this.排列界面, this);
      window.removeEventListener("gamemaker:settings-change", this.刷新文案);
    });
    window.addEventListener("gamemaker:settings-change", this.刷新文案);
    this.刷新文案();
  }

  private 创建菜单按钮(名称: string, 文案键: 菜单文案键, 点击: () => void): 菜单项 {
    const 外观 = 获取游戏界面外观(获取游戏设置());
    const 按钮 = new 界面按钮(this, 0, 0, {
      宽: 280,
      高: 44,
      文案: "",
      name: 名称,
      面板色: 外观.面板,
      强调色: 外观.强调色,
      文字色: 外观.强调色,
      点击,
      字号: "22px",
      样式: "文字",
    });
    return { 对象: 按钮, 文案键 };
  }

  private 请求开始游戏(): void {
    window.dispatchEvent(new CustomEvent("gamemaker:start"));
    this.已请求开始 = true;
    this.刷新文案();
  }

  private 退出游戏(): void {
    const 事件 = new CustomEvent("gamemaker:exit", { cancelable: true });
    if (window.dispatchEvent(事件)) window.close();
  }

  private 刷新文案 = (): void => {
    const 文案 = 获取文案(解析语言(获取游戏设置().语言));
    const 设置 = 获取游戏设置();
    this.cameras.main.setBackgroundColor(获取游戏背景色(设置));
    const 外观 = 获取游戏界面外观(设置);
    this.标题?.setLabelColor(外观.强调色).setLabel(document.title);
    this.说明
      ?.setLabelColor(外观.次要文字)
      .setLabel(this.已请求开始 ? 文案.请求开始说明 : 文案.主界面说明);
    this.菜单项.forEach((项目) => {
      项目.对象.setLabelColor(外观.强调色).setLabel(文案[项目.文案键]);
    });
    this.排列界面();
  };

  private 排列界面 = (): void => {
    const 宽 = this.scale.width;
    const 高 = this.scale.height;
    this.标题?.setFontSize(`${Math.min(48, Math.max(30, 宽 / 18))}px`);
    this.主布局
      ?.setPosition(宽 / 2, 高 / 2)
      .设置布局尺寸(Math.min(420, 宽 - 32), 0)
      .重新排列();
  };
}
