import { 探测Tap能力, 读取Tap宿主 } from "../../.gamemaker/依赖/框架/平台/TapTap/宿主探测";
import type { Tap云存档项 } from "../../.gamemaker/依赖/框架/平台/TapTap/宿主类型";
import { 迁移更名前存档 } from "../存档/更名迁移";
import { 按英文取文案 } from "../语言/文案";
import { 填充文案 } from "../语言/类型";
import {
  序列化快照,
  应用快照到本地,
  收集本地键,
  本地更新时间,
  标记本地同步时间,
  解析快照,
} from "./云存档快照";
import { 更新云同步状态 } from "./云存档状态";
import { 是未登录错误 } from "./登录";
import { 云存档槽名 } from "./配置";

/** 状态原因会落进快照并直接展示，统一取字典的简体中文表；英文界面由 格式化云同步文案 负责。 */
const 文案 = 按英文取文案(false);

const 最小上传间隔毫秒 = 60_000;
let 上次上传 = 0;

function 异步化<T>(
  执行: (成功: (值: T) => void, 失败: (错误: unknown) => void) => void,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const 定时 = setTimeout(() => reject(new Error(文案.云存储回调超时)), 8000);
    try {
      执行(
        (值) => {
          clearTimeout(定时);
          resolve(值);
        },
        (错误) => {
          clearTimeout(定时);
          reject(错误);
        },
      );
    } catch (错误) {
      clearTimeout(定时);
      reject(错误);
    }
  });
}

export interface 云同步结果 {
  完成: boolean;
  原因: string;
  方向?: "上传" | "下载" | "跳过";
}

export async function 上传云存档(存储: Storage = localStorage): Promise<云同步结果> {
  const 能力 = 探测Tap能力();
  if (!能力.有云存档 || !能力.有文件系统) {
    更新云同步状态({ 状态: "无能力", 原因: 文案.云存储无能力, 方向: "跳过" });
    return { 完成: false, 原因: 文案.云存储无能力, 方向: "跳过" };
  }
  const 现在 = Date.now();
  if (现在 - 上次上传 < 最小上传间隔毫秒) {
    更新云同步状态({ 状态: "跳过", 原因: 文案.云存储上传限频, 方向: "跳过" });
    return { 完成: false, 原因: 文案.云存储上传限频, 方向: "跳过" };
  }
  更新云同步状态({ 状态: "同步中", 原因: 文案.云存储上传中, 方向: "上传" });
  try {
    const 宿主 = 读取Tap宿主();
    const fs = 宿主?.getFileSystemManager?.();
    const cloud = 宿主?.getCloudSaveManager?.();
    const 根 = 能力.用户数据路径 || "tapfile://usr";
    if (!fs || !cloud) return { 完成: false, 原因: 文案.云存储管理器不可用, 方向: "跳过" };

    const 快照 = 收集本地键(存储);
    const 路径 = `${根}/${云存档槽名}.json`;
    await 异步化<void>((成功, 失败) => {
      fs.writeFile({
        filePath: 路径,
        data: 序列化快照(快照),
        encoding: "utf8",
        success: () => 成功(),
        fail: 失败,
      });
    });

    const 列表 = await 异步化<Tap云存档项[]>((成功, 失败) => {
      cloud.getArchiveList({
        success: (res) => 成功(res.saves ?? []),
        fail: 失败,
      });
    });
    const 已有 = 列表.find((s) => s.name === 云存档槽名);
    const 元 = {
      name: 云存档槽名,
      summary: `travel-${快照.updatedAt}`,
      playtime: 0,
    };
    await 异步化<void>((成功, 失败) => {
      const 选项 = {
        archiveMetaData: 元,
        archiveFilePath: 路径,
        success: () => 成功(),
        fail: 失败,
      };
      if (已有) cloud.updateArchive({ archiveUUID: 已有.uuid, ...选项 });
      else cloud.createArchive(选项);
    });
    上次上传 = 现在;
    标记本地同步时间(存储, 快照.updatedAt);
    const 原因 = 已有 ? 文案.云存储已更新 : 文案.云存储已创建;
    更新云同步状态({ 状态: "已同步", 原因, 方向: "上传", 上次成功时间: 快照.updatedAt });
    return { 完成: true, 原因, 方向: "上传" };
  } catch (错误) {
    const 原因 = 错误 instanceof Error ? 错误.message : String(错误);
    更新云同步状态({
      状态: 是未登录错误(undefined, 原因) ? "未登录" : "失败",
      原因,
      方向: "上传",
    });
    return { 完成: false, 原因, 方向: "上传" };
  }
}

