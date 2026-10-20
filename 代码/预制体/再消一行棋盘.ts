import Phaser from "phaser";
import { 创建画面层, type 画面层 } from "../../框架/绘画/图层资源";
import { 禁用性能项 } from "../开发/性能开关";
import { 获取烘焙贴图, 设为动态层 } from "../性能/图形烘焙";
import { 获取纹理预算 } from "../性能/纹理缓存";
import {
  type 再消一行状态,
  可以放置,
  可见高度,
  type 方块类型,
  棋盘宽度,
  type 活动方块,
  读取格子,
  隐藏高度,
} from "../玩法/再消一行";
import { 绘制方块单元预制体, 绘制方块辉光 } from "../界面/方块单元";
import { 创建图像池, type 图像池 } from "../视觉/图像池";
import { 绘制棋盘外框, 绘制棋盘网格 } from "../视觉/对局界面配方";
import { 消行特效 } from "../视觉/消行特效";
import { 落块特效 } from "../视觉/落块特效";
import { 获取游戏设置 } from "../配置/再消一行设置";
import { 游戏外观 } from "../配置/游戏外观";
import { 界面主题, 颜色值 } from "../配置/界面主题";

const 空画面: 画面层 = {
  设置尺寸() {},
  开始() {},
  放置() {},
  结束() {},
  取消() {},
  销毁() {},
};

