# NEON PULSE — 真实浏览器端到端验证报告（Playwright / Chromium）

验证时间：2026-09-26 · 环境：Chromium（Playwright MCP），`http://localhost:8099` 与 `file://` 双通道
结论：**64 项检查全部通过，全程 0 页面异常、0 控制台错误、0 资源 4xx/5xx**。

## 一、页面渲染与场景流转（11 项）

| # | 检查项 | 结果 |
|---|---|---|
| 1 | 主菜单可见、键位画渲染 | PASS |
| 2 | 模式选择页可见 | PASS |
| 3 | 4 张模式卡片（marathon/sprint/ultra/daily） | PASS |
| 4 | 卡片文本完整（标题/描述/最佳） | PASS |
| 5 | 每日挑战含 DAILY 徽记与 UTC 日期 | PASS |
| 6 | 进入对局 scene=game、phase=falling | PASS |
| 7 | 硬降后场地有方块 | PASS |
| 8 | 硬降/软降计分 > 0 | PASS |
| 9 | Hold 暂存生效 | PASS |
| 10 | 连续硬降推进对局 | PASS |
| 11 | 结算页「返回模式选择」落到 screen-modes | PASS |

## 二、暂停 / 模态路由（23 项）

| # | 检查项 | 结果 |
|---|---|---|
| 12 | Esc 打开暂停菜单 | PASS |
| 13 | 暂停态置位 | PASS |
| 14 | 暂停期间时钟冻结（elapsedMs 不变） | PASS |
| 15 | 暂停→设置页打开 | PASS |
| 16 | 设置页 Esc 返回暂停层（不穿透续玩） | PASS |
| 17 | 仍处暂停 | PASS |
| 18 | 恢复 3/2/1 倒计时启动 | PASS |
| 19 | 倒计时期间仍冻结 | PASS |
| 20 | 倒计时期间暂停键被吞（不打断） | PASS |
| 21 | 倒计时结束自动续玩 | PASS |
| 22 | 倒计时层已隐藏 | PASS |
| 23 | 可再次打开暂停菜单 | PASS |
| 24 | 暂停菜单「返回模式选择」落到 screen-modes | PASS |
| 25 | 无 overlay 残留（pause/restart/countdown/replay 全隐藏） | PASS |
| 26 | 对局已作废（game=null） | PASS |
| 27 | 结算页可见 | PASS |
| 28 | 结算格 9 项（DOM API 构建） | PASS |
| 29 | 结算格字段完整 | PASS |
| 30 | 鼓励式文案非空 | PASS |
| 31 | 「再来一局」锁定期禁用 | PASS |
| 32 | 锁定期结束解锁 | PASS |
| 33 | Space 重开进入新局 | PASS |
| 34 | 同一按键未串台硬降（新局 0 分 0 块） | PASS |

## 三、快速重开 / Ultra / 成就 / 设置（17 项）

| # | 检查项 | 结果 |
|---|---|---|
| 35 | R 弹出重开确认 | PASS |
| 36 | 确认期间对局冻结 | PASS |
| 37 | 取消后同一局继续（seed 不变、未重开） | PASS |
| 38 | 取消后解冻续玩（恢复倒计时走完） | PASS |
| 39 | 再次弹确认 | PASS |
| 40 | 确认后进入干净新局（0 分 0 块、无遮罩） | PASS |
| 41 | 新局音频时钟已解冻 | PASS |
| 42 | Ultra 倒计时归零即结算（任意状态，P.28 口径） | PASS |
| 43 | 超时结算页可见 | PASS |
| 44 | 超时为已结算（非「未完赛」） | PASS |
| 45 | 结算页「返回模式选择」 | PASS |
| 46 | 无遮罩残留 | PASS |
| 47 | 成就格渲染 18 项 | PASS |
| 48 | 成就格文本完整 | PASS |
| 49 | 语言切英文生效 | PASS |
| 50 | 存档写入 localStorage、语言回 zh | PASS |
| 51 | 菜单文本中文正常 | PASS |

## 四、file:// 直开 + 资源完整性（6 项）

| # | 检查项 | 结果 |
|---|---|---|
| 52 | file:// 菜单可见 | PASS |
| 53 | file:// 模式卡片渲染 | PASS |
| 54 | file:// 对局可玩（每日固定种子 dailyDate/seed 正确） | PASS |
| 55 | file:// 退出无残留 | PASS |
| 56 | 无 4xx/5xx 资源 | PASS |
| 57 | 资源加载完整（138 个） | PASS |

