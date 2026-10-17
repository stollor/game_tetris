import Phaser from "phaser";
import { 适配场景视口 } from "../../../框架/界面/响应式视口";
import { 界面按钮 } from "../../../框架/界面/按钮";
import { 应用文字清晰度 } from "../../../框架/界面/文字清晰度";
import { 界面滚动区域 } from "../../../框架/界面/滚动区域";
import { 关闭覆盖页面 } from "../../../框架/页面切换";
import { 旅行收藏 } from "../../存档/旅行收藏";
import { 创建俄罗斯方块成就, 成就定义 } from "../../成就/俄罗斯方块成就";
import { 同步成就金币 } from "../../成就/旅行奖励";
import { 布置金币条 } from "../../界面/金币条";
import { 解析语言 } from "../../配置/俄罗斯方块文案";
import { 获取游戏设置 } from "../../配置/俄罗斯方块设置";
import { 界面主题, 颜色值 } from "../../配置/界面主题";

declare global {
  interface Window {
    __俄罗斯方块成就__?: () => { 滚动: number; 保存成功: boolean };
  }
}

export class 成就界面 extends Phaser.Scene {
  private 视口 = { 宽: 0, 高: 0, 比例: 1 };
  constructor() {
    super("成就界面");
  }
  create(): void {
    应用文字清晰度(this);
    this.cameras.main.fadeIn(150, 8, 18, 25);
    void 同步成就金币();
    this.布局();
    this.scale.on("resize", this.布局, this);
    window.addEventListener("keydown", this.按键);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off("resize", this.布局, this);
      window.removeEventListener("keydown", this.按键);
      delete window.__俄罗斯方块成就__;
    });
  }
  private readonly 按键 = (e: KeyboardEvent) => {
    if (e.code === "Escape") this.返回();
  };
  private 返回 = () => 关闭覆盖页面(this, "开始菜单");
  private 布局 = (): void => {
    this.视口 = 适配场景视口(this, 1440, 900);
    for (const 对象 of [...this.children.list]) 对象.destroy();
    const w = this.视口.宽,
      h = this.视口.高,
      t = 界面主题();
    const 英文 = 解析语言(获取游戏设置().语言) !== "简体中文";
    this.add.rectangle(w / 2, h / 2, w, h, 颜色值(t.面板.主面板.背景));
    const 金币条 = 布置金币条(this, {
      x: 16,
      y: 12,
      金币: new 旅行收藏(localStorage).读取().金币,
      名称: "achievements.coins",
    });
    const 系统 = 创建俄罗斯方块成就();
    const 已得 = 成就定义.filter((a) => 系统.读取(a.编号).解锁时间 !== null).length;
    const 标题 = this.add
      .text(w / 2, 30, `${英文 ? "ACHIEVEMENTS" : "成就收藏"}  ${已得} / ${成就定义.length}`, {
        fontSize: "24px",
        color: t.文字.主要,
        fontStyle: "bold",
      })
      .setOrigin(0.5);
    // 窄屏时标题避让左上角金币条，不再与之重叠。
    const 最小中心 = 16 + 金币条.宽 + 12 + 标题.width / 2;
    if (标题.x < 最小中心) 标题.setX(Math.min(最小中心, w - 12 - 标题.width / 2));
    this.add
      .text(
        w / 2,
        64,
        英文 ? "Every game leaves a little progress." : "每项成就 +60 方块币，自动存入旅行收藏。",
        {
          fontSize: "13px",
          color: t.文字.次要,
        },
      )
      .setOrigin(0.5);
    const 宽 = Math.min(680, w - 32),
      左 = (w - 宽) / 2;
    const 滚动 = new 界面滚动区域(this, {
      左,
      上: 94,
      宽,
      高: h - 172,
      内容高: 成就定义.length * 94,
      显示滚动条: false,
    });
    window.__俄罗斯方块成就__ = () => ({ 滚动: 滚动.获取滚动位置(), 保存成功: 系统.保存成功 });
    成就定义.forEach((a, i) => {
      const p = 系统.读取(a.编号),
        已解锁 = p.解锁时间 !== null,
        y = 94 + i * 94;
      const 行 = this.add.container(左, y);
      const g = this.add.graphics();
      g.fillStyle(颜色值(t.按钮.次要.默认.背景), 0.7).fillRoundedRect(0, 0, 宽 - 12, 84, 12);
      g.lineStyle(1, 颜色值(已解锁 ? t.文字.强调 : t.面板.分组线), 0.7).strokeRoundedRect(
        0,
        0,
        宽 - 12,
        84,
        12,
      );
      g.fillStyle(颜色值(t.面板.分组线), 0.5).fillRoundedRect(16, 67, 宽 - 44, 3, 1);
      if (p.进度 > 0)
        g.fillStyle(颜色值(t.文字.强调), 0.9).fillRoundedRect(
          16,
          67,
          (宽 - 44) * Math.min(1, p.进度 / a.目标),
          3,
          1,
        );
      const 标题 = this.add.text(16, 12, `${已解锁 ? "✓" : "◇"}  ${英文 ? a.英文 : a.名称}`, {
        fontSize: "16px",
        fontStyle: "bold",
        color: 已解锁 ? t.文字.强调 : t.文字.主要,
      });
      const 说明 = this.add.text(16, 40, 英文 ? a.英文说明 : a.说明, {
        fontSize: "12px",
        color: t.文字.次要,
        wordWrap: { width: 宽 - 110 },
      });
      const 数量 = this.add
        .text(宽 - 28, 18, `${Math.min(p.进度, a.目标)}/${a.目标}`, {
          fontSize: "12px",
          color: t.文字.次要,
        })
        .setOrigin(1, 0);
      行.add([g, 标题, 说明, 数量]);
      滚动.内容容器.add(行);
      滚动.注册可视内容(行, y, 84);
    });
    new 界面按钮(this, w / 2, h - 34, {
      宽: Math.min(260, w - 40),
      高: 42,
      文案: 英文 ? "Back" : "返回主菜单",
      name: "achievements.back",
      点击: this.返回,
      面板色: t.按钮.次要.默认.背景,
      强调色: t.文字.强调,
      文字色: t.文字.主要,
    });
  };
}
