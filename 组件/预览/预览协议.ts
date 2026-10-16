export type 样品设定 = Record<string, string>;
export const 预览分类 = ["颜色", "图标", "基础组件", "组合组件", "动效", "页面", "弹层"] as const;
export type 样品分类 = (typeof 预览分类)[number];
export const 预览阶段 = ["全部", "线稿", "样板", "已接入"] as const;
export type 样品阶段筛选 = (typeof 预览阶段)[number];
export interface 源码引用 {
  路径: string;
  导出?: string;
}
export interface 样品交付 {
  阶段: "组件样板" | "规范样板" | "界面线稿" | "游戏接入" | "未登记";
  源码: readonly 源码引用[];
  复用?: readonly string[];
  关联策划?: readonly string[];
  验收?: readonly string[];
}
export interface 样品开关 {
  范围?: readonly [number, number];
  键: string;
  标题: string;
  选项: readonly string[];
}
export interface 预览输入 {
  场景: import("phaser").Scene;
  舞台: import("phaser").GameObjects.Container;
  宽: number;
  高: number;
  设定: 样品设定;
  反馈: (事件: string) => void;
  改设定: (键: string, 值: string) => void;
  配色?: 样品设定;
  选择配色?: (组: string, 值: string) => void;
}
export interface 预览样品 {
  配色?: { 组: string; 值: string };
  交付?: 样品交付;
  分类?: 样品分类 | "基础控件";
  样板高?: number | ((宽: number, 设定?: 样品设定) => number);
  样板宽?: number;
  编号: string;
  名称: string;
  说明: string;
  开关: readonly 样品开关[];
  默认: 样品设定;
  绘制: (输入: 预览输入) => void;
}
export interface 配色分组 {
  编号: string;
  名称: string;
  选项: readonly string[];
  默认: string;
}
export interface 预览库 {
  加载?: (场景: import("phaser").Scene) => void;
  配色组?: readonly (配色分组 & { 应用: (值: string) => void })[];
  编号: string;
  名称: string;
  说明: string;
  样品: readonly 预览样品[];
}
export function 解析预览配色(
  库: { 配色组?: readonly 配色分组[] },
  查询: URLSearchParams,
): 样品设定 {
  return Object.fromEntries(
    (库.配色组 ?? []).map((组) => {
      const 指定 = 查询.get(`palette.${组.编号}`);
      return [组.编号, 指定 !== null && 组.选项.includes(指定) ? 指定 : 组.默认];
    }),
  );
}
export function 有效配色组合(组: readonly 配色分组[] = [], 配色: 样品设定 = {}): boolean {
  return (
    Object.keys(配色).length === 组.length &&
    组.every((项) => 项.选项.includes(配色[项.编号] ?? ""))
  );
}
export function 获取样品分类(样品: 预览样品): 样品分类 {
  const 分类 = 样品.分类 === "基础控件" ? "基础组件" : (样品.分类 ?? "基础组件");
  if (!预览分类.includes(分类)) throw new Error(`无效的预览分类：${分类}`);
  return 分类;
}
export function 获取样品阶段(样品: { 交付?: { 阶段?: string } }): Exclude<样品阶段筛选, "全部"> {
  if (样品.交付?.阶段 === "界面线稿") return "线稿";
  if (样品.交付?.阶段 === "游戏接入") return "已接入";
  return "样板";
}
export function 解析预览阶段(查询: URLSearchParams): 样品阶段筛选 {
  const 指定 = 查询.get("stage");
  if (指定 === "界面线稿") return "线稿";
  if (指定 === "游戏接入") return "已接入";
  if (指定 === "组件样板" || 指定 === "规范样板") return "样板";
  return 预览阶段.find((项) => 项 === 指定) ?? "全部";
}
export function 筛选分类样品(库: 预览库, 分类: 样品分类, 阶段: 样品阶段筛选 = "全部") {
  return 库.样品.filter(
    (项) => 获取样品分类(项) === 分类 && (阶段 === "全部" || 获取样品阶段(项) === 阶段),
  );
}
export function 解析预览分类(库: 预览库, 查询: URLSearchParams): 样品分类 {
  const 指定 = 查询.get("category") === "基础控件" ? "基础组件" : 查询.get("category");
  const 分类 = 预览分类.find((项) => 项 === 指定);
  if (分类) return 分类;
  const 样品 = 库.样品.find((项) => 项.编号 === 查询.get("sample"));
  if (样品) return 获取样品分类(样品);
  const 阶段 = 解析预览阶段(查询);
  if (阶段 !== "全部") {
    const 有内容 = 预览分类.find((项) => 筛选分类样品(库, 项, 阶段).length > 0);
    if (有内容) return 有内容;
  }
  return "基础组件";
}
export function 获取展示样品(库: 预览库, 查询: URLSearchParams) {
  const 阶段 = 解析预览阶段(查询);
  const 分类 = 解析预览分类(库, 查询);
  const 样品 = 筛选分类样品(库, 分类, 阶段);
  const 放大 = 查询.get("focus") === "1";
  if (!放大 && 查询.get("embed") !== "1" && !使用整页预览(库, 分类)) return 样品;
  const 当前 = 样品.find((项) => 项.编号 === 查询.get("sample")) ?? 样品[0];
  if (当前 && 放大) {
    const 原高 = 当前.样板高;
    return [
      {
        ...当前,
        样板宽: 1440,
        样板高: (宽: number, 设定?: 样品设定) =>
          typeof 原高 === "function" ? 原高(宽, 设定) : ((原高 ?? 220) * 宽) / (当前.样板宽 ?? 480),
      },
    ];
  }
  return 当前 ? [当前] : [];
}
export function 使用整页预览(库: 预览库, 分类: 样品分类): boolean {
  return 库.编号 === "phaser" && (分类 === "页面" || 分类 === "弹层");
}
export function 解析预览选择(库: readonly 预览库[], 查询: URLSearchParams) {
  const 当前库 = 库.find((项) => 项.编号 === 查询.get("library")) ?? 库[0];
  if (!当前库) throw new Error("预览库不能为空");
  const 样品 = 当前库.样品.find((项) => 项.编号 === 查询.get("sample")) ?? 当前库.样品[0];
  if (!样品) throw new Error("预览样品不能为空");
  const 设定 = { ...样品.默认 };
  for (const 开关 of 样品.开关) {
    const 值 = 查询.get(`state.${开关.键}`);
    if (值 !== null && 有效设定值(开关, 值)) 设定[开关.键] = 值;
  }
  return { 库: 当前库, 样品, 设定 };
}

export function 有效设定值(开关: 样品开关, 值: string) {
  if (开关.选项.includes(值)) return true;
  const 数值 = Number(值);
  return Boolean(
    开关.范围 && 值.trim() && Number.isFinite(数值) && 数值 >= 开关.范围[0] && 数值 <= 开关.范围[1],
  );
}
