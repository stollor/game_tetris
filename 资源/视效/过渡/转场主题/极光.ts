import type { 图形对象 } from "../../../../.gamemaker/依赖/框架/界面/绘制/协议";
import { 亮色, 混色 } from "../../../../.gamemaker/依赖/框架/界面/颜色工具";
import { 入场参数 } from "../入场参数";
import { 读取幕色 } from "./幕色";
import type { 幕面参数, 接缝参数, 节拍底纹参数, 转场画法 } from "./类型";

/**
 * 极光原野（默认主题）的转场：沿用原来的霓虹玻璃语汇 —— 幕外深、幕内浅、接缝亮带，
 * 再补两道随合拢上行的极光斜带。它是其余四套主题的基线，不引入新时长。
 */
function 绘制幕面(图: 图形对象, 参数: 幕面参数): void {
  const { 宽, 高, 缝, 覆盖度, 边线 } = 参数;
  const 色 = 读取幕色(参数.模式色);
  const 中 = 混色(色.外, 色.内, 入场参数.颜色.幕中混合);
  const 上亮带 = Math.min(缝.顶 * 入场参数.颜色.亮带范围, 高 * 入场参数.颜色.亮带高度比);
  const 下亮带 = Math.min((高 - 缝.底) * 入场参数.颜色.亮带范围, 高 * 入场参数.颜色.亮带高度比);
  if (缝.顶 > 0) {
    图.fillGradientStyle(色.外, 色.外, 中, 中).fillRect(0, 0, 宽, 缝.顶 - 上亮带);
    图.fillGradientStyle(中, 中, 色.内, 色.内).fillRect(0, 缝.顶 - 上亮带, 宽, 上亮带);
  }
  if (缝.底 < 高) {
    图.fillGradientStyle(色.内, 色.内, 中, 中).fillRect(0, 缝.底, 宽, 下亮带);
    图.fillGradientStyle(中, 中, 色.外, 色.外).fillRect(0, 缝.底 + 下亮带, 宽, 高 - 缝.底 - 下亮带);
  }
  绘制极光斜带(图, 宽, 高, 缝, 覆盖度, 亮色(色.内, 0.45));
  if (边线 > 0) {
    图
      .fillStyle(参数.模式色, 边线)
      .fillRect(0, 缝.顶, 宽, 1)
      .fillRect(0, 缝.底 - 1, 宽, 1);
  }
}

/** 两道宽光带随覆盖度向接缝上行：幕布越合拢，极光越挤到缝边。 */
function 绘制极光斜带(
  图: 图形对象,
  宽: number,
  高: number,
  缝: { 顶: number; 底: number },
  覆盖度: number,
  色: number,
): void {
  const 可见 = Math.min(1, Math.max(0, 覆盖度));
  for (let 序 = 0; 序 < 2; 序 += 1) {
    const 高比 = 0.055 + 序 * 0.03;
    const 带高 = 高 * 高比;
    const 上移 = 1 - 可见 * (0.45 + 序 * 0.25);
    const 上Y = 缝.顶 * 上移 - 带高 - 序 * 高 * 0.09;
    if (上Y + 带高 > 0) {
      const 透明度 = 0.14 * 可见 * (1 - 序 * 0.35);
      图
        .fillGradientStyle(色, 色, 色, 色, 0, 0, 透明度, 透明度)
        .fillRect(宽 * (0.06 + 序 * 0.1), Math.max(0, 上Y), 宽 * (0.88 - 序 * 0.2), 带高);
    }
    const 下Y = 高 - (高 - 缝.底) * 上移 + 序 * 高 * 0.09;
    if (下Y < 高) {
      const 透明度 = 0.14 * 可见 * (1 - 序 * 0.35);
      图
        .fillGradientStyle(色, 色, 色, 色, 透明度, 透明度, 0, 0)
        .fillRect(宽 * (0.06 + 序 * 0.1), Math.min(高 - 带高, 下Y), 宽 * (0.88 - 序 * 0.2), 带高);
    }
  }
}

function 绘制接缝(图: 图形对象, 参数: 接缝参数): void {
  const { 宽, 高, 模式色, 强度 } = 参数;
  const 线高 = 入场参数.运动.线高;
  const 中Y = 高 / 2;
  const 色 = 亮色(模式色, 入场参数.颜色.线提亮 * 强度);
  图.fillStyle(色, 1).fillRect(0, 中Y - 线高 / 2, 宽, 线高);
  if (强度 <= 0) return;
  图
    .fillGradientStyle(色, 色, 色, 色, 0.16 * 强度, 0.16 * 强度, 0, 0)
    .fillRect(0, 中Y - 线高 / 2 - 高 * 0.07, 宽, 高 * 0.07);
  图
    .fillGradientStyle(色, 色, 色, 色, 0, 0, 0.16 * 强度, 0.16 * 强度)
    .fillRect(0, 中Y + 线高 / 2, 宽, 高 * 0.07);
  图.fillStyle(亮色(色, 0.22), 强度 * 0.6).fillRect(宽 * 0.25, 中Y - 0.5, 宽 * 0.5, 1);
}

function 绘制节拍底纹(图: 图形对象, 参数: 节拍底纹参数): void {
  const { 宽, 高, 模式色, 显 } = 参数;
  if (显 <= 0) return;
  图.fillStyle(0x0a1220, 入场参数.颜色.节拍压暗 * 显).fillRect(0, 0, 宽, 高);
  图.fillStyle(模式色, 显).fillRect(宽 / 2 - 20 * 显, 高 / 2 + 34, 40 * 显, 2);
}

export const 极光画法: 转场画法 = { 绘制幕面, 绘制接缝, 绘制节拍底纹 };
