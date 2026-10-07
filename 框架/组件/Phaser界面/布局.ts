import type Phaser from "phaser";
import { type 控件尺寸, 界面控件 } from "./控件";

export type 布局方向 = "水平" | "垂直";
export type 布局对齐 = "起始" | "居中" | "末尾" | "拉伸";

export interface 布局内边距 {
  上?: number;
  右?: number;
  下?: number;
  左?: number;
}

export interface 界面布局配置 {
  方向: 布局方向;
  宽?: number;
  高?: number;
  间距?: number;
  内边距?: number | 布局内边距;
  主轴对齐?: 布局对齐;
  交叉轴对齐?: 布局对齐;
  自动主轴尺寸?: boolean;
  自动交叉轴尺寸?: boolean;
  自动换行?: boolean;
}

export interface 布局子项配置 {
  宽?: number;
  高?: number;
  伸展?: number;
  间距后?: number;
}

type 可布局节点 = Phaser.GameObjects.GameObject & {
  x: number;
  y: number;
  width?: number;
  height?: number;
  setPosition: (x: number, y: number) => unknown;
};

interface 布局子项 {
  节点: 可布局节点;
  配置: 布局子项配置;
}

function 获取尺寸(节点: 可布局节点, 配置: 布局子项配置): 控件尺寸 {
  const 控件尺寸 = 节点 instanceof 界面控件 ? 节点.获取首选尺寸() : null;
  return {
    宽: 配置.宽 ?? 控件尺寸?.宽 ?? 节点.width ?? 0,
    高: 配置.高 ?? 控件尺寸?.高 ?? 节点.height ?? 0,
  };
}

function 获取内边距(值: number | 布局内边距 | undefined): Required<布局内边距> {
  if (typeof 值 === "number") return { 上: 值, 右: 值, 下: 值, 左: 值 };
  return {
    上: 值?.上 ?? 0,
    右: 值?.右 ?? 0,
    下: 值?.下 ?? 0,
    左: 值?.左 ?? 0,
  };
}

/** 嵌套式水平、垂直和换行布局；子控件按首选尺寸排列，可指定伸展比例。 */
export class 界面布局 extends 界面控件 {
  private readonly 子项: 布局子项[] = [];
  private readonly 方向: 布局方向;
  private readonly 间距: number;
  private readonly 内边距: Required<布局内边距>;
  private readonly 主轴对齐: 布局对齐;
  private readonly 交叉轴对齐: 布局对齐;
  private readonly 自动主轴尺寸: boolean;
  private readonly 自动交叉轴尺寸: boolean;
  private readonly 自动换行: boolean;
  private 布局宽: number;
  private 布局高: number;

  constructor(scene: Phaser.Scene, x: number, y: number, 配置: 界面布局配置) {
    super(scene, x, y, 配置.宽 ?? 0, 配置.高 ?? 0);
    this.方向 = 配置.方向;
    this.间距 = 配置.间距 ?? 0;
    this.内边距 = 获取内边距(配置.内边距);
    this.主轴对齐 = 配置.主轴对齐 ?? "起始";
    this.交叉轴对齐 = 配置.交叉轴对齐 ?? "居中";
    this.自动主轴尺寸 = 配置.自动主轴尺寸 ?? false;
    this.自动交叉轴尺寸 = 配置.自动交叉轴尺寸 ?? false;
    this.自动换行 = 配置.自动换行 ?? false;
    this.布局宽 = 配置.宽 ?? 0;
    this.布局高 = 配置.高 ?? 0;
    scene.add.existing(this);
  }

  添加(节点: Phaser.GameObjects.GameObject, 配置: 布局子项配置 = {}): this {
    const 可布局对象 = 节点 as 可布局节点;
    this.子项.push({ 节点: 可布局对象, 配置 });
    this.add(可布局对象);
    this.重新排列();
    return this;
  }

  设置布局尺寸(宽: number, 高: number): this {
    this.布局宽 = 宽;
    this.布局高 = 高;
    this.重新排列();
    return this;
  }

