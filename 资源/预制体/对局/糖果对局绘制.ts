import type { 图形对象, 点 } from "../../../.gamemaker/依赖/框架/界面/绘制/协议";
import type { 画笔 } from "../../../.gamemaker/依赖/框架/界面/绘制/画笔";
import { 混色 } from "../../../.gamemaker/依赖/框架/界面/颜色工具";
import { 格式化仪表时间, 计算对局仪表 } from "../../../代码/界面/对局仪表";
import { 读取对局文字样式 } from "../../../代码/页面/布局/对局布局";
import { 模式配置 } from "../../../代码/项目配置/模式";
import { 糖果规范 } from "../../主题/糖果/糖果规范";
import { 读取滚动数位 } from "../../视效/特效/计分反馈";
import {
  内凹角多边形,
  同角,
  圆角多边形,
  斜带,
  裁进凸形,
  type 边界,
} from "../基础/装饰与蒙层/圆角裁剪";
import { 绘制糖纸扭结, 绘制蝴蝶结 } from "../基础/装饰与蒙层/糖果花纹";
import type { 对局仪表输入 } from "./对局仪表";
import { 读取糖果框厚 } from "./糖果棋盘框";

/**
 * 「糖果超甜」的对局仪表：三块玫瑰木票据名牌（LV / 分数 / 行数），分数牌嵌深酒红读数窗、
 * 两侧压麦穗；名牌下方一条糖绳横穿全屏，正中系蝴蝶结，把顶栏和棋盘分开。
 *
 * 坐标全部沿用 `计算对局仪表` 的舱位，不另立布局；读数仍走滚动数位与同一套文字样式，
 * 只把形状换成糖果语言。只在 `仪表表现 = 糖果` 时被 `绘制对局仪表` 调起。
 */

type 仪表定位 = ReturnType<typeof 计算对局仪表>;
type 矩 = { 左: number; 上: number; 宽: number; 高: number };

const 色 = 糖果规范.色;
const 读数阴影 = { 颜色: 色.莓暗, 模糊: 0, 偏移X: 0, 偏移Y: 2 };

function 创建名牌字(笔: 画笔) {
  return (文案: string, x: number, 底: number, 字号: number, 宽: number, 颜色: number) => {
    let 样式 = { ...读取对局文字样式("信息数值", { 字号, 颜色 }), 阴影: 读数阴影 };
    const 测 = 笔.测量文字(文案, 样式);
    if (测.宽 > 宽) 样式 = { ...样式, 字号: Math.max(11, (字号 * 宽) / 测.宽) };
    const 高 = 笔.测量文字(文案, 样式).高;
    笔.绘制文字({ 文案, 样式, 锚点: "中上", x, y: 底 - 高 + Math.max(0, 样式.字号 - 21) / 4 });
  };
}

function 转边界(矩形: 矩, 缩 = 0): 边界 {
  return {
    左: 矩形.左 + 缩,
    上: 矩形.上 + 缩,
    右: 矩形.左 + 矩形.宽 - 缩,
    下: 矩形.上 + 矩形.高 - 缩,
  };
}

