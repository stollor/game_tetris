import { cp, readdir, rm, rmdir } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import { 打包游戏 } from "../.gamemaker/依赖/GM/工具链/游戏项目/打包/打包游戏";

/**
 * 打包入口。GM 目前把包体写到项目根的 `产物/`、把打包报告写到 `reports/`；
 * 本项目把「不是项目内容」的东西统一收在 `.gamemaker/`，所以打完立即搬家，
 * 根目录只留项目和工程文件。GM 支持可配置产物/报告根后，这段搬迁可以删掉。
 */
const 项目目录 = process.cwd();

/** 把根源目录的每个子目录合并进归档目录，再删掉根源目录。 */
async function 搬走(源: string, 归档: string) {
  if (!(await readdir(源).catch(() => null))) return;
  for (const 子 of await readdir(源)) {
    await cp(join(源, 子), join(归档, 子), { recursive: true, force: true });
  }
  await rm(源, { recursive: true, force: true });
  console.log(`已归档 ${relative(项目目录, 源)} → ${relative(项目目录, 归档)}`);
}

const 结果 = await 打包游戏(项目目录, Bun.argv.includes("--验收") ? "验收" : "发布");
if (!结果.成功) throw new Error(结果.错误);
console.log(结果.摘要.产物目录);

await 搬走(join(项目目录, "产物"), join(项目目录, ".gamemaker/产物"));
await 搬走(join(项目目录, "reports"), join(项目目录, ".gamemaker/报告"));
await rmdir(join(项目目录, "reports")).catch(() => {});
console.log("产物目录：" + resolve(项目目录, ".gamemaker/产物"));
