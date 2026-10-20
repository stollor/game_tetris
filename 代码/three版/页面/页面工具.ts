import { 矩形包含, 绘制单行文字 } from "../../../框架Three/界面/控件/工具";
import type { 按钮选项 } from "../../../框架Three/界面/控件/按钮";
import { 按钮 } from "../../../框架Three/界面/控件/按钮";
import type { 控件层选项 } from "../../../框架Three/界面/控件/控件层";
import { 控件层 } from "../../../框架Three/界面/控件/控件层";
import type { 滚动容器选项 } from "../../../框架Three/界面/控件/滚动容器";
import { 滚动容器 } from "../../../框架Three/界面/控件/滚动容器";
import type {
  可捕获控件,
  控件接口,
  界面配色,
  矩形,
  绘制环境,
} from "../../../框架Three/界面/控件/类型";
import { 轻提示队列 } from "../../../框架Three/界面/控件/轻提示";
import type { 指针事件, 逻辑坐标 } from "../../../框架Three/运行时/输入路由";
import { 绘制背景 } from "../../视觉/背景配方";
import { 主题转界面配色, 绘制顶栏衬底, 读取背景外观 } from "../主题";
import type {
  界面快照,
  界面按钮快照,
  页面上下文,
  页面参数,
  页面实例,
  页面编号,
} from "../接口/上下文";
import type { 画笔 } from "../画笔/index";
import { 创建文字服务 } from "../界面/文字服务";

/**
 * 页面基类：三件事收口——共享合批/命中/文字资源的绘制环境、控件层生命周期、
 * 以及调试桥按名称点击用的界面快照。子类只写 `构建()`（重建控件）与 `绘制内容()`。
 */

export interface 页面选项 {
  /** 命中区域名称，调试桥/测试看得见。 */
  名称: string;
  /** 页面独占：按在空白处也不让下层页面收到（子页面/覆盖页用）。 */
  独占?: boolean;
  /** 画主题背景，默认 true。 */
  背景?: boolean;
  /** 覆盖页深度；普通页面 0。 */
  深度?: number;
}

/** 快照只认这两件事：矩形与禁用态；框架按钮与命中热区都满足。 */
interface 登记控件 extends 控件接口 {
  读取矩形(): 矩形;
  读取禁用(): boolean;
}

interface 按钮登记项 {
  名称: string;
  控件: 登记控件;
}

export interface 热区选项 {
  /** 命中名称；需要进界面快照（调试桥/验收可点）时必填。 */
  名称?: string;
  矩形: 矩形;
  点击: () => void;
  禁用?: boolean | (() => boolean);
  /** 按下/松开/取消回调：让页面能画「按下态」视觉（Phaser 用缩放 tween）。 */
  按下?: () => void;
  松开?: () => void;
  取消?: () => void;
}

/**
 * 只参与命中、不参与绘制的透明热区。
 * 共享视觉配方由页面在 `渲染()` 里用 `画笔` 绘制，命中与快照仍走页面基类的控件层。
 */
export class 命中热区 implements 可捕获控件 {
  private 矩形值: 矩形;
  private readonly 选项: 热区选项;
  private 按下中 = false;

  constructor(选项: 热区选项) {
    this.选项 = 选项;
    this.矩形值 = { ...选项.矩形 };
  }

  读取矩形(): 矩形 {
    return { ...this.矩形值 };
  }

  设置矩形(矩形: 矩形): void {
    this.矩形值 = { ...矩形 };
  }

  读取禁用(): boolean {
    return typeof this.选项.禁用 === "function" ? this.选项.禁用() : (this.选项.禁用 ?? false);
  }

  命中(坐标: 逻辑坐标): 控件接口 | null {
    return this.读取禁用() || !矩形包含(this.矩形值, 坐标) ? null : this;
  }

  绘制(_环境: 绘制环境): void {}

  处理按下(_事件: 指针事件): 可捕获控件 | null {
    if (this.读取禁用()) return null;
    this.按下中 = true;
    this.选项.按下?.();
    return this;
  }

  处理移动(事件: 指针事件): void {
    if (this.按下中 && !矩形包含(this.矩形值, 事件.坐标)) {
      this.按下中 = false;
      this.选项.取消?.();
    }
  }

  处理抬起(事件: 指针事件): void {
    if (!this.按下中) return;
    this.按下中 = false;
    this.选项.松开?.();
    if (矩形包含(this.矩形值, 事件.坐标)) this.选项.点击();
  }

  处理取消(): void {
    this.按下中 = false;
    this.选项.取消?.();
  }
}

export type 滑动方向 = "上" | "下" | "左" | "右";

