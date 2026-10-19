import type Phaser from "phaser";
import type { 压力实例, 压力资源 } from "../../框架/开发/资源压力";
import type { 程序音频环境 } from "../../框架/音频/程序音频";
import { 演奏曲谱 } from "../../框架/音频/音乐编排";
import { 获取程序音频环境 } from "../../框架/音频/音频";
import { 绘制方块单元预制体 } from "../../组件/霓虹街机/方块单元";
import { 音乐库 } from "../框架配置/音乐";
import type { 再消一行状态, 方块类型 } from "../玩法/再消一行";
import { 消行特效 } from "../视觉/消行特效";
import { 落块特效 } from "../视觉/落块特效";
import { 游戏外观 } from "../配置/游戏外观";
import { 播放合成音效 } from "../音频/再消一行程序音频";

const 网格格数 = 10;
const 网格行数 = 20;
const 网格留白 = 0.96;
const 方块纹理键 = "资源压力.方块单元";
const 方块纹理尺寸 = 64;

const 硬降类型: 方块类型 = "I";

interface 网格位置 {
  左: number;
  上: number;
  宽: number;
  高: number;
  格子: number;
}

function 取网格位置(场景: Phaser.Scene, 序号: number, 数量: number): 网格位置 {
  const 场景宽 = 场景.scale.width || 390;
  const 场景高 = 场景.scale.height || 844;
  const 列数 = Math.max(1, Math.ceil(Math.sqrt((Math.max(1, 数量) * 场景宽) / 场景高)));
  const 行数 = Math.max(1, Math.ceil(Math.max(1, 数量) / 列数));
  const 格宽 = 场景宽 / 列数;
  const 格高 = 场景高 / 行数;
  return {
    左: (序号 % 列数) * 格宽,
    上: Math.floor(序号 / 列数) * 格高,
    宽: 格宽,
    高: 格高,
    格子: Math.min(格宽 / 网格格数, 格高 / 网格行数) * 网格留白,
  };
}

function 特效位置(网格: 网格位置): { x: number; y: number } {
  return {
    x: 网格.左 + (网格.宽 - 网格格数 * 网格.格子) / 2,
    y: 网格.上 + (网格.高 - 网格行数 * 网格.格子) / 2,
  };
}

const 硬降格子: [number, number][] = Array.from({ length: 网格格数 }, (_, 列) => [列, 18]);
const 四行消行: NonNullable<再消一行状态["消行事件"]> = {
  序号: 1,
  行: [16, 17, 18, 19],
  格子: [16, 17, 18, 19].flatMap((行) =>
    Array.from({ length: 网格格数 }, (_, 列): [number, number, 方块类型] => [列, 行, 硬降类型]),
  ),
};

const 创建落块特效 = (场景: Phaser.Scene, 序号: number, 数量: number): 压力实例 => {
  const 网格 = 取网格位置(场景, 序号, 数量);
  const 特效 = new 落块特效(场景);
  特效.设置格子(网格.格子);
  const { x, y } = 特效位置(网格);
  特效.setPosition(x, y);
  return {
    触发: () => 特效.硬降(硬降格子, 18, 硬降类型),
    更新: (毫秒) => 特效.更新(毫秒),
    销毁: () => {
      特效.清空();
      特效.destroy();
    },
  };
};

const 创建消行特效 = (场景: Phaser.Scene, 序号: number, 数量: number): 压力实例 => {
  const 网格 = 取网格位置(场景, 序号, 数量);
  const 特效 = new 消行特效(场景);
  特效.设置格子(网格.格子);
  const { x, y } = 特效位置(网格);
  特效.setPosition(x, y);
  return {
    触发: () => 特效.播放(四行消行),
    更新: (毫秒) => 特效.更新(毫秒),
    销毁: () => {
      特效.清空();
      特效.destroy();
    },
  };
};

let 方块纹理引用 = 0;
let 方块纹理自有 = false;

function 取得方块纹理(场景: Phaser.Scene): void {
  if (!场景.textures.exists(方块纹理键)) {
    const 绘图 = 场景.make.graphics({ x: 0, y: 0 }, false);
    绘制方块单元预制体(绘图, 0, 0, {
      色值: 游戏外观.方块.颜色.I,
      格子: 方块纹理尺寸,
    });
    绘图.generateTexture(方块纹理键, 方块纹理尺寸, 方块纹理尺寸);
    绘图.destroy();
    if (!场景.textures.exists(方块纹理键)) throw new Error("无法生成方块单元共享纹理");
    方块纹理自有 = true;
  }
  方块纹理引用++;
}

function 释放方块纹理(场景: Phaser.Scene): void {
  方块纹理引用 = Math.max(0, 方块纹理引用 - 1);
  if (方块纹理引用 > 0) return;
  if (方块纹理自有 && 场景.textures.exists(方块纹理键)) 场景.textures.remove(方块纹理键);
  方块纹理自有 = false;
}

const 创建方块单元 = (场景: Phaser.Scene, 序号: number, 数量: number): 压力实例 => {
  const 网格 = 取网格位置(场景, 序号, 数量);
  取得方块纹理(场景);
  let 图: Phaser.GameObjects.Image;
  try {
    const 边长 = Math.min(网格.宽, 网格.高) * 0.9;
    图 = 场景.add
      .image(网格.左 + 网格.宽 / 2, 网格.上 + 网格.高 / 2, 方块纹理键)
      .setDisplaySize(边长, 边长);
  } catch (错) {
    释放方块纹理(场景);
    throw 错;
  }
  return {
    销毁: () => {
      图.destroy();
      释放方块纹理(场景);
    },
  };
};

const 创建合成音效 = (_场景: Phaser.Scene): 压力实例 => {
  const 基础环境 = 获取程序音频环境();
  if (!基础环境) throw new Error("程序音频环境未就绪");
  const 增益 = 基础环境.上下文.createGain();
  增益.gain.value = 0.16;
  增益.connect(基础环境.音效输出);
  const 独立环境: 程序音频环境 = { ...基础环境, 音效输出: 增益 };
  return {
    触发: () => 播放合成音效(独立环境, "四行"),
    销毁: () => {
      增益.disconnect();
    },
  };
};

const 创建程序音乐 = (): 压力实例 => {
  const 环境 = 获取程序音频环境();
  if (!环境) throw new Error("程序音频环境未就绪");
  const 对局曲目 = 音乐库.find((项) => 项.id === "再消一行.对局");
  if (对局曲目?.类型 !== "曲谱") throw new Error("音乐库缺少对局曲谱");
  const 增益 = 环境.上下文.createGain();
  增益.gain.value = 0.12;
  增益.connect(环境.音乐输出);
  const 停止 = 演奏曲谱({ ...环境, 音乐输出: 增益 }, 对局曲目.曲谱);
  let 已停止 = false;
  return {
    销毁: () => {
      if (已停止) return;
      已停止 = true;
      停止();
      增益.disconnect();
    },
  };
};

export const 压力资源库: readonly 压力资源[] = [
  {
    编号: "drop",
    名称: "落块特效",
    最大数量: 100,
    创建: 创建落块特效,
  },
  {
    编号: "clear",
    名称: "消行特效",
    最大数量: 100,
    创建: 创建消行特效,
  },
  {
    编号: "block",
    名称: "方块单元",
    最大数量: 10000,
    创建: 创建方块单元,
  },
  {
    编号: "sfx",
    名称: "合成音效",
    最大数量: 64,
    创建: 创建合成音效,
  },
  {
    编号: "music",
    名称: "程序音乐",
    最大数量: 8,
    创建: 创建程序音乐,
  },
];
