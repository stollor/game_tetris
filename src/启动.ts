import { 创建游戏框架 } from "../core/游戏框架";
import { 开始菜单 } from "./scene/主界面/开始菜单";
import { 对局 } from "./scene/对局/对局";
import { 设置界面 } from "./scene/设置界面/设置界面";
import { 界面原型 } from "./scene/设计预览/界面原型";

创建游戏框架({
  容器: "游戏容器",
  宽度: 1440,
  高度: 900,
  页面: [界面原型, 开始菜单, 对局, 设置界面],
});
