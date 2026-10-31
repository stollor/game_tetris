import { describe, expect, test } from "bun:test";
import { 格式化排行榜错误, 周期标签 } from "../../../代码/平台/排行榜";
import { 格式化用户身份文案, type Tap用户身份 } from "../../../代码/平台/用户身份";
import { 请求Tap登录 } from "../../../代码/平台/登录";
import { 成就同步文案 } from "../../../代码/平台/平台成就";
import { 按英文取文案 } from "../../../代码/语言/文案";

/**
 * 平台层文案：展示文字全部来自 代码/语言 字典，函数只做状态→文案映射，
 * 中文/英文走同一份 key，不在函数里写平行双语表。
 */

const 身份: Tap用户身份 = { openid: "oid-demo", nickName: "玩家甲", 来源: "测试", 更新时间: 0 };

describe("排行榜文案", () => {
  test("周期标签中日榜英文由字典提供", () => {
    expect(周期标签("日", 按英文取文案(false))).toBe("日榜");
    expect(周期标签("周", 按英文取文案(false))).toBe("周榜");
    expect(周期标签("月", 按英文取文案(false))).toBe("月榜");
    expect(周期标签("总", 按英文取文案(false))).toBe("总榜");
    expect(周期标签("日", 按英文取文案(true))).toBe("Daily");
    expect(周期标签("总", 按英文取文案(true))).toBe("All-time");
  });

  test("常见错误码给可读文案，不暴露裸码", () => {
    const 白名单 = 格式化排行榜错误(500001, "500001:leaderboard id x not exist");
    expect(白名单).toContain("白名单");
    expect(白名单).not.toMatch(/^500001/);
    expect(格式化排行榜错误(500002, "")).toContain("不匹配");
    expect(格式化排行榜错误(500000, "")).toContain("周期已结束");
    expect(格式化排行榜错误(500101, "")).toContain("权限");
    expect(格式化排行榜错误(500102, "")).toContain("登录");
  });

  test("无匹配码时剥掉 code: 前缀，空消息回落到加载失败", () => {
    expect(格式化排行榜错误(600001, "600001: 宿主异常")).toBe("加载失败：宿主异常");
    expect(格式化排行榜错误(undefined, "")).toBe("加载排行榜失败，请稍后重试。");
  });

  test("英文文案同样来自字典", () => {
    expect(格式化排行榜错误(500001, "x", true)).toMatch(/unavailable/i);
    expect(格式化排行榜错误(undefined, "", true)).toBe("Failed to load leaderboard.");
  });
});

describe("用户身份文案", () => {
  test("openid 优先、昵称其次，中英各一份", () => {
    expect(格式化用户身份文案(身份)).toBe("用户ID oid-demo");
    expect(格式化用户身份文案(身份, true)).toBe("ID oid-demo");
    expect(格式化用户身份文案({ ...身份, openid: "" })).toBe("用户 玩家甲");
    expect(格式化用户身份文案({ ...身份, openid: "" }, true)).toBe("User 玩家甲");
    expect(格式化用户身份文案({ openid: "", nickName: "", 来源: "", 更新时间: 0 })).toBe("");
  });
});

describe("平台登录与成就文案", () => {
  test("浏览器无宿主时登录失败原因来自字典", async () => {
    const 中文 = await 请求Tap登录();
    expect(中文.完成).toBe(false);
    expect(中文.原因).not.toBe("");
    const 英文 = await 请求Tap登录(true);
    expect(英文.完成).toBe(false);
    expect(英文.原因).toMatch(/[A-Za-z]/);
  });

  test("成就同步文案按状态取字典，失败原因随文案拼进来", () => {
    expect(成就同步文案({ 状态: "已同步", 原因: "", 时间: 0 })).toBe("已同步到 TapTap");
    expect(成就同步文案({ 状态: "失败", 原因: "网络错误", 时间: 0 })).toContain("网络错误");
    expect(成就同步文案({ 状态: "失败", 原因: "", 时间: 0 })).toContain("未知错误");
    expect(成就同步文案({ 状态: "同步中", 原因: "", 时间: 0 }, true)).toBe("Syncing to TapTap…");
    expect(成就同步文案({ 状态: "未映射", 原因: "", 时间: 0 }, true)).toBe("Not linked");
  });
});