/** 一块玫瑰木票据名牌：深色外沿、上亮下暗的木面、内嵌读数窗、一圈象牙裱线。 */
function 绘制名牌(图: 图形对象, 矩形: 矩, 主: boolean): void {
  const 凹 = 主 ? 11 : 9;
  图
    .fillStyle(0x12060a, 0.38)
    .fillPoints(内凹角多边形(转边界({ ...矩形, 上: 矩形.上 + 4 }, -1), 凹), true);
  图.fillStyle(色.莓暗, 1).fillPoints(内凹角多边形(转边界(矩形, -1.5), 凹 - 1.5), true);
  图
    .fillGradientStyle(色.莓亮, 色.莓亮, 色.莓, 色.莓, 1, 1, 1, 1)
    .fillPoints(内凹角多边形(转边界(矩形), 凹), true);
  const 窗缩 = 主 ? 5 : 4.5;
  const 窗 = 内凹角多边形(转边界(矩形, 窗缩), 凹 - 2);
  if (主) {
    const 窗顶 = 混色(色.莓暗, 色.莓深, 0.35);
    图.fillGradientStyle(窗顶, 窗顶, 色.井, 色.井, 1, 1, 1, 1).fillPoints(窗, true);
  } else {
    图.fillStyle(色.莓深, 0.55).fillPoints(窗, true);
  }
  图
    .lineStyle(1.2, 色.象牙, 主 ? 0.7 : 0.6)
    .strokePoints(内凹角多边形(转边界(矩形, 窗缩 - 2.2), 凹), true);
  图.lineStyle(1, 色.莓浅, 0.65).strokePoints(内凹角多边形(转边界(矩形, 0.8), 凹 + 0.8), true);
  图
    .fillGradientStyle(0xffffff, 0xffffff, 0xffffff, 0xffffff, 0.2, 0.2, 0, 0)
    .fillRect(矩形.左 + 凹, 矩形.上 + 1.5, 矩形.宽 - 凹 * 2, Math.max(2, 窗缩 - 1));
  if (!主) return;
  const 中Y = 矩形.上 + 矩形.高 * 0.62;
  绘制麦穗(图, 矩形.左 + 21, 中Y, 1);
  绘制麦穗(图, 矩形.左 + 矩形.宽 - 21, 中Y, -1);
}

/** 麦穗：一根弧形茎上交错四对叶，向读数方向收拢；方向 1 朝右开、−1 镜像。 */
function 绘制麦穗(图: 图形对象, x: number, y: number, 方向: 1 | -1): void {
  const 茎: 点[] = [];
  for (let i = 0; i <= 8; i += 1) {
    const t = i / 8;
    茎.push({ x: x + 方向 * (Math.sin(t * 1.2) * 5), y: y + 10 - t * 22 });
  }
  图.lineStyle(1.2, 色.莓浅, 0.55).strokePoints(茎, false);
  图.fillStyle(色.莓浅, 0.55);
  for (let 序 = 0; 序 < 4; 序 += 1) {
    const t = 0.2 + 序 * 0.22;
    const 根 = 茎[Math.round(t * 8)] ?? { x, y };
    for (const 侧 of [-1, 1]) {
      const 角 = (侧 < 0 ? -2.3 : -0.8) * (方向 > 0 ? 1 : -1) + (方向 > 0 ? 0 : Math.PI);
      const 长 = 5.5 - 序 * 0.6;
      图.save().translateCanvas(根.x, 根.y).rotateCanvas(角);
      图.fillEllipse(长 / 2, 0, 长, 2.4);
      图.restore();
    }
  }
}

/** 名牌顶部的语义标记：等级标 LV、行数三条横线或目标菱形，位置沿用装置仪表。 */
function 绘制名牌标记(笔: 画笔, 定位: 仪表定位): void {
  const 图 = 笔.图形;
  const 左X = 定位.左.左 + 定位.左.宽 / 2;
  const 右X = 定位.右.左 + 定位.右.宽 / 2;
  if (定位.计时栏 !== "左") {
    const 样式 = { ...读取对局文字样式("信息数值", { 字号: 11, 颜色: 色.莓浅 }), 字距: 1 };
    const 高 = 笔.测量文字("LV", 样式).高;
    笔.绘制文字({ 文案: "LV", 样式, 锚点: "中上", x: 左X, y: 定位.左.上 + 17 - 高 });
  }
  if (定位.计时栏 === "右") return;
  if (定位.目标行数) {
    图.lineStyle(1.4, 色.莓浅, 0.9).strokePoints(
      [
        { x: 右X, y: 定位.右.上 + 8 },
        { x: 右X + 5, y: 定位.右.上 + 12 },
        { x: 右X, y: 定位.右.上 + 16 },
        { x: 右X - 5, y: 定位.右.上 + 12 },
      ],
      true,
    );
    return;
  }
  图.fillStyle(色.莓浅, 0.9);
  for (let 序 = 0; 序 < 3; 序 += 1)
    图.fillRoundedRect(右X - 7, 定位.右.上 + 7 + 序 * 4, 14, 1.8, 0.9);
}

