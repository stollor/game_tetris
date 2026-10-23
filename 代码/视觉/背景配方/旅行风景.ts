import type { 图形对象 } from "../../../框架/界面/绘制/协议";
import { 亮色, 暗色 } from "../../../框架/界面/颜色工具";
import type { 地点皮肤 } from "../../框架配置/旅行地点";

type 图形 = 图形对象;
const 随机 = (n: number) => {
  const 值 = Math.sin(n * 127.1 + 31.7) * 43758.5453;
  return 值 - Math.floor(值);
};
function 多边形(g: 图形, 点: number[][], 色: number, 透明度 = 1): void {
  g.fillStyle(色, 透明度).fillPoints(
    点.map(([x, y]) => ({ x, y })),
    true,
  );
}
function 山峦(g: 图形, 宽: number, 基线: number, 振幅: number, 色: number, 种子 = 0): void {
  const 点 = [
    [0, 900],
    [0, 基线],
  ];
  for (let i = 0; i <= 16; i++)
    点.push([(宽 * i) / 16, 基线 - Math.sin(i * 1.8 + 种子) * 振幅 - 随机(i + 种子) * 振幅]);
  点.push([宽, 900]);
  多边形(g, 点, 色);
}
function 屋顶(g: 图形, x: number, y: number, 宽: number, 色: number): void {
  多边形(
    g,
    [
      [x - 宽 * 0.56, y + 17],
      [x - 宽 * 0.45, y + 9],
      [x - 宽 * 0.32, y - 15],
      [x, y - 38],
      [x + 宽 * 0.32, y - 15],
      [x + 宽 * 0.45, y + 9],
      [x + 宽 * 0.56, y + 17],
    ],
    色,
  );
  g.lineStyle(3, 亮色(色, 0.4), 0.8).lineBetween(x - 宽 * 0.52, y + 14, x + 宽 * 0.52, y + 14);
}
function 宫楼(g: 图形, x: number, y: number, 宽: number, 色: number, 金: number): void {
  g.fillStyle(暗色(色, 0.3)).fillRect(x - 宽 * 0.45, y - 70, 宽 * 0.9, 78);
  for (let i = 0; i < 7; i++)
    g.fillStyle(i % 2 ? 暗色(色, 0.35) : 亮色(色, 0.15)).fillRect(
      x - 宽 * 0.4 + i * 宽 * 0.12,
      y - 66,
      宽 * 0.065,
      70,
    );
  屋顶(g, x, y - 80, 宽, 金);
  g.fillStyle(0xe4c3a0).fillRect(x - 宽 * 0.5, y, 宽, 12);
}
function 竹子(g: 图形, x: number, 顶: number, 高: number, 色: number): void {
  g.lineStyle(9, 色, 0.8).lineBetween(x, 顶, x + 14, 顶 + 高);
  for (let i = 0; i < 5; i++) {
    const y = 顶 + (i * 高) / 5;
    g.lineStyle(2, 亮色(色, 0.5), 0.6).lineBetween(x - 5 + i * 2, y, x + 8 + i * 2, y);
    for (const d of [-1, 1])
      多边形(
        g,
        [
          [x, y],
          [x + d * 64, y - 24],
          [x + d * 40, y + 9],
        ],
        色,
        0.85,
      );
  }
}
function 熊猫(g: 图形, x: number, y: number, 大小: number, 时间 = 0): void {
  y += Math.sin(时间 * 1.7) * 大小 * 0.018;
  g.fillStyle(0x172b2b)
    .fillEllipse(x, y + 大小 * 0.5, 大小 * 1.1, 大小 * 0.95)
    .fillCircle(x - 大小 * 0.42, y - 大小 * 0.45, 大小 * 0.22)
    .fillCircle(x + 大小 * 0.42, y - 大小 * 0.45, 大小 * 0.22);
  g.fillStyle(0xf3f0dd)
    .fillEllipse(x, y + 大小 * 0.45, 大小 * 0.83, 大小 * 0.86)
    .fillCircle(x, y, 大小 * 0.56);
  g.fillStyle(0x1e3332)
    .fillEllipse(x - 大小 * 0.23, y, 大小 * 0.29, 大小 * 0.37)
    .fillEllipse(x + 大小 * 0.23, y, 大小 * 0.29, 大小 * 0.37);
  const 眨眼 = 时间 % 5.6 > 5.35;
  for (const d of [-1, 1]) {
    g.fillStyle(0xfff8e8).fillEllipse(
      x + d * 大小 * 0.23,
      y - 大小 * 0.02,
      大小 * 0.09,
      大小 * (眨眼 ? 0.016 : 0.09),
    );
  }
  多边形(
    g,
    [
      [x - 大小 * 0.08, y + 大小 * 0.18],
      [x + 大小 * 0.08, y + 大小 * 0.18],
      [x, y + 大小 * 0.25],
    ],
    0x1e3332,
  );
  g.fillStyle(0x172b2b)
    .fillEllipse(x - 大小 * 0.43, y + 大小 * 0.75, 大小 * 0.38, 大小 * 0.2)
    .fillEllipse(x + 大小 * 0.43, y + 大小 * 0.75, 大小 * 0.38, 大小 * 0.2);
  const 举爪 = Math.sin(时间 * 1.3) * 大小 * 0.05;
  g.lineStyle(大小 * 0.055, 0x6c9b63).lineBetween(
    x + 大小 * 0.25,
    y + 大小 * 0.6,
    x + 大小 * 0.45,
    y + 大小 * 0.03 + 举爪,
  );
  g.fillStyle(0x172b2b).fillEllipse(
    x + 大小 * 0.3,
    y + 大小 * 0.38 + 举爪,
    大小 * 0.32,
    大小 * 0.2,
  );
  for (let i = 0; i < 3; i++)
    g.fillStyle(0x90b874).fillEllipse(
      x + 大小 * (0.4 + i * 0.02),
      y + 大小 * (0.08 + i * 0.07) + 举爪,
      大小 * 0.2,
      大小 * 0.04,
    );
}
function 松树(g: 图形, x: number, y: number, 大小: number): void {
  g.lineStyle(大小 * 0.08, 0x34483e).lineBetween(x, y, x + 大小 * 0.14, y - 大小 * 0.85);
  for (let i = 0; i < 4; i++) {
    const 顶 = y - 大小 * (0.25 + i * 0.19),
      d = i % 2 ? -1 : 1;
    g.lineStyle(大小 * 0.035, 0x34483e).lineBetween(
      x + 大小 * 0.1,
      顶,
      x + d * 大小 * 0.58,
      顶 - 大小 * 0.08,
    );
    for (let j = 0; j < 7; j++)
      g.lineStyle(大小 * 0.02, 0x3d6452, 0.9).lineBetween(
        x + d * j * 大小 * 0.09,
        顶,
        x + d * j * 大小 * 0.09 + 大小 * 0.1,
        顶 - 大小 * 0.17,
      );
  }
}
function 民居(g: 图形, x: number, y: number, 宽: number, 墙: number, 顶: number): void {
  g.fillStyle(暗色(墙, 0.12)).fillRect(x - 宽 * 0.48, y - 28, 宽 * 0.96, 38);
  g.fillStyle(墙).fillRect(x - 宽 * 0.45, y - 26, 宽 * 0.9, 34);
  g.fillStyle(0x2a2420, 0.5)
    .fillRect(x - 宽 * 0.28, y - 12, 宽 * 0.16, 18)
    .fillRect(x + 宽 * 0.08, y - 12, 宽 * 0.16, 18);
  屋顶(g, x, y - 32, 宽 * 1.05, 顶);
}
function 飞檐殿(g: 图形, x: number, y: number, 宽: number, 墙: number, 金: number, 层 = 2): void {
  for (let i = 层 - 1; i >= 0; i--) {
    const w = 宽 * (0.58 + i * 0.2),
      cy = y + (层 - 1 - i) * 34;
    g.fillStyle(墙).fillRect(x - w * 0.42, cy - 26, w * 0.84, 30);
    for (let k = 0; k < 6; k++)
      g.fillStyle(k % 2 ? 暗色(墙, 0.22) : 亮色(墙, 0.12)).fillRect(
        x - w * 0.36 + k * w * 0.12,
        cy - 22,
        w * 0.07,
        22,
      );
    屋顶(g, x, cy - 34, w, 金);
  }
  g.fillStyle(0xd9c7a4).fillRect(x - 宽 * 0.48, y + 层 * 26, 宽 * 0.96, 10);
}
function 喀斯特峰(g: 图形, x: number, 基线: number, 高: number, 半宽: number, 色: number): void {
  多边形(
    g,
    [
      [x - 半宽, 基线],
      [x - 半宽 * 0.55, 基线 - 高 * 0.32],
      [x - 半宽 * 0.22, 基线 - 高 * 0.76],
      [x - 半宽 * 0.06, 基线 - 高],
      [x + 半宽 * 0.12, 基线 - 高 * 0.9],
      [x + 半宽 * 0.4, 基线 - 高 * 0.48],
      [x + 半宽, 基线],
    ],
    色,
  );
  g.fillStyle(亮色(色, 0.2), 0.32).fillTriangle(
    x - 半宽 * 0.08,
    基线 - 高 * 0.52,
    x,
    基线 - 高,
    x + 半宽 * 0.1,
    基线 - 高 * 0.46,
  );
}
function 柳树(g: 图形, x: number, 顶: number, 高: number, 色: number): void {
  g.lineStyle(5, 0x3c4a38).lineBetween(x, 顶 + 高, x + 6, 顶);
  for (let i = 0; i < 6; i++) {
    const y = 顶 + 10 + i * 高 * 0.12;
    for (const d of [-1, 1])
      g.lineStyle(2, 色, 0.72).lineBetween(x + 4, y, x + d * (38 + i * 6), y + 26 + i * 3);
  }
}
function 亭(g: 图形, x: number, y: number, 宽: number, 柱: number, 顶: number): void {
  屋顶(g, x, y - 16, 宽, 顶);
  for (const d of [-0.32, 0.32]) g.fillStyle(柱).fillRect(x + 宽 * d - 3, y - 8, 6, 26);
  g.fillStyle(暗色(顶, 0.18)).fillRect(x - 宽 * 0.38, y + 16, 宽 * 0.76, 5);
}
function 烽火台(g: 图形, x: number, y: number, 宽: number): void {
  g.fillStyle(0x8a7058).fillRect(x - 宽 / 2, y - 54, 宽, 54);
  g.fillStyle(0x6f5844).fillRect(x - 宽 / 2 + 6, y - 46, 宽 - 12, 38);
  for (let k = 0; k < 5; k++)
    g.fillStyle(0xd8bb8d).fillRect(x - 宽 / 2 + k * (宽 / 5) + 2, y - 62, 宽 / 5 - 4, 10);
  g.fillStyle(0x3c3e37).fillRect(x - 5, y - 30, 10, 18);
}
function 经幡(g: 图形, x: number, 顶: number, 底: number, 色列: number[]): void {
  g.lineStyle(2, 0x4a4034).lineBetween(x, 顶, x + 6, 底);
  色列.forEach((色, i) => {
    const y = 顶 + 16 + i * 20;
    多边形(
      g,
      [
        [x + 2, y],
        [x + 26, y + 3],
        [x + 24, y + 13],
        [x + 2, y + 10],
      ],
      色,
      0.88,
    );
  });
}

