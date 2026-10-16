/** 宿主注入的 tap 能力最小类型；真机以探测结果为准。 */
export interface Tap文件管理器 {
  writeFile(选项: {
    filePath: string;
    data: string;
    encoding?: string;
    success?: () => void;
    fail?: (错误: unknown) => void;
  }): void;
  readFile(选项: {
    filePath: string;
    encoding?: string;
    success?: (结果: { data: string }) => void;
    fail?: (错误: unknown) => void;
  }): void;
}

export interface Tap云存档项 {
  uuid: string;
  name: string;
  fileId?: string;
  modifiedTime?: number;
  summary?: string;
}

export interface Tap云存档管理器 {
  createArchive(选项: Record<string, unknown>): void;
  updateArchive(选项: Record<string, unknown>): void;
  getArchiveList(选项: {
    success?: (结果: { saves?: Tap云存档项[] }) => void;
    fail?: (错误: unknown) => void;
  }): void;
  getArchiveData(选项: {
    archiveUUID: string;
    archiveFileId?: string;
    targetFilePath: string;
    success?: (结果: { filePath: string }) => void;
    fail?: (错误: unknown) => void;
  }): void;
}

export interface Tap排行榜管理器 {
  submitScores(选项: {
    scores: { leaderboardId: string; score: number }[];
    callback?: {
      onSuccess?: (结果: unknown) => void;
      onFailure?: (代码: number, 消息: string) => void;
    };
  }): void;
  openLeaderboard(选项: {
    leaderboardId: string;
    collection?: string;
    callback?: {
      onSuccess?: () => void;
      onFailure?: (代码: number, 消息: string) => void;
    };
  }): void;
}

export interface Tap成就管理器 {
  unlockAchievement?(选项: {
    achievementId: string;
    callback?: {
      onAchievementSuccess?: () => void;
      onAchievementFailure?: (错误: unknown) => void;
    };
  }): void;
  growAchievementSteps?(选项: {
    achievementId: string;
    steps: number;
    callback?: {
      onAchievementSuccess?: () => void;
      onAchievementFailure?: (错误: unknown) => void;
    };
  }): void;
  showAchievementPage?(): void;
}

export interface Tap宿主 {
  env?: { USER_DATA_PATH?: string; TEMP_DATA_PATH?: string };
  getFileSystemManager?: () => Tap文件管理器;
  getCloudSaveManager?: () => Tap云存档管理器;
  getLeaderboardManager?: () => Tap排行榜管理器;
  createAchievementManager?: (选项?: { toastEnable?: boolean }) => Tap成就管理器;
  login?: (选项: Record<string, unknown>) => void;
}

declare global {
  interface Window {
    tap?: Tap宿主;
    __TAP_PROBE__?: Record<string, unknown>;
    __GAME_PLATFORM__?: Record<string, unknown>;
  }
}
