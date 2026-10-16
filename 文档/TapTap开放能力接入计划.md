# TapTap 开放能力接入计划（研究稿）

> 日期：2026-10-16。当前包体形态：`upload-h5-package` 的 **H5 ZIP**（app 977300 / dev 363566）。本文只作计划，不代替实现与提审。

## 1. 现状盘点

| 能力 | 现状 | 存储键 / 位置 |
| --- | --- | --- |
| 本地存档框架 | 已有 `框架/存档.ts`（注入 `存储接口`） | — |
| 旅行收藏 | 本机 `localStorage` + Web Locks | `旅行版:收藏` v1 |
| 模式纪录 | 本机 | `neon-pulse:best:<模式>` / `neon-pulse:daily:<日期>` |
| 成就 | 本机 `框架/进度/成就.ts` | `neon-pulse:achievements`，12 项编号见 `代码/成就/俄罗斯方块成就.ts` |
| TapTap JS / ClientID | **仓库内无任何** `tap` / ClientID / TapDB 引用 | — |
| 正式发布阻塞 | 未绑主包、未签创意工坊协议、资料缺简介/截图等 | `analyze-app-status` |

官方已写明：尚未接入账号同步与云存档（见 `文档/旅行版说明.md`）。

## 2. H5 ZIP vs 小游戏：API 可用性

| 能力 | H5（当前 ZIP，在 TapTap 客户端内打开） | 纯浏览器开发机 | 原生 TapSDK（Unity/安卓/iOS） |
| --- | --- | --- | --- |
| 云存档 | **官方写明支持** Minigame **和** H5：全局 `tap`，`getCloudSaveManager` + `getFileSystemManager`（`tapfile://`） | 无 `tap`，不可测 | 另有 CloudSave 模块，依赖登录 |
| 排行榜 | 小游戏文档：`tap.getLeaderboardManager()`；与云存档同属 `tap` 桥。**需在真机 H5 容器探测** `typeof tap?.getLeaderboardManager` | 无 | Leaderboard 模块 |
| 成就（平台） | 小游戏文档：`tap.createAchievementManager`；**需真机探测**；后台另配成就 ID | 无 | Achievement 模块 |
| 登录 | 小游戏：`tap.login` → code → 服务端 code2Session。H5 云存档是否强制登录以真机为准 | 无 | TapLogin |
| TapDB | **无 Web/H5 客户端 SDK 文档**；有 REST `https://e.tapdb.net/v2/event`（偏服务端；浏览器直连可能遇 CORS） | 可试 REST，勿依赖 | Unity/安卓/iOS SDK |
| 商店侧指标 | CLI `taptap-dashboard-stats`（下载/PV 等）与游戏内埋点无关 | — | — |

结论（当前包体路径）：

1. **优先接云存档**（文档对 H5 最明确，且无需自装 SDK 脚本进 `index.html`——宿主注入 `tap`）。
2. **排行榜 / 平台成就**：按同一 `tap` 桥设计，但以 **真机探测** 为门禁；若 H5 容器缺 API，再评估是否改「H5 小游戏」包体路径（与现 `h5` ZIP 不同，GM 文档已强调勿混用）。
3. **不要**为当前 Phaser H5 去接 Unity/安卓原生 TapSDK。
4. **Analytics**：商店指标用 CLI；游戏内事件先做本地/可选上报适配器，TapDB 待 ClientID + CORS/代理确认后再接。

文档入口：

- 云存档：https://developer.taptap.cn/minigameapidoc/dev/tutorial/open-capabilities/cloud-save-tutorial/
- 排行榜：https://developer.taptap.cn/minigameapidoc/dev/tutorial/open-capabilities/leaderboard-tutorial/
- 成就：https://developer.taptap.cn/minigameapidoc/dev/tutorial/open-capabilities/achievement/
- TapDB REST：https://developer.taptap.cn/docs/sdk/tapdb/sdk/server-side-integration/
- 发布：`GameMaker-v2/文档/TapTap发布.md`

## 3. 推荐架构（适配器压在本地之上）