/** 每个地点独立构图；纵向单位固定，横向使用实际宽度，避免把手机风景横向压扁。 */
export function 绘制旅行风景(
  g: 图形,
  像素宽: number,
  像素高: number,
  地点: 地点皮肤,
  静态主体 = true,
): void {
  const 单位 = 像素高 / 900;
  g.save().scaleCanvas(单位, 单位);
  绘制旅行风景内容(g, 像素宽 / 单位, 地点, 静态主体);
  g.restore();
}

function 绘制旅行风景内容(g: 图形, 宽: number, 地点: 地点皮肤, 静态主体: boolean): void {
  const [天, 霞] = 地点.天空;
  g.fillGradientStyle(天, 天, 霞, 霞, 1).fillRect(0, 0, 宽, 900);
  g.fillStyle(0xffecd1, 0.7).fillCircle(宽 * 0.78, 210, 地点.纹样 === "流沙" ? 65 : 38);
  山峦(g, 宽, 530, 60, 地点.远景, 3);
  if (地点.纹样 === "熊猫") {
    山峦(g, 宽, 690, 30, 0x88a784, 8);
    g.fillStyle(0x66876b).fillRect(0, 770, 宽, 130);
    g.fillStyle(0x4e6a52, 0.55).fillEllipse(宽 * 0.22, 820, 180, 40);
    g.fillStyle(0x6b5a48).fillEllipse(宽 * 0.18, 838, 70, 22);
    for (let i = 0; i < 11; i++)
      竹子(
        g,
        宽 * (i / 12 + 0.02),
        300 + 随机(i) * 110,
        540 + 随机(i + 4) * 40,
        i % 2 ? 0x3d6f58 : 0x678e62,
      );
    g.fillStyle(0xf1e5bf, 0.45).fillEllipse(宽 * 0.4, 850, 宽 * 0.65, 34);
  } else if (地点.纹样 === "冰晶") {
    const 顶点 = [
      [宽 * 0.16, 240],
      [宽 * 0.48, 128],
      [宽 * 0.8, 268],
    ];
    for (const [x, y] of 顶点) {
      多边形(
        g,
        [
          [x - 宽 * 0.28, 690],
          [x, y],
          [x + 宽 * 0.26, 690],
        ],
        0x7a97ab,
      );
      多边形(
        g,
        [
          [x - 宽 * 0.14, y + 200],
          [x, y],
          [x + 宽 * 0.13, y + 196],
          [x + 宽 * 0.05, y + 136],
          [x, y + 176],
          [x - 宽 * 0.04, y + 118],
        ],
        0xf4f4ea,
      );
      多边形(
        g,
        [
          [x, y],
          [x + 宽 * 0.26, 690],
          [x + 宽 * 0.05, y + 196],
        ],
        0x5d7a93,
        0.55,
      );
    }
    g.fillGradientStyle(0x8bb4c4, 0x8bb4c4, 0x3d5d72, 0x3d5d72, 1).fillRect(0, 678, 宽, 222);
    for (let i = 0; i < 4; i++)
      民居(g, 宽 * (0.12 + i * 0.2), 790, Math.min(118, 宽 * 0.16), 0xe8dcc4, 0x4a3f38);
    经幡(g, 宽 * 0.08, 430, 780, [0xc45c4a, 0xe2c56a, 0x5d8f7a, 0x4d6fa3]);
    松树(g, 宽 * 0.9, 760, 110);
  } else if (地点.纹样 === "城砖") {
    山峦(g, 宽, 620, 90, 0x4f655c, 2);
    山峦(g, 宽, 720, 70, 0x53695e, 9);
    山峦(g, 宽, 840, 50, 0x3e524b, 5);
    const 路径 = Array.from({ length: 24 }, (_, i) => ({
      x: (宽 * i) / 23,
      y: 500 + Math.sin(i * 0.48) * 78 + i * 8,
    }));
    g.lineStyle(46, 0x6a5646).strokePoints(路径, false);
    g.lineStyle(22, 0xb8946a).strokePoints(路径, false);
    g.lineStyle(6, 0xd8bb8d, 0.7).strokePoints(
      路径.map((点) => ({ x: 点.x, y: 点.y - 12 })),
      false,
    );
    路径.forEach((点, i) => {
      if (i % 3 === 0) g.fillStyle(0xd8bb8d).fillRect(点.x - 7, 点.y - 22, 8, 10);
      if (i % 5 === 0) 烽火台(g, 点.x, 点.y, 52);
    });
  } else if (地点.纹样 === "宫阙") {
    g.fillStyle(0x6c3534).fillRect(0, 520, 宽, 380);
    g.fillStyle(0xc4a07a).fillRect(宽 * 0.18, 640, 宽 * 0.64, 90);
    g.fillStyle(0xd8c09a).fillTriangle(宽 * 0.42, 640, 宽 * 0.5, 560, 宽 * 0.58, 640);
    for (let i = 0; i < 9; i++)
      g.fillStyle(0x8a3a34).fillRect(宽 * 0.2 + i * 宽 * 0.07, 650, 宽 * 0.02, 28);
    飞檐殿(g, 宽 * 0.5, 500, Math.min(520, 宽 * 0.7), 0x9f342d, 0xe0ad53, 3);
    飞檐殿(g, 宽 * 0.16, 680, 宽 * 0.24, 0x8a352f, 0xc7954e, 2);
    飞檐殿(g, 宽 * 0.84, 680, 宽 * 0.24, 0x8a352f, 0xc7954e, 2);
    g.fillStyle(0xd9c7a4).fillRect(宽 * 0.46, 720, 宽 * 0.08, 80);
  } else if (地点.纹样 === "莲叶") {
    g.fillGradientStyle(0x7eaaa6, 0x7eaaa6, 0x426d70, 0x426d70, 1).fillRect(0, 480, 宽, 420);
    for (let i = 0; i < 5; i++)
      g.fillStyle(0xd5e4dc, 0.12).fillEllipse((宽 * (i + 0.3)) / 5, 430 + i * 18, 220, 28);
    柳树(g, 宽 * 0.08, 380, 420, 0x4d6f5c);
    柳树(g, 宽 * 0.9, 400, 390, 0x5a7a66);
    亭(g, 宽 * 0.14, 620, 90, 0x5a4a38, 0x44574c);
    const 桥宽 = Math.min(宽 * 0.76, 760),
      桥左 = (宽 - 桥宽) / 2,
      桥面: number[][] = [],
      桥底: number[][] = [];
    for (let i = 0; i <= 32; i++) {
      const x = 桥左 + (桥宽 * i) / 32,
        拱起 = Math.sin((i / 32) * Math.PI) * 67;
      桥面.push([x, 634 - 拱起]);
      桥底.unshift([x, 658 - 拱起]);
      if (i % 2 === 0) {
        g.lineStyle(4, 0xb8bcb0).lineBetween(x, 632 - 拱起, x, 607 - 拱起);
        g.fillStyle(0xd1d0bd).fillCircle(x, 605 - 拱起, 4);
      }
    }
    多边形(g, [...桥面, ...桥底], 0x9eaaa1);
    g.lineStyle(4, 0xc9cbbd).strokePoints(桥面.map(([x, y]) => ({ x, y: y - 26 })));
    g.lineStyle(2, 0xe1decc).strokePoints(桥面.map(([x, y]) => ({ x, y })));
    for (const x of [桥左 + 10, 桥左 + 桥宽 - 10])
      g.fillStyle(0x88998e).fillRect(x - 11, 648, 22, 40);
    for (let i = 0; i < 3; i++) {
      const x = 宽 * (0.65 + i * 0.065);
      g.fillStyle(0x5f7772)
        .fillEllipse(x + 4, 674, 26, 10)
        .fillRect(x - 4, 650, 17, 25)
        .fillEllipse(x + 4, 647, 23, 11)
        .fillTriangle(x - 12, 642, x + 20, 642, x + 4, 628);
      g.fillStyle(0xc0c4ac).fillCircle(x + 4, 656, 3);
    }
    竹子(g, 宽 * 0.04, 410, 490, 0x4c7563);
  } else if (地点.纹样 === "流沙") {
    for (let 层 = 0; 层 < 5; 层++) {
      const 点 = [[0, 900]];
      for (let i = 0; i <= 32; i++)
        点.push([(宽 * i) / 32, 520 + 层 * 72 + Math.sin(i * 0.2 + 层 * 1.4) * (58 - 层 * 4)]);
      点.push([宽, 900]);
      多边形(g, 点, [0xe0b57a, 0xc18b5d, 0xd8a36b, 0xc08a50, 0x9b6c43][层]);
    }
    多边形(
      g,
      [
        [宽 * 0.62, 430],
        [宽 * 0.78, 250],
        [宽, 250],
        [宽, 620],
        [宽 * 0.7, 640],
      ],
      0xa56b46,
    );
    for (let i = 0; i < 6; i++)
      g.fillStyle(0x3d2a22, 0.7).fillEllipse(
        宽 * (0.74 + (i % 3) * 0.07),
        340 + Math.floor(i / 3) * 70,
        18,
        26,
      );
    g.fillStyle(0x527f83).fillEllipse(宽 * 0.7, 750, 宽 * 0.28, 48);
    g.fillStyle(0xc08a50).fillEllipse(宽 * 0.68, 736, 宽 * 0.24, 36);
    屋顶(g, 宽 * 0.22, 560, 70, 0x8a5a3a);
    g.fillStyle(0xb8885c).fillRect(宽 * 0.22 - 18, 568, 36, 40);
  } else if (地点.纹样 === "山水") {
    g.fillGradientStyle(0x8aafac, 0x8aafac, 0x3f6864, 0x3f6864, 1).fillRect(0, 530, 宽, 370);
    for (let i = 0; i < 7; i++) {
      const x = (宽 * (i + 0.35)) / 7,
        高 = 210 + 随机(i) * 230,
        色 = i % 2 ? 0x4e7468 : 0x6b9583;
      喀斯特峰(g, x, 600, 高, 宽 * 0.09, 色);
      g.fillStyle(色, 0.18).fillTriangle(x - 宽 * 0.07, 780, x, 600, x + 宽 * 0.07, 780);
    }
    for (let i = 0; i < 4; i++)
      g.fillStyle(0xd5e8e2, 0.1).fillEllipse((宽 * (i + 0.4)) / 4, 500 + i * 16, 260, 24);
  } else if (地点.纹样 === "窗棂") {
    g.fillGradientStyle(0x9bb8b0, 0x9bb8b0, 0x6d8b82, 0x6d8b82, 1).fillRect(0, 520, 宽, 200);
    g.fillStyle(0x7d9a90).fillEllipse(宽 * 0.42, 720, 宽 * 0.7, 90);
    山峦(g, 宽, 890, 18, 0x819584, 4);
    亭(g, 宽 * 0.7, 600, 110, 0x4a5c54, 0x3d4f48);
    柳树(g, 宽 * 0.12, 480, 340, 0x62765c);
    g.fillStyle(0x6d5a48).fillEllipse(宽 * 0.28, 780, 80, 22);
    g.fillStyle(0x8a7660).fillEllipse(宽 * 0.32, 768, 36, 28);
    const x = 宽 * 0.62;
    g.lineStyle(18, 0x3a4f4e, 0.92).strokeCircle(x, 665, 124);
    g.lineStyle(8, 0x243836, 0.8).strokeCircle(x, 665, 112);
    for (let i = -2; i <= 2; i++)
      g.lineStyle(4, 0x3a4f4e, 0.55).lineBetween(x + i * 28, 560, x + i * 28, 770);
    g.lineStyle(5, 0x3a4f4e, 0.55)
      .lineBetween(x - 96, 630, x + 96, 630)
      .lineBetween(x - 96, 698, x + 96, 698);
    竹子(g, 宽 * 0.08, 560, 300, 0x62765c);
  } else if (地点.纹样 === "霓虹") {
    g.fillStyle(0x1b2444).fillRect(0, 640, 宽, 260);
    g.fillGradientStyle(0x1c2748, 0x1c2748, 0x12182e, 0x12182e, 1).fillRect(0, 500, 宽, 150);
    for (let 层 = 0; 层 < 3; 层++)
      for (let i = 0; i < 16; i++) {
        const x = (宽 * (i + 层 * 0.2)) / 16,
          高 = 80 + 层 * 70 + 随机(i + 层 * 9) * (160 - 层 * 30),
          楼宽 = 宽 / 22;
        g.fillStyle(i % 2 ? 0x31395f : 0x232a48).fillRect(x, 620 - 层 * 40 - 高, 楼宽, 高);
        for (let k = 0; k < 6; k++)
          g.fillStyle(k % 2 ? 0xf1bc83 : 0xcb8eaa, 0.55 + 层 * 0.1).fillRect(
            x + 4,
            628 - 层 * 40 - 高 + k * 18,
            楼宽 * 0.55,
            3,
          );
      }
    g.fillStyle(0x1a3058, 0.7).fillRect(0, 700, 宽, 36);
    g.lineStyle(12, 0xc4758f).lineBetween(0, 580, 宽, 545);
    g.lineStyle(2, 0xf1c5b2).lineBetween(0, 569, 宽, 534);
    g.lineStyle(4, 0x829cce)
      .lineBetween(宽 * 0.17, 630, 宽 * 0.17, 390)
      .lineBetween(宽 * 0.8, 630, 宽 * 0.8, 390);
    for (let i = 0; i < 12; i++)
      g.lineStyle(1, 0x718abb, 0.8).lineBetween(宽 * 0.17, 390, (宽 * i) / 12, 630);
  } else if (地点.纹样 === "铜纹") {
    g.fillStyle(0x6e5b52).fillRect(0, 640, 宽, 260);
    for (let i = 0; i < 18; i++) g.fillStyle(0x9b8772).fillRect((宽 * i) / 17, 630, 宽 / 34, 22);
    g.fillStyle(0x5a463c).fillRect(0, 600, 宽, 36);
    g.fillStyle(0x3d322c).fillRect(宽 * 0.42, 560, 宽 * 0.16, 80);
    g.fillStyle(0xc4a46a).fillTriangle(宽 * 0.4, 560, 宽 * 0.5, 500, 宽 * 0.6, 560);
    飞檐殿(g, 宽 * 0.5, 430, Math.min(280, 宽 * 0.36), 0x814839, 0xc4a46a, 3);
    宫楼(g, 宽 * 0.18, 700, 宽 * 0.2, 0x814839, 0x9b8858);
    宫楼(g, 宽 * 0.82, 700, 宽 * 0.2, 0x814839, 0x9b8858);
  } else if (地点.纹样 === "松针") {
    for (let i = 0; i < 6; i++) {
      const x = (宽 * (i + 0.15)) / 5.2;
      喀斯特峰(
        g,
        x,
        820,
        280 + (i % 2) * 120 + 随机(i) * 80,
        宽 * 0.08,
        i % 2 ? 0x5f7470 : 0x82938b,
      );
    }
    for (let i = 0; i < 7; i++)
      g.fillStyle(0xe5e6d8, 0.38).fillEllipse((宽 * i) / 6, 690 + Math.sin(i) * 36, 宽 * 0.55, 90);
    g.fillStyle(0xcfd4c6, 0.25).fillRect(宽 * 0.46, 620, 10, 180);
  } else {
    多边形(
      g,
      [
        [0, 580],
        [宽 * 0.2, 280],
        [宽 * 0.38, 520],
        [宽 * 0.58, 240],
        [宽 * 0.78, 480],
        [宽, 300],
        [宽, 620],
      ],
      0xb7c8c6,
    );
    山峦(g, 宽, 640, 40, 0x8aa09a, 4);
    for (let i = 0; i < 6; i++) {
      const 楼宽 = 宽 * (0.72 - i * 0.08),
        白 = i % 3 !== 1;
      g.fillStyle(白 ? 0xf2ead6 : 0x8d3d3a).fillRect(宽 * 0.5 - 楼宽 / 2, 700 - i * 52, 楼宽, 54);
      if (!白) 屋顶(g, 宽 * 0.5, 698 - i * 52, 楼宽 * 0.9, 0xe9bd61);
      for (let k = 0; k < 8; k++)
        g.fillStyle(0x5d5060, 0.7).fillRect(
          宽 * 0.5 - 楼宽 * 0.42 + k * 楼宽 * 0.11,
          712 - i * 52,
          10,
          16,
        );
    }
    屋顶(g, 宽 * 0.5, 390, 宽 * 0.22, 0xe9bd61);
    经幡(g, 宽 * 0.12, 360, 700, [0xc45c4a, 0xe2c56a, 0x5d8f7a, 0x4d6fa3, 0xc45c4a]);
    经幡(g, 宽 * 0.86, 380, 720, [0x4d6fa3, 0xc45c4a, 0xe2c56a, 0x5d8f7a]);
  }
  g.fillGradientStyle(0x061521, 0x061521, 0x061521, 0x061521, 0, 0, 0.25, 0.25).fillRect(
    0,
    650,
    宽,
    250,
  );
  if (静态主体) 绘制旅行主体(g, 宽, 地点, 0);
}

