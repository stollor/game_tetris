import Phaser from "phaser";

const 最大文字分辨率 = 2;
const 文字测量样例 = "HgÉqgy汉字国語";

function 获取文字分辨率(最低分辨率: number): number {
  return Math.min(最大文字分辨率, Math.max(最低分辨率, window.devicePixelRatio || 1));
}

function 同步容器文字(对象: Phaser.GameObjects.GameObject, 分辨率: number): void {
  if (对象 instanceof Phaser.GameObjects.Text) {
    if (对象.style.testString !== 文字测量样例) 对象.style.setTestString(文字测量样例);
    if (对象.style.resolution !== 分辨率) 对象.setResolution(分辨率);
  }
  if (对象 instanceof Phaser.GameObjects.Container) {
    for (const 子对象 of 对象.list) 同步容器文字(子对象, 分辨率);
  }
}

/** 用中英文混合样例计算 Phaser.Text 画布高度，并以有限的设备像素倍率绘制。 */
export function 应用文字清晰度(scene: Phaser.Scene, 最低分辨率 = 2): void {
  let 当前分辨率 = 获取文字分辨率(最低分辨率);
  const 处理新对象 = (对象: Phaser.GameObjects.GameObject): void => {
    同步容器文字(对象, 当前分辨率);
  };
  const 更新分辨率 = (): void => {
    const 新分辨率 = 获取文字分辨率(最低分辨率);
    if (新分辨率 === 当前分辨率) return;
    当前分辨率 = 新分辨率;
    for (const 对象 of scene.children.list) 同步容器文字(对象, 当前分辨率);
  };

  scene.sys.displayList.events.on(Phaser.Scenes.Events.ADDED_TO_SCENE, 处理新对象);
  window.addEventListener("resize", 更新分辨率);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    scene.sys.displayList.events.off(Phaser.Scenes.Events.ADDED_TO_SCENE, 处理新对象);
    window.removeEventListener("resize", 更新分辨率);
  });
}
