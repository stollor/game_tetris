import Phaser from "phaser";
import { 正在实况观测 } from "../../框架/开发/实况观测";
import { 观察场景对象 } from "./场景对象";

/**
 * 按需渲染：画面没有变化就跳过整帧渲染（逻辑更新照常），WebGL 画布保留上一帧。
 * 变化来源：Graphics/Text 实例上的重绘、已观察对象的显示属性变化、补间与镜头特效进行中、
 * 输入、场景切换、显式「标记重绘」。滚动惯性主动请求重绘；另有 500ms 保底刷新。
 * 菜单和暂停无操作、无动画时让 Phaser 休眠，定时推进慢速背景；输入立即唤醒。
 */
let 脏 = true;
let 上次渲染 = 0;
let 已安装 = false;
let 玩法进行中 = false;
export const 渲染统计 = { 渲染: 0, 跳过: 0 };

const 显示属性 = [
  "x",
  "y",
  "scaleX",
  "scaleY",
  "rotation",
  "visible",
  "alpha",
  "originX",
  "originY",
  "depth",
  "scrollFactorX",
  "scrollFactorY",
  "active",
  "blendMode",
  "flipX",
  "flipY",
  "tintFill",
  "tintTopLeft",
  "tintTopRight",
  "tintBottomLeft",
  "tintBottomRight",
  "texture",
  "frame",
  "fillColor",
  "fillAlpha",
  "lineWidth",
  "strokeColor",
  "strokeAlpha",
  "width",
  "height",
  "radius",
  "isFilled",
  "isStroked",
];

/** 在显示属性写入时失效，避免每帧扫描全部对象。保留原有访问器的副作用。 */
function 绑定显示属性(对象: Phaser.GameObjects.GameObject): () => void {
  const 恢复: (() => void)[] = [];
  for (const 键 of 显示属性) {
    const 自有 = Object.getOwnPropertyDescriptor(对象, 键);
    let 描述 = 自有;
    let 原型 = Object.getPrototypeOf(对象);
    while (!描述 && 原型) {
      描述 = Object.getOwnPropertyDescriptor(原型, 键);
      原型 = Object.getPrototypeOf(原型);
    }
    if (!描述 || (自有 && !自有.configurable)) continue;
    if ("value" in 描述 && !描述.writable) continue;
    if (!("value" in 描述) && !描述.set) continue;
    const 原描述 = 描述;
    let 值 = Reflect.get(对象, 键);
    const 读取 = () => (原描述.get ? 原描述.get.call(对象) : 值);
    Object.defineProperty(对象, 键, {
      configurable: true,
      enumerable: 描述.enumerable,
      get: 读取,
      set: (新值: unknown) => {
        const 旧值 = 读取();
        if (原描述.set) 原描述.set.call(对象, 新值);
        else 值 = 新值;
        if (读取() !== 旧值) 脏 = true;
      },
    });
    恢复.push(() => {
      // Shape的preDestroy已清空几何体，恢复访问器时不能再次调用它的getter。
      if (自有) Object.defineProperty(对象, 键, "value" in 自有 ? { ...自有, value: 值 } : 自有);
      else Reflect.deleteProperty(对象, 键);
    });
  }
  return () => {
    for (const 还原 of 恢复) 还原();
  };
}

interface 观察记录 {
  还原: () => void;
  解绑: () => void;
}
const 已观察 = new Set<观察记录>();

/** 只替换实例自身的方法，原型保持原样；返回恢复函数。 */
function 包装实例(对象: Phaser.GameObjects.GameObject): () => void {
  if (对象 instanceof Phaser.GameObjects.Graphics) {
    const 原清空 = 对象.clear;
    const 有自有方法 = Object.hasOwn(对象, "clear");
    const 包装清空 = (): Phaser.GameObjects.Graphics => {
      脏 = true;
      return 原清空.call(对象);
    };
    对象.clear = 包装清空;
    return () => {
      if (对象.clear !== 包装清空) return;
      if (有自有方法) 对象.clear = 原清空;
      else Reflect.deleteProperty(对象, "clear");
    };
  }
  if (对象 instanceof Phaser.GameObjects.Text) {
    const 原更新文字 = 对象.updateText;
    const 有自有方法 = Object.hasOwn(对象, "updateText");
    const 包装更新文字 = (): Phaser.GameObjects.Text => {
      脏 = true;
      return 原更新文字.call(对象);
    };
    对象.updateText = 包装更新文字;
    return () => {
      if (对象.updateText !== 包装更新文字) return;
      if (有自有方法) 对象.updateText = 原更新文字;
      else Reflect.deleteProperty(对象, "updateText");
    };
  }
  if (对象 instanceof Phaser.GameObjects.BitmapText) {
    const 原设置文字 = 对象.setText;
    const 有自有方法 = Object.hasOwn(对象, "setText");
    const 设置文字 = (内容: string | string[]): Phaser.GameObjects.BitmapText => {
      const 旧文字 = 对象.text;
      原设置文字.call(对象, 内容);
      if (对象.text !== 旧文字) 脏 = true;
      return 对象;
    };
    对象.setText = 设置文字;
    return () => {
      if (对象.setText !== 设置文字) return;
      if (有自有方法) 对象.setText = 原设置文字;
      else Reflect.deleteProperty(对象, "setText");
    };
  }
  return () => {};
}

