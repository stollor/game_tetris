import { afterEach, expect, test } from "bun:test";
import { 探测Tap能力 } from "../代码/平台/Tap环境";
import { 序列化快照, 应用快照到本地, 收集本地键, 解析快照 } from "../代码/平台/云存档快照";
import { 清空分析缓冲, 记录分析事件, 读取分析缓冲 } from "../代码/平台/分析";
import { 排行榜分数 } from "../代码/平台/排行榜";
import { Tap应用 } from "../代码/平台/配置";

function 假存储(初始: Record<string, string> = {}): Storage {
  const map = new Map(Object.entries(初始));
  return {
    get length() {
      return map.size;
    },
    clear() {
      map.clear();
    },
    getItem(键: string) {
      return map.has(键) ? map.get(键)! : null;
    },
    key(索引: number) {
      return [...map.keys()][索引] ?? null;
    },
    removeItem(键: string) {
      map.delete(键);
    },
    setItem(键: string, 值: string) {
      map.set(键, 值);
    },
  };
}

afterEach(() => 清空分析缓冲());

test("ClientID 已写入公开配置", () => {
  expect(Tap应用.ClientID).toBe("ps0g5bb9grmqohjh2z");
  expect(Tap应用.应用编号).toBe(977300);
});

test("无 tap 时能力探测全为假", () => {
  expect(探测Tap能力(undefined)).toEqual({
    在Tap容器: false,
    有文件系统: false,
    有云存档: false,
    有排行榜: false,
    有成就: false,
    有登录: false,
    用户数据路径: "",
  });
});

test("云快照往返保留旅行与纪录键", () => {
  const 旅行 = JSON.stringify({ 金币: 1 });
  const 纪录 = JSON.stringify({ 分数: 9, 用时: null });
  const 存储 = 假存储({
    "旅行版:收藏": 旅行,
    "neon-pulse:achievements": "{}",
    "neon-pulse:best:马拉松": 纪录,
    其它: "忽略",
  });
  const 快照 = 收集本地键(存储, () => 123);
  expect(快照.clientId).toBe(Tap应用.ClientID);
  expect(快照.updatedAt).toBe(123);
  expect(快照.keys["其它"]).toBeUndefined();
  expect(快照.keys["neon-pulse:best:马拉松"]).toContain("9");
  const 还原 = 解析快照(序列化快照(快照));
  expect(还原).not.toBeNull();
  const 目标 = 假存储();
  expect(应用快照到本地(目标, 还原!)).toBe(3);
  expect(目标.getItem("旅行版:收藏")).toBe(旅行);
});

test("冲刺排行榜用完赛用时毫秒，未完赛不上榜", () => {
  // 时间型榜：45.000s 完赛应提交 45000（毫秒），不能除成秒以免丢精度且与后台展示错位。
  expect(排行榜分数("冲刺", 999, 45000, true)).toBe(45000);
  expect(排行榜分数("冲刺", 999, 12345, true)).toBe(12345);
  expect(排行榜分数("冲刺", 999, 12345, false)).toBeNull();
  expect(排行榜分数("马拉松", 4321, null, false)).toBe(4321);
});

test("分析事件默认只缓冲不外发", () => {
  记录分析事件("session_start", { 在Tap容器: false });
  expect(读取分析缓冲()).toHaveLength(1);
  expect(读取分析缓冲()[0]?.properties.client_id).toBe(Tap应用.ClientID);
});

test("mock 宿主时能力探测全为真", () => {
  const 宿主 = {
    env: { USER_DATA_PATH: "tapfile://usr" },
    getFileSystemManager() {
      return {};
    },
    getCloudSaveManager() {
      return {};
    },
    getLeaderboardManager() {
      return {};
    },
    createAchievementManager() {
      return {};
    },
    login() {},
  };
  expect(探测Tap能力(宿主 as never)).toEqual({
    在Tap容器: true,
    有文件系统: true,
    有云存档: true,
    有排行榜: true,
    有成就: true,
    有登录: true,
    用户数据路径: "tapfile://usr",
  });
});

test("有 mock 云存档时上传再拉取可写回本地", async () => {
  const { 上传云存档, 拉取云存档 } = await import("../代码/平台/云存档");
  const files = new Map<string, string>();
  const saves: { uuid: string; name: string; fileId: string }[] = [];
  const 宿主 = {
    env: { USER_DATA_PATH: "tapfile://usr" },
    getFileSystemManager() {
      return {
        writeFile({
          filePath,
          data,
          success,
        }: {
          filePath: string;
          data: string;
          success?: () => void;
        }) {
          files.set(filePath, data);
          success?.();
        },
        readFile({
          filePath,
          success,
          fail,
        }: {
          filePath: string;
          success?: (res: { data: string }) => void;
          fail?: (e: Error) => void;
        }) {
          if (!files.has(filePath)) return fail?.(new Error("missing"));
          success?.({ data: files.get(filePath)! });
        },
      };
    },
    getCloudSaveManager() {
      return {
        getArchiveList({ success }: { success?: (res: { saves: typeof saves }) => void }) {
          success?.({ saves: [...saves] });
        },
        createArchive({
          archiveMetaData,
          archiveFilePath,
          success,
        }: {
          archiveMetaData: { name: string };
          archiveFilePath: string;
          success?: () => void;
        }) {
          const data = files.get(archiveFilePath) ?? "";
          files.set("tapfile://usr/slot_travel_v1_dl.json", data);
          saves.push({ uuid: "u1", name: archiveMetaData.name, fileId: "f1" });
          success?.();
        },
        updateArchive({ success }: { success?: () => void }) {
          success?.();
        },
        getArchiveData({
          targetFilePath,
          success,
        }: {
          targetFilePath: string;
          success?: (res: { filePath: string }) => void;
        }) {
          const src = files.get("tapfile://usr/slot_travel_v1.json");
          if (src) files.set(targetFilePath, src);
          success?.({ filePath: targetFilePath });
        },
      };
    },
  };
  (globalThis as { window?: { tap?: typeof 宿主 } }).window = { tap: 宿主 };
  const 源 = 假存储({ "旅行版:收藏": JSON.stringify({ 金币: 7 }) });
  const 上传 = await 上传云存档(源);
  expect(上传.完成).toBe(true);
  expect(上传.方向).toBe("上传");
  const 目标 = 假存储();
  const 拉取 = await 拉取云存档(目标);
  expect(拉取.完成).toBe(true);
  expect(目标.getItem("旅行版:收藏")).toContain("7");
  delete (globalThis as { window?: unknown }).window;
});
