import Phaser from "phaser";
import { 创建资源压力 } from "../../框架/开发/资源压力";
import { 绑定音频管理器, 解锁程序音频 } from "../../框架/音频/音频";
import { 标记重绘, 设置玩法进行中 } from "../性能/按需渲染";
import { 压力资源库 } from "./压力资源";

export class 资源压力场景 extends Phaser.Scene {
  private 压力?: ReturnType<typeof 创建资源压力>;

  constructor() {
    super("资源压力场景");
  }

  create(): void {
    绑定音频管理器(this.sound);
    this.input.on(Phaser.Input.Events.POINTER_DOWN, 解锁程序音频);
    const 压力 = 创建资源压力(this, 压力资源库);
    this.压力 = 压力;
    const 桥 = window.__GAMEMAKER_TEST__;
    if (桥) 桥.压力 = 压力;
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.off(Phaser.Input.Events.POINTER_DOWN, 解锁程序音频);
      const 停止的 = this.压力;
      this.压力 = undefined;
      try {
        停止的?.停止();
      } finally {
        const 当前桥 = window.__GAMEMAKER_TEST__;
        if (当前桥 && 当前桥.压力 === 停止的) delete 当前桥.压力;
        设置玩法进行中(false);
      }
    });
  }

  update(_时间: number, 间隔: number): void {
    设置玩法进行中(true);
    标记重绘();
    this.压力?.更新(间隔);
  }
}