/** 读数：等级 / 分数 / 行数或计时，与装置仪表共用同一套坐标。 */
function 绘制名牌读数(
  笔: 画笔,
  输入: 对局仪表输入,
  定位: 仪表定位,
  字: ReturnType<typeof 创建名牌字>,
): void {
  const 图 = 笔.图形;
  const 左X = 定位.左.左 + 定位.左.宽 / 2;
  const 右X = 定位.右.左 + 定位.右.宽 / 2;
  const 主X = 定位.主.左 + 定位.主.宽 / 2;
  const 象牙 = 色.象牙;
  if (定位.计时栏 !== "左") 字(String(输入.等级), 左X, 定位.数值底, 24, 定位.左.宽 - 14, 象牙);
  if (定位.目标行数) {
    const 主值 = String(输入.行数);
    const 主样 = 读取对局文字样式("信息数值", { 字号: 34, 颜色: 象牙 });
    const 副样 = 读取对局文字样式("信息数值", { 字号: 18, 颜色: 色.莓浅 });
    const 主宽 = 笔.测量文字(主值, 主样).宽;
    const 副文 = `/${定位.目标行数}`;
    const 副宽 = 笔.测量文字(副文, 副样).宽;
    const 起 = 主X - (主宽 + 副宽 + 5) / 2;
    字(主值, 起 + 主宽 / 2, 定位.数值底, 34, 主宽 + 1, 象牙);
    字(副文, 起 + 主宽 + 5 + 副宽 / 2, 定位.数值底, 18, 副宽 + 1, 色.莓浅);
    const 进度 = Math.min(1, 输入.行数 / 定位.目标行数);
    const 槽左 = 定位.主.左 + 30;
    const 槽宽 = 定位.主.宽 - 60;
    const 槽上 = 定位.主.上 + 定位.主.高 - 11;
    图.fillStyle(色.莓暗, 0.9).fillRoundedRect(槽左, 槽上, 槽宽, 4, 2);
    if (进度 > 0)
      图.fillStyle(色.金, 0.95).fillRoundedRect(槽左, 槽上, Math.max(4, 槽宽 * 进度), 4, 2);
  } else if (定位.计时栏 !== "右") {
    字(String(输入.行数), 右X, 定位.数值底, 24, 定位.右.宽 - 14, 象牙);
  }
  // 分数：滚动数位、击中时提亮成金色，与现有仪表同一算法。
  const 强度 = 输入.计分.击中;
  const 值 = 输入.计分.显示分数;
  const 位数 = Math.max(6, Math.floor(Math.max(0, 值)).toString().length);
  let 样式 = {
    ...读取对局文字样式("信息数值", {
      字号: 定位.分数字号 + 2,
      颜色: 混色(象牙, 色.金, 0.35 + 强度 * 0.65),
    }),
    阴影: 读数阴影,
  };
  const 数宽 = 笔.测量文字("0".repeat(位数), 样式).宽;
  if (数宽 > 定位.分数宽) 样式 = { ...样式, 字号: (样式.字号 * 定位.分数宽) / 数宽 };
  const 字宽 = 笔.测量文字("0", 样式).宽;
  const 行高 = 笔.测量文字("0", 样式).高;
  const 底 = 定位.数值底 + Math.max(0, 样式.字号 - 21) / 4 - Math.sin(强度 * Math.PI) * 2;
  const 上 = 底 - 行高;
  笔.压入裁剪({ 左: 定位.分数X - 定位.分数宽 / 2, 上, 宽: 定位.分数宽, 高: 行高 + 3 });
  读取滚动数位(值, 位数).forEach((位, i) => {
    const x = 定位.分数X + (i - (位数 - 1) / 2) * 字宽;
    笔.绘制文字({ 文案: String(位.数字), 样式, 锚点: "中上", x, y: 上 - 位.进度 * 行高 });
    if (位.进度 > 0)
      笔.绘制文字({ 文案: String(位.下一个), 样式, 锚点: "中上", x, y: 上 + (1 - 位.进度) * 行高 });
  });
  笔.弹出裁剪();
  if (定位.计时栏) 绘制计时(笔, 输入, 定位, 字);
}

