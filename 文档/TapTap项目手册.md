# TapTap 项目手册（再消一行）

项目专属配置与踩坑，配合 GM 通用流程（本机 `C:\Users\StollorSu\projects\GameMaker-v2\文档\TapTap发布.md`，仓库内路径 `文档/TapTap发布.md`）。早期接入计划见 [TapTap开放能力接入计划.md](TapTap开放能力接入计划.md)（研究稿，部分条目已被现行实现取代）。

**切记：Client Token 永不写入本仓库、报告或聊天存档。** 仓库只保留公开的 Client ID。

## 1. 平台身份

| 项 | 值 |
| --- | --- |
| 应用编号 (app) | `977300` |
| 开发者编号 | `363566` |
| 小游戏 / miniapp | `tapmcumwrae2ucnuuw` |
| Client ID | `ps0g5bb9grmqohjh2z`（公开，见 `代码/平台/配置.ts`） |
| Client Token | **不入库** |
| 包体类型 | H5 ZIP（竖屏） |
| 后台资料 | https://developer.taptap.cn/v3/363566/app/977300/store/update |

公开配置单源：`配置/TapTap发布.json`，由GM发布页维护；`代码/平台/配置.ts`读取后组合游戏原有的榜单、成就和云槽接口。既有云快照范围与格式继续由 `代码/平台/云存档快照.ts`维护，不迁移玩家存档。

## 2. 打包与材料位置

```powershell
# 在 GameMaker-v2 根目录
bun run gm -- 打包游戏 再消一行
```

| 材料 | 位置 | Git |
| --- | --- | --- |
| 正式打包产物 | `产物/` | 忽略 |
| 打包报告 | `文档/打包报告.md` | 可提交（机器生成） |
| 测试 ZIP / 二维码 / 上传回执 | `reports/TapTap/<日期>/` | **忽略** |
| 平台公开配置 | `代码/平台/配置.ts` | 提交 |

装配 ZIP：单一顶层目录（常用名 `one-more-line-travel/`），内含 `index.html`、Three 游戏 bundle 和项目静态资源。包内不再包含旧引擎文件。以游戏根为 cwd 调用：

```powershell
taptap-cli upload-h5-package reports/TapTap/<日期>/<zip> --dev-id 363566 --app-id 977300 --screen-orientation 1 --idempotency-key <唯一键> --yes
taptap-cli test-qr-code --dev-id 363566 --app-id 977300 --data '{"package_id":<h5VersionId>}' --output reports/TapTap/<日期>/手机自测二维码.png --json
```

开发测试二维码必须用 **TapTap App** 扫。测试阶段默认：**不绑主包、不提审**。

## 3. 测试包版本简史（package_id / h5VersionId）

| 版本 | 日期 | 要点 |
| --- | --- | --- |
| 306471 | 2026-10-15 | 首次 H5 测试包 |
| 314205 / 314257 | 2026-10-16 | 清晰度尝试（1080 设计尺寸，后证明无效） |
| 314306 | 2026-10-16 | 高 DPR：框架 `像素比上限`，画布乘 DPR |
| 314452 | 2026-10-16 | 探针包：`window.__TAP_PROBE__` / `__GAME_PLATFORM__` |
| 315653 | 2026-10-17 | 性能：烘焙、省电、金币经济等 |
| 315935 | 2026-10-17 | 滚动区域交互裁剪推迟 |
| 316115 | 2026-10-17 | 填入日/周/月/总共 16 个排行榜 ID |
| 316304 | 2026-10-17 | 500001 友好提示；设置底栏窄屏不重叠 |
| 316610 | 2026-10-17 | 云存档显示用户 ID；成就补同步；排行图标对比度；去掉设置右上角关闭 |
| 316947 | 2026-10-17 | 修复 Bun minify 中文属性粘连 `instanceof` 导致黑屏 |

完整回执与二维码在本机 `reports/TapTap/`（换机或清理后不保证仍在）。以 `list-h5-packages` 当前列表为准。

## 4. 排行榜（16 个 ID）

控制台「一张榜 = 一种重置周期」。要做日/周/月/总，四个模式各建 4 张，共 16 个。配置在 `代码/平台/配置.ts` 的 `排行榜编号按周期`：

