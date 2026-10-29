import type { 图形对象 } from "../../../框架/界面/绘制/协议";
import { 像素规范 } from "../../主题/像素/像素规范";
import { 对局像素规格 } from "../../主题/像素/对局像素规格";
import type { 四行庆祝参数, 消行光带参数, 落块拖尾参数, 锁定闪光参数 } from "./消行配方";

const 规 = 对局像素规格.特效;
const 格点 = (值: number) => Math.round(值 / 像素规范.网格) * 像素规范.网格;
const 步进 = (值: number) => Math.floor(Math.max(0, Math.min(1, 值)) * 规.采样步数) / 规.采样步数;

export function 绘制像素落块拖尾(图: 图形对象, 参数: 落块拖尾参数): void {
  const t = 步进(参数.进度);
  if (t >= 1) return;
  const p = 像素规范.网格;
  for (const 列 of 参数.列) {
    const 高 = Math.min(列.底, 参数.拖尾长 * (1 - t));
    const x = 格点((参数.左 ?? 0) + (列.列 + 0.5) * 参数.格);
    for (let i = 0; i < 高 / (p * 规.拖尾格距); i++) {
      const y = 格点((参数.上 ?? 0) + 列.底 - i * p * 规.拖尾格距);
      图.fillStyle(i % 2 ? 参数.色 : 像素规范.色.亮).fillRect(x - p, y - p, p * 2, p);
    }
  }
}

export function 绘制像素锁定闪光(图: 图形对象, 参数: 锁定闪光参数): void {
  if (参数.透明度 <= 0) return;
  const p = 像素规范.网格;
  图.save().setAlpha(参数.透明度).fillStyle(像素规范.色.亮);
  for (const [列, 行] of 参数.格子) {
    const x = (参数.左 ?? 0) + 列 * 参数.格;
    const y = (参数.上 ?? 0) + 行 * 参数.格;
    for (const [横, 纵] of [
      [0, 0],
      [1, 0],
      [0, 1],
      [1, 1],
    ])
      图.fillRect(格点(x + 横 * (参数.格 - p)), 格点(y + 纵 * (参数.格 - p)), p, p);
  }
  图.restore();
}

export function 绘制像素消行(图: 图形对象, 参数: 消行光带参数): void {
  const p = 像素规范.网格;
  for (const [序, 行] of 参数.行.entries()) {
    const 时间 = 参数.时间毫秒 - 序 * 规.消行错峰;
    if (时间 < 0 || 时间 >= 规.消行毫秒) continue;
    const t = 步进(时间 / 规.消行毫秒);
    for (let 列 = 0; 列 < 规.消行粒子; 列++) {
      const x = (参数.左 ?? 0) + (列 + 0.5) * 参数.格;
      const y = (参数.上 ?? 0) + (行 + 0.5) * 参数.格;
      图.fillStyle(列 % 2 ? 像素规范.色.亮 : 参数.强调色);
      if (t < 1 / 规.拖尾格距)
        图.fillRect(格点(x - 参数.格 / 2), 格点(y - p), Math.round(参数.格), p * 2);
      const 距 = (1 + t * 规.粒子外扩) * 参数.格;
      for (const 方向 of [-1, 1])
        图.fillRect(格点(x + (列 % 2 ? -1 : 1) * t * 距), 格点(y + 方向 * t * 距), p, p);
    }
  }
}

export function 绘制像素四行庆祝(图: 图形对象, 参数: 四行庆祝参数): void {
  if (参数.时长毫秒 <= 0 || 参数.时间毫秒 >= 参数.时长毫秒) return;
  const t = 步进(参数.时间毫秒 / 参数.时长毫秒);
  const p = 像素规范.网格;
  const 宽 = 参数.格 * 10;
  const 高 = 参数.格 * 20;
  const 左 = 参数.左 ?? 0;
  const 上 = 参数.上 ?? 0;
  const 帧 = Math.floor(t * 规.采样步数);
  for (let i = 0; i < 规.消行粒子; i++) {
    图.fillStyle((i + 帧) % 2 ? 像素规范.色.黄 : 像素规范.色.红);
    const x = 格点(左 + i * 参数.格);
    图.fillRect(x, 上, p * 2, p).fillRect(x, 上 + 高 - p, p * 2, p);
    const y = 格点(上 + (i * 高) / 规.消行粒子);
    图.fillRect(左, y, p, p * 2).fillRect(左 + 宽 - p, y, p, p * 2);
  }
  const 扫Y = 格点(上 + (参数.扫过起点 ?? 高) * (1 - t));
  图.fillStyle(像素规范.色.亮).fillRect(左, 扫Y, 宽, p);
}
