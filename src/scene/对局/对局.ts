import Phaser from "phaser";
import { 界面暂停菜单 } from "../../../core/组件/Phaser界面/暂停菜单";
import { 界面触屏操作区, type 触屏操作 } from "../../../core/组件/Phaser界面/触屏操作区";
import { type 背景主题, 获取游戏设置 } from "../../../core/设置";
import { 绑定音频管理器 } from "../../../core/音频";
import {
  type 俄罗斯方块状态,
  切换暂停,
  创建新局,
  创建每日随机源,
  可见高度,
  type 方块类型,
  方块颜色,
  旋转方块,
  更新时钟,
  棋盘宽度,
  每日种子,
  type 游戏模式,
  硬降,
  移动方块,
  读取格子,
  软降一步,
  隐藏高度,
} from "../../玩法/俄罗斯方块";
import { 绘制动态霓虹细节, 绘制霓虹背景 } from "../../视觉/霓虹背景";

let 格子大小 = 25;
let 棋盘左侧 = 354;
let 棋盘顶部 = 70;
interface 本地测试接口 {
  设置序列: (序列: 方块类型[]) => void;
  准备单行消除: () => void;
  读取状态: () => {
    阶段: 俄罗斯方块状态["阶段"];
    分数: number;
    消行数: number;
    当前方块: 方块类型;
    当前格子: [number, number][];
    当前朝向: number;
    下一个方块: 方块类型;
    棋盘: (方块类型 | null)[][];
  };
}

declare global {
  interface Window {
    __俄罗斯方块测试__?: 本地测试接口;
  }
}

interface 横移输入 {
  按住毫秒: number;
  下次横移毫秒: number;
}

export class 对局 extends Phaser.Scene {
  private 状态 = 创建新局();
  private 绘图?: Phaser.GameObjects.Graphics;
  private 背景图?: Phaser.GameObjects.Graphics;
  private 背景动画层?: Phaser.GameObjects.Graphics;
  private 背景主题: 背景主题 = 获取游戏设置().背景主题;
  private 分数文字?: Phaser.GameObjects.Text;
  private 消行文字?: Phaser.GameObjects.Text;
  private 等级文字?: Phaser.GameObjects.Text;
  private 模式文字?: Phaser.GameObjects.Text;
  private 最佳文字?: Phaser.GameObjects.Text;
  private 状态文字?: Phaser.GameObjects.Text;
  private 提示文字?: Phaser.GameObjects.Text;
  private 标题文字?: Phaser.GameObjects.Text;
  private 副标题文字?: Phaser.GameObjects.Text;
  private 操作标题?: Phaser.GameObjects.Text;
  private 操作说明: Phaser.GameObjects.Text[] = [];
  private 快速移动提示?: Phaser.GameObjects.Text;
  private 分数标签?: Phaser.GameObjects.Text;
  private 消行标签?: Phaser.GameObjects.Text;
  private 等级标签?: Phaser.GameObjects.Text;
  private 下一个标签?: Phaser.GameObjects.Text;
  private 最佳标签?: Phaser.GameObjects.Text;
  private 暂停按钮?: Phaser.GameObjects.Rectangle;
  private 暂停按钮文字?: Phaser.GameObjects.Text;
  private 离开按钮?: Phaser.GameObjects.Rectangle;
  private 离开按钮文字?: Phaser.GameObjects.Text;
  private 触屏操作区?: 界面触屏操作区;
  private 暂停面板?: 界面暂停菜单;
  private 重开按钮?: Phaser.GameObjects.Rectangle;
  private 重开文字?: Phaser.GameObjects.Text;
  private 菜单按钮?: Phaser.GameObjects.Rectangle;
  private 菜单文字?: Phaser.GameObjects.Text;
  private 结束已存档 = false;
  private 结束时刻 = 0;
  private 左移输入: 横移输入 = { 按住毫秒: 0, 下次横移毫秒: 200 };
  private 右移输入: 横移输入 = { 按住毫秒: 0, 下次横移毫秒: 200 };
  private 测试序列: 方块类型[] = [];
  private 按住按键 = new Set<string>();
  private 模式: 游戏模式 = "马拉松";
  private 每日日期 = new Date().toISOString().slice(0, 10);
  private 当前随机源: () => number = Math.random;
  private 紧凑布局 = false;
  private 竖屏布局 = false;

  constructor() {
    super("俄罗斯方块对局");
  }

  init(data: { 模式?: 游戏模式; 日期?: string }): void {
    this.模式 = data.模式 ?? "马拉松";
    this.每日日期 = data.日期 ?? new Date().toISOString().slice(0, 10);
    this.当前随机源 =
      this.模式 === "每日挑战" ? 创建每日随机源(每日种子(this.每日日期)) : Math.random;
    this.状态 = 创建新局(this.当前随机源, this.测试序列, this.模式);
    this.结束已存档 = false;
  }

