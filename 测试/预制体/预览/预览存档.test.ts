import { afterEach, describe, expect, test } from "bun:test";
import { 收藏, 收藏存档键 } from "../../../代码/存档/收藏";
import { 创建预览存储, 预览初始金币 } from "../../../资源/预制体/预览/预览存档";

/** 最小的 localStorage 替身：只需要 getItem/setItem 就能覆盖预览存储。 */
class 假存储 {
  表 = new Map<string, string>();
  getItem(键: string): string | null {
    return this.表.get(键) ?? null;
  }
  setItem(键: string, 值: string): void {
    this.表.set(键, 值);
  }
}

const 原存储 = globalThis.localStorage;
afterEach(() => {
  if (原存储 === undefined) delete (globalThis as { localStorage?: unknown }).localStorage;
  else (globalThis as { localStorage?: unknown }).localStorage = 原存储;
});

/**
 * GM 看板预览的存档必须可写且与真档隔离：
 * 只读档会让「解锁全部主题 / 设置切主题 / 商店选中」这一整条体验链断掉。
 */
describe("预览存档", () => {
  test("首次打开给足够金币的起始档、已购为空", () => {
    const 底层 = new 假存储();
    (globalThis as { localStorage?: unknown }).localStorage = 底层;
    const 缓存 = new 收藏(创建预览存储());
    const 存档 = 缓存.读取();
    expect(存档.金币).toBe(预览初始金币);
    expect(存档.已购).toEqual([]);
  });

  test("解锁主题写入预览档，重新打开仍然拥有", () => {
    const 底层 = new 假存储();
    (globalThis as { localStorage?: unknown }).localStorage = 底层;
    const 存储 = 创建预览存储();
    const 第一次 = new 收藏(存储);
    expect(第一次.测试设置拥有("立体晶格", true).成功).toBe(true);
    // 模拟切页/刷新：重新构造收藏，仍从同一份预览档读取。
    expect(new 收藏(存储).拥有("立体晶格")).toBe(true);
  });

  test("预览写档不碰玩家真档键", () => {
    const 底层 = new 假存储();
    (globalThis as { localStorage?: unknown }).localStorage = 底层;
    const 存储 = 创建预览存储();
    new 收藏(存储).测试设置拥有("砖机液晶", true);
    expect(底层.getItem(收藏存档键)).toBeNull();
    expect(底层.getItem("再消一行:预览:" + 收藏存档键)).not.toBeNull();
  });
});
