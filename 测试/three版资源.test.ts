import { expect, test } from "bun:test";
import { Texture } from "three";
import { 创建资源层, 读取默认散图 } from "../代码/应用/资源/资源加载";

/**
 * 资源层规则测试：清单 → 帧查询 / 散图键 / 统计 / 销毁，
 * 用假 fetch（取JSON）与假纹理加载器代替浏览器网络与图片解码。
 */

function 测试清单(): Record<string, unknown> {
  return {
    格式版本: 1,
    种类: "项目",
    名称: "再消一行",
    目录: "项目/再消一行/",
    资源根: "资源",
    生成时间: "2026-10-20T10:47:21.269Z",
    页: [
      {
        编号: 0,
        文件: "页-1.webp",
        宽: 512,
        高: 512,
        格式: "webp",
        字节: 196050,
        使用率: 1,
      },
    ],
    帧: [
      { 名称: "图标/游戏图标.png", 页: 0, x: 0, y: 0, 宽: 512, 高: 512, 源宽: 512, 源高: 512 },
      {
        名称: "纯色帧.png",
        页: -1,
        x: 0,
        y: 0,
        宽: 0,
        高: 0,
        源宽: 10,
        源高: 10,
        纯色: "#ff0000",
      },
    ],
  };
}

const 图片尺寸: Record<string, { 宽: number; 高: number }> = {
  "页-1.webp": { 宽: 512, 高: 512 },
  "裁剪.svg": { 宽: 256, 高: 320 },
};

function 测试环境(
  覆盖: {
    取JSON?: (地址: string) => Promise<unknown>;
    加载纹理?: (地址: string) => Promise<Texture>;
  } = {},
) {
  const 请求: string[] = [];
  const 登记: { 键: string; 字节: number; 释放次数: number }[] = [];
  const 纹理表 = new Map<string, Texture>();
  const 取JSON = 覆盖.取JSON ?? (async () => 测试清单());
  const 加载纹理 =
    覆盖.加载纹理 ??
    (async (地址: string) => {
      const 文件名 = 地址.split("/").at(-1) ?? "";
      const 尺寸 = 图片尺寸[文件名];
      if (!尺寸) throw new Error(`HTTP 404: ${地址}`);
      const 纹理 = new Texture();
      纹理.image = { width: 尺寸.宽, height: 尺寸.高 };
      纹理表.set(文件名, 纹理);
      return 纹理;
    });
  const 创建 = 创建资源层({
    取JSON,
    加载纹理,
    记录来源: (地址) => {
      if (!请求.includes(地址)) 请求.push(地址);
    },
    登记纹理: (键, _纹理, 字节) => {
      const 项 = { 键, 字节, 释放次数: 0 };
      登记.push(项);
      return () => {
        项.释放次数++;
      };
    },
  });
  return { 创建, 请求, 登记, 纹理表 };
}

test("加载项目图集与默认验收散图：帧查询、纹理统计、请求来源顺序", async () => {
  const { 创建, 请求, 登记 } = 测试环境();
  const 资源 = await 创建;
  expect(请求).toEqual(["./图集/清单.json", "./图集/页-1.webp", "./测试资源/裁剪.svg"]);

  const 帧 = 资源.读取帧("再消一行", "图标/游戏图标.png");
  expect(帧).toEqual({
    页: 0,
    紫外线: { u: 0, v: 0, 宽: 1, 高: 1 },
    源宽: 512,
    源高: 512,
    九宫: undefined,
  });
  expect(资源.读取页纹理("再消一行", 0)).toBeInstanceOf(Texture);
  expect(资源.读取帧("再消一行", "纯色帧.png")).toBeUndefined();
  expect(资源.读取跳过原因("再消一行", "纯色帧.png")).toBe("纯色");
  expect(资源.读取帧("不存在的图集", "x")).toBeUndefined();
  expect(资源.读取页纹理("再消一行", 9)).toBeUndefined();

  const 裁剪图 = 资源.读取散图("测试/裁剪");
  expect(裁剪图?.宽).toBe(256);
  expect(裁剪图?.高).toBe(320);
  expect(资源.读取散图("不存在")).toBeUndefined();

  // 图集页 512²×4 + GM 验收样张 256×320×4。
  expect(资源.读取统计()).toEqual({
    图集数: 1,
    页数: 1,
    帧数: 1,
    纹理字节: 512 * 512 * 4 + 256 * 320 * 4,
    散图数: 1,
  });
  expect(资源.读取图集名列表()).toEqual(["再消一行"]);
  expect(登记.map((项) => 项.键)).toEqual(["图集/再消一行/页-1.webp", "散图/测试/裁剪"]);
  expect(登记.map((项) => 项.字节)).toEqual([512 * 512 * 4, 256 * 320 * 4]);

  资源.销毁();
  expect(登记.every((项) => 项.释放次数 === 1)).toBe(true);
  资源.销毁();
  expect(登记.every((项) => 项.释放次数 === 1)).toBe(true);
});