  create(): void {
    绑定音频管理器(this.sound);
    this.cameras.main.setBackgroundColor("#080B18");
    this.背景图 = this.add.graphics().setDepth(-2);
    this.背景主题 = 获取游戏设置().背景主题;
    绘制霓虹背景(this.背景图, this.scale.width, this.scale.height, this.背景主题);
    this.背景动画层 = this.add.graphics().setDepth(-1);
    绘制动态霓虹细节(
      this.背景动画层,
      this.scale.width,
      this.scale.height,
      this.time.now,
      this.背景主题,
    );
    this.绘图 = this.add.graphics();
    this.绘制装饰();
    this.创建文字();
    this.创建触屏操作区();
    this.暂停面板 = new 界面暂停菜单(this, {
      继续: () => {
        切换暂停(this.状态);
        this.更新界面();
      },
      重开: () => this.重新开始(),
      返回: () => this.scene.start("界面原型"),
    });
    window.addEventListener("keydown", this.处理按键按下);
    window.addEventListener("keyup", this.处理按键松开);
    this.绑定测试接口();
    this.更新界面();
    this.布局界面();
    this.scale.on("resize", this.布局界面, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off("resize", this.布局界面, this);
      window.removeEventListener("keydown", this.处理按键按下);
      window.removeEventListener("keyup", this.处理按键松开);
      delete window.__俄罗斯方块测试__;
    });
  }

  private 布局界面 = (): void => {
    const 宽 = this.scale.width;
    const 高 = this.scale.height;
    const 屏幕适配 = 获取游戏设置().屏幕适配;
    this.竖屏布局 = 屏幕适配 === "手机竖屏" || (屏幕适配 === "自动" && 高 > 宽 * 1.05 && 宽 < 1100);
    this.紧凑布局 = 宽 < 820 || this.竖屏布局;
    const 顶部信息底 = 136;
    const 操作区顶 = 高 - 151;
    const 可用棋盘宽 = this.竖屏布局
      ? Math.min(440, 宽 - (宽 < 640 ? 190 : 270))
      : this.紧凑布局
        ? 宽 - 28
        : 宽 - 440;
    const 可用棋盘高 = this.竖屏布局
      ? Math.max(200, 操作区顶 - 顶部信息底 - 20)
      : Math.max(200, 高 - 顶部信息底 - (this.紧凑布局 ? 124 : 32));
    格子大小 = Math.max(
      14,
      Math.min(
        this.竖屏布局 ? 40 : this.紧凑布局 ? 32 : 36,
        可用棋盘宽 / 棋盘宽度,
        可用棋盘高 / 可见高度,
      ),
    );
    const 棋盘像素宽 = 棋盘宽度 * 格子大小;
    const 棋盘像素高 = 可见高度 * 格子大小;
    if (this.背景图) 绘制霓虹背景(this.背景图, 宽, 高, this.背景主题);
    if (this.竖屏布局) {
      if (宽 < 640) {
        棋盘左侧 = 14;
      } else {
        const 内容总宽 = 棋盘像素宽 + 16 + 260;
        棋盘左侧 = Math.round((宽 - 内容总宽) / 2);
      }
      棋盘顶部 = Math.round(顶部信息底 + Math.max(0, (操作区顶 - 顶部信息底 - 棋盘像素高) * 0.62));
    } else if (this.紧凑布局) {
      棋盘左侧 = Math.round((宽 - 棋盘像素宽) / 2);
      棋盘顶部 = Math.max(顶部信息底 + 12, Math.round((高 - 棋盘像素高 + 顶部信息底 - 124) / 2));
    } else {
      const 内容总宽 = 棋盘像素宽 + 32 + 244;
      棋盘左侧 = Math.round((宽 - 内容总宽) / 2);
      棋盘顶部 = Math.round(Math.max(顶部信息底 + 12, (高 - 棋盘像素高 + 顶部信息底) / 2));
    }

    this.标题文字
      ?.setText(this.模式)
      .setPosition(宽 / 2, 38)
      .setOrigin(0.5)
      .setFontSize(this.紧凑布局 ? "18px" : "21px");
    this.副标题文字?.setVisible(false);
    this.离开按钮?.setPosition(58, 38);
    this.离开按钮文字?.setPosition(58, 38);
    this.暂停按钮?.setPosition(宽 - 58, 38);
    this.暂停按钮文字?.setPosition(宽 - 58, 38);
    this.触屏操作区?.布局(宽, 高, this.竖屏布局);
    this.暂停面板?.布局(宽, 高);

    const 侧栏X = 棋盘左侧 + 棋盘像素宽 + (this.竖屏布局 ? (宽 < 640 ? 10 : 16) : 32);
    const 侧栏顶 = this.竖屏布局 ? 棋盘顶部 - 10 : 棋盘顶部 + 8;
    const 指标X = (比例: number): number => 宽 * 比例;
    const 指标Y = (偏移: number): number => 76 + 偏移;

    this.模式文字?.setVisible(false);
    this.分数标签
      ?.setPosition(指标X(0.5), 指标Y(0))
      .setOrigin(0.5, 0)
      .setFontSize(宽 < 460 ? "10px" : "12px");
    this.分数文字
      ?.setPosition(指标X(0.5), 指标Y(17))
      .setOrigin(0.5, 0)
      .setFontSize(宽 < 460 ? "16px" : this.紧凑布局 ? "21px" : "25px");
    this.消行标签
      ?.setPosition(指标X(0.83), 指标Y(0))
      .setOrigin(0.5, 0)
      .setFontSize(宽 < 460 ? "10px" : "12px");
    this.消行文字
      ?.setPosition(指标X(0.83), 指标Y(17))
      .setOrigin(0.5, 0)
      .setFontSize(宽 < 460 ? "18px" : "22px");
    this.等级标签
      ?.setPosition(指标X(0.17), 指标Y(0))
      .setOrigin(0.5, 0)
      .setFontSize(宽 < 460 ? "10px" : "12px");
    this.等级文字
      ?.setPosition(指标X(0.17), 指标Y(17))
      .setOrigin(0.5, 0)
      .setFontSize(宽 < 460 ? "18px" : "22px");
    this.下一个标签
      ?.setPosition(
        this.竖屏布局 ? 侧栏X + 7 : this.紧凑布局 ? 宽 - 108 : 侧栏X + 18,
        this.竖屏布局 ? 侧栏顶 + 18 : this.紧凑布局 ? 146 : 侧栏顶 + 276,
      )
      .setOrigin(this.竖屏布局 ? 0 : this.紧凑布局 ? 0.5 : 0, 0)
      .setFontSize(this.竖屏布局 ? (宽 < 640 ? "10px" : "12px") : "12px");
    this.最佳标签
      ?.setPosition(
        this.竖屏布局 ? 侧栏X + 12 : this.紧凑布局 ? 指标X(3) : 侧栏X + 18,
        this.竖屏布局
          ? 侧栏顶 + 棋盘像素高 + 20 - 82
          : this.紧凑布局
            ? 棋盘顶部 + 棋盘像素高 + 20
            : 侧栏顶 + 500,
      )
      .setOrigin(this.竖屏布局 ? 0 : 0.5, 0)
      .setFontSize(this.竖屏布局 ? (宽 < 640 ? "13px" : "14px") : "12px");
    this.最佳文字
      ?.setPosition(
        this.竖屏布局 ? 侧栏X + 12 : this.紧凑布局 ? 指标X(3) : 侧栏X + 18,
        this.竖屏布局
          ? 侧栏顶 + 棋盘像素高 + 20 - 52
          : this.紧凑布局
            ? 棋盘顶部 + 棋盘像素高 + 38
            : 侧栏顶 + 522,
      )
      .setOrigin(this.竖屏布局 ? 0 : 0.5, 0)
      .setFontSize(this.竖屏布局 ? "18px" : "16px");
    this.操作标题?.setVisible(false);
    for (const 说明 of this.操作说明) 说明.setVisible(false);
    this.快速移动提示?.setVisible(false);
    this.状态文字?.setPosition(
      宽 / 2,
      Math.min(高 - 16, 棋盘顶部 + 棋盘像素高 + (this.竖屏布局 ? 18 : 102)),
    );
    this.提示文字?.setPosition(棋盘左侧 + 棋盘像素宽 / 2, 棋盘顶部 + 棋盘像素高 / 2 - 30);
    this.重开按钮?.setPosition(棋盘左侧 + 棋盘像素宽 / 2, 棋盘顶部 + 棋盘像素高 / 2 + 35);
    this.重开文字?.setPosition(棋盘左侧 + 棋盘像素宽 / 2, 棋盘顶部 + 棋盘像素高 / 2 + 35);
    this.菜单按钮?.setPosition(棋盘左侧 + 棋盘像素宽 / 2, 棋盘顶部 + 棋盘像素高 / 2 + 91);
    this.菜单文字?.setPosition(棋盘左侧 + 棋盘像素宽 / 2, 棋盘顶部 + 棋盘像素高 / 2 + 91);
    this.暂停按钮?.setVisible(this.状态.阶段 !== "结束");
    this.暂停按钮文字?.setVisible(this.状态.阶段 !== "结束");
    this.暂停按钮文字?.setText(this.状态.阶段 === "暂停" ? "继续" : "暂停");
    this.触屏操作区?.setVisible(this.竖屏布局 && this.状态.阶段 === "进行中");
    this.暂停面板?.setVisible(this.状态.阶段 === "暂停");
    this.绘制装饰();
    this.更新界面();
  };

  update(_时间: number, delta: number): void {
    const 新主题 = 获取游戏设置().背景主题;
    if (新主题 !== this.背景主题) {
      this.背景主题 = 新主题;
      this.布局界面();
    }
    if (this.背景动画层?.active) {
      绘制动态霓虹细节(
        this.背景动画层,
        this.scale.width,
        this.scale.height,
        this.time.now,
        this.背景主题,
      );
    }
    if (this.状态.阶段 !== "进行中") return;
    const 经过毫秒 = Math.min(delta, 1000);
    this.处理横移("ArrowLeft", -1, this.左移输入, 经过毫秒);
    this.处理横移("ArrowRight", 1, this.右移输入, 经过毫秒);

    更新时钟(this.状态, 经过毫秒, this.当前随机源, this.按住按键.has("ArrowDown"));
    this.更新界面();
  }

  private readonly 处理按键按下 = (事件: KeyboardEvent): void => {
    const 支持按键 = [
      "ArrowLeft",
      "ArrowRight",
      "ArrowUp",
      "ArrowDown",
      "Space",
      "KeyP",
      "Escape",
      "KeyX",
      "KeyZ",
    ];
    if (!支持按键.includes(事件.code)) return;
    事件.preventDefault();
    if (事件.repeat || this.按住按键.has(事件.code)) return;
    this.按住按键.add(事件.code);

    if (事件.code === "KeyP" || 事件.code === "Escape") {
      if (this.状态.阶段 !== "结束") {
        切换暂停(this.状态);
        this.更新界面();
      }
      return;
    }
    if (this.状态.阶段 !== "进行中") return;

    if (事件.code === "ArrowLeft") this.开始横移(-1);
    if (事件.code === "ArrowRight") this.开始横移(1);
    if (事件.code === "ArrowUp") 旋转方块(this.状态, 1, false, this.当前随机源);
    if (事件.code === "ArrowDown") 软降一步(this.状态, this.当前随机源);
    if (事件.code === "KeyX") 旋转方块(this.状态, -1, false, this.当前随机源);
    if (事件.code === "KeyZ" && localStorage.getItem("neon-pulse:rotation-180") !== "false") {
      旋转方块(this.状态, 1, true, this.当前随机源);
    }
    if (事件.code === "Space") {
      硬降(this.状态, this.当前随机源);
      this.重置计时器();
    }
    this.更新界面();
  };

  private readonly 处理按键松开 = (事件: KeyboardEvent): void => {
    this.按住按键.delete(事件.code);
    if (事件.code === "ArrowLeft") this.重置横移(this.左移输入);
    if (事件.code === "ArrowRight") this.重置横移(this.右移输入);
    if (事件.code === "ArrowDown") this.状态.内部重力 = 0;
  };

  private 开始横移(方向: number): void {
    if (this.状态.阶段 !== "进行中") return;
    const 输入 = 方向 < 0 ? this.左移输入 : this.右移输入;
    输入.按住毫秒 = 0;
    输入.下次横移毫秒 = 133;
    移动方块(this.状态, 方向, 0, this.当前随机源);
    this.更新界面();
  }

  private 重置横移(输入: 横移输入): void {
    输入.按住毫秒 = 0;
    输入.下次横移毫秒 = 133;
  }

  private 处理横移(按键代码: string, 方向: number, 输入: 横移输入, delta: number): void {
    if (!this.按住按键.has(按键代码) || this.状态.阶段 !== "进行中") {
      return;
    }
    输入.按住毫秒 += delta;
    while (输入.按住毫秒 >= 输入.下次横移毫秒) {
      移动方块(this.状态, 方向, 0, this.当前随机源);
      输入.下次横移毫秒 += 33;
      this.更新界面();
    }
  }

  private readonly 重置计时器 = (): void => {
    this.状态.内部重力 = 0;
  };

  private 绑定测试接口(): void {
    if (!this.是本地开发地址()) return;
    window.__俄罗斯方块测试__ = {
      设置序列: (序列) => {
        this.测试序列 = [...序列];
        this.重新开始();
      },
      准备单行消除: () => {
        this.测试序列 = ["I", "O"];
        this.重新开始();
        const 底行 = this.状态.棋盘.at(-1);
        if (底行) {
          for (let 列 = 0; 列 < 底行.length; 列 += 1) {
            if (列 < 3 || 列 > 6) 底行[列] = "J";
          }
        }
        this.更新界面();
      },
      读取状态: () => ({
        阶段: this.状态.阶段,
        分数: this.状态.分数,
        消行数: this.状态.消行数,
        当前方块: this.状态.当前方块.类型,
        当前格子: 读取格子(this.状态.当前方块),
        当前朝向: this.状态.当前方块.旋转,
        下一个方块: this.状态.下一个方块,
        棋盘: structuredClone(this.状态.棋盘),
      }),
    };
  }

  private 是本地开发地址(): boolean {
    return ["localhost", "127.0.0.1", "[::1]"].includes(window.location.hostname);
  }

  private 重新开始(): void {
    if (this.模式 === "马拉松" && Date.now() - this.结束时刻 < 3000) return;
    this.状态 = 创建新局(this.当前随机源, this.测试序列, this.模式);
    this.测试序列 = [];
    this.按住按键.clear();
    this.重置计时器();
    this.重置横移(this.左移输入);
    this.重置横移(this.右移输入);
    this.更新界面();
  }

  private 创建文字(): void {
    this.标题文字 = this.add.text(0, 0, "NEON PULSE", {
      fontFamily: "Arial, sans-serif",
      fontSize: "25px",
      fontStyle: "bold",
      color: "#E7F7FF",
      letterSpacing: 2,
    });
    this.副标题文字 = this.add.text(0, 0, "俄罗斯方块 · 街机模式", {
      fontFamily: "Arial, sans-serif",
      fontSize: "13px",
      color: "#7D91B7",
    });
    this.操作标题 = this.add.text(0, 0, "操作", {
      fontSize: "14px",
      color: "#00E5FF",
      fontStyle: "bold",
    });
    this.操作说明 = [
      "← →   移动",
      "↑ / X   旋转",
      "Z       180°旋转",
      "↓       软降",
      "空格   硬降",
      "P / Esc 暂停",
    ].map((文案) => this.add.text(0, 0, 文案, { fontSize: "15px", color: "#B5C4E2" }));
    this.快速移动提示 = this.add.text(0, 0, "← → 按住可快速移动", {
      fontSize: "12px",
      color: "#627392",
    });

    this.分数文字 = this.add.text(0, 0, "000000", {
      fontFamily: "Arial, sans-serif",
      fontSize: "30px",
      fontStyle: "bold",
      color: "#F4F8FF",
    });
    this.分数标签 = this.add.text(0, 0, "分数", {
      fontSize: "12px",
      color: "#8293B3",
      letterSpacing: 2,
    });
    this.消行文字 = this.add.text(0, 0, "0", {
      fontFamily: "Arial, sans-serif",
      fontSize: "26px",
      fontStyle: "bold",
      color: "#00E5FF",
    });
    this.消行标签 = this.add.text(0, 0, "消行", {
      fontSize: "12px",
      color: "#8293B3",
      letterSpacing: 2,
    });
    this.等级标签 = this.add.text(0, 0, "等级", {
      fontSize: "12px",
      color: "#8293B3",
      letterSpacing: 2,
    });
    this.等级文字 = this.add.text(0, 0, "1", {
      fontSize: "24px",
      color: "#FFEE58",
      fontStyle: "bold",
    });
    this.模式文字 = this.add.text(0, 0, "", { fontSize: "12px", color: "#00E5FF" });
    this.下一个标签 = this.add.text(0, 0, "下一个", {
      fontSize: "12px",
      color: "#8293B3",
      letterSpacing: 2,
    });
    this.最佳标签 = this.add.text(0, 0, "最佳纪录", {
      fontSize: "12px",
      color: "#D7E3F2",
      letterSpacing: 2,
    });
    this.最佳文字 = this.add.text(0, 0, "—", {
      fontSize: "16px",
      color: "#FFEE58",
      fontStyle: "bold",
    });
    this.状态文字 = this.add
      .text(0, 0, "", {
        fontSize: "13px",
        color: "#7586A5",
        align: "center",
      })
      .setOrigin(0.5);
    this.提示文字 = this.add
      .text(0, 0, "", {
        fontSize: "32px",
        fontStyle: "bold",
        color: "#F3F7FF",
        align: "center",
        stroke: "#080B18",
        strokeThickness: 8,
      })
      .setOrigin(0.5)
      .setDepth(10);
    this.重开按钮 = this.add
      .rectangle(0, 0, 184, 48, 0x092a3b, 1)
      .setStrokeStyle(1, 0x00e5ff, 0.8)
      .setInteractive({ useHandCursor: true })
      .setName("restart")
      .setDepth(11)
      .on("pointerover", () => this.重开按钮?.setFillStyle(0x10425a))
      .on("pointerout", () => this.重开按钮?.setFillStyle(0x092a3b))
      .on("pointerdown", () => this.重新开始());
    this.重开文字 = this.add
      .text(0, 0, "重新开始", {
        fontSize: "16px",
        fontStyle: "bold",
        color: "#D8FBFF",
      })
      .setOrigin(0.5)
      .setDepth(12)
      .setVisible(false);
    this.菜单按钮 = this.add
      .rectangle(0, 0, 184, 42, 0x101a35, 1)
      .setStrokeStyle(1, 0x8296be, 0.75)
      .setInteractive({ useHandCursor: true })
      .setName("main-menu")
      .setDepth(11)
      .on("pointerdown", () => this.scene.start("界面原型"))
      .setVisible(false);
    this.菜单文字 = this.add
      .text(0, 0, "返回主菜单", { fontSize: "14px", color: "#B5C4E2" })
      .setOrigin(0.5)
      .setDepth(12)
      .setVisible(false);
    this.离开按钮 = this.add
      .rectangle(0, 0, 78, 38, 0x101a35, 0.82)
      .setStrokeStyle(1, 0x354967, 0.92)
      .setInteractive({ useHandCursor: true })
      .setName("game.leave")
      .on("pointerdown", () => this.scene.start("界面原型"));
    this.离开按钮文字 = this.add
      .text(0, 0, "‹  离开", { fontSize: "13px", color: "#C8D5EA" })
      .setOrigin(0.5);
    this.暂停按钮 = this.add
      .rectangle(0, 0, 78, 38, 0x101a35, 1)
      .setStrokeStyle(1, 0x29405f, 0.9)
      .setInteractive({ useHandCursor: true })
      .on("pointerdown", () => {
        if (this.状态.阶段 !== "结束") {
          切换暂停(this.状态);
          this.更新界面();
        }
      });
    this.暂停按钮文字 = this.add
      .text(0, 0, "暂停", {
        fontSize: "13px",
        color: "#C8D5EA",
        fontStyle: "bold",
      })
      .setOrigin(0.5);
  }

  private 创建触屏操作区(): void {
    const 操作区 = new 界面触屏操作区(this);
    this.触屏操作区 = 操作区;
    操作区.on("control-down", (操作: 触屏操作) => {
      if (this.状态.阶段 !== "进行中") return;
      if (操作 === "左移" || 操作 === "右移") {
        const 方向 = 操作 === "左移" ? -1 : 1;
        this.按住按键.add(方向 < 0 ? "ArrowLeft" : "ArrowRight");
        this.开始横移(方向);
      } else if (操作 === "左转" || 操作 === "旋转" || 操作 === "右转") {
        if (操作 === "右转" && localStorage.getItem("neon-pulse:rotation-180") === "false") return;
        旋转方块(this.状态, 操作 === "左转" ? -1 : 1, 操作 === "右转", this.当前随机源);
        this.更新界面();
      } else if (操作 === "软降") {
        this.按住按键.add("ArrowDown");
        软降一步(this.状态, this.当前随机源);
        this.更新界面();
      }
    });
    操作区.on("control-up", (操作: 触屏操作) => {
      if (操作 === "左移" || 操作 === "右移") {
        const 代码 = 操作 === "左移" ? "ArrowLeft" : "ArrowRight";
        this.按住按键.delete(代码);
        this.重置横移(操作 === "左移" ? this.左移输入 : this.右移输入);
      }
      if (操作 === "软降") {
        this.按住按键.delete("ArrowDown");
        this.状态.内部重力 = 0;
      }
    });
  }

  private 绘制装饰 = (): void => {
    const 绘图 = this.绘图;
    if (!绘图) return;
    绘图.clear();
    const 棋盘像素宽 = 棋盘宽度 * 格子大小;
    const 棋盘像素高 = 可见高度 * 格子大小;
    绘图
      .fillStyle(0x080b18, this.竖屏布局 ? 0.2 : 0.14)
      .fillRect(0, 0, this.scale.width, this.scale.height);
    绘图.fillStyle(0x0d1428, 0.96).fillRoundedRect(12, 66, this.scale.width - 24, 62, 12);
    绘图
      .lineStyle(1, 0x31435d, 0.9)
      .strokeRoundedRect(12, 66, this.scale.width - 24, 62, 12)
      .lineStyle(1, 0x28375b, 0.8)
      .lineBetween(this.scale.width / 3, 77, this.scale.width / 3, 117)
      .lineBetween((this.scale.width * 2) / 3, 77, (this.scale.width * 2) / 3, 117);
    if (this.竖屏布局) {
      const 侧栏X = 棋盘左侧 + 棋盘像素宽 + (this.scale.width < 640 ? 10 : 16);
      const 侧栏宽 = this.scale.width < 640 ? this.scale.width - 侧栏X - 8 : 260;
      const 侧栏顶 = 棋盘顶部 - 10;
      const 侧栏高 = 棋盘像素高 + 20;
      绘图.fillStyle(0x0a1025, 0.54).fillRoundedRect(侧栏X, 侧栏顶, 侧栏宽, 侧栏高, 12);
      绘图.lineStyle(1, 0x28375b, 0.84).strokeRoundedRect(侧栏X, 侧栏顶, 侧栏宽, 侧栏高, 12);
      绘图
        .lineStyle(1, 0x28375b, 0.7)
        .lineBetween(侧栏X + 10, 侧栏顶 + 侧栏高 - 94, 侧栏X + 侧栏宽 - 10, 侧栏顶 + 侧栏高 - 94);
    } else if (!this.紧凑布局) {
      const 侧栏X = 棋盘左侧 + 棋盘像素宽 + 20;
      const 侧栏顶 = 棋盘顶部 + 8;
      const 侧栏高 = 棋盘像素高 - 16;
      绘图.fillStyle(0x0d1225, 0.86).fillRoundedRect(侧栏X, 侧栏顶, 228, 侧栏高, 16);
      绘图.lineStyle(1, 0x1d2b49, 0.9).strokeRoundedRect(侧栏X, 侧栏顶, 228, 侧栏高, 16);
      绘图
        .lineStyle(1, 0x1d2b49, 0.72)
        .lineBetween(侧栏X + 16, 侧栏顶 + 258, 侧栏X + 212, 侧栏顶 + 258);
    }
    绘图
      .fillStyle(0x070a14, this.竖屏布局 ? 0.58 : 0.78)
      .fillRoundedRect(
        棋盘左侧 - 10,
        棋盘顶部 - 10,
        棋盘宽度 * 格子大小 + 20,
        可见高度 * 格子大小 + 20,
        12,
      );
    绘图
      .lineStyle(1, 0x203252, 1)
      .strokeRoundedRect(
        棋盘左侧 - 10,
        棋盘顶部 - 10,
        棋盘宽度 * 格子大小 + 20,
        可见高度 * 格子大小 + 20,
        12,
      );
    for (let 列 = 0; 列 <= 棋盘宽度; 列 += 1) {
      绘图
        .lineStyle(1, 0x17213a, 0.45)
        .lineBetween(
          棋盘左侧 + 列 * 格子大小,
          棋盘顶部,
          棋盘左侧 + 列 * 格子大小,
          棋盘顶部 + 可见高度 * 格子大小,
        );
    }
    for (let 行 = 0; 行 <= 可见高度; 行 += 1) {
      绘图
        .lineStyle(1, 0x17213a, 0.45)
        .lineBetween(
          棋盘左侧,
          棋盘顶部 + 行 * 格子大小,
          棋盘左侧 + 棋盘宽度 * 格子大小,
          棋盘顶部 + 行 * 格子大小,
        );
    }
  };

  private 画方块格(列: number, 行: number, 类型: 方块类型, 透明度 = 1, 小格大小 = 格子大小): void {
    if (行 < 0) return;
    const 绘图 = this.绘图;
    if (!绘图) return;
    const x = 棋盘左侧 + 列 * 小格大小 + 1.5;
    const y = 棋盘顶部 + 行 * 小格大小 + 1.5;
    const 色彩 = 方块颜色[类型];
    绘图
      .fillStyle(色彩, 0.18 * 透明度)
      .fillRoundedRect(x - 1, y - 1, 小格大小 - 1, 小格大小 - 1, 5);
    绘图
      .fillStyle(色彩, 0.92 * 透明度)
      .fillRoundedRect(x + 2, y + 2, 小格大小 - 6, 小格大小 - 6, 4);
    绘图.fillStyle(0xffffff, 0.34 * 透明度).fillRoundedRect(x + 4, y + 3, 小格大小 - 12, 3, 2);
    绘图
      .lineStyle(1, 0xffffff, 0.5 * 透明度)
      .strokeRoundedRect(x + 2, y + 2, 小格大小 - 6, 小格大小 - 6, 4);
  }

  private 绘制下一个方块(): void {
    const 绘图 = this.绘图;
    if (!绘图) return;
    const 预览序列 = [this.状态.下一个方块, ...this.状态.后续方块.slice(0, 2)];
    const 出生格: Record<方块类型, [number, number][]> = {
      I: [
        [0, 1],
        [1, 1],
        [2, 1],
        [3, 1],
      ],
      O: [
        [1, 0],
        [2, 0],
        [1, 1],
        [2, 1],
      ],
      T: [
        [1, 0],
        [0, 1],
        [1, 1],
        [2, 1],
      ],
      S: [
        [1, 0],
        [2, 0],
        [0, 1],
        [1, 1],
      ],
      Z: [
        [0, 0],
        [1, 0],
        [1, 1],
        [2, 1],
      ],
      J: [
        [0, 0],
        [0, 1],
        [1, 1],
        [2, 1],
      ],
      L: [
        [2, 0],
        [0, 1],
        [1, 1],
        [2, 1],
      ],
    };
    const 侧栏间距 = this.scale.width < 640 ? 10 : 16;
    const 竖屏侧栏X = 棋盘左侧 + 棋盘宽度 * 格子大小 + 侧栏间距;
    const 竖屏侧栏宽 = this.scale.width - 竖屏侧栏X - 8;
    const 竖屏侧栏顶 = 棋盘顶部 - 10;
    const 竖屏侧栏高 = 可见高度 * 格子大小 + 20;
    const 预览卡高 = (竖屏侧栏高 - 42 - 92 - 32) / 3;
    const 微缩格 = this.竖屏布局
      ? Math.max(12, Math.min(30, (竖屏侧栏宽 - 24) / 4, (预览卡高 - 20) / 2))
      : this.紧凑布局
        ? 11
        : 18;
    const 预览宽 = 微缩格 * 4;
    const 预览X = this.竖屏布局
      ? 竖屏侧栏X + (竖屏侧栏宽 - 预览宽) / 2
      : this.紧凑布局
        ? this.scale.width - 108 - 预览宽 / 2
        : 棋盘左侧 + 棋盘宽度 * 格子大小 + 44;
    const 预览Y = this.竖屏布局 ? 竖屏侧栏顶 + 42 : this.紧凑布局 ? 146 : 棋盘顶部 + 8 + 306;
    预览序列.forEach((方块, 索引) => {
      const 最小列 = Math.min(...出生格[方块].map(([列]) => 列));
      const 最小行 = Math.min(...出生格[方块].map(([, 行]) => 行));
      const 当前Y = 预览Y + 索引 * (this.竖屏布局 ? 预览卡高 + 8 : 62);
      if (this.竖屏布局) {
        const 卡片X = 竖屏侧栏X + 8;
        const 卡片宽 = 竖屏侧栏宽 - 16;
        绘图.fillStyle(0x18243a, 0.38).fillRoundedRect(卡片X, 当前Y, 卡片宽, 预览卡高, 9);
        绘图.lineStyle(1, 0x91aac5, 0.4).strokeRoundedRect(卡片X, 当前Y, 卡片宽, 预览卡高, 9);
      }
      const 最大列 = Math.max(...出生格[方块].map(([列]) => 列));
      const 最大行 = Math.max(...出生格[方块].map(([, 行]) => 行));
      const 方块宽 = (最大列 - 最小列 + 1) * 微缩格;
      const 方块高 = (最大行 - 最小行 + 1) * 微缩格;
      const 方块X = this.竖屏布局 ? 竖屏侧栏X + (竖屏侧栏宽 - 方块宽) / 2 : 预览X;
      const 方块Y = this.竖屏布局 ? 当前Y + (预览卡高 - 方块高) / 2 : 当前Y;
      for (const [列, 行] of 出生格[方块]) {
        const x = 方块X + (列 - 最小列) * 微缩格;
        const y = 方块Y + (行 - 最小行) * 微缩格;
        绘图
          .fillStyle(方块颜色[方块], 0.2)
          .fillRoundedRect(x, y, 微缩格 - 1, 微缩格 - 1, this.竖屏布局 ? 5 : 3);
        绘图
          .fillStyle(方块颜色[方块], 0.92)
          .fillRoundedRect(
            x + (this.竖屏布局 ? 3 : 2),
            y + (this.竖屏布局 ? 3 : 2),
            微缩格 - (this.竖屏布局 ? 6 : 5),
            微缩格 - (this.竖屏布局 ? 6 : 5),
            this.竖屏布局 ? 4 : 2,
          );
        绘图
          .fillStyle(0xffffff, 0.45)
          .fillRoundedRect(x + 5, y + 4, Math.max(3, 微缩格 - 12), 3, 2);
      }
    });
  }

  private 更新界面(): void {
    if (!this.绘图) return;
    this.绘制装饰();
    for (let 行 = 0; 行 < 可见高度; 行 += 1) {
      for (let 列 = 0; 列 < 棋盘宽度; 列 += 1) {
        const 类型 = this.状态.棋盘[行 + 隐藏高度]?.[列];
        if (类型) this.画方块格(列, 行, 类型);
      }
    }

    if (this.状态.阶段 !== "结束") {
      const 幽灵 = {
        ...this.状态.当前方块,
        格子: this.状态.当前方块.格子.map((格子) => ({ ...格子 })),
      };
      while (移动方块({ ...this.状态, 当前方块: 幽灵 } as 俄罗斯方块状态, 0, 1)) {
        for (const 格子 of 幽灵.格子) 格子.行2 += 2;
      }
      for (const [列, 行] of 读取格子(幽灵)) this.画方块格(列, 行, 幽灵.类型, 0.28);
      for (const [列, 行] of 读取格子(this.状态.当前方块))
        this.画方块格(列, 行, this.状态.当前方块.类型);
    }
    this.绘制下一个方块();
    this.分数文字?.setText(String(this.状态.分数).padStart(6, "0"));
    this.消行文字?.setText(String(this.状态.消行数));
    this.等级文字?.setText(String(this.状态.等级));
    const 模式名 =
      this.模式 === "马拉松"
        ? "马拉松"
        : this.模式 === "冲刺"
          ? `冲刺 · 40 行 · ${(this.状态.有效用时 / 1000).toFixed(2)}s`
          : this.模式 === "极限"
            ? `极限 · ${Math.ceil(this.状态.剩余时间 / 1000)}s`
            : `每日 · ${this.每日日期}`;
    this.模式文字?.setText(模式名);
    this.最佳文字?.setText(this.读取最佳文案());
    this.暂停按钮?.setVisible(this.状态.阶段 !== "结束");
    this.暂停按钮文字
      ?.setVisible(this.状态.阶段 !== "结束")
      .setText(this.状态.阶段 === "暂停" ? "继续" : "暂停");
    const 显示触屏按钮 = this.竖屏布局 && this.状态.阶段 === "进行中";
    this.触屏操作区?.setVisible(显示触屏按钮);
    this.暂停面板?.setVisible(this.状态.阶段 === "暂停");
    this.提示文字
      ?.setVisible(this.状态.阶段 !== "进行中")
      .setText(this.状态.阶段 === "暂停" ? "已暂停" : this.状态.阶段 === "结束" ? "游戏结束" : "");
    this.状态文字
      ?.setVisible(this.状态.阶段 !== "进行中")
      .setText(
        this.状态.阶段 === "暂停"
          ? "按 P 或 Esc 继续"
          : this.状态.完赛
            ? `冲刺完赛 · ${(this.状态.有效用时 / 1000).toFixed(2)} 秒 · ${this.状态.分数} 分`
            : `本局结束 · ${this.状态.分数} 分 · ${this.状态.消行数} 行 · Lv.${this.状态.等级}`,
      );
    this.重开按钮?.setVisible(this.状态.阶段 === "结束");
    this.重开文字?.setVisible(this.状态.阶段 === "结束");
    this.菜单按钮?.setVisible(this.状态.阶段 === "结束");
    this.菜单文字?.setVisible(this.状态.阶段 === "结束");
    if (this.状态.阶段 === "结束" && !this.结束已存档) this.保存纪录();
    this.发布测试快照();
  }

  private 保存纪录(): void {
    this.结束已存档 = true;
    this.结束时刻 = Date.now();
    const key =
      this.模式 === "每日挑战"
        ? `neon-pulse:daily:${this.每日日期}`
        : `neon-pulse:best:${this.模式}`;
    try {
      const previous = JSON.parse(localStorage.getItem(key) ?? "null") as {
        分数?: number;
        用时?: number;
      } | null;
      const better =
        this.模式 === "冲刺"
          ? this.状态.完赛 && (previous?.用时 === undefined || this.状态.有效用时 < previous.用时)
          : this.状态.分数 > (previous?.分数 ?? -1);
      if (better)
        localStorage.setItem(
          key,
          JSON.stringify({
            分数: this.状态.分数,
            用时: this.状态.完赛 ? this.状态.有效用时 : null,
            消行数: this.状态.消行数,
            等级: this.状态.等级,
            最长连击: this.状态.最长连击,
          }),
        );
      this.最佳文字?.setText(this.读取最佳文案());
    } catch {
      /* 浏览器禁用存储时保留本局结算。 */
    }
  }

  private 读取最佳文案(): string {
    const key =
      this.模式 === "每日挑战"
        ? `neon-pulse:daily:${this.每日日期}`
        : `neon-pulse:best:${this.模式}`;
    try {
      const record = JSON.parse(localStorage.getItem(key) ?? "null") as {
        分数?: number;
        用时?: number | null;
      } | null;
      if (!record) return "暂无纪录";
      if (this.模式 === "冲刺")
        return typeof record.用时 === "number"
          ? `${(record.用时 / 1000).toFixed(2)} 秒`
          : "暂无完赛纪录";
      return `${(record.分数 ?? 0).toLocaleString()} 分`;
    } catch {
      return "暂无纪录";
    }
  }

  private 发布测试快照(): void {
    if (!this.是本地开发地址()) return;
    window.dispatchEvent(
      new CustomEvent("gamemaker:game-state", {
        detail: {
          阶段: this.状态.阶段,
          模式: this.模式,
          分数: this.状态.分数,
          消行数: this.状态.消行数,
          等级: this.状态.等级,
          朝向: this.状态.当前方块.旋转,
          方块: this.状态.当前方块.类型,
          剩余秒: Math.ceil(this.状态.剩余时间 / 1000),
        },
      }),
    );
  }
}