export interface 滑动热区选项 {
  矩形: 矩形;
  阈值?: number;
  /** 轻点（无滑动）时的回调，可选。 */
  点击?: () => void;
  滑动: (方向: 滑动方向) => void;
}

/** 只参与手势的全屏热区：上/下/左/右滑（主界面进入纯享、纯享切换风景）。 */
export class 滑动热区 implements 可捕获控件 {
  private readonly 矩形值: 矩形;
  private readonly 选项: 滑动热区选项;
  private 起始: 逻辑坐标 | null = null;

  constructor(选项: 滑动热区选项) {
    this.选项 = 选项;
    this.矩形值 = { ...选项.矩形 };
  }

  读取矩形(): 矩形 {
    return { ...this.矩形值 };
  }

  设置矩形(矩形: 矩形): void {
    Object.assign(this.矩形值, 矩形);
  }

  命中(坐标: 逻辑坐标): 控件接口 | null {
    return 矩形包含(this.矩形值, 坐标) ? this : null;
  }

  绘制(_环境: 绘制环境): void {}

  处理按下(事件: 指针事件): 可捕获控件 | null {
    this.起始 = 事件.坐标;
    return this;
  }

  处理移动(): void {}

  处理抬起(事件: 指针事件): void {
    const 起始 = this.起始;
    this.起始 = null;
    if (!起始) return;
    const 阈值 = this.选项.阈值 ?? 48;
    const 位移X = 事件.坐标.x - 起始.x;
    const 位移Y = 事件.坐标.y - 起始.y;
    if (Math.max(Math.abs(位移X), Math.abs(位移Y)) < 阈值) {
      this.选项.点击?.();
      return;
    }
    const 方向: 滑动方向 =
      Math.abs(位移X) > Math.abs(位移Y) ? (位移X > 0 ? "右" : "左") : 位移Y > 0 ? "下" : "上";
    this.选项.滑动(方向);
  }

  处理取消(): void {
    this.起始 = null;
  }
}

export interface 滑块热区选项 {
  名称?: string;
  矩形: 矩形;
  值: number;
  /** 0..100，默认 100。 */
  最大值?: number;
  步进?: number;
  变化: (值: number) => void;
  禁用?: boolean | (() => boolean);
}

/**
 * 只参与命中/拖动的滑块热区：视觉由页面用共享配方自绘，取值/拖动语义与 GM 滑块一致。
 * 放在 `滚动容器` 里时声明拖动方向为横向，纵向拖动让位给容器滚动。
 */
export class 滑块热区 implements 可捕获控件 {
  private 矩形值: 矩形;
  private readonly 选项: 滑块热区选项;
  private 拖动中 = false;

  constructor(选项: 滑块热区选项) {
    this.选项 = 选项;
    this.矩形值 = { ...选项.矩形 };
  }

  读取矩形(): 矩形 {
    return { ...this.矩形值 };
  }

  设置矩形(矩形: 矩形): void {
    this.矩形值 = { ...矩形 };
  }

  读取禁用(): boolean {
    return typeof this.选项.禁用 === "function" ? this.选项.禁用() : (this.选项.禁用 ?? false);
  }

  读取值(): number {
    return this.选项.值;
  }

  读取拖动方向(): "横向" | null {
    return "横向";
  }

  命中(坐标: 逻辑坐标): 控件接口 | null {
    return this.读取禁用() || !矩形包含(this.矩形值, 坐标) ? null : this;
  }

  绘制(_环境: 绘制环境): void {}

  处理按下(事件: 指针事件): 可捕获控件 | null {
    if (this.读取禁用()) return null;
    this.拖动中 = true;
    this.回报(事件.坐标);
    return this;
  }

  处理移动(事件: 指针事件): void {
    if (this.拖动中) this.回报(事件.坐标);
  }

  处理抬起(): void {
    this.拖动中 = false;
  }

  处理取消(): void {
    this.拖动中 = false;
  }

  private 回报(坐标: 逻辑坐标): void {
    const 比例 = Math.max(0, Math.min(1, (坐标.x - this.矩形值.左) / Math.max(1, this.矩形值.宽)));
    const 最大值 = this.选项.最大值 ?? 100;
    const 步进 = this.选项.步进 ?? 1;
    const 值 = Math.round((比例 * 最大值) / 步进) * 步进;
    this.选项.变化(Math.max(0, Math.min(最大值, 值)));
  }
}