## 五、改动点回归（7 项）

针对本轮「动态列表一律 DOM API 构建」安全化改造（模式卡片/成就格/结算格/设置控件）：

| # | 检查项 | 结果 |
|---|---|---|
| 58 | 菜单渲染 | PASS |
| 59 | 模式卡片清空重建（replaceChildren） | PASS |
| 60 | 对局推进有分 | PASS |
| 61 | 结算页 DOM 构建 9 格 | PASS |
| 62 | 解锁链路（assessUnlocks）无错跑通 | PASS |
| 63 | 成就页重建正常（18 项） | PASS |
| 64 | 设置页重建正常（11 条键位行） | PASS |

## 附：无头回归（Node）

```
node tests/test-core.cjs     # 301 通过 / 0 失败（含 [13] 手感状态机表驱动、[8] 数值全表、[14] 危险滞回）
node tests/test-wall-kick.cjs #   4 通过 / 0 失败
node tests/test-touch.cjs    #  84 通过 / 0 失败（§8.5 手势映射表驱动 + 虚拟按键区 + 平台适配静态口径）
node qa/logic-test.cjs       #  63 通过 / 0 失败
node qa/ui-flow-test.cjs     #  21 通过 / 0 失败
```

## 附：风险特征静态扫描（零命中）

- 危险 API / 注入式写法：`eval(` / `new Function` / `innerHTML` / `insertAdjacentHTML` / `document.write` / `atob(` / `fromCharCode` —— **0 处**（测试脚手架统一用 Node `vm` 模块载入脚本；动态列表全部 `createElement`+`textContent` 构建）。
- 网络行为：无 `fetch` / `XHR` / `WebSocket` / 外链资源，全部本地素材，支持 `file://` 离线直开。
- 敏感内容：无（全量中英文词面扫描零命中）。

---

# 附录 B：边界操作实玩 + 双协议音频实测（2026-09-26 复验轮）

> 方法：Playwright 真实键盘/鼠标驱动（非合成事件）+ 状态断言仪器（事件日志 / 布局合法性检查器）。
> 布局合法性检查器对每次变换后断言「不越界、不自叠、不与地形重叠」（目标态碰撞口径）。

## B1. http:// 通道边界操作实玩（12 项全过）

| # | 检查项 | 结果 |
|---|---|---|
| 1 | 贴墙（左墙）移动到底 + 旋转后布局合法 | PASS（S 块 px=-3 贴墙，rot 0→1） |
| 2 | 贴墙（右墙）移动到底 + 旋转后布局合法 | PASS |
| 3 | 软降停在贴地状态 | PASS |
| 4 | 贴地旋转成功并计入 Move Reset（不立即锁） | PASS（resets 0→1） |
| 5 | 贴地旋转后布局合法（踢墙目标态） | PASS |
| 6 | 锁定延迟持续重置：贴地 800ms+ 连续移动未锁 | PASS（8/8 存活） |
| 7 | Move Reset 超次数（15）立即锁定 | PASS（第 16 次重置瞬间锁定，resetsAtLock=15） |
| 8 | 挤压：闭合槽内 CW 旋转挤入（键盘驱动） | PASS（T rot 1→2，kick index 0） |
| 9 | 挤压旋转后布局合法 | PASS |
| 10 | 挤压锁定判定 T-Spin Double（三点法+前角） | PASS（label=tspinDouble / tspin=full / lines=2） |
| 11 | TSD 计分 1200×等级（乘区口径） | PASS（+1200 精确命中） |
| 12 | 硬降锁定 + 计分 + 新块出生 + 布局合法 | PASS（+2/格，事件链 score→harddrop→lock→spawn） |

## B2. 音频输出实测（Analyser 峰值，非文件存在性检查）

| 通道 | 项目 | 结果 |
|---|---|---|
| http:// | SFX（ui-confirm）峰值 | 0.42 ✓ 有声 |
| http:// | 对局 BGM 8 stems 播放 + 峰值 | 0.44 ✓ 有声 |
| http:// | 硬降/消行 SFX 峰值 | 0.87 ✓ 有声 |
| http:// | 7 音效叠加输出峰值 | 0.96 ≤ 1.0 ✓ 不硬削波（压限+软削波生效） |
| file:// | createMediaElementSource 劫持计数 | **0** ✓（不触发 CORS 强制静音机制） |
| file:// | BGM stems 直放增益 | kick 0.41 / hat 0.75 / bass 0.75 / pad 0.75（verse 分层）✓ |
| file:// | BGM currentTime 双采样推进 | 1.02→1.63 ✓ 播放中 |
| file:// | SFX（piece-hard-drop）推进+未静音 | 0.03→0.29，vol 0.765，muted=false ✓ |
| file:// | 素材 WAV RMS（Node 实测） | hard-drop 0.233 / line-clear-4 0.189 / bgm stems 0.06–0.11 ✓ 非静音 |

