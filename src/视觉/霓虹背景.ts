import type Phaser from "phaser";
import type { 背景主题 } from "../../core/设置";

const 随机值 = (索引: number): number => {
  const 值 = Math.sin(索引 * 127.1 + 311.7) * 43758.5453123;
  return 值 - Math.floor(值);
};

export const 背景主题选项: { 值: 背景主题; 标签: string; 描述: string }[] = [
  { 值: "晨光海岸", 标签: "晨光海岸", 描述: "暖阳、海面与流动的微光" },
  { 值: "云海山岚", 标签: "云海山岚", 描述: "柔和天空、远山与漂浮云层" },
  { 值: "极光原野", 标签: "极光原野", 描述: "青绿极光与闪烁星野" },
  { 值: "霓虹天际", 标签: "霓虹天际", 描述: "明亮天色、城市灯火与光轨" },
];

/** 绘制随画布尺寸重排的代码生成场景底图。 */
export function 绘制霓虹背景(
  图形: Phaser.GameObjects.Graphics,
  宽: number,
  高: number,
  主题: 背景主题 = "晨光海岸",
): void {
  图形.clear();
  if (主题 === "晨光海岸") 绘制海岸底图(图形, 宽, 高);
  else if (主题 === "云海山岚") 绘制山岚底图(图形, 宽, 高);
  else if (主题 === "极光原野") 绘制原野底图(图形, 宽, 高);
  else 绘制天际底图(图形, 宽, 高);
}

/** 只重绘独立动态层，底图保持静态以减少每帧绘图开销。 */
export function 绘制动态霓虹细节(
  图形: Phaser.GameObjects.Graphics,
  宽: number,
  高: number,
  时间: number,
  主题: 背景主题 = "晨光海岸",
): void {
  图形.clear();
  if (主题 === "晨光海岸") 绘制海面动画(图形, 宽, 高, 时间);
  else if (主题 === "云海山岚") 绘制云层动画(图形, 宽, 高, 时间, 0xeffbff);
  else if (主题 === "极光原野") 绘制极光动画(图形, 宽, 高, 时间);
  else 绘制城市动画(图形, 宽, 高, 时间);
}

function 绘制海岸底图(图形: Phaser.GameObjects.Graphics, 宽: number, 高: number): void {
  const 海平线 = 高 * 0.61;
  图形.fillGradientStyle(0x83cce5, 0xb6e2e7, 0xf7d8a7, 0xf9e6c5, 1, 1, 1, 1).fillRect(0, 0, 宽, 高);
  图形.fillStyle(0xfff0b7, 0.76).fillCircle(宽 * 0.76, 高 * 0.26, Math.min(宽, 高) * 0.095);
  图形.fillStyle(0xfff6d6, 0.36).fillCircle(宽 * 0.76, 高 * 0.26, Math.min(宽, 高) * 0.14);
  图形.fillStyle(0xe6ba89, 0.3).fillRect(0, 海平线, 宽, 高 - 海平线);
  图形.fillStyle(0x86c9c7, 0.91).fillRect(0, 海平线 + 高 * 0.04, 宽, 高 * 0.32);
  图形.fillStyle(0x70b7bc, 0.85).fillRect(0, 海平线 + 高 * 0.25, 宽, 高 * 0.39);
  图形.fillStyle(0x5d9da9, 0.86).fillRect(0, 海平线 + 高 * 0.49, 宽, 高 * 0.51);
  图形.fillStyle(0xfff0c2, 0.64).fillEllipse(宽 * 0.76, 海平线 + 高 * 0.09, 宽 * 0.26, 高 * 0.035);
  for (let i = 0; i < 9; i += 1) {
    const y = 海平线 - 高 * (0.035 + i * 0.035);
    图形
      .fillStyle(0xffffff, 0.12 - i * 0.008)
      .fillEllipse(
        宽 * (0.1 + 随机值(i + 9) * 0.8),
        y,
        宽 * (0.12 + 随机值(i + 39) * 0.16),
        高 * 0.014,
      );
  }
  图形.fillStyle(0x317f81, 0.48).fillRect(0, 高 * 0.93, 宽, 高 * 0.07);
}

function 绘制山岚底图(图形: Phaser.GameObjects.Graphics, 宽: number, 高: number): void {
  图形.fillGradientStyle(0x9bd8ed, 0xd1e9e9, 0xf7e2bf, 0xf4efd9, 1, 1, 1, 1).fillRect(0, 0, 宽, 高);
  图形.fillStyle(0xfff4c7, 0.9).fillCircle(宽 * 0.79, 高 * 0.22, Math.min(宽, 高) * 0.075);
  绘制山脉(图形, 宽, 高, 高 * 0.68, 0x91b9bc, 0.64, 0.16);
  绘制山脉(图形, 宽, 高, 高 * 0.79, 0x719e9d, 0.76, 0.22);
  绘制山脉(图形, 宽, 高, 高 * 0.91, 0x557d78, 0.88, 0.3);
  图形.fillStyle(0x8ab7a9, 0.94).fillRect(0, 高 * 0.9, 宽, 高 * 0.1);
}

