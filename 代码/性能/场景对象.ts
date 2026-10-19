import Phaser from "phaser";

type 容器对象 = Phaser.GameObjects.GameObject & {
  list?: Phaser.GameObjects.GameObject[];
};

/**
 * 观察一个游戏里出现过的场景对象：首次看到场景时递归登记它已有的对象，之后监听场景的
 * `addedtoscene` 与新对象自带的 Container 子级。每个对象只回调一次，已销毁对象不会被强引用。
 *
 * 返回清理函数：注销 poststep 与全部场景监听。调用方负责对象自身的销毁清理。
 */
export function 观察场景对象(
  游戏: Phaser.Game,
  绑定: (对象: Phaser.GameObjects.GameObject) => void,
): () => void {
  const 已见 = new WeakSet<Phaser.GameObjects.GameObject>();
  const 场景监听 = new Map<Phaser.Scene, () => void>();
  const 容器清理 = new Set<() => void>();
  let 已清理 = false;

  const 登记 = (对象: Phaser.GameObjects.GameObject): void => {
    if (已清理 || 已见.has(对象)) return;
    已见.add(对象);
    绑定(对象);
    const 容器 = 对象 as 容器对象;
    if (容器.list) for (const 子 of 容器.list) 登记(子);
    if (对象 instanceof Phaser.GameObjects.Container) {
      const 实例 = 对象 as Phaser.GameObjects.Container & {
        addHandler: (子: Phaser.GameObjects.GameObject) => void;
      };
      const 原添加 = 实例.addHandler;
      const 自有添加 = Object.hasOwn(实例, "addHandler");
      const 包装添加 = function (this: typeof 实例, 子: Phaser.GameObjects.GameObject) {
        原添加.call(this, 子);
        登记(子);
      };
      实例.addHandler = 包装添加;
      const 清理 = () => {
        if (实例.addHandler === 包装添加) {
          if (自有添加) 实例.addHandler = 原添加;
          else Reflect.deleteProperty(实例, "addHandler");
        }
        容器清理.delete(清理);
      };
      容器清理.add(清理);
      实例.once(Phaser.GameObjects.Events.DESTROY, 清理);
    }
  };

  const 检查场景 = (场景: Phaser.Scene): void => {
    if (已清理 || 场景监听.has(场景)) return;
    const 加入 = (对象: Phaser.GameObjects.GameObject): void => {
      登记(对象);
    };
    场景.events.on(Phaser.Scenes.Events.ADDED_TO_SCENE, 加入);
    const 卸载 = () => {
      场景.events?.off(Phaser.Scenes.Events.ADDED_TO_SCENE, 加入);
      场景监听.delete(场景);
    };
    场景监听.set(场景, 卸载);
    场景.events.once(Phaser.Scenes.Events.DESTROY, 卸载);
    for (const 对象 of 场景.children?.list ?? []) 登记(对象);
  };

  const 后步 = (): void => {
    if (已清理) return;
    for (const 场景 of 游戏.scene.getScenes(false)) 检查场景(场景);
  };

  // poststep 发现尚未登记的（含尚未启动的）场景；安装时先补一次当前场景。
  游戏.events.on(Phaser.Core.Events.POST_STEP, 后步);
  后步();

  return () => {
    if (已清理) return;
    已清理 = true;
    游戏.events.off(Phaser.Core.Events.POST_STEP, 后步);
    for (const 卸载 of 场景监听.values()) 卸载();
    场景监听.clear();
    for (const 清理 of 容器清理) 清理();
  };
}