file:// 音频输出证据链：①素材非静音（RMS）→ ②同素材经 WebAudio 图实测有声（http:// Analyser 峰值）→
③file:// 下零 MediaElementSource 劫持（静音机制不触发）→ ④元素直放播放推进且未静音。
（captureStream 探针被 Chromium "cross-origin data" 拒绝，file:// 媒体无法回采，故以四段证据链闭合。）

## B3. 本轮修复（实测发现，均已回归）

1. **file:// 对局 BGM 静音（真缺陷）**：`applyStemProfile` 守卫 `!state.ctx` 时直接跳过直放（el.volume）降级分支，
   stems 增益永久停在 0。修复：守卫只看配置数据；`playSfx/startStems/playTrack` 入口自愈 `init()`；心跳层补直放淡入。
2. **多音效叠加硬削波（真缺陷）**：0.88 档音效叠加瞬间输出峰值 1.57 > 1.0。修复：主总线加压限器 + 软削波安全网
   （≤0.7 线性透明、渐近 1.0），7 音效叠加峰值 0.96。
3. **渲染 NaN 色值**：`hexRgb` 对非法色值解析出 NaN 进 CanvasGradient 抛 SyntaxError。修复：解析失败回退安全色。
4. 以上修复后全量回归：`tests/test-core.cjs` 301 / `tests/test-wall-kick.cjs` 4 / `tests/test-touch.cjs` 84 /
   `qa/logic-test.cjs` 63 / `qa/ui-flow-test.cjs` 21 全过（数字已刷新至当前版本，评审建议项）；
   双协议边界实玩与音频实测全过，0 控制台错误。

---

# 附录 C：代码评审缺陷修复复验（第三轮）

> 背景：代码评审（机器门 + 阻断性缺陷 3 条）复验本轮改动。3 条阻断缺陷全部修复，
> 并按「先改规格口径（framework §7.4/§12）→ 表驱动测试跑红 → 实现 → 跑绿」流程闭环。

## C1. 三条阻断缺陷修复对照

| # | 缺陷 | 根因 | 修复 | 自动回归（现全绿） |
|---|---|---|---|---|
| 1 | DAS/ARR/Lock Delay/Move Reset 无表驱动测试；DAS 实测 150–170ms（应为 133ms） | `update()` 把 ARR 首步叠在 DAS 之后、`dasTimer` 溢出量不回填 `arrTimer` | `src/core/game.js`：首次自动横移恰在 DAS=133ms 发生（首步不叠加 ARR），DAS 溢出量回填 `arrTimer`，第 k 次自动横移严格对齐 133+(k−1)×33ms | `tests/test-core.cjs` [13]（§5.4/§7.4 规格行 + 多帧步长 10ms/7ms/16.7ms/33ms 表驱动），[8] 数值表全表化（重力 19 行 / 软降 20 行 / BPM 19 行 / Combo 10 档），[14] 危险滞回 |
| 2 | 快速重开（R→确认）后对局 BGM 全程死亡（8 stems 播放约 340ms 被误暂停；file:// 叠加音量归零） | `stopGameBgm()`→`fadeOutEl()` 的 `setTimeout(pause, 340)` 无取消机制，`startStems()` 复用同一缓存元素后被旧定时器误暂停；直放渐变 interval 与新开层 ramp 竞态 | `src/audio/audio.js`：新增 `cancelPendingFade()`（挂 `el._npStopTimer`/`el._npRampTimer`），所有重开层入口（`startStems`/`playTrack`/`setHeartbeat`/暂停恢复）先取消旧定时器；`rampElGain` 同元素只允许一条渐变在途 | `qa/logic-test.cjs` ④（双协议：重开后 8 stems 持续播放 + file:// 直放音量 = 总线×分层增益） |
| 3 | 对局中主菜单/结算曲持续叠加播放（§9/§7.6 对局 BGM 唯一节拍来源） | `startGameBgm()` 从不停菜单/结算曲目；`fadeOutAllExcept` 的 `state.stems[url]` 判键错误 | `src/audio/audio.js`：`startGameBgm()` 先 `fadeOutAllExcept(本局 BGM urls)` 停掉菜单/结算/其他曲目；`fadeOutAllExcept` 改为 URL 集合口径 | `qa/logic-test.cjs` ④（双协议：进对局/retry 后 playing 列表仅对局 BGM；解锁曲模式同口径） |

