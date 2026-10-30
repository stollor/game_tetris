import { 像素规范 } from "../../主题/像素/像素规范";
import { 是像素风格 } from "../../主题/像素/像素风格";
import type { 方块外观方案 } from "../../主题/外观/方块外观";
import { 读取霓虹调色板 } from "../../主题/配色/调色板";
import type { 挑战结果 } from "../../代码/页面/结算/结算数据";
import { 对比文字色, 缓出, 限制 } from "../../框架/界面/控件/工具";
import type { 按钮阶段 } from "../../框架/界面/控件/按钮";
import type { 矩形, 绘制环境 } from "../../框架/界面/控件/类型";
import type { 轻提示样式状态, 轻提示队列 } from "../../框架/界面/控件/轻提示";
import { 解析颜色数值 } from "../../框架/界面/绘制/协议";
import type { 画笔 } from "../../框架/界面/绘制/画笔";
import { 绘制像素面板 } from "../../组件/基础/面板/像素面板";
import { 绘制旅行图标 } from "../../组件/基础/图标/图标";
import { type 成就图标编号, 绘制成就图标 } from "../../组件/基础/图标/成就图标";
import { 绘制方块单元 } from "../../组件/对局/方块单元";
import {
  绘制结算遮罩,
  绘制结算面板,
  计算霓虹结算布局,
  读取结算按钮视觉,
  读取结算文字样式,
  type 霓虹结算布局,
} from "../../组件/结算/结算台配方";
import { 绘制像素结算, 绘制像素结算按钮 } from "./像素结算";
import { 绘制结算金币, 读取结算金币动画 } from "./结算金币";

export const 结算入场毫秒 = 900;
export const 结算奖励开始毫秒 = 900;
export const 结算奖励秒 = 1.9;
export const 结算成就开始毫秒 = 2900;
export const 结算成就秒 = 1.7;

const 进度 = (时间: number, 起: number, 长: number) => 缓出(限制((时间 - 起) / 长, 0, 1));

export interface 结算演出输入 {
  宽: number;
  高: number;
  标题: string;
  模式: string;
  新纪录: string;
  分数: number;
  金币: number | null;
  金币标签: string;
  循环提示?: { 文本: string; 图标?: 成就图标编号 };
  统计: readonly { 标签: string; 数值: string }[];
  方块方案: 方块外观方案;
  /** 挑战结果；独立预览不传时按普通结算，不画勾叉。 */
  挑战结果?: 挑战结果;
  经过毫秒: number;
  省电: boolean;
}