```
玩法 / 结算 / 成就推进
        │
        ▼
┌───────────────────┐
│ 本地权威：存档.ts   │  ← localStorage（浏览器与 H5 都可用）
│ 旅行收藏 / 纪录 / 成就 │
└─────────┬─────────┘
          │ 关键节点（通关、破纪录、手动「同步」、启动拉取）
          ▼
┌───────────────────┐
│ Tap 环境探测        │  typeof tap !== "undefined"
└─────────┬─────────┘
     有 tap │ 无 → 仅本地
          ▼
┌───────────────────┐
│ 云存档适配器        │  writeFile(tapfile) → create/updateArchive
│ 排行榜适配器        │  submitScores / openLeaderboard（可选）
│ 平台成就适配器      │  unlock / 分步（映射本地编号 → 后台 ID）
│ 分析适配器          │  no-op | 可选 TapDB REST
└───────────────────┘
```

原则：

- **本地仍是权威**：云失败不丢进度；上传限频（文档：约每分钟 1 次）只在关键节点触发。
- **单槽云存档**（如 `slot_travel_v1`）：把 `旅行版:收藏` + 成就快照 + 各模式 best 打成一份 JSON（远小于 10MB）。
- **冲突**：比较自定义 `updatedAt` / 云 `modifiedTime`；首版 UI 可「云端较新则覆盖本地（可撤销一次）」或双按钮选择。
- **排行榜**：马拉松/极限/每日 = 降序分数；冲刺 = 升序用时（毫秒或百分秒整数）。后台建 4 张榜，Client 只存 ID 配置。
- **成就双轨**：本地 12 项继续驱动金币奖励；平台成就仅在 `tap` 可用时镜像解锁（后台 ID 与本地 `编号` 映射表）。

建议新文件（实现阶段，本轮可不写代码）：

- `代码/平台/Tap环境.ts` — 探测与类型声明
- `代码/平台/云存档.ts` — 打包/解包 + 限频
- `代码/平台/排行榜.ts` / `平台成就.ts` / `分析.ts`
- `代码/平台/配置.ts` — 排行榜 ID、成就映射、ClientID（**勿提交密钥**；ClientID 可进公开配置，Token 不进仓）

## 4. 分步实施与成功标准

### 步骤 A — 探测与脚手架（0.5 天）

- 加 `Tap环境`：`可用`、`有云存档`、`有排行榜`、`有成就` 布尔。
- 测试包内加临时 HUD 或 `window.__TAP_PROBE__`，真机扫码读结果。
- **成功**：真机日志确认是否存在 `tap` / 各 Manager；开发机为全 false 且不报错。

### 步骤 B — 云存档（1–2 天）★优先

- 后台开通云存档（游戏服务）。
- 实现：本地变更后 debounce；对局结束 / 商店购买 / 成就领奖后 `updateArchive`。
- 启动：`getArchiveList` → 若云端新则合并到 localStorage。
- **成功**：设备 A 通关 → 设备 B（同账号）打开见金币/皮肤/纪录；断网仍可玩；上传失败有可重试提示；不超限频。

### 步骤 C — 排行榜（1 天，依赖 A 为真）

- 后台建榜 + 白名单；配置 4 个 `leaderboardId`。
- 结算时 `submitScores`；菜单「排行榜」→ `openLeaderboard`。
- **成功**：白名单账号上分后面板可见；冲刺越短越靠前。

### 步骤 D — 平台成就（1 天）

- 后台创建与本地 12 项对应的成就；映射表。
- 本地解锁时 `unlockAchievement`；增量项用分步 API。
- **成功**：解锁冒泡或成就页可见；本地金币逻辑不依赖平台回调。

### 步骤 E — 分析（0.5–1 天，可与发布并行）

- 适配器事件：`session_start` / `mode_start` / `mode_end` / `purchase` / `achievement_unlock`。
- 默认 no-op；有 ClientID 且确认上报通道后再接 TapDB。
- 商店 PV 等继续用 `taptap-cli dashboard-stats`。
- **成功**：事件在适配器单测可断言；真机/后台能看到至少启动与完赛（若已接 TapDB）。

