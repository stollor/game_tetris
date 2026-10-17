import Phaser from "phaser";
import { 界面按钮 } from "../../框架/界面/按钮";
import { 界面滚动区域 } from "../../框架/界面/滚动区域";
import { 注册模态界面 } from "../../框架/界面/输入隔离";

declare global {
  interface Window {
    __隔离夹具__?: {
      打开: (层: number) => void;
      读取: () => { 底层: number; 一级: number; 二级: number; 滚动: number };
    };
  }
}
class 夹具 extends Phaser.Scene {
  create(): void {
    let 底层 = 0,
      一级 = 0,
      二级 = 0;
    const 滚动 = new 界面滚动区域(this, { 左: 0, 上: 0, 宽: 400, 高: 400, 内容高: 800 });
    const a = this.add.container(0, 0).setDepth(10).setVisible(false);
    const b = this.add.container(0, 0).setDepth(20).setVisible(false);
    const 创建 = (root: Phaser.GameObjects.Container, 回调: () => void, 名: string) => {
      const mask = this.add.rectangle(200, 200, 400, 400, 0x182132, 0.8).setInteractive();
      const btn = new 界面按钮(this, 200, 200, {
        宽: 180,
        高: 60,
        文案: 名,
        name: 名,
        点击: 回调,
        面板色: "#203345",
        强调色: "#ffd700",
        文字色: "#ffffff",
      });
      root.add([mask, btn]);
      注册模态界面(root, mask);
    };
    创建(
      a,
      () => {
        一级++;
        a.setVisible(false);
      },
      "一级关闭",
    );
    创建(
      b,
      () => {
        二级++;
        b.setVisible(false);
      },
      "二级关闭",
    );
    new 界面按钮(this, 200, 200, {
      宽: 180,
      高: 60,
      文案: "底层",
      name: "底层",
      点击: () => {
        底层++;
      },
      面板色: "#203345",
      强调色: "#ffd700",
      文字色: "#ffffff",
    });
    // 刻意关闭 topOnly，让同坐标多个控件都进入命中列表，验证事件消费而非偶然遮挡。
    this.input.setTopOnly(false);
    window.__隔离夹具__ = {
      打开: (层) => {
        a.setVisible(层 >= 1);
        b.setVisible(层 >= 2);
      },
      读取: () => ({ 底层, 一级, 二级, 滚动: 滚动.获取滚动位置() }),
    };
  }
}
new Phaser.Game({
  type: Phaser.CANVAS,
  width: 400,
  height: 400,
  scene: 夹具,
  audio: { noAudio: true },
});