export abstract class 页面基类 implements 页面实例 {
  protected readonly 上下文: 页面上下文;
  protected readonly 控件层: 控件层;
  protected readonly 提示 = new 轻提示队列();
  protected get 逻辑宽(): number {
    return this.上下文.资源.逻辑宽;
  }
  protected get 逻辑高(): number {
    return this.上下文.资源.逻辑高;
  }
  private readonly 页面选项: 页面选项;
  private readonly 按钮登记: 按钮登记项[] = [];
  private 注销命中: (() => void) | null = null;
  private 环境缓存: { 配色: 界面配色; 环境: 绘制环境 } | null = null;
  private 背景时间秒 = 0;

  constructor(上下文: 页面上下文, 选项: 页面选项) {
    this.上下文 = 上下文;
    this.页面选项 = 选项;
    this.控件层 = new 控件层({
      名称: 选项.名称,
      深度: 选项.深度 ?? 0,
      独占: 选项.独占 ?? false,
      逻辑尺寸: { 宽: this.逻辑宽, 高: this.逻辑高 },
    } satisfies 控件层选项);
  }

  调整尺寸(): void {
    this.控件层.设置逻辑尺寸(this.逻辑宽, this.逻辑高);
    if (this.注销命中) this.注销命中 = this.控件层.绑定(this.上下文.资源.命中);
    this.重建();
  }

  // ---- 场景接口 ----

  进入(): void {
    if (typeof window !== "undefined") window.addEventListener("keydown", this.按键);
    this.注销命中 = this.控件层.绑定(this.上下文.资源.命中);
    this.构建();
  }

  退出(): void {
    if (typeof window !== "undefined") window.removeEventListener("keydown", this.按键);
    this.注销命中?.();
    this.注销命中 = null;
    this.控件层.解除绑定();
  }

  /** 从被其他页面压住的状态回来时重建：金币/设置/主题可能已经变了。 */
  恢复(): void {
    this.重建();
  }

  销毁(): void {
    this.退出();
    this.控件层.清空();
  }

  更新(秒: number): void {
    this.控件层.更新(秒);
    this.提示.更新(秒);
    if (this.页面选项.背景 !== false) {
      this.背景时间秒 += 秒;
    }
    if (this.提示.读取列表().length > 0 || this.读取背景动态()) this.上下文.资源.请求重绘();
  }

  protected get 画笔(): 画笔 {
    return this.上下文.资源.画笔;
  }

  渲染(): void {
    const 环境 = this.环境;
    if (this.页面选项.背景 !== false) {
      const 设置 = this.上下文.服务.设置.读取();
      const 外观 = 读取背景外观(设置);
      // 背景配方是引擎无关纯函数：Three 页每帧用画笔.图形重画静态+动态，不自己 clear/提交。
      绘制背景(this.画笔.图形, {
        宽: this.逻辑宽,
        高: this.逻辑高,
        主题: 设置.背景主题,
        动态: this.读取背景动态(),
        时间秒: this.背景时间秒,
      });
      // 浅底背景下压一层主题底色，保证浅色文字/控件的可读性。
      if (外观.文字基调 === "浅底")
        this.画笔.图形.fillStyle(环境.配色.底色, 0.34).fillRect(0, 0, this.逻辑宽, this.逻辑高);
    }
    this.绘制内容(环境);
    this.控件层.绘制(环境);
    this.提示.绘制(环境, this.逻辑宽);
  }

  读取界面(): 界面快照 {
    const 按钮列表: 界面按钮快照[] = this.按钮登记
      .filter((项) => this.控件层.读取控件列表().includes(项.控件))
      .map((项) => {
        const 矩形 = 项.控件.读取矩形();
        return {
          名称: 项.名称,
          左: 矩形.左,
          上: 矩形.上,
          宽: 矩形.宽,
          高: 矩形.高,
          可用: !项.控件.读取禁用(),
        };
      });
    return { 按钮: 按钮列表, 文字: this.读取文字快照() };
  }

  private readonly 按键 = (事件: KeyboardEvent): void => {
    const 当前 = this.上下文.导航.读取当前();
    if (当前.覆盖 !== null || 当前.页面 !== this.页面选项.名称) return;
    if (事件.code === "Escape") this.返回();
  };

  protected 返回(): void {
    this.上下文.导航.返回();
  }

  // ---- 子类实现 ----

  /** 重建控件树：清空控件层与按钮登记后重新添加。 */
  protected abstract 构建(): void;

  /** 绘制静态内容（背景之上、控件之下）。 */
  protected abstract 绘制内容(环境: 绘制环境): void;

  /** 读屏/验收可读的文字状态。 */
  protected 读取文字快照(): readonly string[] {
    return [];
  }

  // ---- 绘制环境与资源 ----