## C2. 建议项处理

1. **framework 缺「核心算法清单」章节** → 已补 `01-framework/framework.md` §12（19 项核心算法逐项固化
   「规格来源 / 实现位置 / 表驱动测试」，作为覆盖硬门），修订记录升 v1.2。
2. **§7.5 `config/balance.json` vs 实现 `config/balance.js`** → 已在 framework §7.5 第 5 条补实现注
   （file:// 禁 fetch 的等价折衷，语义与调参口径不变）。
3. **抽样断言 → 全表断言** → 速度表 19 行、软降 20 行、BPM 19 行、Combo 10 档已全部逐行断言。
4. **DAS 首步延迟偏差** → 按铁律先改 framework §7.4 表述（「首次自动横移恰在 133ms、首步不叠加 ARR、
   溢出回填」）再改实现，测试以规格值 133/33 推导期望时刻（4 种帧步长）。

## C3. 无头回归（本轮，Node 一键可跑）

```
node tests/test-core.cjs     # 301 通过 / 0 失败（含 [13] 手感状态机表驱动、[8] 数值全表、[14] 危险滞回）
node tests/test-wall-kick.cjs #   4 通过 / 0 失败
node qa/logic-test.cjs       #  63 通过 / 0 失败（含 ④ 音频 BGM 回归：双协议 17 项 + 踩拍吸附 6 项）
node qa/ui-flow-test.cjs     #  21 通过 / 0 失败
```

## C4. 浏览器手工复验步骤（对评审复现脚本）

1. 快速重开 BGM：浏览器开局（Marathon）→ 对局中按 R →「确认重开」→ 1 秒后 Console 执行
   `Object.entries(NP.audio.state.elCache).map(([u,el])=>[u.split('/').pop(), el.paused, +el.currentTime.toFixed(2)])`
   → 8 条 `bgm_main_stem_*` 全部 `paused: false` 且 `currentTime` 持续推进（修复前 t≈0.36 即被暂停）。
2. 对局中 BGM 互斥：同一脚本看 playing 列表 → 仅 8 条对局 stems，无 `bgm_menu.wav` / `bgm_result.wav`
   （修复前菜单曲与 stems 叠加播放）。
3. DAS 口径：按住 →，首次自动横移发生在按住后约 133ms（1 帧量化内），此后约每 33ms 一步
   （可用 `NP.app.game` 调试面板 / 移动事件计时验证）。

---

# 附录 D：移动端触控实玩 + 竖屏布局实测（第四轮，2026-09-26）

> 背景：代码评审阻断性缺陷「移动端触控输入体系整体缺失」（framework §8.5 / §9 首发平台必须可玩于
> 移动浏览器 / DoD 10）→ 本轮补齐完整触控体系后真实浏览器实玩复验。
> 方法：Playwright Chromium，**CDP `Input.dispatchTouchEvent` 真实触控事件管线**（非合成事件），
> 竖屏 viewport 390×844（手机），状态断言直接读 `NP.app.game` 运行时状态。

## D1. 竖屏 9:16 布局（§9）

| # | 检查项 | 结果 |
|---|---|---|
| 1 | 屏向判定：390×844 → portrait 类 + 舞台 1080×1920 | PASS |
| 2 | 画布物理尺寸同步 1080×1920（setLayout） | PASS |
| 3 | 布局：场地上部居中（x310..770 / y290..1210）、HUD 紧随其下、底部操作区 y≥1620 留给虚拟按键 | PASS |
| 4 | 横竖屏切换（resize/orientationchange）无残留、横屏 1920×1080 布局回归 | PASS |
| 5 | 触控目标换算：--tpx=122 舞台 px ×0.361 = **44.1 CSS px ≥ 44×44**（7 键实测均 44.1） | PASS |
| 6 | 虚拟按键区不遮挡场地与 HUD（矩形相交检测） | PASS |
| 7 | 顶部暂停按钮（44.1×44.1）与 Next 预览零遮挡（实测后微调布局行位消除 9px 交叠） | PASS |