function 绘制山脉(
  图形: Phaser.GameObjects.Graphics,
  宽: number,
  高: number,
  底部: number,
  颜色: number,
  透明度: number,
  高度比例: number,
): void {
  图形.fillStyle(颜色, 透明度);
  const 步长 = 宽 / 3;
  for (let i = -1; i < 5; i += 1) {
    const x = i * 步长;
    const 峰高 = 高 * 高度比例 * (0.55 + 随机值(i + Math.floor(底部)) * 0.7);
    图形.fillTriangle(x - 步长 * 0.7, 底部, x + 步长 * 0.45, 底部 - 峰高, x + 步长 * 1.4, 底部);
  }
}

function 绘制原野底图(图形: Phaser.GameObjects.Graphics, 宽: number, 高: number): void {
  图形.fillGradientStyle(0x729fbe, 0x9cbaca, 0xead6ad, 0xb8ceaa, 1, 1, 1, 1).fillRect(0, 0, 宽, 高);
  图形.fillStyle(0xfff0c1, 0.86).fillCircle(宽 * 0.2, 高 * 0.25, Math.min(宽, 高) * 0.067);
  for (let i = 0; i < 80; i += 1) {
    const x = 随机值(i + 120) * 宽;
    const y = 随机值(i + 320) * 高 * 0.64;
    图形
      .fillStyle(i % 5 === 0 ? 0xffe9c1 : 0xe9f5df, 0.28 + 随机值(i + 600) * 0.42)
      .fillCircle(x, y, 0.7 + 随机值(i + 800) * 1.5);
  }
  绘制山脉(图形, 宽, 高, 高 * 0.79, 0x7e9b9b, 0.58, 0.35);
  图形.fillStyle(0x587e72, 0.91).fillEllipse(宽 * 0.5, 高 * 1.02, 宽 * 1.55, 高 * 0.46);
}

function 绘制天际底图(图形: Phaser.GameObjects.Graphics, 宽: number, 高: number): void {
  const 地平线 = 高 * 0.7;
  图形.fillGradientStyle(0x72bad8, 0xb8d9e7, 0xe6bad9, 0xf7d7c2, 1, 1, 1, 1).fillRect(0, 0, 宽, 高);
  图形.fillStyle(0xfff2c5, 0.86).fillCircle(宽 * 0.78, 高 * 0.24, Math.min(宽, 高) * 0.07);
  图形.fillStyle(0x709db2, 0.75).fillRect(0, 地平线, 宽, 高 - 地平线);
  图形.fillStyle(0x4e7189, 0.9).fillRect(0, 高 * 0.84, 宽, 高 * 0.16);
  for (let i = 0; i < 35; i += 1) {
    const 楼宽 = 宽 * (0.022 + 随机值(i + 7) * 0.03);
    const x = 随机值(i + 71) * 宽;
    const 楼高 = 高 * (0.12 + 随机值(i + 31) * 0.29);
    const y = 地平线 - 楼高 + 高 * 0.035;
    图形.fillStyle(i % 3 === 0 ? 0x405f7d : 0x34536f, 0.82).fillRect(x, y, 楼宽, 楼高);
    图形.lineStyle(1, i % 2 === 0 ? 0xffcf88 : 0x8af0ef, 0.42).lineBetween(x, y, x + 楼宽, y);
    for (let row = 0; row < 5; row += 1) {
      if (随机值(i * 13 + row * 7 + 2) > 0.35) {
        图形
          .fillStyle(row % 2 ? 0xffe6a3 : 0x9ef3ee, 0.42)
          .fillRect(
            x + 楼宽 * 0.2,
            y + 8 + row * 12,
            Math.max(2, 楼宽 * 0.16),
            Math.max(2, 高 * 0.006),
          );
      }
    }
  }
}

function 绘制海面动画(
  图形: Phaser.GameObjects.Graphics,
  宽: number,
  高: number,
  时间: number,
): void {
  for (let i = 0; i < 32; i += 1) {
    const y = 高 * (0.65 + 随机值(i + 111) * 0.31);
    const 速度 = 12 + 随机值(i + 29) * 25;
    const 长 = 宽 * (0.025 + 随机值(i + 47) * 0.085);
    const x = ((随机值(i + 77) * 宽 + 时间 * 速度) % (宽 + 长)) - 长;
    const 光 = 0.14 + (0.5 + Math.sin(时间 * 0.0015 + i) * 0.5) * 0.24;
    图形
      .fillStyle(i % 3 === 0 ? 0xfff3c6 : 0xd8fff4, 光)
      .fillRoundedRect(x, y, 长, Math.max(1.5, 高 * 0.0025), 3);
  }
  绘制云层动画(图形, 宽, 高, 时间, 0xffffff, 0.22);
}

