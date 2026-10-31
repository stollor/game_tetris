/** 砖机液晶四色。配方、配色、预览只读这里，不散落字面量。 */
export const 像素四色: Record<"墨" | "暗" | "亮" | "底", number> = {
  墨: 0x0f380f,
  暗: 0x306230,
  亮: 0x8bac0f,
  底: 0x9bbc0f,
};

const 身份 = (基: number, 序: number) => 基 + 序;

export interface 像素色盘 {
  墨: number;
  暗: number;
  亮: number;
  底: number;
  纸: number;
  夜: number;
  远: number;
  暗纸: number;
  次字: number;
  壳: number;
  红: number;
  黄: number;
  绿: number;
  蓝: number;
  紫: number;
  青: number;
  橙: number;
}

export interface 像素视觉规范 {
  名称: string;
  英文: string;
  网格: number;
  描边: number;
  阴影: number;
  字体: string;
  字体文件: string;
  动画步频: number;
  深色: boolean;
  方块填井: boolean;
  外壳: { 外框: number; 内框: number };
  色: 像素色盘;
  方块: { I: number; O: number; T: number; S: number; Z: number; J: number; L: number };
  模式: { 马拉松: number; 冲刺: number; 极限: number; 每日挑战: number };
  音频: { 节拍: number; 音量: number; 脉冲秒: number };
}

const 共用网格 = {
  网格: 4,
  描边: 4,
  阴影: 0,
  字体: "Fusion Pixel",
  字体文件: "./资源/字体/像素中文.woff2",
  动画步频: 8,
  外壳: { 外框: 8, 内框: 4 },
} as const;

/** 四色橄榄 LCD。浅井深墨，用点阵纹区分七种方块。 */
export const 砖机液晶规范: 像素视觉规范 = {
  名称: "砖机液晶",
  英文: "Brick LCD",
  ...共用网格,
  深色: false,
  方块填井: true,
  色: {
    ...像素四色,
    纸: 像素四色.底,
    夜: 像素四色.底,
    远: 像素四色.暗,
    暗纸: 像素四色.暗,
    次字: 像素四色.暗,
    壳: 像素四色.墨,
    红: 像素四色.墨,
    黄: 像素四色.亮,
    绿: 像素四色.亮,
    蓝: 像素四色.暗,
    紫: 像素四色.暗,
    青: 像素四色.暗,
    橙: 像素四色.亮,
  },
  方块: {
    I: 身份(像素四色.墨, 0),
    O: 身份(像素四色.暗, 0),
    T: 身份(像素四色.墨, 1),
    S: 身份(像素四色.暗, 1),
    Z: 身份(像素四色.墨, 2),
    J: 身份(像素四色.暗, 2),
    L: 身份(像素四色.亮, 0),
  },
  模式: {
    马拉松: 像素四色.墨,
    冲刺: 像素四色.暗,
    极限: 像素四色.亮,
    每日挑战: 身份(像素四色.墨, 3),
  },
  音频: { 节拍: 96, 音量: 0.12, 脉冲秒: 0.05 },
};

/** 深色街机彩砖。七色实心方块、奶油字、金强调，和四色 LCD、极光宝石都分开。 */
export const 街机彩砖规范: 像素视觉规范 = {
  名称: "街机彩砖",
  英文: "Arcade Color",
  ...共用网格,
  深色: true,
  方块填井: false,
  色: {
    墨: 0xf4efe4,
    暗: 0x3a4663,
    亮: 0xffd37a,
    底: 0x1a1c2c,
    纸: 0x243044,
    夜: 0x12141f,
    远: 0x0e1220,
    暗纸: 0x1e2740,
    次字: 0x8b9bb4,
    壳: 0x0e1220,
    红: 0xff5a7a,
    黄: 0xffe14a,
    绿: 0x5dff7a,
    蓝: 0x4d8aff,
    紫: 0xc46bff,
    青: 0x3dffff,
    橙: 0xff9a3c,
  },
  方块: {
    I: 0x3dffff,
    O: 0xffe14a,
    T: 0xc46bff,
    S: 0x5dff7a,
    Z: 0xff5a7a,
    J: 0x4d8aff,
    L: 0xff9a3c,
  },
  模式: {
    马拉松: 0x3dffff,
    冲刺: 0xff9a3c,
    极限: 0xff5a7a,
    每日挑战: 0xc46bff,
  },
  音频: { 节拍: 120, 音量: 0.14, 脉冲秒: 0.05 },
};

export const 像素主题列表: readonly 像素视觉规范[] = [砖机液晶规范, 街机彩砖规范];

export function 是像素主题名(值: unknown): boolean {
  return 像素主题列表.some((项) => 项.名称 === 值);
}

export function 按名称取像素规范(名称: unknown): 像素视觉规范 {
  return 像素主题列表.find((项) => 项.名称 === 名称) ?? 砖机液晶规范;
}

let 读取配色: (() => string | undefined) | undefined;

/** 主题读取在模块加载后绑定，避免像素规范反向依赖主题组合。 */
export function 绑定像素规范读取(读取: () => string | undefined): void {
  读取配色 = 读取;
}

export function 当前像素规范(): 像素视觉规范 {
  return 按名称取像素规范(读取配色?.());
}

/**
 * 绘制期活规范。未穿像素主题时回落砖机液晶，供测试与默认参数使用。
 * 配色表、方块外观方案必须引用具体规范，不能在模块加载时冻住这一份。
 */
export const 像素规范: 像素视觉规范 = new Proxy(砖机液晶规范, {
  get(_目标, 键) {
    return 当前像素规范()[键 as keyof 像素视觉规范];
  },
});

export function 像素色串(值: number): string {
  return `#${值.toString(16).padStart(6, "0")}`;
}

export function 像素格点(值: number): number {
  return Math.round(值 / 像素规范.网格) * 像素规范.网格;
}
