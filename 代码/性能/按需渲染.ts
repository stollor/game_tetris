import Phaser from "phaser";

/**
 * 按需渲染：画面没有变化就跳过整帧渲染（逻辑更新照常），WebGL 画布保留上一帧。
 * 变化来源：Graphics 重绘 / 文字改动（全局补丁自动标记）、补间与镜头特效进行中、
 * 近期有触摸/按键（含滚动惯性）、场景切换、显式「标记重绘」。另有 500ms 保底刷新。
 * 对局进行中的场景可调用「设置持续渲染」保持逐帧渲染。
 */
let 脏 = true;
let 最近输入 = 0;
let 上次渲染 = 0;
let 已安装 = false;
const 持续渲染 = new Set<string>();
export const 渲染统计 = { 渲染: 0, 跳过: 0 };

export function 标记重绘(): void {
  脏 = true;
}

export function 设置持续渲染(键: string, 开: boolean): void {
  if (开) 持续渲染.add(键);
  else 持续渲染.delete(键);
}

function 有活动(游戏: Phaser.Game, 时间: number): boolean {
  if (脏 || 持续渲染.size) return true;
  if (时间 - 最近输入 < 1200) return true;
  if (时间 - 上次渲染 > 500) return true;
  for (const 场景 of 游戏.scene.getScenes(true)) {
    const 补间 = 场景.tweens as unknown as { getTweens?: () => unknown[] };
    if ((补间.getTweens?.().length ?? 0) > 0) return true;
    for (const 镜头 of 场景.cameras?.cameras ?? []) {
      if (
        镜头.fadeEffect?.isRunning ||
        镜头.flashEffect?.isRunning ||
        镜头.shakeEffect?.isRunning ||
        镜头.panEffect?.isRunning ||
        镜头.zoomEffect?.isRunning
      )
        return true;
    }
  }
  return false;
}

export function 安装按需渲染(游戏: Phaser.Game): void {
  if (已安装) return;
  已安装 = true;
  const 标脏 = () => {
    脏 = true;
  };
  const 原型 = Phaser.GameObjects.Graphics.prototype as unknown as { clear: () => unknown };
  const 原清空 = 原型.clear;
  原型.clear = function (this: unknown) {
    脏 = true;
    return 原清空.call(this);
  };
  const 文字原型 = Phaser.GameObjects.Text.prototype as unknown as { updateText: () => unknown };
  const 原更新文字 = 文字原型.updateText;
  文字原型.updateText = function (this: unknown) {
    脏 = true;
    return 原更新文字.call(this);
  };
  for (const 事件 of [
    "pointerdown",
    "pointermove",
    "pointerup",
    "keydown",
    "keyup",
    "wheel",
    "resize",
  ])
    window.addEventListener(
      事件,
      () => {
        最近输入 = performance.now();
        脏 = true;
      },
      { passive: true },
    );
  游戏.events.on("请求重绘", 标脏);
  游戏.events.on(Phaser.Core.Events.FOCUS, 标脏);
  游戏.events.on(Phaser.Core.Events.VISIBLE, 标脏);
  游戏.scale?.on?.("resize", 标脏);
  let 场景签名 = "";
  const 原步 = 游戏.step;
  游戏.step = function (this: Phaser.Game, 时间: number, 间隔: number) {
    // 测试桥依赖每帧 postrender 发布快照；本机测试环境保持原样。
    if (
      window.__GAMEMAKER_TEST__ ||
      (this as unknown as { pendingDestroy?: boolean }).pendingDestroy ||
      this.isPaused
    )
      return 原步.call(this, 时间, 间隔);
    const 事件 = this.events;
    事件.emit(Phaser.Core.Events.PRE_STEP, 时间, 间隔);
    事件.emit(Phaser.Core.Events.STEP, 时间, 间隔);
    this.scene.update(时间, 间隔);
    事件.emit(Phaser.Core.Events.POST_STEP, 时间, 间隔);
    const 签名 = this.scene
      .getScenes(true)
      .map((s) => s.scene.key)
      .join("|");
    if (签名 !== 场景签名) {
      场景签名 = 签名;
      脏 = true;
    }
    const 现在 = performance.now();
    if (!有活动(this, 现在)) {
      渲染统计.跳过++;
      return;
    }
    脏 = false;
    上次渲染 = 现在;
    渲染统计.渲染++;
    const 渲染器 = this.renderer;
    渲染器.preRender();
    事件.emit(Phaser.Core.Events.PRE_RENDER, 渲染器, 时间, 间隔);
    this.scene.render(渲染器);
    渲染器.postRender();
    事件.emit(Phaser.Core.Events.POST_RENDER, 渲染器, 时间, 间隔);
  };
}
