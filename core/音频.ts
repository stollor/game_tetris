import Phaser from "phaser";
import { type 游戏设置, 获取游戏设置 } from "./设置";

export interface 游戏音频 {
  背景音乐: Phaser.Sound.WebAudioSound | Phaser.Sound.HTML5AudioSound | null;
  音效: Set<Phaser.Sound.WebAudioSound | Phaser.Sound.HTML5AudioSound>;
}

type 可调音频 = Phaser.Sound.WebAudioSound | Phaser.Sound.HTML5AudioSound;

function 是可调音频(声音: Phaser.Sound.BaseSound): 声音 is 可调音频 {
  return 声音 instanceof Phaser.Sound.WebAudioSound || 声音 instanceof Phaser.Sound.HTML5AudioSound;
}

export function 创建游戏音频(): 游戏音频 {
  return { 背景音乐: null, 音效: new Set() };
}

const 游戏音频实例 = 创建游戏音频();
let 声音管理器: Phaser.Sound.BaseSoundManager | null = null;

export function 绑定音频管理器(管理器: Phaser.Sound.BaseSoundManager): void {
  声音管理器 = 管理器;
  应用音频设置(游戏音频实例, 获取游戏设置());
}

export function 播放游戏背景音乐(资源键: string): void {
  if (!声音管理器) throw new Error("请先在 Phaser 场景中绑定音频管理器。");
  播放背景音乐(声音管理器, 游戏音频实例, 资源键);
  应用音频设置(游戏音频实例, 获取游戏设置());
}

export function 播放游戏音效(资源键: string): void {
  if (!声音管理器) throw new Error("请先在 Phaser 场景中绑定音频管理器。");
  播放音效(声音管理器, 游戏音频实例, 资源键);
  应用音频设置(游戏音频实例, 获取游戏设置());
}

window.addEventListener("gamemaker:settings-change", (事件: Event) => {
  应用音频设置(游戏音频实例, (事件 as CustomEvent<游戏设置>).detail);
});

export function 播放背景音乐(
  管理器: Phaser.Sound.BaseSoundManager,
  音频: 游戏音频,
  资源键: string,
  音量 = 0.6,
): void {
  音频.背景音乐?.stop();
  const 声音 = 管理器.add(资源键, { loop: true, volume: 音量 });
  if (!是可调音频(声音)) return;
  音频.背景音乐 = 声音;
  音频.背景音乐.play();
}

export function 播放音效(
  管理器: Phaser.Sound.BaseSoundManager,
  音频: 游戏音频,
  资源键: string,
  音量 = 0.8,
): void {
  const 音效 = 管理器.add(资源键, { volume: 音量 });
  if (!是可调音频(音效)) return;
  音频.音效.add(音效);
  音效.once("complete", () => 音频.音效.delete(音效));
  音效.play();
}

export function 应用音频设置(音频: 游戏音频, 设置: 游戏设置): void {
  音频.背景音乐?.setVolume(设置.音乐音量 / 100);
  音频.背景音乐?.setMute(!设置.背景音乐);
  for (const 音效项 of 音频.音效) {
    音效项.setVolume(设置.音效音量 / 100);
    音效项.setMute(设置.音效音量 === 0);
  }
}