/** 入场落定后接轻循环，结果数值始终常驻；时间只控制表现，不触发发奖。 */
export function 绘制结算演出(画笔: 画笔, 输入: 结算演出输入): void {
  if (是像素风格()) {
    绘制像素结算(画笔, 输入);
    return;
  }
  const 定位 = 计算霓虹结算布局(输入.宽, 输入.高);
  const { 几何, 左, 列宽 } = 定位;
  const { 中心X, 顶, 宽, 比例: s } = 几何;
  const 图 = 画笔.图形;
  const 色 = 读取霓虹调色板();
  const t = 输入.经过毫秒;
  const 循环 = (Math.max(0, t - 1500) / 3200) * Math.PI * 2;
  const 呼吸 = (1 - Math.cos(循环)) / 2;
  const 浮动 = 输入.省电 ? 0 : Math.sin(循环) * 3 * s;
  const 方块X = 中心X - (输入.新纪录 ? 36 * s : 0);
  const 入场 = 进度(t, 0, 输入.省电 ? 220 : 420);
  图.save().setAlpha(入场);
  绘制结算遮罩(图, 输入.宽, 输入.高);
  图.save().translateCanvas(0, 输入.省电 ? 0 : (1 - 入场) * 18 * s);
  绘制结算面板(图, 定位);
  图.restore();

  // 以棋盘网格和阶梯堆叠包住主分数，视觉沿用玩家正在使用的方块材质。
  for (let 行 = 0; 行 < 4; 行++)
    for (let 列 = 0; 列 < 10; 列++) {
      if ((行 + 列) % 5 === 0) continue;
      图
        .fillStyle(色.强调, 0.025)
        .fillRect(左 + (30 + 列 * 30) * s, 顶 + (148 + 行 * 29) * s, 26 * s, 25 * s);
    }
  for (const [边, 高] of [
    [0, 2],
    [1, 3],
    [2, 1],
  ] as const) {
    for (let 行 = 0; 行 < 高; 行++) {
      图
        .fillStyle(色.强调, 0.065)
        .fillRect(左 + (20 + 边 * 13) * s, 顶 + (234 - 行 * 13) * s, 10 * s, 10 * s);
      图
        .fillStyle(色.方块.T, 0.08)
        .fillRect(左 + 宽 - (30 + 边 * 13) * s, 顶 + (234 - 行 * 13) * s, 10 * s, 10 * s);
    }
  }

  图
    .fillStyle(色.强调, 0.04 + 呼吸 * 0.035)
    .fillCircle(方块X, 顶 + 92 * s + 浮动, (57 + 呼吸 * 4) * s);
  const 格 = 26 * s;
  const 点 = [
    [1, 0],
    [0, 1],
    [1, 1],
    [2, 1],
  ] as const;
  for (const [i, [列, 行]] of 点.entries()) {
    const 落位 = 进度(t, 90 + i * 70, 输入.省电 ? 150 : 360);
    const 下落 = 输入.省电 ? 0 : (1 - 落位) * (48 + i * 9) * s;
    绘制方块单元(图, 方块X - 格 * 1.5 + 列 * 格, 顶 + 64 * s + 行 * 格 - 下落 + 浮动, {
      方案: 输入.方块方案,
      色值: 输入.方块方案.颜色.T,
      格子: 格,
      透明度: 落位,
    });
  }

  const 挑战 = 输入.挑战结果 ?? "普通";
  if (挑战 !== "普通") {
    const 成功 = 挑战 === "成功";
    const 徽记色 = 成功 ? 色.强调 : 0xffb066;
    const 徽记入场 = 进度(t, 540, 输入.省电 ? 160 : 320);
    const 徽记X = 方块X - 50 * s;
    const 徽记Y = 顶 + 70 * s;
    // 小徽记只占 T 形落位旁的空角；失败不做弹跳/放射，保持一次安静显现。
    const 脉动 = 成功 ? 0.12 + 呼吸 * 0.1 : 0.1;
    图.save().setAlpha(入场 * 徽记入场);
    图.fillStyle(徽记色, 脉动).fillCircle(徽记X, 徽记Y, 11 * s);
    图.lineStyle(1.5 * s, 徽记色, 成功 ? 0.7 : 0.5).strokeCircle(徽记X, 徽记Y, 11 * s);
    if (成功) {
      图
        .lineStyle(2.4 * s, 徽记色, 0.95)
        .lineBetween(徽记X - 5 * s, 徽记Y + 0.5 * s, 徽记X - 1.2 * s, 徽记Y + 4.2 * s)
        .lineBetween(徽记X - 1.2 * s, 徽记Y + 4.2 * s, 徽记X + 5.2 * s, 徽记Y - 4.2 * s);
    } else {
      图
        .lineStyle(2 * s, 徽记色, 0.8)
        .lineBetween(徽记X - 4 * s, 徽记Y - 4 * s, 徽记X + 4 * s, 徽记Y + 4 * s)
        .lineBetween(徽记X - 4 * s, 徽记Y + 4 * s, 徽记X + 4 * s, 徽记Y - 4 * s);
    }
    图.restore();
  }

  const 字 = (
    文案: string,
    x: number,
    y: number,
    字号: number,
    颜色: string | number,
    最大宽: number,
    透明度 = 1,
    缩放 = 1,
  ) => {
    const 样式 = 读取结算文字样式("统计数值", { 字号: Math.round(字号 * s), 颜色 });
    const 测量 = 画笔.测量文字(文案, 样式).宽;
    图.save().setAlpha(入场 * 透明度);
    画笔.绘制文字({
      文案,
      样式,
      锚点: "中中",
      x,
      y,
      缩放: Math.max(0.01, Math.min(缩放, 最大宽 / Math.max(1, 测量))),
    });
    图.restore();
  };
  字(输入.模式, 中心X, 顶 + 30 * s, 13, 色.次要文字, 宽 - 110 * s);
  if (输入.新纪录) {
    const 显现 = 限制((t - 480) / 460, 0, 1);
    const 弹出 = 输入.省电
      ? 进度(t, 180, 220)
      : 1 + 2.70158 * (显现 - 1) ** 3 + 1.70158 * (显现 - 1) ** 2;
    const x = 中心X + 74 * s;
    const y = 顶 + 88 * s;
    const 金色 = 0xffcc52;
    图
      .save()
      .translateCanvas(x, y)
      .scaleCanvas(Math.max(0.01, 弹出))
      .setAlpha(入场 * (输入.省电 ? 1 : Math.min(1, 显现 * 4)));
    // 锯齿爆炸章与放射碎块只在初次落印时炸开，待机保留轻微闪耀。
    图.fillStyle(金色, 0.09 + 呼吸 * 0.08).fillCircle(0, 0, 57 * s);
    const 爆点 = Array.from({ length: 24 }, (_, i) => {
      const 角 = (i * Math.PI) / 12 - Math.PI / 2;
      const 半径 = i % 2 ? 0.8 : 1;
      return { x: Math.cos(角) * 62 * s * 半径, y: Math.sin(角) * 35 * s * 半径 };
    });
    图.fillStyle(0xb9671d).fillPoints(
      爆点.map((点) => ({ x: 点.x, y: 点.y + 4 * s })),
      true,
    );
    图.fillStyle(金色).fillPoints(爆点, true);
    图.lineStyle(1.5 * s, 0xffef9a, 0.9).strokePoints(爆点, true);
    图.restore();
    字(输入.新纪录, x, y, 21, 0x38210e, 108 * s, 输入.省电 ? 1 : Math.min(1, 显现 * 4), 弹出);
    if (!输入.省电 && t >= 480 && t < 1250) {
      const 爆发 = (t - 480) / 770;
      for (let i = 0; i < 12; i++) {
        const 角 = (i * Math.PI) / 6;
        const 距离 = (26 + 缓出(爆发) * 51) * s;
        图
          .fillStyle(i % 3 ? 金色 : 解析颜色数值(色.正文), (1 - 爆发) ** 2)
          .fillRect(
            x + Math.cos(角) * 距离,
            y + Math.sin(角) * 距离 * 0.6,
            (5 - 爆发 * 3) * s,
            (5 - 爆发 * 3) * s,
          );
      }
      图.lineStyle(3 * s, 金色, (1 - 爆发) * 0.65).strokeCircle(x, y, (28 + 爆发 * 43) * s);
    }
    if (t > 1500) {
      for (let i = 0; i < (输入.省电 ? 1 : 3); i++) {
        const 闪 = Math.max(0, Math.sin(循环 * 1.5 + i * 2.1)) ** 8;
        const sx = x + (i === 1 ? -53 : 47 - i * 9) * s;
        const sy = y + (i === 0 ? -23 : 22) * s;
        图
          .lineStyle(2 * s, 0xffef9a, 闪)
          .lineBetween(sx - 5 * s, sy, sx + 5 * s, sy)
          .lineBetween(sx, sy - 5 * s, sx, sy + 5 * s);
      }
    }
  }
  const 标题入场 = 进度(t, 200, 300);
  const 标题色 = 挑战 === "成功" ? 色.强调 : 挑战 === "失败" ? 0xffb066 : 色.正文;
  字(输入.标题, 中心X, 顶 + 146 * s + (1 - 标题入场) * 10 * s, 30, 标题色, 宽 - 32 * s, 标题入场);
  const 落定 = 输入.省电 ? 0 : Math.sin(限制((t - 650) / 400, 0, 1) * Math.PI) * 0.06;
  字(
    输入.分数.toLocaleString(),
    中心X,
    定位.分数.上,
    54,
    色.强调,
    宽 - 56 * s,
    进度(t, 260, 260),
    1 + 落定,
  );

  图.fillStyle(色.分组线, 0.45).fillRect(左 + 26 * s, 顶 + 247 * s, 宽 - 52 * s, s);
  if (!输入.省电 && t >= 600 && t < 1150) {
    const 光带 = (t - 600) / 550;
    图
      .fillStyle(色.强调, Math.sin(光带 * Math.PI))
      .fillRect(左 + 26 * s, 顶 + 245 * s, (宽 - 52 * s) * 光带, 3 * s);
    for (let i = 0; i < 12; i++) {
      const 角 = (i * Math.PI) / 6;
      图
        .fillStyle(i % 2 ? 色.强调 : 色.方块.T, (1 - 光带) * 0.65)
        .fillRect(
          中心X + Math.cos(角) * (45 + 光带 * 66) * s,
          顶 + 90 * s + Math.sin(角) * (28 + 光带 * 30) * s,
          3 * s,
          3 * s,
        );
    }
  }
  for (const [i, 项] of 输入.统计.slice(0, 3).entries()) {
    const 显现 = 进度(t, 输入.省电 ? 180 : 440 + i * 100, 280);
    const x = 左 + 18 * s + 列宽 * i;
    const y = 顶 + 267 * s + (输入.省电 ? 0 : (1 - 显现) * 18 * s);
    图.save().setAlpha(显现 * 入场);
    图.fillStyle(色.次级面板底, 0.9).fillRoundedRect(x + 3 * s, y, 列宽 - 6 * s, 73 * s, 7 * s);
    图.fillStyle(i === 1 ? 色.方块.T : 色.强调, 0.8).fillRect(x + 13 * s, y, 20 * s, 3 * s);
    图.restore();
    字(项.标签, x + 列宽 / 2, y + 22 * s, 12, 色.次要文字, 列宽 - 18 * s, 显现);
    字(项.数值, x + 列宽 / 2, y + 50 * s, 22, 色.正文, 列宽 - 18 * s, 显现);
  }
  const 奖励入场 = 进度(t, 740, 300);
  const 币区 = 定位.金币区;
  图.save().setAlpha(入场 * 奖励入场);
  图
    .fillStyle(色.方块.O, 0.08 + 呼吸 * 0.025)
    .fillRoundedRect(币区.左, 币区.上, 币区.宽, 币区.高, 8 * s);
  图.lineStyle(s, 色.方块.O, 0.24).strokeRoundedRect(币区.左, 币区.上, 币区.宽, 币区.高, 8 * s);
  图
    .save()
    .translateCanvas(币区.左 + 14 * s, 币区.上 + 13 * s)
    .scaleCanvas((22 * s) / 32);
  绘制旅行图标(图, "方块币");
  图.restore();
  图.restore();
  字(输入.金币标签, 币区.左 + 110 * s, 定位.金币行Y, 13, 色.次要文字, 126 * s, 奖励入场);
  const 数量 =
    输入.金币 === null
      ? null
      : 读取结算金币动画(t - 结算奖励开始毫秒, 输入.金币, 输入.省电).显示数量;
  字(
    数量 === null ? "—" : `+${数量.toLocaleString()}`,
    币区.左 + 币区.宽 - 66 * s,
    定位.金币行Y,
    26,
    色.正文,
    112 * s,
    奖励入场,
  );
  // 两个短光点沿计分线往返，循环不改变文字字号和按钮命中区域。
  if (t > 1500) {
    const 光位 = (1 - Math.cos(循环 / 2)) / 2;
    图
      .fillStyle(色.强调, 0.45 + 呼吸 * 0.35)
      .fillRect(左 + (26 + (宽 / s - 64) * 光位) * s, 顶 + 246 * s, 12 * s, 2 * s);
  }
  if (t >= 5000 && 输入.循环提示) {
    const 阶段 = ((t - 5000) % 3200) / 3200;
    const 透明度 = Math.min(1, 阶段 * 10, (1 - 阶段) * 10);
    const y = 顶 + 435 * s;
    图.save().setAlpha(入场 * 透明度);
    if (输入.循环提示.图标) {
      图
        .save()
        .translateCanvas(中心X - 116 * s, y - 12 * s)
        .scaleCanvas(0.75 * s);
      绘制成就图标(图, 输入.循环提示.图标, 解析颜色数值(色.强调));
      图.restore();
    } else {
      for (let i = 0; i < 3; i++)
        图
          .fillStyle(色.强调, 0.25 + (0.5 * (1 + Math.sin(循环 + i))) / 2)
          .fillRect(中心X - (110 - i * 8) * s, y - 3 * s, 5 * s, 5 * s);
    }
    图.restore();
    字(输入.循环提示.文本, 中心X + 14 * s, y, 13, 色.次要文字, 198 * s, 透明度);
  }
  图.restore();
}