function 绘制云层动画(
  图形: Phaser.GameObjects.Graphics,
  宽: number,
  高: number,
  时间: number,
  颜色: number,
  透明度 = 0.46,
): void {
  for (let i = 0; i < 5; i += 1) {
    const 云宽 = 宽 * (0.09 + 随机值(i + 81) * 0.1);
    const 云高 = 高 * (0.018 + 随机值(i + 91) * 0.014);
    const x = ((随机值(i + 17) * (宽 + 云宽) + 时间 * (5 + i * 1.8)) % (宽 + 云宽)) - 云宽;
    const y = 高 * (0.14 + 随机值(i + 41) * 0.27);
    图形.fillStyle(颜色, 透明度).fillEllipse(x, y, 云宽, 云高);
    图形
      .fillStyle(颜色, 透明度 * 0.8)
      .fillEllipse(x + 云宽 * 0.2, y - 云高 * 0.35, 云宽 * 0.43, 云高 * 0.9);
    图形
      .fillStyle(颜色, 透明度 * 0.75)
      .fillEllipse(x - 云宽 * 0.2, y - 云高 * 0.18, 云宽 * 0.36, 云高 * 0.7);
  }
}

function 绘制极光动画(
  图形: Phaser.GameObjects.Graphics,
  宽: number,
  高: number,
  时间: number,
): void {
  const 基准Y = 高 * 0.41;
  const 极光颜色 = [0x83f0d0, 0x9ee6c2, 0x92dff2, 0xc5edbd];
  for (let 条 = 0; 条 < 4; 条 += 1) {
    const 色 = 极光颜色[条] ?? 0x83f0d0;
    const 位移 = Math.sin(时间 * 0.00024 + 条) * 高 * 0.035;
    const 振幅 = 高 * (0.025 + 条 * 0.006);
    图形.lineStyle(Math.max(4, 高 * 0.018), 色, 0.1 + Math.sin(时间 * 0.0003 + 条) * 0.04);
    for (let x = 0; x < 宽; x += Math.max(8, 宽 / 90)) {
      const nx = x / 宽;
      const y1 = 基准Y + 位移 + Math.sin(nx * 7 + 时间 * 0.00045 + 条) * 振幅;
      const y2 = 基准Y + 位移 + Math.sin((nx + 0.012) * 7 + 时间 * 0.00045 + 条) * 振幅;
      图形.lineBetween(x, y1, Math.min(宽, x + Math.max(8, 宽 / 90)), y2);
    }
  }
  for (let i = 0; i < 42; i += 1) {
    const 闪 = 0.25 + (0.5 + 0.5 * Math.sin(时间 * (0.001 + 随机值(i + 50) * 0.001) + i)) * 0.6;
    图形
      .fillStyle(i % 4 === 0 ? 0xfff1be : 0xf1fff1, 闪)
      .fillCircle(随机值(i + 1) * 宽, 随机值(i + 101) * 高 * 0.66, 0.7 + 随机值(i + 201) * 1.4);
  }
}

function 绘制城市动画(
  图形: Phaser.GameObjects.Graphics,
  宽: number,
  高: number,
  时间: number,
): void {
  const 地平线 = 高 * 0.7;
  for (let i = 0; i < 28; i += 1) {
    const 楼宽 = 宽 * (0.022 + 随机值(i + 7) * 0.03);
    const x = 随机值(i + 71) * 宽;
    const 楼高 = 高 * (0.12 + 随机值(i + 31) * 0.29);
    const y = 地平线 - 楼高 + 高 * 0.035;
    for (let row = 0; row < 5; row += 1) {
      const 相位 = 时间 * (0.0007 + 随机值(i * 13 + row * 7 + 12) * 0.0007) + i + row;
      const alpha = 0.2 + (0.5 + Math.sin(相位) * 0.5) * 0.5;
      图形
        .fillStyle(row % 2 ? 0xffe6a3 : 0x9ef3ee, alpha)
        .fillRect(
          x + 楼宽 * 0.2,
          y + 8 + row * 12,
          Math.max(2, 楼宽 * 0.16),
          Math.max(2, 高 * 0.006),
        );
    }
  }
  for (let i = 0; i < 4; i += 1) {
    const t = (时间 * (0.00007 + i * 0.000013) + i * 0.23) % 1;
    const y = 地平线 + 高 * (0.04 + t * t * 0.72);
    const 长 = 宽 * (0.04 + t * 0.12);
    const x = (i % 2 ? 宽 * 0.5 - 长 : 宽 * 0.5) + Math.sin(时间 * 0.0003 + i) * 宽 * 0.12;
    图形
      .fillStyle(i % 2 ? 0xffd29c : 0x9df7ee, 0.18 + t * 0.25)
      .fillRoundedRect(x, y, 长, Math.max(2, 高 * 0.003), 3);
  }
}