  protected get 环境(): 绘制环境 {
    const 配色 = 主题转界面配色(this.上下文.服务.主题.读取());
    if (!this.环境缓存) {
      this.环境缓存 = {
        配色,
        环境: {
          合批: this.上下文.资源.合批,
          文字: 创建文字服务(this.上下文.资源),
          配色,
        },
      };
    } else {
      // 主题对象每次换算都是新颜色值，直接覆盖配色，避免每帧重建文字服务。
      this.环境缓存.环境.配色 = 配色;
      this.环境缓存.配色 = 配色;
    }
    return this.环境缓存.环境;
  }

  protected 读取配色(): 界面配色 {
    return this.环境.配色;
  }

  protected 读取背景动态(): boolean {
    const 设置 = this.上下文.服务.设置.读取();
    return 设置.背景动态 && 设置.省电模式 !== "开";
  }

  protected 请求重绘(): void {
    this.上下文.资源.请求重绘();
  }

  // ---- 控件构建辅助 ----

  /** 创建一个按钮：加进控件层，有名称时登记到界面快照。 */
  protected 创建按钮(名称: string, 选项: 按钮选项): 按钮 {
    const 控件 = new 按钮(选项);
    this.控件层.添加(控件);
    if (名称) this.按钮登记.push({ 名称, 控件 });
    return 控件;
  }

  /** 创建一个透明命中热区：视觉由共享配方用画笔绘制，命中与快照仍走控件层。 */
  protected 创建热区(选项: 热区选项 & { 名称: string }): 命中热区 {
    const 控件 = new 命中热区(选项);
    this.控件层.添加(控件);
    this.按钮登记.push({ 名称: 选项.名称, 控件 });
    return 控件;
  }

  /** 创建一个透明滑块热区（页面自绘滑块视觉）。 */
  protected 创建滑块(选项: 滑块热区选项): 滑块热区 {
    const 控件 = new 滑块热区(选项);
    this.控件层.添加(控件);
    return 控件;
  }

  /** 创建一个只参与手势的滑动热区（页面自绘手势提示）。 */
  protected 创建滑动热区(选项: 滑动热区选项): 滑动热区 {
    const 控件 = new 滑动热区(选项);
    this.控件层.添加(控件);
    return 控件;
  }

  /** 页面累计的背景动画时间（纯享态/动态背景重画用）。 */
  protected 读取背景时间秒(): number {
    return this.背景时间秒;
  }

  protected 添加控件<控件 extends 控件接口>(控件: 控件): 控件 {
    this.控件层.添加(控件);
    return 控件;
  }

  /** 重建：清空控件与登记后重新构建（设置项变化、列表刷新时调用）。 */
  protected 重建(): void {
    this.控件层.清空();
    this.按钮登记.length = 0;
    this.构建();
    this.请求重绘();
  }

  protected 显示提示(文本: string, 秒 = 1.8): void {
    this.提示.显示(文本, 秒);
    this.请求重绘();
  }

  /** 顶栏：背景衬底 + 标题 + 可选返回按钮。返回顶栏底边 y。 */
  protected 绘制顶栏(环境: 绘制环境, 标题: string): number {
    const 高 = 64;
    绘制顶栏衬底(环境, { 左: 0, 上: 0, 宽: this.逻辑宽, 高 }, 读取背景外观(), 0.78);
    绘制单行文字(
      环境,
      { 左: 16, 上: 0, 宽: this.逻辑宽 - 32, 高 },
      标题,
      "中",
      环境.配色.主字,
      "左",
    );
    return 高;
  }

  /** 添加「返回主菜单」按钮（右上角），子页面通用。 */
  protected 添加返回按钮(文案 = "返回主菜单"): 按钮 {
    return this.创建按钮("返回主菜单", {
      矩形: this.返回按钮矩形(),
      文案,
      字号档: "小",
      变体: "次要",
      圆角: 9,
      点击: () => this.上下文.导航.返回(),
    });
  }

  protected 返回按钮矩形(): 矩形 {
    const 宽 = 96;
    const 高 = 34;
    return { 左: this.逻辑宽 - 宽 - 14, 上: 15, 宽, 高 };
  }

  /** 页面标题文字（顶栏左侧用）。 */
  protected 页面标题(): string {
    return this.页面选项.名称;
  }

  protected 跳转(页面: 页面编号, 参数?: 页面参数): void {
    this.上下文.导航.进入(页面, 参数);
  }
}

/** 创建滚动容器并挂到控件层，返回容器供页面添加列表项。 */
export function 创建滚动区域(控件层: 控件层, 选项: 滚动容器选项): 滚动容器 {
  const 容器 = new 滚动容器(选项);
  控件层.添加(容器);
  return 容器;
}