function 行舟(g: 图形, x: number, y: number, t: number, 竹筏: boolean): void {
  const 浮动 = Math.sin(t * 1.4) * 3;
  y += 浮动;
  g.lineStyle(2, 0xdce4cd, 0.3).strokeEllipse(x, y + 18, 170 + Math.sin(t) * 16, 17);
  多边形(
    g,
    [
      [x - 77, y],
      [x + 75, y],
      [x + 55, y + 15],
      [x - 54, y + 14],
    ],
    0x574b37,
  );
  for (let i = 0; i < 5; i++)
    g.lineStyle(2, 0xb69c6b).lineBetween(x - 56, y + 2 + i * 2, x + 56, y + 2 + i * 2);
  if (!竹筏) {
    g.fillStyle(0xc3b58c).fillEllipse(x - 16, y - 12, 75, 42);
    g.fillStyle(0x526f64).fillEllipse(x - 16, y - 6, 61, 36);
    g.fillStyle(0x816c45).fillRect(x - 48, y - 8, 65, 10);
  }
  g.lineStyle(8, 0x34463e).lineBetween(x + 38, y - 4, x + 36, y - 47);
  g.fillStyle(0xc4aa7c).fillCircle(x + 36, y - 54, 8);
  g.fillStyle(0xd9bc82).fillTriangle(x + 18, y - 58, x + 54, y - 58, x + 37, y - 70);
  const 桨 = Math.sin(t * 1.4) * 24;
  g.lineStyle(3, 0x4c4732).lineBetween(x + 35, y - 35, x + 87 + 桨, y + 13);
  g.lineStyle(6, 0x645b3e).lineBetween(x + 74 + 桨, y + 4, x + 92 + 桨, y + 19);
  for (let i = 0; i < 3; i++)
    g.lineStyle(1, 0xe5e8d0, 0.3).strokeEllipse(
      x + 90 + 桨,
      y + 20,
      18 + i * 17 + Math.sin(t) * 7,
      4 + i * 3,
    );
}

