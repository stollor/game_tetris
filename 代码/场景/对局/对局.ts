import Phaser from "phaser";
import { 应用文字清晰度 } from "../../../框架/文字清晰度";
import { 界面按钮 } from "../../../框架/组件/Phaser界面/按钮";
import { 界面数值面板 } from "../../../框架/组件/Phaser界面/数值面板";
import { 界面暂停菜单 } from "../../../框架/组件/Phaser界面/暂停菜单";
import { 绘制玻璃面板 } from "../../../框架/组件/Phaser界面/玻璃绘制";
import { 界面触屏操作区 } from "../../../框架/组件/Phaser界面/触屏操作区";
import { 播放游戏背景音乐, 播放游戏音效, 绑定音频管理器, 解锁程序音频 } from "../../../框架/音频";
import {
  type 俄罗斯方块状态,
  切换暂停,
  创建新局,
  创建模式随机源,
  可见高度,
  type 方块类型,
  旋转方块,
  是否使用马拉松结算重开锁,
  更新时钟,
  棋盘宽度,
  type 游戏模式,
  硬降,
  移动方块,
  读取格子,
  软降一步,
} from "../../玩法/俄罗斯方块";
import { 应用背景文字样式, 背景基调, 背景文字配色 } from "../../视觉/文字可读性";
import { 绘制动态霓虹细节, 绘制霓虹背景 } from "../../视觉/霓虹背景";
import { 获取文案, 解析语言 } from "../../配置/俄罗斯方块文案";
import { type 背景主题, 获取游戏设置 } from "../../配置/俄罗斯方块设置";
import { 设置俄罗斯方块音乐暂停 } from "../../音频/俄罗斯方块程序音频";
import { 界面对局设置菜单 } from "../../预制体/对局设置菜单";

type 触屏操作 = "左转" | "旋转" | "右转" | "左移" | "软降" | "右移";

import { 游戏外观 } from "../../配置/游戏外观";
import { 下一个方块栏 } from "../../预制体/下一个方块栏";
import { 俄罗斯方块棋盘 } from "../../预制体/俄罗斯方块棋盘";

let 格子大小 = 25;
let 棋盘左侧 = 354;
let 棋盘顶部 = 70;

