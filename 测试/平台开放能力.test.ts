import { afterEach, expect, test } from "bun:test";
import { 序列化快照, 应用快照到本地, 收集本地键, 解析快照 } from "../代码/平台/云存档快照";
import { 清空分析缓冲, 记录分析事件, 读取分析缓冲 } from "../代码/平台/分析";
import { 排行榜分数 } from "../代码/平台/排行榜";
import { Tap应用 } from "../代码/平台/配置";
import { 探测Tap能力 } from "../框架Three/平台/TapTap/宿主探测";

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

test("周期榜配置：日周月总均已填入后台 ID", async () => {
  const { 已配置的周期, 取排行榜编号, 排行榜周期顺序 } = await import("../代码/平台/排行榜");
  const { 排行榜编号按周期 } = await import("../代码/平台/配置");
  expect(排行榜周期顺序).toEqual(["日", "周", "月", "总"]);
  expect(取排行榜编号("马拉松", "总")).toBe(排行榜编号按周期.马拉松.总);
  expect(取排行榜编号("冲刺", "日")).toBe("ppu0nc3fklanwcbiok");
  expect(取排行榜编号("极限", "周")).toBe("if044o8sbpsvhwmhdi");
  expect(取排行榜编号("每日挑战", "月")).toBe("spxfpwkk4li9j5scgb");
  expect(已配置的周期("极限")).toEqual(["日", "周", "月", "总"]);
  expect(已配置的周期("马拉松")).toEqual(["日", "周", "月", "总"]);
  expect(排行榜编号按周期.马拉松.日).toBe("3gzyt8qlnrpvj2isf5");
});

test("加载排行榜：未配置周期返回说明；mock 宿主可拉榜", async () => {
  const { 加载排行榜数据 } = await import("../代码/平台/排行榜");
  // 临时清空冲刺日榜编号，验证未配置提示后还原。
  const cfg = await import("../代码/平台/配置");
  const 原日 = (cfg.排行榜编号按周期 as { 冲刺: { 日: string } }).冲刺.日;
  (cfg.排行榜编号按周期 as { 冲刺: { 日: string } }).冲刺.日 = "";
  const 未配 = await 加载排行榜数据({ 模式: "冲刺", 周期: "日" });
  (cfg.排行榜编号按周期 as { 冲刺: { 日: string } }).冲刺.日 = 原日;
  expect(未配.完成).toBe(false);
  expect(未配.原因).toContain("尚未配置");

  const scores = [
    { rank: 1, score: 100, user: { name: "A" } },
    { rank: 2, score: 80, user: { name: "B" } },
  ];
  const 宿主 = {
    getLeaderboardManager() {
      return {
        loadLeaderboardScores({
          leaderboardId,
          periodToken,
          callback,
        }: {
          leaderboardId: string;
          periodToken?: string;
          callback?: {
            onSuccess?: (r: unknown) => void;
            onFailure?: (c: number, m: string) => void;
          };
        }) {
          callback?.onSuccess?.({
            scores,
            leaderboard: {
              id: leaderboardId,
              period: { display: periodToken ? "历史" : "", periodToken: periodToken || "" },
              availablePeriods: [{ display: "本周", periodToken: "1-2" }],
            },
          });
        },
        loadCurrentPlayerLeaderboardScore({
          callback,
        }: {
          callback?: { onSuccess?: (r: unknown) => void };
        }) {
          callback?.onSuccess?.({ currentUserScore: { rank: 2, score: 80, user: { name: "B" } } });
        },
        submitScores() {},
        openLeaderboard() {},
      };
    },
  };
  (globalThis as { window?: { tap?: typeof 宿主 } }).window = { tap: 宿主 };
  const 有 = await 加载排行榜数据({ 模式: "马拉松", 周期: "总", 条数: 10 });
  expect(有.完成).toBe(true);
  expect(有.分数列表).toHaveLength(2);
  expect(有.我的?.rank).toBe(2);
  delete (globalThis as { window?: unknown }).window;
});

test("成就解锁走 Tap API 并记录同步状态", async () => {
  const { 解锁平台成就, 读取成就同步状态 } = await import("../代码/平台/平台成就");
  let 收到 = "";
  const 宿主 = {
    createAchievementManager() {
      return {
        unlockAchievement({
          achievementId,
          callback,
        }: {
          achievementId: string;
          callback?: {
            onAchievementSuccess?: () => void;
            onAchievementFailure?: (e: unknown) => void;
          };
        }) {
          收到 = achievementId;
          callback?.onAchievementSuccess?.();
        },
      };
    },
  };
  (globalThis as { window?: { tap?: typeof 宿主 } }).window = { tap: 宿主 };
  const r = await 解锁平台成就("first-lock");
  expect(r.完成).toBe(true);
  expect(收到).toBe("FIRST_LOCK");
  expect(读取成就同步状态("first-lock").状态).toBe("已同步");
  delete (globalThis as { window?: unknown }).window;
});

