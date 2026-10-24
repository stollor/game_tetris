import type { 图形对象, 文字项 } from "../../框架/界面/绘制/协议";
import { 绘制旅行图标 } from "../../组件/霓虹街机/图标";
import { 游戏外观 } from "./外观/游戏外观";
import type { 霓虹结算布局 } from "./结算配方";

const 钳制 = (值: number) => Math.max(0, Math.min(1, 值));
const 三次缓出 = (值: number) => 1 - (1 - 值) ** 3;

/** 时长、缓动和数量与 Phaser 霓虹结算面板.播放金币动画 一致。 */
export function 读取结算金币动画(经过毫秒: number, 新增: number, 省电: boolean) {
  const 时间 = Math.max(0, 经过毫秒);
  const 数量 = Math.min(6, Math.max(3, Math.ceil(新增 / 15)));
  const 计数时长 = Math.min(1100, 450 + 新增 * 8);
  const 计数进度 = 钳制((时间 - 250) / 计数时长);
  const 弹出 = 钳制(时间 / 380) - 1;
  const 闪光进度 = 三次缓出(钳制((时间 - 650) / 520));
  return {
    显示数量: 省电 ? 新增 : Math.round(新增 * 三次缓出(计数进度)),
    图标比例: 省电 ? 1 : 1 + 2.70158 * 弹出 ** 3 + 1.70158 * 弹出 ** 2,
    数字比例: 省电 || 计数进度 < 1 ? 1 : 1 + 0.25 * (1 - 钳制((时间 - 250 - 计数时长) / 260)),
    透明度: 省电 ? 钳制(时间 / 220) : 1,
    闪光比例: 0.6 + (1.3 - 0.6) * 闪光进度,
    闪光透明度: 省电 || 时间 < 650 ? 0 : 1 - 闪光进度,
    数量,
    飞币: 省电
      ? []
      : Array.from({ length: 数量 }, (_, 序号) => {
          const 进度 = 钳制((时间 - 120 - 序号 * 70) / 520);
          return {
            序号,
            进度,
            透明度: 时间 < 120 + 序号 * 70 || 进度 >= 1 ? 0 : 1 - 0.4 * 进度 ** 2,
          };
        }),
    活跃: 时间 < (省电 ? 220 : Math.max(1170, 250 + 计数时长 + 260)),
  };
}

export function 绘制结算金币闪光(
  图形: 图形对象,
  中心X: number,
  中心Y: number,
  比例: number,
  透明度: number,
): void {
  if (透明度 <= 0) return;
  图形.lineStyle(2 * 比例, 0xfff3bf, 0.95 * 透明度);
  for (let i = 0; i < 8; i++) {
    const 角 = (i * Math.PI) / 4;
    图形.lineBetween(
      中心X + Math.cos(角) * 16 * 比例,
      中心Y + Math.sin(角) * 16 * 比例,
      中心X + Math.cos(角) * 24 * 比例,
      中心Y + Math.sin(角) * 24 * 比例,
    );
  }
}

export function 绘制结算金币(
  图形: 图形对象,
  定位: 霓虹结算布局,
  时间: number,
  新增: number,
  省电: boolean,
  最终文宽: number,
  总透明度 = 1,
  数字颜色 = 0xffe7a8,
): 文字项 {
  const 动画 = 读取结算金币动画(时间, 新增, 省电);
  const 比例 = 定位.几何.比例;
  const 图宽 = 22 * 比例;
  const 文宽 = Math.max(最终文宽, `+${新增}`.length * 11 * 比例);
  const 左 = 定位.几何.中心X - (图宽 + 6 * 比例 + 文宽) / 2;
  const 目标X = 左 + 图宽 / 2;
  const 目标Y = 定位.金币行Y;
  const 画币 = (x: number, y: number, 大小: number, 透明度: number) => {
    if (大小 <= 0 || 透明度 <= 0) return;
    图形
      .save()
      .setAlpha(透明度 * 总透明度)
      .translateCanvas(x - 大小 / 2, y - 大小 / 2)
      .scaleCanvas(大小 / 32);
    绘制旅行图标(图形, "方块币");
    图形.restore();
  };
  绘制结算金币闪光(图形, 目标X, 目标Y, 动画.闪光比例 * 比例, 动画.闪光透明度 * 总透明度);
  画币(目标X, 目标Y, 图宽 * 动画.图标比例, 动画.透明度);
  for (const 币 of 动画.飞币) {
    const 起点X = 定位.几何.中心X + (币.序号 - (动画.数量 - 1) / 2) * 18 * 比例;
    const 起点Y = 定位.分数.上;
    const 进度 = 币.进度 ** 2;
    画币(起点X + (目标X - 起点X) * 进度, 起点Y + (目标Y - 起点Y) * 进度, 14 * 比例, 币.透明度);
  }
  return {
    文案: `+${动画.显示数量}`,
    x: 左 + 图宽 + 6 * 比例,
    y: 目标Y,
    锚点: "左中",
    缩放: 动画.数字比例,
    样式: {
      字体: 游戏外观.字体.家族,
      字号: 20 * 比例,
      颜色: 数字颜色,
      字重: "粗体",
    },
  };
}
