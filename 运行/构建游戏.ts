import { 打包游戏 } from "../GM工具/源码/游戏项目/打包/打包游戏";

const 结果 = await 打包游戏(process.cwd(), Bun.argv.includes("--验收") ? "验收" : "发布");
if (!结果.成功) throw new Error(结果.错误);
console.log(结果.摘要.产物目录);