## D2. §8.5 手势映射实玩（逐行 = framework §8.5 表行）

| # | 手势（真实触控） | 预期（§8.5） | 实测 | 结果 |
|---|---|---|---|---|
| 1 | 点击屏幕右半区 | 顺时针旋转 | rot 0→1 | PASS |
| 2 | 点击屏幕左半区 | 逆时针旋转 | rot 1→0 | PASS |
| 3 | 左滑跨 3 格 | 移动 3 步（跟手步进） | px −3 | PASS（修复后，见 D4.1） |
| 4 | 慢速下滑 | 软降（跟手加速） | py +20，phase 保持 falling | PASS |
| 5 | 快速下滑松手 | 硬降 | 场地堆叠 +4 格 | PASS |
| 6 | 上滑 | 180° 旋转 | rot 净变化 2 | PASS |
| 7 | 双击（同侧） | 180° 旋转 | rot 净变化 2（首击补偿口径） | PASS |
| 8 | 长按 520ms | Hold | holdType null→'O' | PASS |
| 9 | 点击后拖动 | 不触发旋转（防误触） | 仅跟手步进，无 rotate | PASS（无头 [A] 全表） |
| 10 | 边缘按住（抵右缘） | DAS 快速连移 | 按住 200ms +8 步 / 450ms +15 步（≈30ms/步，ARR=33ms 口径内；精确时刻表由无头测试断言） | PASS |
| 11 | 非边缘静止按住 | 不连发（无误触连发） | 0 步 | PASS（无头 [A]） |

## D3. 虚拟按键区 / 暂停入口 / 系统语义

| # | 检查项 | 结果 |
|---|---|---|
| 1 | 按键构建：7 键（左/右/顺/逆时针/软降/硬降/Hold），中文 title 可读 | PASS |
| 2 | 单指按住左键 → moveLeft 按下+松开脉冲（等价键盘接口 onAction） | PASS |
| 3 | **多点触控**：按住右移键 + 第二指按顺时针键 → 两动作同时生效（px +1 且 rot +1） | PASS |
| 4 | 硬降键 / Hold 键单击生效 | PASS |
| 5 | 顶部暂停按钮 → 暂停遮罩弹出、时钟冻结入口 | PASS |
| 6 | 暂停→继续：3/2/1 倒计时期间仍冻结，倒计时结束解冻续玩（§8.4） | PASS |
| 7 | 切后台（visibilitychange）自动暂停 | PASS |
| 8 | 设置项：虚拟按键区开关 + 透明度滑杆 → 即时生效并持久化 localStorage，重载后恢复 | PASS |
| 9 | 设置项关闭虚拟按键区后对局内隐藏（开关语义生效） | PASS |

## D4. 实测发现并修复的缺陷（含回归测试）

1. **跟手步进亚像素边界欠步（真缺陷）**：跨格判定 `trunc(dx/cellPx)` 对触控坐标量化噪声（±0.1px）敏感，
   实玩中「恰好跨 3 格」只走 2 步。修复：跨格判定加 0.5px 容差（`src/ui/touch.js`）；
   回归测试 `tests/test-touch.cjs` [A]「跨 2.998 格（亚像素噪声）→ 仍为 3 步」（表驱动）。
2. **暂停按钮无图标**：`#btn-touch-pause` 文案为空（顶层暂停入口不可读）。修复：bindPauseButton 注入 ❚❚
   图标 + 中文 title（`touch.pause`）。
3. 竖屏 Next 预览与顶部暂停按钮交叠 9px（DoD 10「虚拟按键区不遮挡场地与 HUD」）→ 调整竖屏 HOLD/NEXT
   行位（y120→155）消除交叠，实测零遮挡。

## D5. 双协议 + 控制台（本轮）

| 通道 | 项目 | 结果 |
|---|---|---|
| http:// | 移动端触控全流程（D1–D3） | 全过 |
| file:// | 触控烟测：进对局 + 点击右半区旋转（rot +1）+ 虚拟按键区显示 | PASS |
| 双协议 | 全程控制台错误 / pageerror | **0** |

截图：`qa/shot-game-mobile.png`（竖屏对局：HOLD/NEXT 横排 + 场地 + HUD + 底部虚拟按键区 + 顶部 ❚❚）、
`qa/shot-menu-mobile.png`、`qa/shot-game-desktop.png`（横屏 HUD 槽位化重绘回归）、`qa/shot-menu-desktop.png`。
