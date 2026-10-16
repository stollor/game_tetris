import Phaser from "phaser";
import { 适配场景视口 } from "../../../框架/界面/响应式视口";
import { 绑定滑动手势 } from "../../../框架/界面/控件";
import { 应用文字清晰度 } from "../../../框架/界面/文字清晰度";
import { 界面滚动区域 } from "../../../框架/界面/滚动区域";
import { 设置行内图标 } from "../../../框架/界面/行内图标";
import { 注册模态界面 } from "../../../框架/界面/输入隔离";
import { 播放游戏音效, 解锁程序音频 } from "../../../框架/音频/音频";
import { 关闭覆盖页面 } from "../../../框架/页面切换";
import { 创建收藏按钮, 收藏色 } from "../../../组件/旅行收藏/收藏牌面";
import { 获取旅行图标 } from "../../../组件/霓虹街机/图标";
import { 绘制霓虹玻璃 } from "../../../组件/霓虹街机/底板";
import { 绘制方块单元预制体, 绘制方块辉光 } from "../../../组件/霓虹街机/方块单元";
import { 绘制地点纹样 } from "../../../组件/霓虹街机/旅行纹样";
import { 设置预览界面样式 } from "../../../组件/霓虹街机/调色板";
import { 创建风景裁剪 } from "../../../组件/霓虹街机/风景裁剪";
import { 执行收藏操作, 旅行收藏 } from "../../存档/旅行收藏";
import { type 地点皮肤, 地点皮肤表 } from "../../框架配置/旅行地点";
import type { 方块类型 } from "../../玩法/俄罗斯方块";
import { 布置纯享层 } from "../../界面/纯享风景";
import { 布置金币条 } from "../../界面/金币条";
import { 地点浏览列表, 相邻风景 } from "../../界面/风景浏览";
import { 绘制动态霓虹细节, 绘制霓虹背景 } from "../../视觉/霓虹背景";
import { 穿戴旅行外观, 获取游戏设置 } from "../../配置/俄罗斯方块设置";
import { 设置预览方块外观 } from "../../配置/方块外观";
import { 颜色值 } from "../../配置/界面主题";
import { 停止旅行音乐试听, 播放场景氛围, 试听旅行音乐 } from "../../音频/俄罗斯方块程序音频";
import { 外观原价, type 外观部位, 外观部位列表 } from "../../项目配置/旅行皮肤";
import { 出生格 } from "../../预制体/下一个方块栏";

const 部位短名: Record<外观部位, string> = {
  静态背景: "静态",
  动态背景: "动态",
  界面样式: "界面",
  方块外观: "方块",
  音效套装: "音效",
  音乐: "音乐",
};
const 七种方块: 方块类型[] = ["I", "O", "T", "S", "Z", "J", "L"];

