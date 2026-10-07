import type Phaser from "phaser";

export function 切换页面(场景: Phaser.Scene, 目标页面: string, 数据?: object): void {
  场景.scene.start(目标页面, 数据);
}

export function 打开覆盖页面(场景: Phaser.Scene, 覆盖页面: string, 数据?: object): void {
  场景.scene.pause();
  场景.scene.launch(覆盖页面, 数据);
}

export function 关闭覆盖页面(场景: Phaser.Scene, 返回页面: string): void {
  场景.scene.stop();
  场景.scene.resume(返回页面);
}