function 有活动动画(游戏: Phaser.Game): boolean {
  for (const 场景 of 游戏.scene.getScenes(true)) {
    if (场景.tweens.getTweens().some((补间) => 补间.isPlaying())) return true;
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

export function 标记重绘(): void {
  脏 = true;
}

export function 设置玩法进行中(进行中: boolean): void {
  玩法进行中 = 进行中;
}

export function 安装按需渲染(游戏: Phaser.Game): void {
  // shortcut: step事件顺序按Phaser4.2.1验证，升级引擎时先补适配验收。
  if (Phaser.VERSION !== "4.2.1") return;
  if (已安装) return;
  已安装 = true;
  const 标脏 = () => {
    脏 = true;
  };
  let 最近输入 = performance.now();
  let 定时: ReturnType<typeof setTimeout> | undefined;
  let 已销毁 = false;

  const 绑定 = (对象: Phaser.GameObjects.GameObject): void => {
    if (已销毁) return;
    脏 = true;
    const 扩展 = 对象;
    const 还原方法 = 包装实例(对象);
    const 还原属性 = 绑定显示属性(对象);
    const 还原 = () => {
      还原方法();
      还原属性();
    };
    let 记录: 观察记录 | undefined;

    function 解绑(): void {
      扩展.off(Phaser.GameObjects.Events.ADDED_TO_SCENE, 回场景);
      扩展.off(Phaser.GameObjects.Events.REMOVED_FROM_SCENE, 离场景);
      扩展.off(Phaser.GameObjects.Events.DESTROY, 销毁);
    }

    function 销毁(): void {
      脏 = true;
      还原();
      解绑();
      if (记录) 已观察.delete(记录);
      记录 = undefined;
    }

    const 回场景 = (): void => {
      脏 = true;
    };
    const 离场景 = (): void => {
      脏 = true;
    };
    扩展.on(Phaser.GameObjects.Events.ADDED_TO_SCENE, 回场景);
    扩展.on(Phaser.GameObjects.Events.REMOVED_FROM_SCENE, 离场景);
    扩展.on(Phaser.GameObjects.Events.DESTROY, 销毁);
    记录 = { 还原, 解绑 };
    已观察.add(记录);
  };

  const 注销观察 = 观察场景对象(游戏, 绑定);

  const 唤醒 = () => {
    clearTimeout(定时);
    定时 = undefined;
    标脏();
    if (!已销毁 && !document.hidden && !游戏.loop.running) 游戏.loop.wake();
  };
  const 输入 = () => {
    最近输入 = performance.now();
    唤醒();
  };
  const 输入事件 = [
    "pointerdown",
    "pointermove",
    "pointerup",
    "keydown",
    "keyup",
    "wheel",
    "resize",
  ];
  for (const 事件 of 输入事件) window.addEventListener(事件, 输入, { passive: true });
  const 空闲步 = () => {
    定时 = undefined;
    if (已销毁 || document.hidden || 游戏.loop.running) return;
    游戏.loop.tick();
    if (!已销毁 && !游戏.loop.running) 定时 = setTimeout(空闲步, 100);
  };
  const 隐藏 = () => {
    clearTimeout(定时);
    定时 = undefined;
    游戏.loop.sleep();
  };
  const 调节空闲 = () => {
    // RAF 在回调结束后才登记下一帧，微任务中 sleep 才能取消那一帧。
    queueMicrotask(() => {
      if (已销毁 || document.hidden) return;
      const 高频 =
        玩法进行中 || 正在实况观测() || performance.now() - 最近输入 < 200 || 有活动动画(游戏);
      if (高频) {
        if (!游戏.loop.running) 唤醒();
      } else if (游戏.loop.running) {
        游戏.loop.sleep();
        定时 = setTimeout(空闲步, 100);
      }
    });
  };
  游戏.events.on("请求重绘", 输入);
  游戏.events.on(Phaser.Core.Events.FOCUS, 输入);
  游戏.events.on(Phaser.Core.Events.VISIBLE, 输入);
  游戏.events.on(Phaser.Core.Events.HIDDEN, 隐藏);
  游戏.events.on(Phaser.Core.Events.POST_STEP, 调节空闲);
  游戏.scale?.on?.("resize", 标脏);
  let 场景签名 = "";
  let 上帧动画 = false;
  const 原步 = 游戏.step;
  游戏.step = function (this: Phaser.Game, 时间: number, 间隔: number) {
    if ((this as Phaser.Game & { pendingDestroy?: boolean }).pendingDestroy || this.isPaused) {
      return 原步.call(this, 时间, 间隔);
    }
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
    const 动画 = 有活动动画(this);
    const 要画 = 脏 || 动画 || 上帧动画 || 现在 - 上次渲染 > 500;
    上帧动画 = 动画;
    if (!要画) {
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
  游戏.events.once(Phaser.Core.Events.DESTROY, () => {
    已销毁 = true;
    clearTimeout(定时);
    for (const 事件 of 输入事件) window.removeEventListener(事件, 输入);
    游戏.events.off(Phaser.Core.Events.POST_STEP, 调节空闲);
    游戏.events.off("请求重绘", 输入);
    游戏.events.off(Phaser.Core.Events.FOCUS, 输入);
    游戏.events.off(Phaser.Core.Events.VISIBLE, 输入);
    游戏.events.off(Phaser.Core.Events.HIDDEN, 隐藏);
    游戏.scale?.off?.("resize", 标脏);
    游戏.step = 原步;
    注销观察();
    for (const 记录 of 已观察) {
      记录.还原();
      记录.解绑();
    }
    已观察.clear();
    玩法进行中 = false;
    已安装 = false;
  });
}
