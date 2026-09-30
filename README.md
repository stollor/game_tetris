# NEON PULSE · 霓虹脉冲

> 🎮 **在线游玩：<https://stollor.github.io/game_tetris/>**

纯前端 HTML5/JS（Canvas + DOM）实现的霓虹风格俄罗斯方块，免构建、零依赖、无网络请求，
桌面与移动端均可游玩（推荐 Chrome / Edge 最新稳定版）。

## 特性

- **多模式**：马拉松 / Sprint（竞速）/ Ultra（限时）等，模式卡片进入
- **现代规则**：7-bag 随机、SRS 旋转系统 + 全表踢墙、T-Spin 判定、Hold 暂存、
  硬降/软降、DAS/ARR 手感参数、Lock Delay + Move Reset、Combo 计分
- **视听表现**：霓虹发光方块、消行爆裂/连击环/危险红光等特效、BGM 踩拍 + 音效分层
- **双端操作**：键盘 / 手柄 + 移动端手势与虚拟按键区（可开关、调透明度）
- **完整系统**：中英双语、键位重映射、音量设置、成就/解锁、localStorage 存档、破纪录反馈
- **安全可靠**：全项目零 `eval`、零 HTML 字符串拼接，动态列表一律 DOM API 构建

## 操作（键盘）

| 按键 | 功能 |
|---|---|
| ← / → | 左右移动（DAS/ARR 连移） |
| ↓ | 软降 |
| Space | 硬降 |
| ↑ / X | 顺时针旋转 |
| Z | 逆时针旋转 |
| W | 180° 旋转 |
| Shift / C | Hold 暂存 |
| Esc / P | 暂停 |
| R | 快速重开（默认弹确认） |
| M | 静音 |

键位可在「设置」中重映射。

## 操作（移动端触控）

- 左/右滑动：移动（跟手步进；抵住屏幕边缘按住 = 快速连移）
- 下滑：软降；快速下滑松手：硬降
- 点击右/左半区：顺/逆时针旋转；双击或上滑：180° 旋转
- 长按：Hold；顶部 ❚❚ 按钮：暂停
- 底部虚拟按键区：左/右/旋转/软降/硬降/Hold（≥44×44 px、多点触控）

## 本地运行

```bash
# 方式一：直接双击 index.html（支持 file:// 离线直开）
# 方式二：任意静态服务器
python -m http.server 8080   # 打开 http://localhost:8080
```

## 目录结构

```
index.html    入口（按顺序加载 config → i18n → core/audio/render/ui → main）
config/       数值配置（balance / modes / input / fx / audio / unlock）
i18n/         文案（zh-CN / en-US）
core/         玩法核心：rng（7-bag）、srs（旋转/T-Spin）、game（状态机）、timing（帧时钟）
audio/        音频引擎（AudioContext 时钟 = 游戏时钟，暂停 = 冻结）
render/       Canvas 渲染与特效
ui/           DOM 界面 / 键盘·手柄·触控输入
assets/       美术 / 音效 / BGM 素材
tests/ qa/    无头回归测试（473 项）与端到端验证报告
```

## 测试

```bash
node tests/test-core.cjs       # 核心数值与状态机（301 项）
node tests/test-wall-kick.cjs  # 贴墙/踢墙回归（4 项）
node tests/test-touch.cjs      # 移动端触控（84 项）
node qa/logic-test.cjs         # 回归验证（63 项）
node qa/ui-flow-test.cjs       # 场景流转回归（21 项）
```
