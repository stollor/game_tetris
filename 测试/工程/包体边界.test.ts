import { expect, test } from "bun:test";
import { join } from "node:path";
import { 构建项目 } from "../../.gamemaker/依赖/GM/工具链/游戏项目/构建/构建项目";
import { 项目根 as 项目根路径 } from "../接入/项目路径";

test("外部包不携带测试、看板目录或默认主题，发布配置只保留客户端字段", async () => {
  const 结果 = await 构建项目(
    {
      entrypoints: [join(项目根路径, "index.html")],
      minify: true,
    },
    "发布",
  );
  expect(结果.success).toBe(true);
  for (const 输出 of Object.values(结果.metafile!.outputs))
    for (const [路径, 输入] of Object.entries(输出.inputs))
      if (/[/\\]测试[/\\]|样式[/\\](夜空鎏金|暖纸古典|青蓝未来)\.ts/.test(路径))
        expect(输入.bytesInOutput, 路径).toBe(0);
  const 脚本 = (
    await Promise.all(结果.outputs.filter((项) => 项.path.endsWith(".js")).map((项) => 项.text()))
  ).join("\n");
  for (const 标记 of ["__GAMEMAKER_TEST__", "__再消一行测试__", "gm-ui-themes-read"])
    expect(脚本).not.toContain(标记);
  const 配置 = await 构建项目(
    { entrypoints: [join(项目根路径, "代码/平台/配置.ts")], minify: true },
    "发布",
  );
  const 公开配置 = await 配置.outputs[0]!.text();
  expect(公开配置).toContain("ClientID");
  expect(公开配置).not.toMatch(/录制|本地键|方向|版本号|单位/);
});
