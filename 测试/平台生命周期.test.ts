import { expect, spyOn, test } from "bun:test";
import * as 云 from "../代码/平台/云存档";
import { 清空分析缓冲, 读取分析缓冲 } from "../代码/平台/分析";
import { 结算后同步平台 } from "../代码/平台/结算同步";
import { 创建纪录服务 } from "../代码/应用/服务/纪录";

test("纪录存储失败不被误报为刷新成功", () => {
  const 存储: Storage = {
    length: 0,
    clear() {},
    getItem: () => null,
    key: () => null,
    removeItem() {},
    setItem() {
      throw new Error("配额");
    },
  };
  expect(() => 创建纪录服务(存储).保存("马拉松", { 分数: 1, 用时: null })).toThrow(
    "本地纪录保存失败",
  );
});

test("本地保存失败时仍记录结束但不上传旧云档", () => {
  const 替身 = spyOn(云, "上传云存档").mockResolvedValue({ 完成: true, 原因: "夹具" });
  清空分析缓冲();
  try {
    结算后同步平台(
      {
        模式: "马拉松",
        分数: 1,

        用时毫秒: null,
        完赛: false,
      },
      [],
      false,
    );
    expect(替身).not.toHaveBeenCalled();
    expect(读取分析缓冲().filter((项) => 项.name === "mode_end")).toHaveLength(1);
  } finally {
    替身.mockRestore();
    清空分析缓冲();
  }
});
