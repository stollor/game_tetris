import Phaser from "phaser";
import { 适配场景视口 } from "../../../框架/界面/响应式视口";
import type { 界面按钮 } from "../../../框架/界面/按钮";
import type { 界面数值面板 } from "../../../框架/界面/数值面板";
import { 应用文字清晰度 } from "../../../框架/界面/文字清晰度";
import { 界面暂停菜单 } from "../../../框架/界面/暂停菜单";
import { 界面触屏操作区 } from "../../../框架/界面/触屏操作区";
import { 注册模态界面 } from "../../../框架/界面/输入隔离";
import { 创建节流音效 } from "../../../框架/音频/音效节流";
import {
  播放游戏音效,
  绑定音频管理器,
  解锁程序音频,
  读取游戏音频状态,
} from "../../../框架/音频/音频";
import { 创建纪录存档, 是否刷新纪录 } from "../../存档/对局纪录";
import { type 对局奖励输入, 执行收藏操作, 旅行日期 } from "../../存档/旅行收藏";
import { 同步平台成就并回报 } from "../../平台/平台成就";
import { 结算后同步平台 } from "../../平台/结算同步";
import { 禁用性能项 } from "../../开发/性能开关";
import { 标记重绘, 设置玩法进行中 } from "../../性能/按需渲染";
import { 是省电模式 } from "../../性能/画质";
import { 获取冲刺显示用时 } from "../../性能/计时显示";
import { 创建再消一行成就, 成就定义, 记录落块成就 } from "../../成就/再消一行成就";
import { 同步成就金币 } from "../../成就/旅行奖励";
import {
  type 再消一行状态,
  切换暂停,
  创建新局,
  创建模式随机源,
  可见高度,
  type 方块类型,
  旋转方块,
  是否使用马拉松结算重开锁,
  暂存换块,
  更新时钟,
  棋盘宽度,
  type 游戏模式,
  硬降,
  移动方块,
  读取格子,
  软降一步,
} from "../../玩法/再消一行";
import { 获取技巧反馈 } from "../../视觉/技巧反馈";
import { 绘制动态霓虹细节 } from "../../视觉/霓虹背景";
import { 布置烘焙底图 } from "../../视觉/风景缩略";
import { 获取文案, 解析语言 } from "../../配置/再消一行文案";
import { type 背景主题, 获取游戏设置 } from "../../配置/再消一行设置";
import { 界面主题, 颜色值 } from "../../配置/界面主题";
import { 播放再消一行音乐, 播放场景氛围, 设置再消一行音乐暂停 } from "../../音频/再消一行程序音频";
import { 结算音效名称 } from "../../音频/结算音效";
import { 界面对局设置菜单 } from "../../预制体/对局设置菜单";
import { 暂存方块栏 } from "../../预制体/暂存方块栏";
import { 新对局编号 } from "./对局编号";

type 触屏操作 = "左转" | "旋转" | "右转" | "左移" | "软降" | "右移";

import type { 霓虹纪录页脚 } from "../../../组件/霓虹街机/对局侧栏";
import { 创建霓虹按钮 } from "../../../组件/霓虹街机/按钮";
import type { 霓虹操作说明卡 } from "../../../组件/霓虹街机/操作说明卡";
import type { 霓虹结算面板 } from "../../../组件/霓虹街机/结算面板";
import { 创建对局纪录页脚, 绘制霓虹侧栏 } from "../../界面/对局侧栏";
import { 创建对局信息栏, 创建对局模式文字 } from "../../界面/对局顶栏";
import { 创建对局操作说明 } from "../../界面/操作说明卡";
import { 创建对局结算面板 } from "../../界面/结算面板";
import { 游戏外观 } from "../../配置/游戏外观";
import { 下一个方块栏 } from "../../预制体/下一个方块栏";
import { 再消一行棋盘 } from "../../预制体/再消一行棋盘";

let 格子大小 = 25;
let 棋盘左侧 = 354;
let 棋盘顶部 = 70;

/** 仅在内容变化时重建文字纹理，避免每帧重绘导致的开销与截图渐裂。 */
function 若变化设置文字(
  文本: Phaser.GameObjects.Text | Phaser.GameObjects.BitmapText | undefined,
  内容: string,
): void {
  if (文本 && 文本.text !== 内容) 文本.setText(内容);
}
interface 本地测试接口 {
  读取音频: () => {
    游戏: ReturnType<typeof 获取游戏设置>;
    框架: ReturnType<typeof 读取游戏音频状态>;
  };
  设置暂停: (暂停: boolean) => void;
  硬降: () => void;
  结束当前对局: () => void;
  设置序列: (序列: 方块类型[]) => void;
  准备单行消除: () => void;
  准备四行消除: (继续连击?: boolean, 保留堆叠?: boolean) => void;
  准备目标达成: () => void;
  准备结算: (完赛: boolean) => void;
  读取界面: () => {
    视口: { 宽: number; 高: number; 比例: number };
    棋盘: { 左: number; 顶: number; 宽: number; 高: number };
    样式: string;
    界面配色: { 分数?: string; 纪录?: string; 结算?: string };
    落块特效?: { 硬降拖尾: boolean; 锁定闪光: boolean };
    技巧反馈: string;
    震屏?: { 剩余: number; 强度: number; x: number; y: number };
    音效事件: { 名称: string; 参数: number }[];
    消行特效?: { 活跃: boolean; 行: number[]; 碎片数: number; 时间: number; 四行庆祝: boolean };
    模式文字: { 文本: string; 可见: boolean };
    操作说明: { 文本: string; 可见: boolean }[];
    快速移动提示: { 文本: string; 可见: boolean };
    目标达成提示: { 文本: string; 可见: boolean };
    手机侧栏纪录间距: number | null;
    结算徽标: { 文本: string; 可见: boolean };
    结算统计: { 标签: string; 数值: string; 可见: boolean }[];
  };
  读取状态: () => {
    阶段: 再消一行状态["阶段"];
    分数: number;
    有效用时: number;
    暂存方块: 方块类型 | null;
    本块已暂存: boolean;
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
    __再消一行测试__?: 本地测试接口;
  }
}

interface 横移输入 {
  按住毫秒: number;
  下次横移毫秒: number;
}