export class 旅行商店 extends Phaser.Scene {
  private 返回页面 = "开始菜单";
  private 视口 = { 宽: 0, 高: 0, 比例: 1 };
  private 地点 = 地点皮肤表[0];
  private 目录?: 界面滚动区域;
  private 确认层?: Phaser.GameObjects.Container;
  private 动态层?: Phaser.GameObjects.Graphics;
  private 风景尺寸 = { 宽: 0, 高: 0 };
  private 选中部位: 外观部位 = "方块外观";
  private 纯享 = false;
  private 动态 = true;
  private 消息 = "";
  private 新收藏 = false;
  private readonly 页面变化 = () => this.重建();
  constructor() {
    super("旅行商店");
  }
  init(数据: { 返回页面?: string }): void {
    this.返回页面 = 数据.返回页面 ?? "开始菜单";
  }
  create(): void {
    应用文字清晰度(this);
    this.地点 = 地点皮肤表[0];
    this.纯享 = false;
    this.动态 = true;
    this.选中部位 = "方块外观";
    this.消息 = "";
    this.重建();
    试听旅行音乐(this.地点.名称);
    this.cameras.main.fadeIn(180, 8, 22, 26);
    this.scale.on("resize", this.重建, this);
    window.addEventListener("keydown", this.按键);
    window.addEventListener("storage", this.页面变化);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off("resize", this.重建, this);
      window.removeEventListener("keydown", this.按键);
      window.removeEventListener("storage", this.页面变化);
      设置预览界面样式();
      设置预览方块外观();
      停止旅行音乐试听();
      播放场景氛围(获取游戏设置().背景主题);
    });
  }
  private readonly 按键 = (e: KeyboardEvent) => {
    if (e.repeat) return;
    if (this.确认层?.active) {
      if (e.code === "Escape") this.关闭确认();
      return;
    }
    if (this.纯享) {
      if (e.code === "Escape") {
        this.纯享 = false;
        this.重建();
      } else if (e.code === "ArrowLeft") this.切地点(-1);
      else if (e.code === "ArrowRight") this.切地点(1);
      return;
    }
    if (e.code === "Escape") this.关闭();
    else if (e.code === "ArrowLeft") this.切地点(-1);
    else if (e.code === "ArrowRight") this.切地点(1);
  };
  private 切地点(方向: -1 | 1): void {
    const 名称 = 相邻风景(this.地点.名称, 方向, 地点浏览列表());
    this.地点 = 地点皮肤表.find((项) => 项.名称 === 名称) ?? this.地点;
    this.动态 = this.选中部位 !== "静态背景";
    this.消息 = "";
    试听旅行音乐(this.地点.名称);
    this.重建();
    播放游戏音效("俄罗斯方块.暂存");
  }
  update(时间: number): void {
    if (this.动态层?.active)
      绘制动态霓虹细节(
        this.动态层,
        this.风景尺寸.宽,
        this.风景尺寸.高,
        时间,
        this.地点.名称,
        this.动态,
      );
  }
  private 文字(
    x: number,
    y: number,
    内容: string,
    字号 = 16,
    颜色 = 收藏色.正文,
    宽?: number,
    根?: Phaser.GameObjects.Container,
  ) {
    const 文本 = this.add.text(x, y, 内容, {
      fontFamily: '"Microsoft YaHei", "Segoe UI", sans-serif',
      fontSize: `${字号}px`,
      color: 颜色,
      fontStyle: 字号 >= 20 ? "bold" : "normal",
      wordWrap: 宽 ? { width: 宽, useAdvancedWrap: true } : undefined,
    });
    if (内容.includes("▣")) 设置行内图标(文本, { "▣": 获取旅行图标(this, "方块币") });
    根?.add(文本);
    return 文本;
  }
  private 按钮(
    x: number,
    y: number,
    宽: number,
    高: number,
    文案: string,
    名称: string,
    点击: () => void,
    根?: Phaser.GameObjects.Container,
    金色 = false,
    纸面 = false,
  ) {
    const 按钮 = 创建收藏按钮(this, {
      x,
      y,
      宽,
      高,
      文案,
      名称,
      点击: () => {
        解锁程序音频();
        播放游戏音效("俄罗斯方块.旋转");
        点击();
      },
      容器: 根,
      金色,
      纸面,
      图标: 名称.endsWith(".close") ? 获取旅行图标(this, "关闭") : undefined,
      图标尺寸: 18,
      字号: 宽 < 75 ? "12px" : "14px",
    });
    if (文案.includes("▣")) 按钮.设置行内图标({ "▣": 获取旅行图标(this, "方块币") });
    return 按钮;
  }
  private 风景(
    x: number,
    y: number,
    宽: number,
    高: number,
    根?: Phaser.GameObjects.Container,
    动画 = false,
    地点 = this.地点,
  ): void {
    const 图 =
      根 && !动画 ? 创建风景裁剪(this, 根, x, y, 宽, 高) : this.add.graphics().setPosition(x, y);
    绘制霓虹背景(图, 宽, 高, 地点.名称, !动画 || !this.动态);
    if (动画) 根?.add(图);
    if (动画) {
      this.风景尺寸 = { 宽, 高 };
      this.动态层 = this.add.graphics().setPosition(x, y);
      根?.add(this.动态层);
      绘制动态霓虹细节(this.动态层, 宽, 高, this.time.now, 地点.名称, this.动态);
    }
  }
  private readonly 重建 = (): void => {
    this.tweens.killAll();
    for (const 对象 of [...this.children.list]) 对象.destroy();
    this.确认层 = undefined;
    this.目录 = undefined;
    this.动态层 = undefined;
    this.视口 = 适配场景视口(this, 1440, 900);
    const { 宽, 高 } = this.视口;
    设置预览界面样式(this.地点.名称);
    设置预览方块外观(this.地点.名称);
    播放场景氛围(this.地点.名称);
    试听旅行音乐(this.地点.名称);
    if (this.纯享) {
      this.风景(0, 0, 宽, 高, undefined, true);
      布置纯享层(this, 宽, 高, {
        主题: this.地点.名称,
        范围: 地点浏览列表(),
        返回名称: "shop.preview.back",
        返回文案: "返回",
        返回: () => {
          this.纯享 = false;
          this.重建();
        },
        切换: (方向) => this.切地点(方向),
        动态名称: "shop.preview.motion",
        动态: this.动态,
        切换动态: () => {
          this.动态 = !this.动态;
          this.重建();
        },
      });
      return;
    }
    this.风景(0, 0, 宽, 高, undefined, true);
    const 扁 = 高 < 500;
    const 矮 = 高 < 640;
    const 部件行 = 2;
    const 卡高 = 扁 ? 34 : 矮 ? 40 : 48;
    const 买高 = 扁 ? 32 : 矮 ? 38 : 44;
    const 地点高 = 扁 ? 72 : 矮 ? 84 : 100;
    const 页脚高 = 52;
    const 坞高 = 地点高 + 部件行 * (卡高 + 6) + 买高 + 28 + 页脚高;
    const 手势 = this.add
      .rectangle(宽 / 2, (高 - 坞高) / 2, 宽, 高 - 坞高, 0, 0.001)
      .setInteractive();
    绑定滑动手势(手势, {
      左滑: () => this.切地点(1),
      右滑: () => this.切地点(-1),
    });
    const 钱包 = new 旅行收藏(localStorage),
      存档 = 钱包.读取();
    const 条 = 布置金币条(this, { x: 16, y: 12, 金币: 存档.金币, 名称: "shop.balance" });
    this.按钮(宽 / 2, 高 - 28, 96, 36, "退出", "shop.close", () => this.关闭());
    this.按钮(宽 / 2, 高 - 坞高 - 32, 80, 32, "纯享", "shop.preview", () => {
      this.纯享 = true;
      this.重建();
    });
    const 题y = 12 + 条.高 + 6;
    this.add
      .text(宽 / 2, 题y, this.地点.名称, {
        fontFamily: '"Microsoft YaHei", "Segoe UI", sans-serif',
        fontSize: 宽 < 500 ? "22px" : "28px",
        fontStyle: "bold",
        color: "#fff8e7",
        stroke: "#16303a",
        strokeThickness: 4,
      })
      .setOrigin(0.5, 0)
      .setName("shop.hero.title");
    this.add
      .text(宽 / 2, 题y + 30, this.地点.副题, {
        fontFamily: '"Microsoft YaHei", "Segoe UI", sans-serif',
        fontSize: "13px",
        color: "#fff4d9",
        stroke: "#16303a",
        strokeThickness: 3,
      })
      .setOrigin(0.5, 0);
    if (this.消息)
      this.add
        .text(宽 / 2, 题y + 50, this.消息, {
          fontFamily: '"Microsoft YaHei", "Segoe UI", sans-serif',
          fontSize: "13px",
          color: "#ffe7a8",
          stroke: "#16303a",
          strokeThickness: 3,
        })
        .setOrigin(0.5, 0);
    if (this.选中部位 === "方块外观") this.绘方块陈列(宽, 高, 坞高);
    if (this.选中部位 === "界面样式") this.绘界面示意(宽, 高, 坞高);
    this.绘制浮层(宽, 高, 坞高, 地点高, 卡高, 买高);
    if (钱包.错误)
      this.add
        .text(宽 / 2, 高 - 坞高 - 18, "收藏读取异常，已保护原存档，购买暂停", {
          fontSize: "11px",
          color: 收藏色.次要,
          stroke: "#16303a",
          strokeThickness: 3,
        })
        .setOrigin(0.5, 1);
  };
  private 绘方块陈列(宽: number, 高: number, 坞高: number): void {
    const 可用宽 = 宽 - 48;
    const 可用高 = Math.max(96, 高 - 坞高 - 174);
    const 列 = 可用宽 < 520 ? (可用宽 < 380 ? 2 : 4) : 7;
    const 行 = Math.ceil(七种方块.length / 列);
    const 列距 = 16;
    const 行距 = 14;
    const 格 = Math.max(
      14,
      Math.min(
        36,
        Math.floor((可用宽 - (列 - 1) * 列距) / (列 * 4)),
        Math.floor((可用高 - (行 - 1) * 行距) / (行 * 2)),
      ),
    );
    const 槽宽 = 格 * 4;
    const 槽高 = 格 * 2;
    const 块宽 = 列 * 槽宽 + (列 - 1) * 列距;
    const 块高 = 行 * 槽高 + (行 - 1) * 行距;
    const 左 = (宽 - 块宽) / 2;
    const 顶 = 108 + Math.max(0, (可用高 - 块高) / 2);
    const 底 = this.add.graphics();
    底
      .fillStyle(颜色值(this.地点.面板), 0.96)
      .fillRoundedRect(左 - 12, 顶 - 12, 块宽 + 24, 块高 + 24, 14);
    底
      .lineStyle(1, this.地点.强调, 0.6)
      .strokeRoundedRect(左 - 12, 顶 - 12, 块宽 + 24, 块高 + 24, 14);
    const 辉光 = this.add.graphics();
    const g = this.add.graphics();
    七种方块.forEach((类型, i) => {
      const 列号 = i % 列;
      const 行号 = Math.floor(i / 列);
      const 格点 = 出生格[类型];
      const 最小x = Math.min(...格点.map((点) => 点[0]));
      const 最大x = Math.max(...格点.map((点) => 点[0]));
      const 最小y = Math.min(...格点.map((点) => 点[1]));
      const 最大y = Math.max(...格点.map((点) => 点[1]));
      const 件宽 = (最大x - 最小x + 1) * 格;
      const 件高 = (最大y - 最小y + 1) * 格;
      const ox = 左 + 列号 * (槽宽 + 列距) + (槽宽 - 件宽) / 2;
      const oy = 顶 + 行号 * (槽高 + 行距) + (槽高 - 件高) / 2;
      const 外观 = {
        方案: this.地点.名称,
        格子: 格,
        色值: this.地点.方块[七种方块.indexOf(类型)],
      } as const;
      for (const [gx, gy] of 格点) {
        const x = ox + (gx - 最小x) * 格;
        const y = oy + (gy - 最小y) * 格;
        绘制方块辉光(辉光, x, y, 外观);
        绘制方块单元预制体(g, x, y, 外观);
      }
    });
  }
  private 绘界面示意(宽: number, 高: number, 坞高: number): void {
    const 面板宽 = Math.min(400, 宽 - 72);
    const 面板高 = Math.min(188, Math.max(140, 高 - 坞高 - 140));
    const x = (宽 - 面板宽) / 2;
    const y = 96 + Math.max(0, (高 - 坞高 - 120 - 面板高) / 2);
    const g = this.add.graphics();
    绘制霓虹玻璃(g, x, y, 面板宽, 面板高, { 透明度: 0.72, 圆角: 14 });
    this.文字(x + 20, y + 16, this.地点.名称, 20, "#fff8e7", 面板宽 - 40);
    this.文字(x + 20, y + 46, "界面配色示意", 13, "#f0ead3", 面板宽 - 40);
    const 钮宽 = Math.min(140, (面板宽 - 56) / 2);
    for (const [i, 名] of ["开始", "设置"].entries()) {
      const bx = x + 20 + i * (钮宽 + 16);
      const by = y + 面板高 - 58;
      g.fillStyle(this.地点.主色, 0.95).fillRoundedRect(bx, by, 钮宽, 36, 8);
      g.lineStyle(1.5, this.地点.强调, 0.85).strokeRoundedRect(bx, by, 钮宽, 36, 8);
      this.文字(bx + 10, by + 8, 名, 14, "#fff8e7", 钮宽 - 20);
    }
  }
  private 选中套装内容(部位: 外观部位): void {
    this.选中部位 = 部位;
    if (部位 === "静态背景") this.动态 = false;
    if (部位 === "动态背景") this.动态 = true;
    if (部位 === "音乐") {
      试听旅行音乐(this.地点.名称);
      this.消息 = "正在播放此套音乐";
    } else this.消息 = "";
    this.重建();
    if (部位 === "音效套装") {
      播放游戏音效(`旅行.${this.地点.名称}.四行`);
      播放游戏音效(`旅行.${this.地点.名称}.消行`);
    }
    if (部位 === "音乐") this.time.delayedCall(40, () => this.提示("正在播放此套音乐"));
  }
  private 提示(文案: string): void {
    const 条 = this.add
      .text(this.视口.宽 / 2, Math.max(110, this.视口.高 * 0.28), 文案, {
        fontFamily: '"Microsoft YaHei", "Segoe UI", sans-serif',
        fontSize: "16px",
        fontStyle: "bold",
        color: "#173c34",
        backgroundColor: "#edcf8e",
        padding: { x: 18, y: 8 },
      })
      .setOrigin(0.5)
      .setDepth(200);
    this.tweens.add({
      targets: 条,
      y: 74,
      alpha: 0,
      delay: 900,
      duration: 280,
      onComplete: () => 条.destroy(),
    });
  }
  private 绘制浮层(
    宽: number,
    高: number,
    坞高: number,
    地点高: number,
    卡高: number,
    买高: number,
  ): void {
    const 条y = 高 - 坞高 - 8;
    绘制霓虹玻璃(this.add.graphics(), 8, 条y, 宽 - 16, 坞高 - 52, { 透明度: 0.34, 圆角: 16 });
    this.绘制部件(16, 条y + 8, 宽 - 32, 卡高);
    this.绘制购买(16, 条y + 8 + 2 * (卡高 + 6), 宽 - 32, 买高);
    this.绘制目录(16, 高 - 地点高 - 68, 宽 - 32, 地点高);
  }
  private 绘制目录(x: number, y: number, 宽: number, 高: number): void {
    const 卡宽 = 宽 < 430 ? 96 : 118,
      卡高 = 高 - 4,
      间 = 8;
    const 列表 = new 界面滚动区域(this, {
      左: x,
      上: y,
      宽,
      高,
      内容高: 高,
      内容宽: 地点皮肤表.length * (卡宽 + 间),
      方向: "水平",
      允许控件拖动: true,
      显示滚动条: false,
    });
    this.目录 = 列表;
    地点皮肤表.forEach((地点, i) => {
      const 卡 = this.add.container(x + i * (卡宽 + 间), y);
      列表.内容容器.add(卡);
      const 已有 = new 旅行收藏(localStorage)
        .读取()
        .已购.filter((项) => 项.startsWith(`${地点.名称}.`)).length;
      创建收藏按钮(this, {
        x: 卡宽 / 2,
        y: 卡高 / 2,
        宽: 卡宽,
        高: 卡高,
        文案: "",
        名称: `shop.place.${地点.名称}`,
        容器: 卡,
        已选: this.地点 === 地点,
        点击: () => {
          this.地点 = 地点;
          this.动态 = this.选中部位 !== "静态背景";
          this.消息 = "";
          试听旅行音乐(地点.名称);
          this.重建();
          播放游戏音效(`旅行.${地点.名称}.旋转`);
        },
        覆盖: {
          绘制底板: (图, w, h, s) => {
            图
              .clear()
              .fillStyle(0x071820, this.地点 === 地点 ? 0.55 : s.悬停 ? 0.42 : 0.28)
              .fillRoundedRect(-w / 2, -h / 2, w, h, 8);
            图
              .lineStyle(
                1.5,
                this.地点 === 地点 ? 收藏色.金 : 0xffffff,
                this.地点 === 地点 ? 0.9 : 0.18,
              )
              .strokeRoundedRect(-w / 2, -h / 2, w, h, 8);
          },
        },
      });
      this.风景(4, 4, 卡宽 - 8, 卡高 - 22, 卡, false, 地点);
      this.文字(6, 卡高 - 18, 地点.名称, 11, "#fff6d8", 卡宽 - 12, 卡);
      if (已有)
        this.文字(卡宽 - 22, 6, String(已有), 10, "#fff6d8", undefined, 卡).setBackgroundColor(
          "#315449",
        );
    });
    列表.设置滚动位置(Math.max(0, 地点皮肤表.indexOf(this.地点) * (卡宽 + 间) - 12));
  }
  private 绘制部件(x: number, y: number, 宽: number, 卡高: number): void {
    const 列 = 3;
    const 间 = 6;
    const 卡宽 = (宽 - (列 - 1) * 间) / 列;
    const 钱包 = new 旅行收藏(localStorage);
    外观部位列表.forEach((部位, i) => {
      const 列号 = i % 列;
      const 行号 = Math.floor(i / 列);
      const cx = x + 列号 * (卡宽 + 间);
      const cy = y + 行号 * (卡高 + 间);
      const 已有 = 钱包.拥有(this.地点.名称, 部位);
      const 预览中 = this.选中部位 === 部位;
      const 卡 = this.add.container(cx, cy);
      const g = this.add.graphics();
      卡.add(g);
      创建收藏按钮(this, {
        x: 卡宽 / 2,
        y: 卡高 / 2,
        宽: 卡宽,
        高: 卡高,
        文案: "",
        名称: `shop.item.${部位}`,
        容器: 卡,
        已选: 预览中,
        点击: () => this.选中套装内容(部位),
        覆盖: {
          绘制底板: (图, w, h, s) => {
            图
              .clear()
              .fillStyle(0x0c2428, s.悬停 || 预览中 ? 0.72 : 0.42)
              .fillRoundedRect(-w / 2, -h / 2, w, h, 8);
            图
              .lineStyle(
                1.5,
                预览中 || 已有 ? 收藏色.金 : 0xffffff,
                预览中 ? 0.95 : 已有 ? 0.7 : 0.16,
              )
              .strokeRoundedRect(-w / 2, -h / 2, w, h, 8);
          },
        },
      });
      this.绘部位预览(g, 卡, 6, 4, Math.min(40, 卡宽 * 0.28), 卡高 - 10, 部位, true);
      this.文字(52, 6, 部位短名[部位], 13, "#fff8e7", 卡宽 - 58, 卡);
      this.文字(
        52,
        卡高 - 20,
        已有 ? "已有" : `▣ ${钱包.报价(this.地点, 部位)}`,
        11,
        "#f0ead3",
        卡宽 - 58,
        卡,
      );
    });
  }
  private 绘制购买(x: number, y: number, 宽: number, 高: number): void {
    const 钱包 = new 旅行收藏(localStorage);
    const 单件 = 钱包.报价(this.地点, this.选中部位);
    const 整套 = 钱包.报价(this.地点, "整套");
    const 钮宽 = (宽 - 10) / 2;
    this.按钮(
      x + 钮宽 / 2,
      y + 高 / 2,
      钮宽,
      高,
      单件 ? `${部位短名[this.选中部位]} ▣ ${单件}` : `穿戴${部位短名[this.选中部位]}`,
      "shop.buy",
      () => this.打开确认(this.地点, this.选中部位),
      undefined,
      false,
    );
    this.按钮(
      x + 钮宽 + 10 + 钮宽 / 2,
      y + 高 / 2,
      钮宽,
      高,
      整套 ? `整套 ▣ ${整套}` : "穿上整套",
      "shop.bundle",
      () => this.打开确认(this.地点, "整套"),
      undefined,
      true,
    );
  }
  private 绘部位预览(
    g: Phaser.GameObjects.Graphics,
    根: Phaser.GameObjects.Container,
    x: number,
    y: number,
    宽: number,
    高: number,
    部位: 外观部位,
    手机: boolean,
  ): void {
    g.fillStyle(手机 ? 0x122824 : 0xcfc6ad, 0.9).fillRoundedRect(x, y, 宽, 高, 6);
    if (部位 === "静态背景" || 部位 === "动态背景") {
      const 预览 = 创建风景裁剪(this, 根, x + 2, y + 2, 宽 - 4, 高 - 4);
      绘制霓虹背景(预览, 宽 - 4, 高 - 4, this.地点.名称, true);
      if (部位 === "动态背景")
        g.fillStyle(0xe5b96d, 0.9).fillRoundedRect(x + 宽 - 22, y + 4, 18, 12, 3);
    } else if (部位 === "界面样式") {
      g.fillStyle(this.地点.主色).fillRoundedRect(x + 6, y + 10, 宽 - 12, 高 - 20, 4);
      g.lineStyle(1, this.地点.强调, 0.8).strokeRoundedRect(x + 6, y + 10, 宽 - 12, 高 - 20, 4);
      绘制地点纹样(g, x + 10, y + 14, 16, this.地点.纹样, 0.9);
    } else if (部位 === "方块外观") {
      const 格 = Math.max(8, Math.min(14, Math.floor((宽 - 8) / 4)));
      const 格点 = 出生格.T;
      const 最小x = Math.min(...格点.map((点) => 点[0]));
      const 最大x = Math.max(...格点.map((点) => 点[0]));
      const 最小y = Math.min(...格点.map((点) => 点[1]));
      const 最大y = Math.max(...格点.map((点) => 点[1]));
      const ox = x + (宽 - (最大x - 最小x + 1) * 格) / 2;
      const oy = y + (高 - (最大y - 最小y + 1) * 格) / 2;
      for (const [gx, gy] of 格点)
        绘制方块单元预制体(g, ox + (gx - 最小x) * 格, oy + (gy - 最小y) * 格, {
          方案: this.地点.名称,
          格子: 格,
          色值: this.地点.方块[2],
        });
    } else if (部位 === "音效套装") {
      const cy = y + 高 / 2;
      g.fillStyle(this.地点.强调).fillTriangle(x + 8, cy - 10, x + 8, cy + 10, x + 18, cy);
      g.fillStyle(this.地点.强调).fillRect(x + 8, cy - 6, 6, 12);
      for (let i = 0; i < 3; i++)
        g.lineStyle(1.4, this.地点.强调, 0.7 - i * 0.18).strokeCircle(x + 16, cy, 6 + i * 4);
    } else {
      const cy = y + 高 / 2;
      g.lineStyle(2, this.地点.强调).lineBetween(x + 10, y + 高 - 6, x + 10, y + 6);
      g.fillStyle(this.地点.强调).fillCircle(x + 10, y + 8, 4);
      g.fillStyle(this.地点.强调, 0.5).fillEllipse(x + 22, cy, 12, Math.min(18, 高 - 8));
    }
  }
  private 提示穿戴(): void {
    const 条 = this.文字(this.视口.宽 / 2, 82, "已穿戴 · 旅程焕新", 16, "#173c34")
      .setOrigin(0.5)
      .setPadding(20, 10)
      .setBackgroundColor("#edcf8e")
      .setDepth(200);
    this.tweens.add({
      targets: 条,
      y: 70,
      alpha: 0,
      delay: 1100,
      duration: 350,
      onComplete: () => 条.destroy(),
    });
  }
  private 打开确认(地点: 地点皮肤, 部位: 外观部位 | "整套"): void {
    this.关闭确认();
    this.目录?.设置滚动可用(false);
    const { 宽, 高 } = this.视口,
      面板宽 = Math.min(470, 宽 - 28),
      面板高 = Math.min(410, 高 - 24),
      t = {
        面板: { 主面板: { 背景: "#eee6d2" } },
        文字: { 强调: "#28433f", 主要: "#28433f", 次要: "#64756b" },
        按钮: { 主要: { 禁用: { 背景: "#b8b9a3", 描边: "#a4ab96", 文字: "#344c43" } } },
      };
    const 层 = this.add.container(0, 0).setDepth(100);
    this.确认层 = 层;
    const 遮罩 = this.add
      .rectangle(宽 / 2, 高 / 2, 宽, 高, 0x030a13, 0.82)
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
          if (
            Math.abs(指针.worldX - 宽 / 2) > 面板宽 / 2 ||
            Math.abs(指针.worldY - 高 / 2) > 面板高 / 2
          )
            this.关闭确认();
        },
      );
    层.add(遮罩);
    注册模态界面(层, 遮罩);
    const 左 = (宽 - 面板宽) / 2,
      顶 = (高 - 面板高) / 2;
    层.add(
      this.add
        .rectangle(宽 / 2, 高 / 2, 面板宽, 面板高, 颜色值(t.面板.主面板.背景))
        .setStrokeStyle(1, 颜色值(t.文字.强调), 0.7),
    );
    this.文字(左 + 25, 顶 + 24, `${地点.名称} · ${部位}`, 22, t.文字.强调, 面板宽 - 70, 层);
    const 收藏 = new 旅行收藏(localStorage),
      价格 = 收藏.报价(地点, 部位),
      数据 = 收藏.读取();
    const 已有 = 价格 === 0;
    this.文字(
      左 + 25,
      顶 + 83,
      已有 ? "这件收藏已在你的旅行箱里" : "购买后永久保留在当前浏览器的收藏中",
      15,
      t.文字.主要,
      面板宽 - 50,
      层,
    );
    const 原价 =
      部位 === "整套"
        ? 外观部位列表
            .filter((项) => 项 !== "静态背景")
            .reduce((和, 项) => 和 + 收藏.报价(地点, 项), 0)
        : 外观原价(地点, 部位);
    this.文字(
      左 + 25,
      顶 + 127,
      已有
        ? "可单独使用，也可与其他地点自由搭配"
        : `▣ ${价格}${部位 === "整套" ? `  ·  单买 ▣ ${原价}` : 部位 === "动态背景" ? " · 包含静态背景" : ""}\n余额 ▣ ${数据.金币}`,
      18,
      t.文字.强调,
      面板宽 - 50,
      层,
    );
    const 提示 = this.文字(
      左 + 25,
      顶 + 202,
      已有
        ? "穿戴只改变外观，不影响得分或玩法。"
        : 数据.金币 < 价格
          ? `还差 ${价格 - 数据.金币} 方块币，继续对局和完成成就即可获得。`
          : "确认后扣除方块币；购买完成后可选择穿戴。",
      13,
      t.文字.次要,
      面板宽 - 50,
      层,
    );
    const 操作 = this.按钮(
      宽 / 2,
      顶 + 面板高 - 89,
      面板宽 - 50,
      46,
      已有 ? "使用此外观" : `确认购买 · ▣ ${价格}`,
      已有 ? "shop.confirm.use" : "shop.confirm.buy",
      () => {
        if (已有) {
          this.消息 = 穿戴旅行外观(地点.名称, 部位)
            ? "已穿戴，旅行从此刻开始"
            : "穿戴失败，请重新读取收藏";
          this.重建();
          this.提示穿戴();
          return;
        }
        操作.设置可用(false).setLabel("购买中…");
        void 执行收藏操作((钱包) => 钱包.购买(地点.名称, 部位))
          .then((结果) => {
            if (!this.scene.isActive()) return;
            if (结果.成功) {
              this.消息 = 结果.原因;
              this.新收藏 = true;
              播放游戏音效("俄罗斯方块.全清");
              if (this.确认层 === 层 && 层.active) {
                this.重建();
                this.打开确认(地点, 部位);
              } else
                (
                  this.children.getByName("shop.balance") as Phaser.GameObjects.Text | null
                )?.setText(结果.金币.toLocaleString());
            } else {
              if (提示.active) {
                提示.setText(结果.原因);
                操作.设置可用(true).setLabel(`确认购买 · ▣ ${价格}`);
              }
            }
          })
          .catch(() => {
            if (提示.active) 提示.setText("未能完成购买，请重试；未确认的购买不会扣款。");
            if (操作.active) 操作.设置可用(true).setLabel(`确认购买 · ▣ ${价格}`);
          });
      },
      层,
      true,
    );
    if (!已有 && (数据.金币 < 价格 || 收藏.错误))
      操作
        .设置可用(false)
        .设置配色(t.按钮.主要.禁用.背景, t.按钮.主要.禁用.描边)
        .setLabelColor(t.按钮.主要.禁用.文字)
        .setAlpha(0.7);
    this.按钮(
      宽 / 2,
      顶 + 面板高 - 35,
      面板宽 - 50,
      34,
      "返回",
      "shop.confirm.cancel",
      () => this.关闭确认(),
      层,
    );
    const 关闭 = this.按钮(
      左 + 面板宽 - 26,
      顶 + 30,
      32,
      32,
      "",
      "shop.confirm.close",
      () => this.关闭确认(),
      层,
    );
    关闭.设置图标(获取旅行图标(this, "关闭"));
    if (this.新收藏) {
      this.新收藏 = false;
      const 印 = this.文字(宽 / 2, 顶 + 面板高 * 0.42, "已收藏", 40, "#b35e43", undefined, 层)
        .setOrigin(0.5)
        .setAngle(-12)
        .setAlpha(0)
        .setScale(1.8);
      this.tweens.add({
        targets: 印,
        scaleX: 1,
        scaleY: 1,
        alpha: 0.2,
        duration: 360,
        ease: "Back.easeOut",
      });
      for (let i = 0; i < 16; i++) {
        const 点 = this.add.circle(宽 / 2, 顶 + 80, 2 + (i % 3), 收藏色.金).setAlpha(0.8);
        层.add(点);
        this.tweens.add({
          targets: 点,
          x: 宽 / 2 + Math.cos(i * 2.4) * (60 + i * 5),
          y: 顶 + 80 + Math.sin(i * 2.4) * 75,
          alpha: 0,
          duration: 650 + i * 17,
          onComplete: () => 点.destroy(),
        });
      }
    }
  }
  private 关闭确认(): void {
    this.确认层?.destroy();
    this.确认层 = undefined;
    this.目录?.设置滚动可用(true);
  }
  private 关闭(): void {
    设置预览界面样式();
    设置预览方块外观();
    停止旅行音乐试听();
    播放场景氛围(获取游戏设置().背景主题);
    关闭覆盖页面(this, this.返回页面);
  }
}