export function 绘制结算操作(
  画笔: 画笔,
  区域: 矩形,
  文案: string,
  种类: "重开" | "菜单" | "重试",
  阶段: 按钮阶段,
  经过毫秒: number,
  省电: boolean,
): void {
  if (是像素风格()) {
    绘制像素结算按钮(画笔, 区域, 文案, 种类 === "重开", 阶段 === "按下", 阶段 === "禁用");
    return;
  }
  const 图 = 画笔.图形;
  const 色 = 读取霓虹调色板();
  const 视觉 = 读取结算按钮视觉(
    种类 === "重开" ? (阶段 === "禁用" ? "重开禁用" : "重开") : "菜单",
    色.样式,
  );
  const 文字色 = 种类 === "重开" && 阶段 !== "禁用" ? 对比文字色(视觉.填色) : 视觉.文字色;
  const 透明度 = 进度(经过毫秒, 省电 ? 100 : 550, 250);
  const 按下 = 阶段 === "按下" ? 2 : 0;
  const { 左, 上, 宽, 高 } = 区域;
  图.save().setAlpha(透明度);
  if (种类 === "重开") {
    const 呼吸 = (1 - Math.cos((Math.max(0, 经过毫秒 - 1500) / 3200) * Math.PI * 2)) / 2;
    图.fillStyle(色.强调, 0.16 + 呼吸 * 0.16).fillRoundedRect(左 - 2, 上 + 3, 宽 + 4, 高 + 4, 10);
    图
      .fillStyle(视觉.填色, 阶段 === "禁用" ? 0.45 : 0.98)
      .fillRoundedRect(左, 上 + 按下, 宽, 高 - 按下, 8);
    图.fillStyle(0xffffff, 0.2).fillRect(左 + 10, 上 + 按下 + 3, 宽 - 20, 2);
    if (!省电 && 经过毫秒 > 1500 && 阶段 !== "禁用") {
      const 光位 = ((经过毫秒 - 1500) % 4200) / 4200;
      图
        .fillStyle(0xffffff, 0.5 * Math.sin(光位 * Math.PI))
        .fillRect(左 + 10 + (宽 - 48) * 光位, 上 + 按下 + 3, 28, 2);
    }
    const 格 = 7;
    for (const [x, y] of [
      [1, 0],
      [0, 1],
      [1, 1],
      [2, 1],
    ]) {
      图
        .fillStyle(文字色, 0.85)
        .fillRect(左 + 22 + x * 格, 上 + 高 / 2 - 格 + y * 格 + 按下, 格 - 1, 格 - 1);
    }
  } else {
    图.fillStyle(视觉.填色, 种类 === "菜单" ? 0.18 : 0.8).fillRoundedRect(左, 上 + 按下, 宽, 高, 7);
    图
      .lineStyle(1, 视觉.边框色, 阶段 === "按下" ? 0.9 : 0.25)
      .strokeRoundedRect(左, 上 + 按下, 宽, 高, 7);
  }
  const 样式 = 读取结算文字样式("统计数值", { 字号: 种类 === "重开" ? 18 : 15, 颜色: 文字色 });
  const 文宽 = 画笔.测量文字(文案, 样式).宽;
  画笔.绘制文字({
    文案,
    样式,
    锚点: "中中",
    x: 左 + 宽 / 2 + (种类 === "重开" ? 6 : 0),
    y: 上 + 高 / 2 + 按下,
    缩放: Math.min(1, (宽 - 76) / Math.max(1, 文宽)),
  });
  图.restore();
}