export class 对局 extends Phaser.Scene {
  private 对局编号 = 新对局编号();
  private 本局落块数 = 0;
  private 奖励文案 = "";
  private 金币奖励?: { 新增: number; 总额: number; 原因: string; 编号: string };
  private 待领奖励?: 对局奖励输入;
  private 领奖中 = false;
  private 视口 = { 宽: 0, 高: 0, 比例: 1 };
  private 状态 = 创建新局();
  private readonly 成就 = 创建再消一行成就();
  private 成就提示?: Phaser.GameObjects.Text;
  private 成就提示剩余 = 0;
  private 音效参数 = 1;
  private 测试音效事件: { 名称: string; 参数: number }[] = [];
  private readonly 对局音效 = 创建节流音效({
    前缀: "再消一行",
    手动间隔毫秒: 55,
    自动间隔毫秒: 100,
    自动避让手动毫秒: 45,
    自动避让重要毫秒: 120,
    解锁: 解锁程序音频,
    播放: (名称) => {
      if (this.是本地开发地址()) {
        this.测试音效事件.push({ 名称, 参数: this.音效参数 });
        if (this.测试音效事件.length > 32) this.测试音效事件.shift();
      }
      播放游戏音效(名称, this.音效参数);
    },
  });
  private readonly 解锁对局音频 = () => this.对局音效.解锁();
  private 播放对局音效(名称: string, 参数 = 1): void {
    this.音效参数 = 参数;
    this.对局音效.播放(
      名称,
      名称 === "移动" || 名称 === "软降" ? "手动" : 名称 === "锁定" ? "自动" : "重要",
    );
  }
  private 音频上次阶段: 再消一行状态["阶段"] = "进行中";
  private 音频上次消行数 = 0;
  private 硬降处理中 = false;
  private 硬降按钮?: 界面按钮;
  private 暂存栏?: 暂存方块栏;
  private 上次落块反馈 = 0;
  private 消行反馈?: Phaser.GameObjects.Text;
  private 重开锁可用?: boolean;
  private 绘图?: Phaser.GameObjects.Graphics;
  private 背景图?: Phaser.GameObjects.Image | Phaser.GameObjects.Graphics;
  private 背景动画层?: Phaser.GameObjects.Graphics;
  private 背景主题: 背景主题 = 获取游戏设置().背景主题;
  private 信息栏?: 界面数值面板;
  private 模式文字?: Phaser.GameObjects.Text | Phaser.GameObjects.BitmapText;
  private 最佳纪录缓存?: string;
  private 状态文字?: Phaser.GameObjects.Text;
  private 提示文字?: Phaser.GameObjects.Text;
  private 状态底衬?: Phaser.GameObjects.Graphics;
  private 结算输入层?: Phaser.GameObjects.Container;
  private 结算输入遮罩?: Phaser.GameObjects.Rectangle;
  private 结算面板?: 霓虹结算面板;
  private 标题文字?: Phaser.GameObjects.Text;
  private 操作说明卡?: 霓虹操作说明卡;
  private 目标达成提示?: Phaser.GameObjects.Text;
  private 目标达成显示至 = 0;
  private 目标达成已显示 = false;
  private 刷新纪录 = false;
  private 纪录页脚?: 霓虹纪录页脚;
  private 暂停按钮?: 界面按钮;
  private 离开按钮?: 界面按钮;
  private 触屏操作区?: 界面触屏操作区;
  private 预览栏?: 下一个方块栏;
  private 棋盘预制体?: 再消一行棋盘;
  private 暂停面板?: 界面暂停菜单;
  private 对局设置面板?: 界面对局设置菜单;
  private 对局设置打开 = false;
  private 结束已存档 = false;
  private 结束时刻 = 0;
  private 左移输入: 横移输入 = { 按住毫秒: 0, 下次横移毫秒: 200 };
  private 右移输入: 横移输入 = { 按住毫秒: 0, 下次横移毫秒: 200 };
  private 测试序列: 方块类型[] = [];
  private 按住按键 = new Set<string>();
  private 上键按住毫秒 = 0;
  private 上键长按已触发 = false;
  private 上次手机下键抬起 = -Infinity;
  private 手机下键按下 = 0;
  private 手机下键已速降 = false;
  private 模式: 游戏模式 = "马拉松";
  private 每日日期 = new Date().toISOString().slice(0, 10);
  private 当前随机源: () => number = Math.random;
  private 紧凑布局 = false;
  private 竖屏布局 = false;
  private 棋盘界面签名 = "";
  private 界面签名 = "";

  constructor() {
    super("再消一行对局");
  }

  init(data: { 模式?: 游戏模式; 日期?: string }): void {
    this.模式 = data.模式 ?? "马拉松";
    this.每日日期 = data.日期 ?? new Date().toISOString().slice(0, 10);
    this.当前随机源 = 创建模式随机源(this.模式, this.每日日期);
    this.状态 = 创建新局(this.当前随机源, this.测试序列, this.模式);
    this.音频上次阶段 = this.状态.阶段;
    this.音频上次消行数 = this.状态.消行数;
    this.最佳纪录缓存 = undefined;
    this.结束已存档 = false;
    this.对局编号 = 新对局编号();
    this.本局落块数 = 0;
    this.奖励文案 = "";
    this.金币奖励 = undefined;
    this.待领奖励 = undefined;
    this.领奖中 = false;
    this.结束时刻 = 0;
    this.刷新纪录 = false;
    this.目标达成已显示 = false;
    this.目标达成显示至 = 0;
    this.上次落块反馈 = 0;
    this.重开锁可用 = undefined;
    this.释放操作();
  }