### 步骤 F — 正式发布（既有流程）

- 见 `文档/TapTap发布.md`：绑主包、协议、资料、提审。与开放能力解耦，但云存档/榜建议在提审前用测试包验完。

## 5. 阻塞项与用户需提供的配置

| 项 | 谁提供 | 备注 |
| --- | --- | --- |
| 真机确认 `tap` 在 **H5 ZIP** 容器可用 | 研发 + 用户扫码 | 若不可用，开放能力方案要改包体类型 |
| 开发者中心开通：云存档 / 排行榜 / 成就 /（可选）TapDB | 用户 | 路径约：游戏服务 → 对应模块 |
| **Client ID**（及如需 REST 的上报策略） | 用户（控制台「应用配置/游戏服务」） | 仓库内目前 **没有**；不要把 Client Token 写进 Git |
| 排行榜 ID ×4 | 用户创建后复制 | 可进 `平台/配置.ts` |
| 平台成就 ID ↔ 本地编号映射 | 用户创建后 | 与 `first-lock` 等 12 项对齐 |
| 登录 / 服务端 code2Session | 仅当 H5 要求显式登录或要自建后端时 | 云存档示例未强制自建服；有则需后端 |
| 创意工坊协议、主包绑定、简介/截图等 | 用户 | 发布阻塞，非本开放能力代码 |

## 6. 明确不做（本阶段）

- 不实现完整云同步 / 榜 / 成就 / TapDB 业务代码（除非先做步骤 A 探测）。
- 不绑定主包、不签协议、不提审、不 push。
- 不引入第二套原生 SDK，不把 Token 写入仓库。
## 7. 2026-10-16 CLI 实测与代码落地

### CLI 能做 / 不能做
- 已确认登录有效（keychain，未过期）。
- `taptap-cli schema` 共 81 个操作：**全部是资料/包体/测试计划/社区/经营数据**，**没有**开通云存档、创建排行榜、配置成就、TapDB 的命令。
- 本应用 `get-available-package-types` 仅返回 `["h5"]`。
- 因此：**游戏服务必须由用户在开发者中心网页完成**；CLI 无法代替。

### 已落地代码（仓库未自动 commit）
- `代码/平台/配置.ts`：ClientID=`ps0g5bb9grmqohjh2z`，排行榜/成就映射占位为空。
- `Tap环境` / 探针：`window.__TAP_PROBE__`、`window.__GAME_PLATFORM__`。
- 云存档适配器 + 快照往返；排行榜/平台成就/分析适配器（无配置或无 `tap` 时安全跳过）。
- `启动.ts` 调用 `启动平台能力()`；对局结算与 `提示成就` 触发同步。
- 测试：`测试/平台开放能力.test.ts`（60 项全绿）。

### 用户仍需在网页完成
1. **开通云存档**：开发者中心 → 游戏服务 → 云存档（应用 977300）。
2. **创建 4 个排行榜**（游戏服务 → 游戏排行，或 `https://developer.taptap.cn/363566/app/977300/rank_v4`）：
   - 马拉松 / 极限 / 每日挑战：降序、保留最高分
   - 冲刺：升序（时间越短越好），提交值为毫秒
   - 建议先「仅白名单可见」，把测试号加入白名单
   - 把 4 个「排行榜 ID」发回，填入 `代码/平台/配置.ts` 的 `排行榜编号`
3. **开通并创建平台成就**（12 项，建议 ID 与本地编号一致：`first-lock` … `ultra`），把平台成就 ID 填入 `平台成就映射`。
4. （可选）开通 TapDB；**不要把 Client Token 发到聊天或写入 Git**。当前分析默认只本地缓冲。
5. 用现有 H5 测试包在 TapTap 客户端打开，控制台/`__TAP_PROBE__` 确认 `有云存档` 等布尔值。

### 安全
- 未使用、未写入任何 Client Token。
- 未绑主包、未签协议、未提审。
