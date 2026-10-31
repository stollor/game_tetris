import { 立体规范 } from "../../../主题/立体/立体规范";
import type { 图形对象, 点 } from "../../../../.gamemaker/依赖/框架/界面/绘制/协议";
import { 亮色, 暗色 } from "../../../../.gamemaker/依赖/框架/界面/颜色工具";

const 面 = 立体规范.界面;

function 平移点(点集: readonly 点[], x: number, y: number): 点[] {
  return 点集.map((点) => ({ x: 点.x + x, y: 点.y + y }));
}

/** 键面可传入已有轮廓，保留左右移和软降的异形。 */
export function 绘制金属键(
  图: 图形对象,
  点集: readonly 点[],
  选项: {
    按下?: boolean;
    强调?: boolean;
    厚?: number;
    透明度?: number;
    描边宽?: number;
    描边透明度?: number;
  } = {},
): void {
  const 厚 = 选项.厚 ?? 面.键厚;
  const 透明 = 选项.透明度 ?? 1;
  const 灯宽 = 选项.描边宽 ?? 面.灯宽;
  const 边透明 = 选项.描边透明度 ?? (选项.强调 || 选项.按下 ? 0.92 : 0.7);
  const 沉 = 选项.按下 ? 厚 - 1 : 0;
  const 面色 = 选项.强调 ? 亮色(面.键面, 0.12) : 面.键面;
  图.fillStyle(0x000000, 0.4 * 透明).fillPoints(平移点(点集, 1.5, 沉 + 厚 + 3), true);
  图.fillStyle(面.板暗, 透明).fillPoints(平移点(点集, 0, 沉 + 厚), true);
  图.fillStyle(暗色(面色, 0.18), 透明).fillPoints(平移点(点集, 0, 沉 + 厚 * 0.45), true);
  图.fillStyle(面色, 透明).fillPoints(平移点(点集, 0, 沉), true);
  图.lineStyle(1, 面.板高光, 0.42 * 透明).strokePoints(平移点(点集, 0, 沉), true);
  if (灯宽 > 0)
    图
      .lineStyle(灯宽, 面.灯, 选项.强调 || 选项.按下 ? Math.max(边透明, 0.92) : 边透明)
      .strokePoints(平移点(点集, 0, 沉), true);
}
