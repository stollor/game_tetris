import { 填充矩形, 绘制单行文字 } from "../../../框架Three/界面/控件/工具";
import type { 按钮选项 } from "../../../框架Three/界面/控件/按钮";
import { 按钮 } from "../../../框架Three/界面/控件/按钮";
import type { 控件层选项 } from "../../../框架Three/界面/控件/控件层";
import { 控件层 } from "../../../框架Three/界面/控件/控件层";
import type { 滚动容器选项 } from "../../../框架Three/界面/控件/滚动容器";
import { 滚动容器 } from "../../../框架Three/界面/控件/滚动容器";
import type { 控件接口, 界面配色, 矩形, 绘制环境 } from "../../../框架Three/界面/控件/类型";
import { 轻提示队列 } from "../../../框架Three/界面/控件/轻提示";
import { 主题转界面配色, 绘制背景, 绘制顶栏衬底, 读取背景外观 } from "../主题";
import type { 界面快照, 界面按钮快照, 页面上下文, 页面实例, 页面编号 } from "../接口/上下文";
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

interface 按钮登记项 {
  名称: string;
  控件: 按钮;
}

export abstract class 页面基类 implements 页面实例 {
  protected readonly 上下文: 页面上下文;
  protected readonly 控件层: 控件层;
  protected readonly 提示 = new 轻提示队列();
  protected readonly 逻辑宽: number;
  protected readonly 逻辑高: number;
  private readonly 页面选项: 页面选项;
  private readonly 按钮登记: 按钮登记项[] = [];
  private 注销命中: (() => void) | null = null;
  private 环境缓存: { 配色: 界面配色; 环境: 绘制环境 } | null = null;
  private 背景时间秒 = 0;

  constructor(上下文: 页面上下文, 选项: 页面选项) {
    this.上下文 = 上下文;
    this.页面选项 = 选项;
    this.逻辑宽 = 上下文.资源.逻辑宽;
    this.逻辑高 = 上下文.资源.逻辑高;
    this.控件层 = new 控件层({
      名称: 选项.名称,
      深度: 选项.深度 ?? 0,
      独占: 选项.独占 ?? false,
      逻辑尺寸: { 宽: this.逻辑宽, 高: this.逻辑高 },
    } satisfies 控件层选项);
  }

  // ---- 场景接口 ----

  进入(): void {
    this.注销命中 = this.控件层.绑定(this.上下文.资源.命中);
    this.构建();
  }

  退出(): void {
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

  渲染(): void {
    const 环境 = this.环境;
    if (this.页面选项.背景 !== false) {
      const 外观 = 读取背景外观();
      绘制背景(环境, { 左: 0, 上: 0, 宽: this.逻辑宽, 高: this.逻辑高 }, 外观, {
        时间秒: this.背景时间秒,
        动态: this.读取背景动态(),
      });
      // 浅底背景下压一层主题底色，保证浅色文字/控件的可读性。
      if (外观.文字基调 === "浅底")
        填充矩形(
          环境.合批,
          环境.文字.读取纯色紫外线(),
          { 左: 0, 上: 0, 宽: this.逻辑宽, 高: this.逻辑高 },
          环境.配色.底色,
          0.34,
        );
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

  protected 跳转(页面: 页面编号): void {
    this.上下文.导航.进入(页面);
  }
}

/** 创建滚动容器并挂到控件层，返回容器供页面添加列表项。 */
export function 创建滚动区域(控件层: 控件层, 选项: 滚动容器选项): 滚动容器 {
  const 容器 = new 滚动容器(选项);
  控件层.添加(容器);
  return 容器;
}