  重新排列(): this {
    const 横向 = this.方向 === "水平";
    const 主轴可用 = Math.max(
      0,
      横向
        ? this.布局宽 - this.内边距.左 - this.内边距.右
        : this.布局高 - this.内边距.上 - this.内边距.下,
    );
    const 交叉轴可用 = Math.max(
      0,
      横向
        ? this.布局高 - this.内边距.上 - this.内边距.下
        : this.布局宽 - this.内边距.左 - this.内边距.右,
    );
    const 测量 = this.子项.map(({ 节点, 配置 }) => ({
      节点,
      配置,
      尺寸: 获取尺寸(节点, 配置),
    }));

    if (this.自动换行 && 横向) {
      this.排列换行(测量, 主轴可用);
      return this;
    }

    const 间距总和 = 测量
      .slice(0, -1)
      .reduce((总和, 项) => 总和 + (项.配置.间距后 ?? this.间距), 0);
    const 首选主轴总和 = 测量.reduce((总和, 项) => 总和 + (横向 ? 项.尺寸.宽 : 项.尺寸.高), 0);
    const 伸展总和 = 测量.reduce((总和, 项) => 总和 + (项.配置.伸展 ?? 0), 0);
    const 空余 = Math.max(0, 主轴可用 - 首选主轴总和 - 间距总和);
    const 主轴尺寸 = 测量.map((项) => {
      const 首选 = 横向 ? 项.尺寸.宽 : 项.尺寸.高;
      return 首选 + (伸展总和 > 0 ? (空余 * (项.配置.伸展 ?? 0)) / 伸展总和 : 0);
    });

    if (this.自动主轴尺寸) {
      const 内容尺寸 = 主轴尺寸.reduce((总和, 尺寸) => 总和 + 尺寸, 0) + 间距总和;
      if (横向) this.布局宽 = 内容尺寸 + this.内边距.左 + this.内边距.右;
      else this.布局高 = 内容尺寸 + this.内边距.上 + this.内边距.下;
      this.更新首选尺寸(this.布局宽, this.布局高);
    } else {
      this.setSize(this.布局宽, this.布局高);
    }

    const 主轴总计 = 主轴尺寸.reduce((总和, 尺寸) => 总和 + 尺寸, 0) + 间距总和;
    const 留白 = Math.max(0, 主轴可用 - 主轴总计);
    let 游标 = 横向 ? -this.布局宽 / 2 + this.内边距.左 : -this.布局高 / 2 + this.内边距.上;
    if (this.主轴对齐 === "居中") 游标 += 留白 / 2;
    if (this.主轴对齐 === "末尾") 游标 += 留白;

    测量.forEach((项, 索引) => {
      const 主轴长 = 主轴尺寸[索引] ?? 0;
      const 首选交叉 = 横向 ? 项.尺寸.高 : 项.尺寸.宽;
      const 交叉长 = this.交叉轴对齐 === "拉伸" ? 交叉轴可用 : 首选交叉;
      const 交叉起点 = 横向 ? -this.布局高 / 2 + this.内边距.上 : -this.布局宽 / 2 + this.内边距.左;
      const 交叉剩余 = Math.max(0, 交叉轴可用 - 交叉长);
      const 交叉偏移 =
        this.交叉轴对齐 === "居中" || this.交叉轴对齐 === "拉伸"
          ? 交叉剩余 / 2
          : this.交叉轴对齐 === "末尾"
            ? 交叉剩余
            : 0;
      const 主轴中心 = 游标 + 主轴长 / 2;
      const 交叉中心 = 交叉起点 + 交叉偏移 + 交叉长 / 2;

      if (项.节点 instanceof 界面控件) {
        项.节点.设置布局尺寸(横向 ? 主轴长 : 交叉长, 横向 ? 交叉长 : 主轴长);
      }
      项.节点.setPosition(横向 ? 主轴中心 : 交叉中心, 横向 ? 交叉中心 : 主轴中心);
      游标 += 主轴长 + (项.配置.间距后 ?? this.间距);
    });

    return this;
  }

  private 排列换行(
    项目: Array<{ 节点: 可布局节点; 配置: 布局子项配置; 尺寸: 控件尺寸 }>,
    可用宽: number,
  ): void {
    const 行: (typeof 项目)[] = [];
    let 当前行: typeof 项目 = [];
    let 当前行宽 = 0;
    for (const 项 of 项目) {
      const 宽度 = 项.尺寸.宽;
      const 加宽 = 当前行.length ? this.间距 : 0;
      if (当前行.length && 当前行宽 + 加宽 + 宽度 > 可用宽) {
        行.push(当前行);
        当前行 = [];
        当前行宽 = 0;
      }
      if (当前行.length) 当前行宽 += this.间距;
      当前行.push(项);
      当前行宽 += 宽度;
    }
    if (当前行.length) 行.push(当前行);

    const 行高 = 行.map((当前) => Math.max(...当前.map((项) => 项.尺寸.高)));
    const 内容高 = 行高.reduce((总和, 高) => 总和 + 高, 0) + Math.max(0, 行.length - 1) * this.间距;
    if (this.自动交叉轴尺寸) {
      this.布局高 = 内容高 + this.内边距.上 + this.内边距.下;
      this.更新首选尺寸(this.布局宽, this.布局高);
    } else if (this.自动主轴尺寸) {
      this.布局高 = 内容高 + this.内边距.上 + this.内边距.下;
      this.更新首选尺寸(this.布局宽, this.布局高);
    } else {
      this.setSize(this.布局宽, this.布局高);
    }
    let 当前Y = -this.布局高 / 2 + this.内边距.上;
    行.forEach((当前, 行索引) => {
      const 高度 = 行高[行索引] ?? 0;
      const 行宽 =
        当前.reduce((总和, 项) => 总和 + 项.尺寸.宽, 0) + Math.max(0, 当前.length - 1) * this.间距;
      let 当前X =
        this.主轴对齐 === "居中"
          ? -this.布局宽 / 2 + this.内边距.左 + Math.max(0, 可用宽 - 行宽) / 2
          : this.主轴对齐 === "末尾"
            ? -this.布局宽 / 2 + this.内边距.左 + Math.max(0, 可用宽 - 行宽)
            : -this.布局宽 / 2 + this.内边距.左;
      for (const 项 of 当前) {
        const 宽度 = 项.尺寸.宽;
        const 交叉偏移 = this.交叉轴对齐 === "起始" ? 0 : (高度 - 项.尺寸.高) / 2;
        if (项.节点 instanceof 界面控件) 项.节点.设置布局尺寸(宽度, 项.尺寸.高);
        项.节点.setPosition(当前X + 宽度 / 2, 当前Y + 交叉偏移 + 项.尺寸.高 / 2);
        当前X += 宽度 + this.间距;
      }
      当前Y += 高度 + this.间距;
    });
  }
}
