import Phaser from "phaser";
import { 解析语言 } from "./多语言";
import { 应用样式, type 游戏界面色彩, 获取样式背景色, 获取游戏界面色彩 } from "./样式";
import { type 游戏设置, 获取游戏设置 } from "./设置";

export interface 游戏框架选项 {
  容器: string;
  宽度: number;
  高度: number;
  页面: Phaser.Types.Scenes.SceneType[];
}

export function 应用游戏设置(设置: 游戏设置): void {
  const 语言 = 解析语言(设置.语言);
  document.documentElement.lang = 语言 === "简体中文" ? "zh-CN" : "en";
  document.documentElement.dataset.theme = 设置.主题 === "深色" ? "dark" : "light";
  if (设置.主题 === "跟随系统") {
    const 深色 = matchMedia("(prefers-color-scheme: dark)").matches;
    document.documentElement.dataset.theme = 深色 ? "dark" : "light";
  }
  应用样式(设置.样式);
}

export function 获取游戏背景色(设置: 游戏设置): string {
  if (获取游戏是否浅色主题(设置)) return "#f2ecdd";
  return 获取样式背景色(设置.样式);
}

export function 获取游戏界面外观(设置: 游戏设置): 游戏界面色彩 {
  return 获取游戏界面色彩(设置.样式, 获取游戏是否浅色主题(设置));
}

function 获取游戏是否浅色主题(设置: 游戏设置): boolean {
  if (设置.主题 === "浅色") return true;
  if (设置.主题 === "深色") return false;
  return !matchMedia("(prefers-color-scheme: dark)").matches;
}

export function 创建游戏框架(选项: 游戏框架选项): Phaser.Game {
  应用游戏设置(获取游戏设置());
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    const 设置 = 获取游戏设置();
    if (设置.主题 !== "跟随系统") return;
    应用游戏设置(设置);
    window.dispatchEvent(new CustomEvent<游戏设置>("gamemaker:settings-change", { detail: 设置 }));
  });
  window.addEventListener("gamemaker:settings-change", (事件: Event) => {
    const 设置 = (事件 as CustomEvent<游戏设置>).detail;
    应用游戏设置(设置);
  });

  const 游戏 = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 选项.容器,
    width: 选项.宽度,
    height: 选项.高度,
    backgroundColor: 获取游戏背景色(获取游戏设置()),
    scale: { mode: Phaser.Scale.RESIZE, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: 选项.页面,
  });
  return 游戏;
}
