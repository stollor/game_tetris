import { 四边形合批 } from "../../框架Three/界面/四边形合批";
import type { 场景接口 } from "../../框架Three/运行时/场景栈";
import type { 命中分发 } from "../../框架Three/运行时/输入路由";
import { 结算按钮 } from "./外观";
import type { 渲染资源 } from "./对局";
import type { 结算数据 } from "./绘制";
import { 绘制结算 } from "./绘制";

/** 结算页：作为覆盖页压在还在显示的对局上，只负责面板与「重新开始」按钮。 */
export class 结算页面 implements 场景接口<渲染资源> {
  private readonly 资源: 渲染资源;
  private readonly 合批: 四边形合批;
  private readonly 分发: 命中分发;
  private readonly 读取状态: () => 结算数据;
  private readonly 重开: () => void;
  private 注销按钮: (() => void) | null = null;

  constructor(资源: 渲染资源, 分发: 命中分发, 读取状态: () => 结算数据, 重开: () => void) {
    this.资源 = 资源;
    this.分发 = 分发;
    this.读取状态 = 读取状态;
    this.重开 = 重开;
    this.合批 = new 四边形合批({
      纹理: [资源.字小.读取纹理(), 资源.字大.读取纹理()],
    });
  }

  读取合批组() {
    return this.合批.提交();
  }

  读取合批统计() {
    return this.合批.读取统计();
  }

  进入(): void {
    this.注销按钮 = this.分发.注册({
      名称: "重新开始",
      ...结算按钮,
      深度: 10,
      回调: () => this.重开(),
    });
  }

  退出(): void {
    this.注销按钮?.();
    this.注销按钮 = null;
  }

  渲染(): void {
    this.合批.清空();
    绘制结算({ 合批: this.合批, 字小: this.资源.字小, 字大: this.资源.字大 }, this.读取状态());
    this.合批.提交();
  }

  销毁(): void {
    this.合批.销毁();
  }
}
