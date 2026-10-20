import type { Texture } from "three";
import type { 图元合批, 紫外线矩形 } from "../../../框架Three/界面/图元合批";
import type { 图形对象, 文字样式, 文字项, 矩形, 纹理帧引用 } from "../../../组件/绘制/图形对象";
import { Three图形, type 图形合批接口 } from "./Three图形";
import type { 文字服务 } from "./文字服务";

/**
 * Three 版画笔：共享视觉配方（`组件/绘制/图形对象.ts` 纯函数）在 Three 后端的唯一入口。
 *
 * - `图形` 是 `图形对象` 实现，写到启动层当前合批图层；配方代码不直接碰 Three；
 * - `绘制文字` 用 GM 文字图集按 (字体, 字号, 字重) 懒烘焙，支持描边/阴影/折行/字距/锚点；
 * - `绘制纹理帧` / `绘制散图` 消费 GM 静态图集与散图资源（资源层），走图集 UV / 整图 UV；
 * - 页面每帧不需要清空：启动层负责 清空 → 设图层 → 逐页渲染 → 提交，并在每页渲染前
 *   调 `重置()` 防止上一页的 alpha/混合/变换漏到下一页。
 */

export interface 图集帧渲染 {
  页: number;
  紫外线: 紫外线矩形;
  源宽: number;
  源高: number;
  /** 九宫信息（左/右/顶/底，逻辑像素）；7A 只透出，缩放方式由调用方决定。 */
  九宫?: { 左: number; 右: number; 顶: number; 底: number };
}

export interface 散图渲染 {
  纹理: Texture;
  宽: number;
  高: number;
}

export interface 资源统计 {
  图集数: number;
  页数: number;
  帧数: number;
  纹理字节: number;
  散图数: number;
}

/** 资源层：GM 静态图集帧 + 散图纹理的只读查询口；页面不感知加载细节。 */
export interface 资源层 {
  读取帧(图集: string, 帧: string): 图集帧渲染 | undefined;
  读取页纹理(图集: string, 页: number): Texture | undefined;
  读取散图(键: string): 散图渲染 | undefined;
  读取统计(): 资源统计;
  销毁(): void;
}

export interface 画笔 {
  /** 绑定当前合批图层/纯色 UV 的图形对象。 */
  图形: 图形对象;
  /** 渲染共享配方的文字项；返回排版宽高（锚点未计入）。 */
  绘制文字(项: 文字项): { 宽: number; 高: number };
  测量文字(文案: string, 样式: 文字样式): { 宽: number; 高: number };
  /** 按图集帧绘制到目标矩形；帧不存在/页未加载返回 false。 */
  绘制纹理帧(引用: 纹理帧引用, 矩形: 矩形, 透明度?: number): boolean;
  /** 按散图键绘制到目标矩形；键不存在返回 false。 */
  绘制散图(键: string, 矩形: 矩形, 透明度?: number): boolean;
  /** 启动层每页渲染前调用：重置 alpha/混合/变换/路径到默认。 */
  重置(): void;
}

/** 画笔需要的合批能力：图形写图元 + 白块 UV 配置；真实实现是 GM `图元合批`。 */
export type 画笔合批接口 = 图形合批接口 & Pick<图元合批, "设置纯色">;

export interface 画笔选项 {
  合批: 画笔合批接口;
  文字服务: 文字服务;
  资源层: 资源层;
}

export function 创建画笔(选项: 画笔选项): 画笔 {
  const 合批 = 选项.合批;
  const 文字 = 选项.文字服务;
  const 资源 = 选项.资源层;

  const 基础 = 文字.读取基础纹理();
  const 纯色纹理序号 = 合批.注册纹理(基础.键, 基础.纹理);
  const 纯色紫外线 = 文字.读取纯色紫外线();
  合批.设置纯色({ 纹理: 纯色纹理序号, 紫外线: 纯色紫外线 });

  const 图形 = new Three图形({ 合批, 纯色紫外线, 纯色纹理序号 });

  const 添加图片 = (纹理序号: number, 紫外线: 紫外线矩形, 目标: 矩形, 透明度: number): boolean => {
    if (目标.宽 <= 0 || 目标.高 <= 0) return false;
    const 颜色: readonly [number, number, number, number] = [
      1,
      1,
      1,
      Math.min(1, Math.max(0, 透明度)),
    ];
    return 合批.添加四边形({
      左: 目标.左,
      上: 目标.上,
      宽: 目标.宽,
      高: 目标.高,
      紫外线,
      颜色,
      混合: 图形.读取混合方式(),
      纹理: 纹理序号,
    });
  };

  return {
    图形,
    绘制文字: (项: 文字项) =>
      文字.绘制(合批, 项, {
        透明度: 图形.读取透明度(),
        混合: 图形.读取混合方式(),
      }),
    测量文字: (文案: string, 样式: 文字样式) => 文字.测量(文案, 样式),
    绘制纹理帧: (引用: 纹理帧引用, 目标: 矩形, 透明度 = 1) => {
      const 帧 = 资源.读取帧(引用.图集, 引用.帧);
      if (!帧) return false;
      const 页纹理 = 资源.读取页纹理(引用.图集, 帧.页);
      if (!页纹理) return false;
      const 纹理序号 = 合批.注册纹理(`图集/${引用.图集}/${帧.页}`, 页纹理);
      return 添加图片(纹理序号, 帧.紫外线, 目标, 透明度);
    },
    绘制散图: (键: string, 目标: 矩形, 透明度 = 1) => {
      const 散图 = 资源.读取散图(键);
      if (!散图) return false;
      const 纹理序号 = 合批.注册纹理(`散图/${键}`, 散图.纹理);
      return 添加图片(纹理序号, { u: 0, v: 0, 宽: 1, 高: 1 }, 目标, 透明度);
    },
    重置: () => 图形.重置(),
  };
}

export type { 文字服务 } from "./文字服务";
export { 创建文字服务 } from "./文字服务";
