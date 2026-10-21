import type { 点 } from "../../../框架Three/界面/绘制/协议";

/**
 * 多边形三角化：Three 画笔把圆、椭圆、圆角矩形、任意多边形填充都折成三角形交给合批。
 * 凹多边形不能只做扇形（扇形会填到轮廓外），这里用 ear-clipping：
 * 1. 去掉相邻重复点与共线点，退化多边形（面积≈0、点数<3）返回空；
 * 2. 统一成逆时针后用耳切逐个剥三角形，凹口由「三角形内不含其它顶点」判据保证不跨越轮廓；
 * 3. 找不到耳（自交等异常输入）时退回扇形，保证不会整块消失。
 */

const 容差 = 1e-6;

function 叉积(甲: 点, 乙: 点, 丙: 点): number {
  return (乙.x - 甲.x) * (丙.y - 甲.y) - (乙.y - 甲.y) * (丙.x - 甲.x);
}

/** 有向面积：y 向下坐标里顺时针为负、逆时针为正。 */
export function 多边形有向面积(点集: readonly 点[]): number {
  let 合计 = 0;
  for (let 序号 = 0; 序号 < 点集.length; 序号++) {
    const 当前 = 点集[序号];
    const 下个 = 点集[(序号 + 1) % 点集.length];
    if (!当前 || !下个) continue;
    合计 += 当前.x * 下个.y - 下个.x * 当前.y;
  }
  return 合计 / 2;
}

function 清理点集(点集: readonly 点[]): 点[] {
  const 结果: 点[] = [];
  for (const 项 of 点集) {
    const 前 = 结果.at(-1);
    if (前 && Math.abs(前.x - 项.x) < 容差 && Math.abs(前.y - 项.y) < 容差) continue;
    结果.push({ x: 项.x, y: 项.y });
  }
  // 首尾相同（闭合输入）时去掉尾点，交给环状取模处理。
  const 首 = 结果[0];
  const 尾 = 结果.at(-1);
  if (首 && 尾 && 结果.length > 1 && Math.abs(首.x - 尾.x) < 容差 && Math.abs(首.y - 尾.y) < 容差)
    结果.pop();
  // 去掉共线中间点：否则耳切里它永远不是凸点，可能把多边形卡死。
  for (let 序号 = 0; 序号 < 结果.length && 结果.length > 3; ) {
    const 前 = 结果[(序号 - 1 + 结果.length) % 结果.length];
    const 当前 = 结果[序号];
    const 后 = 结果[(序号 + 1) % 结果.length];
    if (!前 || !当前 || !后) break;
    if (Math.abs(叉积(前, 当前, 后)) < 容差) 结果.splice(序号, 1);
    else 序号++;
  }
  return 结果;
}

function 点在三角形内(点: 点, 甲: 点, 乙: 点, 丙: 点): boolean {
  const 叉甲 = 叉积(甲, 乙, 点);
  const 叉乙 = 叉积(乙, 丙, 点);
  const 叉丙 = 叉积(丙, 甲, 点);
  return 叉甲 >= -容差 && 叉乙 >= -容差 && 叉丙 >= -容差;
}

/**
 * 返回三角形点集（坐标为传入点集的同一套坐标系，y 向下）。
 * 三角形顶点顺序统一为逆时针（投影后仍可见）。
 */
export function 三角化多边形(原点集: readonly 点[]): [点, 点, 点][] {
  const 点集 = 清理点集(原点集);
  if (点集.length < 3) return [];
  const 面积 = 多边形有向面积(点集);
  if (Math.abs(面积) < 容差) return [];
  const 索引列表 = 点集.map((_, 序号) => 序号);
  // 统一成逆时针，让凸点判据固定为叉积 > 0。
  if (面积 < 0) 索引列表.reverse();

  const 三角形: [点, 点, 点][] = [];
  let 失败次数 = 0;
  while (索引列表.length > 3 && 失败次数 <= 索引列表.length) {
    let 找到 = false;
    for (let 序号 = 0; 序号 < 索引列表.length; 序号++) {
      const 前号 = 索引列表[(序号 - 1 + 索引列表.length) % 索引列表.length];
      const 当前号 = 索引列表[序号];
      const 后号 = 索引列表[(序号 + 1) % 索引列表.length];
      if (前号 === undefined || 当前号 === undefined || 后号 === undefined) continue;
      const 甲 = 点集[前号];
      const 乙 = 点集[当前号];
      const 丙 = 点集[后号];
      if (!甲 || !乙 || !丙) continue;
      if (叉积(甲, 乙, 丙) <= 容差) continue;
      let 包含其它点 = false;
      for (const 测试号 of 索引列表) {
        if (测试号 === 前号 || 测试号 === 当前号 || 测试号 === 后号) continue;
        const 测试点 = 点集[测试号];
        if (!测试点) continue;
        if (点在三角形内(测试点, 甲, 乙, 丙)) {
          包含其它点 = true;
          break;
        }
      }
      if (包含其它点) continue;
      三角形.push([甲, 乙, 丙]);
      索引列表.splice(序号, 1);
      找到 = true;
      失败次数 = 0;
      break;
    }
    if (找到) continue;
    失败次数++;
    // 游标卡住时挪一个起点继续找，避免退化点让整块多边形消失。
    索引列表.push(索引列表.shift() ?? 0);
  }
  if (索引列表.length === 3) {
    const [甲号, 乙号, 丙号] = 索引列表;
    const 甲 = 甲号 === undefined ? undefined : 点集[甲号];
    const 乙 = 乙号 === undefined ? undefined : 点集[乙号];
    const 丙 = 丙号 === undefined ? undefined : 点集[丙号];
    if (甲 && 乙 && 丙) 三角形.push([甲, 乙, 丙]);
  }
  return 三角形;
}