export interface 结算飘字外观 {
  类型: "金币" | "成就" | "说明";
  经过毫秒: number;
  数量: number;
  成就图标?: 成就图标编号;
  省电: boolean;
}

/** 只换游戏视觉，寿命、淡出和上移交给框架提示队列。 */
export function 绘制结算飘字(
  画笔: 画笔,
  环境: 绘制环境,
  队列: 轻提示队列,
  定位: 霓虹结算布局,
  外观: 结算飘字外观,
): 轻提示样式状态 | null {
  const 图 = 画笔.图形;
  const 色 = 读取霓虹调色板();
  const s = 定位.几何.比例;
  let 状态快照: 轻提示样式状态 | null = null;
  画笔.压入裁剪(定位.提示区);
  队列.绘制(环境, 定位.几何.中心X * 2, {
    上: 定位.奖励Y,
    宽: 定位.提示区.宽 - 12 * s,
    上移距离: (外观.省电 ? 12 : 28) * s,
    绘制底板: (_环境, 状态) => {
      状态快照 = 状态;
      if (外观.类型 !== "金币") return;
      图.save().setAlpha(状态.透明度);
      const 文字 = 绘制结算金币(
        图,
        { ...定位, 金币行Y: 状态.矩形.上 + 17 },
        外观.经过毫秒,
        外观.数量,
        外观.省电,
        画笔.测量文字(`+${外观.数量}`, 读取结算文字样式("金币")).宽,
        状态.透明度,
        色.强调,
      );
      画笔.绘制文字(文字);
      图.restore();
    },
    绘制文字: (_环境, 请求) => {
      if (外观.类型 === "金币") return;
      const 字号 = 14;
      const 样式 = 读取结算文字样式("奖励", { 字号, 颜色: 色.正文, 字重: "粗体" });
      const 文宽 = 画笔.测量文字(请求.文本, 样式).宽;
      const 图宽 = 外观.成就图标 ? 24 : 0;
      const 左 = 定位.几何.中心X - (文宽 + 图宽 + 8) / 2;
      图.save().setAlpha(请求.透明度);
      if (是像素风格())
        绘制像素面板(图, 左 - 12, 请求.矩形.上 - 3, 文宽 + 图宽 + 32, 38, 像素规范.色.纸);
      else
        图
          .fillStyle(色.强调, 0.12)
          .fillRoundedRect(左 - 12, 请求.矩形.上 - 3, 文宽 + 图宽 + 32, 38, 7);
      if (外观.成就图标) {
        图
          .save()
          .translateCanvas(左, 请求.矩形.上 + 4)
          .scaleCanvas(0.75);
        绘制成就图标(图, 外观.成就图标, 解析颜色数值(色.强调));
        图.restore();
      }
      画笔.绘制文字({
        文案: 请求.文本,
        样式,
        锚点: "左中",
        x: 左 + 图宽 + 8,
        y: 请求.矩形.上 + 17,
      });
      图.restore();
    },
  });
  画笔.弹出裁剪();
  return 状态快照;
}