function 灯笼(g: 图形, x: number, 顶: number, y: number, t: number, 大小 = 1): void {
  const 摆 = Math.sin(t * 1.1 + x) * 12 * 大小;
  const cx = x + 摆,
    cy = y + Math.cos(t * 1.1 + x) * 2;
  g.lineStyle(2, 0x645148).lineBetween(x, 顶, cx, cy - 27 * 大小);
  for (let i = 4; i > 0; i--) g.fillStyle(0xf7bc65, 0.012).fillCircle(cx, cy, 大小 * (26 + i * 12));
  g.fillStyle(0xca6850).fillEllipse(cx, cy, 42 * 大小, 54 * 大小);
  g.lineStyle(2, 0xf1c674)
    .strokeEllipse(cx, cy, 42 * 大小, 54 * 大小)
    .strokeEllipse(cx, cy, 17 * 大小, 54 * 大小);
  g.fillStyle(0xf2c779)
    .fillRect(cx - 12 * 大小, cy - 28 * 大小, 24 * 大小, 5 * 大小)
    .fillRect(cx - 12 * 大小, cy + 24 * 大小, 24 * 大小, 5 * 大小);
  for (let i = -1; i <= 1; i++)
    g.lineStyle(2, 0xe9bd66).lineBetween(
      cx + i * 5 * 大小,
      cy + 28 * 大小,
      cx + i * 5 * 大小 + Math.sin(t * 2 + i) * 6,
      cy + 44 * 大小,
    );
}