/** 计时：极限模式倒计时、冲刺模式正计时；临近与紧迫换色并脉动。 */
function 绘制计时(
  笔: 画笔,
  输入: 对局仪表输入,
  定位: 仪表定位,
  字: ReturnType<typeof 创建名牌字>,
): void {
  const 图 = 笔.图形;
  const 时限 = 输入.模式 === "极限";
  const 毫秒 = 时限 ? 输入.剩余毫秒 : 输入.有效毫秒;
  const 紧迫 = 时限 && 毫秒 <= 10000;
  const 临近 = 时限 && 毫秒 <= 30000;
  const 脉冲 = 紧迫 && !输入.省电 ? (1 + Math.sin((输入.有效毫秒 / 1000) * Math.PI * 4)) / 2 : 0;
  const 钟色 = 紧迫 ? 色.草莓糖 : 临近 ? 色.柠檬 : 色.象牙;
  const 槽 = 定位.计时栏 === "右" ? 定位.右 : 定位.左;
  const x = 槽.左 + 槽.宽 / 2;
  const y = 槽.上 + 12;
  图.lineStyle(1.5, 紧迫 || 临近 ? 钟色 : 色.莓浅, 0.9).strokeCircle(x, y, 5.5 + 脉冲);
  图
    .lineStyle(1.4, 紧迫 || 临近 ? 钟色 : 色.莓浅, 0.95)
    .lineBetween(x, y - 3, x, y)
    .lineBetween(x, y, x + 2.5, y + 1.5);
  字(格式化仪表时间(毫秒, 紧迫), x, 定位.数值底, 紧迫 ? 23 : 22, 槽.宽 - 14, 钟色);
  if (时限) {
    const 槽左 = 槽.左 + 14;
    const 槽宽 = 槽.宽 - 28;
    const 槽上 = 槽.上 + 槽.高 - 9;
    图.fillStyle(色.莓暗, 0.9).fillRoundedRect(槽左, 槽上, 槽宽, 3, 1.5);
    图
      .fillStyle(钟色, 0.6 + 脉冲 * 0.35)
      .fillRoundedRect(
        槽左,
        槽上,
        槽宽 * Math.min(1, Math.max(0, 毫秒 / 模式配置.极限毫秒)),
        3,
        1.5,
      );
  }
}

/** 糖绳：一条斜扭的玫瑰糖绳横跨全屏，正中系一只蝴蝶结。 */
function 绘制糖绳(图: 图形对象, 左: number, 右: number, y: number): void {
  const 粗 = 7;
  const 边 = { 左, 上: y - 粗 / 2, 右, 下: y + 粗 / 2 };
  图.fillStyle(0x12060a, 0.3).fillRoundedRect(左, 边.上 + 2.5, 右 - 左, 粗, 粗 / 2);
  图.fillStyle(色.莓暗, 1).fillRoundedRect(左 - 1, 边.上 - 1, 右 - 左 + 2, 粗 + 2, 粗 / 2 + 1);
  const 绳 = 圆角多边形(边, 同角(粗 / 2));
  图.fillGradientStyle(色.莓亮, 色.莓亮, 色.莓深, 色.莓深, 1, 1, 1, 1).fillPoints(绳, true);
  图.fillStyle(色.莓浅, 0.75);
  for (let s = Math.floor((左 - 边.下) / 6) * 6; s < 右 - 边.上; s += 6) {
    const 段 = 裁进凸形(斜带(s, 2.4, 边.上, 边.下), 绳);
    if (段.length >= 3) 图.fillPoints(段, true);
  }
  图.fillStyle(0xffffff, 0.22).fillRoundedRect(左 + 3, 边.上 + 1, 右 - 左 - 6, 1.6, 0.8);
  绘制蝴蝶结(图, (左 + 右) / 2, y - 1, 34, 色.草莓, 色.草莓深);
}