/** 仅在内容变化时重建文字纹理，避免每帧重绘导致的开销与截图渐裂。 */
function 若变化设置文字(文本: Phaser.GameObjects.Text | undefined, 内容: string): void {
  if (文本 && 文本.text !== 内容) 文本.setText(内容);
}
interface 本地测试接口 {
  设置序列: (序列: 方块类型[]) => void;
  准备单行消除: () => void;
  准备目标达成: () => void;
  准备结算: (完赛: boolean) => void;
  读取界面: () => {
    模式文字: { 文本: string; 可见: boolean };
    操作说明: { 文本: string; 可见: boolean }[];
    快速移动提示: { 文本: string; 可见: boolean };
    目标达成提示: { 文本: string; 可见: boolean };
    手机侧栏纪录间距: number | null;
    结算徽标: { 文本: string; 可见: boolean };
    结算统计: { 标签: string; 数值: string; 可见: boolean }[];
  };
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
  private 音频上次阶段: 俄罗斯方块状态["阶段"] = "进行中";
  private 音频上次消行数 = 0;
  private 音频上次预告方块 = this.状态.下一个方块;
  private 硬降处理中 = false;
  private 绘图?: Phaser.GameObjects.Graphics;
  private 背景图?: Phaser.GameObjects.Graphics;
  private 背景动画层?: Phaser.GameObjects.Graphics;
  private 背景主题: 背景主题 = 获取游戏设置().背景主题;
  private 信息栏?: 界面数值面板;
  private 模式文字?: Phaser.GameObjects.Text;
  private 最佳文字?: Phaser.GameObjects.Text;
  private 状态文字?: Phaser.GameObjects.Text;
  private 提示文字?: Phaser.GameObjects.Text;
  private 状态底衬?: Phaser.GameObjects.Graphics;
  private 结束遮罩图形?: Phaser.GameObjects.Graphics;
  private 结束面板图形?: Phaser.GameObjects.Graphics;
  private 结束徽标文字?: Phaser.GameObjects.Text;
  private 结束分数文字?: Phaser.GameObjects.Text;
  private 结束统计标签: Phaser.GameObjects.Text[] = [];
  private 结束统计数值: Phaser.GameObjects.Text[] = [];
  private 标题文字?: Phaser.GameObjects.Text;
  private 副标题文字?: Phaser.GameObjects.Text;
  private 操作标题?: Phaser.GameObjects.Text;
  private 操作说明: Phaser.GameObjects.Text[] = [];
  private 快速移动提示?: Phaser.GameObjects.Text;
  private 目标达成提示?: Phaser.GameObjects.Text;
  private 目标达成显示至 = 0;
  private 目标达成已显示 = false;
  private 刷新纪录 = false;
  private 最佳标签?: Phaser.GameObjects.Text;
  private 暂停按钮?: 界面按钮;
  private 离开按钮?: 界面按钮;
  private 触屏操作区?: 界面触屏操作区;
  private 预览栏?: 下一个方块栏;
  private 棋盘预制体?: 俄罗斯方块棋盘;
  private 暂停面板?: 界面暂停菜单;
  private 对局设置面板?: 界面对局设置菜单;
  private 对局设置打开 = false;
  private 重开按钮?: 界面按钮;
  private 菜单按钮?: 界面按钮;
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
    this.当前随机源 = 创建模式随机源(this.模式, this.每日日期);
    this.状态 = 创建新局(this.当前随机源, this.测试序列, this.模式);
    this.音频上次阶段 = this.状态.阶段;
    this.音频上次消行数 = this.状态.消行数;
    this.音频上次预告方块 = this.状态.下一个方块;
    this.结束已存档 = false;
    this.结束时刻 = 0;
  }

  create(): void {
    应用文字清晰度(this);
    绑定音频管理器(this.sound);
    播放游戏背景音乐("俄罗斯方块.背景音乐", "对局");
    this.input.on("pointerdown", 解锁程序音频);
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
    this.棋盘预制体 = new 俄罗斯方块棋盘(this);
    this.结束遮罩图形 = this.add.graphics().setDepth(8).setVisible(false);
    this.结束面板图形 = this.add.graphics().setDepth(9).setVisible(false);
    this.绘制装饰();
    this.创建文字();
    this.创建触屏操作区();
    this.预览栏 = new 下一个方块栏(this);
    this.暂停面板 = new 界面暂停菜单(this, {
      继续: () => {
        切换暂停(this.状态);
        this.更新界面();
      },
      重开: () => this.重新开始(),
      返回: () => this.scene.start("开始菜单"),
      设置: () => this.打开对局设置(),
    });
    this.对局设置面板 = new 界面对局设置菜单(this, {
      返回: () => this.返回暂停菜单(),
      预览落点影: (透明度) => {
        this.棋盘预制体?.设置落点影透明度(透明度).更新(this.状态);
      },
    });
    window.addEventListener("keydown", this.处理按键按下);
    window.addEventListener("keyup", this.处理按键松开);
    window.addEventListener("gamemaker:settings-change", this.对局设置已更新);
    this.绑定测试接口();
    this.更新界面();
    this.布局界面();
    this.scale.on("resize", this.布局界面, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off("resize", this.布局界面, this);
      this.input.off("pointerdown", 解锁程序音频);
      window.removeEventListener("keydown", this.处理按键按下);
      window.removeEventListener("keyup", this.处理按键松开);
      window.removeEventListener("gamemaker:settings-change", this.对局设置已更新);
      delete window.__俄罗斯方块测试__;
    });
  }

  private 布局界面 = (): void => {
    const 宽 = this.scale.width;
    const 高 = this.scale.height;
    const 屏幕适配 = 获取游戏设置().屏幕适配;
    this.竖屏布局 = 屏幕适配 === "手机竖屏" || (屏幕适配 === "自动" && 高 > 宽 * 1.05 && 宽 < 1100);
    this.紧凑布局 = 宽 < 820 || this.竖屏布局;
    const 顶部信息底 = 游戏外观.布局.顶部信息底;
    const 操作区顶 = 高 - 游戏外观.布局.操作区顶部间距;
    const 可用棋盘宽 = this.竖屏布局
      ? Math.min(440, 宽 - (宽 < 640 ? 190 : 270))
      : this.紧凑布局
        ? 宽 - 28
        : 宽 - 440;
    const 可用棋盘高 = this.竖屏布局
      ? Math.max(游戏外观.布局.竖屏棋盘最小高度, 操作区顶 - 顶部信息底 - 游戏外观.布局.棋盘上下留白)
      : Math.max(
          游戏外观.布局.竖屏棋盘最小高度,
          高 - 顶部信息底 - (this.紧凑布局 ? 游戏外观.布局.紧凑布局顶部偏移 : 32),
        );
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
    this.棋盘预制体
      ?.布局(
        棋盘左侧,
        棋盘顶部,
        格子大小,
        this.竖屏布局 ? 游戏外观.棋盘.手机面板透明度 : 游戏外观.棋盘.桌面面板透明度,
        获取游戏设置().显示网格,
      )
      .设置落点影透明度(获取游戏设置().落点影透明度);

    this.标题文字
      ?.setText(this.模式)
      .setPosition(宽 / 2, 38)
      .setOrigin(0.5)
      .setFontSize(this.紧凑布局 ? "18px" : "21px");
    this.副标题文字?.setVisible(false);
    this.离开按钮?.setPosition(58, 38);
    this.暂停按钮?.setPosition(宽 - 58, 38);
    this.触屏操作区?.布局(宽, 高, this.竖屏布局);
    this.暂停面板?.布局(宽, 高);
    this.对局设置面板?.布局(宽, 高);

    const 侧栏X = 棋盘左侧 + 棋盘像素宽 + (this.竖屏布局 ? (宽 < 640 ? 10 : 16) : 20);
    const 侧栏顶 = this.竖屏布局 ? 棋盘顶部 - 10 : 棋盘顶部 + 8;
    const 侧栏宽 = this.竖屏布局 ? (宽 < 640 ? 宽 - 侧栏X - 8 : 260) : 228;
    const 侧栏高 = this.竖屏布局 ? 棋盘像素高 + 20 : 棋盘像素高 - 16;
    const 侧栏底 = 侧栏顶 + 侧栏高;
    const 指标X = (比例: number): number => 宽 * 比例;
    this.信息栏
      ?.setPosition(宽 / 2, 游戏外观.布局.信息栏顶部)
      .布局(宽 - 24, 游戏外观.布局.信息栏高度);

    const 棋盘中心X = 棋盘左侧 + 棋盘像素宽 / 2;
    this.模式文字
      ?.setPosition(棋盘中心X, 棋盘顶部 - 12)
      .setOrigin(0.5, 1)
      .setFontSize(this.竖屏布局 ? "11px" : "12px")
      .setVisible(this.模式 !== "马拉松");
    this.最佳标签
      ?.setPosition(
        this.竖屏布局 ? 侧栏X + 侧栏宽 / 2 : this.紧凑布局 ? 指标X(3) : 侧栏X + 16,
        this.竖屏布局 ? 侧栏底 - 62 : this.紧凑布局 ? 棋盘顶部 + 棋盘像素高 + 20 : 侧栏底 - 66,
      )
      .setOrigin(this.紧凑布局 ? 0.5 : 0, 0)
      .setFontSize(this.竖屏布局 ? (宽 < 640 ? "13px" : "14px") : "12px");
    this.最佳文字
      ?.setPosition(
        this.竖屏布局 ? 侧栏X + 侧栏宽 / 2 : this.紧凑布局 ? 指标X(3) : 侧栏X + 16,
        this.竖屏布局 ? 侧栏底 - 32 : this.紧凑布局 ? 棋盘顶部 + 棋盘像素高 + 38 : 侧栏底 - 44,
      )
      .setOrigin(this.紧凑布局 ? 0.5 : 0, 0)
      .setFontSize(this.竖屏布局 ? "18px" : "16px");
    const 显示键位说明 = 获取游戏设置().显示按键说明 && !this.竖屏布局;
    const 键位区X = this.紧凑布局 ? 宽 / 2 : 侧栏X + 16;
    const 键位区顶 = this.紧凑布局 ? 高 - 90 : 侧栏顶 + 196;
    this.操作标题
      ?.setPosition(this.紧凑布局 ? 宽 / 2 : 键位区X, 键位区顶)
      .setOrigin(this.紧凑布局 ? 0.5 : 0, 0)
      .setFontSize(this.紧凑布局 ? "11px" : "13px")
      .setVisible(显示键位说明 && this.状态.阶段 === "进行中");
    const 列位置 = this.紧凑布局 ? [宽 * 0.25, 宽 * 0.75] : [键位区X, 键位区X];
    this.操作说明.forEach((说明, 索引) => {
      说明
        .setPosition(列位置[索引 % 2] ?? 键位区X, 键位区顶 + 22 + Math.floor(索引 / 2) * 19)
        .setOrigin(this.紧凑布局 ? 0.5 : 0, 0)
        .setFontSize(this.紧凑布局 ? "10px" : "12px")
        .setVisible(显示键位说明 && this.状态.阶段 === "进行中");
    });
    this.快速移动提示
      ?.setPosition(this.紧凑布局 ? 宽 / 2 : 键位区X, 键位区顶 + 84)
      .setOrigin(this.紧凑布局 ? 0.5 : 0, 0)
      .setFontSize(this.紧凑布局 ? "10px" : "11px")
      .setVisible(显示键位说明 && this.状态.阶段 === "进行中");
    this.目标达成提示
      ?.setPosition(棋盘中心X, 棋盘顶部 + 棋盘像素高 / 2 - 30)
      .setOrigin(0.5)
      .setFontSize(this.竖屏布局 ? "24px" : "28px");
    this.状态文字?.setPosition(宽 / 2, Math.min(高 - 16, 棋盘顶部 + 棋盘像素高 + 18));
    this.提示文字?.setPosition(棋盘左侧 + 棋盘像素宽 / 2, 棋盘顶部 + 棋盘像素高 / 2 - 30);
    this.重排结算面板(棋盘像素宽, 棋盘像素高, 宽, 高);
    this.暂停按钮?.setVisible(this.状态.阶段 !== "结束");
    this.暂停按钮?.setLabel(this.状态.阶段 === "暂停" ? this.取文案().继续 : this.取文案().暂停);
    this.触屏操作区?.setVisible(this.竖屏布局 && this.状态.阶段 === "进行中");
    this.暂停面板?.setVisible(this.状态.阶段 === "暂停");
    this.应用背景文字对比();
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
    解锁程序音频();
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
    if (事件.code === "ArrowUp") this.操作旋转(1, false);
    if (事件.code === "ArrowDown") this.操作软降();
    if (事件.code === "KeyX") this.操作旋转(-1, false);
    if (事件.code === "KeyZ" && 获取游戏设置().旋转180) {
      this.操作旋转(1, true);
    }
    if (事件.code === "Space") {
      this.硬降处理中 = true;
      const 距离 = 硬降(this.状态, this.当前随机源);
      if (距离 > 0) 播放游戏音效("俄罗斯方块.硬降");
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
    if (移动方块(this.状态, 方向, 0, this.当前随机源)) 播放游戏音效("俄罗斯方块.移动");
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
      if (移动方块(this.状态, 方向, 0, this.当前随机源)) 播放游戏音效("俄罗斯方块.移动");
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
        this.重新开始(true);
      },
      准备单行消除: () => {
        this.测试序列 = ["I", "O"];
        this.重新开始(true);
        const 底行 = this.状态.棋盘.at(-1);
        if (底行) {
          for (let 列 = 0; 列 < 底行.length; 列 += 1) {
            if (列 < 3 || 列 > 6) 底行[列] = "J";
          }
        }
        this.更新界面();
      },
      准备目标达成: () => {
        this.测试序列 = ["I", "O"];
        this.重新开始(true);
        this.状态.消行数 = 139;
        this.状态.等级 = 14;
        this.状态.目标达成 = false;
        this.目标达成已显示 = false;
        const 底行 = this.状态.棋盘.at(-1);
        if (底行) {
          for (let 列 = 0; 列 < 底行.length; 列 += 1) {
            if (列 < 3 || 列 > 6) 底行[列] = "J";
          }
        }
        this.更新界面();
      },
      准备结算: (完赛) => {
        this.状态.阶段 = "结束";
        this.状态.完赛 = 完赛;
        this.状态.有效用时 = 12345;
        this.状态.剩余时间 = 0;
        this.状态.分数 = 4321;
        this.状态.消行数 = this.模式 === "冲刺" && 完赛 ? 40 : 13;
        this.状态.等级 = 5;
        this.状态.最长连击 = 3;
        this.结束已存档 = false;
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
      读取界面: () => {
        const 读取文字 = (文字?: Phaser.GameObjects.Text) => ({
          文本: 文字?.text ?? "",
          可见: Boolean(文字?.visible),
        });
        return {
          模式文字: 读取文字(this.模式文字),
          操作说明: this.操作说明.map((文字) => 读取文字(文字)),
          快速移动提示: 读取文字(this.快速移动提示),
          目标达成提示: 读取文字(this.目标达成提示),
          手机侧栏纪录间距:
            this.竖屏布局 && this.scale.width < 640
              ? (() => {
                  const 侧栏顶 = 棋盘顶部 - 10;
                  const 预览高度 = 可见高度 * 格子大小 + 4;
                  const 单卡高度 = Math.max(40, (预览高度 - 28 - 92 - 24) / 3);
                  const 最后一张卡底 = 侧栏顶 + 28 + 单卡高度 * 3 + 游戏外观.方块.预览格间距 * 2;
                  return (this.最佳标签?.y ?? 最后一张卡底) - 最后一张卡底;
                })()
              : null,
          结算徽标: 读取文字(this.结束徽标文字),
          结算统计: this.结束统计标签.map((标签, 索引) => ({
            标签: 标签.text,
            数值: this.结束统计数值[索引]?.text ?? "",
            可见: Boolean(标签.visible && this.结束统计数值[索引]?.visible),
          })),
        };
      },
    };
  }

  private 是本地开发地址(): boolean {
    return ["localhost", "127.0.0.1", "[::1]"].includes(window.location.hostname);
  }

  private 取文案(): ReturnType<typeof 获取文案> {
    return 获取文案(解析语言(获取游戏设置().语言));
  }

  private 取模式名(): string {
    const 文案 = this.取文案();
    if (this.操作说明[2]) {
      若变化设置文字(this.操作说明[2], 获取游戏设置().旋转180 ? 文案.操作半转 : 文案.操作半转关闭);
    }
    return this.模式 === "马拉松"
      ? 文案.模式马拉松
      : this.模式 === "冲刺"
        ? 文案.模式冲刺
        : this.模式 === "极限"
          ? 文案.模式极限
          : 文案.模式每日挑战;
  }

  private 重新开始(强制 = false): void {
    if (!强制 && 是否使用马拉松结算重开锁(this.模式) && Date.now() - this.结束时刻 < 3000) return;
    // 每日挑战每局重新取当日种子，保证同日重开方块序列完全一致
    this.当前随机源 = 创建模式随机源(this.模式, this.每日日期);
    this.状态 = 创建新局(this.当前随机源, this.测试序列, this.模式);
    this.测试序列 = [];
    // 新一局结束时要重新存档，并重新起算结算 3 秒重开锁
    this.结束已存档 = false;
    this.结束时刻 = 0;
    this.刷新纪录 = false;
    this.目标达成显示至 = 0;
    this.目标达成已显示 = false;
    this.按住按键.clear();
    this.重置计时器();
    this.重置横移(this.左移输入);
    this.重置横移(this.右移输入);
    this.更新界面();
  }

  /** 直接压在背景上的文字：按当前背景主题切换配色并加描边光晕。 */
  private 应用背景文字对比(): void {
    const 配色 = 背景文字配色(this.背景主题);
    if (this.标题文字) {
      this.标题文字.setColor(配色.主字);
      应用背景文字样式(this.标题文字, this.背景主题, this.紧凑布局 ? 18 : 21);
    }
    if (this.状态文字) {
      this.状态文字.setColor(配色.次字);
      应用背景文字样式(this.状态文字, this.背景主题, 13);
      this.绘制状态底衬();
    }
  }

  /** 状态提示压在背景上，加主题自适应半透明底衬避免混色。 */
  private 绘制状态底衬(): void {
    const 文本 = this.状态文字;
    if (!文本) return;
    this.状态底衬?.destroy();
    const 浅底 = 背景基调(this.背景主题) === "浅底";
    const x = 文本.x - 文本.width / 2 - 14;
    const y = 文本.y - 文本.height / 2 - 6;
    this.状态底衬 = this.add
      .graphics()
      .setDepth(-1)
      .fillStyle(浅底 ? 0xf2f8ff : 0x060b16, 浅底 ? 0.55 : 0.45)
      .fillRoundedRect(x, y, 文本.width + 28, 文本.height + 12, 10)
      .lineStyle(1, 浅底 ? 0xffffff : 0x2c3f66, 0.35)
      .strokeRoundedRect(x, y, 文本.width + 28, 文本.height + 12, 10);
  }

  private 创建文字(): void {
    this.标题文字 = this.add.text(0, 0, "NEON PULSE", {
      fontFamily: "Arial, sans-serif",
      fontSize: "25px",
      fontStyle: "bold",
      color: "#E7F7FF",
      letterSpacing: 2,
    });
    this.副标题文字 = this.add.text(0, 0, this.取文案().对局副标题, {
      fontFamily: "Arial, sans-serif",
      fontSize: "13px",
      color: "#7D91B7",
    });
    this.操作标题 = this.add.text(0, 0, this.取文案().操作标题, {
      fontSize: "14px",
      color: "#00E5FF",
      fontStyle: "bold",
    });
    this.操作说明 = [
      this.取文案().操作移动,
      this.取文案().操作旋转,
      this.取文案().操作半转,
      this.取文案().操作软降,
      this.取文案().操作硬降,
      this.取文案().操作暂停,
    ].map((文案) => this.add.text(0, 0, 文案, { fontSize: "15px", color: "#B5C4E2" }));
    this.操作说明[2]?.setText(
      获取游戏设置().旋转180 ? this.取文案().操作半转 : this.取文案().操作半转关闭,
    );
    this.快速移动提示 = this.add.text(0, 0, this.取文案().快速移动提示, {
      fontSize: "12px",
      color: "#627392",
    });
    this.目标达成提示 = this.add
      .text(0, 0, this.取文案().目标达成, {
        fontSize: "28px",
        color: "#FFEE58",
        fontStyle: "bold",
        backgroundColor: "#111c2c",
        padding: { x: 14, y: 8 },
      })
      .setOrigin(0.5)
      .setDepth(7)
      .setVisible(false);

    this.信息栏 = new 界面数值面板(
      this,
      this.scale.width / 2,
      游戏外观.布局.信息栏顶部,
      this.scale.width - 24,
      游戏外观.布局.信息栏高度,
      [
        { 标题: this.取文案().面板等级, 数值: "1", 强调色: "#FFEE58" },
        { 标题: this.取文案().面板分数, 数值: "000000", 强调色: "#F4F8FF" },
        { 标题: this.取文案().面板消行, 数值: "0", 强调色: "#00E5FF" },
      ],
      {
        面板色: "#0d1428",
        边框色: "#31435d",
        标签色: "#8293B3",
        字体: 游戏外观.字体.家族,
      },
    );
    this.模式文字 = this.add.text(0, 0, "", { fontSize: "12px", color: "#00E5FF" });
    this.最佳标签 = this.add.text(0, 0, this.取文案().最佳纪录, {
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
        fontStyle: "bold",
        color: "#7586A5",
        align: "center",
      })
      .setOrigin(0.5);
    this.应用背景文字对比();
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
    this.结束徽标文字 = this.add
      .text(0, 0, this.取文案().本局结算, {
        fontSize: "12px",
        fontStyle: "bold",
        color: "#65E6DC",
        align: "center",
      })
      .setOrigin(0.5)
      .setDepth(10)
      .setVisible(false);
    this.结束分数文字 = this.add
      .text(0, 0, "000000", {
        fontFamily: "Arial, sans-serif",
        fontSize: "34px",
        fontStyle: "bold",
        color: "#65E6DC",
        align: "center",
      })
      .setOrigin(0.5)
      .setDepth(10)
      .setVisible(false);
    this.结束统计标签 = [
      this.取文案().消除行数,
      this.取文案().最高等级,
      this.取文案().最佳连击,
    ].map((标签) =>
      this.add
        .text(0, 0, 标签, { fontSize: "11px", color: "#9BAAC1", align: "center" })
        .setOrigin(0.5)
        .setDepth(10)
        .setVisible(false),
    );
    this.结束统计数值 = ["0", "1", "0"].map((值) =>
      this.add
        .text(0, 0, 值, { fontSize: "18px", fontStyle: "bold", color: "#F3F6FC", align: "center" })
        .setOrigin(0.5)
        .setDepth(10)
        .setVisible(false),
    );
    const 界面按钮样式 = {
      面板色: 游戏外观.按钮.面板,
      强调色: 游戏外观.按钮.边框,
      文字色: 游戏外观.按钮.文字,
      面板透明度: 游戏外观.按钮.面板透明度,
      边框透明度: 游戏外观.按钮.边框透明度,
    };
    this.重开按钮 = new 界面按钮(this, 0, 0, {
      宽: 184,
      高: 48,
      文案: this.取文案().重新开始,
      name: "restart",
      ...界面按钮样式,
      强调色: "#00e5ff",
      文字色: "#D8FBFF",
      字号: `${游戏外观.字体.按钮}px`,
      已选: true,
      点击: () => this.重新开始(),
    })
      .setDepth(11)
      .setVisible(false);
    this.菜单按钮 = new 界面按钮(this, 0, 0, {
      宽: 184,
      高: 42,
      文案: this.取文案().返回主菜单,
      name: "main-menu",
      ...界面按钮样式,
      字号: `${游戏外观.字体.辅助 + 2}px`,
      点击: () => this.scene.start("开始菜单"),
    })
      .setDepth(11)
      .setVisible(false);
    this.离开按钮 = new 界面按钮(this, 58, 38, {
      宽: 78,
      高: 38,
      文案: this.取文案().离开,
      name: "game.leave",
      ...界面按钮样式,
      字号: `${游戏外观.字体.辅助 + 1}px`,
      点击: () => this.scene.start("开始菜单"),
    });
    this.暂停按钮 = new 界面按钮(this, 0, 38, {
      宽: 78,
      高: 38,
      文案: this.取文案().暂停,
      name: "game.pause",
      ...界面按钮样式,
      字号: `${游戏外观.字体.辅助 + 1}px`,
      点击: () => {
        if (this.状态.阶段 !== "结束") {
          切换暂停(this.状态);
          this.更新界面();
        }
      },
    });
  }

  private 创建触屏操作区(): void {
    const 操作区 = new 界面触屏操作区(
      this,
      [
        { 键: "左转", 文案: "↺", name: "touch.rotate-left" },
        { 键: "旋转", 文案: "↑", name: "touch.rotate" },
        { 键: "右转", 文案: "↻", name: "touch.rotate-right" },
        { 键: "左移", 文案: "←", name: "touch.left" },
        { 键: "软降", 文案: "↓", name: "touch.soft-drop" },
        { 键: "右移", 文案: "→", name: "touch.right" },
      ],
      {
        面板色: 游戏外观.按钮.面板,
        强调色: 游戏外观.按钮.边框,
        文字色: 游戏外观.按钮.文字,
        字号: `${游戏外观.字体.操作图标}px`,
      },
    );
    this.触屏操作区 = 操作区;
    操作区.on("control-down", (操作: 触屏操作) => {
      if (this.状态.阶段 !== "进行中") return;
      if (操作 === "左移" || 操作 === "右移") {
        const 方向 = 操作 === "左移" ? -1 : 1;
        this.按住按键.add(方向 < 0 ? "ArrowLeft" : "ArrowRight");
        this.开始横移(方向);
      } else if (操作 === "左转" || 操作 === "旋转" || 操作 === "右转") {
        if (操作 === "右转" && !获取游戏设置().旋转180) return;
        this.操作旋转(操作 === "左转" ? -1 : 1, 操作 === "右转");
        this.更新界面();
      } else if (操作 === "软降") {
        this.按住按键.add("ArrowDown");
        this.操作软降();
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
      .fillStyle(0x050914, this.竖屏布局 ? 0.22 : 0.16)
      .fillRect(0, 0, this.scale.width, this.scale.height);
    if (this.竖屏布局) {
      const 侧栏X = 棋盘左侧 + 棋盘像素宽 + (this.scale.width < 640 ? 10 : 16);
      const 侧栏宽 = this.scale.width < 640 ? this.scale.width - 侧栏X - 8 : 260;
      const 侧栏顶 = 棋盘顶部 - 10;
      const 侧栏高 = 棋盘像素高 + 20;
      绘制玻璃面板(绘图, 侧栏X, 侧栏顶, 侧栏宽, 侧栏高, {
        圆角: 14,
        填色: 0x0d1529,
        透明度: 0.72,
        边色: 0x2c3f66,
        边透明度: 0.65,
      });
      绘图.fillStyle(0x2c3f66, 0.6).fillRect(侧栏X + 10, 侧栏顶 + 侧栏高 - 94, 侧栏宽 - 20, 1);
    } else if (!this.紧凑布局) {
      const 侧栏X = 棋盘左侧 + 棋盘像素宽 + 20;
      const 侧栏顶 = 棋盘顶部 + 8;
      const 侧栏高 = 棋盘像素高 - 16;
      绘制玻璃面板(绘图, 侧栏X, 侧栏顶, 228, 侧栏高, {
        圆角: 18,
        填色: 0x0d1529,
        透明度: 0.88,
        边色: 0x2c3f66,
        边透明度: 0.6,
        强调色: 0x2b6f86,
      });
      // 分隔线：三段渐变、两端渐隐，不形成横向接缝；位于记录页脚上方
      const 线X = 侧栏X + 16;
      const 线宽 = 196;
      const 线Y = 侧栏顶 + 侧栏高 - 84;
      绘图
        .fillGradientStyle(0x2c3f66, 0x2c3f66, 0x2c3f66, 0x2c3f66, 0, 0.32, 0, 0.32)
        .fillRect(线X, 线Y, 线宽 * 0.35, 1)
        .fillStyle(0x2c3f66, 0.32)
        .fillRect(线X + 线宽 * 0.35, 线Y, 线宽 * 0.3, 1)
        .fillGradientStyle(0x2c3f66, 0x2c3f66, 0x2c3f66, 0x2c3f66, 0.32, 0, 0.32, 0)
        .fillRect(线X + 线宽 * 0.65, 线Y, 线宽 * 0.35, 1);
    }
  };

  private 重排结算面板(
    棋盘像素宽: number,
    棋盘像素高: number,
    视口宽: number,
    视口高: number,
  ): void {
    const 中心X = 棋盘左侧 + 棋盘像素宽 / 2;
    const 中心Y = 棋盘顶部 + 棋盘像素高 / 2;
    const 面板宽 = Math.min(视口宽 - 24, Math.max(220, Math.min(360, 棋盘像素宽 - 16)));
    const 面板高 = Math.min(340, Math.max(300, 视口高 - 80));
    const 顶部 = 中心Y - 面板高 / 2;
    this.提示文字?.setPosition(中心X, 顶部 + 82).setFontSize(this.竖屏布局 ? "25px" : "28px");
    this.结束徽标文字?.setPosition(中心X, 顶部 + 34);
    this.结束分数文字?.setPosition(中心X, 顶部 + 132).setFontSize(this.竖屏布局 ? "30px" : "34px");
    const 面板左 = 棋盘左侧 + (棋盘像素宽 - 面板宽) / 2;
    const 列宽 = 面板宽 / 3;
    this.结束统计标签.forEach((文字, 索引) => {
      文字.setPosition(面板左 + 列宽 * (索引 + 0.5), 顶部 + 178);
    });
    this.结束统计数值.forEach((文字, 索引) => {
      文字.setPosition(棋盘左侧 + 列宽 * (索引 + 0.5), 顶部 + 207);
    });
    const 按钮宽 = Math.min(面板宽 - 36, 236);
    this.重开按钮?.设置布局尺寸(按钮宽, 44).setPosition(中心X, 顶部 + 258);
    this.菜单按钮?.设置布局尺寸(按钮宽, 38).setPosition(中心X, 顶部 + 306);
  }

  private 绘制结算面板(): void {
    const 已结束 = this.状态.阶段 === "结束";
    const 遮罩 = this.结束遮罩图形;
    const 面板 = this.结束面板图形;
    遮罩?.setVisible(已结束).clear();
    面板?.setVisible(已结束).clear();
    for (const 文字 of [
      this.结束徽标文字,
      this.结束分数文字,
      ...this.结束统计标签,
      ...this.结束统计数值,
    ]) {
      文字?.setVisible(已结束);
    }
    if (!已结束 || !遮罩 || !面板) return;

    const 棋盘宽 = 棋盘宽度 * 格子大小;
    const 棋盘高 = 可见高度 * 格子大小;
    const 面板宽 = Math.min(this.scale.width - 24, Math.max(220, Math.min(360, 棋盘宽 - 16)));
    const 面板高 = Math.min(340, Math.max(300, this.scale.height - 80));
    const 左 = 棋盘左侧 + (棋盘宽 - 面板宽) / 2;
    const 顶 = 棋盘顶部 + (棋盘高 - 面板高) / 2;
    遮罩.fillStyle(0x04070f, 0.56).fillRect(0, 0, this.scale.width, this.scale.height);
    绘制玻璃面板(面板, 左, 顶, 面板宽, 面板高, {
      圆角: 20,
      填色: 0x111c2c,
      透明度: 0.98,
      边色: 0x526b88,
      边透明度: 0.85,
      强调色: 0x65e6dc,
      高光: true,
    });
    面板
      .fillStyle(0x65e6dc, 0.9)
      .fillRoundedRect(左 + 面板宽 / 2 - 64, 顶 + 12, 128, 4, 2)
      .lineStyle(1, 0x31435d, 0.9)
      .lineBetween(左 + 18, 顶 + 158, 左 + 面板宽 - 18, 顶 + 158);
    const 列宽 = 面板宽 / 3;
    for (let 索引 = 1; 索引 < 3; 索引 += 1) {
      面板.lineBetween(左 + 列宽 * 索引, 顶 + 170, 左 + 列宽 * 索引, 顶 + 220);
    }
    若变化设置文字(this.结束徽标文字, this.取结算徽标文案());
    若变化设置文字(this.提示文字, this.状态.完赛 ? this.取文案().挑战完成 : this.取文案().游戏结束);
    若变化设置文字(this.结束分数文字, this.状态.分数.toLocaleString());
    const 文案 = this.取文案();
    const 统计 =
      this.模式 === "冲刺"
        ? [
            [文案.有效用时, `${(this.状态.有效用时 / 1000).toFixed(2)}s`],
            [文案.消除行数, String(this.状态.消行数)],
            [文案.历史最佳, this.读取最佳文案()],
          ]
        : this.模式 === "极限"
          ? [
              [`${文案.最高等级} / ${文案.消除行数}`, `${this.状态.等级} / ${this.状态.消行数}`],
              [文案.有效用时, `${(this.状态.有效用时 / 1000).toFixed(2)}s`],
              [文案.历史最佳, this.读取最佳文案()],
            ]
          : [
              [文案.消除行数, String(this.状态.消行数)],
              [文案.最高等级, String(this.状态.等级)],
              [文案.最佳连击, String(this.状态.最长连击)],
            ];
    this.结束统计标签.forEach((文字, 索引) => {
      若变化设置文字(文字, 统计[索引]?.[0] ?? "");
    });
    this.结束统计数值.forEach((文字, 索引) => {
      若变化设置文字(文字, 统计[索引]?.[1] ?? "0");
    });
  }

  private 取结算徽标文案(): string {
    const 文案 = this.取文案();
    const 模式 = this.取模式名();
    if (this.模式 === "冲刺") {
      if (!this.状态.完赛) return `${模式} · ${文案.未完赛}`;
      return `${模式} · ${文案.挑战完成} · ${this.刷新纪录 ? 文案.纪录刷新 : 文案.纪录未刷新}`;
    }
    if (this.模式 === "极限") {
      return `${模式} · ${this.刷新纪录 ? 文案.纪录刷新 : 文案.纪录未刷新}`;
    }
    return `${模式} · ${this.状态.完赛 ? 文案.挑战完成 : 文案.本局结算}`;
  }

  private 绘制下一个方块(): void {
    const 宽 = this.scale.width;
    const 棋盘像素宽 = 棋盘宽度 * 格子大小;
    const 棋盘像素高 = 可见高度 * 格子大小;
    const 侧栏X = 棋盘左侧 + 棋盘像素宽 + (this.竖屏布局 ? (宽 < 640 ? 10 : 16) : 20);
    const 侧栏顶 = this.竖屏布局 ? 棋盘顶部 - 10 : 棋盘顶部 + 8;
    const 侧栏宽 = this.竖屏布局 ? (宽 < 640 ? 宽 - 侧栏X - 8 : 260) : 228;
    const 布局 = this.竖屏布局
      ? {
          类型: "手机" as const,
          视口宽: 宽,
          左: 侧栏X,
          顶: 侧栏顶,
          宽: 侧栏宽,
          // 给侧栏底部最佳纪录留出间距，避免它紧贴第三张预测卡片。
          高: 棋盘像素高 + 4,
        }
      : this.紧凑布局
        ? { 类型: "紧凑" as const, 视口宽: 宽, 左: 0, 顶: 146, 宽: 0, 高: 0 }
        : {
            类型: "桌面" as const,
            视口宽: 宽,
            左: 侧栏X,
            顶: 侧栏顶,
            宽: 侧栏宽,
            高: 棋盘像素高 - 16,
          };
    this.预览栏?.显示([this.状态.下一个方块, ...this.状态.后续方块], 布局);
  }

  private 打开对局设置(): void {
    if (this.状态.阶段 !== "暂停") return;
    this.对局设置打开 = true;
    this.暂停面板?.setVisible(false);
    this.对局设置面板?.打开();
  }

  private 返回暂停菜单(): void {
    this.对局设置打开 = false;
    this.对局设置面板?.setVisible(false);
    this.暂停面板?.setVisible(this.状态.阶段 === "暂停");
  }

  private readonly 对局设置已更新 = (): void => {
    const 设置 = 获取游戏设置();
    this.棋盘预制体?.设置落点影透明度(设置.落点影透明度).设置网格显示(设置.显示网格);
    this.布局界面();
  };

  private 更新界面(): void {
    if (!this.绘图) return;
    this.同步程序音频();
    this.绘制装饰();
    this.棋盘预制体?.更新(this.状态);
    this.绘制下一个方块();
    this.信息栏?.更新([
      String(this.状态.等级),
      String(this.状态.分数).padStart(6, "0"),
      String(this.状态.消行数),
    ]);
    const 文案 = this.取文案();
    const 模式名 =
      this.模式 === "马拉松"
        ? ""
        : this.模式 === "冲刺"
          ? `40L · ${(this.状态.有效用时 / 1000).toFixed(2)}s`
          : this.模式 === "极限"
            ? `${Math.ceil(this.状态.剩余时间 / 1000)}s`
            : this.每日日期;
    若变化设置文字(this.模式文字, 模式名);
    this.模式文字?.setVisible(this.模式 !== "马拉松");
    若变化设置文字(this.最佳文字, this.读取最佳文案());
    const 显示键位说明 =
      获取游戏设置().显示按键说明 && !this.竖屏布局 && this.状态.阶段 === "进行中";
    this.操作标题?.setVisible(显示键位说明);
    for (const 说明 of this.操作说明) 说明.setVisible(显示键位说明);
    this.快速移动提示?.setVisible(显示键位说明);
    if (this.模式 === "马拉松" && this.状态.目标达成 && !this.目标达成已显示) {
      this.目标达成已显示 = true;
      this.目标达成显示至 = this.time.now + 2200;
    }
    this.目标达成提示?.setVisible(this.目标达成显示至 > this.time.now);
    this.暂停按钮?.setVisible(this.状态.阶段 !== "结束");
    this.暂停按钮?.setLabel(this.状态.阶段 === "暂停" ? 文案.继续 : 文案.暂停);
    const 显示触屏按钮 = this.竖屏布局 && this.状态.阶段 === "进行中";
    this.触屏操作区?.setVisible(显示触屏按钮);
    const 暂停中 = this.状态.阶段 === "暂停";
    if (!暂停中) this.对局设置打开 = false;
    this.暂停面板?.setVisible(暂停中 && !this.对局设置打开);
    this.对局设置面板?.setVisible(暂停中 && this.对局设置打开);
    若变化设置文字(
      this.提示文字,
      this.状态.阶段 === "暂停" ? 文案.已暂停 : this.状态.完赛 ? 文案.挑战完成 : 文案.游戏结束,
    );
    this.提示文字?.setVisible(this.状态.阶段 !== "进行中");
    若变化设置文字(this.状态文字, 文案.按P或Esc继续);
    this.状态文字?.setVisible(this.状态.阶段 === "暂停");
    this.重开按钮?.setVisible(this.状态.阶段 === "结束");
    this.菜单按钮?.setVisible(this.状态.阶段 === "结束");
    if (this.状态.阶段 === "结束" && !this.结束已存档) this.保存纪录();
    this.绘制结算面板();
    this.发布测试快照();
  }

  private 操作旋转(方向: 1 | -1, 半转: boolean): void {
    const 成功 = 旋转方块(this.状态, 方向, 半转, this.当前随机源);
    if (成功) 播放游戏音效("俄罗斯方块.旋转");
  }

  private 操作软降(): void {
    if (软降一步(this.状态, this.当前随机源)) 播放游戏音效("俄罗斯方块.软降");
  }

  private 同步程序音频(): void {
    if (this.状态.消行数 > this.音频上次消行数) {
      播放游戏音效("俄罗斯方块.消行", this.状态.消行数 - this.音频上次消行数);
    } else if (
      this.状态.下一个方块 !== this.音频上次预告方块 &&
      this.音频上次阶段 === "进行中" &&
      this.状态.阶段 === "进行中" &&
      !this.硬降处理中
    ) {
      播放游戏音效("俄罗斯方块.锁定");
    }
    if (this.状态.阶段 !== this.音频上次阶段) {
      if (this.状态.阶段 === "暂停") {
        播放游戏音效("俄罗斯方块.暂停");
        设置俄罗斯方块音乐暂停(true);
      } else if (this.状态.阶段 === "进行中") {
        播放游戏音效("俄罗斯方块.继续");
        设置俄罗斯方块音乐暂停(false);
      } else {
        播放游戏音效("俄罗斯方块.结束");
        设置俄罗斯方块音乐暂停(true);
      }
    }
    this.音频上次阶段 = this.状态.阶段;
    this.音频上次消行数 = this.状态.消行数;
    this.音频上次预告方块 = this.状态.下一个方块;
    this.硬降处理中 = false;
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
      this.刷新纪录 = better;
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
    const 文案 = this.取文案();
    const key =
      this.模式 === "每日挑战"
        ? `neon-pulse:daily:${this.每日日期}`
        : `neon-pulse:best:${this.模式}`;
    try {
      const record = JSON.parse(localStorage.getItem(key) ?? "null") as {
        分数?: number;
        用时?: number | null;
      } | null;
      if (!record) return 文案.暂无纪录;
      if (this.模式 === "冲刺")
        return typeof record.用时 === "number"
          ? `${(record.用时 / 1000).toFixed(2)}s`
          : 文案.暂无完赛纪录;
      return `${(record.分数 ?? 0).toLocaleString()} pts`;
    } catch {
      return 文案.暂无纪录;
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