/** 静态与动态共用主体，动画层替换静止姿态，避免在原位留下第二只熊猫或第二列车。 */
function 绘制旅行主体(g: 图形, 宽: number, 地点: 地点皮肤, t: number): void {
  const 风 = Math.sin(t * 0.7);
  // 远近云层分速移动，主体有自己的运动节奏，不随粒子一起漂移。
  for (let i = 0; i < 4; i++) {
    const x = ((宽 * 随机(i + 23) + t * (5 + i * 2)) % (宽 + 340)) - 170;
    const y = 210 + i * 52;
    for (let j = 0; j < 4; j++)
      g.fillStyle(0xf4f0da, 0.045).fillEllipse(x + j * 46, y + Math.sin(j) * 7, 180, 32 + j * 5);
  }
  if (地点.纹样 === "熊猫") {
    const x = 宽 * 0.75;
    g.fillStyle(0x234b3a, 0.24).fillEllipse(x, 760, 180 + 风 * 4, 25);
    熊猫(g, x, 650, 135, t);
    for (const p of [0.06, 0.91]) {
      const bx = 宽 * p,
        偏 = 风 * 14;
      g.lineStyle(7, 0x365c49).strokePoints([
        { x: bx, y: 900 },
        { x: bx + 偏 * 0.5, y: 650 },
        { x: bx + 偏, y: 370 },
      ]);
      for (let i = 0; i < 5; i++) {
        const y = 420 + i * 86,
          bx2 = bx + 偏 * (1 - i / 6);
        for (const d of [-1, 1])
          多边形(
            g,
            [
              [bx2, y],
              [bx2 + d * 67, y - 18 + Math.sin(t * 1.5 + i) * 5],
              [bx2 + d * 34, y + 8],
            ],
            0x365f47,
            0.9,
          );
      }
    }
  } else if (地点.纹样 === "莲叶" || 地点.纹样 === "山水") {
    行舟(
      g,
      宽 * (地点.纹样 === "莲叶" ? 0.32 : 0.69) + Math.sin(t * 0.085) * Math.min(宽 * 0.28, 260),
      地点.纹样 === "莲叶" ? 706 : 755,
      t,
      地点.纹样 === "山水",
    );
    if (地点.纹样 === "莲叶")
      for (let i = 0; i < 7; i++) {
        const x = (宽 * (i + 0.2)) / 7 + Math.sin(t * 0.55 + i) * 4,
          y = 775 + Math.sin(i * 2) * 55 + Math.sin(t * 1.1 + i) * 3;
        g.fillStyle(0x416d59).fillEllipse(x, y, 88, 24 + Math.sin(t + i) * 3);
        g.lineStyle(1, 0x8ca781, 0.6).lineBetween(x - 20, y - 2, x + 24, y + 2);
        for (const d of [-1, 0, 1])
          g.fillStyle(d ? 0xd8a5b2 : 0xf4d3ca).fillEllipse(
            x + 13 + d * 5,
            y - 11,
            11,
            19 + Math.sin(t * 0.6 + i) * 2,
          );
      }
  } else if (地点.纹样 === "流沙") {
    const 首 = ((宽 * 0.15 + t * 8) % (宽 + 300)) - 80;
    for (let i = 0; i < 4; i++) {
      const x = 首 + i * 54,
        y = 735 + i * 7 + Math.sin(t * 2.1 + i) * 2;
      g.fillStyle(0x55483b)
        .fillEllipse(x, y, 35, 18)
        .fillCircle(x - 7, y - 11, 10)
        .fillCircle(x + 8, y - 11, 9)
        .fillRoundedRect(x + 16, y - 29, 7, 28, 3)
        .fillEllipse(x + 23, y - 28, 17, 9);
      for (let k = 0; k < 4; k++) {
        const 位 = k < 2 ? -11 : 12,
          摆 = Math.sin(t * 2.1 + i + (k * Math.PI) / 2) * 7;
        g.lineStyle(3, 0x55483b).lineBetween(x + 位, y + 5, x + 位 + 摆, y + 25);
      }
      g.fillStyle(0xa26748).fillRoundedRect(x - 10, y - 7, 19, 15, 2);
      if (i < 3) g.lineStyle(1, 0x6c5136).lineBetween(x + 24, y - 23, x + 45, y - 6);
    }
    for (let i = 0; i < 5; i++)
      g.lineStyle(2, 0xf0c58d, 0.12).strokeEllipse(
        (宽 * (i + 0.5)) / 5 + Math.sin(t + i) * 14,
        650 + i * 39,
        200,
        12,
      );
  } else if (地点.纹样 === "霓虹") {
    const x = ((宽 * 0.55 + t * 62) % (宽 + 360)) - 260;
    for (let i = 0; i < 3; i++) {
      const cx = x + i * 83,
        y = 566 - (cx / 宽) * 35;
      g.fillStyle(0xe4bc9d).fillRoundedRect(cx, y - 36, 79, 30, 6);
      g.fillStyle(0x395d7c).fillRect(cx + 5, y - 30, 68, 15);
      for (let k = 0; k < 4; k++)
        g.fillStyle(0xffdf9d, 0.6 + Math.sin(t + k) * 0.15).fillRect(
          cx + 8 + k * 17,
          y - 28,
          12,
          11,
        );
      g.lineStyle(2, 0x984f6e).lineBetween(cx + 4, y - 10, cx + 74, y - 10);
    }
    const 船x = 宽 * 0.72 + Math.sin(t * 0.09) * 宽 * 0.2;
    多边形(
      g,
      [
        [船x - 42, 775],
        [船x + 47, 775],
        [船x + 30, 790],
        [船x - 30, 790],
      ],
      0x2e3550,
    );
    g.fillStyle(0xe1b88d).fillRoundedRect(船x - 24, 758, 46, 17, 3);
    for (let i = 0; i < 5; i++)
      g.fillStyle(0xffc98d, 0.18 - i * 0.025).fillRect(
        船x - 23 + Math.sin(t + i) * 8,
        797 + i * 7,
        46 - i * 5,
        3,
      );
  } else if (地点.纹样 === "宫阙" || 地点.纹样 === "铜纹") {
    const 宫 = 地点.纹样 === "宫阙";
    for (let i = 0; i < (宫 ? 8 : 7); i++) {
      const x = (宽 * (i + 0.5)) / (宫 ? 8 : 7),
        y = 宫 ? 755 : 380 + Math.sin(i) * 30;
      灯笼(g, x, 宫 ? 700 : 230, y, t, 宫 ? 0.7 : 1);
    }
    if (!宫)
      for (let i = 0; i < 5; i++) {
        const x = (宽 * (i + 0.15)) / 5 + Math.sin(t * 0.4 + i) * 13,
          y = 460 - ((t * 9 + i * 79) % 350);
        g.fillStyle(0xf0ba72, 0.55).fillRoundedRect(x, y, 12, 17, 3);
        g.fillStyle(0xffe5a0, 0.7).fillEllipse(x + 6, y + 16, 6, 3);
      }
  } else if (地点.纹样 === "织锦") {
    const 点: { x: number; y: number }[] = [];
    for (let i = 0; i < 13; i++) {
      const x = (宽 * i) / 12,
        y = 270 + Math.sin((i / 12) * Math.PI) * 100;
      点.push({ x, y });
      const 摆 = Math.sin(t * 2 + i * 0.7) * 12,
        w = Math.max(20, 宽 * 0.065);
      多边形(
        g,
        [
          [x, y],
          [x + w, y + 4],
          [x + w - 3 + 摆, y + 60 + Math.sin(t + i) * 7],
          [x + 摆, y + 56],
        ],
        [0xbf7167, 0xe4c684, 0x6c9ab1, 0x93b18c][i % 4],
      );
      g.lineStyle(1, 0xffe7b8, 0.5).lineBetween(x + 5, y + 8, x + 5 + 摆, y + 48);
    }
    g.lineStyle(2, 0x80724f).strokePoints(点);
  } else if (地点.纹样 === "松针") {
    松树(g, 宽 * 0.75 + 风 * 3, 600, 225);
    松树(g, 宽 * 0.16 + Math.sin(t * 0.8 + 1) * 3, 720, 160);
    for (let i = 0; i < 6; i++)
      g.fillStyle(0xe6eadb, 0.14).fillEllipse(
        ((宽 * (i / 5) + t * (7 + i)) % (宽 + 280)) - 140,
        730 + Math.sin(t * 0.2 + i) * 26,
        380,
        68,
      );
  } else if (地点.纹样 === "窗棂") {
    g.fillStyle(0x9cb4a5).fillEllipse(宽 * 0.4, 846, 宽 * 0.72, 83);
    for (let i = 0; i < 3; i++) {
      const a = t * 0.4 + i * 2.1,
        x = 宽 * 0.4 + Math.cos(a) * 宽 * 0.22,
        y = 842 + Math.sin(a) * 23;
      g.fillStyle(i % 2 ? 0xf0d3a1 : 0xc57f66).fillEllipse(x, y, 27, 9);
      多边形(
        g,
        [
          [x - 10, y],
          [x - 22, y - 7 + Math.sin(t * 5 + i) * 3],
          [x - 22, y + 7],
        ],
        0xcf9b75,
      );
    }
    灯笼(g, 宽 * 0.19, 500, 570, t, 0.55);
  }
  if (地点.纹样 === "城砖" || 地点.纹样 === "冰晶" || 地点.纹样 === "松针") {
    for (let i = 0; i < 3; i++) {
      const x = ((宽 * 0.2 + i * 65 + t * 18) % (宽 + 160)) - 80,
        y = 310 + i * 15 + Math.sin(t * 0.7 + i) * 12,
        翅 = 9 + Math.sin(t * 3.2 + i) * 6;
      g.lineStyle(2, 地点.纹样 === "冰晶" ? 0x647c8b : 0x536e63, 0.8)
        .lineBetween(x - 11, y - 翅, x, y)
        .lineBetween(x, y, x + 12, y - 翅);
    }
  }
}