/** 游戏棋盘预制体：负责棋盘框体、固定方块、活动方块与投影分层绘制。 */
export class 再消一行棋盘 extends Phaser.GameObjects.Container {
  private readonly 框体: Phaser.GameObjects.Graphics;
  private readonly 网格层: Phaser.GameObjects.Graphics;
  private readonly 固定辉光层: Phaser.GameObjects.Graphics;
  private readonly 固定层: Phaser.GameObjects.Graphics;
  private readonly 活动辉光层: Phaser.GameObjects.Graphics;
  private readonly 活动层: Phaser.GameObjects.Graphics;
  private readonly 固定格: 画面层;
  private readonly 固定辉光: 画面层;
  private readonly 活动格: 图像池;
  private readonly 活动辉光: 图像池;
  private 贴图方块 = true;
  private 固定绘制签名 = "";
  private 活动绘制签名 = "";
  private readonly 消除效果: 消行特效;
  private 上次消行事件 = 0;
  private 上次落块事件 = 0;
  private readonly 落块效果: 落块特效;
  private 原X = 0;
  private 原Y = 0;
  private 镜头原位 = { x: 0, y: 0 };
  private 震动剩余 = 0;
  private 震动强度 = 0;
  private 震动时长 = 0;
  private 格子大小 = 24;
  private 落点影透明度 = 100;

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0);
    this.框体 = scene.add.graphics();
    this.网格层 = scene.add.graphics();
    this.固定辉光层 = scene.add.graphics().setName("board.fixed-glow");
    this.固定辉光层.setBlendMode(Phaser.BlendModes.ADD);
    this.固定层 = scene.add.graphics().setName("board.fixed");
    this.活动辉光层 = scene.add.graphics().setName("board.active-glow");
    this.活动辉光层.setBlendMode(Phaser.BlendModes.ADD);
    this.活动层 = scene.add.graphics().setName("board.active");
    for (const 层 of [this.固定辉光层, this.固定层, this.活动辉光层, this.活动层]) {
      设为动态层(层);
      层.setVisible(false);
    }
    const 固定辉光容器 = scene.add.container();
    const 固定容器 = scene.add.container();
    const 活动辉光容器 = scene.add.container();
    const 活动容器 = scene.add.container();
    this.add([
      this.框体,
      this.网格层,
      固定辉光容器,
      this.固定辉光层,
      固定容器,
      this.固定层,
      活动辉光容器,
      this.活动辉光层,
      活动容器,
      this.活动层,
    ]);
    const 宽 = 棋盘宽度 * this.格子大小;
    const 高 = 可见高度 * this.格子大小;
    this.固定辉光 = this.建立画面(固定辉光容器, 宽, 高, Phaser.BlendModes.ADD);
    this.固定格 = this.建立画面(固定容器, 宽, 高);
    // 活动块几乎每帧都变，盖进画面层会每帧整层重画。这里只留当前这一块的几张图。
    this.活动辉光 = 创建图像池(scene, 活动辉光容器, {
      混合: Phaser.BlendModes.ADD,
      空闲上限: 8,
    });
    this.活动格 = 创建图像池(scene, 活动容器, { 空闲上限: 8 });
    if (!this.贴图方块) {
      this.固定辉光.销毁();
      this.固定格.销毁();
      this.活动辉光.销毁();
      this.活动格.销毁();
    }
    this.once("destroy", () => {
      this.固定辉光.销毁();
      this.固定格.销毁();
      this.活动辉光.销毁();
      this.活动格.销毁();
    });
    this.消除效果 = new 消行特效(scene);
    this.落块效果 = new 落块特效(scene);
    this.add([this.落块效果, this.消除效果]);
    this.setDepth(1);
    scene.add.existing(this);
  }

  布局(左: number, 顶: number, 格子大小: number, 透明度: number, 显示网格 = true): this {
    this.镜头原位 = { x: this.scene.cameras.main.scrollX, y: this.scene.cameras.main.scrollY };
    this.原X = 左;
    this.原Y = 顶;
    this.setPosition(左, 顶);
    this.框体.clear();
    this.格子大小 = 格子大小;
    this.消除效果.设置格子(格子大小);
    this.落块效果.设置格子(格子大小);
    this.网格层.setVisible(显示网格);
    const 宽 = 棋盘宽度 * 格子大小;
    const 高 = 可见高度 * 格子大小;
    this.固定格.设置尺寸(宽, 高);
    this.固定辉光.设置尺寸(宽, 高);
    const 背景色 = 游戏外观.棋盘.背景色;
    const 边框色 = 游戏外观.棋盘.边框色;
    绘制棋盘外框(this.框体, {
      左: 0,
      上: 0,
      宽,
      高,
      格子: 格子大小,
      透明度,
      背景色,
      边框色,
    });
    // 内部网格
    this.网格层.clear();
    绘制棋盘网格(this.网格层, {
      宽,
      高,
      格子: 格子大小,
      列数: 棋盘宽度,
      行数: 可见高度,
      网格色: 颜色值(界面主题().游戏区域.网格线),
    });
    return this;
  }

  更新特效(毫秒: number): void {
    if (!禁用性能项("消行特效")) this.消除效果.更新(毫秒);
    if (!禁用性能项("落块特效")) this.落块效果.更新(毫秒);
    this.震动剩余 = Math.max(0, this.震动剩余 - 毫秒);
    const 进度 = this.震动时长 ? 1 - this.震动剩余 / this.震动时长 : 1;
    const 幅度 = (1 - 进度) ** 2 * this.震动强度;
    this.scene.cameras.main.setScroll(
      this.镜头原位.x + Math.cos(进度 * Math.PI * 12) * 幅度 * 0.55,
      this.镜头原位.y + Math.sin(进度 * Math.PI * 15 + Math.PI / 2) * 幅度,
    );
  }
  播放硬降(格子: [number, number][], 距离: number, 类型: 方块类型) {
    if (!禁用性能项("落块特效")) this.落块效果.硬降(格子, 距离, 类型);
    if (距离 > 0 && !this.震动剩余) this.播放震动(150, 2.5);
  }
  private 播放震动(时长: number, 强度: number): void {
    this.震动时长 = 时长;
    this.震动剩余 = 时长;
    this.震动强度 = 强度;
    this.更新特效(0);
  }
  获取震屏状态() {
    return {
      剩余: this.震动剩余,
      强度: this.震动强度,
      x: this.scene.cameras.main.scrollX - this.镜头原位.x,
      y: this.scene.cameras.main.scrollY - this.镜头原位.y,
    };
  }
  获取落块特效状态() {
    return this.落块效果.快照();
  }
  获取特效状态() {
    return this.消除效果.快照();
  }
  更新(状态: 再消一行状态): this {
    const 落块 = 状态.落块事件;
    if (落块 && 落块.序号 !== this.上次落块事件) {
      this.上次落块事件 = 落块.序号;
      if (!禁用性能项("落块特效")) this.落块效果.锁定(落块);
      if (落块.行数) {
        this.播放震动(落块.行数 === 4 ? 360 : 220, 落块.行数 === 4 ? 7 : 2 + 落块.行数);
      }
    }
    if (!落块 && this.上次落块事件) {
      this.上次落块事件 = 0;
      this.落块效果.清空();
      this.震动剩余 = 0;
      this.scene.cameras.main.setScroll(this.镜头原位.x, this.镜头原位.y);
      this.setPosition(this.原X, this.原Y);
    }
    const 事件 = 状态.消行事件;
    if (事件 && 事件.序号 !== this.上次消行事件) {
      this.上次消行事件 = 事件.序号;
      if (!禁用性能项("消行特效")) this.消除效果.播放(事件);
    }
    if (!事件 && this.上次消行事件) {
      this.上次消行事件 = 0;
      this.消除效果.清空();
    }
    // 固定层只随棋盘内容/格子尺寸/方块外观失效；活动层还依赖当前方块、阶段与落点影。
    const 方块颜色 = 游戏外观.方块.颜色;
    const 方块外观 = 获取游戏设置().方块外观;
    const 固定签名 = JSON.stringify([状态.棋盘, this.格子大小, 方块颜色, 方块外观]);
    if (固定签名 !== this.固定绘制签名) {
      this.固定绘制签名 = 固定签名;
      this.绘制固定块(状态);
    }
    // 幽灵落点依赖棋盘，所以活动签名包含固定签名。
    const 活动签名 = JSON.stringify([
      固定签名,
      状态.当前方块,
      状态.阶段,
      this.落点影透明度,
      this.格子大小,
      方块颜色,
      方块外观,
    ]);
    if (活动签名 === this.活动绘制签名) return this;
    this.活动绘制签名 = 活动签名;
    this.绘制活动块(状态);
    return this;
  }

  private 绘制固定块(状态: 再消一行状态): void {
    this.固定层.clear();
    this.固定辉光层.clear();
    const 格: { 列: number; 行: number; 类型: 方块类型 }[] = [];
    for (let 行 = 0; 行 < 可见高度; 行 += 1) {
      for (let 列 = 0; 列 < 棋盘宽度; 列 += 1) {
        const 类型 = 状态.棋盘[行 + 隐藏高度]?.[列];
        if (类型) 格.push({ 列, 行, 类型 });
      }
    }
    if (this.贴图方块 && this.贴一层(this.固定格, this.固定辉光, 格, 0.86, false)) {
      this.固定层.setVisible(false);
      this.固定辉光层.setVisible(false);
      return;
    }
    this.贴图方块 = false;
    this.改回矢量(this.固定格, this.固定辉光, this.固定层, this.固定辉光层);
    for (const 项 of 格)
      this.绘制格(this.固定层, this.固定辉光层, 项.列, 项.行, 项.类型, 0.86, false);
  }

  private 绘制活动块(状态: 再消一行状态): void {
    this.活动层.clear();
    this.活动辉光层.clear();
    if (状态.阶段 === "结束") {
      this.活动格.取消();
      this.活动辉光.取消();
      return;
    }

    const 幽灵: 活动方块 = {
      ...状态.当前方块,
      格子: 状态.当前方块.格子.map((格子) => ({ ...格子 })),
    };
    while (
      可以放置(状态, {
        ...幽灵,
        格子: 幽灵.格子.map((格子) => ({ ...格子, 行2: 格子.行2 + 2 })),
      })
    ) {
      for (const 格子 of 幽灵.格子) 格子.行2 += 2;
    }
    const 幽灵格 = 读取格子(幽灵).map(([列, 行]) => ({ 列, 行, 类型: 幽灵.类型 }));
    const 实体格 = 读取格子(状态.当前方块).map(([列, 行]) => ({
      列,
      行,
      类型: 状态.当前方块.类型,
    }));
    if (this.贴图方块) {
      this.活动格.开始();
      this.活动辉光.开始();
      const 幽灵成 = 幽灵格.every((项) =>
        this.贴活动(项.列, 项.行, 项.类型, this.落点影透明度 / 100, true),
      );
      const 实体成 = 幽灵成 && 实体格.every((项) => this.贴活动(项.列, 项.行, 项.类型, 1, false));
      if (实体成) {
        this.活动格.结束();
        this.活动辉光.结束();
        this.活动层.setVisible(false);
        this.活动辉光层.setVisible(false);
        return;
      }
    }
    this.贴图方块 = false;
    this.改回矢量(this.活动格, this.活动辉光, this.活动层, this.活动辉光层);
    for (const 项 of 幽灵格)
      this.绘制格(
        this.活动层,
        this.活动辉光层,
        项.列,
        项.行,
        项.类型,
        this.落点影透明度 / 100,
        true,
      );
    for (const 项 of 实体格)
      this.绘制格(this.活动层, this.活动辉光层, 项.列, 项.行, 项.类型, 1, false);
  }

  private 贴一层(
    实体: 画面层,
    辉光: 画面层,
    格: { 列: number; 行: number; 类型: 方块类型 }[],
    透明度: number,
    幽灵: boolean,
  ): boolean {
    实体.开始();
    辉光.开始();
    for (const 项 of 格) {
      if (!this.贴格(实体, 辉光, 项.列, 项.行, 项.类型, 透明度, 幽灵)) return false;
    }
    实体.结束();
    辉光.结束();
    return true;
  }

  private 改回矢量(
    实体: { 取消(): void },
    辉光: { 取消(): void },
    格子图层: Phaser.GameObjects.Graphics,
    辉光图层: Phaser.GameObjects.Graphics,
  ): void {
    实体.取消();
    辉光.取消();
    格子图层.setVisible(true);
    辉光图层.setVisible(true);
  }

  private 贴格(
    实体: 画面层,
    辉光: 画面层,
    列: number,
    行: number,
    类型: 方块类型,
    透明度: number,
    幽灵: boolean,
  ): boolean {
    if (行 < 0) return true;
    const 格子 = this.格子大小;
    const x = 列 * 格子 + 1.5;
    const y = 行 * 格子 + 1.5;
    const 外观 = {
      色值: 游戏外观.方块.颜色[类型],
      格子,
      透明度: 幽灵 ? 1 : 透明度,
      圆角比例: 0.16,
      幽灵,
    };
    const 成功 = this.盖章(
      实体,
      this.方块键(幽灵 ? "幽灵" : "实体", 外观),
      (图) => 绘制方块单元预制体(图, 0, 0, 外观),
      x,
      y,
      幽灵 ? 透明度 : 1,
    );
    if (!成功) return false;
    if (幽灵 || 透明度 < 0.8) return true;
    return this.盖章(辉光, this.方块键("辉光", 外观), (图) => 绘制方块辉光(图, 0, 0, 外观), x, y);
  }

  private 贴活动(列: number, 行: number, 类型: 方块类型, 透明度: number, 幽灵: boolean): boolean {
    if (行 < 0) return true;
    const 格子 = this.格子大小;
    const x = 列 * 格子 + 1.5;
    const y = 行 * 格子 + 1.5;
    const 外观 = {
      色值: 游戏外观.方块.颜色[类型],
      格子,
      透明度: 幽灵 ? 1 : 透明度,
      圆角比例: 0.16,
      幽灵,
    };
    const 成功 = this.活动格.放置(
      this.方块键(幽灵 ? "幽灵" : "实体", 外观),
      (图) => 绘制方块单元预制体(图, 0, 0, 外观),
      x,
      y,
      (图) => {
        if (幽灵) 图.setAlpha(透明度);
      },
    );
    if (!成功) return false;
    if (幽灵 || 透明度 < 0.8) return true;
    return this.活动辉光.放置(
      this.方块键("辉光", 外观),
      (图) => 绘制方块辉光(图, 0, 0, 外观),
      x,
      y,
    );
  }

  private 建立画面(
    父: Phaser.GameObjects.Container,
    宽: number,
    高: number,
    混合?: Phaser.BlendModes,
  ): 画面层 {
    const 预算 = 获取纹理预算(this.scene);
    const 放开 = new Map<string, () => void>();
    const 层 = 创建画面层(this.scene, 父, {
      宽,
      高,
      混合,
      登记: (键, 像素, 释放) => {
        预算.登记(键, 像素, 释放);
        放开.set(键, 预算.引用(键));
      },
      移除: (键) => {
        放开.get(键)?.();
        放开.delete(键);
        预算.移除(键);
      },
    });
    if (层) return 层;
    this.贴图方块 = false;
    return 空画面;
  }

  private 盖章(
    层: 画面层,
    键: string,
    绘制: (图: Phaser.GameObjects.Graphics) => void,
    x: number,
    y: number,
    透明 = 1,
  ): boolean {
    const 贴 = 获取烘焙贴图(this.scene, 键, 绘制);
    if (!贴) return false;
    const 帧 = this.scene.textures.get(贴.键).get(贴.帧 ?? "__BASE");
    层.放置(
      {
        键: 贴.键,
        帧: 贴.帧,
        原点X: (-贴.左 * 贴.比) / Math.max(1, 帧.width),
        原点Y: (-贴.顶 * 贴.比) / Math.max(1, 帧.height),
        缩放X: 1 / 贴.比,
        缩放Y: 1 / 贴.比,
      },
      x,
      y,
      透明,
    );
    return true;
  }

  private 方块键(
    种类: string,
    外观: { 色值: number; 格子: number; 透明度?: number; 圆角比例?: number },
  ): string {
    return `方块.${获取游戏设置().方块外观}.${种类}.${外观.色值}.${外观.格子.toFixed(2)}.${(外观.圆角比例 ?? 0.16).toFixed(2)}.${(外观.透明度 ?? 1).toFixed(2)}`;
  }

  设置落点影透明度(透明度: number): this {
    this.落点影透明度 = Phaser.Math.Clamp(透明度, 0, 100);
    return this;
  }

  设置网格显示(显示: boolean): this {
    this.网格层.setVisible(显示);
    return this;
  }

  private 绘制格(
    格子图层: Phaser.GameObjects.Graphics,
    辉光图层: Phaser.GameObjects.Graphics,
    列: number,
    行: number,
    类型: 方块类型,
    透明度: number,
    幽灵: boolean,
  ): void {
    if (行 < 0) return;
    const 格子 = this.格子大小;
    const x = 列 * 格子 + 1.5;
    const y = 行 * 格子 + 1.5;
    const 外观 = {
      色值: 游戏外观.方块.颜色[类型],
      格子,
      透明度,
      圆角比例: 0.16,
      幽灵,
    };
    绘制方块单元预制体(格子图层, x, y, 外观);
    if (!幽灵 && 透明度 >= 0.8) 绘制方块辉光(辉光图层, x, y, 外观);
  }
}