/** 模式名底板：一颗糖纸包装的长糖，两端金箍与扭结糖纸。文字由调用方画在上面。 */
export function 绘制糖果标题徽章(
  图: 图形对象,
  中心X: number,
  中心Y: number,
  宽: number,
  高: number,
): void {
  const 身高 = 高 * 0.78;
  const 身宽 = Math.max(60, 宽 - 30);
  const 身左 = 中心X - 身宽 / 2;
  const 身上 = 中心Y - 身高 / 2;
  for (const 向 of [-1, 1] as const)
    绘制糖纸扭结(图, 中心X + 向 * (身宽 / 2 + 2), 中心Y, 身高, 向, 色.草莓浅, 色.草莓深);
  图.fillStyle(0x12060a, 0.35).fillRoundedRect(身左, 身上 + 3, 身宽, 身高, 身高 / 2);
  图
    .fillStyle(色.莓暗, 1)
    .fillRoundedRect(身左 - 1.5, 身上 - 1.5, 身宽 + 3, 身高 + 3, 身高 / 2 + 1.5);
  图
    .fillGradientStyle(色.草莓, 色.草莓, 色.草莓深, 色.草莓深, 1, 1, 1, 1)
    .fillRoundedRect(身左, 身上, 身宽, 身高, 身高 / 2);
  图
    .fillGradientStyle(0xffffff, 0xffffff, 0xffffff, 0xffffff, 0.38, 0.38, 0, 0)
    .fillRoundedRect(身左 + 6, 身上 + 2, 身宽 - 12, 身高 * 0.42, 身高 * 0.2);
  图
    .lineStyle(1.2, 色.象牙, 0.7)
    .strokeRoundedRect(身左 + 3.5, 身上 + 3.5, 身宽 - 7, 身高 - 7, (身高 - 7) / 2);
  for (const 向 of [-1, 1] as const) {
    const x = 中心X + 向 * (身宽 / 2 - 2);
    图
      .fillStyle(色.莓暗, 1)
      .fillRoundedRect(x - 4.5, 中心Y - 身高 * 0.36 - 1, 9, 身高 * 0.72 + 2, 3);
    图
      .fillGradientStyle(色.金, 色.金, 色.金深, 色.金深, 1, 1, 1, 1)
      .fillRoundedRect(x - 3.5, 中心Y - 身高 * 0.36, 7, 身高 * 0.72, 2.5);
    图.fillStyle(0xffffff, 0.5).fillRect(x - 2, 中心Y - 身高 * 0.3, 1.4, 身高 * 0.5);
    绘制闪星(图, 中心X + 向 * (身宽 / 2 - 18), 中心Y, 4.5);
  }
}

/** 四角闪星。 */
function 绘制闪星(图: 图形对象, x: number, y: number, 尺寸: number): void {
  const 腰 = 尺寸 * 0.28;
  图.fillStyle(色.象牙, 0.95).fillPoints(
    [
      { x, y: y - 尺寸 },
      { x: x + 腰, y: y - 腰 },
      { x: x + 尺寸, y },
      { x: x + 腰, y: y + 腰 },
      { x, y: y + 尺寸 },
      { x: x - 腰, y: y + 腰 },
      { x: x - 尺寸, y },
      { x: x - 腰, y: y - 腰 },
    ],
    true,
  );
}

/** 对局仪表「糖果」表现：静态画名牌与糖绳，动态画读数。 */
export function 绘制对局仪表糖果(笔: 画笔, 输入: 对局仪表输入, 部分: "静态" | "动态"): void {
  const 定位 = 计算对局仪表(输入.布局, 输入.模式);
  if (部分 === "静态") {
    绘制名牌(笔.图形, 定位.左, false);
    绘制名牌(笔.图形, 定位.右, false);
    绘制名牌(笔.图形, 定位.主, true);
    绘制名牌标记(笔, 定位);
    const 布局 = 输入.布局;
    const 名牌底 = 定位.主.上 + 定位.主.高;
    const 框顶 = 布局.棋盘.上 - 读取糖果框厚(布局.格子大小) - 1.5;
    if (布局.侧栏 && 框顶 - 名牌底 > 14) 绘制糖绳(笔.图形, 8, 布局.视口宽 - 8, (名牌底 + 框顶) / 2);
    return;
  }
  绘制名牌读数(笔, 输入, 定位, 创建名牌字(笔));
}

/** 读取名牌配色（测试与预览用）：不吃灰的语义色别名。 */
export const 糖果仪表配色 = {
  面板: 色.莓,
  主面板: 色.莓暗,
  描边: 色.莓浅,
  强调: 色.象牙,
} as const;
