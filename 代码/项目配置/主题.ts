import 运行配置 from "../../配置/配置表.json";

const 表 = 运行配置.表.find((项) => 项.id === "presentation");
if (!表 || !("默认主题" in 表.值) || typeof 表.值.默认主题 !== "string" || !表.值.默认主题)
  throw Error("配置表缺少项目默认主题");
export const 项目默认主题 = 表.值.默认主题;