export async function 拉取云存档(存储: Storage = localStorage): Promise<云同步结果> {
  const 能力 = 探测Tap能力();
  if (!能力.有云存档 || !能力.有文件系统) {
    更新云同步状态({ 状态: "无能力", 原因: 文案.云存储无能力, 方向: "跳过" });
    return { 完成: false, 原因: 文案.云存储无能力, 方向: "跳过" };
  }
  更新云同步状态({ 状态: "同步中", 原因: 文案.云存储拉取中, 方向: "下载" });
  try {
    const 宿主 = 读取Tap宿主();
    const fs = 宿主?.getFileSystemManager?.();
    const cloud = 宿主?.getCloudSaveManager?.();
    const 根 = 能力.用户数据路径 || "tapfile://usr";
    if (!fs || !cloud) return { 完成: false, 原因: 文案.云存储管理器不可用, 方向: "跳过" };

    const 列表 = await 异步化<Tap云存档项[]>((成功, 失败) => {
      cloud.getArchiveList({
        success: (res) => 成功(res.saves ?? []),
        fail: 失败,
      });
    });
    const 槽 = 列表.find((s) => s.name === 云存档槽名);
    if (!槽) {
      更新云同步状态({ 状态: "跳过", 原因: 文案.云存储云端无存档, 方向: "跳过" });
      return { 完成: false, 原因: 文案.云存储云端无存档, 方向: "跳过" };
    }

    const 目标 = `${根}/${云存档槽名}_dl.json`;
    const 文件路径 = await 异步化<string>((成功, 失败) => {
      cloud.getArchiveData({
        archiveUUID: 槽.uuid,
        archiveFileId: 槽.fileId,
        targetFilePath: 目标,
        success: (res) => 成功(res.filePath),
        fail: 失败,
      });
    });
    const 原文 = await 异步化<string>((成功, 失败) => {
      fs.readFile({
        filePath: 文件路径,
        encoding: "utf8",
        success: (res) => 成功(res.data),
        fail: 失败,
      });
    });
    const 快照 = 解析快照(原文);
    if (!快照) {
      更新云同步状态({ 状态: "失败", 原因: 文案.云存储格式无效, 方向: "下载" });
      return { 完成: false, 原因: 文案.云存储格式无效, 方向: "下载" };
    }

    const 本地时间 = 本地更新时间(存储);
    if (快照.updatedAt < 本地时间) {
      更新云同步状态({ 状态: "跳过", 原因: 文案.云存储本地较新, 方向: "跳过" });
      return { 完成: false, 原因: 文案.云存储本地较新, 方向: "跳过" };
    }
    const n = 应用快照到本地(存储, 快照);
    迁移更名前存档(存储);
    标记本地同步时间(存储, 快照.updatedAt);
    更新云同步状态({
      状态: "已同步",
      原因: 填充文案(文案.云存储已写入, { 数量: n }),
      方向: "下载",
      上次成功时间: 快照.updatedAt,
    });
    return { 完成: true, 原因: 填充文案(文案.云存储已写入, { 数量: n }), 方向: "下载" };
  } catch (错误) {
    const 原因 = 错误 instanceof Error ? 错误.message : String(错误);
    更新云同步状态({
      状态: 是未登录错误(undefined, 原因) ? "未登录" : "失败",
      原因,
      方向: "下载",
    });
    return { 完成: false, 原因, 方向: "下载" };
  }
}

/** 结算等关键节点：尽力上传，失败静默（调用方可展示原因）。 */
export function 尝试上传云存档(): void {
  void 上传云存档().catch((错误) => {
    const 原因 = 错误 instanceof Error ? 错误.message : String(错误);
    更新云同步状态({
      状态: 是未登录错误(undefined, 原因) ? "未登录" : "失败",
      原因,
      方向: "上传",
    });
  });
}

/** 设置页「立即同步」：先拉再推，绕过短限频。 */
export async function 立即同步云存档(存储: Storage = localStorage): Promise<云同步结果> {
  上次上传 = 0;
  try {
    const 拉 = await 拉取云存档(存储);
    const 推 = await 上传云存档(存储);
    if (推.完成) return 推;
    if (拉.完成) return 拉;
    return 推.原因 ? 推 : 拉;
  } catch (错误) {
    const 原因 = 错误 instanceof Error ? 错误.message : String(错误);
    更新云同步状态({
      状态: 是未登录错误(undefined, 原因) ? "未登录" : "失败",
      原因,
    });
    return { 完成: false, 原因, 方向: "跳过" };
  }
}