test("成就同步状态会落盘，失败原因可读", async () => {
  const store = new Map<string, string>();
  (globalThis as { localStorage?: Storage }).localStorage = {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(k) {
      return store.has(k) ? store.get(k)! : null;
    },
    key(i) {
      return [...store.keys()][i] ?? null;
    },
    removeItem(k) {
      store.delete(k);
    },
    setItem(k, v) {
      store.set(k, v);
    },
  } as Storage;
  const { 解锁平台成就, 读取成就同步状态, 解释成就失败 } = await import("../代码/平台/平台成就");
  expect(解释成就失败(undefined, "achievement pending publish")).toContain("待发布");
  const 宿主 = {
    createAchievementManager() {
      return {
        unlockAchievement({
          callback,
        }: {
          achievementId: string;
          callback?: {
            onAchievementSuccess?: () => void;
            onAchievementFailure?: (e: unknown) => void;
          };
        }) {
          callback?.onAchievementFailure?.(new Error("not login"));
        },
      };
    },
  };
  (globalThis as { window?: { tap?: typeof 宿主 } }).window = { tap: 宿主 };
  const r = await 解锁平台成就("first-clear", true);
  expect(r.完成).toBe(false);
  expect(r.原因).toContain("未登录");
  expect(读取成就同步状态("first-clear").状态).toBe("失败");
  expect(store.get("旅行版:成就同步") || "").toContain("first-clear");
  delete (globalThis as { window?: unknown }).window;
});

test("云同步文案在有用户身份时带上 ID", async () => {
  const { 记录Tap用户身份 } = await import("../代码/平台/用户身份");
  const { 更新云同步状态, 格式化云同步文案, 读取云同步状态 } = await import(
    "../代码/平台/云存档状态"
  );
  记录Tap用户身份({ openid: "oid-demo", 来源: "test" });
  更新云同步状态({ 状态: "已同步", 原因: "", 上次成功时间: null });
  expect(格式化云同步文案(读取云同步状态())).toContain("oid-demo");
});

test("云同步状态文案覆盖主要状态", async () => {
  const { 更新云同步状态, 格式化云同步文案, 读取云同步状态 } = await import(
    "../代码/平台/云存档状态"
  );
  更新云同步状态({ 状态: "同步中", 原因: "" });
  expect(格式化云同步文案(读取云同步状态())).toContain("同步中");
  更新云同步状态({ 状态: "失败", 原因: "网络错误" });
  expect(格式化云同步文案(读取云同步状态())).toContain("网络错误");
  更新云同步状态({ 状态: "未登录", 原因: "" });
  expect(格式化云同步文案(读取云同步状态())).toContain("未登录");
});

test("排行榜错误文案：500001 友好中文，不暴露裸码", async () => {
  const { 格式化排行榜错误, 加载排行榜数据 } = await import("../代码/平台/排行榜");
  expect(格式化排行榜错误(500001, "500001:leaderboard id 3gzyt8qlnrpvj2isf5 not exist")).toContain(
    "白名单",
  );
  expect(格式化排行榜错误(500001, "500001:leaderboard id x not exist")).not.toMatch(/^500001/);
  expect(格式化排行榜错误(500001, "x", true)).toMatch(/unavailable/i);

  const 宿主 = {
    getLeaderboardManager() {
      return {
        loadLeaderboardScores({
          callback,
        }: {
          callback?: { onFailure?: (c: number, m: string) => void };
        }) {
          callback?.onFailure?.(500001, "leaderboard id 3gzyt8qlnrpvj2isf5 not exist");
        },
        loadCurrentPlayerLeaderboardScore() {},
        submitScores() {},
        openLeaderboard() {},
      };
    },
  };
  (globalThis as { window?: { tap?: typeof 宿主 } }).window = { tap: 宿主 };
  const 失败 = await 加载排行榜数据({ 模式: "马拉松", 周期: "日" });
  expect(失败.完成).toBe(false);
  expect(失败.代码).toBe(500001);
  expect(失败.原因).toContain("白名单");
  expect(失败.原因).not.toMatch(/500001/);
  delete (globalThis as { window?: unknown }).window;
});