export function 绘制旅行动态(
  g: 图形,
  像素宽: number,
  像素高: number,
  时间: number,
  地点: 地点皮肤,
): void {
  const 单位 = 像素高 / 900;
  g.save().scaleCanvas(单位, 单位);
  绘制旅行动态内容(g, 像素宽 / 单位, 时间 / 1000, 地点);
  g.restore();
}

function 绘制旅行动态内容(g: 图形, 宽: number, t: number, 地点: 地点皮肤): void {
  绘制旅行主体(g, 宽, 地点, t);
  if (地点.纹样 === "莲叶") {
    for (let i = 0; i < 45; i++) {
      const x = (随机(i) * 宽 + t * 28) % 宽,
        y = (随机(i + 100) * 900 + t * 180) % 900;
      g.lineStyle(1, 0xe3f0e5, 0.25).lineBetween(x, y, x - 5, y + 17);
    }
    for (let i = 0; i < 7; i++)
      g.lineStyle(1, 0xd5e1ce, 0.18).strokeEllipse(
        (宽 * (i + 0.2)) / 7,
        720 + 随机(i) * 120,
        20 + ((t * 18 + i * 13) % 90),
        5 + ((t * 4) % 16),
      );
  } else if (地点.纹样 === "冰晶") {
    for (let i = 0; i < 38; i++)
      g.fillStyle(0xf8fcf1, 0.3 + 随机(i) * 0.3).fillCircle(
        (随机(i) * 宽 + Math.sin(t + i) * 25 + 宽) % 宽,
        (随机(i + 80) * 900 + t * (10 + 随机(i) * 17)) % 900,
        1 + 随机(i) * 2,
      );
  } else if (地点.纹样 === "流沙") {
    for (let i = 0; i < 45; i++) {
      const x = (随机(i) * 宽 + t * 35) % 宽,
        y = 580 + 随机(i + 80) * 280;
      g.lineStyle(1, 0xf5d6a1, 0.25).lineBetween(x, y, x + 10 + Math.sin(t + i) * 7, y - 2);
    }
  } else if (地点.纹样 === "宫阙" || 地点.纹样 === "铜纹") {
    for (let i = 0; i < 12; i++)
      g.fillStyle(0xffd78f, 0.1 + 0.15 * (1 + Math.sin(t * 1.7 + i))).fillCircle(
        (宽 * (i + 0.5)) / 12,
        300 + 随机(i) * 450,
        2 + 随机(i) * 4,
      );
  } else if (地点.纹样 === "霓虹") {
    for (let i = 0; i < 14; i++) {
      const x = (宽 * (i + 0.5)) / 14;
      g.lineStyle(2, i % 2 ? 0xec9ec2 : 0x8bc3dc, 0.18 + 0.15 * Math.sin(t * 2 + i)).lineBetween(
        x,
        690 + (i % 3) * 32,
        x + 20 + Math.sin(t + i) * 8,
        690 + (i % 3) * 32,
      );
    }
    g.lineStyle(2, 0xffd6a1, 0.5).lineBetween((t * 60) % 宽, 570, ((t * 60) % 宽) + 60, 568);
  } else if (地点.纹样 === "熊猫") {
    for (let i = 0; i < 18; i++) {
      const x = (随机(i) * 宽 + t * 14) % 宽,
        y = (随机(i + 90) * 900 + t * 16) % 900;
      多边形(
        g,
        [
          [x, y],
          [x + 13, y + 3],
          [x + 3, y + 9],
        ],
        0xb6d6a0,
        0.5,
      );
    }
  } else if (地点.纹样 === "织锦") {
    for (let i = 0; i < 12; i++) {
      const x = (宽 * i) / 11,
        y = 270 + Math.sin((i / 11) * Math.PI) * 100;
      g.lineStyle(3, 0xffebad, 0.4).lineBetween(
        x,
        y,
        x + 宽 * 0.05,
        y + Math.sin(t * 2 + i) * 7 + 4,
      );
    }
  } else {
    for (let i = 0; i < 7; i++)
      g.fillStyle(0xe2e7da, 0.065).fillEllipse(
        (((宽 + 220) * 随机(i) + t * (4 + i * 0.3)) % (宽 + 220)) - 110,
        430 + 随机(i + 40) * 320,
        150 + 随机(i) * 180,
        18 + 随机(i) * 25,
      );
  }
}
