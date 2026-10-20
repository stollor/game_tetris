import Phaser from "phaser";
import { 混色 } from "../../框架/界面/颜色工具";
import {
  引用烘焙贴图,
  type 替身项,
  获取替身贴图,
  获取烘焙贴图,
  设为动态层,
  设置替身贴图,
} from "../性能/图形烘焙";
import { 应重绘动态背景 } from "../性能/画质";
import { 查找地点 } from "../框架配置/旅行地点";
import type { 背景主题 } from "../配置/再消一行设置";
import { 背景主题选项, 背景主题配置 } from "../配置/背景主题";
import { 移动极光替身 } from "./极光演出";
import { 绘制背景动态 as 共享绘制背景动态, 绘制背景静底 } from "./背景配方";
import { 云朵参数 } from "./背景配方/内置主题";
import { 绘制云朵 } from "./背景配方/通用";

/**
 * Phaser 侧背景入口：导出与签名保持不变，绘制委托 `代码/视觉/背景配方.ts` 的共享纯函数。
 * 本文件只保留 Phaser 专有的部分：Graphics 清屏/缩放、动态层性能门控、云朵与极光替身烘焙。
 */

export { 背景主题选项 };

/** 绘制随画布尺寸重排的程序化场景底图。 */
export function 绘制霓虹背景(
  图形: Phaser.GameObjects.Graphics,
  宽: number,
  高: number,
  主题: 背景主题 = "晨光海岸",
  静态主体 = true,
): void {
  图形.clear().setScale(1);
  绘制背景静底(图形, { 宽, 高, 主题, 静态主体 });
}

/** 只重绘独立动态层，底图保持静态以减少每帧绘图开销。 */
export function 绘制动态霓虹细节(
  图形: Phaser.GameObjects.Graphics,
  宽: number,
  高: number,
  时间: number,
  主题: 背景主题 = "晨光海岸",
  播放 = true,
  允许闲置降频 = true,
): void {
  设为动态层(图形);
  if (!播放 && !图形.commandBuffer.length && !获取替身贴图(图形)) return;
  if (播放 && !应重绘动态背景(图形, 时间, 允许闲置降频)) return;
  图形.clear().setScale(1);
  if (!播放 || (主题 !== "云海山岚" && 主题 !== "极光原野")) 设置替身贴图(图形, undefined);
  if (!播放) return;
  const 地点 = 查找地点(主题);
  if (地点) {
    共享绘制背景动态(图形, { 宽, 高, 主题, 时间秒: 时间 / 1000 });
    图形.setAlpha(1);
    return;
  }
  const 配置 = 背景主题配置[主题];
  const 动画时间 = 时间 * 配置.动画速度;
  let 已用替身 = false;
  if (主题 === "云海山岚") 已用替身 = 移动云层替身(图形, 宽, 高, 动画时间);
  else if (主题 === "极光原野") 已用替身 = 移动极光替身(图形, 宽, 高, 动画时间);
  if (!已用替身) 共享绘制背景动态(图形, { 宽, 高, 主题, 时间秒: 时间 / 1000, 亮度: 1 });
  图形.setAlpha(配置.动画亮度);
}

/* ------------------------------------------------------------------ */
/* 云层烘焙替身（Phaser 专有优化）                                       */
/* ------------------------------------------------------------------ */

const 云替身签名 = new WeakMap<Phaser.GameObjects.Graphics, string>();

function 移动云层替身(
  图形: Phaser.GameObjects.Graphics,
  宽: number,
  高: number,
  时间: number,
  颜色 = 0xffffff,
  透明度 = 0.5,
): boolean {
  const 场景 = 图形.scene;
  if (!场景 || 场景.game.renderer.type !== Phaser.WEBGL) return false;
  const 签名 = `${宽}x${高}@${场景.cameras.main.zoom}`;
  let 列表 = 获取替身贴图(图形);
  if (!列表 || 云替身签名.get(图形) !== 签名) {
    设置替身贴图(图形, undefined);
    const 新列表: 替身项[] = [];
    for (let i = 0; i < 5; i += 1) {
      const { 尺寸 } = 云朵参数(i, 宽, 高, 0);
      const 暗部 = 混色(颜色, 0x6d87a8, 0.45);
      const 基准 = 64;
      const 贴 = 获取烘焙贴图(场景, `云朵.${颜色}.${透明度}`, (g) =>
        绘制云朵(g, 0, 0, 基准, 颜色, 暗部, 透明度),
      );
      if (!贴) {
        for (const 项 of 新列表) 项.贴图.destroy();
        return false;
      }
      const 图 = 场景.make.image(
        { key: 贴.键, frame: 贴.帧 } as Phaser.Types.GameObjects.Sprite.SpriteConfig,
        false,
      );
      引用烘焙贴图(图);
      图
        .setOrigin((-贴.左 * 贴.比) / 图.width, (-贴.顶 * 贴.比) / 图.height)
        .setScale(尺寸 / 基准 / 贴.比);
      新列表.push({ 贴图: 图, x: 0, y: 0, 透明度: 1 });
    }
    设置替身贴图(图形, 新列表);
    云替身签名.set(图形, 签名);
    列表 = 新列表;
  }
  列表.forEach((项, i) => {
    const { x, y } = 云朵参数(i, 宽, 高, 时间);
    项.x = x;
    项.y = y;
  });
  return true;
}