test("空构建资源不请求清单、不加载纹理或登记资源", async () => {
  const 请求: string[] = [];
  const 资源 = await 创建资源层({
    资源文件: [],
    散图: [],
    取JSON: async (地址) => {
      请求.push(地址);
      throw Error("不应请求");
    },
    加载纹理: async (地址) => {
      请求.push(地址);
      throw Error("不应加载");
    },
    登记纹理: () => {
      throw Error("不应登记");
    },
  });
  expect(请求).toEqual([]);
  expect(资源.读取图集名列表()).toEqual([]);
  expect(资源.读取统计()).toEqual({ 图集数: 0, 页数: 0, 帧数: 0, 纹理字节: 0, 散图数: 0 });
  资源.销毁();
});

test("空计划仍加载显式散图，缺失的显式图集仍报错", async () => {
  const 请求: string[] = [];
  const 纹理 = new Texture();
  纹理.image = { width: 2, height: 2 };
  const 资源 = await 创建资源层({
    资源文件: [],
    散图: [{ 键: "样本", 来源: "资源", 路径: "样本.png" }],
    加载纹理: async (地址) => {
      请求.push(地址);
      return 纹理;
    },
    登记纹理: () => () => 纹理.dispose(),
  });
  expect(请求).toEqual(["./资源/样本.png"]);
  expect(资源.读取统计().散图数).toBe(1);
  资源.销毁();
  await expect(
    创建资源层({
      资源文件: [],
      图集地址: "./必需图集/",
      散图: [],
      取JSON: async () => {
        throw Error("HTTP 404");
      },
      登记纹理: () => () => undefined,
    }),
  ).rejects.toThrow("读取项目图集清单失败");
});

test("清单加载失败给出期望路径与图集生成命令", async () => {
  const 失败 = 创建资源层({
    取JSON: async () => {
      throw new Error("HTTP 404");
    },
    加载纹理: async () => new Texture(),
    登记纹理: () => () => undefined,
  });
  await expect(失败).rejects.toThrow(/读取项目图集清单失败/);
  await expect(
    创建资源层({
      取JSON: async () => {
        throw new Error("HTTP 404");
      },
      加载纹理: async () => new Texture(),
      登记纹理: () => () => undefined,
    }),
  ).rejects.toThrow(/gm 图集 生成 项目 再消一行/);
});

test("页图与散图加载失败给出明确中文错误并释放已加载资源", async () => {
  const 页失败 = 测试环境({
    加载纹理: async (地址) => {
      if (地址.includes("页-1.webp")) throw new Error("HTTP 500");
      throw new Error("不应加载到这里");
    },
  });
  await expect(页失败.创建).rejects.toThrow(/项目图集页图加载失败/);

  const 散图失败: string[] = [];
  const 创建 = 创建资源层({
    图集名: "再消一行",
    取JSON: async () => 测试清单(),
    加载纹理: async (地址) => {
      散图失败.push(地址);
      if (地址.includes("裁剪.svg")) throw new Error("HTTP 404");
      const 纹理 = new Texture();
      纹理.image = { width: 512, height: 512 };
      return 纹理;
    },
    登记纹理: () => () => undefined,
  });
  await expect(创建).rejects.toThrow(/读取散图「测试\/裁剪」失败/);
  await expect(创建).rejects.toThrow(/\.\/测试资源\/裁剪\.svg/);
  expect(散图失败).toEqual(["./图集/页-1.webp", "./测试资源/裁剪.svg"]);
});

test("散图键与清单名可配置，默认散图只包含项目测试图片", async () => {
  expect(读取默认散图()).toEqual([{ 键: "测试/裁剪", 来源: "测试资源", 路径: "裁剪.svg" }]);

  const 请求: string[] = [];
  const 资源 = await 创建资源层({
    图集名: "自定义",
    图集地址: "/自定义图集/",
    资源地址: "/自定义资源/",
    散图: [{ 键: "图标", 来源: "资源", 路径: "图标.png" }],
    取JSON: async (地址) => {
      请求.push(地址);
      return { ...测试清单(), 名称: "自定义" };
    },
    加载纹理: async (地址) => {
      请求.push(地址);
      const 纹理 = new Texture();
      纹理.image = { width: 32, height: 16 };
      return 纹理;
    },
    登记纹理: () => () => undefined,
  });
  expect(请求).toEqual(["/自定义图集/清单.json", "/自定义图集/页-1.webp", "/自定义资源/图标.png"]);
  expect(资源.读取图集名列表()).toEqual(["自定义"]);
  expect(资源.读取散图("图标")?.宽).toBe(32);
  expect(资源.读取统计().图集数).toBe(1);
  资源.销毁();
});
