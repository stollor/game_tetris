import { LinearFilter, type Texture, TextureLoader } from "three";
import { 创建图集纹理, type 图集纹理 } from "../../../.gamemaker/依赖/框架/世界/图集纹理";
import type {
  图集帧渲染,
  散图渲染,
  资源层,
  资源统计,
} from "../../../.gamemaker/依赖/框架/界面/绘制/画笔";
import { 读取构建资源 } from "../../../.gamemaker/依赖/框架/运行时/资源编排";

/**
 * Three 版资源层：把 GM 静态图集（`清单.json` + 页图）与游戏散图（图标 / GM 套件图）
 * 加载成 Three 纹理，向页面提供只读的帧/散图查询。
 *
 * - 图集清单结构、帧 UV/九宫解析交给 GM `图集纹理`，这里只负责「项目图集名 → 地址」与散图；
 * - 页图/散图纹理统一登记进渲染编排纹理预算（`登记纹理`），销毁时释放引用；
 * - 加载失败给明确中文错误（期望 URL + 生成命令），不静默得到空画面；
 * - 默认地址相对游戏入口，兼容 H5 宿主把页面放在 `/game/` 等子目录。
 */

export interface 散图来源 {
  /** 页面里 `绘制散图(键)` 用的键。 */
  键: string;
  来源: "资源" | "测试资源";
  /** 相对来源根目录的路径。 */
  路径: string;
}

export interface 资源层选项 {
  /** 项目图集名（清单里的「名称」），默认 "再消一行"。 */
  图集名?: string;
  /** 项目图集目录地址，默认 "./图集/"。 */
  图集地址?: string;
  /** 默认使用GM构建注入的资源计划；测试可显式提供空列表。 */
  资源文件?: readonly string[];
  /** 游戏资源根地址，默认 "./资源/"。 */
  资源地址?: string;
  /** GM 套件资源根地址，默认 "./测试资源/"。 */
  测试资源地址?: string;
  登记纹理: (键: string, 纹理: Texture, 字节: number) => () => void;
  /** 散图列表；默认 读取默认散图()。 */
  散图?: readonly 散图来源[];
  /** 注入 JSON 读取（测试用）；默认 fetch。 */
  取JSON?: (地址: string) => Promise<unknown>;
  /** 注入纹理加载（测试用）；默认 TextureLoader。 */
  加载纹理?: (地址: string) => Promise<Texture>;
  /** 记录每个真实请求地址（资源验收页展示请求来源）。 */
  记录来源?: (地址: string) => void;
}

export interface 资源层实例 extends 资源层 {
  /** 已加载的项目图集名列表（当前只有项目图集；套件图按散图加载）。 */
  读取图集名列表(): string[];
  /** 帧未入集/被跳过的明确原因。 */
  读取跳过原因(图集: string, 帧: string): string | undefined;
}

const 默认图集名 = "再消一行";
const 默认图集地址 = "./图集/";
const 默认资源地址 = "./资源/";
const 默认测试资源地址 = "./测试资源/";

/** 默认散图只供资源验收页使用；游戏启动需显式声明实际运行资源。 */
export function 读取默认散图(): readonly 散图来源[] {
  return [{ 键: "测试/裁剪", 来源: "测试资源", 路径: "裁剪.svg" }];
}

function 拼接地址(前缀: string, 路径: string): string {
  const 规范路径 = 路径.replace(/^\/+/, "");
  return `${前缀.endsWith("/") ? 前缀 : `${前缀}/`}${规范路径}`;
}

/** 从 Three 纹理的 image（HTMLImageElement / ImageBitmap）读原始像素尺寸。 */
function 读取纹理尺寸(纹理: Texture): { 宽: number; 高: number } {
  const 图像: unknown = 纹理.image;
  if (!图像 || typeof 图像 !== "object") return { 宽: 0, 高: 0 };
  const 记录 = 图像 as Record<string, unknown>;
  const 宽 = typeof 记录.width === "number" ? 记录.width : 0;
  const 高 = typeof 记录.height === "number" ? 记录.height : 0;
  return { 宽, 高 };
}

function 默认加载纹理(地址: string): Promise<Texture> {
  return new TextureLoader().loadAsync(地址).then((纹理) => {
    纹理.minFilter = LinearFilter;
    纹理.magFilter = LinearFilter;
    纹理.generateMipmaps = false;
    return 纹理;
  });
}

function 默认取JSON(地址: string): Promise<unknown> {
  return fetch(地址).then(async (响应) => {
    if (!响应.ok) throw new Error(`HTTP ${响应.status}`);
    return 响应.json();
  });
}

interface 已加载散图 {
  渲染: 散图渲染;
  释放: () => void;
}

class 项目资源层 implements 资源层实例 {
  private readonly 图集表 = new Map<string, 图集纹理>();
  private readonly 散图表 = new Map<string, 已加载散图>();
  private readonly 图集名列表: string[] = [];
  private 已销毁 = false;

  constructor(项目图集: 图集纹理 | undefined, 项目图集名: string) {
    if (项目图集) {
      this.图集表.set(项目图集名, 项目图集);
      this.图集名列表.push(项目图集名);
    }
  }

  读取帧(图集: string, 帧: string): 图集帧渲染 | undefined {
    const 项目图集 = this.图集表.get(图集);
    if (!项目图集) return undefined;
    const 帧信息 = 项目图集.帧(帧);
    if (!帧信息) return undefined;
    return {
      页: 帧信息.页,
      紫外线: { ...帧信息.紫外线 },
      源宽: 帧信息.源宽,
      源高: 帧信息.源高,
      九宫: 帧信息.九宫
        ? {
            左: 帧信息.九宫.左,
            右: 帧信息.九宫.右,
            顶: 帧信息.九宫.顶,
            底: 帧信息.九宫.底,
          }
        : undefined,
    };
  }