  create(): void {
    this.视口 = 适配场景视口(this, 1440, 900);
    应用文字清晰度(this);
    绑定音频管理器(this.sound);
    播放再消一行音乐("对局");
    播放场景氛围(获取游戏设置().背景主题);
    this.input.on("pointerdown", this.解锁对局音频);
    this.解锁对局音频();
    this.cameras.main.setBackgroundColor("#080B18");
    this.背景主题 = 获取游戏设置().背景主题;
    this.背景图 = 布置烘焙底图(
      this,
      undefined,
      this.视口.宽,
      this.视口.高,
      this.背景主题,
      !获取游戏设置().背景动态,
    );
    this.背景动画层 = this.add.graphics().setDepth(-1);
    绘制动态霓虹细节(
      this.背景动画层,
      this.视口.宽,
      this.视口.高,
      this.time.now,
      this.背景主题,
      获取游戏设置().背景动态,
    );
    this.绘图 = this.add.graphics();
    this.棋盘预制体 = new 再消一行棋盘(this);
    this.绘制装饰();
    this.创建文字();
    this.结算面板 = 创建对局结算面板(this, this.取文案(), {
      重开: () => this.重新开始(),
      菜单: () => this.scene.start("开始菜单"),
    });
    this.结算面板.奖励文字.setInteractive({ useHandCursor: true }).on("pointerdown", () => {
      if (this.奖励文案.includes("失败")) void this.领取本局奖励();
    });
    this.结算输入层 = this.add.container(0, 0).setDepth(20).setVisible(false);
    this.结算输入遮罩 = this.add
      .rectangle(this.视口.宽 / 2, this.视口.高 / 2, this.视口.宽, this.视口.高, 0, 0.001)
      .setInteractive();
    this.结算输入层.add(this.结算输入遮罩);
    this.结算输入层.add(this.结算面板);
    if (this.提示文字) this.结算输入层.add(this.提示文字);
    注册模态界面(this.结算输入层, this.结算输入遮罩);
    this.创建触屏操作区();
    this.硬降按钮 = 创建霓虹按钮(this, {
      x: 0,
      y: 0,
      宽: 120,
      高: 44,
      文案: 解析语言(获取游戏设置().语言) === "简体中文" ? "⤓  硬降" : "⤓  DROP",
      名称: "touch.hard-drop",
      字号: "14px",
      点击: () => {
        if (this.状态.阶段 !== "进行中") return;
        this.操作硬降();
        this.更新界面(false);
      },
      覆盖: {
        强调色: 界面主题().文字.强调,
        文字色: 界面主题().面板.主面板.正文文字,
        按下: this.解锁对局音频,
      },
    })
      .setDepth(4)
      .setVisible(false);
    this.消行反馈 = this.add
      .text(0, 0, "", {
        fontFamily: 游戏外观.字体.家族,
        fontSize: "20px",
        fontStyle: "bold",
        color: 界面主题().面板.主面板.正文文字,
        backgroundColor: 界面主题().面板.主面板.背景,
        padding: { x: 14, y: 8 },
        align: "center",
      })
      .setOrigin(0.5)
      .setDepth(7)
      .setVisible(false);
    this.成就提示 = this.add
      .text(this.视口.宽 / 2, 146, "", {
        fontSize: "13px",
        color: 界面主题().文字.强调,
        backgroundColor: 界面主题().面板.主面板.背景,
        padding: { x: 12, y: 8 },
        align: "center",
        wordWrap: { width: this.视口.宽 - 60 },
      })
      .setOrigin(0.5)
      .setDepth(6)
      .setVisible(false);
    this.暂存栏 = new 暂存方块栏(this, () => this.操作暂存());
    this.上次落块反馈 = 0;
    this.预览栏 = new 下一个方块栏(this);
    this.暂停面板 = new 界面暂停菜单(this, {
      空白关闭: () => {
        if (this.状态.阶段 === "暂停") {
          切换暂停(this.状态);
          this.更新界面();
        }
      },
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
    window.addEventListener("blur", this.失去焦点);
    document.addEventListener("visibilitychange", this.页面可见性变化);
    window.addEventListener("gamemaker:settings-change", this.对局设置已更新);
    this.绑定测试接口();
    this.更新界面();
    this.布局界面();
    this.scale.on("resize", this.布局界面, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      设置玩法进行中(false);
      this.scale.off("resize", this.布局界面, this);
      this.input.off("pointerdown", this.解锁对局音频);
      this.对局音效.清理();
      window.removeEventListener("keydown", this.处理按键按下);
      window.removeEventListener("keyup", this.处理按键松开);
      window.removeEventListener("blur", this.失去焦点);
      document.removeEventListener("visibilitychange", this.页面可见性变化);
      this.释放操作();
      if (this.消行反馈) this.tweens.killTweensOf(this.消行反馈);
      window.removeEventListener("gamemaker:settings-change", this.对局设置已更新);
      delete window.__再消一行测试__;
    });
  }

  private 释放操作(): void {
    this.按住按键.clear();
    this.上键按住毫秒 = 0;
    this.上键长按已触发 = false;
    this.上次手机下键抬起 = -Infinity;
    this.重置横移(this.左移输入);
    this.重置横移(this.右移输入);
  }
  private readonly 失去焦点 = (): void => {
    this.释放操作();
    if (this.状态.阶段 === "进行中") {
      切换暂停(this.状态);
      this.更新界面();
    }
  };
  private readonly 页面可见性变化 = (): void => {
    if (document.hidden) this.失去焦点();
  };
  private 操作硬降(): void {
    this.硬降处理中 = true;
    const 原格子 = 读取格子(this.状态.当前方块);
    const 类型 = this.状态.当前方块.类型;
    const 距离 = 硬降(this.状态, this.当前随机源);
    this.棋盘预制体?.播放硬降(原格子, 距离, 类型);
    if (距离 > 0) this.播放对局音效("硬降");
    this.重置计时器();
  }

  private 操作暂存(): void {
    if (暂存换块(this.状态, this.当前随机源)) {
      if (this.成就.推进("hold", 1)) this.提示成就(["hold"]);
      this.重置横移(this.左移输入);
      this.重置横移(this.右移输入);
      this.播放对局音效("暂存");
      this.更新界面(false);
    }
  }
  private 布局界面 = (): void => {
    this.视口 = 适配场景视口(this, 1440, 900);
    const 宽 = this.视口.宽;
    const 高 = this.视口.高;
    this.结算输入遮罩?.setPosition(宽 / 2, 高 / 2).setSize(宽, 高);
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
          高 < 560 ? 120 : 游戏外观.布局.竖屏棋盘最小高度,
          高 - 顶部信息底 - (this.紧凑布局 ? 游戏外观.布局.紧凑布局顶部偏移 : 32),
        );
    格子大小 = Math.max(
      高 < 560 && !this.竖屏布局 ? 8 : 14,
      Math.min(
        this.竖屏布局 ? 40 : this.紧凑布局 ? 32 : 36,
        可用棋盘宽 / 棋盘宽度,
        可用棋盘高 / 可见高度,
      ),
    );
    const 棋盘像素宽 = 棋盘宽度 * 格子大小;
    const 棋盘像素高 = 可见高度 * 格子大小;
    if (this.背景图)
      this.背景图 = 布置烘焙底图(
        this,
        this.背景图,
        宽,
        高,
        this.背景主题,
        !获取游戏设置().背景动态,
      );
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
      ?.setText(this.取模式名())
      .setPosition(宽 / 2, 38)
      .setOrigin(0.5)
      .setFontSize(this.紧凑布局 ? "18px" : "21px");
    this.离开按钮?.setPosition(58, 38);
    this.暂停按钮?.setPosition(宽 - 58, 38);
    this.触屏操作区?.布局(宽, 高, this.竖屏布局);
    this.刷新触屏提示();
    const 暂停比例 = Math.min(1, (高 - 24) / 410);
    this.暂停面板?.布局(宽 / 暂停比例, 高 / 暂停比例);
    this.暂停面板?.setScale(暂停比例).setPosition(宽 / 2, 高 / 2);
    this.对局设置面板?.布局(宽, 高);

    const 侧栏X = 棋盘左侧 + 棋盘像素宽 + (this.竖屏布局 ? (宽 < 640 ? 10 : 16) : 20);
    const 侧栏顶 = this.竖屏布局 ? 棋盘顶部 - 10 : 棋盘顶部 + 8;
    const 侧栏宽 = this.竖屏布局 ? (宽 < 640 ? 宽 - 侧栏X - 8 : 260) : 228;
    const 侧栏高 = this.竖屏布局 ? 棋盘像素高 + 20 : 棋盘像素高 - 16;
    const 侧栏底 = 侧栏顶 + 侧栏高;
    this.硬降按钮
      ?.setPosition(侧栏X + 侧栏宽 / 2, 侧栏底 - 32)
      .设置布局尺寸(Math.max(76, 侧栏宽 - 20), 44);
    this.信息栏
      ?.setPosition(宽 / 2, 游戏外观.布局.信息栏顶部)
      .布局(宽 - 24, 游戏外观.布局.信息栏高度);

    const 棋盘中心X = 棋盘左侧 + 棋盘像素宽 / 2;
    this.模式文字
      ?.setPosition(棋盘中心X, 棋盘顶部 - 12)
      .setOrigin(0.5, 1)
      .setFontSize(this.竖屏布局 ? 11 : 12)
      .setVisible(this.模式 !== "马拉松");
    this.纪录页脚?.布局({
      竖屏: this.竖屏布局,
      紧凑: this.紧凑布局,
      宽,
      侧栏X,
      侧栏宽,
      侧栏底,
      棋盘顶部,
      棋盘像素高,
    });
    const 显示键位说明 =
      获取游戏设置().显示按键说明 && !this.竖屏布局 && this.视口.高 >= 560 && 棋盘左侧 >= 220;
    this.操作说明卡?.布局({
      宽,
      键位区X: 棋盘左侧 - 206,
      键位区顶: 棋盘顶部 + 28,
      紧凑: this.紧凑布局,
      可见: 显示键位说明 && this.状态.阶段 !== "结束",
    });
    this.目标达成提示
      ?.setPosition(棋盘中心X, 棋盘顶部 + 棋盘像素高 / 2 - 30)
      .setOrigin(0.5)
      .setFontSize(this.竖屏布局 ? "24px" : "28px");
    this.状态文字?.setPosition(宽 / 2, Math.min(高 - 16, 棋盘顶部 + 棋盘像素高 + 18));
    this.提示文字?.setPosition(棋盘左侧 + 棋盘像素宽 / 2, 棋盘顶部 + 棋盘像素高 / 2 - 30);
    this.重排结算面板();
    this.暂停按钮?.setVisible(this.状态.阶段 !== "结束");
    this.暂停按钮?.setLabel(this.状态.阶段 === "暂停" ? this.取文案().继续 : this.取文案().暂停);
    this.触屏操作区?.setVisible(this.竖屏布局 && this.状态.阶段 === "进行中");
    this.暂停面板?.setVisible(this.状态.阶段 === "暂停");
    this.应用背景文字对比();
    this.绘制装饰();
    this.更新界面();
  };

