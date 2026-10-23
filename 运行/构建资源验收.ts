import { mkdir, rm } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import { 构建项目 } from "../GM工具/源码/游戏项目/构建/构建项目";
import {
  扫描资源文件,
  装配资源文件,
  读取项目资源计划,
} from "../GM工具/源码/游戏项目/构建/资源装配";

// 资源夹具只进入隔离验收目录，不向正式产物复制测试图片。
const 根 = resolve(".gamemaker"),
  输出 = join(根, "资源验收");
if (relative(根, 输出) !== "资源验收") throw Error("资源验收输出越界");
await rm(输出, { recursive: true, force: true });
await mkdir(输出, { recursive: true });
const 结果 = await 构建项目({
  entrypoints: ["./index.html", "./index.资源验收.html"],
  outdir: 输出,
});
if (!结果.success) throw Error(结果.logs.join("\n"));
装配资源文件(读取项目资源计划(resolve("."), "再消一行").文件, 输出);
装配资源文件(扫描资源文件("测试/资源", "测试资源/").文件, 输出);
console.log("资源验收包：" + 输出);
