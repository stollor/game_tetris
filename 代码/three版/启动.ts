import { 创建渲染编排 } from "../../框架Three/世界/渲染编排";
import { 创建文字图集 } from "../../框架Three/界面/文字图集";
import { 场景栈 } from "../../框架Three/运行时/场景栈";
import { 创建游戏循环 } from "../../框架Three/运行时/循环";
import { 命中分发, 绑定画布指针 } from "../../框架Three/运行时/输入路由";
import { 字体, 字号, 控制按钮, 控制按钮矩形, 逻辑宽, 逻辑高, 预烘焙字符, 颜色 } from "./外观";
import { type 对局快照, 对局页面, type 操作名 } from "./对局";
import { 结算页面 } from "./结算";

/** 《再消一行》Three 版入口：渲染编排 → 文字图集 → 场景栈 → 单 rAF 循环 → 输入。 */

const 容器 = document.getElementById("游戏容器");
if (!容器) throw new Error("缺少 #游戏容器");

const 渲染 = 创建渲染编排({
  容器,
  逻辑宽,
  逻辑高,
  像素比: 1,
  清屏色: 颜色.底色,
});
const 字小 = 创建文字图集({ 字体, 字号: 字号.标签, 预烘焙字符集: 预烘焙字符 });
const 字大 = 创建文字图集({
  字体,
  字号: 字号.数值,
  字重: "bold",
  预烘焙字符集: 预烘焙字符,
});
const 资源 = { 字小, 字大 };

const 对局 = new 对局页面(资源);
const 场景 = new 场景栈<typeof 资源>(资源);
const 分发 = new 命中分发();
const 绑定 = 绑定画布指针(渲染.画布, 分发, { 宽: 逻辑宽, 高: 逻辑高 });
const 结算 = new 结算页面(
  资源,
  分发,
  () => 对局.读取状态(),
  () => 执行操作("重新开始"),
);
对局.设置结束回调(() => {
  if (场景.读取数量() === 1) 场景.进入("结算", 结算, { 覆盖: true });
});
场景.进入("对局", 对局);
渲染.场景.add(对局.读取合批组());
渲染.场景.add(结算.读取合批组());

控制按钮.forEach((按钮, 序号) => {
  const 矩形 = 控制按钮矩形(序号 % 3, 序号 < 3 ? 1 : 2);
  分发.注册({
    名称: 按钮.名,
    ...矩形,
    深度: 1,
    回调: () => 执行操作(按钮.名),
  });
});

const 键映射: Record<string, 操作名> = {
  ArrowLeft: "左移",
  ArrowRight: "右移",
  ArrowUp: "旋转",
  ArrowDown: "软降",
  Space: "硬降",
  KeyC: "暂存",
  KeyR: "重新开始",
};
window.addEventListener("keydown", (事件) => {
  const 操作 = 键映射[事件.code];
  if (!操作) return;
  事件.preventDefault();
  执行操作(操作);
});

function 执行操作(名: 操作名): void {
  if (名 === "重新开始") {
    对局.重新开始();
    while (场景.读取数量() > 1) 场景.退出();
    return;
  }
  if (对局.读取状态().阶段 !== "进行中") return;
  对局.操作(名);
}

const 循环 = 创建游戏循环({
  更新: (固定步长秒) => 场景.更新(固定步长秒),
  渲染: () => {
    场景.渲染();
    渲染.渲染();
  },
});
循环.启动();

interface 带内存的Performance extends Performance {
  memory?: { usedJSHeapSize: number; totalJSHeapSize: number; jsHeapSizeLimit: number };
}

function 读取内存() {
  const 内存 = (performance as 带内存的Performance).memory;
  if (!内存) return null;
  return {
    已用MB: Number((内存.usedJSHeapSize / 1048576).toFixed(2)),
    总额MB: Number((内存.totalJSHeapSize / 1048576).toFixed(2)),
    上限MB: Number((内存.jsHeapSizeLimit / 1048576).toFixed(2)),
  };
}

export interface 运行统计 {
  循环: ReturnType<typeof 循环.读取统计>;
  渲染: ReturnType<typeof 渲染.读取统计>;
  合批: ReturnType<typeof 对局.读取合批统计>;
  结算合批: ReturnType<typeof 结算.读取合批统计>;
  文字: { 小: ReturnType<typeof 字小.读取统计>; 大: ReturnType<typeof 字大.读取统计> };
  内存: ReturnType<typeof 读取内存>;
  画布: { 宽: number; 高: number; 视口宽: string; 视口高: string };
  设备像素比: number;
  操作记录: ReturnType<typeof 对局.读取操作记录>;
  对局统计: ReturnType<typeof 对局.读取统计>;
  已用毫秒: number;
}

interface 调试接口 {
  读取状态: () => 对局快照 & { 场景栈: string[] };
  读取原始状态: () => ReturnType<对局页面["读取原始状态"]>;
  读取统计: () => 运行统计;
  操作: (名: 操作名) => void;
  停止: () => void;
}

declare global {
  interface Window {
    __three版__?: 调试接口;
  }
}

window.__three版__ = {
  读取状态: () => ({ ...对局.读取状态(), 场景栈: 场景.读取栈().map((项) => 项.名称) }),
  读取原始状态: () => 对局.读取原始状态(),
  读取统计: () => ({
    循环: 循环.读取统计(),
    渲染: 渲染.读取统计(),
    合批: 对局.读取合批统计(),
    结算合批: 结算.读取合批统计(),
    文字: { 小: 字小.读取统计(), 大: 字大.读取统计() },
    内存: 读取内存(),
    画布: {
      宽: 渲染.画布.width,
      高: 渲染.画布.height,
      视口宽: 渲染.画布.dataset.视口宽 ?? "",
      视口高: 渲染.画布.dataset.视口高 ?? "",
    },
    设备像素比: window.devicePixelRatio,
    操作记录: 对局.读取操作记录(),
    对局统计: 对局.读取统计(),
    已用毫秒: 对局.读取已用毫秒(),
  }),
  操作: (名) => 执行操作(名),
  停止: () => {
    循环.销毁();
    场景.销毁();
    绑定.解除();
    分发.清空();
    对局.销毁();
    字小.销毁();
    字大.销毁();
    渲染.销毁();
  },
};