| 模式 | 日 | 周 | 月 | 总 |
| --- | --- | --- | --- | --- |
| 马拉松 | `3gzyt8qlnrpvj2isf5` | `fb2r0k4pih33j46ycu` | `r20kjj9basv76xwgnb` | `np8kxqoitnd91u3zs8` |
| 冲刺 | `ppu0nc3fklanwcbiok` | `5z3pgj2bu9553gzjva` | `11aqzuq3qax3utw1ho` | `goxljcidqfnlfynjbu` |
| 极限 | `7jbuglncc24ovgkx7i` | `if044o8sbpsvhwmhdi` | `ba7azdlt7fr9xrjyas` | `bcbtf3vycr5ff16je0` |
| 每日挑战 | `57620urtuy8x9sguhd` | `tagu3o5oe1tbb1b3f2` | `spxfpwkk4li9j5scgb` | `la22thsyes0hz9kd9s` |

- 冲刺为时间型（毫秒，越短越好）；其余为分数降序。
- 结算会向该模式已配置的全部周期榜上报。
- 游戏内入口：四个模式卡片右上角排行榜图标 → 日/周/月/总页签。

### 已知坑

- **`whitelist_only` + 白名单为空 → 500001「不存在」**：不是 ID 错。给测试账号加白名单，或关闭「仅白名单可见」。正式上线前关闭仅白名单。
- **关错榜**：后台若存在重复榜，关掉截图里那批 ID 不等于关掉配置里的 16 个。以 `配置.ts` 为准核对。
- 误建的重复榜应删除，只留上表 16 个。

## 5. 平台成就

本地编号 → 平台成就 ID（`平台成就映射`）：

| 本地 | 平台 ID |
| --- | --- |
| first-lock | FIRST_LOCK |
| first-clear | FIRST_CLEAR |
| four-lines | TETRIS |
| spin | SPIN |
| combo | COMBO |
| b2b | B2B |
| perfect | PERFECT |
| hold | HOLD |
| lines | LINES |
| level | LEVEL |
| sprint | SPRINT |
| ultra | ULTRA |

### 已知坑

- 后台成就仍为「**待发布**」时，SDK 解锁失败，成就页会显示待同步 / 同步失败。
- 处理：发布这 12 个成就，或把账号加成就测试人员。
- 解锁 toast 与成就页会显示是否已同步到 TapTap；失败会写明原因。

## 6. 云存档

| 项 | 值 |
| --- | --- |
| 槽名 | `slot_travel_v1` |
| 代码 | `代码/平台/云存档*.ts`、`启动平台.ts` |
| UI | 设置页「账号信息」：用户 ID、最近存档时间与状态、「立刻同步」 |

本地仍是权威。设置页去掉右上角关闭按钮，避免误触外层小游戏关闭。

## 7. 构建黑屏（本项目相关）

正式包走 GM `打包游戏`（已禁用 `--minify-whitespace` + 解析自检）。

本仓库 `bun run build`（`运行/构建Three版.ts`）额外扫描产物是否出现 `中文instanceof`；命中则失败并提示给左操作数加括号，例如 `(项.节点) instanceof 界面控件`。

真机黑屏优先怀疑 minify 粘连，而不是「二维码过期」。

## 8. 真机自测清单

1. Tap App 扫当前测试包二维码（非系统相机/微信）。
2. 已登录 Tap 账号；排行榜若开白名单则账号须在名单内。
3. 模式卡排行图标 → 日/周/月/总能打开；结算后成绩出现。
4. 设置底栏：云存档状态 + 用户 ID；可手动同步。
5. 触发成就后看 toast / 成就页同步状态；若待同步查后台是否已发布。
6. 纯享模式只能切已拥有背景；退出按钮在亮暗主题下可见。

## 9. 相关代码入口

- `代码/平台/配置.ts` — ClientID、16 榜、成就映射、云槽
- `代码/平台/排行榜.ts` / `平台成就.ts` / `云存档.ts`；宿主协议与探测复用 `框架/平台/TapTap/`
- `代码/three版/` — 主菜单排行入口、设置云存档栏、成就页
- `运行/构建Three版.ts` — 构建后 `中文instanceof` 校验