  /** 帧未入集/被跳过的明确原因，供验收页与报错使用。 */
  读取跳过原因(图集: string, 帧: string): string | undefined {
    return this.图集表.get(图集)?.读取跳过原因(帧);
  }

  读取页纹理(图集: string, 页: number): Texture | undefined {
    return this.图集表.get(图集)?.读取页纹理(页);
  }

  读取散图(键: string): 散图渲染 | undefined {
    return this.散图表.get(键)?.渲染;
  }

  读取图集名列表(): string[] {
    return [...this.图集名列表];
  }

  读取统计(): 资源统计 {
    let 页数 = 0;
    let 帧数 = 0;
    let 纹理字节 = 0;
    for (const 图集 of this.图集表.values()) {
      const 统计 = 图集.读取统计();
      页数 += 统计.页数;
      帧数 += 统计.入集数;
      纹理字节 += 统计.纹理字节;
    }
    for (const 散图 of this.散图表.values()) 纹理字节 += 散图.渲染.宽 * 散图.渲染.高 * 4;
    return { 图集数: this.图集表.size, 页数, 帧数, 纹理字节, 散图数: this.散图表.size };
  }

  销毁(): void {
    if (this.已销毁) return;
    this.已销毁 = true;
    for (const 图集 of this.图集表.values()) 图集.销毁();
    this.图集表.clear();
    for (const 散图 of this.散图表.values()) 散图.释放();
    this.散图表.clear();
  }

  /** 登记散图纹理（加载完成后由 创建资源层 调用）。 */
  登记散图(键: string, 渲染: 散图渲染, 释放: () => void): void {
    this.散图表.set(键, { 渲染, 释放 });
  }
}

export async function 创建资源层(选项: 资源层选项): Promise<资源层实例> {
  const 图集名 = 选项.图集名 ?? 默认图集名;
  const 图集地址 = 选项.图集地址 ?? 默认图集地址;
  const 资源地址 = 选项.资源地址 ?? 默认资源地址;
  const 测试资源地址 = 选项.测试资源地址 ?? 默认测试资源地址;
  const 取JSON = 选项.取JSON ?? 默认取JSON;
  const 加载纹理 = 选项.加载纹理 ?? 默认加载纹理;
  const 记录来源 = 选项.记录来源 ?? (() => undefined);

  const 记录并加载纹理 = async (地址: string): Promise<Texture> => {
    记录来源(地址);
    return 加载纹理(地址);
  };

  const 资源文件 = 选项.资源文件 ?? 读取构建资源();
  let 项目图集: 图集纹理 | undefined;
  // 显式地址仍是必需资源；仅由构建计划确认不存在的默认图集才能短路。
  if (
    选项.图集地址 !== undefined ||
    资源文件 === undefined ||
    资源文件.includes("图集/清单.json")
  ) {
    const 清单地址 = 拼接地址(图集地址, "清单.json");
    记录来源(清单地址);
    let 清单对象: unknown;
    try {
      清单对象 = await 取JSON(清单地址);
    } catch (错误) {
      throw new Error(
        `资源加载失败：读取项目图集清单失败（期望 ${清单地址}）。` +
          `请先在游戏仓库运行「gm 图集 生成 项目 ${图集名}」生成 .gamemaker/图集/项目/${图集名}/清单.json。` +
          `原因：${错误 instanceof Error ? 错误.message : String(错误)}`,
      );
    }

    项目图集 = 创建图集纹理({
      清单: 清单对象,
      解析页地址: (文件) => 拼接地址(图集地址, 文件),
      加载页: 记录并加载纹理,
      登记纹理: 选项.登记纹理,
      键前缀: `图集/${图集名}`,
    });
    try {
      await 项目图集.加载();
    } catch (错误) {
      throw new Error(
        `资源加载失败：项目图集页图加载失败（期望目录 ${图集地址}，清单 ${清单地址}）。` +
          `请检查 .gamemaker/图集/项目/${图集名}/ 并在游戏仓库重新运行「gm 图集 生成 项目 ${图集名}」。` +
          `原因：${错误 instanceof Error ? 错误.message : String(错误)}`,
      );
    }
  }

  const 资源层 = new 项目资源层(项目图集, 图集名);
  for (const 来源 of 选项.散图 ?? 读取默认散图()) {
    const 前缀 = 来源.来源 === "测试资源" ? 测试资源地址 : 资源地址;
    const 地址 = 拼接地址(前缀, 来源.路径);
    let 纹理: Texture;
    try {
      纹理 = await 记录并加载纹理(地址);
    } catch (错误) {
      资源层.销毁();
      throw new Error(
        `资源加载失败：读取散图「${来源.键}」失败（期望 ${地址}）。` +
          `原因：${错误 instanceof Error ? 错误.message : String(错误)}`,
      );
    }
    const 尺寸 = 读取纹理尺寸(纹理);
    if (尺寸.宽 <= 0 || 尺寸.高 <= 0) throw new Error(`散图「${来源.键}」像素尺寸无效：${地址}`);
    const 释放 = 选项.登记纹理(`散图/${来源.键}`, 纹理, 尺寸.宽 * 尺寸.高 * 4);
    资源层.登记散图(来源.键, { 纹理, 宽: 尺寸.宽, 高: 尺寸.高 }, 释放);
  }
  return 资源层;
}