  update(_时间: number, delta: number): void {
    设置玩法进行中(this.状态.阶段 === "进行中");
    const 新主题 = 获取游戏设置().背景主题;
    if (新主题 !== this.背景主题) {
      this.背景主题 = 新主题;
      this.布局界面();
    }
    if (this.背景动画层?.active) {
      绘制动态霓虹细节(
        this.背景动画层,
        this.视口.宽,
        this.视口.高,
        this.time.now,
        this.背景主题,
        获取游戏设置().背景动态,
        // 对局中玩家可能只看不点（自动下落），不做闲置降频。
        this.状态.阶段 !== "进行中",
      );
    }
    if (this.状态.阶段 !== "暂停") this.棋盘预制体?.更新特效(delta);
    if (this.状态.阶段 === "进行中" && this.成就提示剩余 > 0) {
      标记重绘();
      this.成就提示剩余 = Math.max(0, this.成就提示剩余 - delta);
      this.成就提示
        ?.setPosition(this.视口.宽 / 2, 146)
        .setAlpha(Math.min(1, this.成就提示剩余 / 350))
        .setVisible(this.成就提示剩余 > 0);
    }
    if (this.状态.阶段 === "结束") {
      this.更新重开锁();
      return;
    }
    if (this.状态.阶段 !== "进行中") return;
    const 经过毫秒 = Math.min(delta, 1000);
    if (this.按住按键.has("ArrowUp") && !this.上键长按已触发) {
      this.上键按住毫秒 += 经过毫秒;
      if (this.上键按住毫秒 >= 450) {
        this.上键长按已触发 = true;
        this.操作暂存();
      }
    }
    this.处理横移("ArrowLeft", -1, this.左移输入, 经过毫秒);
    this.处理横移("ArrowRight", 1, this.右移输入, 经过毫秒);

    更新时钟(this.状态, 经过毫秒, this.当前随机源, this.按住按键.has("ArrowDown"));
    this.更新界面(false);
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
      "KeyC",
    ];
    if (!支持按键.includes(事件.code)) return;
    事件.preventDefault();
    if (事件.repeat || this.按住按键.has(事件.code)) return;
    this.解锁对局音频();
    this.按住按键.add(事件.code);

    if (事件.code === "KeyP" || 事件.code === "Escape") {
      if (this.对局设置打开) {
        this.返回暂停菜单();
        this.按住按键.delete(事件.code);
        return;
      }
      if (this.状态.阶段 !== "结束") {
        切换暂停(this.状态);
        this.更新界面();
      }
      return;
    }
    if (this.状态.阶段 !== "进行中") return;

    if (事件.code === "ArrowLeft") this.开始横移(-1);
    if (事件.code === "ArrowRight") this.开始横移(1);
    if (事件.code === "ArrowUp") {
      this.上键按住毫秒 = 0;
      this.上键长按已触发 = false;
      const 上键 = 获取游戏设置().手机上键旋转;
      this.操作旋转(上键 === "左转" ? -1 : 1, 上键 === "180度");
    }
    if (事件.code === "ArrowDown") this.操作软降();
    if (事件.code === "KeyX") this.操作旋转(-1, false);
    if (事件.code === "KeyZ") {
      this.操作旋转(1, true);
    }
    if (事件.code === "KeyC") this.操作暂存();
    if (事件.code === "Space") {
      this.操作硬降();
    }
    this.更新界面(false);
  };

  private readonly 处理按键松开 = (事件: KeyboardEvent): void => {
    this.按住按键.delete(事件.code);
    if (事件.code === "ArrowUp") {
      this.上键按住毫秒 = 0;
      this.上键长按已触发 = false;
    }
    if (事件.code === "ArrowLeft") this.重置横移(this.左移输入);
    if (事件.code === "ArrowRight") this.重置横移(this.右移输入);
    if (事件.code === "ArrowDown") this.状态.内部重力 = 0;
  };

  private 开始横移(方向: number): void {
    if (this.状态.阶段 !== "进行中") return;
    const 输入 = 方向 < 0 ? this.左移输入 : this.右移输入;
    输入.按住毫秒 = 0;
    输入.下次横移毫秒 = 133;
    if (移动方块(this.状态, 方向, 0, this.当前随机源)) this.播放对局音效("移动");
    this.更新界面(false);
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
      if (移动方块(this.状态, 方向, 0, this.当前随机源)) this.播放对局音效("移动");
      输入.下次横移毫秒 += 33;
      this.更新界面(false);
    }
  }

  private readonly 重置计时器 = (): void => {
    this.状态.内部重力 = 0;
  };

  private 绑定测试接口(): void {
    if (!this.是本地开发地址()) return;
    window.__再消一行测试__ = {
      读取音频: () => ({ 游戏: 获取游戏设置(), 框架: 读取游戏音频状态() }),
      设置暂停: (暂停) => {
        if ((this.状态.阶段 === "暂停") !== 暂停 && this.状态.阶段 !== "结束") 切换暂停(this.状态);
        this.释放操作();
        this.更新界面();
      },
      硬降: () => {
        this.操作硬降();
        this.更新界面();
      },
      结束当前对局: () => {
        this.状态.阶段 = "结束";
        this.更新界面();
      },
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
      准备四行消除: (继续连击 = false, 保留堆叠 = false) => {
        if (!继续连击) {
          this.测试序列 = ["I", "O"];
          this.重新开始(true);
        }
        this.状态.当前方块.类型 = "I";
        this.状态.最后旋转 = false;
        this.状态.当前方块.格子 = [-1, 0, 1, 2].map((行) => ({ 列2: 8, 行2: 行 * 2 }));
        for (const 行 of this.状态.棋盘.slice(-4)) {
          for (let 列 = 0; 列 < 行.length; 列++) 行[列] = 列 === 4 ? null : "J";
        }
        const 保留行 = this.状态.棋盘.at(-5);
        if (保留堆叠 && 保留行) 保留行[0] = "L";
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
        this.最佳纪录缓存 = undefined;
        this.结束已存档 = false;
        this.更新界面();
      },
      读取状态: () => ({
        阶段: this.状态.阶段,
        分数: this.状态.分数,
        有效用时: this.状态.有效用时,
        暂存方块: this.状态.暂存方块,
        本块已暂存: this.状态.本块已暂存,
        消行数: this.状态.消行数,
        当前方块: this.状态.当前方块.类型,
        当前格子: 读取格子(this.状态.当前方块),
        当前朝向: this.状态.当前方块.旋转,
        下一个方块: this.状态.下一个方块,
        棋盘: structuredClone(this.状态.棋盘),
      }),
      读取界面: () => {
        const 读取文字 = (文字?: Phaser.GameObjects.Text | Phaser.GameObjects.BitmapText) => ({
          文本: 文字?.text ?? "",
          可见: Boolean(文字?.visible),
        });
        return {
          视口: { ...this.视口 },
          棋盘: { 左: 棋盘左侧, 顶: 棋盘顶部, 宽: 棋盘宽度 * 格子大小, 高: 可见高度 * 格子大小 },
          震屏: this.棋盘预制体?.获取震屏状态(),
          音效事件: [...this.测试音效事件],
          消行特效: this.棋盘预制体?.获取特效状态(),
          落块特效: this.棋盘预制体?.获取落块特效状态(),
          技巧反馈: this.消行反馈?.text ?? "",
          样式: 界面主题().元信息.名称,
          界面配色: {
            分数: String(
              (this.信息栏?.getByName("数值.1") as Phaser.GameObjects.Text | null)?.style.color,
            ),
            纪录: String(this.纪录页脚?.标签.style.color),
            结算: String(this.结算面板?.统计数值[0]?.style.color),
          },
          模式文字: 读取文字(this.模式文字),
          操作说明: this.操作说明卡?.说明.map((文字) => 读取文字(文字)) ?? [],
          快速移动提示: 读取文字(this.操作说明卡?.提示),
          目标达成提示: 读取文字(this.目标达成提示),
          手机侧栏纪录间距:
            this.竖屏布局 && this.视口.宽 < 640
              ? (() => {
                  const 侧栏顶 = 棋盘顶部 - 10;
                  const 预览高度 = 可见高度 * 格子大小 - 62 - 82;
                  const 单卡高度 = Math.max(34, (预览高度 - 28 - 92 - 24) / 3);
                  const 最后一张卡底 =
                    侧栏顶 + 82 + 28 + 单卡高度 * 3 + 游戏外观.方块.预览格间距 * 2;
                  return (this.纪录页脚?.标签.y ?? 最后一张卡底) - 最后一张卡底;
                })()
              : null,
          结算徽标: {
            文本: this.结算面板?.徽标文字.text ?? "",
            可见: Boolean(this.结算面板?.visible && this.结算面板?.徽标文字.visible),
          },
          结算统计:
            this.结算面板?.统计标签.map((标签, 索引) => {
              const 数值 = this.结算面板?.统计数值[索引];
              return {
                标签: 标签.text,
                数值: 数值?.text ?? "",
                可见: Boolean(this.结算面板?.visible && 标签.visible && 数值?.visible),
              };
            }) ?? [],
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
    this.操作说明卡?.设置说明(2, 文案.操作半转);
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
    this.上次落块反馈 = 0;
    this.重开锁可用 = undefined;
    this.消行反馈?.setVisible(false);
    if (this.消行反馈) this.tweens.killTweensOf(this.消行反馈);
    this.对局编号 = 新对局编号();
    this.本局落块数 = 0;
    this.奖励文案 = "";
    this.金币奖励 = undefined;
    this.待领奖励 = undefined;
    this.领奖中 = false;
    // 新一局结束时要重新存档，并重新起算结算 3 秒重开锁
    this.最佳纪录缓存 = undefined;
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
    if (this.标题文字) {
      this.标题文字
        .setColor(界面主题().文字.主要)
        .setBackgroundColor(界面主题().面板.主面板.背景)
        .setPadding(8, 3);
      this.标题文字.setStroke(界面主题().面板.主面板.背景, 1);
    }
    if (this.状态文字) {
      this.状态文字.setColor(界面主题().文字.次要);
      this.状态文字.setStroke(界面主题().面板.主面板.背景, 1);
      this.绘制状态底衬();
    }
  }

  /** 状态提示压在背景上，加主题自适应半透明底衬避免混色。 */
  private 绘制状态底衬(): void {
    const 文本 = this.状态文字;
    if (!文本) return;
    this.状态底衬?.destroy();

    const x = 文本.x - 文本.width / 2 - 14;
    const y = 文本.y - 文本.height / 2 - 6;
    this.状态底衬 = this.add
      .graphics()
      .setDepth(-1)
      .fillStyle(颜色值(界面主题().面板.主面板.背景), 0.95)
      .fillRoundedRect(x, y, 文本.width + 28, 文本.height + 12, 10)
      .lineStyle(1, 颜色值(界面主题().面板.分组线), 0.35)
      .strokeRoundedRect(x, y, 文本.width + 28, 文本.height + 12, 10);
  }

  private 创建文字(): void {
    this.标题文字 = this.add.text(0, 0, "", {
      fontFamily: "Arial, sans-serif",
      fontSize: "25px",
      fontStyle: "bold",
      color: 界面主题().文字.主要,
      letterSpacing: 2,
    });
    this.操作说明卡 = 创建对局操作说明(this, this.取文案(), true);
    this.目标达成提示 = this.add
      .text(0, 0, this.取文案().目标达成, {
        fontSize: "28px",
        color: 界面主题().文字.强调,
        fontStyle: "bold",
        backgroundColor: 界面主题().面板.主面板.背景,
        padding: { x: 14, y: 8 },
      })
      .setOrigin(0.5)
      .setDepth(7)
      .setVisible(false);

    this.信息栏 = 创建对局信息栏(this, {
      x: this.视口.宽 / 2,
      y: 游戏外观.布局.信息栏顶部,
      宽: this.视口.宽 - 24,
      高: 游戏外观.布局.信息栏高度,
      文案: this.取文案(),
    });
    this.模式文字 = 创建对局模式文字(this, this.模式 === "冲刺");
    this.纪录页脚 = 创建对局纪录页脚(this, this.取文案());
    this.状态文字 = this.add
      .text(0, 0, "", {
        fontSize: "13px",
        fontStyle: "bold",
        color: 界面主题().文字.弱化,
        align: "center",
      })
      .setOrigin(0.5);
    this.应用背景文字对比();
    this.提示文字 = this.add
      .text(0, 0, "", {
        fontSize: "32px",
        fontStyle: "bold",
        color: 界面主题().面板.主面板.正文文字,
        align: "center",
        stroke: 界面主题().面板.主面板.背景,
        strokeThickness: 8,
      })
      .setOrigin(0.5)
      .setDepth(10);
    this.离开按钮 = 创建霓虹按钮(this, {
      x: 58,
      y: 38,
      宽: 78,
      高: 38,
      文案: this.取文案().离开,
      名称: "game.leave",
      字号: `${游戏外观.字体.辅助 + 1}px`,
      点击: () => this.scene.start("开始菜单"),
    });
    this.暂停按钮 = 创建霓虹按钮(this, {
      x: 0,
      y: 38,
      宽: 78,
      高: 38,
      文案: this.取文案().暂停,
      名称: "game.pause",
      字号: `${游戏外观.字体.辅助 + 1}px`,
      点击: () => {
        if (this.状态.阶段 !== "结束") {
          切换暂停(this.状态);
          this.更新界面();
        }
      },
    });
  }

  private 刷新触屏提示(): void {
    const 设置 = 获取游戏设置();
    const 显示 = 设置.显示按键说明;
    const 英文 = 解析语言(设置.语言) !== "简体中文";
    const 上键说明 =
      设置.手机上键旋转 === "左转"
        ? 英文
          ? "Left\nHold swap"
          : "左转\n长按暂存"
        : 设置.手机上键旋转 === "右转"
          ? 英文
            ? "Right\nHold swap"
            : "右转\n长按暂存"
          : 英文
            ? "180°\nHold swap"
            : "180°\n长按暂存";
    for (const [键, 图标, 中文, 英语] of [
      ["左转", "↺", "左转", "Left turn"],
      ["旋转", "↑", 上键说明, 上键说明],
      ["右转", "↻", "右转", "Right turn"],
      ["左移", "←", "左移", "Left"],
      ["软降", "↓", "软降\n双击硬降", "Soft\nDouble drop"],
      ["右移", "→", "右移", "Right"],
    ]) {
      this.触屏操作区?.设置操作文案(键, 显示 ? `${图标} ${英文 ? 英语 : 中文}` : 图标);
    }
  }

  private 创建触屏操作区(): void {
    const 操作区 = new 界面触屏操作区(
      this,
      [
        { 键: "左转", 文案: "↺\n左转", name: "touch.rotate-left" },
        { 键: "旋转", 文案: "↑\n旋转 · 长按暂存", name: "touch.rotate" },
        { 键: "右转", 文案: "↻\n右转", name: "touch.rotate-right" },
        { 键: "左移", 文案: "←\n左移", name: "touch.left" },
        { 键: "软降", 文案: "↓\n软降 · 双击硬降", name: "touch.soft-drop" },
        { 键: "右移", 文案: "→\n右移", name: "touch.right" },
      ],
      {
        面板色: 游戏外观.按钮.面板,
        强调色: 游戏外观.按钮.边框,
        文字色: 游戏外观.按钮.文字,
        字号: "14px",
      },
    );
    this.触屏操作区 = 操作区;
    操作区.on("control-down", (操作: 触屏操作) => {
      this.解锁对局音频();
      if (this.状态.阶段 !== "进行中") return;
      if (操作 === "左移" || 操作 === "右移") {
        const 方向 = 操作 === "左移" ? -1 : 1;
        this.按住按键.add(方向 < 0 ? "ArrowLeft" : "ArrowRight");
        this.开始横移(方向);
      } else if (操作 === "左转" || 操作 === "旋转" || 操作 === "右转") {
        if (操作 === "旋转") {
          this.按住按键.add("ArrowUp");
          this.上键按住毫秒 = 0;
          this.上键长按已触发 = false;
        }
        const 方向 = 操作 === "旋转" ? 获取游戏设置().手机上键旋转 : 操作;
        this.操作旋转(方向 === "左转" ? -1 : 1, 方向 === "180度");
        this.更新界面(false);
      } else if (操作 === "软降") {
        const 现在 = performance.now();
        this.手机下键按下 = 现在;
        this.手机下键已速降 = 现在 - this.上次手机下键抬起 <= 280;
        this.上次手机下键抬起 = -Infinity;
        if (this.手机下键已速降) {
          this.按住按键.delete("ArrowDown");
          this.操作硬降();
          this.更新界面(false);
          return;
        }
        this.按住按键.add("ArrowDown");
        this.操作软降();
        this.更新界面(false);
      }
    });
    操作区.on("control-up", (操作: 触屏操作) => {
      if (操作 === "旋转") {
        this.按住按键.delete("ArrowUp");
        this.上键按住毫秒 = 0;
        this.上键长按已触发 = false;
      }
      if (操作 === "左移" || 操作 === "右移") {
        const 代码 = 操作 === "左移" ? "ArrowLeft" : "ArrowRight";
        this.按住按键.delete(代码);
        this.重置横移(操作 === "左移" ? this.左移输入 : this.右移输入);
      }
      if (操作 === "软降") {
        this.上次手机下键抬起 =
          !this.手机下键已速降 && performance.now() - this.手机下键按下 <= 220
            ? performance.now()
            : -Infinity;
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
      .fillRect(0, 0, this.视口.宽, this.视口.高);
    if (!this.竖屏布局 && this.视口.高 >= 560 && 棋盘左侧 >= 220 && 获取游戏设置().显示按键说明) {
      this.操作说明卡?.绘制底板(绘图, 棋盘左侧 - 222, 棋盘顶部 + 12, 200, 230);
    }
    if (this.竖屏布局) {
      const 侧栏X = 棋盘左侧 + 棋盘像素宽 + (this.视口.宽 < 640 ? 10 : 16);
      const 侧栏宽 = this.视口.宽 < 640 ? this.视口.宽 - 侧栏X - 8 : 260;
      const 侧栏顶 = 棋盘顶部 - 10;
      const 侧栏高 = 棋盘像素高 + 20;
      绘制霓虹侧栏(绘图, {
        左: 侧栏X,
        顶: 侧栏顶,
        宽: 侧栏宽,
        高: 侧栏高,
        竖屏: true,
        紧凑: false,
      });
    } else if (!this.紧凑布局) {
      const 侧栏X = 棋盘左侧 + 棋盘像素宽 + 20;
      const 侧栏顶 = 棋盘顶部 + 8;
      const 侧栏高 = 棋盘像素高 - 16;
      绘制霓虹侧栏(绘图, {
        左: 侧栏X,
        顶: 侧栏顶,
        宽: 228,
        高: 侧栏高,
        竖屏: false,
        紧凑: false,
      });
    }
  };

  private 重排结算面板(): void {
    const 几何 = this.结算面板?.布局(this.视口.宽, this.视口.高);
    if (!几何) return;
    this.提示文字
      ?.setPosition(几何.中心X, 几何.顶 + 82 * 几何.比例)
      .setFontSize(`${28 * 几何.比例}px`);
  }
  private 更新重开锁(): void {
    const 剩余 = 是否使用马拉松结算重开锁(this.模式)
      ? Math.max(0, 3000 - (Date.now() - this.结束时刻))
      : 0;
    const 可用 = 剩余 === 0;
    if (可用 !== this.重开锁可用) {
      this.结算面板?.重开按钮
        .设置可用(可用)
        .setSelected(可用)
        .设置配色(
          可用 ? 界面主题().按钮.主要.默认.背景 : 界面主题().按钮.主要.禁用.背景,
          可用 ? 界面主题().按钮.主要.默认.描边 : 界面主题().按钮.主要.禁用.描边,
        )
        .setLabelColor(可用 ? 界面主题().按钮.主要.默认.文字 : 界面主题().按钮.主要.禁用.文字);
      this.重开锁可用 = 可用;
    }
    this.结算面板?.设置重开文案(
      可用 ? this.取文案().重新开始 : `${this.取文案().重新开始} · ${Math.ceil(剩余 / 1000)}s`,
    );
  }

  private 绘制结算面板(): void {
    const 已结束 = this.状态.阶段 === "结束";
    this.结算面板?.setVisible(已结束);
    if (!已结束 || !this.结算面板) return;

    const 几何 = this.结算面板.布局(this.视口.宽, this.视口.高);
    this.更新重开锁();
    若变化设置文字(this.提示文字, this.状态.完赛 ? this.取文案().挑战完成 : this.取文案().游戏结束);
    const 文案 = this.取文案();
    const 统计: [string, string][] =
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
    this.结算面板.绘制(几何, this.视口.宽, this.视口.高, {
      徽标: this.取结算徽标文案(),
      奖励: this.奖励文案,
      金币: this.金币奖励,
      省电: 是省电模式(),
      分数: this.状态.分数.toLocaleString(),
      统计,
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
    const 宽 = this.视口.宽;
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
          顶: 侧栏顶 + 82,
          宽: 侧栏宽,
          // 给侧栏底部最佳纪录留出间距，避免它紧贴第三张预测卡片。
          高: 棋盘像素高 - 62 - 82,
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
    const 手机 = this.竖屏布局;
    const 暂存宽 = 手机 ? 侧栏宽 - 16 : this.紧凑布局 ? 94 : 200;
    const 暂存高 = 手机 || this.紧凑布局 ? 72 : 88;
    this.暂存栏?.显示(
      this.状态.暂存方块,
      !this.状态.本块已暂存 && this.状态.阶段 === "进行中",
      解析语言(获取游戏设置().语言) !== "简体中文",
      手机 ? 侧栏X + 侧栏宽 / 2 : this.紧凑布局 ? 64 : 棋盘左侧 - 122,
      手机
        ? 侧栏顶 + 38
        : this.紧凑布局
          ? Math.max(160, 棋盘顶部 + 45)
          : Math.min(this.视口.高 - 52, 棋盘顶部 + 300),
      暂存宽,
      暂存高,
    );
    this.暂存栏?.setVisible(this.状态.阶段 === "进行中");
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
    this.最佳纪录缓存 = undefined;
    const 设置 = 获取游戏设置();
    this.棋盘预制体?.设置落点影透明度(设置.落点影透明度).设置网格显示(设置.显示网格);
    this.刷新触屏提示();
    this.取模式名();
    this.布局界面();
  };

  private 更新计时文案(): void {
    if (禁用性能项("计时文字")) return;
    const 模式名 =
      this.模式 === "马拉松"
        ? ""
        : this.模式 === "冲刺"
          ? `40L · ${(获取冲刺显示用时(this.状态.有效用时, this.状态.阶段 === "进行中") / 1000).toFixed(2)}s`
          : this.模式 === "极限"
            ? `${Math.ceil(this.状态.剩余时间 / 1000)}s`
            : this.每日日期;
    若变化设置文字(this.模式文字, 模式名);
  }

  private 更新界面(强制 = true): void {
    if (!this.绘图) return;
    this.结算输入层?.setVisible(this.状态.阶段 === "结束");
    this.同步程序音频();
    const 文案 = this.取文案();
    this.更新计时文案();
    if (this.模式 === "马拉松" && this.状态.目标达成 && !this.目标达成已显示) {
      this.目标达成已显示 = true;
      this.目标达成显示至 = this.time.now + 2200;
    }
    const 目标提示可见 = this.目标达成显示至 > this.time.now;
    this.目标达成提示?.setVisible(目标提示可见);
    if (this.状态.阶段 === "结束" && !this.结束已存档) this.保存纪录();

    const 当前方块 = this.状态.当前方块;
    const 棋盘签名 = JSON.stringify([
      当前方块.类型,
      当前方块.旋转,
      当前方块.格子.map(({ 列2, 行2 }) => [列2, 行2]),
      this.状态.阶段,
      this.状态.落块事件?.序号 ?? 0,
      this.状态.消行事件?.序号 ?? 0,
    ]);
    if (强制 || 棋盘签名 !== this.棋盘界面签名) {
      this.棋盘界面签名 = 棋盘签名;
      this.棋盘预制体?.更新(this.状态);
    }

    const 界面签名 = JSON.stringify([
      this.状态.阶段,
      this.状态.等级,
      this.状态.分数,
      this.状态.消行数,
      this.模式,
      this.状态.下一个方块,
      this.状态.后续方块,
      this.状态.暂存方块,
      this.状态.本块已暂存,
      this.状态.完赛,
      this.状态.目标达成,
      this.对局设置打开,
      目标提示可见,
      this.刷新纪录,
      this.奖励文案,
      this.金币奖励,
      this.读取最佳文案(),
    ]);
    if (强制 || 界面签名 !== this.界面签名) {
      this.界面签名 = 界面签名;
      this.绘制下一个方块();
      this.信息栏?.更新([
        String(this.状态.等级),
        String(this.状态.分数).padStart(6, "0"),
        String(this.状态.消行数),
      ]);
      this.模式文字?.setVisible(this.模式 !== "马拉松");
      this.纪录页脚?.设置值(this.读取最佳文案());
      const 显示键位说明 =
        获取游戏设置().显示按键说明 &&
        !this.竖屏布局 &&
        this.视口.高 >= 560 &&
        棋盘左侧 >= 220 &&
        this.状态.阶段 !== "结束";
      this.操作说明卡?.布局({
        宽: this.视口.宽,
        键位区X: 棋盘左侧 - 206,
        键位区顶: 棋盘顶部 + 28,
        紧凑: this.紧凑布局,
        可见: 显示键位说明,
      });
      this.暂停按钮?.setVisible(this.状态.阶段 !== "结束");
      this.暂停按钮?.setLabel(this.状态.阶段 === "暂停" ? 文案.继续 : 文案.暂停);
      const 显示触屏按钮 = this.竖屏布局 && this.状态.阶段 === "进行中";
      this.触屏操作区?.setVisible(显示触屏按钮);
      this.硬降按钮?.setVisible(显示触屏按钮);
      this.触屏操作区?.设置操作可用("右转", true);
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
      this.绘制结算面板();
    }
    this.发布测试快照();
  }

  private 操作旋转(方向: 1 | -1, 半转: boolean): void {
    const 成功 = 旋转方块(this.状态, 方向, 半转, this.当前随机源);
    if (成功) this.播放对局音效("旋转");
  }

  private 操作软降(): void {
    if (软降一步(this.状态, this.当前随机源)) this.播放对局音效("软降");
  }

  private 同步程序音频(): void {
    if (this.状态.消行数 > this.音频上次消行数) {
      const 行数 = this.状态.消行数 - this.音频上次消行数;
      this.播放对局音效(行数 === 4 ? "四行" : "消行", 行数);
    } else if (
      this.状态.落块事件 &&
      this.状态.落块事件.序号 !== this.上次落块反馈 &&
      this.音频上次阶段 === "进行中" &&
      this.状态.阶段 === "进行中" &&
      !this.硬降处理中
    ) {
      this.播放对局音效("锁定");
    }
    const 落块 = this.状态.落块事件;
    if (落块 && 落块.序号 !== this.上次落块反馈) {
      this.上次落块反馈 = 落块.序号;
      this.本局落块数++;
      this.提示成就(记录落块成就(this.成就, this.状态));
      const 内容 = 获取技巧反馈(落块, 解析语言(获取游戏设置().语言) !== "简体中文");
      if (落块.全清) this.播放对局音效("全清");
      else if (落块.T旋 !== "无" || 落块.连续高难) this.播放对局音效("技巧");
      else if (落块.连击 >= 2) this.播放对局音效("连击", 落块.连击);
      const 文字 = this.消行反馈;
      if (内容 && 文字) {
        this.tweens.killTweensOf(文字);
        文字
          .setText(内容)
          .setWordWrapWidth(Math.max(64, 棋盘宽度 * 格子大小 - 36), true)
          .setPosition(棋盘左侧 + (棋盘宽度 * 格子大小) / 2, 棋盘顶部 + 可见高度 * 格子大小 * 0.5)
          .setFontSize(`${Math.max(12, Math.min(20, 格子大小))}px`)
          .setAlpha(1)
          .setVisible(true);
        this.tweens.add({
          targets: 文字,
          y: 文字.y - 16,
          alpha: 0,
          duration: 450,
          delay: 650,
          onComplete: () => 文字.setVisible(false),
        });
      }
    }
    if (this.状态.阶段 !== this.音频上次阶段) {
      if (this.状态.阶段 === "暂停") {
        this.播放对局音效("暂停");
        if (this.消行反馈)
          for (const tween of this.tweens.getTweensOf(this.消行反馈)) tween.pause();
        this.释放操作();
        设置再消一行音乐暂停(true);
      } else if (this.状态.阶段 === "进行中") {
        this.播放对局音效("继续");
        if (this.消行反馈)
          for (const tween of this.tweens.getTweensOf(this.消行反馈)) tween.resume();
        设置再消一行音乐暂停(false);
      } else {
        this.播放对局音效(结算音效名称(this.状态.完赛));
        this.释放操作();
        设置再消一行音乐暂停(true);
      }
    }
    this.音频上次阶段 = this.状态.阶段;
    this.音频上次消行数 = this.状态.消行数;
    this.硬降处理中 = false;
  }

  private 保存纪录(): void {
    const 新成就: string[] = [];
    if (this.状态.模式 === "冲刺" && this.状态.完赛 && this.成就.推进("sprint", 1))
      新成就.push("sprint");
    if (
      this.状态.模式 === "极限" &&
      this.状态.剩余时间 <= 0 &&
      this.状态.有效用时 >= 120000 &&
      this.成就.推进("ultra", 1)
    )
      新成就.push("ultra");
    this.提示成就(新成就);
    this.结束已存档 = true;
    this.结束时刻 = Date.now();
    try {
      const 存档 = 创建纪录存档(this.模式, this.每日日期, localStorage);
      const 旧 = 存档.读取();
      const 新 = {
        分数: this.状态.分数,
        用时: this.状态.完赛 ? this.状态.有效用时 : null,
        消行数: this.状态.消行数,
        等级: this.状态.等级,
        最长连击: this.状态.最长连击,
      };
      this.刷新纪录 = 是否刷新纪录(this.模式, 新, 旧) && 存档.保存(新);
      this.待领奖励 = {
        编号: this.对局编号,
        分数: 新.分数,
        消行: 新.消行数,
        用时: this.状态.有效用时,
        落块: this.本局落块数,
        破纪录: 旧 !== null && this.刷新纪录,
        日期: 旅行日期(),
      };
      void this.领取本局奖励();
      结算后同步平台({
        模式: this.模式,
        分数: 新.分数,
        用时毫秒: this.状态.有效用时,
        完赛: Boolean(this.状态.完赛),
        新成就,
      });
      this.最佳纪录缓存 = undefined;
      this.纪录页脚?.设置值(this.读取最佳文案());
    } catch {
      /* 浏览器禁用存储时保留本局结算。 */
    }
  }

  private async 领取本局奖励(): Promise<void> {
    if (!this.待领奖励 || this.领奖中) return;
    const 编号 = this.对局编号;
    this.领奖中 = true;
    this.奖励文案 = "正在保存旅行奖励…";
    try {
      const 输入 = { ...this.待领奖励 };
      const 结果 = await 执行收藏操作((收藏) => 收藏.结算对局(输入));
      if (编号 !== this.对局编号) return;
      this.金币奖励 =
        结果.成功 && 结果.新增
          ? { 新增: 结果.新增, 总额: 结果.金币, 原因: 结果.原因, 编号: 编号 }
          : undefined;
      this.奖励文案 = 结果.成功
        ? 结果.新增
          ? `旅行方块币 +${结果.新增}`
          : 结果.原因
        : `${结果.原因}\n点击这里重试`;
    } catch {
      if (编号 === this.对局编号) this.奖励文案 = "奖励保存失败，点击这里重试";
    } finally {
      if (编号 === this.对局编号) {
        this.领奖中 = false;
        if (this.scene.isActive()) this.绘制结算面板();
      }
    }
  }

  private 读取最佳文案(): string {
    this.最佳纪录缓存 ??= this.加载最佳文案();
    return this.最佳纪录缓存;
  }

  private 加载最佳文案(): string {
    const 文案 = this.取文案();
    try {
      const record = 创建纪录存档(this.模式, this.每日日期, localStorage).读取();
      if (!record) return 文案.暂无纪录;
      if (this.模式 === "冲刺")
        return record.用时 !== null ? `${(record.用时 / 1000).toFixed(2)}s` : 文案.暂无完赛纪录;
      return `${record.分数.toLocaleString()} pts`;
    } catch {
      return 文案.暂无纪录;
    }
  }

  private 提示成就(编号: string[]): void {
    if (!编号.length) return;
    const 英文 = 解析语言(获取游戏设置().语言) !== "简体中文";
    const 名称 = 编号
      .map((id) => 成就定义.find((a) => a.编号 === id))
      .filter((a) => a !== undefined)
      .map((a) => (英文 ? a.英文 : a.名称));
    const 提示文案 = `${英文 ? "Achievement unlocked" : "成就解锁"} · ${名称.slice(0, 2).join(" / ")}${名称.length > 2 ? ` +${名称.length - 2}` : ""}`;
    void 同步成就金币().then((结果) => {
      if (结果.新增 && this.成就提示?.active && this.成就提示.text.startsWith(提示文案))
        this.成就提示.setText(`${提示文案} · +${结果.新增} 方块币`);
    });
    void 同步平台成就并回报(编号).then((结果列表) => {
      if (!this.成就提示?.active) return;
      const 成功 = 结果列表.filter((r) => r.完成).length;
      const 失败 = 结果列表.filter((r) => !r.完成 && r.原因 !== "未配置平台成就 ID");
      let 后缀 = "";
      if (成功) 后缀 = 英文 ? " · Synced to TapTap" : " · 已同步到 TapTap";
      else if (失败.length) {
        const 原因 = 失败[0]?.原因 || (英文 ? "error" : "未知错误");
        后缀 = 英文 ? ` · Tap sync failed · ${原因}` : ` · Tap 同步失败 · ${原因}`;
      }
      if (后缀 && this.成就提示.text.startsWith(提示文案)) {
        this.成就提示.setText(`${this.成就提示.text}${后缀}`);
        this.成就提示剩余 = Math.max(this.成就提示剩余, 2800);
      }
    });
    this.成就提示剩余 = 2400;
    this.成就提示?.setText(提示文案).setAlpha(1).setVisible(true);
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
